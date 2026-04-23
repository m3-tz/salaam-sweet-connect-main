"""
📄 pdf_service.py (ReportLab engine)
Unified, production-grade PDF generator for Tuwaiq Innovation Lab.

Why ReportLab instead of xhtml2pdf:
  xhtml2pdf does NOT do Arabic shaping + bidi — it renders Arabic as disconnected
  boxes. ReportLab + arabic-reshaper + python-bidi handles both correctly, and
  Tahoma (shipped with Windows) carries the Arabic glyphs.

Public API (unchanged — routes/pdfs.py calls these directly):
    generate_loan_receipt(loan)             -> (bytes, doc_id)
    generate_cart_loan_receipt(cart)        -> (bytes, doc_id)
    generate_loan_return_certificate(loan)  -> (bytes, doc_id)
    generate_welcome_card(user)             -> (bytes, doc_id)
    generate_student_statement(user, loans, requests) -> (bytes, doc_id)
    generate_box_loan_receipt(box_loan)     -> (bytes, doc_id)
    generate_box_return_certificate(box_loan) -> (bytes, doc_id)
    generate_inventory_report(items, period='') -> (bytes, doc_id)
    generate_overdue_report(loans)          -> (bytes, doc_id)
    generate_batch_activity_report(batch, rows) -> (bytes, doc_id)
    generate_qr_labels(entries, kind='item') -> (bytes, doc_id)
    make_doc_id(kind, ref='')               -> str
"""
from __future__ import annotations

import hashlib
import io
import os
import uuid
from datetime import datetime
from pathlib import Path

import qrcode
from PIL import Image as PILImage

import arabic_reshaper
from bidi.algorithm import get_display

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Table, TableStyle,
    Spacer, Image, PageBreak, KeepTogether,
)

# ──────────────────────────────────────────────
# Paths & config
# ──────────────────────────────────────────────
_BASE_DIR    = Path(__file__).resolve().parent
_CACHE_DIR   = _BASE_DIR / "cache"
_CACHE_DIR.mkdir(exist_ok=True)
_LOGO_CACHE  = _CACHE_DIR / "tuwaiq_logo.png"

_LOGO_URL    = os.getenv("PDF_LOGO_URL", "https://tuwaiq.edu.sa/img/logo-v2/logo.webp")
_PUBLIC_BASE = os.getenv("PUBLIC_BASE_URL", "http://localhost:5000")

PAGE_W, PAGE_H = A4
LEFT = RIGHT = 1.5 * cm
TOP  = 3.0 * cm
BOTTOM = 3.2 * cm

BRAND_BLUE = colors.HexColor('#0f3b66')
BRAND_GREY = colors.HexColor('#6b7280')
LINE_GREY  = colors.HexColor('#d4dbe6')
BG_GREY    = colors.HexColor('#f1f5f9')
OK_BG      = colors.HexColor('#d1fae5')
OK_FG      = colors.HexColor('#065f46')
BAD_BG     = colors.HexColor('#fee2e2')
BAD_FG     = colors.HexColor('#991b1b')
WARN_BG    = colors.HexColor('#fef3c7')
WARN_FG    = colors.HexColor('#92400e')

# ──────────────────────────────────────────────
# Font registration — Tahoma has Arabic glyphs
# ──────────────────────────────────────────────
_FONT_REG, _FONT_BOLD = 'Arial', 'Arial-Bold'

def _register_fonts():
    candidates = [
        ('C:/Windows/Fonts/tahoma.ttf',   'C:/Windows/Fonts/tahomabd.ttf'),
        ('C:/Windows/Fonts/arial.ttf',    'C:/Windows/Fonts/arialbd.ttf'),
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
    ]
    for reg, bold in candidates:
        if os.path.exists(reg) and os.path.exists(bold):
            try:
                pdfmetrics.registerFont(TTFont(_FONT_REG,  reg))
                pdfmetrics.registerFont(TTFont(_FONT_BOLD, bold))
                return True
            except Exception as e:
                print(f'[pdf] font register failed {reg}: {e}')
    return False

_register_fonts()


# ──────────────────────────────────────────────
# Arabic shaping helper
# ──────────────────────────────────────────────
def _ar(text) -> str:
    """
    Shape Arabic text for ReportLab. Safe on mixed / pure-English input.
    Any character in the Arabic block triggers reshape+bidi; otherwise returned verbatim.
    """
    if text is None:
        return ''
    s = str(text)
    if not s:
        return ''
    # Fast path: if no Arabic characters, return as-is.
    has_ar = any('\u0600' <= ch <= '\u06FF' or '\uFB50' <= ch <= '\uFEFC' for ch in s)
    if not has_ar:
        return s
    try:
        return get_display(arabic_reshaper.reshape(s))
    except Exception:
        return s


