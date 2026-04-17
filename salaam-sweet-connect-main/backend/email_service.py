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

Public API (unchanged — all routes continue to work):
  from email_service import (
      send_registration_confirmation,
      send_otp_email,
      generate_otp,
      send_request_decision,
      send_overdue_reminder,
      send_custom_email,
  )
"""

import os
import random
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
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

def _send_email(to_email: str, subject: str, html_content: str) -> dict:
    """
    Send an email via Gmail SMTP (TLS).
    Returns {"success": True} or {"success": False, "error": "..."}.
    """
    if not _PASSWORD:
        msg = "EMAIL_PASSWORD is not set in .env — email not sent."
        print(f"⚠️  {msg}")
        return {"success": False, "error": msg}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{_SENDER_NAME} <{_SENDER}>"
        msg["To"]      = to_email
        msg.attach(MIMEText(html_content, "html", "utf-8"))

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


def send_custom_email(to_email: str, subject: str, body_text: str) -> dict:
    """Send a freeform admin email to any user."""
    body_html = f"""
    <div style="font-size:15px;color:#1e293b;line-height:1.8;white-space:pre-wrap;">
        {body_text}
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">
            تم إرسال هذه الرسالة من إدارة معمل أكاديمية طويق
        </p>
    </div>"""
    return _send_email(to_email, subject, _build_html(subject, body_html))
