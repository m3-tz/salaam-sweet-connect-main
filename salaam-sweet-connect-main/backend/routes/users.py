from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import hash_password, sanitize_text, get_admin_info
from utils.audit import log_action

users_bp = Blueprint('users', __name__)


@users_bp.route('/api/users', methods=['GET'])
def get_users():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.universityId, u.name, u.role, u.phone, u.email,
                   COALESCE(u.is_banned, 0) as is_banned,
                   u.batch_id,
                   (SELECT COUNT(*) FROM loans l
                    WHERE l.university_id = u.universityId AND l.status = 'نشط') as activeLoans
            FROM users u
            ORDER BY u.name ASC
        """)
        users = cursor.fetchall()
        cursor.close()
        conn.close()

        for user in users:
            user['isBanned'] = bool(user['is_banned'])
            user['name']     = sanitize_text(user.get('name', ''))

        return jsonify({'status': 'success', 'data': users}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@users_bp.route('/api/users', methods=['POST'])
def add_user():
    try:
        data          = request.json
        admin_id, admin_name = get_admin_info()
        university_id = sanitize_text(data.get('universityId'))
        name          = sanitize_text(data.get('name'))
        role          = data.get('role')
        phone         = sanitize_text(data.get('phone'))
        password      = data.get('password')

        if not university_id or not name or not role:
            return jsonify({'status': 'error', 'message': 'جميع الحقول الأساسية مطلوبة'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE universityId = %s", (university_id,))
        if cursor.fetchone():
            return jsonify({'status': 'error', 'message': 'المستخدم موجود مسبقاً!'}), 400

        hashed_pw = hash_password(password) if password else hash_password(university_id)
        cursor.execute(
            "INSERT INTO users (universityId, name, role, phone, password, is_banned) "
            "VALUES (%s, %s, %s, %s, %s, 0)",
            (university_id, name, role, phone, hashed_pw),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إضافة مستخدم', f'تمت إضافة مستخدم جديد: {name} بصلاحية {role}')
        return jsonify({'status': 'success', 'message': 'تم إضافة المستخدم بنجاح'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': 'فشل في إضافة المستخدم'}), 500


@users_bp.route('/api/users/<string:university_id>', methods=['PUT'])
def update_user(university_id):
    try:
        data         = request.json
        admin_id, admin_name = get_admin_info()
        name  = data.get('name')
        role  = data.get('role')
        phone = data.get('phone')
        email = data.get('email')        # ← حقل البريد (كان مفقوداً)

        if not name or not role:
            return jsonify({'status': 'error', 'message': 'الاسم والدور مطلوبان'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET name=%s, role=%s, phone=%s, email=%s WHERE universityId=%s",
            (name, role, phone, email or None, university_id),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تعديل مستخدم', f'تم تعديل بيانات المستخدم: {name}')
        return jsonify({'status': 'success', 'message': 'تم تحديث بيانات المستخدم بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': 'فشل في تحديث المستخدم'}), 500


@users_bp.route('/api/users/<string:univ_id>', methods=['DELETE'])
def delete_user(univ_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE universityId = %s", (univ_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف مستخدم', f'تم حذف حساب المستخدم: {univ_id}')
        return jsonify({'status': 'success', 'message': 'تم حذف المستخدم'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@users_bp.route('/api/users/<string:user_id>/status', methods=['PUT'])
def toggle_user_ban(user_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        is_banned    = 1 if data.get('isBanned') else 0

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_banned=%s WHERE universityId=%s", (is_banned, user_id))
        conn.commit()
        conn.close()

        status_text = 'حظر' if is_banned == 1 else 'فك حظر'
        log_action(admin_id, admin_name, f'{status_text} مستخدم', f'تم {status_text} المستخدم صاحب الرقم: {user_id}')
        return jsonify({'status': 'success', 'message': 'تم تحديث حالة المستخدم'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@users_bp.route('/api/users/<string:univ_id>/reset-password', methods=['PUT'])
def reset_password(univ_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET password=%s WHERE universityId=%s",
            (hash_password(univ_id), univ_id),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إعادة ضبط كلمة مرور',
                   f'تم تعيين كلمة المرور للافتراضية للمستخدم: {univ_id}')
        return jsonify({'status': 'success', 'message': 'تم إعادة ضبط كلمة المرور'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