# ──────────────────────────────────────────────
# Logo — download once, alpha-mask the white box, cache
# ──────────────────────────────────────────────
def _prepare_logo() -> Path | None:
    if _LOGO_CACHE.exists() and _LOGO_CACHE.stat().st_size > 0:
        return _LOGO_CACHE
    try:
        import urllib.request
        req = urllib.request.Request(_LOGO_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            raw = r.read()
        img = PILImage.open(io.BytesIO(raw)).convert('RGBA')
        px = img.load()
        w, h = img.size
        for y in range(h):
            for x in range(w):
                r_, g_, b_, _a = px[x, y]
                if r_ > 235 and g_ > 235 and b_ > 235:
                    px[x, y] = (r_, g_, b_, 0)
        img.save(_LOGO_CACHE, 'PNG')
        return _LOGO_CACHE
    except Exception as exc:
        print(f'[pdf] logo prep failed: {exc}')
        return None


# ──────────────────────────────────────────────
# QR
# ──────────────────────────────────────────────
def _qr_image(payload: str) -> io.BytesIO:
    qr = qrcode.QRCode(
        version=None, error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4, border=1,
    )
    qr.add_data(payload); qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return buf


def make_doc_id(kind: str, ref: str | int = '') -> str:
    stamp = datetime.now().strftime('%y%m%d')
    seed  = f'{kind}:{ref}:{uuid.uuid4().hex}'
    short = hashlib.sha1(seed.encode()).hexdigest()[:6].upper()
    return f'{kind.upper()}-{stamp}-{short}'


# ──────────────────────────────────────────────
# Paragraph styles
# ──────────────────────────────────────────────
def _styles():
    return {
        'title_ar': ParagraphStyle('title_ar', fontName=_FONT_BOLD, fontSize=16,
                                   textColor=BRAND_BLUE, alignment=TA_RIGHT, leading=20),
        'title_en': ParagraphStyle('title_en', fontName=_FONT_REG,  fontSize=10,
                                   textColor=BRAND_GREY, alignment=TA_LEFT, leading=14),
        'meta':     ParagraphStyle('meta',     fontName=_FONT_REG,  fontSize=8.5,
                                   textColor=BRAND_GREY, alignment=TA_LEFT, leading=12),
        'h2':       ParagraphStyle('h2',       fontName=_FONT_BOLD, fontSize=12,
                                   textColor=BRAND_BLUE, alignment=TA_RIGHT, leading=18,
                                   spaceBefore=10, spaceAfter=4),
        'kv_k':     ParagraphStyle('kv_k',     fontName=_FONT_REG,  fontSize=9.5,
                                   textColor=BRAND_GREY, alignment=TA_RIGHT, leading=13),
        'kv_v':     ParagraphStyle('kv_v',     fontName=_FONT_BOLD, fontSize=10,
                                   textColor=colors.HexColor('#111827'), alignment=TA_RIGHT, leading=14),
        'body_rtl': ParagraphStyle('body_rtl', fontName=_FONT_REG,  fontSize=10,
                                   textColor=colors.HexColor('#374151'), alignment=TA_RIGHT, leading=15),
        'body_ltr': ParagraphStyle('body_ltr', fontName=_FONT_REG,  fontSize=10,
                                   textColor=colors.HexColor('#374151'), alignment=TA_LEFT, leading=15),
        'cell':     ParagraphStyle('cell',     fontName=_FONT_REG,  fontSize=9,
                                   textColor=colors.HexColor('#111827'), alignment=TA_RIGHT, leading=12),
        'cell_c':   ParagraphStyle('cell_c',   fontName=_FONT_REG,  fontSize=9,
                                   textColor=colors.HexColor('#111827'), alignment=TA_CENTER, leading=12),
        'th':       ParagraphStyle('th',       fontName=_FONT_BOLD, fontSize=9.5,
                                   textColor=BRAND_BLUE, alignment=TA_CENTER, leading=12),
        'sign':     ParagraphStyle('sign',     fontName=_FONT_REG,  fontSize=9,
                                   textColor=colors.HexColor('#4b5563'), alignment=TA_CENTER, leading=12),
        'welcome_ar': ParagraphStyle('welcome_ar', fontName=_FONT_BOLD, fontSize=22,
                                     textColor=BRAND_BLUE, alignment=TA_CENTER, leading=28, spaceAfter=4),
        'welcome_en': ParagraphStyle('welcome_en', fontName=_FONT_BOLD, fontSize=11,
                                     textColor=BRAND_GREY, alignment=TA_CENTER, leading=14, spaceAfter=14),
    }


# ──────────────────────────────────────────────
# Page frame / template with branded header + footer
# ──────────────────────────────────────────────
class _BrandedDoc(BaseDocTemplate):
    def __init__(self, buffer, *, title_ar, title_en, doc_id, verify_url, **kw):
        super().__init__(
            buffer, pagesize=A4,
            leftMargin=LEFT, rightMargin=RIGHT,
            topMargin=TOP, bottomMargin=BOTTOM,
            title=title_en, author='Tuwaiq Innovation Lab',
        )
        self.title_ar_raw = title_ar
        self.title_en     = title_en
        self.doc_id       = doc_id
        self.verify_url   = verify_url
        self.styles       = _styles()
        frame = Frame(
            LEFT, BOTTOM, PAGE_W - LEFT - RIGHT, PAGE_H - TOP - BOTTOM,
            id='main', showBoundary=0,
        )
        self.addPageTemplates([PageTemplate(id='branded', frames=[frame],
                                            onPage=self._draw_decor)])

    def _draw_decor(self, canv, doc):
        canv.saveState()
        # Header
        logo_path = _prepare_logo()
        if logo_path and logo_path.exists():
            try:
                canv.drawImage(str(logo_path), PAGE_W - RIGHT - 2.5*cm, PAGE_H - 2.3*cm,
                               width=2.5*cm, height=1.3*cm, mask='auto',
                               preserveAspectRatio=True)
            except Exception:
                pass

        # Arabic title (RTL) on the right block
        canv.setFont(_FONT_BOLD, 15)
        canv.setFillColor(BRAND_BLUE)
        ar_title = _ar(self.title_ar_raw)
        canv.drawRightString(PAGE_W - RIGHT - 2.8*cm, PAGE_H - 1.7*cm, ar_title)

        # English subtitle
        canv.setFont(_FONT_REG, 9)
        canv.setFillColor(BRAND_GREY)
        canv.drawString(LEFT, PAGE_H - 1.7*cm, self.title_en)

        # Doc id + timestamp
        canv.setFont(_FONT_REG, 8)
        canv.drawString(LEFT, PAGE_H - 2.15*cm,
                        f'Doc ID: {self.doc_id}   |   {datetime.now().strftime("%Y-%m-%d %H:%M")}')

        # Header rule
        canv.setStrokeColor(BRAND_BLUE); canv.setLineWidth(1.2)
        canv.line(LEFT, PAGE_H - 2.4*cm, PAGE_W - RIGHT, PAGE_H - 2.4*cm)

        # Footer rule
        canv.setStrokeColor(LINE_GREY); canv.setLineWidth(0.6)
        canv.line(LEFT, BOTTOM - 0.3*cm, PAGE_W - RIGHT, BOTTOM - 0.3*cm)

        # Footer QR
        try:
            qr_buf = _qr_image(self.verify_url)
            qimg = PILImage.open(qr_buf)
            qpath = _CACHE_DIR / f'_qr_{self.doc_id}.png'
            qimg.save(qpath, 'PNG')
            canv.drawImage(str(qpath), LEFT, 0.4*cm,
                           width=2.1*cm, height=2.1*cm, mask='auto')
        except Exception:
            pass

        # Footer text
        canv.setFont(_FONT_BOLD, 8.5); canv.setFillColor(colors.HexColor('#374151'))
        canv.drawString(LEFT + 2.4*cm, 2.1*cm,
                        f'{_ar("مختبر طويق للابتكار")}  ·  Tuwaiq Innovation Lab')
        canv.setFont(_FONT_REG, 7.8); canv.setFillColor(BRAND_GREY)
        canv.drawString(LEFT + 2.4*cm, 1.55*cm,
                        _ar('للتحقق من الوثيقة امسح رمز QR') + '  ·  Scan QR to verify this document.')
        canv.drawString(LEFT + 2.4*cm, 1.05*cm,
                        _ar('تم الإنشاء تلقائياً — لا يحتاج توقيعاً يدوياً') + '  ·  Auto-generated.')
        canv.drawRightString(PAGE_W - RIGHT, 0.55*cm,
                             f'Page {canv.getPageNumber()}')
        canv.restoreState()


# ──────────────────────────────────────────────
# Helpers for common blocks (key/value, tables)
# ──────────────────────────────────────────────
def _p(style, text):
    # Callers are responsible for shaping Arabic via _ar() before passing text here.
    # This avoids double-shaping when the input is already visual-ordered.
    return Paragraph('' if text is None else str(text), style)


def _kv_table(rows: list[tuple[str, str]], st: dict) -> Table:
    """
    RTL key/value pairs rendered as a 2-column table.
    Column order (physical, left→right): [value, key]
    """
    data = []
    for k, v in rows:
        data.append([_p(st['kv_v'], _ar(v)), _p(st['kv_k'], _ar(k))])
    total = PAGE_W - LEFT - RIGHT
    tbl = Table(data, colWidths=[total * 0.63, total * 0.37], hAlign='RIGHT')
    tbl.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 0), (-1, -2), 0.4, colors.HexColor('#e5e7eb')),
        ('LEFTPADDING',  (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING',   (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 5),
    ]))
    return tbl


