import mysql.connector
from config import DB_CONFIG


def get_db_connection():
    """Return a new MySQL connection using env-based config."""
    return mysql.connector.connect(**DB_CONFIG)
