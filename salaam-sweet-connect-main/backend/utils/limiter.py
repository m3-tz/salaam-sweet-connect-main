"""
Rate-limiter singleton — import this in app.py and any blueprint that
needs a stricter per-route limit.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri='memory://',
    # Default limits apply to every endpoint automatically
    default_limits=['200 per minute', '2000 per hour'],
    # Return JSON instead of HTML when limit is hit
    default_limits_exempt_when=lambda: False,
)
