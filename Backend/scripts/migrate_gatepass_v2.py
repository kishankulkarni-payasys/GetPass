"""One-off, idempotent migration for the v2 inward flow.

Run from the Backend/ directory, before starting the new API:
    python -m scripts.migrate_gatepass_v2
Safe to re-run and safe either side of the first API start: new tables come from
create_all (which skips existing ones) and every other statement checks first.
Prints counts only, never row data.
"""
from sqlalchemy import inspect, text

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.database import Base, engine

ENTRY_COLUMNS = [
    ("pass_type", "VARCHAR(10) NOT NULL CONSTRAINT DF_vehicle_entries_pass_type DEFAULT 'general'"),
    ("pass_state", "VARCHAR(20) NOT NULL CONSTRAINT DF_vehicle_entries_pass_state DEFAULT 'GATE_IN'"),
    ("pass_state_changed_at", "DATETIME NULL"),
    ("client_ref", "VARCHAR(36) NULL"),
    ("gate_in_method", "VARCHAR(10) NULL"),
    ("created_by_id", "INT NULL"),
    ("po_number", "VARCHAR(50) NULL"),
    ("challan_number", "VARCHAR(50) NULL"),
    ("po_lookup_status", "VARCHAR(15) NULL"),
    ("po_lookup_snapshot", "NVARCHAR(MAX) NULL"),
    ("anpr_confidence", "NUMERIC(5,2) NULL"),
    ("po_ocr_confidence", "NUMERIC(5,2) NULL"),
    ("challan_ocr_confidence", "NUMERIC(5,2) NULL"),
    ("manual_override", "BIT NOT NULL CONSTRAINT DF_vehicle_entries_manual_override DEFAULT 0"),
    ("cancelled_reason", "NVARCHAR(200) NULL"),
]
PHOTO_COLUMNS = [
    ("kind", "VARCHAR(15) NOT NULL CONSTRAINT DF_vehicle_entry_photos_kind DEFAULT 'vehicle'"),
    ("weighment_id", "INT NULL"),
]
FOREIGN_KEYS = [
    ("FK_vehicle_entries_created_by_id", "vehicle_entries", "created_by_id", "users(id)"),
    ("FK_vehicle_entry_photos_weighment_id", "vehicle_entry_photos", "weighment_id", "pass_weighments(id)"),
]
# Filtered so many rows may leave the value empty (SQL Server allows one NULL in a plain unique index).
INDEXES = [
    ("UX_vehicle_entries_client_ref", "CREATE UNIQUE INDEX UX_vehicle_entries_client_ref "
     "ON vehicle_entries(client_ref) WHERE client_ref IS NOT NULL"),
    ("UX_goods_receipts_return_pass_number", "CREATE UNIQUE INDEX UX_goods_receipts_return_pass_number "
     "ON goods_receipts(return_pass_number) WHERE return_pass_number IS NOT NULL"),
    ("ix_vehicle_entries_pass_state", "CREATE INDEX ix_vehicle_entries_pass_state ON vehicle_entries(pass_state)"),
    ("ix_vehicle_entries_po_number", "CREATE INDEX ix_vehicle_entries_po_number ON vehicle_entries(po_number)"),
]

BACKFILL_ENTRIES = text(
    "UPDATE vehicle_entries SET pass_type = 'general', gate_in_method = 'legacy', "
    "pass_state = CASE WHEN exit_time IS NOT NULL THEN 'GATE_OUT' ELSE 'GATE_IN' END, "
    "pass_state_changed_at = COALESCE(exit_time, entry_time) "
    "WHERE gate_in_method IS NULL"
)
BACKFILL_WEIGHMENTS = text(
    "INSERT INTO pass_weighments (entry_id, kind, weight, unit, source, captured_by_id, captured_at) "
    "SELECT v.id, 'gross', v.gross_weight, LEFT(COALESCE(v.weight_unit, 'kg'), 5), 'legacy', "
    "v.weighed_by_id, COALESCE(v.weighed_at, v.entry_time) "
    "FROM vehicle_entries v WHERE v.gross_weight IS NOT NULL AND v.weighed_by_id IS NOT NULL "
    "AND NOT EXISTS (SELECT 1 FROM pass_weighments w WHERE w.entry_id = v.id AND w.kind = 'gross')"
)
COUNT_UNATTRIBUTED_WEIGHTS = text(
    "SELECT COUNT(*) FROM vehicle_entries v WHERE v.gross_weight IS NOT NULL AND v.weighed_by_id IS NULL "
    "AND NOT EXISTS (SELECT 1 FROM pass_weighments w WHERE w.entry_id = v.id AND w.kind = 'gross')"
)


def _exists(conn, sql: str, params: dict) -> bool:
    return conn.execute(text(sql), params).first() is not None


def _column_exists(conn, table: str, column: str) -> bool:
    return _exists(conn, "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = :t AND COLUMN_NAME = :c",
                   {"t": table, "c": column})


def _add_columns(conn, table: str, columns) -> None:
    for column_name, column_def in columns:
        if _column_exists(conn, table, column_name):
            print(f"Column {table}.{column_name} already exists, skipping.")
            continue
        # Names come from the constant lists above, never from input.
        conn.execute(text(f"ALTER TABLE {table} ADD {column_name} {column_def}"))
        print(f"Added column {table}.{column_name}.")


def _add_foreign_keys(conn) -> None:
    for name, table, column, target in FOREIGN_KEYS:
        if _exists(conn, "SELECT 1 FROM sys.foreign_keys WHERE name = :n", {"n": name}):
            print(f"Constraint {name} already exists, skipping.")
            continue
        conn.execute(text(f"ALTER TABLE {table} ADD CONSTRAINT {name} FOREIGN KEY ({column}) REFERENCES {target}"))
        print(f"Added constraint {name}.")


def _add_indexes(conn) -> None:
    for name, statement in INDEXES:
        if _exists(conn, "SELECT 1 FROM sys.indexes WHERE name = :n", {"n": name}):
            print(f"Index {name} already exists, skipping.")
            continue
        conn.execute(text(statement))
        print(f"Added index {name}.")


def _backfill(conn) -> None:
    updated = conn.execute(BACKFILL_ENTRIES).rowcount
    print(f"Legacy entries backfilled: {updated}" if updated else "Legacy entries already backfilled, skipping.")
    inserted = conn.execute(BACKFILL_WEIGHMENTS).rowcount
    print(f"Legacy gross weighments added: {inserted}" if inserted else "Legacy weighments already exist, skipping.")
    unattributed = conn.execute(COUNT_UNATTRIBUTED_WEIGHTS).scalar()
    if unattributed:
        print(f"Weighed entries skipped because no weigher is recorded: {unattributed}")


def _create_missing_tables(conn) -> None:
    existing = set(inspect(conn).get_table_names())
    missing = [name for name in Base.metadata.tables if name not in existing]
    Base.metadata.create_all(bind=conn)
    print(f"Created tables: {', '.join(missing)}." if missing else "All tables already exist, skipping.")


def run() -> None:
    with engine.begin() as conn:
        _create_missing_tables(conn)
        _add_columns(conn, "vehicle_entries", ENTRY_COLUMNS)
        _add_columns(conn, "vehicle_entry_photos", PHOTO_COLUMNS)
        _add_foreign_keys(conn)
        _add_indexes(conn)
        _backfill(conn)


if __name__ == "__main__":
    run()
