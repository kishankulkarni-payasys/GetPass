"""One-off, idempotent migration: adds weighbridge columns to vehicle_entries.

Run once against the target database from the Backend/ directory:
    python -m scripts.migrate_weighbridge
Safe to re-run - every statement is guarded by an existence check.
"""
from sqlalchemy import text

from app.database import engine

COLUMNS_TO_ADD = [
    ("gross_weight", "NUMERIC(10,2) NULL"),
    ("weight_unit", "VARCHAR(20) NULL"),
    ("weighed_at", "DATETIME NULL"),
    ("weighed_by_id", "INT NULL"),
]

FK_NAME = "FK_vehicle_entries_weighed_by_id"


def _column_exists(conn, table, column):
    row = conn.execute(
        text(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_NAME = :table AND COLUMN_NAME = :column"
        ),
        {"table": table, "column": column},
    ).first()
    return row is not None


def _fk_exists(conn, fk_name):
    row = conn.execute(
        text("SELECT 1 FROM sys.foreign_keys WHERE name = :name"),
        {"name": fk_name},
    ).first()
    return row is not None


def run():
    with engine.begin() as conn:
        for column_name, column_def in COLUMNS_TO_ADD:
            if _column_exists(conn, "vehicle_entries", column_name):
                print(f"Column {column_name} already exists, skipping.")
                continue
            conn.execute(text(f"ALTER TABLE vehicle_entries ADD {column_name} {column_def}"))
            print(f"Added column {column_name}.")

        if _fk_exists(conn, FK_NAME):
            print(f"Constraint {FK_NAME} already exists, skipping.")
        else:
            conn.execute(
                text(
                    f"ALTER TABLE vehicle_entries ADD CONSTRAINT {FK_NAME} "
                    "FOREIGN KEY (weighed_by_id) REFERENCES users(id)"
                )
            )
            print(f"Added constraint {FK_NAME}.")


if __name__ == "__main__":
    run()
