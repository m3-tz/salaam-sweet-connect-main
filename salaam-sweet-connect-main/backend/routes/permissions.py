"""
نظام الصلاحيات – RBAC
Role-Based Access Control endpoints
"""

from flask import Blueprint, jsonify, request
from database import get_db_connection
from utils.helpers import sanitize_text, get_admin_info
from utils.audit import log_action

permissions_bp = Blueprint('permissions', __name__)

# ──────────────────────────────────────────────
# الصلاحيات الافتراضية – Default Permissions
# ──────────────────────────────────────────────

DEFAULT_PERMISSIONS = [
    # Dashboard
    {'key': 'dashboard:view',       'label_ar': 'عرض لوحة التحكم',       'label_en': 'View Dashboard',         'category': 'dashboard'},

    # Inventory
    {'key': 'inventory:view',       'label_ar': 'عرض المخزون',           'label_en': 'View Inventory',         'category': 'inventory'},
    {'key': 'inventory:add',        'label_ar': 'إضافة قطعة',            'label_en': 'Add Item',               'category': 'inventory'},
    {'key': 'inventory:edit',       'label_ar': 'تعديل قطعة',            'label_en': 'Edit Item',              'category': 'inventory'},
    {'key': 'inventory:delete',     'label_ar': 'حذف قطعة',             'label_en': 'Delete Item',            'category': 'inventory'},

    # Locations
    {'key': 'locations:view',       'label_ar': 'عرض المواقع',           'label_en': 'View Locations',         'category': 'locations'},
    {'key': 'locations:edit',       'label_ar': 'تعديل المواقع',          'label_en': 'Edit Locations',         'category': 'locations'},

    # Loans
    {'key': 'loans:view',           'label_ar': 'عرض العهد',             'label_en': 'View Loans',             'category': 'loans'},
    {'key': 'loans:create',         'label_ar': 'إنشاء عهدة',            'label_en': 'Create Loan',            'category': 'loans'},
    {'key': 'loans:return',         'label_ar': 'إرجاع عهدة',            'label_en': 'Return Loan',            'category': 'loans'},
    {'key': 'loans:delete',         'label_ar': 'حذف عهدة',             'label_en': 'Delete Loan',            'category': 'loans'},

    # Requests
    {'key': 'requests:view',        'label_ar': 'عرض الطلبات',           'label_en': 'View Requests',          'category': 'requests'},
    {'key': 'requests:approve',     'label_ar': 'الموافقة على الطلبات',    'label_en': 'Approve Requests',       'category': 'requests'},
    {'key': 'requests:reject',      'label_ar': 'رفض الطلبات',           'label_en': 'Reject Requests',        'category': 'requests'},

    # Camps
    {'key': 'camps:view',           'label_ar': 'عرض المعسكرات',         'label_en': 'View Camps',             'category': 'camps'},
    {'key': 'camps:edit',           'label_ar': 'تعديل المعسكرات',        'label_en': 'Edit Camps',             'category': 'camps'},

    # Students / Users
    {'key': 'students:view',        'label_ar': 'عرض المستخدمين',        'label_en': 'View Users',             'category': 'students'},
    {'key': 'students:edit',        'label_ar': 'تعديل المستخدمين',       'label_en': 'Edit Users',             'category': 'students'},
    {'key': 'students:ban',         'label_ar': 'حظر المستخدمين',        'label_en': 'Ban Users',              'category': 'students'},
    {'key': 'students:approve_reg', 'label_ar': 'قبول طلبات التسجيل',     'label_en': 'Approve Registrations',  'category': 'students'},

    # Batches
    {'key': 'batches:view',         'label_ar': 'عرض الدفعات',           'label_en': 'View Batches',           'category': 'batches'},
    {'key': 'batches:edit',         'label_ar': 'تعديل الدفعات',          'label_en': 'Edit Batches',           'category': 'batches'},

    # Audit
    {'key': 'audit:view',           'label_ar': 'عرض سجل النظام',        'label_en': 'View Audit Logs',        'category': 'audit'},

    # Permissions
    {'key': 'permissions:manage',   'label_ar': 'إدارة الصلاحيات',       'label_en': 'Manage Permissions',     'category': 'permissions'},

    # Email
    {'key': 'email:send',           'label_ar': 'إرسال الإيميلات',        'label_en': 'Send Emails',            'category': 'email'},
    {'key': 'email:templates',      'label_ar': 'إدارة قوالب الإيميل',    'label_en': 'Manage Email Templates', 'category': 'email'},
]

