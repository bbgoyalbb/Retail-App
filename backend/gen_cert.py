"""Auto-generate a self-signed SSL certificate covering localhost and LAN/static hosts."""
import ipaddress
import os
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from network_config import build_ssl_subject_alt_names

out_dir = Path(__file__).parent
ORG_NAME = os.getenv("FIRM_NAME", "Retail Business")


def detect_local_ipv4s():
    candidates = []
    # Skip socket connection to avoid network profile changes
    # Only use environment variables and ipconfig

    for env_name in ("APP_HOST", "SERVER_HOST", "STATIC_IP"):
        value = os.getenv(env_name)
        if value:
            candidates.append(value)

    for env_name in ("APP_HOSTS", "STATIC_IPS", "CORS_ORIGINS"):
        raw = os.getenv(env_name, "")
        if not raw:
            continue
        for segment in raw.split(","):
            segment = segment.strip().strip("/")
            if not segment:
                continue
            if segment.startswith("http://") or segment.startswith("https://"):
                segment = segment.split("//", 1)[1]
            if "/" in segment:
                segment = segment.split("/", 1)[0]
            if segment and segment not in candidates:
                candidates.append(segment)

    if os.name == "nt":
        try:
            out = subprocess.run(["ipconfig"], capture_output=True, text=True, check=False)
            for line in out.stdout.splitlines():
                if "IPv4 Address" in line or ":" in line:
                    candidate = line.split(":")[-1].strip()
                    if candidate and candidate not in candidates:
                        candidates.append(candidate)
        except Exception:
            pass
    else:
        try:
            out = subprocess.run(["hostname", "-I"], capture_output=True, text=True, check=False)
            for candidate in out.stdout.split():
                if candidate and candidate not in candidates:
                    candidates.append(candidate)
        except Exception:
            pass

    valid = []
    for candidate in candidates:
        candidate = candidate.strip()
        if not candidate:
            continue
        try:
            ip = ipaddress.ip_address(candidate)
        except ValueError:
            continue
        if isinstance(ip, ipaddress.IPv4Address) and ip.is_private and str(ip) not in valid:
            valid.append(str(ip))
    return valid


local_ips = detect_local_ipv4s() or ["127.0.0.1"]
hostnames = build_ssl_subject_alt_names(local_ips)
san_entries = []
for name in hostnames:
    if not name:
        continue
    try:
        san_entries.append(x509.IPAddress(ipaddress.ip_address(name)))
    except ValueError:
        san_entries.append(x509.DNSName(name))

if not san_entries:
    san_entries = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, "Retail App"),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, ORG_NAME),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.now(timezone.utc))
    .not_valid_after(datetime.now(timezone.utc) + timedelta(days=730))
    .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
    .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
    .sign(key, hashes.SHA256())
)

(out_dir / "ssl.key").write_bytes(key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.TraditionalOpenSSL,
    serialization.NoEncryption(),
))
(out_dir / "ssl.crt").write_bytes(cert.public_bytes(serialization.Encoding.PEM))

print(f"Certificate regenerated for hosts: {', '.join(sorted({str(entry.value) if hasattr(entry, 'value') else str(entry) for entry in san_entries}))}")
