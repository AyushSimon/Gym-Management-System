from datetime import date

from app.utils.validators import compute_end_date, days_remaining, membership_status


def payload(plan_id, **overrides):
    data = {
        "full_name": "Priya Das",
        "age": 24,
        "phone": "9123456780",
        "plan_id": plan_id,
        "start_date": "2026-06-10",
        "payment_status": "pending",
    }
    data.update(overrides)
    return data


# ---------------------------------------------------------------- status rules
def test_end_date_is_inclusive():
    assert compute_end_date(date(2026, 6, 1), 30) == date(2026, 6, 30)


def test_status_calculation():
    start, end = date(2026, 6, 1), date(2026, 6, 30)
    assert membership_status(start, end, date(2026, 5, 31)) == "upcoming"
    assert membership_status(start, end, date(2026, 6, 1)) == "active"
    assert membership_status(start, end, date(2026, 6, 30)) == "active"
    assert membership_status(start, end, date(2026, 7, 1)) == "expired"
    assert days_remaining(end, date(2026, 6, 30)) == 0
    assert days_remaining(end, date(2026, 7, 2)) == -2


# ------------------------------------------------------------------- creation
def test_create_member(member):
    assert member["id"] == "M-0001"
    assert member["phone"] == "9876543210"
    assert member["plan_name"] == "Quarterly"
    assert member["end_date"] == "2026-08-29"
    assert member["status"] == "active"
    assert member["days_remaining"] == 75
    assert member["history"] == []


def test_payment_status_is_independent_of_membership_status(client, plan):
    res = client.post("/api/members", json=payload(plan["id"], start_date="2026-01-01", payment_status="paid"))
    assert res.status_code == 201
    assert res.json()["status"] == "expired"
    assert res.json()["payment_status"] == "paid"


def test_explicit_end_date_is_respected(client, plan):
    res = client.post("/api/members", json=payload(plan["id"], end_date="2026-07-01"))
    assert res.status_code == 201
    assert res.json()["end_date"] == "2026-07-01"


# ------------------------------------------------------------------ retrieval
def test_get_member(client, member):
    res = client.get(f"/api/members/{member['id']}")
    assert res.status_code == 200
    assert res.json()["full_name"] == "Aarav Sharma"


def test_get_missing_member(client):
    res = client.get("/api/members/M-9999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"]


