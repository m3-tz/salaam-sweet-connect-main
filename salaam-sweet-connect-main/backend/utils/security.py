"""
Brute-force protection and IP utilities.

Tracks failed login attempts per IP address in memory.
After MAX_ATTEMPTS failures within WINDOW_DURATION, the IP is
blocked for BLOCK_DURATION.  All state is in-process only —
restarts clear it, which is fine for this use case.
"""
from datetime import datetime, timedelta

from flask import request

MAX_ATTEMPTS    = 5
WINDOW_DURATION = timedelta(minutes=15)

# الحجب دائم — لا يُفَك إلا بتدخل الإدارة يدوياً
_PERMANENT = datetime(9999, 12, 31, 23, 59, 59)

# { ip: {"count": int, "first_attempt": datetime, "blocked_until": datetime|None} }
_failed_attempts: dict = {}


def get_client_ip() -> str:
    """Return the real client IP, respecting X-Forwarded-For if present."""
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def is_blocked(ip: str) -> tuple:
    """Return (blocked: bool, seconds_remaining: int  -1=دائم)."""
    record = _failed_attempts.get(ip)
    if not record:
        return False, 0
    blocked_until = record.get('blocked_until')
    if not blocked_until:
        return False, 0
    if blocked_until >= _PERMANENT:
        return True, -1   # -1 يعني دائم
    if datetime.now() < blocked_until:
        remaining = int((blocked_until - datetime.now()).total_seconds())
        return True, remaining
    return False, 0


def record_failed_attempt(ip: str) -> bool:
    """
    Record one failed login from this IP.
    Returns True if this attempt triggered a block.
    """
    now    = datetime.now()
    record = _failed_attempts.get(ip, {'count': 0, 'first_attempt': now, 'blocked_until': None})

    # Reset window counter if previous window expired
    if now - record['first_attempt'] > WINDOW_DURATION:
        record = {'count': 0, 'first_attempt': now, 'blocked_until': None}

    record['count'] += 1
    just_blocked = False

    if record['count'] >= MAX_ATTEMPTS:
        record['blocked_until'] = _PERMANENT  # دائم — يفكه الأدمن فقط
        just_blocked = True

    _failed_attempts[ip] = record
    return just_blocked


def reset_attempts(ip: str) -> None:
    """Clear the failed-attempt counter for an IP after a successful login."""
    _failed_attempts.pop(ip, None)


def get_blocked_ips() -> list:
    """Return a list of currently-blocked IPs with metadata."""
    now    = datetime.now()
    result = []
    for ip, record in list(_failed_attempts.items()):
        blocked_until = record.get('blocked_until')
        if not blocked_until:
            continue
        is_permanent = blocked_until >= _PERMANENT
        if is_permanent or now < blocked_until:
            result.append({
                'ip':                ip,
                'attempts':          record['count'],
                'permanent':         is_permanent,
                'blocked_until':     None if is_permanent else blocked_until.isoformat(),
                'seconds_remaining': -1 if is_permanent else int((blocked_until - now).total_seconds()),
            })
    return result


def get_all_failed() -> list:
    """Return all IPs that have recorded failures (blocked or not)."""
    now    = datetime.now()
    result = []
    for ip, record in list(_failed_attempts.items()):
        blocked_until = record.get('blocked_until')
        is_permanent  = bool(blocked_until and blocked_until >= _PERMANENT)
        is_blocked_now = is_permanent or bool(blocked_until and now < blocked_until)
        result.append({
            'ip':            ip,
            'attempts':      record['count'],
            'first_attempt': record['first_attempt'].isoformat(),
            'is_blocked':    is_blocked_now,
            'permanent':     is_permanent,
            'blocked_until': None if is_permanent else (blocked_until.isoformat() if blocked_until else None),
        })
    return result


def get_attempt_count(ip: str) -> int:
    """Return the number of failed attempts recorded for this IP."""
    return _failed_attempts.get(ip, {}).get('count', 0)


def unblock_ip(ip: str) -> bool:
    """Manually unblock an IP. Returns True if the IP was found."""
    if ip in _failed_attempts:
        del _failed_attempts[ip]
        return True
    return False
