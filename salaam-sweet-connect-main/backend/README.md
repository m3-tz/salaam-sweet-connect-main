# Innovation Lab – Backend API

## Project Structure

```
lab_backend/
├── app.py                  # Flask app factory + blueprint registration
├── config.py               # DB config loaded from .env
├── database.py             # DB connection helper
├── .env                    # Environment variables (never commit)
├── requirements.txt
│
├── routes/
│   ├── auth.py             # Login, register, OTP, password reset
│   ├── users.py            # CRUD users, ban/unban
│   ├── items.py            # Inventory items + low-stock + image proxy
│   ├── loans.py            # Loans (checkout/return) + maintenance
│   ├── camps.py            # Camp requests
│   ├── requests.py         # Registration & cart requests + student portal
│   ├── locations.py        # Storage locations (WMS)
│   ├── batches.py          # Batch / cohort management
│   └── admin.py            # Stats, audit logs, CSV export, emails, migrations
│
└── utils/
    ├── helpers.py          # Password hashing, sanitize_text, get_admin_info, image fetch
    ├── audit.py            # log_action() writes to audit_logs table
    └── academic.py         # Sequential academic ID generator
```

## Quick Start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your DB credentials
python app.py
```

## Environment Variables

| Variable      | Default        | Description             |
|---------------|----------------|-------------------------|
| DB_HOST       | 127.0.0.1      | MySQL host              |
| DB_PORT       | 3306           | MySQL port              |
| DB_USER       | lab_user       | MySQL username          |
| DB_PASSWORD   |                | MySQL password          |
| DB_NAME       | lab_db         | MySQL database name     |

## Design Decisions

- **Blueprint per domain** – Each feature area (auth, users, items …) is a separate
  Blueprint file. Adding a new feature = add a new file, register it in `app.py`.
- **No hardcoded credentials** – All DB settings come from `.env` via `config.py`.
- **Shared utilities** – Password hashing, text sanitisation and `get_admin_info()`
  live in `utils/helpers.py` and are imported wherever needed.
- **Audit trail** – `log_action()` is the single entry-point for all audit writes.
- **email_service.py** – Kept as-is (external file). Import from it wherever needed.
