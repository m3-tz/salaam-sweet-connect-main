"""
Boxes (Loan Kits) — Template + Instances model
==============================================
A *box template* (table: `boxes`) describes a kind of kit (e.g. "Arduino Kit").
A *box instance* (table: `box_instances`) is a physical unit of that template
(e.g. ARD-001, ARD-002 …) — each with its own scannable QR code and lifecycle.

Loans (`box_loans`) reference an *instance*, so we always know which physical
unit was given to which student.

Schema lives in:        backend/sql/setup_boxes.sql
Auto-migrated at boot:  _ensure_tables() below
"""
from datetime import date, datetime
import secrets
import re
import traceback

from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import get_admin_info, sanitize_text
from utils.audit import log_action
from email_service import send_box_loan_receipt, send_box_return_confirmation
from pdf_service   import generate_box_loan_receipt as _pdf_box_loan, generate_box_return_certificate as _pdf_box_return


def _fetch_student_email(cursor, university_id: str):
    """Return (email, name) for a given universityId, or (None, None)."""
    try:
        cursor.execute(
            "SELECT email, name FROM users WHERE universityId = %s",
            (university_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None, None
        if isinstance(row, dict):
            return row.get('email'), row.get('name')
        return row[0], row[1]
    except Exception:
        return None, None

boxes_bp = Blueprint('boxes', __name__)


# ───────────────────────────────────────────────────────────────────
# Helper: ensure tables exist + back-fill old single-box schema
# ───────────────────────────────────────────────────────────────────
def _column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(
        """SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = %s AND COLUMN_NAME = %s""",
        (table, column),
    )
    return cursor.fetchone() is not None


_MIGRATED_THIS_PROCESS = False


def _ensure_tables(force: bool = False):
    """Idempotent schema migration. Runs once at boot, but can be re-run
    on demand to recover from a partially-migrated DB."""
    global _MIGRATED_THIS_PROCESS
    if _MIGRATED_THIS_PROCESS and not force:
        return
    conn = get_db_connection()
    # DDL statements (CREATE TABLE, ALTER TABLE) are auto-committed in MySQL
    # even inside a transaction. Use autocommit to avoid implicit rollback
    # swallowing successful DDL when a later statement fails.
    try:
        conn.autocommit = True
    except Exception:
        pass
    cursor = conn.cursor()
    try:
        # ── Templates ────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS boxes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                name_en VARCHAR(150) DEFAULT '',
                description TEXT,
                image_url VARCHAR(500),
                category VARCHAR(100) DEFAULT 'عام',
                code_prefix VARCHAR(20) DEFAULT 'BX',
                is_hidden TINYINT(1) NOT NULL DEFAULT 0,
                created_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        # Add code_prefix if missing on legacy schema
        if not _column_exists(cursor, 'boxes', 'code_prefix'):
            cursor.execute("ALTER TABLE boxes ADD COLUMN code_prefix VARCHAR(20) DEFAULT 'BX'")

        # ── Items in template ────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS box_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                box_id INT NOT NULL,
                item_name VARCHAR(150) NOT NULL,
                quantity_required INT NOT NULL DEFAULT 1,
                notes VARCHAR(255),
                FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── Physical instances of each template ─────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS box_instances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                box_id INT NOT NULL,
                qr_code VARCHAR(100) UNIQUE NOT NULL,
                label VARCHAR(50) NOT NULL,
                status ENUM('available','loaned','maintenance','retired') DEFAULT 'available',
                notes VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
                INDEX idx_box (box_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── Loans ────────────────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS box_loans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                box_id INT NOT NULL,
                instance_id INT,
                university_id VARCHAR(50) NOT NULL,
                student_name VARCHAR(100),
                checkout_date DATE NOT NULL,
                expected_return_date DATE NOT NULL,
                returned_at DATETIME,
                status ENUM('active','returned','overdue','partial_return') DEFAULT 'active',
                notes TEXT,
                issued_by VARCHAR(50),
                received_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
                INDEX idx_box (box_id),
                INDEX idx_instance (instance_id),
                INDEX idx_student (university_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        # Add instance_id column if missing on legacy schema
        if not _column_exists(cursor, 'box_loans', 'instance_id'):
            cursor.execute("ALTER TABLE box_loans ADD COLUMN instance_id INT AFTER box_id")
            cursor.execute("ALTER TABLE box_loans ADD INDEX idx_instance (instance_id)")

        # ── Return checklist ────────────────────────────────────
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS box_returns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                loan_id INT NOT NULL,
                item_name VARCHAR(150) NOT NULL,
                quantity_expected INT NOT NULL DEFAULT 1,
                quantity_returned INT NOT NULL DEFAULT 0,
                condition_status ENUM('good','damaged','missing') DEFAULT 'good',
                notes VARCHAR(500),
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (loan_id) REFERENCES box_loans(id) ON DELETE CASCADE,
                INDEX idx_loan (loan_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        # ── Ensure regular `loans` table has `id` column ───────────
        try:
            cursor.execute("SHOW TABLES LIKE 'loans'")
            if cursor.fetchone():
                if not _column_exists(cursor, 'loans', 'id'):
                    cursor.execute(
                        "ALTER TABLE loans ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST"
                    )
        except Exception as _e:
            print(f"[boxes] loans id migration skip: {_e}")

        # ── BACK-FILL: legacy single-box schema → template+instance ──
        # If `boxes.qr_code` still exists from the old schema, migrate
        # each box that has a qr_code into a single instance row.
        if _column_exists(cursor, 'boxes', 'qr_code'):
            has_status = _column_exists(cursor, 'boxes', 'status')
            status_col = 'b.status' if has_status else "'available' AS status"
            cursor.execute(f"""
                SELECT b.id, b.qr_code, {status_col}, b.code_prefix
                FROM boxes b
                LEFT JOIN box_instances bi ON bi.box_id = b.id
                WHERE b.qr_code IS NOT NULL AND b.qr_code <> ''
                  AND bi.id IS NULL
            """)
            legacy_rows = cursor.fetchall()
            for (b_id, b_qr, b_status, b_prefix) in legacy_rows:
                inst_status = b_status if b_status in ('available', 'loaned', 'maintenance') else 'available'
                label = b_qr if b_qr else f"{b_prefix or 'BX'}-001"
                try:
                    cursor.execute("""
                        INSERT INTO box_instances (box_id, qr_code, label, status)
                        VALUES (%s,%s,%s,%s)
                    """, (b_id, b_qr, label, inst_status))
                    new_inst_id = cursor.lastrowid
                    cursor.execute("""
                        UPDATE box_loans SET instance_id = %s
                        WHERE box_id = %s AND (instance_id IS NULL OR instance_id = 0)
                    """, (new_inst_id, b_id))
                except Exception as row_err:
                    print(f"[boxes] back-fill skip box {b_id}: {row_err}")

        conn.commit()
        _MIGRATED_THIS_PROCESS = True
    except Exception as e:
        print(f"[boxes] migrate ERROR: {e}\n{traceback.format_exc()}")
        # Don't rollback — DDL is already committed in MySQL; rollback would
        # only affect any pending DML and may raise if autocommit is on.
    finally:
        cursor.close()
        conn.close()


_ensure_tables()


# ───────────────────────────────────────────────────────────────────
# Diagnostic endpoint — hit /api/boxes/debug to see migration status
# ───────────────────────────────────────────────────────────────────
@boxes_bp.route('/api/boxes/debug', methods=['GET'])
def debug_schema():
    """Returns which tables/columns exist and re-runs migration."""
    _ensure_tables(force=True)
    conn = get_db_connection()
    cursor = conn.cursor()
    results = {}
    try:
        for tbl in ('boxes', 'box_items', 'box_instances', 'box_loans', 'box_returns'):
            cursor.execute("SHOW TABLES LIKE %s", (tbl,))
            exists = cursor.fetchone() is not None
            results[tbl] = {'exists': exists}
            if exists:
                cursor.execute(f"SHOW COLUMNS FROM `{tbl}`")
                results[tbl]['columns'] = [row[0] for row in cursor.fetchall()]
    finally:
        cursor.close()
        conn.close()
    return jsonify({'status': 'ok', 'migration_done': _MIGRATED_THIS_PROCESS, 'tables': results})


# ───────────────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────────────
def _collect_used_nums(cursor, pfx: str) -> set:
    """Return the set of sequential numbers already used for this prefix."""
    cursor.execute("SELECT label FROM box_instances WHERE label LIKE %s", (f"{pfx}-%",))
    used = set()
    for row in cursor.fetchall():
        lbl = row[0] if isinstance(row, tuple) else row.get('label', '')
        m = re.match(rf"^{re.escape(pfx)}-(\d+)$", lbl or '')
        if m:
            used.add(int(m.group(1)))
    return used


def _gen_unique_qr(cursor, prefix: str, used_nums: set = None) -> tuple[str, str]:
    """Return (qr_code, label). Pass used_nums when generating in a batch loop
    to avoid duplicate labels within the same uncommitted transaction."""
    pfx = re.sub(r'[^A-Z0-9]', '', (prefix or 'BX').upper()) or 'BX'
    if used_nums is None:
        used_nums = _collect_used_nums(cursor, pfx)
    n = 1
    while n in used_nums:
        n += 1
    used_nums.add(n)
    label = f"{pfx}-{n:03d}"
    qr = label
    while True:
        cursor.execute("SELECT 1 FROM box_instances WHERE qr_code = %s", (qr,))
        if not cursor.fetchone():
            break
        qr = f"{label}-{secrets.token_hex(2).upper()}"
    return qr, label


def _slug_prefix(name: str, fallback: str = 'BX') -> str:
    """Derive a default code prefix from the box name (e.g. "Arduino Kit" → ARD)."""
    if not name:
        return fallback
    # Pull ASCII letters; if Arabic-only, fall back
    letters = re.sub(r'[^A-Za-z]', '', name)
    if letters:
        return letters[:3].upper()
    return fallback


# ═══════════════════════════════════════════════════════════════════
# BOXES (templates) — CRUD
# ═══════════════════════════════════════════════════════════════════

@boxes_bp.route('/api/boxes', methods=['GET'])
def list_boxes():
    """List all box templates with instance stats. ?admin=1 includes hidden."""
    try:
        _ensure_tables(force=True)

        include_hidden = request.args.get('admin', '0') == '1'
        hidden_filter = '' if include_hidden else 'WHERE (b.is_hidden IS NULL OR b.is_hidden = 0)'

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ── Detect which tables / columns actually exist in DB ─────────
        def _tbl(name):
            cursor.execute("SHOW TABLES LIKE %s", (name,))
            return cursor.fetchone() is not None

        has_instances  = _tbl('box_instances')
        has_box_items  = _tbl('box_items')
        has_items      = _tbl('items')
        has_prefix_col = _column_exists(cursor, 'boxes', 'code_prefix')
        has_hidden_col = _column_exists(cursor, 'boxes', 'is_hidden')

        # ── Build safe SELECT list ────────────────────────────────────
        prefix_sel = "b.code_prefix,"   if has_prefix_col else "'BX' AS code_prefix,"
        hidden_sel = "b.is_hidden,"     if has_hidden_col else "0 AS is_hidden,"

        items_count_sel = (
            "(SELECT COUNT(*) FROM box_items WHERE box_id = b.id) AS items_count,"
            "(SELECT COALESCE(SUM(quantity_required),0) FROM box_items WHERE box_id = b.id) AS total_qty,"
            if has_box_items else
            "0 AS items_count, 0 AS total_qty,"
        )

        inst_sel = (
            "(SELECT COUNT(*) FROM box_instances WHERE box_id=b.id) AS total_instances,"
            "(SELECT COUNT(*) FROM box_instances WHERE box_id=b.id AND status='available') AS available_instances,"
            "(SELECT COUNT(*) FROM box_instances WHERE box_id=b.id AND status='loaned') AS loaned_instances,"
            "(SELECT COUNT(*) FROM box_instances WHERE box_id=b.id AND status='maintenance') AS maintenance_instances"
            if has_instances else
            "0 AS total_instances, 0 AS available_instances, 0 AS loaned_instances, 0 AS maintenance_instances"
        )

        cursor.execute(f"""
            SELECT b.id, b.name, b.name_en, b.description, b.image_url,
                   b.category, {prefix_sel} {hidden_sel} b.created_at,
                   {items_count_sel}
                   {inst_sel}
            FROM boxes b
            {hidden_filter}
            ORDER BY b.id DESC
        """)
        boxes = cursor.fetchall()

        # ── Per-box items list ────────────────────────────────────────
        for box in boxes:
            if has_box_items:
                if has_items:
                    cursor.execute("""
                        SELECT bi.id, bi.item_name, bi.quantity_required, bi.notes,
                               i.name AS itemId, i.quantity AS available_in_stock,
                               i.imageUrl, i.category AS item_category, i.location AS item_location
                        FROM box_items bi
                        LEFT JOIN items i ON i.name = bi.item_name
                        WHERE bi.box_id = %s
                    """, (box['id'],))
                else:
                    cursor.execute("""
                        SELECT id, item_name, quantity_required, notes,
                               NULL AS itemId, NULL AS available_in_stock,
                               NULL AS imageUrl, NULL AS item_category, NULL AS item_location
                        FROM box_items WHERE box_id = %s
                    """, (box['id'],))
                box['items'] = cursor.fetchall()
            else:
                box['items'] = []

            if box.get('created_at'):
                box['created_at'] = str(box['created_at'])
            for k in ('items_count', 'total_qty', 'total_instances',
                      'available_instances', 'loaned_instances', 'maintenance_instances'):
                box[k] = int(box.get(k) or 0)

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': boxes}), 200
    except Exception as exc:
        print(f"[boxes] list_boxes ERROR: {exc}\n{traceback.format_exc()}")
        return jsonify({'status': 'error', 'message': str(exc),
                        'trace': traceback.format_exc().splitlines()[-5:]}), 500


@boxes_bp.route('/api/boxes/<int:box_id>', methods=['GET'])
def get_box(box_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id, name, name_en, description, image_url, category,
                   code_prefix, is_hidden, created_by, created_at, updated_at
            FROM boxes WHERE id = %s
        """, (box_id,))
        box = cursor.fetchone()
        if not box:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'البوكس غير موجود'}), 404

        # Items enriched with inventory data
        cursor.execute("""
            SELECT bi.id, bi.item_name, bi.quantity_required, bi.notes,
                   i.name AS itemId, i.quantity AS available_in_stock,
                   i.imageUrl, i.category AS item_category, i.location AS item_location
            FROM box_items bi
            LEFT JOIN items i ON i.name = bi.item_name
            WHERE bi.box_id = %s
        """, (box_id,))
        box['items'] = cursor.fetchall()

        # Instances of this template
        cursor.execute("""
            SELECT id, qr_code, label, status, notes, created_at, updated_at
            FROM box_instances WHERE box_id = %s
            ORDER BY label ASC, id ASC
        """, (box_id,))
        instances = cursor.fetchall()
        for inst in instances:
            for k in ('created_at', 'updated_at'):
                if inst.get(k):
                    inst[k] = str(inst[k])
        box['instances'] = instances

        # Stats
        box['total_instances'] = len(instances)
        box['available_instances'] = sum(1 for i in instances if i['status'] == 'available')
        box['loaned_instances'] = sum(1 for i in instances if i['status'] == 'loaned')
        box['maintenance_instances'] = sum(1 for i in instances if i['status'] == 'maintenance')

        for k in ('created_at', 'updated_at'):
            if box.get(k):
                box[k] = str(box[k])

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': box}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/boxes', methods=['POST'])
def create_box():
    """
    Create a new template. Body:
    {
      name, nameEn, description, imageUrl, category, codePrefix,
      items: [{ itemName, quantity, notes }, ...],
      initialInstanceCount: 5         # auto-create N instances
    }
    """
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        name = sanitize_text(data.get('name'))
        if not name:
            return jsonify({'status': 'error', 'message': 'اسم البوكس مطلوب'}), 400

        items = data.get('items') or []
        if not items:
            return jsonify({'status': 'error', 'message': 'أضف قطعة واحدة على الأقل للبوكس'}), 400

        prefix_raw = sanitize_text(data.get('codePrefix') or '') or _slug_prefix(
            sanitize_text(data.get('nameEn') or '') or name
        )
        prefix = re.sub(r'[^A-Za-z0-9]', '', prefix_raw).upper()[:20] or 'BX'

        try:
            initial_count = max(0, int(data.get('initialInstanceCount') or 0))
        except (TypeError, ValueError):
            initial_count = 0

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO boxes (name, name_en, description, image_url,
                               category, code_prefix, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            name,
            sanitize_text(data.get('nameEn') or ''),
            data.get('description') or None,
            data.get('imageUrl') or None,
            sanitize_text(data.get('category') or 'عام'),
            prefix,
            admin_id or None,
        ))
        box_id = cursor.lastrowid

        for it in items:
            cursor.execute("""
                INSERT INTO box_items (box_id, item_name, quantity_required, notes)
                VALUES (%s,%s,%s,%s)
            """, (
                box_id,
                sanitize_text(it.get('itemName') or it.get('item_name')),
                int(it.get('quantity') or it.get('quantity_required') or 1),
                it.get('notes') or None,
            ))

        # Create initial instances — share used_nums set across loop to avoid dups
        created_instances = []
        pfx_clean = re.sub(r'[^A-Z0-9]', '', prefix.upper()) or 'BX'
        used_nums = _collect_used_nums(cursor, pfx_clean)
        for _ in range(initial_count):
            qr, label = _gen_unique_qr(cursor, prefix, used_nums)
            cursor.execute("""
                INSERT INTO box_instances (box_id, qr_code, label, status)
                VALUES (%s,%s,%s,'available')
            """, (box_id, qr, label))
            created_instances.append({'id': cursor.lastrowid, 'qr_code': qr, 'label': label})

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إنشاء بوكس',
                   f'تم إنشاء قالب البوكس "{name}" ({initial_count} نسخة)')
        return jsonify({
            'status': 'success',
            'message': 'تم إنشاء البوكس',
            'data': {'id': box_id, 'codePrefix': prefix, 'instances': created_instances}
        }), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/boxes/<int:box_id>', methods=['PUT'])
def update_box(box_id):
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE boxes SET
                name = COALESCE(%s, name),
                name_en = COALESCE(%s, name_en),
                description = %s,
                image_url = %s,
                category = COALESCE(%s, category),
                code_prefix = COALESCE(%s, code_prefix),
                is_hidden = COALESCE(%s, is_hidden)
            WHERE id = %s
        """, (
            sanitize_text(data.get('name')) if data.get('name') else None,
            sanitize_text(data.get('nameEn')) if 'nameEn' in data else None,
            data.get('description'),
            data.get('imageUrl'),
            sanitize_text(data.get('category')) if data.get('category') else None,
            (re.sub(r'[^A-Za-z0-9]', '', sanitize_text(data.get('codePrefix') or '')).upper()[:20] or None)
                if 'codePrefix' in data else None,
            data.get('isHidden'),
            box_id,
        ))

        if 'items' in data:
            cursor.execute("DELETE FROM box_items WHERE box_id = %s", (box_id,))
            for it in (data.get('items') or []):
                cursor.execute("""
                    INSERT INTO box_items (box_id, item_name, quantity_required, notes)
                    VALUES (%s,%s,%s,%s)
                """, (
                    box_id,
                    sanitize_text(it.get('itemName') or it.get('item_name')),
                    int(it.get('quantity') or it.get('quantity_required') or 1),
                    it.get('notes') or None,
                ))

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تعديل بوكس', f'تم تعديل البوكس #{box_id}')
        return jsonify({'status': 'success', 'message': 'تم التحديث'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/boxes/<int:box_id>', methods=['DELETE'])
def delete_box(box_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""SELECT COUNT(*) FROM box_loans
                          WHERE box_id = %s AND status = 'active'""", (box_id,))
        if (cursor.fetchone() or [0])[0] > 0:
            cursor.close(); conn.close()
            return jsonify({'status': 'error',
                            'message': 'لا يمكن حذف بوكس له استعارة نشطة'}), 400

        cursor.execute("DELETE FROM boxes WHERE id = %s", (box_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف بوكس', f'تم حذف البوكس #{box_id}')
        return jsonify({'status': 'success', 'message': 'تم الحذف'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ═══════════════════════════════════════════════════════════════════
# BOX INSTANCES — manage physical units
# ═══════════════════════════════════════════════════════════════════

@boxes_bp.route('/api/boxes/<int:box_id>/instances', methods=['GET'])
def list_instances(box_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT bi.id, bi.qr_code, bi.label, bi.status, bi.notes,
                   bi.created_at, bi.updated_at,
                   bl.id AS active_loan_id, bl.university_id AS active_student_id,
                   bl.student_name AS active_student_name,
                   bl.expected_return_date AS active_return_date
            FROM box_instances bi
            LEFT JOIN box_loans bl ON bl.instance_id = bi.id AND bl.status = 'active'
            WHERE bi.box_id = %s
            ORDER BY bi.label ASC, bi.id ASC
        """, (box_id,))
        rows = cursor.fetchall()
        for r in rows:
            for k in ('created_at', 'updated_at', 'active_return_date'):
                if r.get(k):
                    r[k] = str(r[k])
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': rows}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/boxes/<int:box_id>/instances', methods=['POST'])
def add_instances(box_id):
    """Add N more instances to a template. Body: { count: 5, prefix?: 'ARD' }"""
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        try:
            count = max(1, min(200, int(data.get('count') or 1)))
        except (TypeError, ValueError):
            count = 1

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name, code_prefix FROM boxes WHERE id = %s", (box_id,))
        box = cursor.fetchone()
        if not box:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'البوكس غير موجود'}), 404

        prefix = sanitize_text(data.get('prefix') or '') or box['code_prefix'] or 'BX'
        pfx_clean = re.sub(r'[^A-Z0-9]', '', prefix.upper()) or 'BX'
        used_nums = _collect_used_nums(cursor, pfx_clean)

        created = []
        for _ in range(count):
            qr, label = _gen_unique_qr(cursor, prefix, used_nums)
            cursor.execute("""
                INSERT INTO box_instances (box_id, qr_code, label, status)
                VALUES (%s,%s,%s,'available')
            """, (box_id, qr, label))
            created.append({'id': cursor.lastrowid, 'qr_code': qr, 'label': label})

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إضافة نسخ بوكس',
                   f'تمت إضافة {count} نسخة للبوكس "{box["name"]}"')
        return jsonify({'status': 'success', 'data': created}), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-instances/<int:instance_id>', methods=['PUT'])
def update_instance(instance_id):
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE box_instances SET
                label = COALESCE(%s, label),
                status = COALESCE(%s, status),
                notes = %s
            WHERE id = %s
        """, (
            sanitize_text(data.get('label')) if data.get('label') else None,
            data.get('status') if data.get('status') in
                ('available','loaned','maintenance','retired') else None,
            data.get('notes'),
            instance_id,
        ))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'تعديل نسخة بوكس',
                   f'تم تعديل النسخة #{instance_id}')
        return jsonify({'status': 'success', 'message': 'تم التحديث'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-instances/<int:instance_id>', methods=['DELETE'])
def delete_instance(instance_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""SELECT COUNT(*) FROM box_loans
                          WHERE instance_id = %s AND status = 'active'""",
                       (instance_id,))
        if (cursor.fetchone() or [0])[0] > 0:
            cursor.close(); conn.close()
            return jsonify({'status': 'error',
                            'message': 'لا يمكن حذف نسخة لها استعارة نشطة'}), 400

        cursor.execute("DELETE FROM box_instances WHERE id = %s", (instance_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف نسخة بوكس',
                   f'تم حذف النسخة #{instance_id}')
        return jsonify({'status': 'success', 'message': 'تم الحذف'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-instances/qr/<string:qr_code>', methods=['GET'])
def get_instance_by_qr(qr_code):
    """Lookup an instance by QR code — used by the scanner."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT bi.id AS instance_id, bi.qr_code, bi.label, bi.status, bi.notes,
                   bi.box_id,
                   b.name AS box_name, b.name_en AS box_name_en,
                   b.image_url, b.category, b.code_prefix,
                   bl.id AS active_loan_id, bl.university_id AS active_student_id,
                   bl.student_name AS active_student_name,
                   bl.expected_return_date AS active_return_date
            FROM box_instances bi
            JOIN boxes b ON b.id = bi.box_id
            LEFT JOIN box_loans bl ON bl.instance_id = bi.id AND bl.status = 'active'
            WHERE bi.qr_code = %s
        """, (qr_code,))
        row = cursor.fetchone()
        if not row:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'الكود غير موجود'}), 404

        if row.get('active_return_date'):
            row['active_return_date'] = str(row['active_return_date'])

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': row}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ═══════════════════════════════════════════════════════════════════
# BOX LOANS — checkout / return / list
# ═══════════════════════════════════════════════════════════════════

def _select_loans_sql(where_sql: str = '') -> str:
    return f"""
        SELECT bl.id, bl.box_id, bl.instance_id, bl.university_id, bl.student_name,
               bl.checkout_date, bl.expected_return_date, bl.returned_at,
               bl.status, bl.notes, bl.issued_by, bl.received_by,
               b.name AS box_name, b.name_en AS box_name_en,
               b.image_url AS box_image, b.code_prefix,
               bi.qr_code AS instance_qr, bi.label AS instance_label,
               (SELECT COUNT(*) FROM box_items WHERE box_id = b.id) AS items_count
        FROM box_loans bl
        JOIN boxes b ON bl.box_id = b.id
        LEFT JOIN box_instances bi ON bl.instance_id = bi.id
        {where_sql}
        ORDER BY bl.id DESC
    """


@boxes_bp.route('/api/box-loans', methods=['GET'])
def list_box_loans():
    try:
        student = request.args.get('student')
        status_filter = request.args.get('status')
        box_id = request.args.get('boxId')

        where = []
        params = []
        if student:
            where.append('bl.university_id = %s'); params.append(student)
        if status_filter:
            where.append('bl.status = %s'); params.append(status_filter)
        if box_id:
            where.append('bl.box_id = %s'); params.append(box_id)
        where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Auto-promote active loans past their return date to 'overdue'
        cursor.execute("""
            UPDATE box_loans
            SET status = 'overdue'
            WHERE status = 'active' AND expected_return_date < CURDATE()
        """)
        conn.commit()

        cursor.execute(_select_loans_sql(where_sql), params)
        loans = cursor.fetchall()
        for loan in loans:
            for k in ('checkout_date', 'expected_return_date', 'returned_at'):
                if loan.get(k):
                    loan[k] = str(loan[k])
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': loans}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-loans/<int:loan_id>', methods=['GET'])
def get_box_loan(loan_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(_select_loans_sql('WHERE bl.id = %s'), (loan_id,))
        loan = cursor.fetchone()
        if not loan:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'الاستعارة غير موجودة'}), 404

        cursor.execute("""
            SELECT bi.item_name, bi.quantity_required, bi.notes,
                   i.imageUrl, i.category AS item_category, i.location AS item_location
            FROM box_items bi
            LEFT JOIN items i ON i.name = bi.item_name
            WHERE bi.box_id = %s
        """, (loan['box_id'],))
        loan['expected_items'] = cursor.fetchall()

        cursor.execute("""
            SELECT id, item_name, quantity_expected, quantity_returned,
                   condition_status, notes, checked_at
            FROM box_returns WHERE loan_id = %s
        """, (loan_id,))
        loan['return_checks'] = cursor.fetchall()
        for chk in loan['return_checks']:
            if chk.get('checked_at'):
                chk['checked_at'] = str(chk['checked_at'])

        for k in ('checkout_date', 'expected_return_date', 'returned_at'):
            if loan.get(k):
                loan[k] = str(loan[k])

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': loan}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