def _grid_table(headers: list[str], rows: list[list], st: dict,
                col_widths: list[float] | None = None,
                zebra: bool = True) -> Table:
    """
    Data grid with brand-styled header row. All text goes through _ar() via Paragraphs.
    headers and cells may be mixed AR/EN strings; pre-rendered Paragraphs pass through.
    """
    head = [h if isinstance(h, Paragraph) else _p(st['th'], _ar(h)) for h in headers]
    body_rows = []
    for r in rows:
        body_rows.append([
            cell if isinstance(cell, Paragraph) else _p(st['cell_c'], cell)
            for cell in r
        ])
    data = [head] + body_rows

    total = PAGE_W - LEFT - RIGHT
    if not col_widths:
        col_widths = [total / len(headers)] * len(headers)

    tbl = Table(data, colWidths=col_widths, hAlign='CENTER', repeatRows=1)
    style = [
        ('BACKGROUND', (0, 0), (-1, 0), BG_GREY),
        ('TEXTCOLOR',  (0, 0), (-1, 0), BRAND_BLUE),
        ('BOX',        (0, 0), (-1, -1), 0.5, LINE_GREY),
        ('INNERGRID',  (0, 0), (-1, -1), 0.3, LINE_GREY),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
    ]
    if zebra:
        for i in range(1, len(data)):
            if i % 2 == 0:
                style.append(('BACKGROUND', (0, i), (-1, i), colors.HexColor('#fafafa')))
    tbl.setStyle(TableStyle(style))
    return tbl


