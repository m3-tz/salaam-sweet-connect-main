import os
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

from routes.auth          import auth_bp
from routes.users         import users_bp
from routes.items         import items_bp
from routes.loans         import loans_bp
from routes.camps         import camps_bp
from routes.requests      import requests_bp
from routes.locations     import locations_bp
from routes.batches       import batches_bp
from routes.admin         import admin_bp
from routes.permissions   import permissions_bp
from routes.item_requests import item_requests_bp

# الـ origins المسموح بها — عدّلها لتطابق نطاقك الفعلي في الإنتاج
_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ORIGINS',
    'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173'
).split(',')


def create_app() -> Flask:
    app = Flask(__name__)

    # ── حجم الطلب الأقصى: 2 MB ────────────────────────────────────────────
    app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024

    # ── CORS: فقط origins المعروفة ────────────────────────────────────────
    CORS(app, resources={r'/api/*': {
        'origins':       _ALLOWED_ORIGINS,
        'methods':       ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'allow_headers': ['Content-Type', 'admin-id', 'admin-name',
                          'Authorization', 'user-role'],
        'supports_credentials': False,
    }})

    # ── Security Headers على كل استجابة ────────────────────────────────────
    @app.after_request
    def set_security_headers(response):
        # منع تخمين نوع المحتوى
        response.headers['X-Content-Type-Options']    = 'nosniff'
        # منع تضمين الصفحة في iframe
        response.headers['X-Frame-Options']           = 'DENY'
        # فلتر XSS في المتصفحات القديمة
        response.headers['X-XSS-Protection']          = '1; mode=block'
        # منع إرسال Referrer لمواقع خارجية
        response.headers['Referrer-Policy']           = 'strict-origin-when-cross-origin'
        # منع تحميل الموارد من مصادر غير موثوقة
        response.headers['Content-Security-Policy']   = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self';"
        )
        # إخفاء معلومات السيرفر
        response.headers.pop('Server', None)
        response.headers.pop('X-Powered-By', None)
        return response

    # ── OPTIONS preflight ────────────────────────────────────────────────
    @app.before_request
    def handle_options():
        if request.method == 'OPTIONS':
            origin = request.headers.get('Origin', '')
            resp   = Response()
            if origin in _ALLOWED_ORIGINS:
                resp.headers['Access-Control-Allow-Origin']  = origin
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            resp.headers['Access-Control-Allow-Headers'] = (
                'Content-Type, admin-id, admin-name, Authorization, user-role'
            )
            resp.headers['Access-Control-Max-Age'] = '600'
            return resp, 200

    # ── خطأ حجم الطلب ─────────────────────────────────────────────────────
    @app.errorhandler(413)
    def request_too_large(_):
        return jsonify({'status': 'error', 'message': 'حجم الطلب أكبر من المسموح (2 MB)'}), 413

    # ── Register blueprints ───────────────────────────────────────────────
    for bp in (auth_bp, users_bp, items_bp, loans_bp, camps_bp,
               requests_bp, locations_bp, batches_bp, admin_bp,
               permissions_bp, item_requests_bp):
        app.register_blueprint(bp)

    @app.route('/')
    def home():
        return 'Innovation Lab Backend is Running'

    return app


if __name__ == '__main__':
    create_app().run(debug=False, host='0.0.0.0', port=5000)
