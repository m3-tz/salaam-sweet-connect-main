"""
Background scheduler for recurring jobs:
  - Daily admin digest email at 08:00 Riyadh time.
  - Auto-suspend students with too many overdue loans (optional hook).

Uses APScheduler's BackgroundScheduler so it runs inside the Flask process.
For production with multiple workers, prefer running a single scheduler worker
(e.g. `python -m backend.scheduler`) rather than starting inside gunicorn workers.
"""
import os
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler: BackgroundScheduler | None = None


def _run_daily_digest(app):
    """Send the admin digest to the lab's own EMAIL_SENDER address."""
    from email_service import send_admin_digest
    from database import get_db_connection

    lab_email = os.getenv('EMAIL_SENDER', '')
    if not lab_email:
        print('[scheduler] daily_digest: EMAIL_SENDER not configured — skipped')
        return

    try:
        with app.app_context():
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            def _count(sql):
                try:
                    cursor.execute(sql)
                    row = cursor.fetchone()
                    return int((row or {}).get('count') or 0)
                except Exception:
                    return 0

            pending_reg   = _count("SELECT COUNT(*) AS count FROM registration_requests WHERE status='pending'")
            pending_cart  = _count("SELECT COUNT(*) AS count FROM cart_requests WHERE status='pending'")
            pending_items = _count("SELECT COUNT(*) AS count FROM item_requests WHERE status='pending'")

            overdue_loans = []
            try:
                cursor.execute("""
                    SELECT u.name AS student_name, l.item_name,
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
                    LIMIT 20
                """)
                overdue_loans = cursor.fetchall() or []
            except Exception as e:
                print(f'[scheduler] overdue query skip: {e}')

            low_stock = []
            try:
                cursor.execute("SELECT name, quantity FROM items WHERE quantity <= 3 ORDER BY quantity ASC LIMIT 20")
                low_stock = cursor.fetchall() or []
            except Exception as e:
                print(f'[scheduler] low_stock query skip: {e}')

            cursor.close()
            conn.close()

            result = send_admin_digest(
                to_email              = lab_email,
                admin_name            = 'إدارة المعمل',
                pending_registrations = pending_reg,
                pending_cart_requests = pending_cart,
                pending_item_requests = pending_items,
                overdue_loans         = overdue_loans,
                low_stock_items       = low_stock,
            )
            print(f'[scheduler] daily_digest → {lab_email} | {result}')
    except Exception as exc:
        print(f'[scheduler] daily_digest error: {exc}')


def _run_auto_suspend(app):
    """Auto-disable can_borrow for students with ≥ N overdue loans."""
    from database import get_db_connection

    threshold = int(os.getenv('AUTO_SUSPEND_OVERDUE_THRESHOLD', '3'))
    try:
        with app.app_context():
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT university_id, COUNT(*) AS overdue_count
                FROM loans
                WHERE status IN ('نشط','متأخر')
                  AND expected_return_date IS NOT NULL
                  AND COALESCE(
                        STR_TO_DATE(expected_return_date,'%Y-%m-%d'),
                        STR_TO_DATE(expected_return_date,'%Y/%m/%d'),
                        STR_TO_DATE(expected_return_date,'%d-%m-%Y'),
                        STR_TO_DATE(expected_return_date,'%d/%m/%Y')
                      ) < CURDATE()
                GROUP BY university_id
                HAVING overdue_count >= %s
            """, (threshold,))
            offenders = cursor.fetchall() or []

            suspended = 0
            for row in offenders:
                try:
                    cursor.execute(
                        "UPDATE users SET can_borrow=0 WHERE universityId=%s AND (can_borrow IS NULL OR can_borrow=1)",
                        (row['university_id'],),
                    )
                    if cursor.rowcount > 0:
                        suspended += 1
                except Exception as e:
                    print(f'[scheduler] suspend {row.get("university_id")} skip: {e}')

            conn.commit()
            cursor.close()
            conn.close()
            if suspended:
                print(f'[scheduler] auto_suspend: disabled borrowing for {suspended} students')
    except Exception as exc:
        print(f'[scheduler] auto_suspend error: {exc}')


def start_scheduler(app):
    """Call once from create_app()."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    tz = os.getenv('SCHEDULER_TZ', 'Asia/Riyadh')
    digest_hour = int(os.getenv('DIGEST_HOUR', '8'))
    digest_minute = int(os.getenv('DIGEST_MINUTE', '0'))

    sched = BackgroundScheduler(timezone=tz)
    sched.add_job(
        _run_daily_digest, CronTrigger(hour=digest_hour, minute=digest_minute),
        args=[app], id='daily_digest', replace_existing=True,
    )
    sched.add_job(
        _run_auto_suspend, CronTrigger(hour=3, minute=0),  # every night at 3 AM
        args=[app], id='auto_suspend', replace_existing=True,
    )
    sched.start()
    _scheduler = sched
    print(f'[scheduler] started | digest daily at {digest_hour:02d}:{digest_minute:02d} ({tz})')
    return sched
