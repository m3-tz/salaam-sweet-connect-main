from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import process_image_url, get_admin_info
from utils.audit import log_action

items_bp = Blueprint('items', __name__)


@items_bp.route('/api/items', methods=['GET'])
def get_items():
    try:
        # ?admin=1  ← يُرسَل من لوحة الأدمن لإظهار القطع المخفية أيضاً
        include_hidden = request.args.get('admin', '0') == '1'
        hidden_filter  = '' if include_hidden else 'WHERE (i.is_hidden IS NULL OR i.is_hidden = 0)'

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ─── auto-migrate: أضف عمود is_hidden إن لم يكن موجوداً ───────────
        try:
            cursor.execute(
                "ALTER TABLE items ADD COLUMN IF NOT EXISTS is_hidden TINYINT(1) NOT NULL DEFAULT 0"
            )
            conn.commit()
        except Exception:
            pass  # العمود موجود مسبقاً أو DB لا تدعم IF NOT EXISTS
        # ────────────────────────────────────────────────────────────────────

        cursor.execute(f"""
            SELECT i.name, i.name_en, i.quantity, i.category, i.category_en,
                   i.imageUrl, i.location AS old_location,
                   COALESCE(i.is_hidden, 0) AS is_hidden,
                   (SELECT GROUP_CONCAT(sl.name SEPARATOR '، ')
                    FROM item_locations il
                    JOIN storage_locations sl ON il.location_id = sl.id
                    WHERE il.item_name = i.name) AS mapped_locations,
                   (SELECT GROUP_CONCAT(location_id)
                    FROM item_locations
                    WHERE item_name = i.name) AS location_ids
            FROM items i
            {hidden_filter}
        """)
        items = cursor.fetchall()

        # ── بناء مسارات المواقع الكاملة (LAB1 → BOX1 → F2) ──────────────────
        cursor.execute("SELECT id, name, parent_id FROM storage_locations")
        all_locs = {row['id']: row for row in cursor.fetchall()}

        def build_path(loc_id):
            parts, current, visited = [], loc_id, set()
            while current and current not in visited:
                visited.add(current)
                loc = all_locs.get(current)
                if not loc:
                    break
                parts.insert(0, loc['name'])
                current = loc.get('parent_id')
            return ' → '.join(parts)
        # ─────────────────────────────────────────────────────────────────────

        cursor.close()
        conn.close()

        for item in items:
            item['name_ar']    = item['name']
            item['name_en']    = item.get('name_en') or item['name']
            item['category_ar'] = item['category']
            item['category_en'] = item.get('category_en') or item['category']
            item['is_hidden']  = bool(item.get('is_hidden', 0))

            if item['location_ids']:
                item['location_ids'] = [int(x) for x in str(item['location_ids']).split(',')]
                # بناء مسار كامل لكل موقع
                item['location'] = ' | '.join(build_path(lid) for lid in item['location_ids'])
            else:
                item['location_ids'] = []
                item['location'] = item['mapped_locations'] or item['old_location'] or ''

            img = str(item.get('imageUrl') or '').strip()
            img = img.replace('data:image/jpeg;base64,data:image/jpeg;base64,', 'data:image/jpeg;base64,')
            clean = img.replace('data:image/jpeg;base64,', '').replace('data:image/png;base64,', '')
            item['imageUrl'] = (
                img if img.startswith('http')
                else f'data:image/jpeg;base64,{clean}' if clean
                else 'https://cdn-icons-png.flaticon.com/512/679/679821.png'
            )

        return jsonify({'status': 'success', 'data': items}), 200
    except Exception as exc:
        print(f'Error fetching items: {exc}')
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@items_bp.route('/api/admin/items', methods=['POST'])
def save_admin_item():
    try:
        data         = request.get_json()
        admin_id, admin_name = get_admin_info()

        name_ar       = data.get('name_ar')
        name_en       = data.get('name_en', name_ar)
        qty           = data.get('quantity', 0)
        location_ids  = data.get('location_ids', [])
        category_ar   = data.get('category_ar', 'عام')
        category_en   = data.get('category_en', 'General')
        original_name = data.get('original_name_ar')

        if not name_ar:
            return jsonify({'status': 'error', 'message': 'اسم القطعة مطلوب'}), 400

        final_image = process_image_url(data.get('imageUrl', ''))
        conn        = get_db_connection()
        cursor      = conn.cursor()

        try:
            cursor.execute(
                "INSERT INTO categories (name, name_en) VALUES (%s,%s) "
                "ON DUPLICATE KEY UPDATE name_en=VALUES(name_en)",
                (category_ar, category_en),
            )
        except Exception:
            pass

        if original_name and original_name != name_ar:
            cursor.execute(
                "UPDATE items SET name=%s,name_en=%s,quantity=%s,category=%s,category_en=%s,imageUrl=%s "
                "WHERE name=%s",
                (name_ar, name_en, qty, category_ar, category_en, final_image, original_name),
            )
            cursor.execute(
                "UPDATE item_locations SET item_name=%s WHERE item_name=%s",
                (name_ar, original_name),
            )
            log_action(admin_id, admin_name, 'تعديل قطعة', f'تم تعديل بيانات القطعة: {name_ar}')
        else:
            cursor.execute(
                """
                INSERT INTO items (name, name_en, quantity, category, category_en, imageUrl)
                VALUES (%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE
                    name_en=VALUES(name_en), quantity=VALUES(quantity),
                    category=VALUES(category), category_en=VALUES(category_en),
                    imageUrl=VALUES(imageUrl)
                """,
                (name_ar, name_en, qty, category_ar, category_en, final_image),
            )
            log_action(admin_id, admin_name, 'إضافة/تحديث قطعة',
                       f'تمت إضافة أو تحديث كمية القطعة: {name_ar}')

        cursor.execute("DELETE FROM item_locations WHERE item_name=%s", (name_ar,))
        for loc_id in location_ids:
            cursor.execute(
                "INSERT IGNORE INTO item_locations (item_name, location_id) VALUES (%s,%s)",
                (name_ar, loc_id),
            )

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'message': 'تم حفظ القطعة بنجاح.'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@items_bp.route('/api/admin/items/<string:item_name>', methods=['DELETE'])
def delete_admin_item(item_name):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM item_locations WHERE item_name=%s", (item_name,))
        cursor.execute("DELETE FROM items WHERE name=%s", (item_name,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف قطعة', f'تم الحذف النهائي للقطعة: {item_name}')
        return jsonify({'status': 'success', 'message': 'Item deleted.'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@items_bp.route('/api/admin/items/<path:item_name>/toggle-visibility', methods=['PUT'])
def toggle_item_visibility(item_name):
    """إخفاء قطعة من الطلاب أو إظهارها مجدداً"""
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # auto-migrate
        try:
            cursor.execute(
                "ALTER TABLE items ADD COLUMN IF NOT EXISTS is_hidden TINYINT(1) NOT NULL DEFAULT 0"
            )
            conn.commit()
        except Exception:
            pass

        # اقرأ الحالة الحالية
        cursor.execute(
            "SELECT COALESCE(is_hidden, 0) AS is_hidden FROM items WHERE name = %s",
            (item_name,),
        )
        row = cursor.fetchone()
        if not row:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'القطعة غير موجودة'}), 404

        new_hidden = 0 if row['is_hidden'] else 1
        cursor.execute(
            "UPDATE items SET is_hidden = %s WHERE name = %s",
            (new_hidden, item_name),
        )
        conn.commit()
        cursor.close()
        conn.close()

        action = 'إخفاء قطعة' if new_hidden else 'إظهار قطعة'
        log_action(admin_id, admin_name, action, f'{item_name} — {"مخفية الآن" if new_hidden else "ظاهرة الآن"}')
        return jsonify({'status': 'success', 'is_hidden': bool(new_hidden)}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@items_bp.route('/api/admin/low-stock', methods=['GET'])
def get_low_stock():
    try:
        threshold = int(request.args.get('threshold', 5))
        conn      = get_db_connection()
        cursor    = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT i.name, i.name_en, i.quantity, i.category,
                   (SELECT GROUP_CONCAT(location_id)
                    FROM item_locations
                    WHERE item_name = i.name) AS location_ids_raw
            FROM items i
            WHERE i.quantity <= %s
            ORDER BY i.quantity ASC
        """, (threshold,))
        items = cursor.fetchall()

        # بناء مسارات المواقع
        cursor.execute("SELECT id, name, parent_id FROM storage_locations")
        all_locs = {row['id']: row for row in cursor.fetchall()}

        def build_path_ls(loc_id):
            parts, current, visited = [], loc_id, set()
            while current and current not in visited:
                visited.add(current)
                loc = all_locs.get(current)
                if not loc:
                    break
                parts.insert(0, loc['name'])
                current = loc.get('parent_id')
            return ' → '.join(parts)

        for item in items:
            if item.get('location_ids_raw'):
                ids = [int(x) for x in str(item['location_ids_raw']).split(',')]
                item['location'] = ' | '.join(build_path_ls(i) for i in ids)
            else:
                item['location'] = ''
            del item['location_ids_raw']

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'threshold': threshold, 'count': len(items), 'data': items}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@items_bp.route('/api/proxy-image', methods=['POST'])
def proxy_image():
    try:
        import urllib.request as _urllib
        import base64

        data = request.get_json()
        url  = data.get('url', '')
        if not url:
            return jsonify({'status': 'error', 'message': 'URL مطلوب'}), 400

        req = _urllib.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with _urllib.urlopen(req, timeout=10) as res:
            image_data   = res.read()
            content_type = res.headers.get('Content-Type', 'image/jpeg').split(';')[0]

        b64 = base64.b64encode(image_data).decode('utf-8')
        return jsonify({'status': 'success', 'data': f'data:{content_type};base64,{b64}'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
