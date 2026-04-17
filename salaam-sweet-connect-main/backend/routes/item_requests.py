"""
نظام طلبات القطع الجديدة – Item Requests
الطالب يطلب قطعة غير موجودة، المشرف يوافق/يرفض/يؤكد الشراء
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection
from utils.helpers import sanitize_text, get_admin_info
from utils.audit import log_action
from email_service import send_item_request_status

item_requests_bp = Blueprint('item_requests', __name__)


# ──────────────────────────────────────────────
# Auto-create table
# ──────────────────────────────────────────────

def _ensure_table(cursor, conn):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS item_requests (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            student_id      VARCHAR(50)  NOT NULL,
            student_name    VARCHAR(200) NOT NULL DEFAULT '',
            item_name       VARCHAR(300) NOT NULL,
            item_name_en    VARCHAR(300) DEFAULT '',
            category        VARCHAR(100) DEFAULT 'عام',
            quantity        INT          DEFAULT 1,
            description     TEXT,
            urgency         VARCHAR(20)  DEFAULT 'normal',
            reference_url   VARCHAR(500) DEFAULT '',
            image_url       VARCHAR(500) DEFAULT '',
            status          VARCHAR(30)  DEFAULT 'pending',
            admin_comment   TEXT,
            admin_id        VARCHAR(50)  DEFAULT '',
            admin_name      VARCHAR(200) DEFAULT '',
            created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()


# ──────────────────────────────────────────────
# POST /api/item-requests — إنشاء طلب جديد (طالب)
# ──────────────────────────────────────────────

@item_requests_bp.route('/api/item-requests', methods=['POST'])
def create_item_request():
    try:
        data = request.get_json()
        student_id   = sanitize_text(data.get('studentId', ''))
        student_name = sanitize_text(data.get('studentName', ''))
        item_name    = sanitize_text(data.get('itemName', ''))
        item_name_en = sanitize_text(data.get('itemNameEn', ''))
        category     = sanitize_text(data.get('category', 'عام'))
        quantity     = int(data.get('quantity', 1))
        description  = data.get('description', '')
        urgency      = sanitize_text(data.get('urgency', 'normal'))
        reference_url = sanitize_text(data.get('referenceUrl', ''))
        image_url    = sanitize_text(data.get('imageUrl', ''))

        if not student_id or not item_name:
            return jsonify({'status': 'error', 'message': 'اسم القطعة والرقم الأكاديمي مطلوبان'}), 400

        if quantity < 1:
            quantity = 1

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_table(cursor, conn)

        cursor.execute("""
            INSERT INTO item_requests
                (student_id, student_name, item_name, item_name_en,
                 category, quantity, description, urgency,
                 reference_url, image_url, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending')
        """, (student_id, student_name, item_name, item_name_en,
              category, quantity, description, urgency,
              reference_url, image_url))
        conn.commit()
        req_id = cursor.lastrowid
        cursor.close()
        conn.close()

        log_action(student_id, student_name, 'طلب قطعة جديدة',
                   f'قطعة: {item_name} | الكمية: {quantity} | الأولوية: {urgency}')

        return jsonify({
            'status': 'success',
            'message': 'تم إرسال طلبك بنجاح',
            'data': {'id': req_id}
        }), 201

    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# GET /api/item-requests/my/<student_id> — طلبات الطالب
# ──────────────────────────────────────────────

@item_requests_bp.route('/api/item-requests/my/<student_id>', methods=['GET'])
def get_my_item_requests(student_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_table(cursor, conn)

        cursor.execute("""
            SELECT * FROM item_requests
            WHERE student_id = %s
            ORDER BY created_at DESC
        """, (student_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        for r in rows:
            if r.get('created_at'): r['created_at'] = str(r['created_at'])
            if r.get('updated_at'): r['updated_at'] = str(r['updated_at'])

        return jsonify({'status': 'success', 'data': rows}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# GET /api/item-requests — كل الطلبات (مشرف)
# ──────────────────────────────────────────────

@item_requests_bp.route('/api/item-requests', methods=['GET'])
def get_all_item_requests():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_table(cursor, conn)

        status_filter = request.args.get('status', '')
        urgency_filter = request.args.get('urgency', '')

        query = "SELECT * FROM item_requests"
        conditions = []
        params = []

        if status_filter:
            conditions.append("status = %s")
            params.append(status_filter)
        if urgency_filter:
            conditions.append("urgency = %s")
            params.append(urgency_filter)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY FIELD(urgency,'urgent','high','normal') ASC, created_at DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        # إحصائيات سريعة
        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(status = 'pending') AS pending_count,
                SUM(status = 'approved') AS approved_count,
                SUM(status = 'purchased') AS purchased_count,
                SUM(status = 'rejected') AS rejected_count,
                SUM(urgency = 'urgent') AS urgent_count
            FROM item_requests
        """)
        stats = cursor.fetchone()

        # عدد الطلبات المكررة (نفس القطعة من كذا طالب)
        cursor.execute("""
            SELECT item_name, COUNT(DISTINCT student_id) AS student_count, SUM(quantity) AS total_qty
            FROM item_requests
            WHERE status = 'pending'
            GROUP BY item_name
            HAVING COUNT(DISTINCT student_id) > 1
            ORDER BY student_count DESC
        """)
        duplicates = cursor.fetchall()

        cursor.close()
        conn.close()

        for r in rows:
            if r.get('created_at'): r['created_at'] = str(r['created_at'])
            if r.get('updated_at'): r['updated_at'] = str(r['updated_at'])

        return jsonify({
            'status': 'success',
            'data': rows,
            'stats': stats,
            'duplicates': duplicates,
        }), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# PUT /api/item-requests/<id> — تحديث حالة الطلب (مشرف)
