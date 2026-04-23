"""
📧 email_service.py
خدمة الإيميل الكاملة لنظام إدارة القطع | أكاديمية طويق
---------------------------------------------------------
الميزات:
  1. تأكيد الحساب عند التسجيل
  2. نسيت كلمة المرور (OTP)
  3. إشعار موافقة/رفض الطلب
  4. تذكير العهد المتأخرة
  5. إيميل مخصص من المشرف

Public API:
  from email_service import (
      send_registration_confirmation,
      send_otp_email,
      generate_otp,
      send_request_decision,
      send_overdue_reminder,
      send_loan_receipt,
      send_item_request_status,
      send_custom_email,
      send_account_approved,
      send_return_confirmation,
      send_box_loan_receipt,
      send_box_return_confirmation,
      send_registration_rejected,
      send_password_changed,
      send_admin_digest,
  )
"""

import os
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# ──────────────────────────────────────────────
# ⚙️  Config — all values come from .env
# ──────────────────────────────────────────────
# Required .env keys:
#   EMAIL_SENDER       e.g.  lab.tuwaiq.system@gmail.com
#   EMAIL_PASSWORD     Gmail App Password (16 chars, no spaces)
#   EMAIL_SENDER_NAME  e.g.  إدارة القطع | أكاديمية طويق   (optional)
#   EMAIL_SMTP_HOST    default: smtp.gmail.com
#   EMAIL_SMTP_PORT    default: 587

_SENDER       = os.getenv("EMAIL_SENDER",      "lab.tuwaiq.system@gmail.com")
_PASSWORD     = os.getenv("EMAIL_PASSWORD",    "")           # never hardcode
_SENDER_NAME  = os.getenv("EMAIL_SENDER_NAME", "إدارة القطع | أكاديمية طويق")
_SMTP_HOST    = os.getenv("EMAIL_SMTP_HOST",   "smtp.gmail.com")
_SMTP_PORT    = int(os.getenv("EMAIL_SMTP_PORT", "587"))


# ──────────────────────────────────────────────
# 🎨 Shared HTML template
# ──────────────────────────────────────────────

def _build_html(title: str, body_html: str) -> str:
    year = datetime.now().year
    return f"""<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;
             font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:12px;overflow:hidden;
                    box-shadow:0 4px 20px rgba(0,0,0,0.08);max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);
                     padding:32px 40px;text-align:center;">
            <h1 style="color:#e94560;margin:0;font-size:22px;
                       font-weight:700;letter-spacing:1px;">🔬 إدارة القطع</h1>
            <p style="color:#a0aec0;margin:6px 0 0;font-size:13px;">
              أكاديمية طويق — نظام المعمل
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">{body_html}</td></tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;
                     border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">
              هذه رسالة تلقائية من نظام إدارة المعمل — يرجى عدم الرد عليها
            </p>
            <p style="color:#cbd5e1;font-size:11px;margin:6px 0 0;">
              © {year} أكاديمية طويق. جميع الحقوق محفوظة.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ──────────────────────────────────────────────
# 📤 Core sender
# ──────────────────────────────────────────────

def _send_email(to_email: str, subject: str, html_content: str, attachments: list | None = None) -> dict:
    """
    Send an email via Gmail SMTP (TLS).
    `attachments` is an optional list of dicts: {"filename": "x.pdf", "content": bytes, "mime": "application/pdf"}.
    Returns {"success": True} or {"success": False, "error": "..."}.
    """
    if not _PASSWORD:
        msg = "EMAIL_PASSWORD is not set in .env — email not sent."
        print(f"⚠️  {msg}")
        return {"success": False, "error": msg}

    try:
        if attachments:
            msg = MIMEMultipart("mixed")
            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(html_content, "html", "utf-8"))
            msg.attach(alt)
            for att in attachments:
                mime_main, _, mime_sub = (att.get("mime") or "application/octet-stream").partition("/")
                part = MIMEApplication(att["content"], _subtype=(mime_sub or "octet-stream"))
                part.add_header("Content-Disposition", "attachment", filename=att["filename"])
                msg.attach(part)
        else:
            msg = MIMEMultipart("alternative")
            msg.attach(MIMEText(html_content, "html", "utf-8"))
        msg["Subject"] = subject
        msg["From"]    = f"{_SENDER_NAME} <{_SENDER}>"
        msg["To"]      = to_email

        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(_SENDER, _PASSWORD)
            server.sendmail(_SENDER, to_email, msg.as_string())

        print(f"✅ Email sent → {to_email} | {subject}")
        return {"success": True}

    except smtplib.SMTPAuthenticationError:
        err = "SMTP auth failed — check EMAIL_PASSWORD in .env"
        print(f"❌ {err}")
        return {"success": False, "error": err}
    except smtplib.SMTPException as exc:
        err = f"SMTP error: {exc}"
        print(f"❌ {err}")
        return {"success": False, "error": err}
    except Exception as exc:
        err = f"Unexpected error: {exc}"
        print(f"❌ {err}")
        return {"success": False, "error": err}


# ──────────────────────────────────────────────
# ✅ 1. Registration confirmation
# ──────────────────────────────────────────────

def send_registration_confirmation(to_email: str, student_name: str) -> dict:
    """Notify the student that their registration request was received."""
    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">
        مرحباً {student_name} 👋
    </h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
        تم استلام طلب تسجيلك في نظام إدارة معمل أكاديمية طويق بنجاح.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                padding:20px 24px;margin-bottom:24px;">
        <p style="color:#15803d;margin:0;font-size:14px;font-weight:600;">
            ✅ ما الخطوة التالية؟
        </p>
        <p style="color:#166534;margin:8px 0 0;font-size:13px;line-height:1.7;">
            طلبك الآن قيد المراجعة من قِبَل مشرف المعمل.
            ستصلك رسالة أخرى فور الموافقة على حسابك وتفعيله.
        </p>
    </div>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;
                padding:16px 20px;">
        <p style="color:#92400e;margin:0;font-size:13px;">
            ⏳ عادةً تتم المراجعة خلال <strong>24 ساعة</strong> من وقت التسجيل.
        </p>
    </div>"""
    return _send_email(
        to_email,
        "✅ تم استلام طلب تسجيلك — إدارة القطع",
        _build_html("تأكيد طلب التسجيل", body),
    )