def _checkout_one(cursor, box_id: int, instance_id, student_id: str, student_name: str,
                  return_date: str, notes, admin_id):
    """
    Helper: perform a single checkout. Picks an available instance if not given.
    Returns (loan_id, instance_id, instance_label) or raises ValueError on a
    user-facing error.
    """
    # Verify box exists
    cursor.execute("SELECT name FROM boxes WHERE id = %s", (box_id,))
    box = cursor.fetchone()
    if not box:
        raise ValueError('البوكس غير موجود')

    # Pick or verify instance
    if instance_id:
        cursor.execute("""SELECT id, label, status FROM box_instances
                          WHERE id = %s AND box_id = %s""", (instance_id, box_id))
        inst = cursor.fetchone()
        if not inst:
            raise ValueError('النسخة غير موجودة')
        if inst['status'] != 'available':
            raise ValueError(f"النسخة {inst['label']} غير متاحة ({inst['status']})")
    else:
        cursor.execute("""SELECT id, label FROM box_instances
                          WHERE box_id = %s AND status = 'available'
                          ORDER BY id ASC LIMIT 1""", (box_id,))
        inst = cursor.fetchone()
        if not inst:
            raise ValueError('لا توجد نسخة متاحة من هذا البوكس')
        instance_id = inst['id']

    # Verify stock
    cursor.execute("""
        SELECT bi.item_name, bi.quantity_required,
               COALESCE(i.quantity, 0) AS available
        FROM box_items bi
        LEFT JOIN items i ON i.name = bi.item_name
        WHERE bi.box_id = %s
    """, (box_id,))
    contents = cursor.fetchall()
    missing = [c for c in contents if c['available'] < c['quantity_required']]
    if missing:
        names = '، '.join(m['item_name'] for m in missing[:3])
        raise ValueError(f'بعض القطع غير متوفرة: {names}')

    today = date.today().strftime('%Y-%m-%d')
    cursor.execute("""
        INSERT INTO box_loans (box_id, instance_id, university_id, student_name,
                               checkout_date, expected_return_date,
                               status, notes, issued_by)
        VALUES (%s,%s,%s,%s,%s,%s,'active',%s,%s)
    """, (box_id, instance_id, student_id, student_name,
          today, return_date, notes, admin_id))
    loan_id = cursor.lastrowid

    for c in contents:
        cursor.execute("UPDATE items SET quantity = quantity - %s WHERE name = %s",
                       (c['quantity_required'], c['item_name']))

    cursor.execute("UPDATE box_instances SET status='loaned' WHERE id=%s", (instance_id,))

    return loan_id, instance_id, inst['label']