def _signature_block(st):
    total = PAGE_W - LEFT - RIGHT
    sig_line = '_' * 32
    data = [[
        _p(st['sign'], f'{sig_line}<br/>{_ar("توقيع الطالب")} · Student signature'),
        '',
        _p(st['sign'], f'{sig_line}<br/>{_ar("توقيع المشرف")} · Admin signature'),
    ]]
    t = Table(data, colWidths=[total * 0.45, total * 0.1, total * 0.45])
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 20),
    ]))
    return t


def _status_badge_paragraph(text_ar: str, kind: str, st) -> Paragraph:
    bg, fg = {
        'ok':   (OK_BG,   OK_FG),
        'warn': (WARN_BG, WARN_FG),
        'bad':  (BAD_BG,  BAD_FG),
    }.get(kind, (BG_GREY, BRAND_BLUE))
    s = ParagraphStyle('badge', parent=st['kv_v'],
                       fontName=_FONT_BOLD, fontSize=9,
                       textColor=fg, backColor=bg,
                       alignment=TA_CENTER, borderPadding=(3, 6, 3, 6),
                       leading=12)
    return Paragraph(_ar(text_ar), s)


# ──────────────────────────────────────────────
# Build + render helper
# ──────────────────────────────────────────────
def _render(story, *, title_ar, title_en, doc_id) -> bytes:
    buf = io.BytesIO()
    verify = f'{_PUBLIC_BASE}/verify/{doc_id}'
    doc = _BrandedDoc(buf, title_ar=title_ar, title_en=title_en,
                      doc_id=doc_id, verify_url=verify)
    doc.build(story)
    return buf.getvalue()


