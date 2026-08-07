def _signup(client, org_name="Acme Terminal", email="owner@acme-terminal.com", password="hunter2pass"):
    return client.post("/auth/signup", json={"organization_name": org_name, "email": email, "password": password})


def test_signup_returns_token_and_user(client):
    resp = _signup(client)
    assert resp.status_code == 201
    body = resp.json()
    assert body["access_token"]
    assert body["user"]["email"] == "owner@acme-terminal.com"
    assert body["user"]["role"] == "owner"


def test_signup_duplicate_email_rejected(client):
    _signup(client)
    resp = _signup(client, org_name="Someone Else")
    assert resp.status_code == 409


def test_login_with_correct_and_incorrect_password(client):
    _signup(client)
    ok = client.post("/auth/login", json={"email": "owner@acme-terminal.com", "password": "hunter2pass"})
    assert ok.status_code == 200

    bad = client.post("/auth/login", json={"email": "owner@acme-terminal.com", "password": "wrong"})
    assert bad.status_code == 401


def test_me_requires_valid_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401

    token = _signup(client).json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "owner@acme-terminal.com"


def test_protected_route_requires_auth(client):
    resp = client.get("/simulation/runs")
    assert resp.status_code == 401


def test_organizations_cannot_see_each_others_runs(client):
    token_a = _signup(client, org_name="Port A", email="a@port-ops.com").json()["access_token"]
    token_b = _signup(client, org_name="Port B", email="b@port-ops.com").json()["access_token"]

    run = client.post(
        "/simulation/runs",
        json={"name": "org-a-run", "sim_duration_hours": 6, "seed": 1},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert run.status_code == 200
    run_id = run.json()["id"]

    # Org A sees its own run.
    list_a = client.get("/simulation/runs", headers={"Authorization": f"Bearer {token_a}"})
    assert any(r["id"] == run_id for r in list_a.json())

    # Org B does not see it in listings...
    list_b = client.get("/simulation/runs", headers={"Authorization": f"Bearer {token_b}"})
    assert all(r["id"] != run_id for r in list_b.json())

    # ...and cannot fetch it directly either (404, not 403 -- don't confirm it exists).
    get_b = client.get(f"/simulation/runs/{run_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert get_b.status_code == 404
