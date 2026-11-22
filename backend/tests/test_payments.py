def body(mid, **overrides):
    data = {
        "member_id": mid,
        "amount": 4000,
        "payment_date": "2026-06-10",
        "method": "upi",
        "status": "paid",
        "notes": "Quarterly plan",
    }
    data.update(overrides)
    return data


def test_create_payment_snapshots_member_name(client, member):
    res = client.post("/api/payments", json=body(member["id"]))
    assert res.status_code == 201
    created = res.json()
    assert created["id"] == "PAY-0001"
    assert created["member_name"] == "Aarav Sharma"
    assert created["amount"] == 4000


def test_get_update_delete_payment(client, member):
    pid = client.post("/api/payments", json=body(member["id"])).json()["id"]
    assert client.get(f"/api/payments/{pid}").json()["method"] == "upi"

    res = client.put(f"/api/payments/{pid}", json=body(member["id"], amount=4500, status="pending", method="cash"))
    assert res.status_code == 200
    assert res.json()["amount"] == 4500
    assert res.json()["status"] == "pending"

    assert client.delete(f"/api/payments/{pid}").status_code == 204
    assert client.get(f"/api/payments/{pid}").status_code == 404


def test_missing_payment(client, member):
    assert client.get("/api/payments/PAY-9999").status_code == 404
    assert client.put("/api/payments/PAY-9999", json=body(member["id"])).status_code == 404
    assert client.delete("/api/payments/PAY-9999").status_code == 404


def test_payment_requires_existing_member(client):
    res = client.post("/api/payments", json=body("M-0042"))
    assert res.status_code == 422
    assert "does not exist" in res.json()["detail"]


def test_payment_validation(client, member):
    cases = [
        {"amount": 0},
        {"amount": -10},
        {"method": "bitcoin"},
        {"status": "refunded"},
        {"payment_date": "yesterday"},
        {"member_id": "abc"},
    ]
    for overrides in cases:
        res = client.post("/api/payments", json=body(member["id"], **overrides))
        assert res.status_code == 422, overrides


def test_future_payment_date_is_rejected(client, member):
    res = client.post("/api/payments", json=body(member["id"], payment_date="2026-06-16"))
    assert res.status_code == 422
    assert "future" in res.json()["detail"]


def test_recording_a_payment_does_not_change_member_payment_status(client, plan):
    created = client.post(
        "/api/members",
        json={
            "full_name": "Priya Das", "age": 24, "phone": "9123456780", "plan_id": plan["id"],
            "start_date": "2026-06-10", "payment_status": "pending",
        },
    ).json()
    client.post("/api/payments", json=body(created["id"]))
    assert client.get(f"/api/members/{created['id']}").json()["payment_status"] == "pending"


def test_search_and_filter_payments(client, member):
    client.post("/api/payments", json=body(member["id"], notes="first", payment_date="2026-05-01"))
    client.post("/api/payments", json=body(member["id"], notes="second", method="cash", status="pending"))
    client.post("/api/payments", json=body(member["id"], notes="third", status="failed", payment_date="2026-06-12"))

    assert client.get("/api/payments", params={"q": "second"}).json()["total"] == 1
    assert client.get("/api/payments", params={"q": "aarav"}).json()["total"] == 3
    assert client.get("/api/payments", params={"status": "pending"}).json()["total"] == 1
    assert client.get("/api/payments", params={"method": "cash"}).json()["total"] == 1
    assert client.get("/api/payments", params={"date_from": "2026-06-01"}).json()["total"] == 2
    assert client.get("/api/payments", params={"date_to": "2026-05-31"}).json()["total"] == 1

    newest_first = client.get("/api/payments").json()["items"]
    assert [p["payment_date"] for p in newest_first] == ["2026-06-12", "2026-06-10", "2026-05-01"]


def test_payment_history_by_member(client, member):
    client.post("/api/payments", json=body(member["id"], amount=1000))
    client.post("/api/payments", json=body(member["id"], amount=500, status="pending"))
    history = client.get(f"/api/payments/member/{member['id']}").json()
    assert history["member_name"] == "Aarav Sharma"
    assert len(history["items"]) == 2
    assert history["total_paid"] == 1000
    assert history["total_pending"] == 500
    assert client.get("/api/payments/member/M-4040").status_code == 404


def test_history_survives_member_deletion(client, member):
    client.post("/api/payments", json=body(member["id"]))
    client.delete(f"/api/members/{member['id']}")
    history = client.get(f"/api/payments/member/{member['id']}").json()
    assert history["member_name"] == "Aarav Sharma"
    assert len(history["items"]) == 1


def test_summary(client, member):
    client.post("/api/payments", json=body(member["id"], amount=4000))
    client.post("/api/payments", json=body(member["id"], amount=1000, payment_date="2026-05-02"))
    client.post("/api/payments", json=body(member["id"], amount=700, status="pending"))
    client.post("/api/payments", json=body(member["id"], amount=300, status="failed"))
    summary = client.get("/api/payments/summary").json()
    assert summary == {
        "total_recorded": 4,
        "total_paid_amount": 5000,
        "pending_count": 1,
        "pending_amount": 700,
        "failed_count": 1,
        "paid_this_month": 4000,
    }
