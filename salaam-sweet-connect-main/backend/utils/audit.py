from database import get_db_connection

# Ensures the ip_address column exists — runs only once per process.
_ip_col_ensured = False


def _ensure_ip_column(cursor, conn) -> None:
    global _ip_col_ensured
    if _ip_col_ensured:
        return
    try:
        cursor.execute(
            "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45) NULL DEFAULT NULL"
        )
        conn.commit()
    except Exception:
        pass
    _ip_col_ensured = True


def log_action(user_id: str, user_name: str, action: str, details: str,
               ip_address: str = None) -> None:
    """Persist an audit-trail entry to the audit_logs table."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        _ensure_ip_column(cursor, conn)
        cursor.execute(
            """
            INSERT INTO audit_logs (user_id, user_name, action, details, ip_address)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (user_id, user_name, action, details, ip_address),
        )
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as exc:
        print(f'Error logging action: {exc}')
