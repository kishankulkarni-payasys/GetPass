"""One-off, idempotent migration: adds login/password-recovery columns to users.

`Base.metadata.create_all` (see app/main.py) only creates missing tables, not columns on an
existing table, so a live `users` table needs this ALTER instead.

Run once against the target PostgreSQL database from the Backend/ directory:
    python -m scripts.add_user_account_columns
Safe to re-run - every statement is guarded by an existence check. Prints column names only,
never row data.
"""
from sqlalchemy import text

from app.database import engine

COLUMNS_TO_ADD = [
    ("password_recoverable", "VARCHAR(255) NULL"),
    ("email", "VARCHAR(120) NULL"),
    ("contact_no", "VARCHAR(20) NULL"),
    ("password_reset_token", "VARCHAR(64) NULL"),
    ("password_reset_expires_at", "TIMESTAMP NULL"),
]
UNIQUE_CONSTRAINTS = [
    ("users_email_key", "email"),
    ("users_contact_no_key", "contact_no"),
    ("users_password_reset_token_key", "password_reset_token"),
]


def _column_exists(conn, table, column):
    row = conn.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    ).first()
    return row is not None


def _constraint_exists(conn, name):
    row = conn.execute(text("SELECT 1 FROM pg_constraint WHERE conname = :n"), {"n": name}).first()
    return row is not None


def run():
    with engine.begin() as conn:
        for column_name, column_def in COLUMNS_TO_ADD:
            if _column_exists(conn, "users", column_name):
                print(f"Column users.{column_name} already exists, skipping.")
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_def}"))
            print(f"Added column users.{column_name}.")

        for name, column in UNIQUE_CONSTRAINTS:
            if _constraint_exists(conn, name):
                print(f"Constraint {name} already exists, skipping.")
                continue
            conn.execute(text(f"ALTER TABLE users ADD CONSTRAINT {name} UNIQUE ({column})"))
            print(f"Added constraint {name}.")


if __name__ == "__main__":
    run()
