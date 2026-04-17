"""
Database connection and initialization module.
Uses psycopg2 for raw SQL access to PostgreSQL.
"""

import psycopg2
from psycopg2 import sql

# ---------- Database Configuration ----------
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "pharmacy_db",
    "user": "postgres",
    "password": "asmit",
}


def get_connection():
    """
    Create and return a new database connection.
    The caller is responsible for closing the connection.
    """
    conn = psycopg2.connect(**DB_CONFIG)
    return conn


def init_db():
    """
    Initialize the database by creating all required tables
    and inserting the default admin user if not already present.
    """
    conn = get_connection()
    cur = conn.cursor()

    try:
        # ---------- Create admin table ----------
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL
            );
        """)

        # ---------- Create medicines table ----------
        cur.execute("""
            CREATE TABLE IF NOT EXISTS medicines (
                medicine_id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price NUMERIC(10, 2) NOT NULL,
                quantity INTEGER NOT NULL,
                expiry_date DATE NOT NULL
            );
        """)

        # ---------- Create sales table ----------
        # Foreign key references medicines(medicine_id)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                sale_id SERIAL PRIMARY KEY,
                medicine_id INTEGER REFERENCES medicines(medicine_id),
                quantity_sold INTEGER NOT NULL,
                total_price NUMERIC(10, 2) NOT NULL,
                sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # ---------- Insert default admin ----------
        # Only insert if no admin row exists yet
        cur.execute("SELECT COUNT(*) FROM admin;")
        count = cur.fetchone()[0]

        if count == 0:
            cur.execute(
                "INSERT INTO admin (username, password) VALUES (%s, %s);",
                ("admin", "admin123"),
            )

        conn.commit()
        print("[OK] Database initialized successfully.")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Error initializing database: {e}")
        raise

    finally:
        cur.close()
        conn.close()


# Run initialization when this module is imported or executed directly
if __name__ == "__main__":
    init_db()
