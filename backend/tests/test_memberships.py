def plan_body(**overrides):
    data = {"name": "Monthly", "duration_days": 30, "price": 1500, "description": "One month"}
    data.update(overrides)
    return data


def test_create_and_get_plan(client):
    res = client.post("/api/memberships", json=plan_body())
    assert res.status_code == 201
    created = res.json()
    assert created["id"] == "PLN-001"
    assert created["is_active"] is True
    assert created["member_count"] == 0

    fetched = client.get(f"/api/memberships/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Monthly"


def test_list_and_search_plans(client):
    client.post("/api/memberships", json=plan_body())
    client.post("/api/memberships", json=plan_body(name="Annual", duration_days=365, price=12000))
    names = [p["name"] for p in client.get("/api/memberships").json()]
    assert names == ["Monthly", "Annual"]  # sorted by duration
    found = client.get("/api/memberships", params={"q": "ann"}).json()
    assert [p["name"] for p in found] == ["Annual"]


def test_update_plan(client):
    plan = client.post("/api/memberships", json=plan_body()).json()
    res = client.put(
        f"/api/memberships/{plan['id']}",
        json=plan_body(name="Monthly Plus", price=1800, is_active=False),
    )
    assert res.status_code == 200
    assert res.json()["price"] == 1800
    assert res.json()["is_active"] is False
    assert client.get("/api/memberships", params={"active": True}).json() == []


def test_missing_plan(client):
    assert client.get("/api/memberships/PLN-404").status_code == 404
    assert client.put("/api/memberships/PLN-404", json=plan_body()).status_code == 404
    assert client.delete("/api/memberships/PLN-404").status_code == 404


def test_duplicate_plan_name_is_rejected(client):
    client.post("/api/memberships", json=plan_body())
    assert client.post("/api/memberships", json=plan_body(name="monthly")).status_code == 409


def test_plan_validation(client):
    for overrides in (
        {"duration_days": 0},
        {"duration_days": 99999},
        {"price": -5},
        {"name": "x"},
    ):
        res = client.post("/api/memberships", json=plan_body(**overrides))
        assert res.status_code == 422, overrides


def test_delete_unused_plan(client):
    plan = client.post("/api/memberships", json=plan_body()).json()
    assert client.delete(f"/api/memberships/{plan['id']}").status_code == 204
    assert client.get(f"/api/memberships/{plan['id']}").status_code == 404


def test_cannot_delete_plan_in_use(client, member, plan):
    res = client.delete(f"/api/memberships/{plan['id']}")
    assert res.status_code == 409
    assert "1 member" in res.json()["detail"]
    assert client.get(f"/api/memberships/{plan['id']}").json()["member_count"] == 1
