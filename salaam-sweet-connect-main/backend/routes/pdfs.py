"""
PDF routes.

Endpoints:
  GET  /api/pdf/loan/<loan_id>               → loan receipt PDF
  GET  /api/pdf/loan-return/<loan_id>        → return certificate
  GET  /api/pdf/welcome/<university_id>      → welcome card
  GET  /api/pdf/statement/<university_id>    → student statement
  GET  /api/pdf/box-loan/<loan_id>           → box loan receipt
  GET  /api/pdf/box-return/<loan_id>         → box return certificate
  GET  /api/pdf/inventory                    → monthly inventory report
  GET  /api/pdf/overdue                      → overdue loans report
  GET  /api/pdf/batch/<batch_id>             → batch activity report
  POST /api/pdf/qr-labels                    → QR labels for given entries
  GET  /verify/<doc_id>                      → public doc verification landing page
"""
from __future__ import annotations

import os
from datetime import datetime
from flask import Blueprint, Response, request, jsonify

from database import get_db_connection
from utils.audit import log_action
from utils.helpers import get_admin_info
from pdf_service import (
    generate_loan_receipt,
    generate_cart_loan_receipt,
    generate_loan_return_certificate,
    generate_welcome_card,
    generate_student_statement,
    generate_box_loan_receipt,
    generate_box_return_certificate,
    generate_inventory_report,
    generate_overdue_report,
    generate_batch_activity_report,
    generate_qr_labels,
)

pdfs_bp = Blueprint('pdfs', __name__)


def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    resp = Response(pdf_bytes, mimetype='application/pdf')
    resp.headers['Content-Disposition'] = f'inline; filename="{filename}"'
    return resp


