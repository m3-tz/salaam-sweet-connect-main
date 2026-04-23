from datetime import date

from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import get_admin_info
from utils.audit import log_action
from email_service import send_return_confirmation
from pdf_service   import generate_loan_return_certificate

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
        cursor = conn.cursor(dictionary=True)

        # fetch student contact BEFORE update
        cursor.execute("""
            SELECT l.university_id, u.name AS student_name, u.email
            FROM loans l LEFT JOIN users u ON u.universityId = l.university_id
            WHERE l.id=%s
        """, (loan_id,))
        loan_row = cursor.fetchone() or {}

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

        if loan_row.get('email'):
            try:
                attachments = None
                try:
                    pdf_bytes, _ = generate_loan_return_certificate({
                        'id': loan_id,
                        'student_name': loan_row.get('student_name') or '',
                        'university_id': loan_row.get('university_id'),
                        'item_name': item_name,
                        'quantity': quantity,
                        'condition': condition,
                        'admin_name': admin_name or '',
                    })
                    attachments = [{
                        'filename': f'return-{loan_id}.pdf',
                        'content':  pdf_bytes,
                        'mime':     'application/pdf',
                    }]
                except Exception as _pe:
                    print(f'[pdf] return cert skip: {_pe}')
                send_return_confirmation(
                    to_email    = loan_row['email'],
                    student_name= loan_row.get('student_name') or '',
                    item_name   = item_name,
                    quantity    = quantity,
                    condition   = condition,
                    admin_name  = admin_name or '',
                    attachments = attachments,
                )
            except Exception as _e:
                print(f'[email] return_confirmation skip: {_e}')

        return jsonify({'status': 'success', 'message': msg}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@loans_bp.route('/api/loans/return-bulk', methods=['POST'])
def return_loans_bulk():
    """
    Bulk return: one atomic DB pass, ONE email with ONE PDF listing all items.
    Payload: { "loans": [{"id": int, "itemName": str, "quantity": int, "condition": "good"|"damaged"}, ...] }
    """
    try:
        data      = request.get_json() or {}
        loans_in  = data.get('loans') or []
        if not loans_in:
            return jsonify({'status': 'error', 'message': 'no loans'}), 400
        admin_id, admin_name = get_admin_info()

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        ids = [int(l['id']) for l in loans_in]
        fmt = ','.join(['%s'] * len(ids))
        cursor.execute(f"""
            SELECT l.id, l.university_id, u.name AS student_name, u.email
            FROM loans l LEFT JOIN users u ON u.universityId = l.university_id
            WHERE l.id IN ({fmt})
        """, ids)
        loan_rows = cursor.fetchall()
        by_id     = {r['id']: r for r in loan_rows}
        student   = next((r for r in loan_rows if r.get('email')), None) or (loan_rows[0] if loan_rows else {})

        processed = []
        for l in loans_in:
            lid, item, qty, cond = int(l['id']), l.get('itemName'), int(l.get('quantity') or 1), l.get('condition', 'good')
            if cond == 'damaged':
                cursor.execute("UPDATE loans SET status='صيانة' WHERE id=%s", (lid,))
                log_action(admin_id, admin_name, 'تحويل للصيانة',
                           f'تم استلام {qty} من {item} بحالة تالفة/للمعاينة')
            else:
                cursor.execute("UPDATE loans SET status='مُرجع' WHERE id=%s", (lid,))
                cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s", (qty, item))
                log_action(admin_id, admin_name, 'إرجاع عهدة سليمة',
                           f'تم استلام وإرجاع {qty} من {item} للمخزون')
            processed.append({'item_name': item, 'quantity': qty, 'condition': cond})

        conn.commit()
        cursor.close()
        conn.close()

        if student.get('email'):
            try:
                attachments = None
                try:
                    pdf_bytes, _ = generate_loan_return_certificate({
                        'id': f'bulk-{ids[0]}',
                        'student_name':  student.get('student_name') or '',
                        'university_id': student.get('university_id'),
                        'admin_name':    admin_name or '',
                        'items':         processed,
                    })
                    attachments = [{
                        'filename': f'returns-{student.get("university_id","bulk")}.pdf',
                        'content':  pdf_bytes,
                        'mime':     'application/pdf',
                    }]
                except Exception as _pe:
                    print(f'[pdf] bulk return cert skip: {_pe}')

                # Build a single summary email body
                items_list = '\n'.join(f"• {p['item_name']} (x{p['quantity']}) — "
                                       f"{'تالفة' if p['condition']=='damaged' else 'سليمة'}"
                                       for p in processed)
                any_damaged = any(p['condition'] == 'damaged' for p in processed)
                from email_service import _send_email  # reuse low-level sender to get one email
                subject = ('تأكيد إرجاع قطع — تحويل للصيانة 🔧' if any_damaged
                           else 'تأكيد إرجاع القطع ✅')
                html = f"""
                <div style="font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;max-width:560px;margin:auto;padding:20px;background:#f8fafc">
                  <h2 style="color:#0f3b66">تم استلام عهدك ✅</h2>
                  <p>مرحباً {student.get('student_name') or ''}،</p>
                  <p>تم استلام القطع التالية ({len(processed)}):</p>
                  <pre style="background:#fff;padding:12px;border:1px solid #e5e7eb;border-radius:8px;white-space:pre-wrap">{items_list}</pre>
                  <p style="color:#6b7280;font-size:13px">نسخة PDF مرفقة للتوقيع.</p>
                </div>
                """
                _send_email(student['email'], subject, html, attachments=attachments)
            except Exception as _e:
                print(f'[email] bulk return skip: {_e}')

        return jsonify({'status': 'success',
                        'message': f'تم استلام {len(processed)} قطعة',
                        'count':   len(processed)}), 200
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
