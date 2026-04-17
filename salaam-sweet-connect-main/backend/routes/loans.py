from datetime import date

from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import get_admin_info
from utils.audit import log_action

loans_bp = Blueprint('loans', __name__)


@loans_bp.route('/api/loans', methods=['GET'])
def get_loans():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.id, l.university_id AS studentId, u.name AS studentName,
                   l.item_name AS componentName, l.qty AS quantity,
                   l.checkout_date AS borrowDate,
                   l.expected_return_date AS expectedReturnDate,
                   l.status
            FROM loans l
            LEFT JOIN users u ON l.university_id = u.universityId
            ORDER BY l.id DESC
        """)
        loans = cursor.fetchall()
        cursor.close()
        conn.close()

        for loan in loans:
            if loan['borrowDate']:         loan['borrowDate']         = str(loan['borrowDate'])
            if loan['expectedReturnDate']: loan['expectedReturnDate'] = str(loan['expectedReturnDate'])

        return jsonify({'status': 'success', 'data': loans}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@loans_bp.route('/api/loans', methods=['POST'])
def create_loan():
    try:
        data          = request.get_json()
        admin_id, admin_name = get_admin_info()
        student_id    = data.get('studentId')
        item_name     = data.get('itemName')
        quantity      = data.get('quantity')
        return_date   = data.get('returnDate')
        today         = date.today().strftime('%Y-%m-%d')

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO loans (university_id, item_name, qty, checkout_date, expected_return_date, status) "
            "VALUES (%s,%s,%s,%s,%s,'نشط')",
            (student_id, item_name, quantity, today, return_date),
        )
        cursor.execute("UPDATE items SET quantity=quantity-%s WHERE name=%s", (quantity, item_name))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'صرف عهدة يدوي',
                   f'تم صرف {quantity} من {item_name} للمستخدم {student_id}')
        return jsonify({'status': 'success', 'message': 'تم تسجيل العهدة'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@loans_bp.route('/api/loans/return/<int:loan_id>', methods=['POST'])
def return_loan(loan_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        item_name    = data.get('itemName')
        quantity     = data.get('quantity')
        condition    = data.get('condition', 'good')

        conn   = get_db_connection()
        cursor = conn.cursor()

        if condition == 'damaged':
            cursor.execute("UPDATE loans SET status='صيانة' WHERE id=%s", (loan_id,))
            log_action(admin_id, admin_name, 'تحويل للصيانة',
                       f'تم استلام {quantity} من {item_name} بحالة تالفة/للمعاينة')
            msg = 'تم استلام القطعة وتحويلها لقسم الصيانة'
        else:
            cursor.execute("UPDATE loans SET status='مُرجع' WHERE id=%s", (loan_id,))
            cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s", (quantity, item_name))
            log_action(admin_id, admin_name, 'إرجاع عهدة سليمة',
                       f'تم استلام وإرجاع {quantity} من {item_name} للمخزون')
            msg = 'تم الإرجاع للمخزون بنجاح'

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'message': msg}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@loans_bp.route('/api/loans/<int:loan_id>', methods=['DELETE'])
def delete_loan(loan_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT item_name, qty, status, university_id FROM loans WHERE id=%s", (loan_id,))
        loan = cursor.fetchone()

        if loan:
            if loan['status'] in ['نشط', 'متأخر', 'Active', 'Overdue']:
                cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s",
                               (loan['qty'], loan['item_name']))
            cursor.execute("DELETE FROM loans WHERE id=%s", (loan_id,))
            log_action(admin_id, admin_name, 'حذف عهدة',
                       f"تم حذف عهدة القطعة {loan['item_name']} للطالب {loan['university_id']}")

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'message': 'تم حذف السجل وإرجاع الكمية للمخزون'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Maintenance
# ──────────────────────────────────────────────

@loans_bp.route('/api/maintenance', methods=['GET'])
def get_maintenance_items():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT l.id, l.item_name, l.qty AS quantity,
                   u.name AS student_name, l.checkout_date
            FROM loans l
            LEFT JOIN users u ON l.university_id = u.universityId
            WHERE l.status = 'صيانة'
            ORDER BY l.id DESC
        """)
        items = cursor.fetchall()
        for item in items:
            if item['checkout_date']: item['checkout_date'] = str(item['checkout_date'])
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': items}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@loans_bp.route('/api/maintenance/resolve/<int:loan_id>', methods=['POST'])
def resolve_maintenance(loan_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        action       = data.get('action')
        item_name    = data.get('itemName')
        quantity     = data.get('quantity')

        conn   = get_db_connection()
        cursor = conn.cursor()

        if action == 'repaired':
            cursor.execute("UPDATE loans SET status='مُرجع' WHERE id=%s", (loan_id,))
            cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s", (quantity, item_name))
            log_action(admin_id, admin_name, 'إصلاح قطعة',
                       f'تم إصلاح {quantity} من {item_name} وإعادتها للمخزون')
            msg = 'تم الإصلاح وإعادة الكمية للمخزون'
        elif action == 'scrapped':
            cursor.execute("UPDATE loans SET status='تالف_نهائي' WHERE id=%s", (loan_id,))
            log_action(admin_id, admin_name, 'إتلاف قطعة',
                       f'تم إتلاف {quantity} من {item_name} وخصمها من النظام')
            msg = 'تم إتلاف القطعة وخصمها من النظام نهائياً'
        else:
            msg = 'إجراء غير معروف'

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'message': msg}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
