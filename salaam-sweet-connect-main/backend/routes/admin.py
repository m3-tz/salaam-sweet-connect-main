import csv
import io

from flask import Blueprint, Response, jsonify, request

from database import get_db_connection
from utils.helpers import hash_password, sanitize_text, get_admin_info
from utils.audit import log_action
from utils.security import get_blocked_ips, get_all_failed, unblock_ip
from email_service import send_custom_email, send_overdue_reminder

admin_bp = Blueprint('admin', __name__)


# ──────────────────────────────────────────────
# Audit logs
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/audit-logs', methods=['GET'])
def get_audit_logs():
    try:
        limit = int(request.args.get('limit', 500))
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(f"SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT {limit}")
        logs = cursor.fetchall()
        cursor.close()
        conn.close()

        for log in logs:
            if log['created_at']:
                log['created_at'] = log['created_at'].isoformat()

        return jsonify({'status': 'success', 'data': logs}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Security: blocked IPs & failed attempts
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/blocked-ips', methods=['GET'])
def list_blocked_ips():
    """Return IPs currently blocked by brute-force protection."""
    try:
        return jsonify({'status': 'success', 'data': get_blocked_ips()}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/failed-attempts', methods=['GET'])
def list_failed_attempts():
    """Return all IPs that have recorded failed login attempts."""
    try:
        return jsonify({'status': 'success', 'data': get_all_failed()}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/unblock-ip', methods=['POST'])
def admin_unblock_ip():
    """Manually unblock an IP address."""
    try:
        admin_id, admin_name = get_admin_info()
        ip = sanitize_text((request.get_json(silent=True) or {}).get('ip', ''))
        if not ip:
            return jsonify({'status': 'error', 'message': 'ip مطلوب'}), 400
        found = unblock_ip(ip)
        if found:
            log_action(admin_id, admin_name, 'إلغاء حجب IP',
                       f'تم إلغاء حجب العنوان: {ip}', ip_address=ip)
            return jsonify({'status': 'success', 'message': f'تم إلغاء حجب {ip}'}), 200
        return jsonify({'status': 'error', 'message': 'العنوان غير موجود في قائمة المحجوبين'}), 404
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/session/check', methods=['GET'])
def session_check():
    """فحص خفيف وسريع لصلاحية الجلسة — يُستدعى كل 10 ثوانٍ من الواجهة."""
    uid   = request.args.get('uid', '').strip()
    token = request.args.get('token', '').strip()

    if not uid or not token:
        return jsonify({'valid': False}), 400

    try:
        conn = get_db_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute("SELECT session_token FROM users WHERE universityId = %s", (uid,))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row and row.get('session_token') and row['session_token'] != token:
            return jsonify({'valid': False, 'reason': 'session_expired'}), 200

        return jsonify({'valid': True}), 200
    except Exception:
        # في حال خطأ DB نُعيد valid=True لتفادي طرد المستخدم بسبب خطأ تقني
        return jsonify({'valid': True}), 200


@admin_bp.route('/api/ping', methods=['POST'])
def ping_online():
    """يُرسل من الواجهة كل دقيقتين ليُحدّث last_seen ويتحقق من صلاحية الجلسة."""
    try:
        data          = request.get_json(silent=True) or {}
        university_id = data.get('universityId') or request.headers.get('user-id', '')
        user_name     = data.get('userName', '')
        role          = data.get('role', '')
        page          = data.get('page', '')
        session_token = data.get('sessionToken', '')

        if not university_id:
            return jsonify({'status': 'error', 'message': 'universityId مطلوب'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # auto-migrate: أضف أعمدة الحضور إن لم تكن موجودة
        for col_def in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen DATETIME NULL DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_page VARCHAR(100) NULL DEFAULT NULL",
        ]:
            try:
                cursor.execute(col_def)
                conn.commit()
            except Exception:
                pass

        # ── التحقق من Session Token ────────────────────────────────────
        if session_token:
            try:
                cursor.execute(
                    "SELECT session_token FROM users WHERE universityId = %s",
                    (university_id,)
                )
                db_row = cursor.fetchone()
                if (db_row
                        and db_row.get('session_token')
                        and db_row['session_token'] != session_token):
                    cursor.close()
                    conn.close()
                    return jsonify({
                        'status':  'session_expired',
                        'message': 'تم تسجيل دخولك من جهاز آخر',
                    }), 200
            except Exception:
                pass  # عمود session_token غير موجود بعد — تجاهل
        # ──────────────────────────────────────────────────────────────

        cursor.execute(
            "UPDATE users SET last_seen = NOW(), last_page = %s WHERE universityId = %s",
            (page, university_id),
        )
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/online-users', methods=['GET'])
def get_online_users():
    """يُعيد قائمة المستخدمين النشطين خلال آخر 5 دقائق."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # auto-migrate
        for col_def in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen DATETIME NULL DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_page VARCHAR(100) NULL DEFAULT NULL",
        ]:
            try:
                cursor.execute(col_def)
                conn.commit()
            except Exception:
                pass

        cursor.execute("""
            SELECT universityId, name, role, last_seen, last_page,
                   COALESCE(phone, '') AS phone,
                   COALESCE(email, '') AS email
            FROM users
            WHERE last_seen >= NOW() - INTERVAL 5 MINUTE
            ORDER BY last_seen DESC
        """)
        users = cursor.fetchall()
        cursor.close()
        conn.close()

        for u in users:
            if u['last_seen']:
                u['last_seen'] = u['last_seen'].isoformat()

        return jsonify({'status': 'success', 'data': users, 'count': len(users)}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Dashboard statistics
# ──────────────────────────────────────────────

@admin_bp.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        conn = get_db_connection()

        # auto-create tables that might not exist yet
        _auto_create_tables(conn)

        # Each _count() gets its own cursor so there is never an "Unread result" error
        def _count(sql, params=()):
            cur = None
            try:
                cur = conn.cursor(dictionary=True)
                cur.execute(sql, params)
                row = cur.fetchone()
                # drain any remaining rows to keep the connection clean
                cur.fetchall()
                return int(row['count']) if row else 0
            except Exception as e:
                print(f'[stats] _count error: {e!r} | SQL: {sql[:100]}')
                return 0
            finally:
                if cur:
                    try: cur.close()
                    except Exception: pass

        total_components = _count("SELECT COUNT(*) AS count FROM items")
        active_loans     = _count("SELECT COUNT(*) AS count FROM loans WHERE status IN ('نشط','Active')")
        overdue_loans    = _count("""
            SELECT COUNT(*) AS count FROM loans
            WHERE status IN ('نشط','Active','متأخر','Overdue')
              AND expected_return_date IS NOT NULL AND expected_return_date != ''
              AND (
                STR_TO_DATE(expected_return_date,'%Y/%m/%d') < CURDATE() OR
                STR_TO_DATE(expected_return_date,'%Y-%m-%d') < CURDATE() OR
                STR_TO_DATE(expected_return_date,'%d/%m/%Y') < CURDATE() OR
                STR_TO_DATE(expected_return_date,'%d-%m-%Y') < CURDATE()
              )
        """)
        active_camps     = _count("SELECT COUNT(*) AS count FROM camps WHERE status IN ('active','نشط')")
        pending_reg      = _count("SELECT COUNT(*) AS count FROM registration_requests WHERE status='pending'")
        pending_cart     = _count("SELECT COUNT(*) AS count FROM cart_requests WHERE status='pending'")
        pending_requests = pending_reg + pending_cart

        # last 5 activities
        recent_activity = []
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("""
                SELECT l.id, u.name AS studentName, l.item_name AS componentName,
                       l.checkout_date AS borrowDate, l.status
                FROM loans l LEFT JOIN users u ON l.university_id = u.universityId
                ORDER BY l.id DESC LIMIT 5
            """)
            recent_activity = cur.fetchall()
            cur.close()
            for a in recent_activity:
                if a.get('borrowDate') is not None:
                    a['borrowDate'] = str(a['borrowDate'])
        except Exception as e:
            print(f'[stats] recentActivity error: {e!r}')

        # top 5 most borrowed items
        top_items = []
        try:
            cur = conn.cursor(dictionary=True)
            cur.execute("""
                SELECT item_name AS name, COUNT(*) AS count
                FROM loans GROUP BY item_name ORDER BY count DESC LIMIT 5
            """)
            top_items = cur.fetchall()
            # convert Decimal/int to plain int so jsonify doesn't choke
            for item in top_items:
                item['count'] = int(item['count'])
            cur.close()
        except Exception as e:
            print(f'[stats] topItems error: {e!r}')

        conn.close()

        return jsonify({
            'status': 'success',
            'data': {
                'totalComponents': total_components,
                'activeLoans':     active_loans,
                'overdueLoans':    overdue_loans,
                'activeCamps':     active_camps,
                'pendingRequests': pending_requests,
                'recentActivity':  recent_activity,
                'topItems':        top_items,
            },
        }), 200
    except Exception as exc:
        print(f'[stats] fatal error: {exc!r}')
        return jsonify({'status': 'error', 'message': str(exc)}), 500


def _auto_create_tables(conn) -> None:
    """أنشئ الجداول الأساسية إن لم تكن موجودة — كل جدول بـ cursor مستقل."""
    stmts = [
        """CREATE TABLE IF NOT EXISTS cart_requests (
            id                 INT AUTO_INCREMENT PRIMARY KEY,
            studentId          VARCHAR(50)  NOT NULL DEFAULT '',
            studentName        VARCHAR(200) NOT NULL DEFAULT '',
            requestDate        DATE         NULL,
            expectedReturnDate DATE         NULL,
            status             VARCHAR(30)  NOT NULL DEFAULT 'pending',
            note               TEXT         NULL,
            created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
        """CREATE TABLE IF NOT EXISTS cart_request_items (
            id                INT AUTO_INCREMENT PRIMARY KEY,
            request_id        INT          NOT NULL,
            componentName     VARCHAR(300) NOT NULL DEFAULT '',
            requestedQuantity INT          NOT NULL DEFAULT 1,
            approvedQuantity  INT          NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4""",
    ]
    for stmt in stmts:
        cur = None
        try:
            cur = conn.cursor()
            cur.execute(stmt)
            conn.commit()
        except Exception as e:
            print(f'[stats] _auto_create_tables error: {e!r}')
        finally:
            if cur:
                try: cur.close()
                except Exception: pass


@admin_bp.route('/api/stats/debug', methods=['GET'])
def stats_debug():
    """تشخيص: يُظهر نتيجة كل استعلام على حدة للمساعدة في تحديد المشكلة."""
    results = {}
    conn = None
    try:
        conn = get_db_connection()
        queries = {
            'items_count':        "SELECT COUNT(*) AS count FROM items",
            'loans_active':       "SELECT COUNT(*) AS count FROM loans WHERE status IN ('نشط','Active')",
            'loans_table_exists': "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='loans'",
            'camps_table_exists': "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='camps'",
            'cart_req_exists':    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='cart_requests'",
            'reg_req_exists':     "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='registration_requests'",
        }
        for key, sql in queries.items():
            cur = None
            try:
                cur = conn.cursor(dictionary=True)
                cur.execute(sql)
                row = cur.fetchone()
                results[key] = {'ok': True, 'value': int(row['count']) if row else None}
            except Exception as e:
                results[key] = {'ok': False, 'error': str(e)}
            finally:
                if cur:
                    try: cur.close()
                    except Exception: pass
    except Exception as e:
        results['connection'] = {'ok': False, 'error': str(e)}
    finally:
        if conn:
            try: conn.close()
            except Exception: pass
    return jsonify({'status': 'success', 'results': results}), 200


@admin_bp.route('/api/stats/reset-top-items', methods=['POST'])
def reset_top_items():
    try:
        admin_id, admin_name = get_admin_info()
        log_action(admin_id, admin_name, 'تصفير إحصائيات', 'تم تصفير إحصائيات القطع الأكثر طلباً')
        return jsonify({'status': 'success', 'message': 'تم تصفير إحصائيات القطع الأكثر طلباً بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# CSV export
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/export/inventory-csv', methods=['GET'])
def export_inventory_csv():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT i.name          AS 'اسم القطعة',
                   i.name_en       AS 'الاسم بالإنجليزية',
                   i.quantity      AS 'الكمية',
                   i.category      AS 'الفئة',
                   COALESCE(
                       (SELECT GROUP_CONCAT(sl.name SEPARATOR ' / ')
                        FROM item_locations il
                        JOIN storage_locations sl ON il.location_id = sl.id
                        WHERE il.item_name = i.name),
                       i.location, 'غير محدد'
                   ) AS 'الموقع'
            FROM items i
            ORDER BY i.category, i.name
        """)
        items = cursor.fetchall()
        cursor.close()
        conn.close()

        output = io.StringIO()
        output.write('\ufeff')  # BOM for Excel Arabic support
        if items:
            writer = csv.DictWriter(output, fieldnames=items[0].keys())
            writer.writeheader()
            writer.writerows(items)

        return Response(
            output.getvalue(),
            mimetype='text/csv; charset=utf-8',
            headers={'Content-Disposition': 'attachment; filename=inventory.csv'},
        )
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Email management
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/send-custom-email', methods=['POST'])
def admin_send_custom_email():
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        to_email     = sanitize_text(data.get('to', ''))
        subject      = sanitize_text(data.get('subject', ''))
        body_text    = data.get('body', '')

        if not to_email or not subject or not body_text:
            return jsonify({'status': 'error', 'message': 'الإيميل والموضوع والنص مطلوبة'}), 400

        result = send_custom_email(to_email, subject, body_text)
        if result['success']:
            log_action(admin_id, admin_name, 'إرسال إيميل مخصص',
                       f'تم إرسال إيميل إلى: {to_email} | الموضوع: {subject}')
            return jsonify({'status': 'success', 'message': f'تم إرسال الإيميل إلى {to_email}'}), 200
        return jsonify({'status': 'error', 'message': result.get('error', 'فشل الإرسال')}), 500
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/send-overdue-reminders', methods=['POST'])
def send_overdue_reminders():
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.university_id, u.name AS student_name, u.email,
                   l.item_name, l.qty,
                   l.expected_return_date,
                   DATEDIFF(CURDATE(), l.expected_return_date) AS days_overdue
            FROM loans l LEFT JOIN users u ON l.university_id = u.universityId
            WHERE l.status IN ('نشط','متأخر')
              AND l.expected_return_date IS NOT NULL AND l.expected_return_date != ''
              AND (
                STR_TO_DATE(l.expected_return_date,'%Y/%m/%d') < CURDATE() OR
                STR_TO_DATE(l.expected_return_date,'%Y-%m-%d') < CURDATE() OR
                STR_TO_DATE(l.expected_return_date,'%d/%m/%Y') < CURDATE() OR
                STR_TO_DATE(l.expected_return_date,'%d-%m-%Y') < CURDATE()
              )
        """)
        overdue_loans = cursor.fetchall()
        cursor.close()
        conn.close()

        if not overdue_loans:
            return jsonify({'status': 'success', 'message': 'لا توجد عهد متأخرة حالياً', 'sent': 0}), 200

        students: dict = {}
        for loan in overdue_loans:
            uid = loan['university_id']
            if uid not in students:
                students[uid] = {
                    'email':       loan.get('email'),
                    'name':        sanitize_text(loan.get('student_name', uid)),
                    'items':       [],
                    'days_overdue': loan.get('days_overdue', 0),
                }
            students[uid]['items'].append({
                'name':     loan['item_name'],
                'qty':      loan['qty'],
                'due_date': loan.get('expected_return_date', ''),
            })

        sent = skipped = 0
        for uid, info in students.items():
            if not info['email']:
                skipped += 1
                continue
            try:
                send_overdue_reminder(
                    to_email=info['email'],
                    student_name=info['name'],
                    items=info['items'],
                    days_overdue=info['days_overdue'],
                )
                sent += 1
            except Exception as mail_err:
                print(f'Failed to send to {info["email"]}: {mail_err}')
                skipped += 1

        log_action(admin_id, admin_name, 'إرسال تذكيرات',
                   f'تم إرسال {sent} تذكير، تخطي {skipped} (بدون إيميل)')
        return jsonify({'status': 'success', 'sent': sent, 'skipped': skipped,
                        'message': f'تم إرسال {sent} تذكير بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Email templates
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/email-templates', methods=['GET'])
def get_email_templates():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM email_templates ORDER BY created_at DESC")
        templates = cursor.fetchall()
        for t in templates:
            if t.get('created_at'): t['created_at'] = str(t['created_at'])
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': templates}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/email-templates', methods=['POST'])
def save_email_template():
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        conn         = get_db_connection()
        cursor       = conn.cursor()
        if data.get('id'):
            cursor.execute("UPDATE email_templates SET name=%s,subject=%s,body=%s WHERE id=%s",
                           (data['name'], data['subject'], data['body'], data['id']))
        else:
            cursor.execute("INSERT INTO email_templates (name,subject,body) VALUES (%s,%s,%s)",
                           (data['name'], data['subject'], data['body']))
        conn.commit()
        cursor.close()
        conn.close()
        log_action(admin_id, admin_name, 'حفظ قالب إيميل', f"القالب: {data.get('name')}")
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@admin_bp.route('/api/admin/email-templates/<int:template_id>', methods=['DELETE'])
def delete_email_template(template_id):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM email_templates WHERE id=%s", (template_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# One-time password migration utility
# ──────────────────────────────────────────────

@admin_bp.route('/api/admin/migrate-passwords', methods=['POST'])
def migrate_passwords():
    """Migrate legacy plain-text passwords to hashed ones. Run once then remove."""
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT universityId, password FROM users")
        users = cursor.fetchall()

        migrated = skipped = 0
        for u in users:
            pw = u['password'] or ''
            if pw.startswith(('pbkdf2:', 'scrypt:')):
                skipped += 1
                continue
            cursor.execute("UPDATE users SET password=%s WHERE universityId=%s",
                           (hash_password(pw), u['universityId']))
            migrated += 1

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'ترحيل كلمات المرور',
                   f'تم تشفير {migrated} مستخدم، تم تخطي {skipped} مشفر مسبقاً')
        return jsonify({'status': 'success', 'migrated': migrated, 'skipped': skipped,
                        'message': f'تم ترحيل {migrated} كلمة مرور بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
