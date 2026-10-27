import os
import re
from typing import Iterable, List, Optional, Tuple


def _clean_host_value(value: str) -> str:
    value = value.strip().strip("/")
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        value = value.split("//", 1)[1]
    if "/" in value:
        value = value.split("/", 1)[0]
    if value.startswith("[") and "]" in value:
        value = value[1:value.index("]")]
    if ":" in value and value.count(":") == 1 and value.rsplit(":", 1)[1].isdigit():
        value = value.rsplit(":", 1)[0]
    return value


def _parse_csv(value: Optional[str]) -> List[str]:
    if not value:
        return []
    values = []
    for raw in value.split(","):
        host = _clean_host_value(raw)
        if host:
            values.append(host)
    return values


def _normalize_origin(host: str, port: Optional[str] = None) -> str:
    host = _clean_host_value(host)
    if not host:
        return ""
    if host.startswith("http://") or host.startswith("https://"):
        return host.rstrip("/")
    scheme = "https" if (port and str(port) not in {"80", "3000"}) or host.startswith("192.") or host.startswith("10.") else "http"
    if host.startswith("localhost") or host.startswith("127.") or host.startswith("0.0.0.0"):
        scheme = "http"
    if port is None:
        port = "3000"
    return f"{scheme}://{host}:{port}".rstrip("/")


def _dedupe(values: Iterable[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        clean = value.strip().rstrip("/")
        if not clean or clean in seen:
            continue
        seen.add(clean)
        result.append(clean)
    return result


def build_cors_allowlist(raw_value: Optional[str] = None, debug: bool = False) -> Tuple[List[str], Optional[str]]:
    if debug:
        return ["*"], None

    defaults = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "https://localhost:8000",
    ]

    explicit_hosts = _parse_csv(raw_value)
    extra_origins = []
    for host in explicit_hosts:
        extra_origins.extend([
            _normalize_origin(host, "3000"),
            _normalize_origin(host, "8001"),
        ])

    for host in _parse_csv(os.getenv("APP_HOSTS")):
        extra_origins.extend([
            _normalize_origin(host, "3000"),
            _normalize_origin(host, "8001"),
        ])

    network_patterns = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "192.168",
        "10.",
        "172.",
    ]
    regex_parts = [
        r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])(?::\d+)?$",
        r"https?://(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)(?::\d+)?$",
    ]
    if explicit_hosts:
        regex_parts.append(r"https?://(" + "|".join(re.escape(h) for h in explicit_hosts if h) + r")(?::\d+)?$")
    regex = "|".join(regex_parts)

    origins = _dedupe(defaults + extra_origins)
    if not origins:
        origins = defaults
    return origins, regex


def build_ssl_subject_alt_names(hosts: Optional[Iterable[str]] = None) -> List[str]:
    names = []
    seen = set()

    if hosts is None:
        hosts = []
    for host in hosts:
        value = str(host).strip()
        if not value:
            continue
        value = value.strip("/")
        if value.startswith("http://") or value.startswith("https://"):
            value = value.split("//", 1)[1]
        if value.startswith("[") and "]" in value:
            value = value[1:value.index("]")]
        if ":" in value and value.count(":") == 1 and value.rsplit(":", 1)[1].isdigit():
            value = value.rsplit(":", 1)[0]
        if value and value not in seen:
            seen.add(value)
            names.append(value)

    for host in [
        "localhost",
        "127.0.0.1",
        "::1",
        "0.0.0.0",
        os.getenv("APP_HOST"),
        os.getenv("STATIC_IP"),
        os.getenv("SERVER_HOST"),
    ]:
        if host and host not in seen:
            seen.add(host)
            names.append(host)

    for host in _parse_csv(os.getenv("APP_HOSTS")):
        if host and host not in seen:
            seen.add(host)
            names.append(host)

    for host in _parse_csv(os.getenv("STATIC_IPS")):
        if host and host not in seen:
            seen.add(host)
            names.append(host)

    for host in _parse_csv(os.getenv("CORS_ORIGINS")):
        clean = _clean_host_value(host)
        if clean and clean not in seen:
            seen.add(clean)
            names.append(clean)

    return names
