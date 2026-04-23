from datetime import date

from flask import Blueprint, jsonify, request

from database import get_db_connection
from utils.helpers import sanitize_text, get_admin_info
from utils.helpers import hash_password
from utils.audit import log_action
from utils.academic import generate_academic_id
from email_service import (
    send_request_decision,
    send_custom_email,
    send_loan_receipt,
    send_account_approved,
    send_registration_rejected,
)

requests_bp = Blueprint('requests', __name__)


# ──────────────────────────────────────────────
# Registration requests
# ──────────────────────────────────────────────

@requests_bp.route('/api/requests/registration', methods=['GET'])
def get_reg_requests():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT r.*,
                   b.name AS batch_name,
                   b.code AS batch_code
            FROM registration_requests r
            LEFT JOIN batches b ON b.id = r.batch_id
            ORDER BY r.id DESC
        """)
        reqs = cursor.fetchall()
        for r in reqs:
            if r['requestDate']: r['requestDate'] = str(r['requestDate'])
            # حساب الرقم الأكاديمي المتوقع بناءً على كود الدفعة
            if r.get('batch_code') and r.get('status') == 'pending':
                r['expectedAcademicId'] = generate_academic_id(cursor, r['batch_code'])
            else:
                r['expectedAcademicId'] = None
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': reqs}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@requests_bp.route('/api/requests/registration/<int:req_id>', methods=['POST'])
def handle_reg_request(req_id):
    try:
        data         = request.get_json()
        status       = data.get('status')
        admin_id, admin_name = get_admin_info()

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # ── Idempotency guard: fetch request BEFORE updating ──────────────
        cursor.execute("SELECT * FROM registration_requests WHERE id=%s", (req_id,))
        req_data = cursor.fetchone()
        if not req_data:
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'الطلب غير موجود'}), 404

        if req_data.get('status') == 'approved':
            cursor.close(); conn.close()
            return jsonify({'status': 'error', 'message': 'تم قبول هذا الطلب مسبقاً — لا يمكن تكرار العملية'}), 409
        # ─────────────────────────────────────────────────────────────────

        cursor.execute("UPDATE registration_requests SET status=%s WHERE id=%s", (status, req_id))

        if status == 'approved':
            if req_data:
                batch_id_val    = req_data.get('batch_id')
                academic_id_val = None
                batch_row       = None

                if batch_id_val:
                    cursor.execute("SELECT code, name FROM batches WHERE id=%s", (batch_id_val,))
                    batch_row = cursor.fetchone()
                    if batch_row:
                        academic_id_val = generate_academic_id(cursor, batch_row['code'])

                final_university_id = academic_id_val if academic_id_val else req_data.get('universityId')

                # ── بروتوكول المستخدمين بدون دفعة: توليد رقم أكاديمي تلقائي ──
                if not final_university_id:
                    role_val = (req_data.get('role') or 'student').lower()
                    if role_val in ('engineer', 'مهندس'):
                        fallback_prefix = 'ENG'
                    elif role_val in ('admin', 'مشرف'):
                        fallback_prefix = 'ADM'
                    else:
                        fallback_prefix = 'STU'
                    final_university_id = generate_academic_id(cursor, fallback_prefix)
                # ──────────────────────────────────────────────────────────────

                # ── Duplicate user guard ──────────────────────────────────
                cursor.execute("SELECT universityId FROM users WHERE universityId=%s", (final_university_id,))
                if cursor.fetchone():
                    conn.rollback(); cursor.close(); conn.close()
                    return jsonify({'status': 'error', 'message': f'المستخدم برقم {final_university_id} موجود مسبقاً في النظام'}), 409
                # ─────────────────────────────────────────────────────────

                cursor.execute(
                    "INSERT INTO users (universityId, name, password, role, phone, email, batch_id) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (final_university_id, req_data['name'], req_data['password'], req_data['role'],
                     req_data['phone'], req_data.get('email'), batch_id_val),
                )

                if req_data.get('email') and final_university_id:
                    try:
                        role_label_map = {
                            'student': 'طالب', 'engineer': 'مهندس',
                            'admin': 'مشرف', 'مهندس': 'مهندس',
                            'مشرف': 'مشرف', 'طالب': 'طالب',
                        }
                        role_label = role_label_map.get(
                            (req_data.get('role') or 'student').lower(), 'طالب'
                        )
                        attachments = None
                        try:
                            from pdf_service import generate_welcome_card
                            _pdf, _ = generate_welcome_card({
                                'name': req_data['name'],
                                'universityId': final_university_id,
                                'academic_id':  final_university_id,
                                'batch_name':   batch_row['name'] if batch_row else '',
                                'role_label':   role_label,
                            })
                            attachments = [{'filename': f'welcome-{final_university_id}.pdf',
                                            'content': _pdf, 'mime': 'application/pdf'}]
                        except Exception as _pe:
                            print(f'[pdf] welcome_card skip: {_pe}')
                        send_account_approved(
                            to_email    = req_data['email'],
                            student_name= req_data['name'],
                            academic_id = final_university_id,
                            batch_name  = batch_row['name'] if batch_row else '',
                            role_label  = role_label,
                            attachments = attachments,
                        )
                    except Exception as _e:
                        print(f'[email] account_approved skip: {_e}')

                log_action(admin_id, admin_name, 'موافقة على تسجيل',
                           f"تم قبول تسجيل المستخدم: {req_data['name']}")
        else:
            log_action(admin_id, admin_name, 'رفض تسجيل', f'تم رفض طلب التسجيل رقم {req_id}')
            if req_data.get('email'):
                try:
                    send_registration_rejected(
                        to_email    = req_data['email'],
                        student_name= req_data.get('name') or '',
                        reason      = data.get('reason') or '',
                    )
                except Exception as _e:
                    print(f'[email] registration_rejected skip: {_e}')

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        import traceback
        print(f'[ERROR] handle_reg_request({req_id}):', traceback.format_exc())
        return jsonify({'status': 'error', 'message': str(exc), 'detail': traceback.format_exc()}), 500


@requests_bp.route('/api/requests/registration/<int:req_id>', methods=['DELETE'])
def delete_reg_request(req_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM registration_requests WHERE id=%s", (req_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف طلب تسجيل', f'تم حذف طلب تسجيل بالرقم {req_id}')
        return jsonify({'status': 'success', 'message': 'تم الحذف'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Cart (borrowing) requests
# ──────────────────────────────────────────────

@requests_bp.route('/api/requests/cart', methods=['GET'])
def get_cart_requests():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM cart_requests ORDER BY id DESC")
        carts = cursor.fetchall()
        for cart in carts:
            if cart['requestDate']:        cart['requestDate']        = str(cart['requestDate'])
            if cart['expectedReturnDate']: cart['expectedReturnDate'] = str(cart['expectedReturnDate'])
            cursor.execute(
                "SELECT id, componentName, requestedQuantity, approvedQuantity "
                "FROM cart_request_items WHERE request_id=%s",
                (cart['id'],),
            )
            cart['items'] = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': carts}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@requests_bp.route('/api/admin/requests', methods=['GET'])
def get_all_requests():
    try:
        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, studentId, studentName, requestDate, expectedReturnDate, "
            "COALESCE(status,'pending') AS status FROM cart_requests ORDER BY requestDate DESC"
        )
        reqs = cursor.fetchall()
        for req in reqs:
            cursor.execute(
                "SELECT cri.componentName, cri.requestedQuantity AS qty "
                "FROM cart_request_items cri WHERE cri.request_id=%s",
                (req['id'],),
            )
            req['items']         = cursor.fetchall()
            req['receiver_name'] = req['studentName']
            req['camp_name']     = 'طلب استعارة'
            req['room_number']   = '-'
            req['return_date']   = str(req['expectedReturnDate']) if req['expectedReturnDate'] else ''
        conn.close()
        return jsonify({'status': 'success', 'data': reqs}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@requests_bp.route('/api/requests/cart/<int:req_id>', methods=['POST'])
def handle_cart_request(req_id):
    try:
        data               = request.get_json()
        status             = data.get('status')
        items              = data.get('items', [])
        expected_return    = data.get('expectedReturnDate')
        admin_comment      = sanitize_text(data.get('adminComment', ''))
        admin_id, admin_name = get_admin_info()
        today              = date.today().strftime('%Y-%m-%d')

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("UPDATE cart_requests SET status=%s WHERE id=%s", (status, req_id))
        cursor.execute("SELECT studentId, studentName FROM cart_requests WHERE id=%s", (req_id,))
        student    = cursor.fetchone()
        student_id = student['studentId']
        student_nm = student['studentName']

        if status in ('approved', 'partial'):
            for item in items:
                comp_name = item['componentName']
                app_qty   = item['approvedQuantity']

                cursor.execute(
                    "UPDATE cart_request_items SET approvedQuantity=%s "
                    "WHERE request_id=%s AND componentName=%s",
                    (app_qty, req_id, comp_name),
                )

                if app_qty > 0:
                    cursor.execute("SELECT quantity FROM items WHERE name=%s", (comp_name,))
                    stock = cursor.fetchone()
                    if stock and stock['quantity'] >= app_qty:
                        cursor.execute(
                            "INSERT INTO loans (university_id, item_name, qty, checkout_date, expected_return_date, status) "
                            "VALUES (%s,%s,%s,%s,%s,'نشط')",
                            (student_id, comp_name, app_qty, today, expected_return),
                        )
                        cursor.execute("UPDATE items SET quantity=quantity-%s WHERE name=%s",
                                       (app_qty, comp_name))
                    else:
                        conn.rollback()
                        return jsonify({'status': 'error', 'message': f'الكمية غير متوفرة لقطعة {comp_name}'}), 400

            log_action(admin_id, admin_name, 'موافقة على استعارة',
                       f'تم قبول استعارة للطالب {student_nm}')

        elif status == 'rejected':
            log_action(admin_id, admin_name, 'رفض استعارة',
                       f'تم رفض طلب الاستعارة للطالب {student_nm}')

        conn.commit()
        cursor.close()
        conn.close()

        # ── إرسال إيميل للطالب ────────────────────────────────────────────────
        try:
            conn2   = get_db_connection()
            cursor2 = conn2.cursor(dictionary=True)
            cursor2.execute("SELECT email FROM users WHERE universityId=%s", (student_id,))
            u = cursor2.fetchone()
            cursor2.close()
            conn2.close()

            if u and u.get('email'):
                if status in ('approved', 'partial'):
                    # بناء قوائم القطع المعتمدة والمرفوضة
                    approved_lst, rejected_lst = [], []
                    # نجيب الكميات المطلوبة من قاعدة البيانات
                    conn3   = get_db_connection()
                    cursor3 = conn3.cursor(dictionary=True)
                    cursor3.execute(
                        "SELECT componentName, requestedQuantity FROM cart_request_items WHERE request_id=%s",
                        (req_id,)
                    )
                    orig_items = {r['componentName']: r['requestedQuantity'] for r in cursor3.fetchall()}
                    cursor3.close()
                    conn3.close()

                    approved_map = {it['componentName']: it['approvedQuantity'] for it in items}
                    for comp_name, req_qty in orig_items.items():
                        app_qty = approved_map.get(comp_name, 0)
                        if app_qty > 0:
                            approved_lst.append({'name': comp_name, 'requested': req_qty, 'approved': app_qty})
                        else:
                            rejected_lst.append({'name': comp_name, 'requested': req_qty})

                    cart_attachments = None
                    try:
                        from pdf_service import generate_cart_loan_receipt
                        _pdf, _ = generate_cart_loan_receipt({
                            'req_id': req_id,
                            'student_name': sanitize_text(student_nm),
                            'university_id': student_id,
                            'return_date':  expected_return or '',
                            'admin_name':   sanitize_text(admin_name),
                            'admin_comment': admin_comment,
                            'status':       status,
                            'approved_items': approved_lst,
                            'rejected_items': rejected_lst,
                        })
                        cart_attachments = [{'filename': f'cart-{req_id}.pdf',
                                             'content': _pdf, 'mime': 'application/pdf'}]
                    except Exception as _pe:
                        print(f'[pdf] cart_loan skip: {_pe}')
                    send_loan_receipt(
                        to_email=u['email'],
                        student_name=sanitize_text(student_nm),
                        student_id=student_id,
                        req_id=req_id,
                        approved_items=approved_lst,
                        rejected_items=rejected_lst,
                        return_date=expected_return or '',
                        admin_name=sanitize_text(admin_name),
                        admin_comment=admin_comment,
                        status=status,
                        attachments=cart_attachments,
                    )
                else:
                    send_request_decision(
                        to_email=u['email'],
                        student_name=sanitize_text(student_nm),
                        decision='rejected',
                        items=[],
                        rejection_reason=admin_comment,
                    )
        except Exception as mail_err:
            print(f'Email error (non-critical): {mail_err}')

        return jsonify({'status': 'success'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@requests_bp.route('/api/requests/cart/<int:req_id>', methods=['DELETE'])
def delete_cart_request(req_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cart_request_items WHERE request_id=%s", (req_id,))
        cursor.execute("DELETE FROM cart_requests WHERE id=%s", (req_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'حذف طلب استعارة', f'تم حذف طلب استعارة بالرقم {req_id}')
        return jsonify({'status': 'success', 'message': 'تم الحذف'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


# ──────────────────────────────────────────────
# Student self-service
# ──────────────────────────────────────────────

@requests_bp.route('/api/student/cart', methods=['POST'])
def submit_cart():
    conn = None
    cursor = None
    try:
        data         = request.get_json(force=True) or {}
        student_id   = sanitize_text(data.get('studentId', ''))
        student_name = sanitize_text(data.get('studentName', ''))
        return_date  = data.get('expectedReturnDate', '')
        items_list   = data.get('items', [])
        note_val     = (data.get('note') or '').strip() or None
        today        = date.today().strftime('%Y-%m-%d')

        if not student_id or not return_date or not items_list:
            return jsonify({'status': 'error', 'message': 'بيانات ناقصة: studentId أو returnDate أو items مفقودة'}), 400

        conn   = get_db_connection()

        # ── أنشئ الجداول (مع إصلاح 1932 — InnoDB file مفقود/تالف) ──────────
        _init = conn.cursor()
        for _tbl in ('cart_request_items', 'cart_requests'):
            try:
                _init.execute(f"SELECT 1 FROM `{_tbl}` LIMIT 1")
                _init.fetchall()
            except Exception as _te:
                if '1932' in str(_te) or "doesn't exist in engine" in str(_te):
                    print(f'[cart] fixing corrupt table: {_tbl}')
                    _init.execute(f"DROP TABLE IF EXISTS `{_tbl}`")
        _init.execute("""
            CREATE TABLE IF NOT EXISTS cart_requests (
                id                 INT AUTO_INCREMENT PRIMARY KEY,
                studentId          VARCHAR(50)  NOT NULL DEFAULT '',
                studentName        VARCHAR(200) NOT NULL DEFAULT '',
                requestDate        DATE         NULL,
                expectedReturnDate DATE         NULL,
                status             VARCHAR(30)  NOT NULL DEFAULT 'pending',
                note               TEXT         NULL,
                created_at         TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        _init.execute("""
            CREATE TABLE IF NOT EXISTS cart_request_items (
                id                INT AUTO_INCREMENT PRIMARY KEY,
                request_id        INT          NOT NULL,
                componentName     VARCHAR(300) NOT NULL DEFAULT '',
                requestedQuantity INT          NOT NULL DEFAULT 1,
                approvedQuantity  INT          NOT NULL DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        _init.close()

        cursor = conn.cursor(dictionary=True)

        # ── فحص صلاحيات الدفعة ─────────────────────────────────────────────
        user_batch = None
        try:
            cursor.execute("""
                SELECT b.can_borrow, b.auto_approve, b.expires_at, b.name AS batch_name
                FROM users u
                LEFT JOIN batches b ON b.id = u.batch_id
                WHERE u.universityId = %s
            """, (student_id,))
            user_batch = cursor.fetchone()
        except Exception as _be:
            print(f'[cart] batch check skipped: {_be}')

        auto_approve = False
        if user_batch:
            if user_batch.get('expires_at'):
                exp = user_batch['expires_at']
                if hasattr(exp, 'date'):
                    exp = exp.date()
                if exp < date.today():
                    return jsonify({
                        'status': 'error',
                        'message': f'انتهت صلاحية دفعتك ({user_batch.get("batch_name","")}) ولا يمكن تقديم طلبات جديدة'
                    }), 403
            if user_batch.get('can_borrow') is not None and not user_batch.get('can_borrow'):
                return jsonify({
                    'status': 'error',
                    'message': f'دفعتك ({user_batch.get("batch_name","")}) لا تملك صلاحية الاستعارة حالياً'
                }), 403
            auto_approve = bool(user_batch.get('auto_approve', 0))

        status = 'approved' if auto_approve else 'pending'

        # ── إدراج الطلب ────────────────────────────────────────────────────
        cursor.execute(
            "INSERT INTO cart_requests "
            "(studentId, studentName, requestDate, expectedReturnDate, status, note) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (student_id, student_name, today, return_date, status, note_val),
        )
        request_id = cursor.lastrowid

        for item in items_list:
            cursor.execute(
                "INSERT INTO cart_request_items "
                "(request_id, componentName, requestedQuantity, approvedQuantity) "
                "VALUES (%s, %s, %s, %s)",
                (request_id, item['name'], item['qty'],
                 item['qty'] if status == 'approved' else 0),
            )

        # ── موافقة تلقائية: أنشئ عهداً وخصم الكمية فوراً ──────────────────
        if status == 'approved':
            for item in items_list:
                cursor.execute("SELECT quantity FROM items WHERE name=%s", (item['name'],))
                stock = cursor.fetchone()
                if not stock or stock['quantity'] < item['qty']:
                    conn.rollback()
                    return jsonify({
                        'status': 'error',
                        'message': f'الكمية غير كافية للقطعة: {item["name"]}'
                    }), 400
                cursor.execute(
                    "INSERT INTO loans "
                    "(university_id, item_name, qty, checkout_date, expected_return_date, status) "
                    "VALUES (%s, %s, %s, %s, %s, 'نشط')",
                    (student_id, item['name'], item['qty'], today, return_date),
                )
                cursor.execute(
                    "UPDATE items SET quantity = quantity - %s WHERE name = %s",
                    (item['qty'], item['name']),
                )

        conn.commit()

        log_action(student_id, student_name, 'إنشاء طلب استعارة',
                   f'قام الطالب بطلب {len(items_list)} نوع من القطع — الحالة: {status}')
        msg = 'تمت الموافقة التلقائية على طلبك ✅' if status == 'approved' else 'تم إرسال طلبك بنجاح'
        return jsonify({'status': 'success', 'message': msg, 'request_status': status}), 201

    except Exception as exc:
        import traceback; traceback.print_exc()
        try:
            if conn: conn.rollback()
        except Exception:
            pass
        return jsonify({'status': 'error', 'message': str(exc)}), 500
    finally:
        try:
            if cursor: cursor.close()
        except Exception:
            pass
        try:
            if conn: conn.close()
        except Exception:
            pass


@requests_bp.route('/api/student/request/<int:req_id>', methods=['DELETE'])
def delete_student_request(req_id):
    try:
        admin_id, admin_name = get_admin_info()
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cart_request_items WHERE request_id=%s", (req_id,))
        cursor.execute("DELETE FROM cart_requests WHERE id=%s AND status='pending'", (req_id,))
        conn.commit()
        cursor.close()
        conn.close()

        log_action(admin_id, admin_name, 'إلغاء طلب', f'تم إلغاء الطلب المعلق رقم {req_id}')
        return jsonify({'status': 'success', 'message': 'تم حذف الطلب بنجاح'}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500


@requests_bp.route('/api/student/my-requests/<string:student_id>', methods=['GET'])
def get_my_requests(student_id):
    try:
        conn   = get_db_connection()

        # أنشئ الجداول (مع إصلاح 1932 — InnoDB file مفقود/تالف)
        _init = conn.cursor()
        for _tbl in ('cart_request_items', 'cart_requests'):
            try:
                _init.execute(f"SELECT 1 FROM `{_tbl}` LIMIT 1")
                _init.fetchall()
            except Exception as _te:
                if '1932' in str(_te) or "doesn't exist in engine" in str(_te):
                    _init.execute(f"DROP TABLE IF EXISTS `{_tbl}`")
        _init.execute("""
            CREATE TABLE IF NOT EXISTS cart_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                studentId VARCHAR(50) NOT NULL DEFAULT '',
                studentName VARCHAR(200) NOT NULL DEFAULT '',
                requestDate DATE NULL,
                expectedReturnDate DATE NULL,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                note TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        _init.execute("""
            CREATE TABLE IF NOT EXISTS cart_request_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id INT NOT NULL,
                componentName VARCHAR(300) NOT NULL DEFAULT '',
                requestedQuantity INT NOT NULL DEFAULT 1,
                approvedQuantity INT NOT NULL DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        _init.close()

        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM cart_requests WHERE studentId=%s ORDER BY id DESC", (student_id,))
        requests_data = cursor.fetchall()
        for req in requests_data:
            if req['requestDate']:        req['requestDate']        = str(req['requestDate'])
            if req['expectedReturnDate']: req['expectedReturnDate'] = str(req['expectedReturnDate'])
            cursor.execute("""
                SELECT cri.componentName,
                       COALESCE(i.name_en, cri.componentName) AS name_en,
                       cri.requestedQuantity, cri.approvedQuantity
                FROM cart_request_items cri
                LEFT JOIN items i ON i.name = cri.componentName
                WHERE cri.request_id=%s
            """, (req['id'],))
            req['items'] = cursor.fetchall()

        try:
            cursor.execute("""
                SELECT l.id,
                       l.item_name AS componentName,
                       COALESCE(i.name_en, l.item_name) AS name_en,
                       l.qty AS quantity,
                       l.checkout_date AS borrowDate,
                       l.expected_return_date AS expectedReturnDate,
                       l.status
                FROM loans l
                LEFT JOIN items i ON i.name = l.item_name
                WHERE l.university_id=%s ORDER BY l.id DESC
            """, (student_id,))
            loans_data = cursor.fetchall()
        except Exception:
            loans_data = []
        for loan in loans_data:
            if loan.get('borrowDate'):         loan['borrowDate']         = str(loan['borrowDate'])
            if loan.get('expectedReturnDate'): loan['expectedReturnDate'] = str(loan['expectedReturnDate'])

        cursor.close()
        conn.close()
        return jsonify({'status': 'success', 'data': {'requests': requests_data, 'loans': loans_data}}), 200
    except Exception as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
