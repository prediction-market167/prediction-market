"""
Create (if needed) and promote a user to superuser.
Usage: python scripts/make_superuser.py [email] [password] [username]
Defaults to FIRST_SUPERUSER_* from .env / config.
"""
import sys
import os
import psycopg2
import bcrypt
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://").split("?")[0]
EMAIL    = sys.argv[1] if len(sys.argv) > 1 else settings.FIRST_SUPERUSER_EMAIL
PASSWORD = sys.argv[2] if len(sys.argv) > 2 else settings.FIRST_SUPERUSER_PASSWORD
USERNAME = sys.argv[3] if len(sys.argv) > 3 else EMAIL.split("@")[0]

u = urlparse(DATABASE_URL)
conn = psycopg2.connect(
    host=u.hostname, port=u.port or 5432,
    dbname=u.path.lstrip("/"), user=u.username, password=u.password,
)
conn.autocommit = True
cur = conn.cursor()

cur.execute("SELECT id, email, is_superuser FROM users WHERE email = %s", (EMAIL,))
row = cur.fetchone()

if not row:
    hashed = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt()).decode()
    cur.execute(
        "INSERT INTO users (email, username, hashed_password, is_active, is_superuser, balance) "
        "VALUES (%s, %s, %s, TRUE, TRUE, 1000.00) RETURNING id",
        (EMAIL, USERNAME, hashed),
    )
    user_id = cur.fetchone()[0]
    print(f"Created superuser '{EMAIL}' (id={user_id}) with password '{PASSWORD}'")
else:
    user_id, email, already_super = row
    if already_super:
        print(f"'{email}' (id={user_id}) is already a superuser — nothing changed.")
    else:
        cur.execute("UPDATE users SET is_superuser = TRUE WHERE id = %s", (user_id,))
        print(f"Promoted '{email}' (id={user_id}) to superuser.")

cur.close()
conn.close()
