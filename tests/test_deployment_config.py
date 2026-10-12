import pytest

from api import _parse_cors_origins, app


def test_cors_origins_default_to_local_development_origin():
    assert _parse_cors_origins(None) == ["http://localhost:5173"]


def test_cors_preflight_allows_only_the_configured_development_origin():
    client = app.test_client()
    headers = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    }

    allowed = client.options(
        "/scan",
        headers={**headers, "Origin": "http://localhost:5173"},
    )
    denied = client.options(
        "/scan",
        headers={**headers, "Origin": "https://untrusted.example"},
    )

    assert allowed.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert "Access-Control-Allow-Origin" not in denied.headers


def test_cors_origins_accept_explicit_exact_origins():
    assert _parse_cors_origins(
        " https://vigil.example.com/ , https://vigil-preview.example.com "
    ) == [
        "https://vigil.example.com",
        "https://vigil-preview.example.com",
    ]


def test_cors_origins_accept_exact_production_frontend_origin():
    assert _parse_cors_origins(
        "https://vigilant-ai-frontend.vercel.app"
    ) == ["https://vigilant-ai-frontend.vercel.app"]


@pytest.mark.parametrize(
    "value",
    [
        "",
        "*",
        "https://vigil.example.com/path",
        "https://user@example.com",
        "https://example.com:invalid",
    ],
)
def test_cors_origins_reject_empty_wildcard_or_non_origin_values(value):
    with pytest.raises(ValueError):
        _parse_cors_origins(value)
