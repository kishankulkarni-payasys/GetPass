"""Seed demo users (one per role) and dummy vehicle passes for local development.

Run from the Backend/ directory:
    python -m scripts.seed_demo_data            # add users + passes (skips passes if present)
    python -m scripts.seed_demo_data --reset    # delete the DEMO passes and add them again
Safe to re-run: users that already exist are skipped, and passes are only added when no
DEMO-tagged passes exist yet. Never run this against a production database.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.auth import encrypt_recoverable_password, hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    GoodsReceipt,
    IntegrationEvent,
    GoodsReceiptLine,
    PassAuditLog,
    PassChallanLine,
    PassWeighment,
    QualityResult,
    QualityResultLine,
    User,
    VehicleEntry,
    VehicleEntryPhoto,
)

DEMO_PASSWORD = os.getenv("DEMO_USER_PASSWORD", "Demo@1234")
DEMO_TAG = "DEMO"  # stored in reference_doc_number so demo passes can be found / skipped

DEMO_USERS = [
    ("guard1", "Ramesh Patil", "security_guard", "9000000002"),
    ("guard2", "Suresh Jadhav", "security_guard", "9000000003"),
    ("weigh1", "Mahesh Shinde", "weighbridge_operator", "9000000004"),
    ("store1", "Anita Deshmukh", "store_incharge", "9000000005"),
    ("quality1", "Pooja Kulkarni", "quality_inspector", "9000000006"),
    ("supervisor1", "Vikram Joshi", "site_supervisor", "9000000007"),
    ("admin2", "Site Admin", "admin", "9000000008"),
]

PROJECTS = [("Skyline Towers", "Tower A"), ("Skyline Towers", "Tower B"), ("Green Valley", "Phase 1")]
SUPPLIERS = ["UltraTech Cement Ltd", "JSW Steel Ltd", "Shree Sand Suppliers", "Ambuja Cements", "Tata Steel"]
DRIVERS = [
    ("Rajesh Kumar", "9876543210"), ("Santosh More", "9823456712"), ("Imran Shaikh", "9765432109"),
    ("Ganesh Pawar", "9890123456"), ("Ajay Yadav", "9922334455"), ("Prakash Gaikwad", "9811223344"),
]
MATERIALS = [
    ("OPC Cement 53 Grade", "bags", Decimal("400")),
    ("TMT Bar 12mm", "ton", Decimal("8.5")),
    ("River Sand", "brass", Decimal("6")),
    ("Aggregate 20mm", "brass", Decimal("5")),
    ("TMT Bar 16mm", "ton", Decimal("10")),
]

# (vehicle, final_state, hours_ago, quality_result, erp_status)
INWARD_PLAN = [
    ("MH12AB1001", "GATE_IN", 0.3, None, None),
    ("MH12CD2002", "GATE_IN", 0.8, None, None),
    ("MH14EF3003", "ON_SITE", 1.5, None, None),
    ("MH12GH4004", "QUALITY_PENDING", 2.5, None, None),
    ("MH12JK5005", "QUALITY_PENDING", 4.0, None, None),   # past the quality SLA
    ("MH15LM6006", "QUALITY_RESOLVED", 5.0, "approved", None),
    ("MH12NP7007", "GRN_DRAFT", 6.0, "partial", None),
    ("MH12QR8008", "GRN_APPROVED", 20.0, "approved", "posted"),
    ("MH14ST9009", "GRN_APPROVED", 22.0, "approved", "pending"),
    ("MH12UV1010", "GRN_APPROVED", 24.0, "approved", "failed"),
    ("MH12WX1111", "GRN_APPROVED", 26.0, "rejected", "not_required"),
    ("MH12YZ1212", "GATE_OUT", 30.0, "approved", "posted"),
    ("MH43AA1313", "GATE_OUT", 48.0, "partial", "posted"),
    ("MH12BB1414", "CANCELLED", 3.0, None, None),
]
# GRN-approved inward passes that already have their empty (tare) weight, so they can gate out.
# The others in GRN_APPROVED still wait for tare, showing the "weigh before gate-out" rule.
TARE_DONE_BEFORE_EXIT = {"MH12QR8008", "MH12WX1111"}

# (vehicle, final_state, hours_ago, purpose, gross_kg, tare_kg); weights None = not weighed yet.
GENERAL_PLAN = [
    ("MH12CC2101", "GATE_IN", 0.5, "Site visit", None, None),
    ("MH12DD2202", "GATE_IN", 1.2, "Equipment delivery", Decimal("14250"), None),
    ("MH12HH2606", "GATE_IN", 2.2, "Water tanker", Decimal("16800"), Decimal("6400")),
    ("MH14EE2303", "GATE_OUT", 8.0, "Scrap removal", Decimal("11900"), Decimal("7350")),
    ("MH12FF2404", "GATE_OUT", 26.0, "Water tanker", Decimal("17100"), Decimal("6450")),
    ("MH12GG2505", "CANCELLED", 2.0, "Site visit", None, None),
]

INWARD_PATH = ["GATE_IN", "ON_SITE", "QUALITY_PENDING", "QUALITY_RESOLVED", "GRN_DRAFT", "GRN_APPROVED", "GATE_OUT"]


def seed_users(db):
    users = {}
    for username, full_name, role, contact_no in DEMO_USERS:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            user = User(username=username, password_hash=hash_password(DEMO_PASSWORD),
                        password_recoverable=encrypt_recoverable_password(DEMO_PASSWORD),
                        full_name=full_name, role=role, is_active=True,
                        email=f"{username}@example.com", contact_no=contact_no)
            db.add(user)
            print(f"  + user {username:<12} ({role})")
        users[role] = user
    db.flush()
    return users


def audit(db, entry, old, new, actor, at):
    db.add(PassAuditLog(entry_id=entry.id, action="state_changed", field="pass_state",
                        old_value=old, new_value=new, actor_user_id=actor.id if actor else None, created_at=at))


def seed_inward(db, users, idx, plan):
    vehicle, final_state, hours_ago, q_result, erp_status = plan
    now = datetime.utcnow()
    t0 = now - timedelta(hours=hours_ago)
    step = timedelta(minutes=max(5, hours_ago * 60 / 8))
    project, sub = PROJECTS[idx % len(PROJECTS)]
    driver, phone = DRIVERS[idx % len(DRIVERS)]
    mats = [MATERIALS[idx % len(MATERIALS)], MATERIALS[(idx + 2) % len(MATERIALS)]]
    guard, weigh, store, quality = (users["security_guard"], users["weighbridge_operator"],
                                    users["store_incharge"], users["quality_inspector"])

    entry = VehicleEntry(
        vehicle_number=vehicle, project_name=project, subproject_name=sub,
        driver_name=driver, driver_phone=phone, purpose="Material inward",
        material_description=", ".join(m[0] for m in mats),
        supplier_transporter_name=SUPPLIERS[idx % len(SUPPLIERS)],
        reference_doc_number=f"{DEMO_TAG}-IN-{idx + 1:03d}",
        entry_time=t0, created_at=t0, pass_type="inward", pass_state="GATE_IN",
        pass_state_changed_at=t0, client_ref=str(uuid.uuid4()), gate_in_method="manual",
        created_by_id=guard.id, po_number=f"PO/2026/{4100 + idx}", challan_number=f"CH-{78000 + idx}",
        po_lookup_status="not_checked",
    )
    db.add(entry)
    db.flush()
    lines = []
    for n, (name, uom, qty) in enumerate(mats, start=1):
        line = PassChallanLine(entry_id=entry.id, line_no=n, material=name, quantity=qty, uom=uom)
        db.add(line)
        lines.append(line)
    db.flush()

    if final_state == "CANCELLED":
        entry.pass_state, entry.cancelled_reason = "CANCELLED", "Wrong PO number on challan"
        entry.pass_state_changed_at = t0 + step
        audit(db, entry, "GATE_IN", "CANCELLED", guard, t0 + step)
        return

    target = INWARD_PATH.index(final_state)
    t = t0
    gross_w = None
    for i in range(1, target + 1):
        t += step
        state = INWARD_PATH[i]
        actor = guard
        if state == "ON_SITE":
            actor = weigh
            gross = Decimal(18000 + idx * 750)
            gross_w = PassWeighment(entry_id=entry.id, kind="gross", weight=gross, unit="kg",
                                    source="manual", manual_reason="Demo data", stable=True,
                                    captured_by_id=weigh.id, captured_at=t)
            db.add(gross_w)
            entry.gross_weight, entry.weight_unit, entry.weighed_at, entry.weighed_by_id = gross, "kg", t, weigh.id
        elif state == "QUALITY_PENDING":
            actor = store
        elif state == "QUALITY_RESOLVED":
            actor = quality
            qr = QualityResult(entry_id=entry.id, result=q_result, source="in_app",
                               inspected_by_name=quality.full_name, inspected_by_id=quality.id,
                               inspected_at=t, recorded_at=t, is_current=True,
                               remarks={"approved": "All material as per spec",
                                        "partial": "Some bags damaged",
                                        "rejected": "Material below grade"}[q_result])
            for line in lines:
                if q_result == "approved":
                    acc, rej = line.quantity, Decimal(0)
                elif q_result == "rejected":
                    acc, rej = Decimal(0), line.quantity
                else:
                    rej = (line.quantity / 10).quantize(Decimal("0.001"))
                    acc = line.quantity - rej
                qr.lines.append(QualityResultLine(challan_line_id=line.id, accepted_qty=acc, rejected_qty=rej))
            db.add(qr)
            qr_by_line = {ql.challan_line_id: ql for ql in qr.lines}
        elif state == "GRN_DRAFT":
            actor = store
            grn = GoodsReceipt(entry_id=entry.id, status="draft", created_by_id=store.id, created_at=t,
                               idempotency_key=f"gatepass-grn-{uuid.uuid4().hex}", erp_attempts=0)
            for line in lines:
                ql = qr_by_line[line.id]
                grn.lines.append(GoodsReceiptLine(
                    challan_line_id=line.id, material=line.material, uom=line.uom, po_qty=line.quantity,
                    challan_qty=line.quantity, received_qty=line.quantity,
                    accepted_qty=ql.accepted_qty, rejected_qty=ql.rejected_qty))
            db.add(grn)
        elif state == "GRN_APPROVED":
            actor = store
            grn.status, grn.approved_by_id, grn.approved_at = "approved", store.id, t
            grn.erp_status = erp_status
            if erp_status == "posted":
                grn.erp_grn_number, grn.erp_attempts, grn.erp_last_attempt_at = f"GRN-VJ-{90000 + idx}", 1, t
            elif erp_status == "failed":
                grn.erp_attempts, grn.erp_last_attempt_at = 3, t
                grn.erp_last_error = "ERP timeout (demo)"
            if any(l.rejected_qty > 0 for l in grn.lines):
                grn.return_pass_number = f"RRP-{t.year}-{idx + 1:05d}"
        elif state == "GATE_OUT":
            entry.exit_time = t
        # Empty-vehicle (tare) weight after unloading, once the GRN is approved: always for passes
        # that went on to gate out, and for the approved ones listed as ready to leave.
        if state == "GRN_APPROVED" and (final_state == "GATE_OUT" or vehicle in TARE_DONE_BEFORE_EXIT):
            db.add(PassWeighment(entry_id=entry.id, kind="tare", weight=Decimal(7000 + idx * 100),
                                 unit="kg", source="manual", manual_reason="Demo data", stable=True,
                                 captured_by_id=weigh.id, captured_at=t + step / 3))
        audit(db, entry, INWARD_PATH[i - 1], state, actor, t)
        entry.pass_state, entry.pass_state_changed_at = state, t
        db.flush()


def seed_general(db, users, idx, plan):
    vehicle, final_state, hours_ago, purpose, gross_kg, tare_kg = plan
    guard = users["security_guard"] if idx % 2 == 0 else db.query(User).filter_by(username="guard2").one()
    t0 = datetime.utcnow() - timedelta(hours=hours_ago)
    project, sub = PROJECTS[idx % len(PROJECTS)]
    driver, phone = DRIVERS[(idx + 3) % len(DRIVERS)]
    entry = VehicleEntry(
        vehicle_number=vehicle, project_name=project, subproject_name=sub, driver_name=driver,
        driver_phone=phone, purpose=purpose, material_description=purpose,
        supplier_transporter_name=SUPPLIERS[(idx + 1) % len(SUPPLIERS)],
        reference_doc_number=f"{DEMO_TAG}-GEN-{idx + 1:03d}", entry_time=t0, created_at=t0,
        pass_type="general", pass_state="GATE_IN", pass_state_changed_at=t0,
        client_ref=str(uuid.uuid4()), gate_in_method="manual", created_by_id=guard.id,
    )
    db.add(entry)
    db.flush()
    weigh = users["weighbridge_operator"]
    # Scrap goes out loaded, so it is weighed empty first; everything else comes in loaded.
    first, second = ("tare", "gross") if purpose == "Scrap removal" else ("gross", "tare")
    weights = {"gross": gross_kg, "tare": tare_kg}
    for n, kind in enumerate((first, second), start=1):
        if weights[kind] is None:
            continue
        at = t0 + timedelta(minutes=10 * n)
        db.add(PassWeighment(entry_id=entry.id, kind=kind, weight=weights[kind], unit="kg", source="manual",
                             manual_reason="Demo data", stable=True, captured_by_id=weigh.id, captured_at=at))
        if kind == "gross":
            entry.gross_weight, entry.weight_unit, entry.weighed_at, entry.weighed_by_id = weights[kind], "kg", at, weigh.id
    if final_state != "GATE_IN":
        t = t0 + timedelta(minutes=40)
        entry.pass_state, entry.pass_state_changed_at = final_state, t
        if final_state == "GATE_OUT":
            entry.exit_time = t
        else:
            entry.cancelled_reason = "Visitor did not arrive"
        audit(db, entry, "GATE_IN", final_state, guard, t)


def delete_demo_passes(db):
    ids = [row[0] for row in db.query(VehicleEntry.id).filter(VehicleEntry.reference_doc_number.like(f"{DEMO_TAG}-%"))]
    if not ids:
        return 0
    qr_ids = [row[0] for row in db.query(QualityResult.id).filter(QualityResult.entry_id.in_(ids))]
    grn_ids = [row[0] for row in db.query(GoodsReceipt.id).filter(GoodsReceipt.entry_id.in_(ids))]
    # Children first, in foreign-key order.
    db.query(VehicleEntryPhoto).filter(VehicleEntryPhoto.entry_id.in_(ids)).delete(synchronize_session=False)
    if qr_ids:
        db.query(QualityResultLine).filter(QualityResultLine.quality_result_id.in_(qr_ids)).delete(synchronize_session=False)
    if grn_ids:
        db.query(GoodsReceiptLine).filter(GoodsReceiptLine.goods_receipt_id.in_(grn_ids)).delete(synchronize_session=False)
    for model in (QualityResult, GoodsReceipt):
        db.query(model).filter(model.entry_id.in_(ids)).delete(synchronize_session=False)
    db.query(PassWeighment).filter(PassWeighment.entry_id.in_(ids)).update({"supersedes_id": None}, synchronize_session=False)
    for model in (PassWeighment, PassChallanLine, PassAuditLog, IntegrationEvent):
        db.query(model).filter(model.entry_id.in_(ids)).delete(synchronize_session=False)
    db.query(VehicleEntry).filter(VehicleEntry.id.in_(ids)).delete(synchronize_session=False)
    db.flush()
    return len(ids)


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("Users:")
        users = seed_users(db)
        if "--reset" in sys.argv:
            print(f"Removed {delete_demo_passes(db)} old demo passes")
        if db.query(VehicleEntry).filter(VehicleEntry.reference_doc_number.like(f"{DEMO_TAG}-%")).first():
            print("Demo vehicle passes already exist; skipping passes.")
        else:
            for i, plan in enumerate(INWARD_PLAN):
                seed_inward(db, users, i, plan)
            for i, plan in enumerate(GENERAL_PLAN):
                seed_general(db, users, i, plan)
            print(f"Passes: added {len(INWARD_PLAN)} inward + {len(GENERAL_PLAN)} general")
        db.commit()
        print(f"Done. Demo user password: {DEMO_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
