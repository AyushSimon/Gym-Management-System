def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_openapi_and_docs_are_served(client):
    assert client.get("/docs").status_code == 200
    schema = client.get("/openapi.json").json()
    for path in (
        "/api/members",
        "/api/members/{member_id}",
        "/api/members/search",
        "/api/memberships/{plan_id}",
        "/api/payments/member/{member_id}",
        "/api/dashboard/expiring-memberships",
    ):
        assert path in schema["paths"], path


def test_validation_error_shape(client):
    res = client.post("/api/memberships", json={"name": "A", "duration_days": 0, "price": -1})
    assert res.status_code == 422
    body = res.json()
    assert isinstance(body["detail"], str)
    assert {e["field"] for e in body["errors"]} == {"name", "duration_days", "price"}


def test_malformed_json_is_a_validation_error(client):
    res = client.post("/api/memberships", content="{oops", headers={"Content-Type": "application/json"})
    assert res.status_code == 422


def test_cors_allows_the_frontend_origin(client):
    res = client.options(
        "/api/members",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_system_info_and_export(client, member):
    info = client.get("/api/system/info").json()
    assert info["counts"] == {"members": 1, "plans": 1, "payments": 0}

    export = client.get("/api/system/export")
    assert export.status_code == 200
    assert "attachment" in export.headers["content-disposition"]
    assert len(export.json()["members"]) == 1