# ──────────────────────────────────────────────
# PDF #1 — individual loan receipt
# ──────────────────────────────────────────────
def generate_loan_receipt(loan: dict) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('LOAN', loan.get('id', ''))
    rows = [
        ('اسم الطالب · Student',           str(loan.get('student_name') or '—')),
        ('الرقم الجامعي · University ID',  str(loan.get('university_id') or '—')),
        ('الرقم الأكاديمي · Academic ID',  str(loan.get('academic_id') or '—')),
        ('القطعة · Item',                  str(loan.get('item_name') or '—')),
        ('الكمية · Quantity',              str(loan.get('quantity') or 1)),
        ('تاريخ الاستلام · Borrowed',      str(loan.get('borrow_date') or '—')),
        ('تاريخ الإعادة · Expected return', str(loan.get('expected_return_date') or '—')),
        ('ملاحظات · Notes',                str(loan.get('notes') or '—')),
    ]
    story = [_kv_table(rows, st), Spacer(1, 1*cm), _signature_block(st)]
    return _render(story, title_ar='إيصال استلام عهدة',
                   title_en='LOAN RECEIPT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #1b — multi-item cart loan receipt
# ──────────────────────────────────────────────
def generate_cart_loan_receipt(cart: dict) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('CART', cart.get('req_id', ''))
    status_ar = 'موافقة كاملة' if cart.get('status') == 'approved' else 'موافقة جزئية'
    head = [
        ('رقم الطلب · Request ID',       str(cart.get('req_id') or '—')),
        ('الطالب · Student',             str(cart.get('student_name') or '—')),
        ('الرقم الجامعي · University ID', str(cart.get('university_id') or '—')),
        ('تاريخ الإعادة · Expected return', str(cart.get('return_date') or '—')),
        ('المُعتمد · Approved by',       str(cart.get('admin_name') or '—')),
        ('الحالة · Status',              f'{status_ar} · {cart.get("status","").title()}'),
    ]
    story = [_kv_table(head, st)]

    approved = cart.get('approved_items') or []
    if approved:
        story += [
            Spacer(1, 0.4*cm),
            _p(st['h2'], _ar('القطع المُعتمدة') + ' · Approved items'),
            _grid_table(
                ['القطعة / Item', 'المطلوب', 'المعتمد'],
                [[_p(st['cell'], it.get('name','—')),
                  _p(st['cell_c'], str(it.get('requested','—'))),
                  _p(st['cell_c'], str(it.get('approved','—')))] for it in approved],
                st, col_widths=[(PAGE_W-LEFT-RIGHT)*0.6, (PAGE_W-LEFT-RIGHT)*0.2, (PAGE_W-LEFT-RIGHT)*0.2],
            ),
        ]

    rejected = cart.get('rejected_items') or []
    if rejected:
        story += [
            Spacer(1, 0.4*cm),
            _p(st['h2'], _ar('القطع المرفوضة') + ' · Rejected items'),
            _grid_table(
                ['القطعة / Item', 'المطلوب'],
                [[_p(st['cell'], it.get('name','—')),
                  _p(st['cell_c'], str(it.get('requested','—')))] for it in rejected],
                st, col_widths=[(PAGE_W-LEFT-RIGHT)*0.75, (PAGE_W-LEFT-RIGHT)*0.25],
            ),
        ]

    comment = cart.get('admin_comment') or ''
    if comment:
        story += [Spacer(1, 0.4*cm),
                  _p(st['body_rtl'], f'<b>{_ar("ملاحظة المشرف")}:</b> {_ar(comment)}')]

    story += [Spacer(1, 1*cm), _signature_block(st)]
    return _render(story, title_ar='سند عهدة — طلب متعدد',
                   title_en='CART LOAN RECEIPT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #2 — loan return certificate (single or bulk)
# ──────────────────────────────────────────────
def generate_loan_return_certificate(loan: dict) -> tuple[bytes, str]:
    """
    Supports two modes:
      - Single: keys 'item_name','quantity','condition'
      - Bulk:   key  'items' = [{'item_name','quantity','condition'}, ...]
    """
    st = _styles()
    doc_id = make_doc_id('RETN', loan.get('id') or loan.get('university_id') or '')
    items = loan.get('items')
    head_rows = [
        ('اسم الطالب · Student',           str(loan.get('student_name') or '—')),
        ('الرقم الجامعي · University ID',  str(loan.get('university_id') or '—')),
        ('تاريخ الإعادة · Returned on',    str(loan.get('return_date') or datetime.now().strftime('%Y-%m-%d'))),
        ('المستلم · Received by',          str(loan.get('admin_name') or '—')),
    ]
    story = [_kv_table(head_rows, st)]

    if items:
        def _badge(cond):
            cond = (cond or 'good').lower()
            if cond == 'damaged':
                return _status_badge_paragraph('تالفة · Damaged', 'bad', st)
            return _status_badge_paragraph('سليمة · Good', 'ok', st)

        grid_rows = [
            [_p(st['cell'], it.get('item_name','—')),
             _p(st['cell_c'], str(it.get('quantity','—'))),
             _badge(it.get('condition'))]
            for it in items
        ]
        story += [
            Spacer(1, 0.4*cm),
            _p(st['h2'], _ar('القطع المُعادة') + ' · Returned items'),
            _grid_table(
                ['القطعة / Item', 'الكمية', 'الحالة / Condition'],
                grid_rows, st,
                col_widths=[(PAGE_W-LEFT-RIGHT)*0.55, (PAGE_W-LEFT-RIGHT)*0.15, (PAGE_W-LEFT-RIGHT)*0.30],
            ),
        ]
    else:
        cond = (loan.get('condition') or 'good').lower()
        badge = _status_badge_paragraph(
            'تالفة · Damaged' if cond == 'damaged' else 'سليمة · Good',
            'bad' if cond == 'damaged' else 'ok', st,
        )
        rows = [
            ('القطعة · Item',      str(loan.get('item_name') or '—')),
            ('الكمية · Quantity',  str(loan.get('quantity') or 1)),
        ]
        story += [Spacer(1, 0.4*cm), _kv_table(rows, st)]
        story += [Spacer(1, 0.3*cm),
                  Table([[_p(st['kv_k'], 'الحالة · Condition'), badge]],
                        colWidths=[(PAGE_W-LEFT-RIGHT)*0.5]*2)]

    notes = loan.get('notes') or ''
    if notes:
        story += [Spacer(1, 0.4*cm),
                  _p(st['body_rtl'], f'<b>{_ar("ملاحظات")}:</b> {_ar(notes)}')]

    story += [Spacer(1, 1*cm), _signature_block(st)]
    return _render(story, title_ar='شهادة إعادة عهدة',
                   title_en='LOAN RETURN CERTIFICATE', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #3 — welcome card
# ──────────────────────────────────────────────
def generate_welcome_card(user: dict) -> tuple[bytes, str]:
    st = _styles()
    uni = user.get('universityId') or user.get('university_id') or ''
    doc_id = make_doc_id('WELC', uni)
    academic = user.get('academic_id') or user.get('academicId') or '—'
    story = [
        Spacer(1, 1*cm),
        _p(st['welcome_ar'], _ar('مرحباً في مختبر طويق للابتكار')),
        _p(st['welcome_en'], 'WELCOME TO TUWAIQ INNOVATION LAB'),
        Spacer(1, 0.4*cm),
        _kv_table([
            ('الاسم · Name',                str(user.get('name') or '—')),
            ('الرقم الجامعي · University ID', str(uni or '—')),
            ('الرقم الأكاديمي · Academic ID', str(academic)),
            ('الدفعة · Batch',              str(user.get('batch_name') or user.get('batch') or '—')),
            ('الدور · Role',                str(user.get('role_label') or user.get('role') or 'طالب · Student')),
            ('تاريخ القبول · Approved on',  datetime.now().strftime('%Y-%m-%d')),
        ], st),
        Spacer(1, 0.6*cm),
        _p(st['body_rtl'],
           _ar('يُستخدم هذا المستند للتعريف داخل المختبر. احتفظ بالرقم الأكاديمي، فهو مطلوب لاستلام العهد وتقديم الطلبات.')),
        _p(st['body_ltr'],
           'Keep this card for lab identification. Your Academic ID is required for borrowing items and submitting requests.'),
    ]
    return _render(story, title_ar='بطاقة ترحيب',
                   title_en='WELCOME CARD', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #4 — student statement
# ──────────────────────────────────────────────
def generate_student_statement(user: dict, loans: list[dict],
                               item_requests: list[dict]) -> tuple[bytes, str]:
    st = _styles()
    uni = user.get('universityId') or user.get('university_id') or ''
    doc_id = make_doc_id('STMT', uni)

    def _trunc(s, n=40):
        s = str(s or '—')
        return s if len(s) <= n else s[:n-1] + '…'

    loan_headers = ['#', 'القطعة / Item', 'الكمية',
                    'الاستلام', 'الإعادة', 'الحالة']
    loan_rows = [[
        _p(st['cell_c'], str(l.get('id', ''))),
        _p(st['cell'],   _trunc(l.get('item_name'))),
        _p(st['cell_c'], str(l.get('quantity', 1))),
        _p(st['cell_c'], str(l.get('borrow_date') or '—')[:10]),
        _p(st['cell_c'], str(l.get('expected_return_date') or '—')[:10]),
        _p(st['cell_c'], _ar(str(l.get('status') or '—'))),
    ] for l in (loans or [])] or [[_p(st['cell_c'], '—')]*6]

    req_headers = ['#', 'الطلب / Item', 'الكمية',
                   'التاريخ', 'الحالة']
    req_rows = [[
        _p(st['cell_c'], str(r.get('id', ''))),
        _p(st['cell'],   _trunc(r.get('item_name'))),
        _p(st['cell_c'], str(r.get('quantity', 1))),
        _p(st['cell_c'], str(r.get('created_at') or '—')[:10]),
        _p(st['cell_c'], _ar(str(r.get('status') or '—'))),
    ] for r in (item_requests or [])] or [[_p(st['cell_c'], '—')]*5]

    total_w = PAGE_W - LEFT - RIGHT
    story = [
        _kv_table([
            ('الاسم · Name',                 str(user.get('name') or '—')),
            ('الرقم الجامعي · University ID', str(uni or '—')),
            ('الرقم الأكاديمي · Academic ID', str(user.get('academic_id') or '—')),
        ], st),
        _p(st['h2'], _ar('سجل العهد') + ' · Loans history'),
        _grid_table(loan_headers, loan_rows, st,
                    col_widths=[total_w*0.07, total_w*0.36, total_w*0.11,
                                total_w*0.15, total_w*0.15, total_w*0.16]),
        _p(st['h2'], _ar('سجل الطلبات') + ' · Requests history'),
        _grid_table(req_headers, req_rows, st,
                    col_widths=[total_w*0.08, total_w*0.47, total_w*0.12,
                                total_w*0.17, total_w*0.16]),
    ]
    return _render(story, title_ar='كشف حساب الطالب',
                   title_en='STUDENT STATEMENT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #5 — box loan receipt
# ──────────────────────────────────────────────
def generate_box_loan_receipt(loan: dict) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('BOXL', loan.get('id') or loan.get('instance_code') or '')
    rows = [
        ('الطالب · Student',              str(loan.get('student_name') or '—')),
        ('الرقم الجامعي · University ID', str(loan.get('university_id') or '—')),
        ('الصندوق · Box',                 str(loan.get('box_name') or '—')),
        ('رقم النسخة · Instance code',    str(loan.get('instance_code') or '—')),
        ('تاريخ الاستلام · Borrowed',     str(loan.get('borrow_date') or datetime.now().strftime('%Y-%m-%d'))),
        ('تاريخ الإعادة · Expected return', str(loan.get('expected_return_date') or '—')),
        ('المسلّم · Issued by',           str(loan.get('admin_name') or '—')),
    ]
    story = [_kv_table(rows, st), Spacer(1, 1*cm), _signature_block(st)]
    return _render(story, title_ar='إيصال استلام صندوق',
                   title_en='BOX LOAN RECEIPT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #6 — box return certificate
# ──────────────────────────────────────────────
def generate_box_return_certificate(loan: dict) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('BOXR', loan.get('id') or loan.get('instance_code') or '')
    cond = (loan.get('condition') or 'good').lower()
    badge = _status_badge_paragraph(
        'تحتاج مراجعة · Needs review' if cond == 'damaged' else 'سليمة · Good',
        'bad' if cond == 'damaged' else 'ok', st,
    )
    rows = [
        ('الطالب · Student',              str(loan.get('student_name') or '—')),
        ('الرقم الجامعي · University ID', str(loan.get('university_id') or '—')),
        ('الصندوق · Box',                 str(loan.get('box_name') or '—')),
        ('رقم النسخة · Instance code',    str(loan.get('instance_code') or '—')),
        ('تاريخ الإعادة · Returned on',   str(loan.get('return_date') or datetime.now().strftime('%Y-%m-%d'))),
        ('المستلم · Received by',         str(loan.get('admin_name') or '—')),
    ]
    story = [
        _kv_table(rows, st), Spacer(1, 0.2*cm),
        Table([[_p(st['kv_k'], 'الحالة · Condition'), badge]],
              colWidths=[(PAGE_W-LEFT-RIGHT)*0.5]*2),
    ]
    notes = loan.get('notes') or ''
    if notes:
        story += [Spacer(1, 0.4*cm),
                  _p(st['body_rtl'], f'<b>{_ar("ملاحظات")}:</b> {_ar(notes)}')]
    story += [Spacer(1, 1*cm), _signature_block(st)]
    return _render(story, title_ar='شهادة إعادة صندوق',
                   title_en='BOX RETURN CERTIFICATE', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #7 — monthly inventory report
# ──────────────────────────────────────────────
def generate_inventory_report(items: list[dict], *, period: str = '') -> tuple[bytes, str]:
    st = _styles()
    period = period or datetime.now().strftime('%Y-%m')
    doc_id = make_doc_id('INV', period)
    total_units = sum(int(i.get('quantity') or 0) for i in items)
    low = sum(1 for i in items if int(i.get('quantity') or 0) <= 3)

    head_info = _kv_table([
        ('الفترة · Period',               period),
        ('إجمالي الأصناف · Total SKUs',   str(len(items))),
        ('إجمالي الوحدات · Total units',  str(total_units)),
        ('أصناف منخفضة · Low stock',      str(low)),
    ], st)

    def _status_badge_for(q):
        if q == 0: return _status_badge_paragraph('نفد', 'bad', st)
        if q <= 3: return _status_badge_paragraph('منخفض', 'warn', st)
        return _status_badge_paragraph('متوفر', 'ok', st)

    headers = ['#', 'الاسم / Name', 'التصنيف', 'الكمية', 'الحالة']
    rows = [[
        _p(st['cell_c'], str(i.get('id',''))),
        _p(st['cell'],   str(i.get('name','—'))),
        _p(st['cell_c'], str(i.get('category') or '—')),
        _p(st['cell_c'], str(int(i.get('quantity') or 0))),
        _status_badge_for(int(i.get('quantity') or 0)),
    ] for i in (items or [])] or [[_p(st['cell_c'], '—')]*5]

    total_w = PAGE_W - LEFT - RIGHT
    story = [
        head_info,
        _p(st['h2'], _ar('تفاصيل المخزون') + ' · Stock details'),
        _grid_table(headers, rows, st,
                    col_widths=[total_w*0.08, total_w*0.40, total_w*0.20, total_w*0.12, total_w*0.20]),
    ]
    return _render(story, title_ar='تقرير المخزون الشهري',
                   title_en='MONTHLY INVENTORY REPORT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #8 — overdue report
# ──────────────────────────────────────────────
def generate_overdue_report(loans: list[dict]) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('OVRD')
    headers = ['#', 'الطالب', 'الجامعي', 'القطعة',
               'الإعادة', 'التأخير']
    def _days_badge(d):
        kind = 'bad' if d >= 7 else 'warn'
        return _status_badge_paragraph(f'{d} يوم', kind, st)

    rows = [[
        _p(st['cell_c'], str(l.get('id',''))),
        _p(st['cell'],   str(l.get('student_name','—'))),
        _p(st['cell_c'], str(l.get('university_id','—'))),
        _p(st['cell'],   str(l.get('item_name','—'))),
        _p(st['cell_c'], str(l.get('expected_return_date') or '—')[:10]),
        _days_badge(int(l.get('days_overdue') or 0)),
    ] for l in (loans or [])] or [[_p(st['cell_c'], _ar('لا يوجد · none'))] + ['', '', '', '', '']]

    total_w = PAGE_W - LEFT - RIGHT
    story = [
        _p(st['body_rtl'], f'{_ar("إجمالي العهد المتأخرة")}: <b>{len(loans)}</b>'),
        Spacer(1, 0.3*cm),
        _grid_table(headers, rows, st,
                    col_widths=[total_w*0.07, total_w*0.22, total_w*0.14,
                                total_w*0.28, total_w*0.14, total_w*0.15]),
    ]
    return _render(story, title_ar='تقرير العهد المتأخرة',
                   title_en='OVERDUE LOANS REPORT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #9 — batch activity report
# ──────────────────────────────────────────────
def generate_batch_activity_report(batch: dict, rows: list[dict]) -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('BATCH', batch.get('id') or batch.get('name', ''))
    head_info = _kv_table([
        ('الدفعة · Batch',        str(batch.get('name', '—'))),
        ('المعرّف · ID',          str(batch.get('id', '—'))),
        ('عدد الطلاب · Students', str(len(rows))),
    ], st)
    headers = ['الجامعي', 'الاسم', 'نشطة', 'متأخرة',
               'إجمالي عهد', 'إجمالي طلبات']
    data = [[
        _p(st['cell_c'], str(r.get('university_id','—'))),
        _p(st['cell'],   str(r.get('name','—'))),
        _p(st['cell_c'], str(r.get('active_loans',0))),
        _p(st['cell_c'], str(r.get('overdue',0))),
        _p(st['cell_c'], str(r.get('total_loans',0))),
        _p(st['cell_c'], str(r.get('total_requests',0))),
    ] for r in (rows or [])] or [[_p(st['cell_c'], '—')]*6]
    total_w = PAGE_W - LEFT - RIGHT
    story = [
        head_info,
        _p(st['h2'], _ar('نشاط الطلاب') + ' · Student activity'),
        _grid_table(headers, data, st,
                    col_widths=[total_w*0.15, total_w*0.27] + [total_w*0.145]*4),
    ]
    return _render(story, title_ar='تقرير نشاط دفعة',
                   title_en='BATCH ACTIVITY REPORT', doc_id=doc_id), doc_id


# ──────────────────────────────────────────────
# PDF #10 — QR labels
# ──────────────────────────────────────────────
def generate_qr_labels(entries: list[dict], *, kind: str = 'item') -> tuple[bytes, str]:
    st = _styles()
    doc_id = make_doc_id('QRLB')
    total_w = PAGE_W - LEFT - RIGHT

    cells = []
    for e in entries:
        url = e.get('url') or f'{_PUBLIC_BASE}/{kind}/{e.get("id","")}'
        qr_buf = _qr_image(url)
        # Save to disk so Image(path) works reliably with ReportLab
        qpath = _CACHE_DIR / f'_lbl_{uuid.uuid4().hex}.png'
        PILImage.open(qr_buf).save(qpath, 'PNG')
        inner = [
            [Image(str(qpath), width=3*cm, height=3*cm)],
            [_p(st['kv_v'], str(e.get('name','—')))],
            [_p(st['meta'], str(e.get('code') or e.get('id','')))],
        ]
        tcell = Table(inner, colWidths=[total_w * 0.45])
        tcell.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('BOX',   (0,0), (-1,-1), 0.5, LINE_GREY),
            ('TOPPADDING',   (0,0), (-1,-1), 8),
            ('BOTTOMPADDING',(0,0), (-1,-1), 8),
        ]))
        cells.append(tcell)

    pair_rows = []
    for i in range(0, len(cells), 2):
        pair = cells[i:i+2]
        if len(pair) == 1:
            pair.append('')
        pair_rows.append(pair)

    grid = Table(pair_rows, colWidths=[total_w*0.5, total_w*0.5])
    grid.setStyle(TableStyle([
        ('TOPPADDING',   (0,0), (-1,-1), 4),
        ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ('LEFTPADDING',  (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
    ]))
    story = [_p(st['meta'], f'{_ar("عدد الملصقات")}: {len(entries)}'),
             Spacer(1, 0.3*cm), grid]
    return _render(story, title_ar='ملصقات رموز QR',
                   title_en='QR LABELS', doc_id=doc_id), doc_id
