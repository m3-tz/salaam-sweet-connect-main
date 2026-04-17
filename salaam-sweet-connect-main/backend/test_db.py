"""
test_db.py — Quick DB connection test
Run: python test_db.py
"""
import os
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

load_dotenv()

DB_CONFIG = {
    'host':     os.getenv('DB_HOST',     '127.0.0.1'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'user':     os.getenv('DB_USER',     'lab_user'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME',     'lab_db'),
}

TABLES_TO_CHECK = [
    'users', 'items', 'loans', 'camps',
    'camp_requests', 'camp_request_items',
    'cart_requests', 'cart_request_items',
    'registration_requests', 'storage_locations',
    'item_locations', 'audit_logs', 'batches',
    'categories', 'email_templates',
]

def separator(char='-', n=50):
    print(char * n)

def test_connection():
    separator('=')
    print("🔌  DB Connection Test")
    separator('=')
    print(f"  Host     : {DB_CONFIG['host']}")
    print(f"  Port     : {DB_CONFIG['port']}")
    print(f"  User     : {DB_CONFIG['user']}")
    print(f"  Database : {DB_CONFIG['database']}")
    separator()

    try:
        conn = mysql.connector.connect(**DB_CONFIG)

        if conn.is_connected():
            info = conn.get_server_info()
            print(f"✅  Connected!  MySQL server version: {info}")
        else:
            print("❌  connect() returned but is_connected() is False.")
            return

        cursor = conn.cursor()

        # Ping
        cursor.execute("SELECT 1")
        cursor.fetchone()
        print("✅  Ping (SELECT 1) OK")

        # Current DB
        cursor.execute("SELECT DATABASE()")
        db_name = cursor.fetchone()[0]
        print(f"✅  Active database: {db_name}")

        # Check expected tables
        separator()
        print("📋  Checking expected tables:")
        cursor.execute("SHOW TABLES")
        existing = {row[0] for row in cursor.fetchall()}

        all_ok = True
        for table in TABLES_TO_CHECK:
            found = table in existing
            status = "✅" if found else "❌ MISSING"
            print(f"   {status}  {table}")
            if not found:
                all_ok = False

        separator()
        extra = existing - set(TABLES_TO_CHECK)
        if extra:
            print(f"ℹ️   Extra tables in DB (not in checklist): {', '.join(sorted(extra))}")

        # Quick row counts for key tables
        separator()
        print("📊  Row counts (key tables):")
        for table in ['users', 'items', 'loans', 'audit_logs']:
            if table in existing:
                cursor.execute(f"SELECT COUNT(*) FROM `{table}`")
                count = cursor.fetchone()[0]
                print(f"   {table:25s}: {count} rows")

        cursor.close()
        conn.close()

        separator('=')
        if all_ok:
            print("🎉  All checks passed — DB is ready!")
        else:
            print("⚠️   Some tables are missing — check migrations.")
        separator('=')

    except Error as e:
        separator('=')
        print(f"❌  Connection FAILED: {e}")
        separator()
        print("💡  Common fixes:")
        print("   • Check DB_HOST / DB_PORT in .env")
        print("   • Verify MySQL is running")
        print("   • Confirm the user has access to the database")
        print("   • For remote hosts, check firewall rules")
        separator('=')

if __name__ == '__main__':
    test_connection()
