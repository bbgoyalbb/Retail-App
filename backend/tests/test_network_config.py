from network_config import build_cors_allowlist, build_ssl_subject_alt_names


def test_build_cors_allowlist_includes_localhost_and_lan_pattern():
    origins, regex = build_cors_allowlist("http://localhost:3000, https://192.168.1.10:3000")

    assert "http://localhost:3000" in origins
    assert "https://192.168.1.10:3000" in origins
    assert "localhost" in regex.lower()
    assert "192\\.168" in regex or "192\\.168\\." in regex or "192\\.168\\." in regex
    assert "10\\." in regex or "10\\\\." in regex


def test_build_ssl_subject_alt_names_includes_local_and_static_hosts():
    hosts = build_ssl_subject_alt_names(["localhost", "127.0.0.1", "192.168.1.10", "shop.local"])

    assert "localhost" in hosts
    assert "127.0.0.1" in hosts
    assert "192.168.1.10" in hosts
    assert "shop.local" in hosts