# الصلاحيات الافتراضية لكل رتبة
DEFAULT_ROLE_PERMISSIONS = {
    'مشرف': [p['key'] for p in DEFAULT_PERMISSIONS],  # كل الصلاحيات
    'admin': [p['key'] for p in DEFAULT_PERMISSIONS],
    'مهندس': [
        'dashboard:view',
        'inventory:view', 'inventory:add', 'inventory:edit',
        'locations:view', 'locations:edit',
        'loans:view', 'loans:create', 'loans:return',
        'requests:view', 'requests:approve', 'requests:reject',
        'camps:view',
        'batches:view',
        'email:send',
    ],
    'طالب': [
        'dashboard:view',
        'inventory:view',
        'locations:view',
        'loans:view',
    ],
}


def _ensure_tables(cursor, conn):
    """Auto-create RBAC tables if they don't exist."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            `key` VARCHAR(100) NOT NULL UNIQUE,
            label_ar VARCHAR(200) NOT NULL DEFAULT '',
            label_en VARCHAR(200) NOT NULL DEFAULT '',
            category VARCHAR(50) NOT NULL DEFAULT 'general',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            role VARCHAR(50) NOT NULL,
            permission_key VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_role_perm (role, permission_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    conn.commit()


def _seed_defaults(cursor, conn):
    """Insert default permissions and role mappings if tables are empty."""
    cursor.execute("SELECT COUNT(*) AS cnt FROM permissions")
    if cursor.fetchone()['cnt'] == 0:
        for p in DEFAULT_PERMISSIONS:
            cursor.execute(
                "INSERT IGNORE INTO permissions (`key`, label_ar, label_en, category) VALUES (%s,%s,%s,%s)",
                (p['key'], p['label_ar'], p['label_en'], p['category'])
            )
        conn.commit()

    cursor.execute("SELECT COUNT(*) AS cnt FROM role_permissions")
    if cursor.fetchone()['cnt'] == 0:
        for role, perms in DEFAULT_ROLE_PERMISSIONS.items():
            for pkey in perms:
                cursor.execute(
                    "INSERT IGNORE INTO role_permissions (role, permission_key) VALUES (%s,%s)",
                    (role, pkey)
                )
        conn.commit()


# ──────────────────────────────────────────────
# GET /api/permissions  – قائمة كل الصلاحيات المتاحة
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions', methods=['GET'])
def get_all_permissions():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_tables(cursor, conn)
        _seed_defaults(cursor, conn)

        cursor.execute("SELECT * FROM permissions ORDER BY category, `key`")
        perms = cursor.fetchall()
        for p in perms:
            if p.get('created_at'):
                p['created_at'] = str(p['created_at'])

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': perms}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# GET /api/permissions/roles  – كل الرتب وصلاحياتها
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions/roles', methods=['GET'])
def get_roles_permissions():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_tables(cursor, conn)
        _seed_defaults(cursor, conn)

        # جلب كل الصلاحيات
        cursor.execute("SELECT * FROM permissions ORDER BY category, `key`")
        all_perms = cursor.fetchall()
        for p in all_perms:
            if p.get('created_at'):
                p['created_at'] = str(p['created_at'])

        # جلب كل ارتباطات الرتب
        cursor.execute("SELECT role, permission_key FROM role_permissions")
        role_perms_raw = cursor.fetchall()

        # جلب الرتب الفريدة من جدول المستخدمين
        cursor.execute("SELECT DISTINCT role FROM users WHERE role IS NOT NULL AND role != ''")
        db_roles = [r['role'] for r in cursor.fetchall()]

        cursor.close()
        conn.close()

        # بناء الخريطة
        roles_map = {}
        for rp in role_perms_raw:
            role = rp['role']
            if role not in roles_map:
                roles_map[role] = []
            roles_map[role].append(rp['permission_key'])

        # أضف الرتب من الداتا بيس التي ليس لها صلاحيات بعد
        for r in db_roles:
            if r not in roles_map:
                roles_map[r] = []

        roles_list = []
        for role, perms in roles_map.items():
            roles_list.append({
                'role': role,
                'permissions': perms,
                'is_super': role in ('مشرف', 'admin'),
            })

        return jsonify({
            'status': 'success',
            'data': {
                'roles': roles_list,
                'all_permissions': all_perms,
            }
        }), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# GET /api/permissions/my  – صلاحيات المستخدم الحالي
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions/my', methods=['GET'])
def get_my_permissions():
    try:
        role = request.args.get('role', '')
        if not role:
            return jsonify({'status': 'error', 'message': 'role مطلوب'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_tables(cursor, conn)
        _seed_defaults(cursor, conn)

        cursor.execute(
            "SELECT permission_key FROM role_permissions WHERE role = %s",
            (role,)
        )
        perms = [r['permission_key'] for r in cursor.fetchall()]
        cursor.close()
        conn.close()

        return jsonify({'status': 'success', 'data': perms}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# PUT /api/permissions/role  – تحديث صلاحيات رتبة
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions/role', methods=['PUT'])
def update_role_permissions():
    try:
        data = request.get_json()
        admin_id, admin_name = get_admin_info()
        role = sanitize_text(data.get('role', ''))
        permissions = data.get('permissions', [])

        if not role:
            return jsonify({'status': 'error', 'message': 'الرتبة مطلوبة'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_tables(cursor, conn)

        # حذف الصلاحيات القديمة
        cursor.execute("DELETE FROM role_permissions WHERE role = %s", (role,))

        # إدراج الصلاحيات الجديدة
        for pkey in permissions:
            cursor.execute(
                "INSERT INTO role_permissions (role, permission_key) VALUES (%s, %s)",
                (role, pkey)
            )

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تعديل صلاحيات',
                   f'تم تحديث صلاحيات الرتبة: {role} ({len(permissions)} صلاحية)')

        return jsonify({'status': 'success', 'message': f'تم تحديث صلاحيات {role}'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# POST /api/permissions/role/new  – إنشاء رتبة جديدة
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions/role/new', methods=['POST'])
def create_role():
    try:
        data = request.get_json()
        admin_id, admin_name = get_admin_info()
        role = sanitize_text(data.get('role', ''))
        permissions = data.get('permissions', [])

        if not role:
            return jsonify({'status': 'error', 'message': 'اسم الرتبة مطلوب'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        _ensure_tables(cursor, conn)

        # تحقق ألا تكون الرتبة موجودة
        cursor.execute("SELECT COUNT(*) AS cnt FROM role_permissions WHERE role = %s", (role,))
        if cursor.fetchone()['cnt'] > 0:
            cursor.close()
            conn.close()
            return jsonify({'status': 'error', 'message': 'هذه الرتبة موجودة بالفعل'}), 400

        for pkey in permissions:
            cursor.execute(
                "INSERT INTO role_permissions (role, permission_key) VALUES (%s, %s)",
                (role, pkey)
            )
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إنشاء رتبة',
                   f'تم إنشاء رتبة جديدة: {role} ({len(permissions)} صلاحية)')

        return jsonify({'status': 'success', 'message': f'تم إنشاء الرتبة: {role}'}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# DELETE /api/permissions/role  – حذف رتبة مخصصة
# ──────────────────────────────────────────────

@permissions_bp.route('/api/permissions/role', methods=['DELETE'])
def delete_role():
    try:
        data = request.get_json()
        admin_id, admin_name = get_admin_info()
        role = sanitize_text(data.get('role', ''))

        if not role:
            return jsonify({'status': 'error', 'message': 'اسم الرتبة مطلوب'}), 400

        if role in ('مشرف', 'admin', 'مهندس', 'طالب'):
            return jsonify({'status': 'error', 'message': 'لا يمكن حذف الرتب الأساسية'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # تحقق لا يوجد مستخدمين بهذه الرتبة
        cursor.execute("SELECT COUNT(*) AS cnt FROM users WHERE role = %s", (role,))
        if cursor.fetchone()['cnt'] > 0:
            cursor.close()
            conn.close()
            return jsonify({'status': 'error', 'message': 'لا يمكن الحذف – يوجد مستخدمين بهذه الرتبة'}), 400

        cursor.execute("DELETE FROM role_permissions WHERE role = %s", (role,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف رتبة', f'تم حذف الرتبة: {role}')
        return jsonify({'status': 'success', 'message': f'تم حذف الرتبة: {role}'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Decorator للتحقق من الصلاحيات في الـ endpoints
# ──────────────────────────────────────────────

def require_permission(perm_key: str):
    """
    Decorator to check if the current user (by admin-id header) has the required permission.
    Usage:
        @require_permission('inventory:delete')
        def delete_item():
            ...
    """
    from functools import wraps

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            # استخرج role من الهيدرز أو البودي
            role = request.headers.get('user-role', '')
            if not role:
                body = request.get_json(silent=True) or {}
                role = body.get('role', body.get('userRole', ''))

            # المشرف لديه كل الصلاحيات
            if role in ('مشرف', 'admin'):
                return f(*args, **kwargs)

            if not role:
                return jsonify({'status': 'error', 'message': 'غير مصرح – الرتبة غير محددة'}), 403

            try:
                conn = get_db_connection()
                cursor = conn.cursor(dictionary=True)
                cursor.execute(
                    "SELECT COUNT(*) AS cnt FROM role_permissions WHERE role = %s AND permission_key = %s",
                    (role, perm_key)
                )
                has_perm = cursor.fetchone()['cnt'] > 0
                cursor.close()
                conn.close()

                if not has_perm:
                    return jsonify({
                        'status': 'error',
                        'message': f'غير مصرح – تحتاج صلاحية: {perm_key}'
                    }), 403

                return f(*args, **kwargs)
            except Exception as exc:
                return jsonify({'status': 'error', 'message': str(exc)}), 500

        return wrapped
    return decorator
