from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import get_admin_info
from utils.audit import log_action

camps_bp = Blueprint('camps', __name__)


@camps_bp.route('/api/camps', methods=['GET'])
def get_camps():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, camp_name, room_number, receiver_name, return_date,
                   created_at, COALESCE(status,'active') AS status
            FROM camp_requests
            ORDER BY id DESC
        """)
        camps = cursor.fetchall()

        for camp in camps:
            cursor.execute(
                "SELECT item_name AS componentName, qty AS quantity, returned "
                "FROM camp_request_items WHERE request_id=%s",
                (camp['id'],),
            )
            items               = cursor.fetchall()
            camp['items']       = items
            camp['name']        = camp['camp_name']
            camp['organization'] = camp['room_number']
            camp['responsible'] = camp['receiver_name']
            camp['expectedReturnDate'] = str(camp['return_date']) if camp.get('return_date') else ''

            if items and all(i['returned'] == 1 for i in items):
                camp['status'] = 'returned'

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': camps}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@camps_bp.route('/api/camps', methods=['POST'])
def create_camp():
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()
        camp_name    = data.get('campName')
        room_number  = data.get('roomNumber')
        receiver_name = data.get('receiverName')
        return_date  = data.get('returnDate')
        items        = data.get('items', [])

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO camp_requests (camp_name, room_number, receiver_name, return_date, status) "
            "VALUES (%s,%s,%s,%s,'active')",
            (camp_name, room_number, receiver_name, return_date),
        )
        camp_id = cursor.lastrowid

        for item in items:
            cursor.execute(
                "INSERT INTO camp_request_items (request_id, item_name, qty, returned) VALUES (%s,%s,%s,0)",
                (camp_id, item['name'], item['qty']),
            )
            cursor.execute("UPDATE items SET quantity=quantity-%s WHERE name=%s", (item['qty'], item['name']))

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إنشاء معسكر', f'تم إنشاء المعسكر: {camp_name}')
        return jsonify({'status': 'success', 'message': 'تم إنشاء المعسكر'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@camps_bp.route('/api/camps/<int:camp_id>', methods=['PUT'])
def update_camp(camp_id):
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE camp_requests SET camp_name=%s, room_number=%s, receiver_name=%s, return_date=%s WHERE id=%s",
            (data.get('campName'), data.get('roomNumber'), data.get('receiverName'), data.get('returnDate'), camp_id),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تعديل معسكر', f"تم تحديث بيانات المعسكر: {data.get('campName')}")
        return jsonify({'status': 'success', 'message': 'تم تحديث بيانات المعسكر بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@camps_bp.route('/api/camps/<int:camp_id>', methods=['DELETE'])
def delete_camp(camp_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT item_name, qty AS quantity FROM camp_request_items WHERE request_id=%s AND returned=0",
            (camp_id,),
        )
        for item in cursor.fetchall():
            cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s",
                           (item['quantity'], item['item_name']))

        cursor.execute("DELETE FROM camp_request_items WHERE request_id=%s", (camp_id,))
        cursor.execute("DELETE FROM camp_requests WHERE id=%s", (camp_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف معسكر', f'تم حذف المعسكر رقم {camp_id}')
        return jsonify({'status': 'success', 'message': 'تم حذف المعسكر وإرجاع قطعه'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@camps_bp.route('/api/camps/return/<int:camp_id>', methods=['POST'])
def return_camp(camp_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT item_name, qty AS quantity FROM camp_request_items WHERE request_id=%s AND returned=0",
            (camp_id,),
        )
        for item in cursor.fetchall():
            cursor.execute("UPDATE items SET quantity=quantity+%s WHERE name=%s",
                           (item['quantity'], item['item_name']))

        cursor.execute("UPDATE camp_request_items SET returned=1 WHERE request_id=%s", (camp_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إرجاع معسكر',
                   f'تم إرجاع قطع المعسكر رقم {camp_id} للمخزون')
        return jsonify({'status': 'success', 'message': 'تم إرجاع المعسكر بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
