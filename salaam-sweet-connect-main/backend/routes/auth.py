import random
import string as _string
import uuid
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import hash_password, verify_password, sanitize_text, get_admin_info
from utils.audit import log_action
from utils.limiter import limiter
from utils.security import (get_client_ip, is_blocked, record_failed_attempt,
                             reset_attempts, get_attempt_count as _get_attempt_count,
                             MAX_ATTEMPTS)
from email_service import (
    send_registration_confirmation,
    send_otp_email,
    generate_otp,
    send_custom_email,
    send_password_changed,
)

auth_bp = Blueprint('auth', __name__)

# In-memory OTP store  { key -> {"otp": str, "expires_at": datetime, "verified"?: bool} }
_otp_store: dict = {}


# ──────────────────────────────────────────────
# Login
# ──────────────────────────────────────────────

@auth_bp.route('/api/login', methods=['POST'])
@limiter.limit('10 per minute; 50 per hour')
def login():
    try:
        client_ip = get_client_ip()

        # ── حماية Brute Force: فحص الحجب ──────────────────────────────
        blocked, secs = is_blocked(client_ip)
        if blocked:
            return jsonify({
                'status':            'error',
                'message':           'تم حجب هذا الجهاز بشكل دائم بسبب محاولات اختراق متكررة. تواصل مع الإدارة.',
                'blocked':           True,
                'permanent':         True,
                'seconds_remaining': -1,
            }), 429

        data          = request.get_json()
        university_id = sanitize_text(data.get('universityId'))
        password      = data.get('password', '')

        if not university_id or not password:
            return jsonify({'status': 'error', 'message': 'الرجاء إدخال الرقم الأكاديمي وكلمة المرور'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.universityId, u.name, u.role, u.password,
                   COALESCE(u.is_banned, 0) AS is_banned,
                   COALESCE(b.can_view_locations, 1) AS can_view_locations,
                   COALESCE(b.can_borrow, 1) AS can_borrow,
                   COALESCE(b.auto_approve, 0) AS auto_approve
            FROM users u
            LEFT JOIN batches b ON b.id = u.batch_id
            WHERE u.universityId = %s
        """, (university_id,))
        user = cursor.fetchone()
        cursor.close()
        # ⚠️ لا تغلق conn هنا — نحتاجها لجلب صلاحيات RBAC

        if user and verify_password(password, user['password']):
            if user['is_banned'] == 1:
                conn.close()
                log_action(university_id, sanitize_text(user['name']), 'محاولة دخول فاشلة',
                           'حاول مستخدم محظور تسجيل الدخول', ip_address=client_ip)
                return jsonify({'status': 'error', 'message': 'عذراً، هذا الحساب محظور من استخدام المعمل.'}), 403

            # ── نجح الدخول: امسح سجل المحاولات الفاشلة ──────────────
            reset_attempts(client_ip)

            user_name = sanitize_text(user['name'])
            user.pop('is_banned', None)
            user.pop('password', None)
            user['name'] = user_name
            user['can_view_locations'] = bool(user.get('can_view_locations', 1))
            user['can_borrow']         = bool(user.get('can_borrow', 1))
            user['auto_approve']       = bool(user.get('auto_approve', 0))

            # ── Session Token: يُولَّد token جديد يُبطل الجلسة القديمة ──
            session_token = str(uuid.uuid4())
            try:
                cur_st = conn.cursor()
                # auto-migrate العمود إن لم يكن موجوداً
                cur_st.execute(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                    "session_token VARCHAR(64) NULL DEFAULT NULL"
                )
                conn.commit()
                cur_st.execute(
                    "UPDATE users SET session_token = %s WHERE universityId = %s",
                    (session_token, user['universityId']),
                )
                conn.commit()
                cur_st.close()
            except Exception as e:
                print(f'[login] session_token error: {e!r}')
                session_token = None
            user['session_token'] = session_token

            # ── RBAC: جلب صلاحيات المستخدم حسب رتبته ──────────────
            user_permissions = []
            try:
                cursor2 = conn.cursor(dictionary=True)
                cursor2.execute(
                    "SELECT permission_key FROM role_permissions WHERE role = %s",
                    (user['role'],)
                )
                user_permissions = [r['permission_key'] for r in cursor2.fetchall()]
                cursor2.close()
            except Exception:
                pass  # جدول الصلاحيات غير موجود بعد
            finally:
                conn.close()

            user['permissions'] = user_permissions

            log_action(user['universityId'], user_name, 'تسجيل دخول',
                       'عملية تسجيل دخول ناجحة للنظام', ip_address=client_ip)
            return jsonify({'status': 'success', 'message': 'تم تسجيل الدخول', 'user': user}), 200

        # ── فشل الدخول: سجّل المحاولة ────────────────────────────────
        conn.close()
        just_blocked = record_failed_attempt(client_ip)
        log_action(
            university_id or 'unknown',
            'مجهول',
            'محاولة دخول فاشلة',
            f'بيانات دخول غير صحيحة للرقم: {university_id}',
            ip_address=client_ip,
        )

        if just_blocked:
            log_action('النظام', 'النظام', 'حجب IP دائم',
                       f'تم حجب {client_ip} بشكل دائم بعد {MAX_ATTEMPTS} محاولات فاشلة',
                       ip_address=client_ip)
            return jsonify({
                'status':    'error',
                'message':   'تم حجب هذا الجهاز بشكل دائم بسبب المحاولات المتكررة. تواصل مع الإدارة لإلغاء الحجب.',
                'blocked':   True,
                'permanent': True,
            }), 429

        remaining_attempts = MAX_ATTEMPTS - _get_attempt_count(client_ip)
        return jsonify({
            'status':             'error',
            'message':            f'بيانات الدخول غير صحيحة.',
            'remaining_attempts': remaining_attempts,
        }), 401
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Registration
# ──────────────────────────────────────────────

@auth_bp.route('/api/register', methods=['POST'])
def register():
    try:
        data      = request.get_json()
        name      = sanitize_text(data.get('name'))
        password  = data.get('password')
        phone     = sanitize_text(data.get('phone'))
        role      = data.get('role', 'طالب')
        email     = sanitize_text(data.get('email', ''))
        raw_batch = data.get('batch_id')
        batch_id  = int(raw_batch) if raw_batch and str(raw_batch).isdigit() else None

        university_id = 'REG-' + ''.join(random.choices(_string.digits, k=8))

        if not name or not password or not phone:
            return jsonify({'status': 'error', 'message': 'جميع الحقول مطلوبة'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT universityId FROM users WHERE universityId = %s", (university_id,))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'الرقم الجامعي مسجل مسبقاً، تفضل بتسجيل الدخول'}), 400

        cursor.execute(
            "SELECT universityId FROM registration_requests "
            "WHERE universityId = %s AND status = 'pending'",
            (university_id,),
        )
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'لديك طلب تسجيل معلق بالفعل ينتظر موافقة المشرف'}), 400

        today     = date.today().strftime('%Y-%m-%d')
        hashed_pw = hash_password(password)

        cursor.execute(
            "INSERT INTO registration_requests "
            "(name, universityId, phone, password, role, email, batch_id, requestDate, status) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')",
            (name, university_id, phone, hashed_pw, role, email, batch_id, today),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(university_id, name, 'طلب تسجيل جديد', f'تم إرسال طلب تسجيل حساب ({role})')

        if email:
            try:
                send_registration_confirmation(email, name)
            except Exception as mail_err:
                print(f'Email error (non-critical): {mail_err}')

        return jsonify({'status': 'success', 'message': 'تم إرسال طلبك بنجاح! يرجى انتظار موافقة المشرف'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Change password (logged-in user)
# ──────────────────────────────────────────────

@auth_bp.route('/api/users/change-password', methods=['POST'])
def change_password():
    try:
        data          = request.get_json()
        admin_id, admin_name = get_admin_info()
        university_id = sanitize_text(data.get('universityId'))
        old_password  = data.get('oldPassword')
        new_password  = data.get('newPassword')

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT password FROM users WHERE universityId = %s", (university_id,))
        user = cursor.fetchone()

        if not user or not verify_password(old_password, user['password']):
            cursor.close()
            conn.close()
            return jsonify({'status': 'error', 'message': 'كلمة المرور الحالية غير صحيحة'}), 400

        cursor.execute(
            "UPDATE users SET password = %s WHERE universityId = %s",
            (hash_password(new_password), university_id),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تغيير كلمة المرور', 'قام المستخدم بتغيير كلمة المرور الخاصة به')
        return jsonify({'status': 'success', 'message': 'تم تغيير كلمة المرور بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Forgot password (OTP flow – 3 steps)
# ──────────────────────────────────────────────

@auth_bp.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data          = request.get_json()
        university_id = sanitize_text(data.get('universityId'))

        if not university_id:
            return jsonify({'status': 'error', 'message': 'الرجاء إدخال الرقم الأكاديمي'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT universityId, name, email FROM users WHERE universityId = %s",
            (university_id,),
        )
        user = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user:
            return jsonify({'status': 'success', 'message': 'إذا كان الرقم مسجلاً، ستصلك رسالة على إيميلك'}), 200

        if not user.get('email'):
            return jsonify({'status': 'error', 'message': 'لا يوجد إيميل مرتبط بهذا الحساب، تواصل مع المشرف'}), 400

        otp = generate_otp(6)
        _otp_store[university_id] = {
            'otp':        otp,
            'expires_at': datetime.now() + timedelta(minutes=10),
        }

        result = send_otp_email(user['email'], sanitize_text(user['name']), otp)
        if result['success']:
            return jsonify({'status': 'success', 'message': 'تم إرسال رمز التحقق على إيميلك'}), 200
        return jsonify({'status': 'error', 'message': 'فشل إرسال الإيميل، حاول مرة أخرى'}), 500
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@auth_bp.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data          = request.get_json()
        university_id = sanitize_text(data.get('universityId'))
        otp_input     = str(data.get('otp', '')).strip()

        stored = _otp_store.get(university_id)
        if not stored:
            return jsonify({'status': 'error', 'message': 'لم يتم طلب رمز تحقق لهذا الحساب'}), 400

        if datetime.now() > stored['expires_at']:
            del _otp_store[university_id]
            return jsonify({'status': 'error', 'message': 'انتهت صلاحية الرمز، اطلب رمزاً جديداً'}), 400

        if otp_input != stored['otp']:
            return jsonify({'status': 'error', 'message': 'الرمز غير صحيح'}), 400

        return jsonify({'status': 'success', 'message': 'الرمز صحيح، يمكنك الآن تعيين كلمة مرور جديدة'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@auth_bp.route('/api/reset-password-otp', methods=['POST'])
def reset_password_otp():
    try:
        data          = request.get_json()
        university_id = sanitize_text(data.get('universityId'))
        otp_input     = str(data.get('otp', '')).strip()
        new_password  = data.get('newPassword', '')

        if not new_password or len(new_password) < 6:
            return jsonify({'status': 'error', 'message': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'}), 400

        stored = _otp_store.get(university_id)
        if not stored or otp_input != stored['otp']:
            return jsonify({'status': 'error', 'message': 'الرمز غير صحيح أو منتهي الصلاحية'}), 400

        if datetime.now() > stored['expires_at']:
            del _otp_store[university_id]
            return jsonify({'status': 'error', 'message': 'انتهت صلاحية الرمز، اطلب رمزاً جديداً'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name, email FROM users WHERE universityId = %s", (university_id,))
        user_row = cursor.fetchone() or {}
        cursor.execute("UPDATE users SET password = %s WHERE universityId = %s",
                       (hash_password(new_password), university_id))
        conn.commit()
        cursor.close()
        conn.close()

        del _otp_store[university_id]
        log_action(university_id, 'النظام', 'إعادة تعيين كلمة المرور', 'تم التعيين عبر OTP')

        if user_row.get('email'):
            try:
                send_password_changed(
                    to_email    = user_row['email'],
                    student_name= user_row.get('name') or '',
                    method      = 'otp',
                )
            except Exception as _e:
                print(f'[email] password_changed skip: {_e}')

        return jsonify({'status': 'success', 'message': 'تم تعيين كلمة المرور الجديدة بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Email OTP verification (pre-registration)
# ──────────────────────────────────────────────

@auth_bp.route('/api/send-email-otp', methods=['POST'])
def send_email_otp():
    try:
        data  = request.get_json()
        email = sanitize_text(data.get('email', ''))

        if not email or '@' not in email:
            return jsonify({'status': 'error', 'message': 'الرجاء إدخال إيميل صحيح'}), 400

        otp = generate_otp(6)
        _otp_store[f'email_{email}'] = {
            'otp':        otp,
            'expires_at': datetime.now() + timedelta(minutes=10),
        }

        result = send_otp_email(email, '', otp)
        if result['success']:
            return jsonify({'status': 'success', 'message': 'تم إرسال رمز التحقق على إيميلك'}), 200
        return jsonify({'status': 'error', 'message': 'فشل إرسال الإيميل، تحقق من الإيميل وحاول مرة أخرى'}), 500
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@auth_bp.route('/api/verify-email-otp', methods=['POST'])
def verify_email_otp():
    try:
        data      = request.get_json()
        email     = sanitize_text(data.get('email', ''))
        otp_input = str(data.get('otp', '')).strip()
        key       = f'email_{email}'

        stored = _otp_store.get(key)
        if not stored:
            return jsonify({'status': 'error', 'message': 'لم يتم إرسال رمز لهذا الإيميل، اضغط إرسال الرمز'}), 400

        if datetime.now() > stored['expires_at']:
            del _otp_store[key]
            return jsonify({'status': 'error', 'message': 'انتهت صلاحية الرمز، اضغط إرسال الرمز مرة أخرى'}), 400

        if otp_input != stored['otp']:
            return jsonify({'status': 'error', 'message': 'الرمز غير صحيح'}), 400

        _otp_store[key]['verified'] = True
        return jsonify({'status': 'success', 'message': 'تم التحقق من الإيميل بنجاح ✅'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