@boxes_bp.route('/api/box-loans', methods=['POST'])
def checkout_box():
    """
    Loan a box instance to a student.
    Body: { boxId, instanceId? (optional auto-pick), studentId, studentName, returnDate, notes }
    """
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        box_id = data.get('boxId')
        instance_id = data.get('instanceId')
        student_id = sanitize_text(data.get('studentId'))
        student_name = sanitize_text(data.get('studentName') or '')
        return_date = data.get('returnDate')
        notes = data.get('notes')

        if not box_id or not student_id or not return_date:
            return jsonify({'status': 'error',
                            'message': 'البوكس والطالب وتاريخ الإرجاع مطلوبة'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            loan_id, inst_id, inst_label = _checkout_one(
                cursor, box_id, instance_id, student_id, student_name,
                return_date, notes, admin_id,
            )
            cursor.execute("SELECT name FROM boxes WHERE id=%s", (box_id,))
            _brow = cursor.fetchone() or {}
            box_name_for_email = _brow.get('name') or ''
            student_email, student_db_name = _fetch_student_email(cursor, student_id)
            conn.commit()
        except ValueError as ve:
            conn.rollback()
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': str(ve)}), 400

        cursor.close()
        conn.close()

        if student_email:
            try:
                attachments = None
                try:
                    _pdf, _ = _pdf_box_loan({
                        'student_name':  student_name or student_db_name or '',
                        'university_id': student_id,
                        'box_name':      box_name_for_email,
                        'instance_code': inst_label,
                        'expected_return_date': return_date,
                        'admin_name':    admin_name or '',
                    })
                    attachments = [{'filename': f'box-{inst_label}.pdf', 'content': _pdf, 'mime': 'application/pdf'}]
                except Exception as _pe:
                    print(f'[pdf] box_loan skip: {_pe}')
                send_box_loan_receipt(
                    to_email    = student_email,
                    student_name= student_name or student_db_name or '',
                    student_id  = student_id,
                    box_name    = box_name_for_email,
                    instance_code = inst_label,
                    expected_return_date = return_date,
                    admin_name  = admin_name or '',
                    attachments = attachments,
                )
            except Exception as _e:
                print(f'[email] box_loan_receipt skip: {_e}')

        log_action(admin_id, admin_name, 'صرف بوكس',
                   f'تم صرف النسخة {inst_label} للطالب {student_id}')
        return jsonify({
            'status': 'success',
            'message': 'تم صرف البوكس',
            'data': {'loanId': loan_id, 'instanceId': inst_id, 'instanceLabel': inst_label}
        }), 201
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-loans/bulk', methods=['POST'])
def checkout_box_bulk():
    """
    Bulk-distribute one box template to multiple students.
    Body: {
      boxId,
      returnDate,
      notes?,
      students: [
        { studentId, studentName?, instanceId? },
        ...
      ]
    }
    Each student is auto-assigned the next available instance unless they
    explicitly specify instanceId.
    """
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()

        box_id = data.get('boxId')
        return_date = data.get('returnDate')
        notes = data.get('notes')
        students = data.get('students') or []

        if not box_id or not return_date or not students:
            return jsonify({'status': 'error',
                            'message': 'البوكس والطلاب وتاريخ الإرجاع مطلوبة'}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        results = []
        errors = []
        email_payloads = []
        try:
            cursor.execute("SELECT name FROM boxes WHERE id=%s", (box_id,))
            _brow = cursor.fetchone() or {}
            box_name_for_email = _brow.get('name') or ''

            for s in students:
                sid = sanitize_text(s.get('studentId'))
                if not sid:
                    errors.append({'student': s, 'message': 'معرّف الطالب مفقود'})
                    continue
                try:
                    stu_name = sanitize_text(s.get('studentName') or '')
                    loan_id, inst_id, inst_label = _checkout_one(
                        cursor, box_id, s.get('instanceId'),
                        sid, stu_name,
                        return_date, notes, admin_id,
                    )
                    results.append({
                        'studentId': sid,
                        'loanId': loan_id,
                        'instanceId': inst_id,
                        'instanceLabel': inst_label,
                    })
                    email, db_name = _fetch_student_email(cursor, sid)
                    if email:
                        email_payloads.append({
                            'email': email,
                            'name': stu_name or db_name or '',
                            'sid': sid,
                            'inst_label': inst_label,
                        })
                except ValueError as ve:
                    errors.append({'studentId': sid, 'message': str(ve)})
            conn.commit()
        except Exception as exc:
            conn.rollback()
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': str(exc)}), 500

        cursor.close()
        conn.close()

        for p in email_payloads:
            try:
                attachments = None
                try:
                    _pdf, _ = _pdf_box_loan({
                        'student_name':  p['name'],
                        'university_id': p['sid'],
                        'box_name':      box_name_for_email,
                        'instance_code': p['inst_label'],
                        'expected_return_date': return_date,
                        'admin_name':    admin_name or '',
                    })
                    attachments = [{'filename': f'box-{p["inst_label"]}.pdf', 'content': _pdf, 'mime': 'application/pdf'}]
                except Exception as _pe:
                    print(f'[pdf] bulk box_loan skip: {_pe}')
                send_box_loan_receipt(
                    to_email    = p['email'],
                    student_name= p['name'],
                    student_id  = p['sid'],
                    box_name    = box_name_for_email,
                    instance_code = p['inst_label'],
                    expected_return_date = return_date,
                    admin_name  = admin_name or '',
                    attachments = attachments,
                )
            except Exception as _e:
                print(f'[email] bulk box_loan_receipt skip: {_e}')

        log_action(admin_id, admin_name, 'صرف جماعي للبوكس',
                   f'تم صرف {len(results)} نسخة (فشل: {len(errors)})')
        return jsonify({
            'status': 'success' if results else 'error',
            'message': f'تم صرف {len(results)} بوكس' + (f' — فشل {len(errors)}' if errors else ''),
            'data': {'success': results, 'errors': errors}
        }), 200 if results else 400
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-loans/<int:loan_id>/return', methods=['POST'])
def return_box(loan_id):
    """Return a loan with item-by-item checklist."""
    try:
        data = request.get_json() or {}
        admin_id, admin_name = get_admin_info()
        checks = data.get('checks') or []
        general_notes = data.get('generalNotes')

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT bl.*, b.name AS box_name, bi.label AS instance_label
            FROM box_loans bl
            JOIN boxes b ON bl.box_id = b.id
            LEFT JOIN box_instances bi ON bl.instance_id = bi.id
            WHERE bl.id = %s
        """, (loan_id,))
        loan = cursor.fetchone()
        if not loan:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'الاستعارة غير موجودة'}), 404
        if loan['status'] == 'returned':
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'تم إرجاع البوكس مسبقاً'}), 400

        cursor.execute("""
            SELECT item_name, quantity_required FROM box_items WHERE box_id = %s
        """, (loan['box_id'],))
        expected = {row['item_name']: row['quantity_required'] for row in cursor.fetchall()}

        cursor.execute("DELETE FROM box_returns WHERE loan_id = %s", (loan_id,))

        any_problem = False
        for chk in checks:
            item_name = sanitize_text(chk.get('itemName'))
            if not item_name or item_name not in expected:
                continue
            qty_expected = expected[item_name]
            qty_returned = int(chk.get('quantityReturned') or 0)
            condition = chk.get('condition', 'good')
            if condition not in ('good', 'damaged', 'missing'):
                condition = 'good'
            note = chk.get('notes') or None

            cursor.execute("""
                INSERT INTO box_returns (loan_id, item_name, quantity_expected,
                                          quantity_returned, condition_status, notes)
                VALUES (%s,%s,%s,%s,%s,%s)
            """, (loan_id, item_name, qty_expected, qty_returned, condition, note))

            good_qty = qty_returned if condition == 'good' else 0
            if good_qty > 0:
                cursor.execute("UPDATE items SET quantity = quantity + %s WHERE name = %s",
                               (good_qty, item_name))

            if condition != 'good' or qty_returned < qty_expected:
                any_problem = True

        final_status = 'partial_return' if any_problem else 'returned'
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute("""
            UPDATE box_loans
            SET status=%s, returned_at=%s, received_by=%s,
                notes=COALESCE(%s, notes)
            WHERE id=%s
        """, (final_status, now, admin_id, general_notes, loan_id))

        # Free the instance (or send to maintenance for partial returns)
        new_inst_status = 'available' if final_status == 'returned' else 'maintenance'
        if loan.get('instance_id'):
            cursor.execute("UPDATE box_instances SET status=%s WHERE id=%s",
                           (new_inst_status, loan['instance_id']))

        student_email, student_db_name = _fetch_student_email(cursor, loan.get('university_id'))

        conn.commit()
        cursor.close()
        conn.close()

        if student_email:
            try:
                attachments = None
                try:
                    _pdf, _ = _pdf_box_return({
                        'id': loan_id,
                        'student_name':  loan.get('student_name') or student_db_name or '',
                        'university_id': loan.get('university_id'),
                        'box_name':      loan.get('box_name') or '',
                        'instance_code': loan.get('instance_label') or '',
                        'condition':     'damaged' if any_problem else 'good',
                        'admin_name':    admin_name or '',
                        'notes':         general_notes or '',
                    })
                    attachments = [{'filename': f'box-return-{loan_id}.pdf', 'content': _pdf, 'mime': 'application/pdf'}]
                except Exception as _pe:
                    print(f'[pdf] box_return skip: {_pe}')
                send_box_return_confirmation(
                    to_email    = student_email,
                    student_name= loan.get('student_name') or student_db_name or '',
                    box_name    = loan.get('box_name') or '',
                    instance_code = loan.get('instance_label') or '',
                    condition   = 'damaged' if any_problem else 'good',
                    admin_name  = admin_name or '',
                    notes       = general_notes or '',
                    attachments = attachments,
                )
            except Exception as _e:
                print(f'[email] box_return_confirmation skip: {_e}')

        log_action(admin_id, admin_name, 'إرجاع بوكس',
                   f'تم إرجاع {loan.get("instance_label") or loan["box_name"]} — {final_status}')
        return jsonify({
            'status': 'success',
            'message': 'تم تسجيل الإرجاع',
            'data': {'finalStatus': final_status}
        }), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@boxes_bp.route('/api/box-loans/<int:loan_id>', methods=['DELETE'])
def cancel_box_loan(loan_id):
    """Cancel an active loan and restore inventory + free the instance."""
    try:
        admin_id, admin_name = get_admin_info()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""SELECT box_id, instance_id, status FROM box_loans
                          WHERE id = %s""", (loan_id,))
        loan = cursor.fetchone()
        if not loan:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'غير موجود'}), 404
        if loan['status'] != 'active':
            cursor.close(); conn.close()
            return jsonify({'status': 'error',
                            'message': 'يمكن إلغاء الاستعارات النشطة فقط'}), 400

        cursor.execute("""
            SELECT item_name, quantity_required FROM box_items WHERE box_id = %s
        """, (loan['box_id'],))
        for row in cursor.fetchall():
            cursor.execute("UPDATE items SET quantity = quantity + %s WHERE name = %s",
                           (row['quantity_required'], row['item_name']))

        cursor.execute("DELETE FROM box_loans WHERE id = %s", (loan_id,))
        if loan.get('instance_id'):
            cursor.execute("UPDATE box_instances SET status='available' WHERE id=%s",
                           (loan['instance_id'],))

        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إلغاء استعارة بوكس',
                   f'تم إلغاء استعارة #{loan_id}')
        return jsonify({'status': 'success', 'message': 'تم الإلغاء'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