# ──────────────────────────────────────────────
# 🔑 2. OTP (forgot password / email verify)
# ──────────────────────────────────────────────

def generate_otp(length: int = 6) -> str:
    """Generate a numeric OTP of the given length."""
    return "".join(random.choices(string.digits, k=length))


def send_otp_email(to_email: str, student_name: str, otp_code: str) -> dict:
    """Send an OTP code for password reset or email verification."""
    greeting = f"مرحباً {student_name} 👋" if student_name else "مرحباً 👋"
    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">{greeting}</h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:14px;line-height:1.6;">
        تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك.
    </p>
    <div style="text-align:center;margin:28px 0;">
        <p style="color:#64748b;font-size:13px;margin:0 0 12px;">رمز التحقق الخاص بك:</p>
        <div style="display:inline-block;
                    background:linear-gradient(135deg,#1a1a2e,#0f3460);
                    border-radius:12px;padding:20px 40px;">
            <span style="color:#e94560;font-size:42px;font-weight:700;
                         letter-spacing:12px;font-family:monospace;">
                {otp_code}
            </span>
        </div>
        <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
            ⏳ صالح لمدة <strong style="color:#e94560;">10 دقائق</strong> فقط
        </p>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                padding:16px 20px;margin-top:20px;">
        <p style="color:#9a3412;margin:0;font-size:13px;">
            ⚠️ إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.
            حسابك بأمان تام.
        </p>
    </div>"""
    return _send_email(
        to_email,
        f"🔑 رمز التحقق الخاص بك: {otp_code}",
        _build_html("رمز إعادة تعيين كلمة المرور", body),
    )


# ──────────────────────────────────────────────
# 📬 3. Request decision (approved / partial / rejected)
# ──────────────────────────────────────────────

def send_request_decision(
    to_email: str,
    student_name: str,
    decision: str,
    items: list,
    return_date: str = "",
    rejection_reason: str = "",
) -> dict:
    """
    Notify student of an approval/rejection decision on a borrow request.

    Args:
        decision: 'approved' | 'partial' | 'rejected'
        items:    [{"name": "Arduino", "qty": 2}, ...]
    """
    # Build items table rows
    rows = "".join(
        f"""<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
                     color:#1e293b;font-size:13px;">{i.get('name','')}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;
                     color:#475569;font-size:13px;text-align:center;">
              {i.get('qty', i.get('approvedQuantity','—'))}
          </td></tr>"""
        for i in items
    )
    items_table = f"""
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #e2e8f0;border-radius:10px;
                  overflow:hidden;margin:20px 0;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:12px 16px;text-align:right;color:#64748b;
                   font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">
            اسم القطعة</th>
        <th style="padding:12px 16px;text-align:center;color:#64748b;
                   font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0;">
            الكمية</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>""" if items else ""

    _DECISIONS = {
        "approved": {
            "icon": "✅", "color": "#15803d", "bg": "#f0fdf4",
            "border": "#bbf7d0", "label": "تمت الموافقة",
            "msg": (
                f'<p style="color:#166534;margin:0 0 12px;font-size:14px;">'
                f'تمت الموافقة على طلب استعارتك! يمكنك استلام القطع من المعمل.</p>'
                + (f'<p style="color:#166534;font-size:13px;margin:0;">'
                   f'📅 تاريخ الإرجاع المتوقع: <strong>{return_date}</strong></p>'
                   if return_date else "")
            ),
            "subject": "✅ تمت الموافقة على طلبك — إدارة القطع",
        },
        "partial": {
            "icon": "⚠️", "color": "#92400e", "bg": "#fffbeb",
            "border": "#fde68a", "label": "موافقة جزئية",
            "msg": '<p style="color:#78350f;margin:0;font-size:14px;">تمت الموافقة على جزء من طلبك.</p>',
            "subject": "⚠️ موافقة جزئية على طلبك — إدارة القطع",
        },
        "rejected": {
            "icon": "❌", "color": "#991b1b", "bg": "#fef2f2",
            "border": "#fecaca", "label": "تم الرفض",
            "msg": (
                '<p style="color:#7f1d1d;margin:0 0 8px;font-size:14px;">'
                'عذراً، لم يتم الموافقة على طلبك في الوقت الحالي.</p>'
                + (f'<p style="color:#991b1b;font-size:13px;margin:0;">📝 السبب: {rejection_reason}</p>'
                   if rejection_reason else "")
            ),
            "subject": "❌ تم رفض طلبك — إدارة القطع",
        },
    }
    d = _DECISIONS.get(decision, _DECISIONS["rejected"])

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">مرحباً {student_name} 👋</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;">
        تحديث على طلب استعارة القطع الخاص بك:
    </p>
    <div style="background:{d['bg']};border:1px solid {d['border']};border-radius:10px;
                padding:20px 24px;margin-bottom:20px;">
        <p style="color:{d['color']};margin:0 0 8px;font-size:16px;font-weight:700;">
            {d['icon']} {d['label']}
        </p>
        {d['msg']}
    </div>
    {items_table}"""

    return _send_email(to_email, d["subject"], _build_html(d["label"], body))


# ──────────────────────────────────────────────
# ⏰ 4. Overdue reminder
# ──────────────────────────────────────────────

def send_overdue_reminder(
    to_email: str,
    student_name: str,
    items: list,
    days_overdue: int = 0,
) -> dict:
    """
    Remind student of overdue borrowed items.

    Args:
        items: [{"name": "Arduino", "qty": 2, "due_date": "2026-03-01"}, ...]
    """
    rows = "".join(
        f"""<tr>
          <td style="padding:10px 16px;border-bottom:1px solid #fecaca;
                     color:#1e293b;font-size:13px;">{i.get('name','')}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #fecaca;
                     color:#475569;font-size:13px;text-align:center;">{i.get('qty','—')}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #fecaca;
                     color:#dc2626;font-size:13px;text-align:center;font-weight:600;">
              {i.get('due_date','—')}</td></tr>"""
        for i in items
    )
    overdue_label = f"متأخر {days_overdue} يوم" if days_overdue > 0 else "تاريخ الإرجاع قد مضى"

    body = f"""
    <h2 style="color:#991b1b;margin:0 0 8px;font-size:20px;">
        تذكير بإرجاع القطع المستعارة ⏰
    </h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;">
        مرحباً {student_name}، نذكّرك بأن لديك قطعاً مستعارة تجاوزت تاريخ إرجاعها.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
                padding:16px 20px;margin-bottom:20px;">
        <p style="color:#dc2626;margin:0;font-size:14px;font-weight:600;">
            🚨 {overdue_label}
        </p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fecaca;border-radius:10px;
                  overflow:hidden;margin-bottom:20px;">
      <thead><tr style="background:#fff5f5;">
        <th style="padding:12px 16px;text-align:right;color:#64748b;
                   font-size:12px;font-weight:600;border-bottom:1px solid #fecaca;">القطعة</th>
        <th style="padding:12px 16px;text-align:center;color:#64748b;
                   font-size:12px;font-weight:600;border-bottom:1px solid #fecaca;">الكمية</th>
        <th style="padding:12px 16px;text-align:center;color:#64748b;
                   font-size:12px;font-weight:600;border-bottom:1px solid #fecaca;">تاريخ الإرجاع</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                padding:16px 20px;">
        <p style="color:#9a3412;margin:0;font-size:13px;line-height:1.7;">
            📍 يرجى إرجاع القطع في أقرب وقت ممكن إلى مشرف المعمل.<br>
            التأخير المتكرر قد يؤثر على صلاحيات استخدامك للمعمل.
        </p>
    </div>"""

    return _send_email(
        to_email,
        f"⏰ تذكير: لديك قطع متأخرة ({overdue_label}) — إدارة القطع",
        _build_html("تذكير بإرجاع القطع", body),
    )


# ──────────────────────────────────────────────
# 📄 5. Loan receipt (sent on approval)
# ──────────────────────────────────────────────

def send_loan_receipt(
    to_email: str,
    student_name: str,
    student_id: str,
    req_id: int,
    approved_items: list,
    rejected_items: list,
    return_date: str,
    admin_name: str = '',
    admin_comment: str = '',
    status: str = 'approved',     # 'approved' | 'partial'
    attachments: list | None = None,
) -> dict:
    """
    Send a professional loan receipt / سند عهدة to the student after approval.

    approved_items: [{'name': 'Arduino', 'requested': 2, 'approved': 2}, ...]
    rejected_items: [{'name': 'Sensor', 'requested': 1}, ...]
    """
    today = datetime.now().strftime('%Y-%m-%d')
    time_str = datetime.now().strftime('%H:%M')

    # ── جدول القطع المعتمدة ──────────────────────────────────────────────────
    approved_rows = "".join(
        f"""<tr style="background:#f0fdf4;">
          <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;
                     color:#15803d;font-size:13px;font-weight:700;">{i.get('name','')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;
                     color:#475569;font-size:13px;text-align:center;">{i.get('requested','—')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #dcfce7;text-align:center;">
            <span style="background:#dcfce7;color:#166534;border-radius:6px;
                         padding:2px 10px;font-weight:900;font-size:13px;">
                {i.get('approved','—')}
            </span>
          </td>
        </tr>"""
        for i in approved_items
    ) if approved_items else ""

    approved_table = f"""
    <p style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;
              letter-spacing:.05em;margin:20px 0 8px;">✅ القطع المعتمدة</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #bbf7d0;border-radius:10px;overflow:hidden;margin-bottom:16px;">
      <thead><tr style="background:#dcfce7;">
        <th style="padding:10px 14px;text-align:right;color:#166534;
                   font-size:11px;font-weight:700;border-bottom:1px solid #bbf7d0;">اسم القطعة</th>
        <th style="padding:10px 14px;text-align:center;color:#166534;
                   font-size:11px;font-weight:700;border-bottom:1px solid #bbf7d0;">الكمية المطلوبة</th>
        <th style="padding:10px 14px;text-align:center;color:#166534;
                   font-size:11px;font-weight:700;border-bottom:1px solid #bbf7d0;">الكمية المعتمدة</th>
      </tr></thead>
      <tbody>{approved_rows}</tbody>
    </table>""" if approved_items else ""

    # ── جدول القطع المرفوضة ──────────────────────────────────────────────────
    rejected_rows = "".join(
        f"""<tr style="background:#fff5f5;">
          <td style="padding:10px 14px;border-bottom:1px solid #fecaca;
                     color:#991b1b;font-size:13px;">{i.get('name','')}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #fecaca;
                     color:#dc2626;font-size:13px;text-align:center;">{i.get('requested','—')}</td>
        </tr>"""
        for i in rejected_items
    ) if rejected_items else ""

    rejected_table = f"""
    <p style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;
              letter-spacing:.05em;margin:16px 0 8px;">❌ القطع غير المعتمدة</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fecaca;border-radius:10px;overflow:hidden;margin-bottom:16px;">
      <thead><tr style="background:#fef2f2;">
        <th style="padding:10px 14px;text-align:right;color:#991b1b;
                   font-size:11px;font-weight:700;border-bottom:1px solid #fecaca;">اسم القطعة</th>
        <th style="padding:10px 14px;text-align:center;color:#991b1b;
                   font-size:11px;font-weight:700;border-bottom:1px solid #fecaca;">الكمية المطلوبة</th>
      </tr></thead>
      <tbody>{rejected_rows}</tbody>
    </table>""" if rejected_items else ""

    # ── تعليق المشرف ────────────────────────────────────────────────────────
    comment_block = f"""
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;
                padding:14px 18px;margin:16px 0;">
        <p style="font-size:11px;font-weight:700;color:#92400e;
                  text-transform:uppercase;margin:0 0 6px;">💬 ملاحظة المشرف</p>
        <p style="color:#78350f;font-size:13px;margin:0;line-height:1.6;">{admin_comment}</p>
    </div>""" if admin_comment else ""

    # ── الحالة ──────────────────────────────────────────────────────────────
    if status == 'partial':
        status_badge = '<span style="background:#fef3c7;color:#92400e;border:1px solid #fcd34d;padding:4px 14px;border-radius:20px;font-weight:700;font-size:13px;">⚠️ موافقة جزئية</span>'
    else:
        status_badge = '<span style="background:#dcfce7;color:#166534;border:1px solid #86efac;padding:4px 14px;border-radius:20px;font-weight:700;font-size:13px;">✅ تم الاعتماد</span>'

    body = f"""
    <div style="border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:24px;
                display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
            <h2 style="color:#1d4ed8;margin:0;font-size:20px;font-weight:900;">
                🏫 سند العهدة رقم #{req_id}
            </h2>
            <p style="color:#64748b;margin:6px 0 0;font-size:12px;">
                صدر بتاريخ {today} الساعة {time_str}
            </p>
        </div>
        <div>{status_badge}</div>
    </div>

    <!-- بيانات الطالب -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td width="50%" style="padding-left:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;">
            <p style="font-size:10px;font-weight:700;color:#94a3b8;
                      text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">اسم الطالب</p>
            <p style="font-weight:700;color:#0f172a;font-size:15px;margin:0;">{student_name}</p>
          </div>
        </td>
        <td width="50%" style="padding-right:8px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;">
            <p style="font-size:10px;font-weight:700;color:#94a3b8;
                      text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">الرقم الأكاديمي</p>
            <p style="font-weight:700;color:#0f172a;font-size:15px;margin:0;font-family:monospace;">{student_id}</p>
          </div>
        </td>
      </tr>
      <tr><td colspan="2" style="padding-top:8px;">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;">
          <p style="font-size:10px;font-weight:700;color:#9a3412;
                    text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">تاريخ الإرجاع المتوقع</p>
          <p style="font-weight:700;color:#ea580c;font-size:16px;margin:0;">📅 {return_date}</p>
        </div>
      </td></tr>
    </table>

    {approved_table}
    {rejected_table}
    {comment_block}

    <!-- توقيع -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;
                margin-top:24px;border-top:1px dashed #cbd5e1;padding-top:20px;">
        <div style="text-align:center;">
            <p style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 30px;">توقيع المشرف</p>
            <p style="border-top:1px solid #0f172a;padding-top:6px;
                      font-size:11px;color:#64748b;margin:0;">{admin_name or 'إدارة المعمل'}</p>
        </div>
        <div style="text-align:center;">
            <p style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 30px;">توقيع الطالب</p>
            <p style="border-top:1px solid #0f172a;padding-top:6px;
                      font-size:11px;color:#64748b;margin:0;">{student_name}</p>
        </div>
    </div>

    <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:20px;">
        يرجى الاحتفاظ بهذا السند وإبرازه عند إرجاع القطع للمعمل.
    </p>"""

    subject_map = {
        'approved': f"📄 سند العهدة #{req_id} — تمت الموافقة على طلبك",
        'partial':  f"📄 سند العهدة #{req_id} — موافقة جزئية على طلبك",
    }
    return _send_email(
        to_email,
        subject_map.get(status, f"📄 سند العهدة #{req_id}"),
        _build_html(f"سند العهدة #{req_id}", body),
        attachments=attachments,
    )


# ──────────────────────────────────────────────
# 📝 6. Custom admin email
# ──────────────────────────────────────────────

# ──────────────────────────────────────────────
# 📦 7. Item Request status notification
# ──────────────────────────────────────────────

def send_item_request_status(
    to_email: str,
    student_name: str,
    item_name: str,
    quantity: int,
    status: str,
    admin_comment: str = '',
) -> dict:
    """Notify student about their item request status change."""
    status_map = {
        'approved':  {'label': 'تمت الموافقة ✅', 'color': '#059669', 'bg': '#ecfdf5', 'icon': '✅'},
        'rejected':  {'label': 'تم الرفض ❌',     'color': '#dc2626', 'bg': '#fef2f2', 'icon': '❌'},
        'purchased': {'label': 'تم الشراء 🛒',    'color': '#2563eb', 'bg': '#eff6ff', 'icon': '🛒'},
        'pending':   {'label': 'قيد المراجعة ⏳',  'color': '#d97706', 'bg': '#fffbeb', 'icon': '⏳'},
    }
    info = status_map.get(status, status_map['pending'])

    comment_block = ''
    if admin_comment:
        comment_block = f"""
        <div style="margin-top:20px;padding:16px;background:#fffbeb;
                    border-right:4px solid #f59e0b;border-radius:8px;">
            <p style="margin:0;font-weight:700;color:#92400e;font-size:13px;">
                💬 تعليق المشرف:
            </p>
            <p style="margin:8px 0 0;color:#78350f;font-size:14px;">
                {admin_comment}
            </p>
        </div>"""

    purchased_note = ''
    if status == 'purchased':
        purchased_note = """
        <div style="margin-top:16px;padding:14px;background:#eff6ff;
                    border-radius:8px;border:1px solid #bfdbfe;">
            <p style="margin:0;color:#1e40af;font-size:13px;font-weight:600;">
                📦 تم شراء القطعة وإضافتها للمخزون — يمكنك الآن طلب استعارتها من الكتالوج!
            </p>
        </div>"""

    body = f"""
    <h2 style="color:#1e293b;margin:0 0 6px;font-size:20px;">
        مرحباً {student_name} 👋
    </h2>
    <p style="color:#64748b;margin:0 0 24px;font-size:15px;">
        تم تحديث حالة طلبك للقطعة التالية:
    </p>

    <div style="background:{info['bg']};border:1px solid {info['color']}30;
                border-radius:12px;padding:20px;margin-bottom:20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:8px 0;font-weight:700;color:#475569;width:120px;">القطعة:</td>
                <td style="padding:8px 0;font-weight:700;color:#1e293b;font-size:16px;">{item_name}</td>
            </tr>
            <tr>
                <td style="padding:8px 0;font-weight:700;color:#475569;">الكمية:</td>
                <td style="padding:8px 0;color:#1e293b;">{quantity}</td>
            </tr>
            <tr>
                <td style="padding:8px 0;font-weight:700;color:#475569;">الحالة:</td>
                <td style="padding:8px 0;">
                    <span style="display:inline-block;padding:6px 16px;
                                 background:{info['color']};color:white;
                                 border-radius:20px;font-weight:700;font-size:13px;">
                        {info['label']}
                    </span>
                </td>
            </tr>
        </table>
    </div>

    {comment_block}
    {purchased_note}
    """

    subject = f"{info['icon']} تحديث طلب القطعة: {item_name}"
    return _send_email(to_email, subject, _build_html(subject, body))


def send_custom_email(to_email: str, subject: str, body_text: str, recipient_name: str = '') -> dict:
    """Send a freeform admin email to any user."""
    greeting = f'<h2 style="color:#1a1a2e;margin:0 0 14px;font-size:20px;">مرحباً {recipient_name}،</h2>' if recipient_name else ''
    body_html = f"""
    {greeting}
    <div style="font-size:14px;color:#1e293b;line-height:1.8;white-space:pre-wrap;
                background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                padding:18px 22px;">{body_text}</div>
    <div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;">
        <p style="color:#64748b;font-size:12px;margin:0;line-height:1.7;">
            مع التحية،<br>
            <strong style="color:#1a1a2e;">إدارة معمل أكاديمية طويق</strong>
        </p>
    </div>"""
    return _send_email(to_email, subject, _build_html(subject, body_html))


# ──────────────────────────────────────────────
# ✅ 8. Account approved / activated
# ──────────────────────────────────────────────

def send_account_approved(
    to_email: str,
    student_name: str,
    academic_id: str,
    batch_name: str = '',
    role_label: str = 'طالب',
    attachments: list | None = None,
) -> dict:
    """
    Notify the user that their registration was approved and their
    account is now active — includes the academic / university ID
    they will use to sign in.
    """
    batch_block = f"""
    <tr>
        <td style="padding:10px 0;color:#64748b;font-size:13px;width:140px;">الدفعة:</td>
        <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;">{batch_name}</td>
    </tr>""" if batch_name else ""

    body = f"""
    <h2 style="color:#15803d;margin:0 0 6px;font-size:22px;font-weight:700;">
        مرحباً بك في أكاديمية طويق، {student_name}
    </h2>
    <p style="color:#64748b;margin:0 0 22px;font-size:14px;line-height:1.7;">
        يسعدنا إبلاغك بأنه قد تمت الموافقة على طلب تسجيلك، وأصبح حسابك جاهزاً للاستخدام.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;
                padding:22px 24px;margin-bottom:22px;">
        <p style="color:#166534;margin:0 0 16px;font-size:13px;font-weight:700;
                  text-transform:uppercase;letter-spacing:.06em;">
            تفاصيل الحساب
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:10px 0;color:#64748b;font-size:13px;width:140px;">الاسم:</td>
                <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;">{student_name}</td>
            </tr>
            <tr>
                <td style="padding:10px 0;color:#64748b;font-size:13px;">الصفة:</td>
                <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;">{role_label}</td>
            </tr>
            {batch_block}
            <tr>
                <td style="padding:10px 0;color:#64748b;font-size:13px;">الرقم الأكاديمي:</td>
                <td style="padding:10px 0;">
                    <span style="display:inline-block;background:#1a1a2e;color:#fff;
                                 padding:6px 16px;border-radius:8px;font-size:15px;
                                 font-weight:700;letter-spacing:2px;font-family:monospace;">
                        {academic_id}
                    </span>
                </td>
            </tr>
        </table>
    </div>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;
                padding:16px 20px;margin-bottom:18px;">
        <p style="color:#1e40af;margin:0 0 6px;font-size:13px;font-weight:700;">
            تسجيل الدخول
        </p>
        <p style="color:#1e3a8a;margin:0;font-size:13px;line-height:1.7;">
            استخدم <strong>الرقم الأكاديمي</strong> أعلاه مع كلمة المرور التي أنشأتها عند التسجيل للدخول إلى النظام.
        </p>
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                padding:14px 18px;">
        <p style="color:#9a3412;margin:0;font-size:12.5px;line-height:1.7;">
            للحفاظ على أمان حسابك، يُنصح بعدم مشاركة رقمك الأكاديمي أو كلمة المرور مع أي شخص آخر.
        </p>
    </div>"""

    return _send_email(
        to_email,
        f"تم تفعيل حسابك في نظام المعمل — رقمك الأكاديمي {academic_id}",
        _build_html("تفعيل الحساب", body),
        attachments=attachments,
    )


# ──────────────────────────────────────────────
# ♻️ 9. Loan return confirmation
# ──────────────────────────────────────────────

def send_return_confirmation(
    to_email: str,
    student_name: str,
    item_name: str,
    quantity: int,
    condition: str = 'good',
    admin_name: str = '',
    attachments: list | None = None,
) -> dict:
    """Confirm that a borrowed item has been returned."""
    if condition == 'damaged':
        banner = """
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;
                    padding:16px 20px;margin-bottom:18px;">
            <p style="color:#92400e;margin:0;font-size:14px;font-weight:600;">
                تم استلام القطعة وتحويلها إلى قسم الصيانة لفحص الحالة.
            </p>
        </div>"""
        subject_suffix = '— تم الاستلام للصيانة'
    else:
        banner = """
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                    padding:16px 20px;margin-bottom:18px;">
            <p style="color:#15803d;margin:0;font-size:14px;font-weight:600;">
                تم استلام القطعة بحالة سليمة وإعادتها إلى المخزون.
            </p>
        </div>"""
        subject_suffix = '— تم الإرجاع بنجاح'

    admin_row = f"""
    <tr>
        <td style="padding:10px 0;color:#64748b;font-size:13px;">تم الاستلام من قِبَل:</td>
        <td style="padding:10px 0;color:#0f172a;font-size:13px;font-weight:600;">{admin_name}</td>
    </tr>""" if admin_name else ""

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {student_name}،</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;line-height:1.7;">
        نؤكد لك أنه قد تم استلام القطعة المستعارة بتاريخ
        <strong>{datetime.now().strftime('%Y-%m-%d')}</strong>.
    </p>
    {banner}
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px 20px;">
        <tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;width:160px;">اسم القطعة:</td>
            <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:700;">{item_name}</td>
        </tr>
        <tr>
            <td style="padding:10px 0;color:#64748b;font-size:13px;">الكمية:</td>
            <td style="padding:10px 0;color:#0f172a;font-size:14px;font-weight:600;">{quantity}</td>
        </tr>
        {admin_row}
    </table>
    <p style="color:#64748b;font-size:12.5px;line-height:1.7;margin:20px 0 0;">
        شكراً لالتزامك بإرجاع العهدة في وقتها. يسعدنا خدمتك في أي وقت.
    </p>"""

    return _send_email(
        to_email,
        f"تأكيد إرجاع قطعة: {item_name} {subject_suffix}",
        _build_html("تأكيد الإرجاع", body),
        attachments=attachments,
    )


# ──────────────────────────────────────────────
# 📦 10. Box loan receipt
# ──────────────────────────────────────────────

def send_box_loan_receipt(
    to_email: str,
    student_name: str,
    student_id: str,
    box_name: str,
    instance_code: str,
    expected_return_date: str,
    admin_name: str = '',
    attachments: list | None = None,
) -> dict:
    """Confirm that a box/kit has been checked out to the student."""
    today = datetime.now().strftime('%Y-%m-%d %H:%M')
    admin_row = f"""
    <tr>
        <td style="padding:8px 0;color:#64748b;font-size:13px;">المشرف المُسلِّم:</td>
        <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{admin_name}</td>
    </tr>""" if admin_name else ""

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {student_name}،</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;line-height:1.7;">
        نؤكد لك أنه قد تم تسليمك الصندوق التالي كعهدة مؤقتة، ويُرجى الحفاظ عليه وإعادته في الموعد المحدد.
    </p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;
                padding:20px 24px;margin-bottom:18px;">
        <p style="color:#1e40af;margin:0 0 14px;font-size:13px;font-weight:700;
                  text-transform:uppercase;letter-spacing:.06em;">تفاصيل العهدة</p>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;width:160px;">اسم الصندوق:</td>
                <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;">{box_name}</td>
            </tr>
            <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">رمز النسخة:</td>
                <td style="padding:8px 0;">
                    <span style="background:#1a1a2e;color:#fff;padding:4px 12px;
                                 border-radius:6px;font-family:monospace;font-size:13px;
                                 letter-spacing:1px;">{instance_code}</span>
                </td>
            </tr>
            <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">الرقم الأكاديمي:</td>
                <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;font-family:monospace;">{student_id}</td>
            </tr>
            <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">تاريخ التسليم:</td>
                <td style="padding:8px 0;color:#0f172a;font-size:13px;">{today}</td>
            </tr>
            {admin_row}
        </table>
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                padding:14px 20px;margin-bottom:16px;">
        <p style="color:#9a3412;margin:0;font-size:13.5px;font-weight:700;">
            تاريخ الإرجاع المتوقع: <strong style="color:#ea580c;">{expected_return_date}</strong>
        </p>
    </div>

    <p style="color:#64748b;font-size:12.5px;line-height:1.7;margin:0;">
        يُرجى الاحتفاظ بهذه الرسالة كمرجع، وإبراز رمز النسخة عند الإرجاع.
        التأخر عن موعد الإرجاع قد يؤثر على صلاحيات الاستعارة المستقبلية.
    </p>"""

    return _send_email(
        to_email,
        f"تأكيد استلام صندوق: {box_name} ({instance_code})",
        _build_html("سند عهدة صندوق", body),
        attachments=attachments,
    )


# ──────────────────────────────────────────────
# ♻️ 11. Box return confirmation
# ──────────────────────────────────────────────

def send_box_return_confirmation(
    to_email: str,
    student_name: str,
    box_name: str,
    instance_code: str,
    condition: str = 'good',
    admin_name: str = '',
    notes: str = '',
    attachments: list | None = None,
) -> dict:
    """Confirm that a box/kit has been returned."""
    today = datetime.now().strftime('%Y-%m-%d %H:%M')
    if condition == 'damaged':
        banner_bg, banner_border, banner_text = '#fffbeb', '#fcd34d', '#92400e'
        banner_msg = 'تم استلام الصندوق وتحويله إلى الصيانة للفحص.'
    else:
        banner_bg, banner_border, banner_text = '#f0fdf4', '#bbf7d0', '#15803d'
        banner_msg = 'تم استلام الصندوق بحالة جيدة وإغلاق العهدة.'

    notes_block = f"""
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                padding:14px 18px;margin-top:14px;">
        <p style="color:#64748b;font-size:12px;font-weight:700;margin:0 0 6px;
                  text-transform:uppercase;letter-spacing:.05em;">ملاحظات المشرف</p>
        <p style="color:#334155;font-size:13px;margin:0;line-height:1.7;">{notes}</p>
    </div>""" if notes else ""

    admin_row = f"""
    <tr>
        <td style="padding:8px 0;color:#64748b;font-size:13px;">استلمه:</td>
        <td style="padding:8px 0;color:#0f172a;font-size:13px;font-weight:600;">{admin_name}</td>
    </tr>""" if admin_name else ""

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {student_name}،</h2>
    <p style="color:#64748b;margin:0 0 18px;font-size:14px;line-height:1.7;">
        تم تسجيل إرجاع الصندوق بنجاح في النظام.
    </p>
    <div style="background:{banner_bg};border:1px solid {banner_border};border-radius:10px;
                padding:14px 20px;margin-bottom:18px;">
        <p style="color:{banner_text};margin:0;font-size:14px;font-weight:600;">{banner_msg}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px 20px;">
        <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;width:160px;">اسم الصندوق:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:700;">{box_name}</td>
        </tr>
        <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;">رمز النسخة:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;font-family:monospace;">{instance_code}</td>
        </tr>
        <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;">تاريخ الإرجاع:</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;">{today}</td>
        </tr>
        {admin_row}
    </table>
    {notes_block}
    <p style="color:#64748b;font-size:12.5px;line-height:1.7;margin:18px 0 0;">
        شكراً لالتزامك. نتمنى لك التوفيق في مشاريعك القادمة.
    </p>"""

    return _send_email(
        to_email,
        f"تأكيد إرجاع صندوق: {box_name} ({instance_code})",
        _build_html("تأكيد إرجاع الصندوق", body),
        attachments=attachments,
    )


# ──────────────────────────────────────────────
# ❌ 12. Registration rejected
# ──────────────────────────────────────────────

def send_registration_rejected(
    to_email: str,
    student_name: str,
    reason: str = '',
) -> dict:
    """Notify the applicant that their registration was rejected."""
    reason_block = f"""
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;
                padding:14px 20px;margin:16px 0;">
        <p style="color:#9a3412;font-size:12px;font-weight:700;margin:0 0 6px;
                  text-transform:uppercase;letter-spacing:.05em;">سبب الرفض</p>
        <p style="color:#7c2d12;font-size:13.5px;line-height:1.7;margin:0;">{reason}</p>
    </div>""" if reason else ""

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {student_name}،</h2>
    <p style="color:#64748b;margin:0 0 18px;font-size:14px;line-height:1.7;">
        نشكر لك اهتمامك بالتسجيل في نظام معمل أكاديمية طويق. بعد مراجعة طلبك،
        نأسف لإبلاغك بأنه تعذّر قبول الطلب في الوقت الحالي.
    </p>
    {reason_block}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
                padding:14px 20px;margin-top:16px;">
        <p style="color:#334155;font-size:13px;line-height:1.7;margin:0;">
            إذا كنت تعتقد أن هناك خطأً، يمكنك التواصل مع مشرف المعمل لمراجعة الطلب
            أو إعادة تقديمه بعد تحديث بياناتك.
        </p>
    </div>
    <p style="color:#94a3b8;font-size:12px;line-height:1.7;margin:20px 0 0;">
        نتمنى لك التوفيق، ونسعد بتواصلك معنا مستقبلاً.
    </p>"""

    return _send_email(
        to_email,
        "نتيجة طلب التسجيل — لم تتم الموافقة",
        _build_html("نتيجة طلب التسجيل", body),
    )


# ──────────────────────────────────────────────
# 🔐 13. Password changed confirmation
# ──────────────────────────────────────────────

def send_password_changed(
    to_email: str,
    student_name: str,
    method: str = 'otp',     # 'otp' | 'admin' | 'self'
) -> dict:
    """Security notice sent after a successful password change."""
    method_map = {
        'otp':   'إعادة تعيين عبر رمز التحقق (OTP)',
        'admin': 'تحديث من قبل مشرف المعمل',
        'self':  'تحديث من داخل الحساب',
    }
    method_label = method_map.get(method, method_map['otp'])
    when_str = datetime.now().strftime('%Y-%m-%d %H:%M')

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {student_name}،</h2>
    <p style="color:#64748b;margin:0 0 18px;font-size:14px;line-height:1.7;">
        نُعلمك بأنه قد تم تغيير كلمة المرور الخاصة بحسابك بنجاح.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                padding:16px 20px;margin-bottom:18px;">
        <p style="color:#15803d;font-size:14px;font-weight:600;margin:0 0 10px;">
            تم تحديث كلمة المرور
        </p>
        <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;width:130px;">التاريخ والوقت:</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;">{when_str}</td>
            </tr>
            <tr>
                <td style="padding:6px 0;color:#64748b;font-size:13px;">طريقة التغيير:</td>
                <td style="padding:6px 0;color:#0f172a;font-size:13px;">{method_label}</td>
            </tr>
        </table>
    </div>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;
                padding:14px 20px;">
        <p style="color:#991b1b;font-size:13px;font-weight:700;margin:0 0 6px;">
            لم تقم بهذا الإجراء؟
        </p>
        <p style="color:#7f1d1d;font-size:13px;line-height:1.7;margin:0;">
            تواصل مع مشرف المعمل فوراً لحماية حسابك واستعادة الدخول.
        </p>
    </div>"""

    return _send_email(
        to_email,
        "تم تغيير كلمة المرور — إشعار أمان",
        _build_html("تغيير كلمة المرور", body),
    )


# ──────────────────────────────────────────────
# 📊 14. Admin daily digest
# ──────────────────────────────────────────────

def send_admin_digest(
    to_email: str,
    admin_name: str,
    pending_registrations: int,
    pending_cart_requests: int,
    pending_item_requests: int,
    overdue_loans: list,        # [{'student_name':..., 'item_name':..., 'days_overdue':...}, ...]
    low_stock_items: list,      # [{'name':..., 'quantity':...}, ...]
) -> dict:
    """Daily summary for the lab admin."""
    today_str = datetime.now().strftime('%Y-%m-%d')

    def _stat_card(label, value, color):
        return f"""
        <td width="33%" style="padding:4px;" align="center">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 10px;">
            <p style="color:{color};font-size:26px;font-weight:800;margin:0;line-height:1;">{value}</p>
            <p style="color:#64748b;font-size:11px;margin:6px 0 0;font-weight:600;">{label}</p>
          </div>
        </td>"""

    overdue_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #fecaca;font-size:13px;color:#1e293b;">{o.get('student_name','—')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #fecaca;font-size:13px;color:#475569;">{o.get('item_name','—')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #fecaca;font-size:13px;color:#dc2626;text-align:center;font-weight:700;">{o.get('days_overdue','—')}</td>
        </tr>"""
        for o in overdue_loans[:10]
    )
    overdue_block = f"""
    <p style="font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;
              letter-spacing:.05em;margin:22px 0 8px;">العهد المتأخرة</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fecaca;border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#fef2f2;">
        <th style="padding:10px 12px;text-align:right;color:#991b1b;font-size:11px;font-weight:700;">الطالب</th>
        <th style="padding:10px 12px;text-align:right;color:#991b1b;font-size:11px;font-weight:700;">القطعة</th>
        <th style="padding:10px 12px;text-align:center;color:#991b1b;font-size:11px;font-weight:700;">أيام التأخير</th>
      </tr></thead>
      <tbody>{overdue_rows}</tbody>
    </table>""" if overdue_loans else ""

    low_stock_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #fde68a;font-size:13px;color:#1e293b;">{i.get('name','—')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #fde68a;font-size:13px;color:#b45309;text-align:center;font-weight:700;">{i.get('quantity','0')}</td>
        </tr>"""
        for i in low_stock_items[:10]
    )
    low_stock_block = f"""
    <p style="font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;
              letter-spacing:.05em;margin:22px 0 8px;">مخزون منخفض</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid #fde68a;border-radius:10px;overflow:hidden;">
      <thead><tr style="background:#fffbeb;">
        <th style="padding:10px 12px;text-align:right;color:#92400e;font-size:11px;font-weight:700;">القطعة</th>
        <th style="padding:10px 12px;text-align:center;color:#92400e;font-size:11px;font-weight:700;">الكمية المتبقية</th>
      </tr></thead>
      <tbody>{low_stock_rows}</tbody>
    </table>""" if low_stock_items else ""

    nothing_block = "" if (pending_registrations + pending_cart_requests + pending_item_requests
                           + len(overdue_loans) + len(low_stock_items)) > 0 else """
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                padding:18px 22px;text-align:center;margin-top:16px;">
        <p style="color:#15803d;font-size:14px;font-weight:700;margin:0;">
            لا توجد بنود تستوجب المراجعة اليوم. كل شيء على ما يرام.
        </p>
    </div>"""

    body = f"""
    <h2 style="color:#1a1a2e;margin:0 0 6px;font-size:20px;">مرحباً {admin_name}،</h2>
    <p style="color:#64748b;margin:0 0 20px;font-size:14px;line-height:1.7;">
        هذا هو ملخص نشاط المعمل ليوم <strong>{today_str}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        {_stat_card('طلبات تسجيل', pending_registrations, '#1d4ed8')}
        {_stat_card('طلبات استعارة', pending_cart_requests, '#ea580c')}
        {_stat_card('طلبات قطع جديدة', pending_item_requests, '#7c3aed')}
      </tr>
    </table>

    {overdue_block}
    {low_stock_block}
    {nothing_block}

    <p style="color:#94a3b8;font-size:12px;line-height:1.7;margin:24px 0 0;">
        يُرسَل هذا الملخص تلقائياً من نظام إدارة المعمل.
    </p>"""

    return _send_email(
        to_email,
        f"ملخص نشاط المعمل اليومي — {today_str}",
        _build_html("الملخص اليومي", body),
    )
