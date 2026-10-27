import codecs
from pathlib import Path

from network_config import build_cors_allowlist, build_ssl_subject_alt_names


def test_env_file_with_utf8_bom_is_parsed_correctly(tmp_path):
    env_path = tmp_path / ".env"
    env_path.write_bytes(codecs.BOM_UTF8 + b"MONGO_URL=mongodb://localhost:27017\nDB_NAME=retail_book\n")

    data = env_path.read_bytes()
    assert data.startswith(codecs.BOM_UTF8)
    assert data.decode("utf-8-sig").splitlines()[0] == "MONGO_URL=mongodb://localhost:27017"


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