# ──────────────────────────────────────────────

@item_requests_bp.route('/api/item-requests/<int:req_id>', methods=['PUT'])
def update_item_request(req_id):
    try:
        data = request.get_json()
        admin_id, admin_name = get_admin_info()
        new_status   = sanitize_text(data.get('status', ''))
        admin_comment = data.get('adminComment', '')

        if new_status not in ('approved', 'rejected', 'purchased', 'pending'):
            return jsonify({'status': 'error', 'message': 'حالة غير صالحة'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # جلب الطلب الحالي
        cursor.execute("SELECT * FROM item_requests WHERE id = %s", (req_id,))
        req = cursor.fetchone()
        if not req:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'الطلب غير موجود'}), 404

        cursor.execute("""
            UPDATE item_requests
            SET status = %s, admin_comment = %s, admin_id = %s, admin_name = %s
            WHERE id = %s
        """, (new_status, admin_comment, admin_id, admin_name, req_id))
        conn.commit()

        status_labels = {
            'approved': 'موافقة', 'rejected': 'رفض',
            'purchased': 'تم الشراء', 'pending': 'معلق'
        }
        log_action(admin_id, admin_name, f'{status_labels.get(new_status, "")} طلب قطعة',
                   f'طلب #{req_id} | قطعة: {req["item_name"]} | الطالب: {req["student_name"]}')

        # إرسال إيميل للطالب
        try:
            cursor.execute(
                "SELECT email FROM users WHERE universityId = %s",
                (req['student_id'],)
            )
            student = cursor.fetchone()
            if student and student.get('email'):
                send_item_request_status(
                    to_email=student['email'],
                    student_name=req['student_name'],
                    item_name=req['item_name'],
                    quantity=req['quantity'],
                    status=new_status,
                    admin_comment=admin_comment,
                )
        except Exception as mail_err:
            print(f'Email error (non-critical): {mail_err}')

        # ── إذا تم الشراء: أضف القطعة للمخزون تلقائياً ──
        added_to_inventory = False
        if new_status == 'purchased':
            try:
                # تحقق هل القطعة موجودة في المخزون
                cursor.execute("SELECT name, quantity FROM items WHERE name = %s", (req['item_name'],))
                existing = cursor.fetchone()
                if existing:
                    # حدّث الكمية
                    cursor.execute(
                        "UPDATE items SET quantity = quantity + %s WHERE name = %s",
                        (req['quantity'], req['item_name'])
                    )
                else:
                    # أنشئ قطعة جديدة
                    cursor.execute("""
                        INSERT INTO items (name, name_en, quantity, category, location, imageUrl)
                        VALUES (%s, %s, %s, %s, 'غير محدد', '')
                    """, (req['item_name'], req.get('item_name_en', ''),
                          req['quantity'], req.get('category', 'عام')))

                conn.commit()
                added_to_inventory = True

                log_action(admin_id, admin_name, 'إضافة قطعة للمخزون (من طلب)',
                           f'{req["item_name"]} × {req["quantity"]}')
            except Exception as inv_err:
                print(f'Inventory auto-add error: {inv_err}')

        cursor.close()
        conn.close()

        msg = f'تم تحديث الطلب بنجاح'
        if added_to_inventory:
            msg += ' + تم إضافة القطعة للمخزون تلقائياً'

        return jsonify({'status': 'success', 'message': msg, 'added_to_inventory': added_to_inventory}), 200

    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# DELETE /api/item-requests/<id> — حذف طلب
# ──────────────────────────────────────────────

@item_requests_bp.route('/api/item-requests/<int:req_id>', methods=['DELETE'])
def delete_item_request(req_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM item_requests WHERE id = %s", (req_id,))
        req = cursor.fetchone()
        if not req:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'غير موجود'}), 404

        cursor.execute("DELETE FROM item_requests WHERE id = %s", (req_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف طلب قطعة',
                   f'طلب #{req_id} | {req["item_name"]}')

        return jsonify({'status': 'success', 'message': 'تم الحذف'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
