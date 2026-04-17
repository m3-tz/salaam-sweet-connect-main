from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import get_admin_info
from utils.audit import log_action

locations_bp = Blueprint('locations', __name__)


@locations_bp.route('/api/admin/locations', methods=['GET'])
def get_locations():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM storage_locations ORDER BY parent_id, type, name")
        locations = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': locations}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@locations_bp.route('/api/admin/locations', methods=['POST'])
def add_location():
    try:
        data        = request.get_json()
        admin_id, admin_name = get_admin_info()
        name        = data.get('name')
        loc_type    = data.get('type')
        parent_id   = data.get('parent_id')
        barcode     = data.get('barcode')
        description = data.get('description', '')

        if not name or not loc_type:
            return jsonify({'status': 'error', 'message': 'اسم الموقع ونوعه مطلوبان'}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO storage_locations (name, type, parent_id, barcode, description) "
            "VALUES (%s,%s,%s,%s,%s)",
            (name, loc_type, parent_id, barcode, description),
        )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إضافة موقع تخزين',
                   f'تمت إضافة موقع جديد: {name} من نوع {loc_type}')
        return jsonify({'status': 'success', 'message': 'تم إضافة الموقع بنجاح'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@locations_bp.route('/api/admin/locations/<int:loc_id>', methods=['PUT', 'DELETE'])
def manage_single_location(loc_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()

        if request.method == 'DELETE':
            cursor.execute("SELECT name, parent_id FROM storage_locations WHERE id=%s", (loc_id,))
            loc_row = cursor.fetchone()
            if not loc_row:
                return jsonify({'status': 'error', 'message': 'الموقع غير موجود'}), 404
            loc_name, loc_parent_id = loc_row

            cursor.execute("SELECT item_name FROM item_locations WHERE location_id=%s", (loc_id,))
            if cursor.fetchone():
                return jsonify({'status': 'error',
                                'message': 'لا يمكن حذف الموقع! يحتوي على قطع مخزنة، قم بنقل القطع أولاً.'}), 400

            cursor.execute("UPDATE storage_locations SET parent_id=%s WHERE parent_id=%s",
                           (loc_parent_id, loc_id))
            cursor.execute("DELETE FROM storage_locations WHERE id=%s", (loc_id,))
            log_action(admin_id, admin_name, 'حذف موقع',
                       f'تم حذف الموقع: {loc_name} — الأبناء انتقلوا للمستوى الأعلى')
            msg = 'تم الحذف بنجاح، الأبناء انتقلوا للمستوى الأعلى'

        else:  # PUT
            data       = request.get_json()
            raw_parent = data.get('parent_id')
            parent_id_val = (
                None if raw_parent is None or str(raw_parent) in ('none', 'null', '')
                else int(raw_parent)
            )
            cursor.execute(
                """
                UPDATE storage_locations
                SET name=%s, type=%s, parent_id=%s, barcode=%s,
                    description=%s, max_capacity=%s
                WHERE id=%s
                """,
                (data.get('name'), data.get('type'), parent_id_val,
                 data.get('barcode'), data.get('description', ''),
                 data.get('max_capacity', 100), loc_id),
            )
            log_action(admin_id, admin_name, 'تعديل موقع', f"تم تعديل بيانات الموقع: {data.get('name')}")
            msg = 'تم التعديل بنجاح'

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'message': msg}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@locations_bp.route('/api/admin/locations/<int:loc_id>/items', methods=['GET'])
def get_location_items(loc_id):
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT i.name, i.name_en, i.quantity, i.imageUrl
            FROM items i
            JOIN item_locations il ON i.name = il.item_name
            WHERE il.location_id = %s
        """, (loc_id,))
        items = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': items}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
