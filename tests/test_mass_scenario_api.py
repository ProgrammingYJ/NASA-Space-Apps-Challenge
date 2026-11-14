import pytest
from fastapi.testclient import TestClient

from api.main import create_app


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    with TestClient(create_app(tmp_path_factory.mktemp("mass-api"))) as value:
        yield value


def test_analogue_and_custom_hypotheses_never_replace_primary_mass_or_official_rows(client):
    before = client.get("/api/v1/planet-criteria?object_id=sedna").json()
    source = client.get("/api/v1/mass-scenarios").json()
    response = client.post(
        "/api/v1/mass-scenarios/calculate",
        json={
            "target_id": "sedna",
            "analogue_id": "tethys",
            "density_kg_m3": 984,
            "include_source_ranges": True,
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "hypothesis"
    assert result["source_manifest_sha256"] == source["source_manifest_sha256"]
    assert result["mass_kg"] == pytest.approx(5.075314544478849e20)
    assert result["mass_bounds"]["low_kg"] < result["mass_kg"] < result["mass_bounds"]["high_kg"]
    assert result["clearing"]["pi"] < 0.001
    assert source["summary"]["conditional_target_count_meets_model_range"] == 0
    assert client.get("/api/v1/planet-criteria?object_id=sedna").json() == before
    custom = client.post(
        "/api/v1/mass-scenarios/calculate",
        json={
            "target_id": "sedna",
            "density_kg_m3": 2000,
            "include_source_ranges": False,
        },
    ).json()
    assert custom["mass_kg"] / result["mass_kg"] == pytest.approx(2000 / 984)
    assert custom["mass_bounds"] is None


@pytest.mark.parametrize(
    "changes",
    [
        {"density_kg_m3": 0},
        {"density_kg_m3": 10001},
        {"density_kg_m3": "NaN"},
        {"target_id": "earth"},
        {"analogue_id": "fake"},
        {"analogue_id": "tethys"},
    ],
)
def test_invalid_or_false_analogue_inputs_fail_instead_of_becoming_measurements(client, changes):
    body = {"target_id": "sedna", "density_kg_m3": 2000} | changes
    assert client.post("/api/v1/mass-scenarios/calculate", json=body).status_code == 422


def test_source_failures_are_not_empty_or_zero_estimates(client, monkeypatch):
    import science.mass_scenarios

    def failure(*args, **kwargs):
        raise ValueError("integrity_failed")

    monkeypatch.setattr(science.mass_scenarios, "get_mass_scenarios", failure)
    assert client.get("/api/v1/mass-scenarios").status_code == 503
    assert (
        client.post(
            "/api/v1/mass-scenarios/calculate",
            json={
                "target_id": "sedna",
                "density_kg_m3": 2000,
            },
        ).status_code
        == 503
    )
