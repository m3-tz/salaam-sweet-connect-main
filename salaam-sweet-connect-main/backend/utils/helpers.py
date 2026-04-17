import urllib.parse
import base64
import requests as _requests
from flask import request
from werkzeug.security import generate_password_hash, check_password_hash


# ──────────────────────────────────────────────
# Password helpers
# ──────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return generate_password_hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Support both legacy plain-text passwords and hashed ones."""
    if hashed.startswith(('pbkdf2:', 'scrypt:')):
        return check_password_hash(hashed, plain)
    return plain == hashed


# ──────────────────────────────────────────────
# Text sanitisation
# ──────────────────────────────────────────────

def sanitize_text(value: str) -> str:
    """Strip whitespace and stray CR/LF characters from a string."""
    if value is None:
        return value
    return str(value).strip().replace('\r', '').replace('\n', '')


# ──────────────────────────────────────────────
# Request context helpers
# ──────────────────────────────────────────────

def get_admin_info():
    """
    Extract admin/engineer identity from request headers or JSON body.
    Returns (admin_id, admin_name).
    """
    data = request.get_json(silent=True) or {}

    admin_id       = request.headers.get('admin-id')
    admin_name_raw = request.headers.get('admin-name')

    if not admin_id:
        admin_id = data.get('adminId', 'Unknown')

    admin_name = (
        urllib.parse.unquote(admin_name_raw)
        if admin_name_raw
        else data.get('adminName', 'مدير النظام')
    )

    admin_id   = sanitize_text(str(admin_id))   if admin_id   else 'Unknown'
    admin_name = sanitize_text(str(admin_name)) if admin_name else 'مدير النظام'

    return admin_id, admin_name


# ──────────────────────────────────────────────
# Image helpers
# ──────────────────────────────────────────────

def process_image_url(url_or_data: str) -> str:
    """Fetch a remote image and return it as a base64 data URI."""
    if not url_or_data or not url_or_data.startswith('http'):
        return url_or_data
    try:
        resp = _requests.get(url_or_data, timeout=5, headers={'User-Agent': 'Mozilla/5.0'})
        if resp.status_code == 200:
            encoded = base64.b64encode(resp.content).decode('utf-8')
            return f'data:image/jpeg;base64,{encoded}'
    except Exception as exc:
        print(f'Error fetching image: {exc}')
    return url_or_data
