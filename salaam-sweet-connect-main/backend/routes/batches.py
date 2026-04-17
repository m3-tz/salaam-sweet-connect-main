from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import sanitize_text, get_admin_info
from utils.audit import log_action
from utils.academic import generate_academic_id
from email_service import send_custom_email

batches_bp = Blueprint('batches', __name__)


@batches_bp.route('/api/admin/batches', methods=['GET'])
def get_batches():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT b.*,
                   COUNT(DISTINCT u.universityId) AS student_count,
                   COUNT(DISTINCT CASE WHEN l.status IN ('نشط','Active') THEN l.id END) AS active_loans
            FROM batches b
            LEFT JOIN users u ON u.batch_id = b.id
            LEFT JOIN loans l ON l.university_id = u.universityId
            GROUP BY b.id
            ORDER BY b.created_at DESC
        """)
        batches = cursor.fetchall()
        for b in batches:
            if b.get('expires_at'):  b['expires_at']  = str(b['expires_at'])
            if b.get('created_at'):  b['created_at']  = str(b['created_at'])
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': batches}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches', methods=['POST'])
def create_batch():
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        conn         = get_db_connection()
        cursor       = conn.cursor()
        cursor.execute("""
            INSERT INTO batches
                (name, code, department, is_active, auto_approve, can_view_locations, can_borrow, expires_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            sanitize_text(data.get('name')),
            sanitize_text(data.get('code', '')),
            sanitize_text(data.get('department', '')),
            int(data.get('is_active', 1)),
            int(data.get('auto_approve', 0)),
            int(data.get('can_view_locations', 0)),
            int(data.get('can_borrow', 1)),
            data.get('expires_at') or None,
        ))
        batch_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        log_action(admin_id, admin_name, 'إنشاء دفعة', f"تم إنشاء دفعة: {data.get('name')}")
        return jsonify({'status': 'success', 'id': batch_id}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>', methods=['PUT'])
def update_batch(batch_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        conn         = get_db_connection()
        cursor       = conn.cursor()
        cursor.execute("""
            UPDATE batches
            SET name=%s, code=%s, department=%s, is_active=%s,
                auto_approve=%s, can_view_locations=%s, can_borrow=%s, expires_at=%s
            WHERE id=%s
        """, (
            sanitize_text(data.get('name')),
            sanitize_text(data.get('code', '')),
            sanitize_text(data.get('department', '')),
            int(data.get('is_active', 1)),
            int(data.get('auto_approve', 0)),
            int(data.get('can_view_locations', 0)),
            int(data.get('can_borrow', 1)),
            data.get('expires_at') or None,
            batch_id,
        ))
        conn.commit()
        cursor.close()
        conn.close()
        log_action(admin_id, admin_name, 'تعديل دفعة', f'تم تعديل الدفعة ID: {batch_id}')
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>', methods=['DELETE'])
def delete_batch(batch_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE batch_id=%s", (batch_id,))
        if cursor.fetchone()['cnt'] > 0:
            return jsonify({'status': 'error', 'message': 'لا يمكن حذف الدفعة — يوجد طلاب مسجلون فيها'}), 400
        cursor.execute("DELETE FROM batches WHERE id=%s", (batch_id,))
        conn.commit()
        cursor.close()
        conn.close()
        log_action(admin_id, admin_name, 'حذف دفعة', f'تم حذف الدفعة ID: {batch_id}')
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/batches/active', methods=['GET'])
def get_active_batches():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, name, code, department FROM batches
            WHERE is_active=1 AND (expires_at IS NULL OR expires_at > CURDATE())
            ORDER BY name ASC
        """)
        batches = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': batches}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>/students', methods=['GET'])
def get_batch_students(batch_id):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.universityId, u.name, u.email, u.phone, u.role,
                   u.is_banned, u.batch_id,
                   COUNT(CASE WHEN l.status IN ('نشط','Active')   THEN 1 END) AS active_loans,
                   COUNT(CASE WHEN l.status IN ('متأخر','Overdue') THEN 1 END) AS overdue_loans
            FROM users u
            LEFT JOIN loans l ON l.university_id = u.universityId
            WHERE u.batch_id=%s
            GROUP BY u.universityId
            ORDER BY u.name ASC
        """, (batch_id,))
        students = cursor.fetchall()
        for s in students:
            s['name']     = sanitize_text(s.get('name', ''))
            s['isBanned'] = bool(s.get('is_banned', 0))
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': students}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>/assign-student', methods=['POST'])
def assign_student_to_batch(batch_id):
    try:
        data          = request.get_json()
        admin_id, admin_name = get_admin_info()
        university_id = sanitize_text(data.get('universityId'))

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT name, email FROM users WHERE universityId=%s", (university_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'status': 'error', 'message': 'الطالب غير موجود'}), 404

        cursor.execute("SELECT * FROM batches WHERE id=%s", (batch_id,))
        batch = cursor.fetchone()
        if not batch:
            return jsonify({'status': 'error', 'message': 'الدفعة غير موجودة'}), 404

        new_university_id = generate_academic_id(cursor, batch['code'])
        old_university_id = university_id

        # Cascade: update dependent tables before changing the PK
        cursor.execute(
            "UPDATE loans SET university_id=%s WHERE university_id=%s",
            (new_university_id, old_university_id),
        )
        cursor.execute(
            "UPDATE cart_requests SET studentId=%s WHERE studentId=%s",
            (new_university_id, old_university_id),
        )
        cursor.execute(
            "UPDATE users SET universityId=%s, batch_id=%s WHERE universityId=%s",
            (new_university_id, batch_id, old_university_id),
        )
        affected = cursor.rowcount
        conn.commit()

        if user.get('email'):
            try:
                send_custom_email(
                    user['email'],
                    f"رقمك الأكاديمي في دفعة {batch['name']}",
                    (f"مرحباً {user['name']}،\n\n"
                     f"تم تعيينك في دفعة: {batch['name']}\n"
                     f"رقمك الأكاديمي: {new_university_id}\n\n"
                     "يمكنك الآن تسجيل الدخول بهذا الرقم.\n\nأكاديمية طويق — إدارة القطع"),
                )
            except Exception as mail_err:
                print(f'Email failed: {mail_err}')

        cursor.close()
        conn.close()

        if affected == 0:
            return jsonify({'status': 'error',
                            'message': f'لم يتم تحديث أي سجل — تأكد من الرقم: {university_id}'}), 400

        log_action(admin_id, admin_name, 'تعيين طالب لدفعة',
                   f"{user['name']} → دفعة {batch['name']} | رقم: {new_university_id}")
        return jsonify({'status': 'success', 'universityId': new_university_id}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>/remove-student', methods=['POST'])
def remove_student_from_batch(batch_id):
    try:
        data          = request.get_json()
        admin_id, admin_name = get_admin_info()
        university_id = sanitize_text(data.get('universityId'))

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name FROM users WHERE universityId=%s", (university_id,))
        user = cursor.fetchone()
        if not user:
            return jsonify({'status': 'error', 'message': 'الطالب غير موجود'}), 404

        cursor.execute("UPDATE users SET batch_id=NULL WHERE universityId=%s",
                       (university_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إزالة من دفعة',
                   f"{user['name']} أُزيل من الدفعة {batch_id}")
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@batches_bp.route('/api/admin/batches/<int:batch_id>/send-email', methods=['POST'])
def send_batch_email(batch_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        subject      = data.get('subject', '')
        body         = data.get('body', '')
        if not subject or not body:
            return jsonify({'status': 'error', 'message': 'الموضوع والنص مطلوبان'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT name, email FROM users WHERE batch_id=%s AND email IS NOT NULL AND email!=''",
            (batch_id,),
        )
        students = cursor.fetchall()
        cursor.close()
        conn.close()

        sent = 0
        for s in students:
            try:
                send_custom_email(s['email'], subject, body.replace('{name}', s['name']))
                sent += 1
            except Exception:
                pass

        log_action(admin_id, admin_name, 'إرسال إيميل دفعة',
                   f'تم إرسال {sent} إيميل للدفعة {batch_id}')
        return jsonify({'status': 'success', 'sent': sent}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