def _log_doc(doc_id: str, kind: str, ref: str | int = ''):
    """Persist doc metadata for later verification."""
    try:
        conn = get_db_connection()
        cur  = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pdf_docs (
              doc_id   VARCHAR(64) PRIMARY KEY,
              kind     VARCHAR(32) NOT NULL,
              ref      VARCHAR(128),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute(
            "INSERT IGNORE INTO pdf_docs (doc_id, kind, ref) VALUES (%s, %s, %s)",
            (doc_id, kind, str(ref)),
        )
        conn.commit()
        cur.close(); conn.close()
    except Exception as e:
        print(f'[pdfs] log_doc skip: {e}')


# ──────────────────────────────────────────────
# #1 Loan receipt
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/loan/<int:loan_id>', methods=['GET'])
def pdf_loan(loan_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT l.id, l.university_id, u.name AS student_name, u.academic_id,
                   l.item_name, l.qty AS quantity,
                   l.checkout_date AS borrow_date,
                   l.expected_return_date, l.notes
            FROM loans l LEFT JOIN users u ON u.universityId = l.university_id
            WHERE l.id=%s
        """, (loan_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return jsonify({'status':'error','message':'Loan not found'}), 404
        for k in ('borrow_date','expected_return_date'):
            if row.get(k): row[k] = str(row[k])
        pdf, doc_id = generate_loan_receipt(row)
        _log_doc(doc_id, 'loan', loan_id)
        return _pdf_response(pdf, f'loan-{loan_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #1b Cart (multi-item) loan receipt
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/cart-loan/<int:req_id>', methods=['GET'])
def pdf_cart_loan(req_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT cr.id AS req_id, cr.university_id, u.name AS student_name,
                   u.academic_id, cr.expected_return_date AS return_date,
                   cr.admin_comment, cr.status
            FROM cart_requests cr
            LEFT JOIN users u ON u.universityId = cr.university_id
            WHERE cr.id=%s
        """, (req_id,))
        head = cur.fetchone()
        if not head:
            cur.close(); conn.close()
            return jsonify({'status':'error','message':'Request not found'}), 404
        cur.execute("""
            SELECT componentName AS name, requestedQuantity AS requested,
                   approvedQuantity AS approved
            FROM cart_request_items WHERE request_id=%s
        """, (req_id,))
        rows = cur.fetchall() or []
        cur.close(); conn.close()

        approved = [{'name': r['name'], 'requested': r['requested'],
                     'approved': r.get('approved') or 0}
                    for r in rows if (r.get('approved') or 0) > 0]
        rejected = [{'name': r['name'], 'requested': r['requested']}
                    for r in rows if not (r.get('approved') or 0)]
        _, admin_name = get_admin_info()
        head['admin_name'] = admin_name or ''
        head['approved_items'] = approved
        head['rejected_items'] = rejected
        if head.get('return_date'):
            head['return_date'] = str(head['return_date'])

        pdf, doc_id = generate_cart_loan_receipt(head)
        _log_doc(doc_id, 'cart-loan', req_id)
        return _pdf_response(pdf, f'cart-{req_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #2 Loan return certificate
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/loan-return/<int:loan_id>', methods=['GET'])
def pdf_loan_return(loan_id):
    try:
        condition = request.args.get('condition', 'good')
        _, admin_name = get_admin_info()
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT l.id, l.university_id, u.name AS student_name,
                   l.item_name, l.qty AS quantity, l.notes
            FROM loans l LEFT JOIN users u ON u.universityId = l.university_id
            WHERE l.id=%s
        """, (loan_id,))
        row = cur.fetchone() or {}
        cur.close(); conn.close()
        row.update({
            'condition':  condition,
            'admin_name': admin_name or '',
            'return_date': datetime.now().strftime('%Y-%m-%d'),
        })
        pdf, doc_id = generate_loan_return_certificate(row)
        _log_doc(doc_id, 'loan-return', loan_id)
        return _pdf_response(pdf, f'return-{loan_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #3 Welcome card
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/welcome/<university_id>', methods=['GET'])
def pdf_welcome(university_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT u.name, u.universityId, u.academic_id, u.role,
                   b.name AS batch_name
            FROM users u LEFT JOIN batches b ON b.id = u.batch_id
            WHERE u.universityId=%s
        """, (university_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return jsonify({'status':'error','message':'User not found'}), 404
        pdf, doc_id = generate_welcome_card(row)
        _log_doc(doc_id, 'welcome', university_id)
        return _pdf_response(pdf, f'welcome-{university_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #4 Student statement
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/statement/<university_id>', methods=['GET'])
def pdf_statement(university_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT name, universityId, academic_id FROM users WHERE universityId=%s", (university_id,))
        user = cur.fetchone()
        if not user:
            cur.close(); conn.close()
            return jsonify({'status':'error','message':'User not found'}), 404
        cur.execute("""
            SELECT id, item_name, qty AS quantity, checkout_date AS borrow_date,
                   expected_return_date, status
            FROM loans WHERE university_id=%s ORDER BY id DESC LIMIT 200
        """, (university_id,))
        loans = cur.fetchall() or []
        try:
            cur.execute("""
                SELECT id, item_name, quantity, created_at, status
                FROM item_requests WHERE university_id=%s ORDER BY id DESC LIMIT 200
            """, (university_id,))
            reqs = cur.fetchall() or []
        except Exception:
            reqs = []
        cur.close(); conn.close()
        for l in loans:
            for k in ('borrow_date','expected_return_date'):
                if l.get(k): l[k] = str(l[k])
        for r in reqs:
            if r.get('created_at'): r['created_at'] = str(r['created_at'])
        pdf, doc_id = generate_student_statement(user, loans, reqs)
        _log_doc(doc_id, 'statement', university_id)
        return _pdf_response(pdf, f'statement-{university_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #5 Box loan receipt
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/box-loan/<int:loan_id>', methods=['GET'])
def pdf_box_loan(loan_id):
    try:
        _, admin_name = get_admin_info()
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT bl.id, bl.university_id, u.name AS student_name,
                   b.name AS box_name, bi.instance_code,
                   bl.checkout_date AS borrow_date,
                   bl.expected_return_date
            FROM box_loans bl
            LEFT JOIN box_instances bi ON bi.id = bl.instance_id
            LEFT JOIN boxes b          ON b.id  = bi.box_id
            LEFT JOIN users u          ON u.universityId = bl.university_id
            WHERE bl.id=%s
        """, (loan_id,))
        row = cur.fetchone() or {}
        cur.close(); conn.close()
        if not row:
            return jsonify({'status':'error','message':'Box loan not found'}), 404
        for k in ('borrow_date','expected_return_date'):
            if row.get(k): row[k] = str(row[k])
        row['admin_name'] = admin_name or ''
        pdf, doc_id = generate_box_loan_receipt(row)
        _log_doc(doc_id, 'box-loan', loan_id)
        return _pdf_response(pdf, f'box-loan-{loan_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #6 Box return certificate
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/box-return/<int:loan_id>', methods=['GET'])
def pdf_box_return(loan_id):
    try:
        condition = request.args.get('condition', 'good')
        notes     = request.args.get('notes', '')
        _, admin_name = get_admin_info()
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT bl.id, bl.university_id, u.name AS student_name,
                   b.name AS box_name, bi.instance_code
            FROM box_loans bl
            LEFT JOIN box_instances bi ON bi.id = bl.instance_id
            LEFT JOIN boxes b          ON b.id  = bi.box_id
            LEFT JOIN users u          ON u.universityId = bl.university_id
            WHERE bl.id=%s
        """, (loan_id,))
        row = cur.fetchone() or {}
        cur.close(); conn.close()
        row.update({
            'condition':  condition,
            'admin_name': admin_name or '',
            'notes':      notes,
            'return_date': datetime.now().strftime('%Y-%m-%d'),
        })
        pdf, doc_id = generate_box_return_certificate(row)
        _log_doc(doc_id, 'box-return', loan_id)
        return _pdf_response(pdf, f'box-return-{loan_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #7 Inventory report
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/inventory', methods=['GET'])
def pdf_inventory():
    try:
        period = request.args.get('period') or datetime.now().strftime('%Y-%m')
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name, category, quantity FROM items ORDER BY quantity ASC, name")
        items = cur.fetchall() or []
        cur.close(); conn.close()
        pdf, doc_id = generate_inventory_report(items, period=period)
        _log_doc(doc_id, 'inventory', period)
        admin_id, admin_name = get_admin_info()
        log_action(admin_id, admin_name, 'تصدير PDF', f'تقرير المخزون {period}')
        return _pdf_response(pdf, f'inventory-{period}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #8 Overdue report
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/overdue', methods=['GET'])
def pdf_overdue():
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT l.id, l.university_id, u.name AS student_name, l.item_name,
                   l.expected_return_date,
                   DATEDIFF(CURDATE(),
                     COALESCE(
                       STR_TO_DATE(l.expected_return_date,'%Y-%m-%d'),
                       STR_TO_DATE(l.expected_return_date,'%Y/%m/%d'),
                       STR_TO_DATE(l.expected_return_date,'%d-%m-%Y'),
                       STR_TO_DATE(l.expected_return_date,'%d/%m/%Y')
                     )
                   ) AS days_overdue
            FROM loans l LEFT JOIN users u ON u.universityId = l.university_id
            WHERE l.status IN ('نشط','متأخر')
            HAVING days_overdue > 0
            ORDER BY days_overdue DESC
            LIMIT 500
        """)
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        pdf, doc_id = generate_overdue_report(rows)
        _log_doc(doc_id, 'overdue')
        admin_id, admin_name = get_admin_info()
        log_action(admin_id, admin_name, 'تصدير PDF', 'تقرير العهد المتأخرة')
        return _pdf_response(pdf, 'overdue.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #9 Batch activity report
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/batch/<int:batch_id>', methods=['GET'])
def pdf_batch_activity(batch_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT id, name FROM batches WHERE id=%s", (batch_id,))
        batch = cur.fetchone()
        if not batch:
            cur.close(); conn.close()
            return jsonify({'status':'error','message':'Batch not found'}), 404
        cur.execute("""
            SELECT u.universityId AS university_id, u.name,
                   (SELECT COUNT(*) FROM loans l WHERE l.university_id=u.universityId AND l.status='نشط') AS active_loans,
                   (SELECT COUNT(*) FROM loans l WHERE l.university_id=u.universityId AND l.status='متأخر') AS overdue,
                   (SELECT COUNT(*) FROM loans l WHERE l.university_id=u.universityId) AS total_loans,
                   (SELECT COUNT(*) FROM item_requests r WHERE r.university_id=u.universityId) AS total_requests
            FROM users u
            WHERE u.batch_id=%s
            ORDER BY u.name
        """, (batch_id,))
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        pdf, doc_id = generate_batch_activity_report(batch, rows)
        _log_doc(doc_id, 'batch', batch_id)
        admin_id, admin_name = get_admin_info()
        log_action(admin_id, admin_name, 'تصدير PDF', f'تقرير نشاط دفعة {batch.get("name")}')
        return _pdf_response(pdf, f'batch-{batch_id}.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# #10 QR labels
# ──────────────────────────────────────────────
@pdfs_bp.route('/api/pdf/qr-labels', methods=['POST'])
def pdf_qr_labels():
    try:
        data = request.get_json() or {}
        entries = data.get('entries') or []
        kind    = data.get('kind', 'item')
        if not entries:
            return jsonify({'status':'error','message':'entries array required'}), 400
        pdf, doc_id = generate_qr_labels(entries, kind=kind)
        _log_doc(doc_id, 'qr-labels', kind)
        return _pdf_response(pdf, 'qr-labels.pdf')
    except Exception as exc:
        return jsonify({'status':'error','message':str(exc)}), 500


# ──────────────────────────────────────────────
# Public verification landing
# ──────────────────────────────────────────────
@pdfs_bp.route('/verify/<doc_id>', methods=['GET'])
def verify_doc(doc_id):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute("CREATE TABLE IF NOT EXISTS pdf_docs (doc_id VARCHAR(64) PRIMARY KEY, kind VARCHAR(32), ref VARCHAR(128), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
        cur.execute("SELECT doc_id, kind, ref, created_at FROM pdf_docs WHERE doc_id=%s", (doc_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
    except Exception:
        row = None

    if not row:
        html = f"""<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>Doc not found</title></head>
<body style="font-family:sans-serif;background:#f4f6f9;padding:50px;text-align:center;">
<h1 style="color:#991b1b;">الوثيقة غير موجودة · Document not found</h1>
<p>Doc ID: <code>{doc_id}</code></p>
</body></html>"""
        return Response(html, mimetype='text/html', status=404)

    html = f"""<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وثيقة أصلية</title></head>
<body style="font-family:sans-serif;background:#f4f6f9;padding:50px;">
<div style="max-width:560px;margin:auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.06);">
<h1 style="color:#065f46;">✓ وثيقة أصلية · Authentic document</h1>
<p><b>Doc ID:</b> <code>{row['doc_id']}</code></p>
<p><b>النوع · Type:</b> {row['kind']}</p>
<p><b>المرجع · Reference:</b> {row.get('ref') or '—'}</p>
<p><b>تاريخ الإصدار · Issued:</b> {row.get('created_at')}</p>
<hr><p style="color:#6b7280;font-size:13px;">تم إنشاء هذه الوثيقة بواسطة نظام مختبر طويق للابتكار.</p>
</div>
</body></html>"""
    return Response(html, mimetype='text/html')