# --------------------------------------------------------------------- update
def test_update_keeps_dates_when_period_unchanged(client, member, plan):
    res = client.put(
        f"/api/members/{member['id']}",
        json=payload(plan["id"], full_name="Aarav K Sharma", phone="9876543210", start_date="2026-06-01", age=28),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["full_name"] == "Aarav K Sharma"
    assert body["age"] == 28
    assert body["end_date"] == "2026-08-29"
    assert body["history"] == []


def test_plan_change_archives_previous_period(client, member):
    monthly = client.post(
        "/api/memberships", json={"name": "Monthly", "duration_days": 30, "price": 1500}
    ).json()
    res = client.put(
        f"/api/members/{member['id']}",
        json=payload(monthly["id"], phone="9876543210", start_date="2026-06-01"),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["plan_name"] == "Monthly"
    assert body["end_date"] == "2026-06-30"
    assert len(body["history"]) == 1
    assert body["history"][0]["plan_name"] == "Quarterly"
    assert body["history"][0]["end_date"] == "2026-08-29"


def test_editing_a_plan_does_not_rewrite_member_snapshot(client, member, plan):
    res = client.put(
        f"/api/memberships/{plan['id']}",
        json={"name": "Quarterly Plus", "duration_days": 120, "price": 5000},
    )
    assert res.status_code == 200
    again = client.get(f"/api/members/{member['id']}").json()
    assert again["plan_name"] == "Quarterly"
    assert again["end_date"] == "2026-08-29"


def test_update_missing_member(client, plan):
    assert client.put("/api/members/M-9999", json=payload(plan["id"])).status_code == 404


# --------------------------------------------------------------------- delete
def test_delete_member(client, member):
    assert client.delete(f"/api/members/{member['id']}").status_code == 204
    assert client.get(f"/api/members/{member['id']}").status_code == 404
    assert client.delete(f"/api/members/{member['id']}").status_code == 404


def test_deleted_member_id_is_not_reused_while_payments_reference_it(client, member):
    client.post(
        "/api/payments",
        json={"member_id": member["id"], "amount": 4000, "payment_date": "2026-06-01"},
    )
    client.delete(f"/api/members/{member['id']}")
    plan_id = member["plan_id"]
    res = client.post("/api/members", json=payload(plan_id, phone="9000000001"))
    assert res.json()["id"] == "M-0002"


# ------------------------------------------------------ search, filter, paging
def seed_three(client, plan):
    client.post("/api/members", json=payload(plan["id"], full_name="Zoya Khan", phone="9000000001", start_date="2026-01-01"))
    client.post("/api/members", json=payload(plan["id"], full_name="Aman Roy", phone="9000000002", start_date="2026-06-10"))
    client.post("/api/members", json=payload(plan["id"], full_name="Beena Paul", phone="9000000003", start_date="2026-07-01"))


def test_search_by_name_id_and_phone(client, plan):
    seed_three(client, plan)
    assert [m["full_name"] for m in client.get("/api/members/search", params={"q": "aman"}).json()] == ["Aman Roy"]
    assert client.get("/api/members/search", params={"q": "M-0003"}).json()[0]["full_name"] == "Beena Paul"
    assert client.get("/api/members/search", params={"q": "900000000 1"}).json()[0]["full_name"] == "Zoya Khan"
    assert client.get("/api/members", params={"q": "zzz"}).json()["total"] == 0


def test_filter_by_status(client, plan):
    seed_three(client, plan)
    expired = client.get("/api/members", params={"status": "expired"}).json()
    upcoming = client.get("/api/members", params={"status": "upcoming"}).json()
    active = client.get("/api/members", params={"status": "active"}).json()
    assert [m["full_name"] for m in expired["items"]] == ["Zoya Khan"]
    assert [m["full_name"] for m in upcoming["items"]] == ["Beena Paul"]
    assert [m["full_name"] for m in active["items"]] == ["Aman Roy"]


def test_filter_expiring_and_payment_status(client, plan):
    monthly = client.post("/api/memberships", json={"name": "Monthly", "duration_days": 30, "price": 1500}).json()
    # started 2026-05-20 -> ends 2026-06-18, three days from the fixed "today"
    client.post("/api/members", json=payload(monthly["id"], phone="9000000011", start_date="2026-05-20", payment_status="paid"))
    client.post("/api/members", json=payload(plan["id"], phone="9000000012", start_date="2026-06-10"))
    assert client.get("/api/members", params={"expiring": True}).json()["total"] == 1
    assert client.get("/api/members", params={"payment_status": "paid"}).json()["total"] == 1
    assert client.get("/api/members", params={"plan_id": monthly["id"]}).json()["total"] == 1


def test_sorting_and_pagination(client, plan):
    seed_three(client, plan)
    res = client.get("/api/members", params={"sort_by": "full_name", "sort_order": "asc", "page_size": 2}).json()
    assert [m["full_name"] for m in res["items"]] == ["Aman Roy", "Beena Paul"]
    assert res["total"] == 3 and res["pages"] == 2
    page2 = client.get("/api/members", params={"sort_by": "full_name", "sort_order": "asc", "page_size": 2, "page": 2}).json()
    assert [m["full_name"] for m in page2["items"]] == ["Zoya Khan"]


# ------------------------------------------------------------------ validation
def test_validation_errors(client, plan):
    cases = [
        ({"full_name": "R2D2"}, "full_name"),
        ({"age": 5}, "age"),
        ({"phone": "12345"}, "phone"),
        ({"start_date": "not-a-date"}, "start_date"),
        ({"end_date": "2026-06-01", "start_date": "2026-06-10"}, "End date"),
    ]
    for overrides, expected in cases:
        res = client.post("/api/members", json=payload(plan["id"], **overrides))
        assert res.status_code == 422, overrides
        assert expected in res.json()["detail"], res.json()


def test_far_future_start_rejected(client, plan):
    res = client.post("/api/members", json=payload(plan["id"], start_date="2028-01-01"))
    assert res.status_code == 422
    assert "one year" in res.json()["detail"]


def test_missing_and_inactive_plan_references(client, plan):
    res = client.post("/api/members", json=payload("PLN-999"))
    assert res.status_code == 422
    assert "does not exist" in res.json()["detail"]

    client.put(
        f"/api/memberships/{plan['id']}",
        json={"name": "Quarterly", "duration_days": 90, "price": 4000, "is_active": False},
    )
    res = client.post("/api/members", json=payload(plan["id"]))
    assert res.status_code == 422
    assert "inactive" in res.json()["detail"]


def test_duplicate_phone_is_rejected(client, member, plan):
    res = client.post("/api/members", json=payload(plan["id"], phone="9876543210"))
    assert res.status_code == 409


# --------------------------------------------------------------------- renewal
def test_renew_active_member_starts_after_current_end(client, member):
    res = client.post(f"/api/members/{member['id']}/renew", json={})
    assert res.status_code == 200
    body = res.json()
    assert body["start_date"] == "2026-08-30"
    assert body["end_date"] == "2026-11-27"
    assert body["payment_status"] == "pending"
    assert len(body["history"]) == 1


def test_renew_expired_member_starts_today(client, plan):
    created = client.post("/api/members", json=payload(plan["id"], start_date="2026-01-01")).json()
    body = client.post(f"/api/members/{created['id']}/renew").json()
    assert body["start_date"] == "2026-06-15"
    assert body["status"] == "active"
