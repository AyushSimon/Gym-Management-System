from datetime import datetime, timezone

from app.seed import build, seed_if_empty


def add_member(client, plan_id, name, phone, start, paid="paid"):
    res = client.post(
        "/api/members",
        json={
            "full_name": name, "age": 30, "phone": phone, "plan_id": plan_id,
            "start_date": start, "payment_status": paid,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_empty_dashboard(client):
    stats = client.get("/api/dashboard/stats").json()
    assert stats["total_members"] == 0
    assert stats["total_collected"] == 0
    assert client.get("/api/dashboard/membership-distribution").json() == []
    assert client.get("/api/dashboard/recent-members").json() == []
    assert client.get("/api/dashboard/recent-payments").json() == []
    growth = client.get("/api/dashboard/membership-growth").json()
    assert len(growth) == 6
    assert all(point["total_members"] == 0 for point in growth)


def test_stats_are_calculated_from_data(client):
    monthly = client.post("/api/memberships", json={"name": "Monthly", "duration_days": 30, "price": 1500}).json()
    annual = client.post("/api/memberships", json={"name": "Annual", "duration_days": 365, "price": 12000}).json()

    add_member(client, annual["id"], "Active Person", "9000000001", "2026-06-01")
    expiring = add_member(client, monthly["id"], "Expiring Person", "9000000002", "2026-05-20", paid="pending")
    add_member(client, monthly["id"], "Expired Person", "9000000003", "2026-01-01")
    add_member(client, annual["id"], "Future Person", "9000000004", "2026-07-01")

    client.post("/api/payments", json={"member_id": expiring["id"], "amount": 1500, "payment_date": "2026-06-01", "status": "paid"})
    client.post("/api/payments", json={"member_id": expiring["id"], "amount": 700, "payment_date": "2026-06-02", "status": "pending"})
    client.post("/api/payments", json={"member_id": expiring["id"], "amount": 99, "payment_date": "2026-06-02", "status": "failed"})

    stats = client.get("/api/dashboard/stats").json()
    assert stats == {
        "total_members": 4,
        "active_members": 2,
        "expired_members": 1,
        "upcoming_members": 1,
        "expiring_soon": 1,
        "members_with_pending_payment": 1,
        "pending_payments": 1,
        "pending_amount": 700,
        "total_collected": 1500,
        "total_plans": 2,
    }


def test_distribution_recent_and_expiring(client):
    monthly = client.post("/api/memberships", json={"name": "Monthly", "duration_days": 30, "price": 1500}).json()
    annual = client.post("/api/memberships", json={"name": "Annual", "duration_days": 365, "price": 12000}).json()
    add_member(client, annual["id"], "A One", "9000000001", "2026-06-01")
    add_member(client, annual["id"], "B Two", "9000000002", "2026-06-02")
    soon = add_member(client, monthly["id"], "C Three", "9000000003", "2026-05-20")
    client.post("/api/payments", json={"member_id": soon["id"], "amount": 1500, "payment_date": "2026-06-01"})

    distribution = client.get("/api/dashboard/membership-distribution").json()
    assert distribution[0] == {"plan_id": annual["id"], "plan_name": "Annual", "count": 2}
    assert distribution[1]["count"] == 1

    recent = client.get("/api/dashboard/recent-members", params={"limit": 2}).json()
    assert len(recent) == 2
    assert recent[0]["id"] == "M-0003"  # latest first

    assert client.get("/api/dashboard/recent-payments").json()[0]["member_name"] == "C Three"

    expiring = client.get("/api/dashboard/expiring-memberships").json()
    assert [m["full_name"] for m in expiring] == ["C Three"]
    assert client.get("/api/dashboard/expiring-memberships", params={"days": 0}).json() == []


def test_growth_groups_members_by_creation_month(client, container):
    plan = client.post("/api/memberships", json={"name": "Monthly", "duration_days": 30, "price": 1500}).json()
    for index, month in enumerate([3, 3, 5, 6], start=1):
        add_member(client, plan["id"], f"Person {'ABCD'[index - 1]}", f"90000000{index:02d}", "2026-06-01")
        record_id = f"M-{index:04d}"
        stamp = datetime(2026, month, 10, tzinfo=timezone.utc).isoformat(timespec="seconds")
        container.members_repo.update(record_id, {"created_at": stamp})

    growth = {p["month"]: p for p in client.get("/api/dashboard/membership-growth", params={"months": 6}).json()}
    assert list(growth) == ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]
    assert growth["2026-02"]["total_members"] == 0
    assert growth["2026-03"]["new_members"] == 2
    assert growth["2026-04"]["total_members"] == 2
    assert growth["2026-05"]["total_members"] == 3
    assert growth["2026-06"]["total_members"] == 4


def test_seed_data_is_consistent(container):
    plans, members, payments = build(container.clock())
    plan_ids = {p["id"] for p in plans}
    member_ids = {m["id"] for m in members}
    assert all(m["plan_id"] in plan_ids for m in members)
    assert all(p["member_id"] in member_ids for p in payments)

    assert seed_if_empty(container) is True
    assert seed_if_empty(container) is False  # never overwrites existing data
    stats = container.dashboard.stats()
    assert stats["total_members"] == len(members)
    assert stats["active_members"] > 0 and stats["expired_members"] > 0
