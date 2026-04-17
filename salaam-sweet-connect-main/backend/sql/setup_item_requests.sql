-- ============================================
-- جدول طلبات القطع الجديدة – Item Requests
-- ============================================
-- هذا الجدول يُنشأ تلقائياً عند أول استخدام
-- لكن إذا تبي تنشئه يدوياً، شغّل هذا الـ SQL:

CREATE TABLE IF NOT EXISTS item_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      VARCHAR(50)  NOT NULL,
    student_name    VARCHAR(200) NOT NULL DEFAULT '',
    item_name       VARCHAR(300) NOT NULL,
    item_name_en    VARCHAR(300) DEFAULT '',
    category        VARCHAR(100) DEFAULT 'عام',
    quantity        INT          DEFAULT 1,
    description     TEXT,
    urgency         VARCHAR(20)  DEFAULT 'normal'     COMMENT 'normal | high | urgent',
    reference_url   VARCHAR(500) DEFAULT '',
    image_url       VARCHAR(500) DEFAULT '',
    status          VARCHAR(30)  DEFAULT 'pending'    COMMENT 'pending | approved | rejected | purchased',
    admin_comment   TEXT,
    admin_id        VARCHAR(50)  DEFAULT '',
    admin_name      VARCHAR(200) DEFAULT '',
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_student  (student_id),
    INDEX idx_status   (status),
    INDEX idx_urgency  (urgency)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- جداول نظام الصلاحيات – RBAC Permissions
-- ============================================

CREATE TABLE IF NOT EXISTS permissions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    `key`       VARCHAR(100) NOT NULL UNIQUE,
    label_ar    VARCHAR(200) NOT NULL DEFAULT '',
    label_en    VARCHAR(200) NOT NULL DEFAULT '',
    category    VARCHAR(50)  NOT NULL DEFAULT 'general',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    role            VARCHAR(50)  NOT NULL,
    permission_key  VARCHAR(100) NOT NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_perm (role, permission_key),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================
-- إدراج الصلاحيات الافتراضية
-- ============================================

INSERT IGNORE INTO permissions (`key`, label_ar, label_en, category) VALUES
-- Dashboard
('dashboard:view',       'عرض لوحة التحكم',       'View Dashboard',         'dashboard'),
-- Inventory
('inventory:view',       'عرض المخزون',           'View Inventory',         'inventory'),
('inventory:add',        'إضافة قطعة',            'Add Item',               'inventory'),
('inventory:edit',       'تعديل قطعة',            'Edit Item',              'inventory'),
('inventory:delete',     'حذف قطعة',             'Delete Item',            'inventory'),
-- Locations
('locations:view',       'عرض المواقع',           'View Locations',         'locations'),
('locations:edit',       'تعديل المواقع',          'Edit Locations',         'locations'),
-- Loans
('loans:view',           'عرض العهد',             'View Loans',             'loans'),
('loans:create',         'إنشاء عهدة',            'Create Loan',            'loans'),
('loans:return',         'إرجاع عهدة',            'Return Loan',            'loans'),
('loans:delete',         'حذف عهدة',             'Delete Loan',            'loans'),
-- Requests
('requests:view',        'عرض الطلبات',           'View Requests',          'requests'),
('requests:approve',     'الموافقة على الطلبات',    'Approve Requests',       'requests'),
('requests:reject',      'رفض الطلبات',           'Reject Requests',        'requests'),
-- Camps
('camps:view',           'عرض المعسكرات',         'View Camps',             'camps'),
('camps:edit',           'تعديل المعسكرات',        'Edit Camps',             'camps'),
-- Students
('students:view',        'عرض المستخدمين',        'View Users',             'students'),
('students:edit',        'تعديل المستخدمين',       'Edit Users',             'students'),
('students:ban',         'حظر المستخدمين',        'Ban Users',              'students'),
('students:approve_reg', 'قبول طلبات التسجيل',     'Approve Registrations',  'students'),
-- Batches
('batches:view',         'عرض الدفعات',           'View Batches',           'batches'),
('batches:edit',         'تعديل الدفعات',          'Edit Batches',           'batches'),
-- Audit
('audit:view',           'عرض سجل النظام',        'View Audit Logs',        'audit'),
-- Permissions
('permissions:manage',   'إدارة الصلاحيات',       'Manage Permissions',     'permissions'),
-- Email
('email:send',           'إرسال الإيميلات',        'Send Emails',            'email'),
('email:templates',      'إدارة قوالب الإيميل',    'Manage Email Templates', 'email');


-- ============================================
-- الصلاحيات الافتراضية: مشرف (كل الصلاحيات)
-- ============================================

INSERT IGNORE INTO role_permissions (role, permission_key)
SELECT 'مشرف', `key` FROM permissions;

INSERT IGNORE INTO role_permissions (role, permission_key)
SELECT 'admin', `key` FROM permissions;


-- ============================================
-- الصلاحيات الافتراضية: مهندس
-- ============================================

INSERT IGNORE INTO role_permissions (role, permission_key) VALUES
('مهندس', 'dashboard:view'),
('مهندس', 'inventory:view'),
('مهندس', 'inventory:add'),
('مهندس', 'inventory:edit'),
('مهندس', 'locations:view'),
('مهندس', 'locations:edit'),
('مهندس', 'loans:view'),
('مهندس', 'loans:create'),
('مهندس', 'loans:return'),
('مهندس', 'requests:view'),
('مهندس', 'requests:approve'),
('مهندس', 'requests:reject'),
('مهندس', 'camps:view'),
('مهندس', 'batches:view'),
('مهندس', 'email:send');


-- ============================================
-- الصلاحيات الافتراضية: طالب
-- ============================================

INSERT IGNORE INTO role_permissions (role, permission_key) VALUES
('طالب', 'dashboard:view'),
('طالب', 'inventory:view'),
('طالب', 'locations:view'),
('طالب', 'loans:view');
