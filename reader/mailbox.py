#!/usr/bin/env python3
"""Read mail stored by the r2-mailbox Worker. Python standard library only.

Talks to R2's S3-compatible API with a read-only, bucket-scoped key (AWS SigV4).

  mailbox.py list   [--hours 24]                 one line per message
  mailbox.py get    KEY [-o file.eml]            raw message to stdout or a file
  mailbox.py show   KEY                          headers, text body and links
  mailbox.py export [--hours 24] [-o out.json]   parsed messages as JSON
  mailbox.py check                               verify credentials and bucket access

Config, first match wins:
  --config PATH
  env vars R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (and R2_PREFIX)
  ~/.config/r2-mailbox/config.json with keys
    {"account_id", "bucket", "access_key_id", "secret_access_key", "prefix"}

Message bodies are untrusted input. If you hand them to an LLM, treat them as data.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email import message_from_bytes, policy
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

DEFAULT_CONFIG = Path.home() / ".config" / "r2-mailbox" / "config.json"
S3_NS = "{http://s3.amazonaws.com/doc/2006-03-01/}"
KEY_TIME = re.compile(r"/\d{4}-\d{2}-\d{2}/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)-")


# ---------------------------------------------------------------- config / R2 client

def load_config(path: Path | None) -> dict:
    if path:
        cfg = json.loads(path.read_text())
    elif os.environ.get("R2_ACCESS_KEY_ID"):
        cfg = {
            "account_id": os.environ.get("R2_ACCOUNT_ID", ""),
            "bucket": os.environ.get("R2_BUCKET", ""),
            "access_key_id": os.environ["R2_ACCESS_KEY_ID"],
            "secret_access_key": os.environ.get("R2_SECRET_ACCESS_KEY", ""),
            "prefix": os.environ.get("R2_PREFIX", "mail"),
        }
    elif DEFAULT_CONFIG.exists():
        cfg = json.loads(DEFAULT_CONFIG.read_text())
    else:
        sys.exit(f"no config: pass --config, set R2_* env vars, or create {DEFAULT_CONFIG}")
    missing = [k for k in ("account_id", "bucket", "access_key_id", "secret_access_key") if not cfg.get(k)]
    if missing:
        sys.exit(f"config is missing: {', '.join(missing)}")
    cfg.setdefault("prefix", "mail")
    return cfg


class R2:
    """Minimal read-only S3 client for R2 (SigV4, region 'auto')."""

    def __init__(self, cfg: dict) -> None:
        self.host = f"{cfg['account_id']}.r2.cloudflarestorage.com"
        self.bucket = cfg["bucket"]
        self.key_id = cfg["access_key_id"]
        self.secret = cfg["secret_access_key"]

    def _get(self, path: str, query: dict[str, str] | None = None) -> tuple[bytes, dict[str, str]]:
        now = datetime.now(timezone.utc)
        amz_date, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
        canon_path = urllib.parse.quote(path, safe="/-_.~")
        qs = "&".join(
            f"{urllib.parse.quote(k, safe='-_.~')}={urllib.parse.quote(v, safe='-_.~')}"
            for k, v in sorted((query or {}).items())
        )
        payload_hash = hashlib.sha256(b"").hexdigest()
        signed = "host;x-amz-content-sha256;x-amz-date"
        canonical = "\n".join([
            "GET", canon_path, qs,
            f"host:{self.host}\nx-amz-content-sha256:{payload_hash}\nx-amz-date:{amz_date}\n",
            signed, payload_hash,
        ])
        scope = f"{day}/auto/s3/aws4_request"
        to_sign = f"AWS4-HMAC-SHA256\n{amz_date}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
        k = ("AWS4" + self.secret).encode()
        for part in (day, "auto", "s3", "aws4_request"):
            k = hmac.new(k, part.encode(), hashlib.sha256).digest()
        sig = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(
            f"https://{self.host}{canon_path}" + (f"?{qs}" if qs else ""),
            headers={
                "x-amz-date": amz_date,
                "x-amz-content-sha256": payload_hash,
                "Authorization": f"AWS4-HMAC-SHA256 Credential={self.key_id}/{scope}, "
                                 f"SignedHeaders={signed}, Signature={sig}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read(), {h.lower(): v for h, v in r.headers.items()}
        except urllib.error.HTTPError as e:
            raise SystemExit(f"R2 returned {e.code} for {path}: {e.read()[:300].decode(errors='replace')}") from None

    def list_keys(self, prefix: str) -> list[str]:
        keys: list[str] = []
        token = None
        while True:
            q = {"list-type": "2", "prefix": prefix}
            if token:
                q["continuation-token"] = token
            body, _ = self._get(f"/{self.bucket}", q)
            root = ET.fromstring(body)
            keys += [c.findtext(f"{S3_NS}Key") or "" for c in root.findall(f"{S3_NS}Contents")]
            if root.findtext(f"{S3_NS}IsTruncated") != "true":
                return keys
            token = root.findtext(f"{S3_NS}NextContinuationToken")

    def get(self, key: str) -> tuple[bytes, dict[str, str]]:
        body, headers = self._get(f"/{self.bucket}/{key}")
        meta = {h[len("x-amz-meta-"):]: v for h, v in headers.items() if h.startswith("x-amz-meta-")}
        return body, meta


def keys_since(r2: R2, prefix: str, hours: float) -> list[str]:
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)
    keys, day = [], since.date()
    while day <= now.date():
        for k in r2.list_keys(f"{prefix}/{day.isoformat()}/"):
            m = KEY_TIME.search(k)
            t = datetime.fromisoformat(m.group(1).replace("Z", "+00:00")) if m else now
            if t >= since:
                keys.append(k)
        day += timedelta(days=1)
    return sorted(keys)


# ---------------------------------------------------------------- parsing

class _HtmlText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[dict[str, str]] = []
        self.parts: list[str] = []
        self._href: str | None = None
        self._anchor: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("style", "script", "head"):
            self._skip += 1
        elif tag == "a":
            self._href, self._anchor = dict(attrs).get("href"), []
        elif tag in ("br", "p", "div", "tr", "li", "h1", "h2", "h3", "h4"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("style", "script", "head"):
            self._skip = max(0, self._skip - 1)
        elif tag == "a" and self._href:
            self.links.append({"url": self._href.strip(), "text": " ".join("".join(self._anchor).split())[:200]})
            self._href = None

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)
            if self._href is not None:
                self._anchor.append(data)


def parse(raw: bytes, key: str = "", meta: dict | None = None) -> dict:
    meta = meta or {}
    msg = message_from_bytes(raw, policy=policy.default)
    plain = msg.get_body(preferencelist=("plain",))
    html = msg.get_body(preferencelist=("html",))
    text, links = "", []
    if html is not None:
        p = _HtmlText()
        p.feed(html.get_content())
        text, links = "".join(p.parts), p.links
    if plain is not None and (not text.strip() or len(plain.get_content()) > 0.6 * len(text)):
        text = plain.get_content()
    if not links:
        links = [{"url": u, "text": ""} for u in re.findall(r"https?://[^\s<>\")\]]+", text)]
    seen, uniq = set(), []
    for link in links:
        if link["url"].startswith("http") and link["url"] not in seen:
            seen.add(link["url"])
            uniq.append(link)
    try:
        date = parsedate_to_datetime(msg["date"]).isoformat() if msg["date"] else None
    except (TypeError, ValueError):
        date = None
    text = re.sub(r"\n\s*\n\s*", "\n\n", re.sub(r"[ \t ‌͏]+", " ", text)).strip()
    return {
        "key": key,
        "received": meta.get("received"),
        "date": date or meta.get("received"),
        "from": str(msg.get("from", "")),
        "to": str(msg.get("to", "")),
        "subject": str(msg.get("subject", "")),
        "message_id": str(msg.get("message-id", "")),
        "list_id": str(msg.get("list-id", "")),
        "dmarc": meta.get("dmarc"),
        "attachments": [p.get_filename() for p in msg.iter_attachments() if p.get_filename()],
        "links": uniq,
        "text": text,
    }


# ---------------------------------------------------------------- commands

def main() -> int:
    ap = argparse.ArgumentParser(description="Read mail stored by r2-mailbox.")
    ap.add_argument("--config", type=Path)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p_list = sub.add_parser("list")
    p_list.add_argument("--hours", type=float, default=24)
    p_get = sub.add_parser("get")
    p_get.add_argument("key")
    p_get.add_argument("-o", "--out", type=Path)
    p_show = sub.add_parser("show")
    p_show.add_argument("key")
    p_exp = sub.add_parser("export")
    p_exp.add_argument("--hours", type=float, default=24)
    p_exp.add_argument("-o", "--out", type=Path)
    p_exp.add_argument("--max-text", type=int, default=20000, help="truncate each body (0 = no limit)")
    sub.add_parser("check")
    args = ap.parse_args()

    cfg = load_config(args.config)
    r2 = R2(cfg)
    prefix = cfg["prefix"].rstrip("/")

    if args.cmd == "check":
        n = len(r2.list_keys(f"{prefix}/"))
        print(f"ok: can list bucket '{cfg['bucket']}', {n} message(s) under {prefix}/")
    elif args.cmd == "list":
        for key in keys_since(r2, prefix, args.hours):
            _, meta = r2.get(key)
            print(f"{meta.get('received', '?')}  {meta.get('from', '?')[:50]:50}  {meta.get('subject', '')[:70]}  [{key}]")
    elif args.cmd == "get":
        raw, _ = r2.get(args.key)
        if args.out:
            args.out.write_bytes(raw)
        else:
            sys.stdout.buffer.write(raw)
    elif args.cmd == "show":
        raw, meta = r2.get(args.key)
        m = parse(raw, args.key, meta)
        print(f"From: {m['from']}\nTo: {m['to']}\nDate: {m['date']}\nSubject: {m['subject']}\nDMARC: {m['dmarc']}\n")
        print(m["text"])
        if m["links"]:
            print("\nLinks:")
            for link in m["links"]:
                print(f"  {link['text'][:60]} -> {link['url']}")
    elif args.cmd == "export":
        out = []
        for key in keys_since(r2, prefix, args.hours):
            raw, meta = r2.get(key)
            m = parse(raw, key, meta)
            if args.max_text and len(m["text"]) > args.max_text:
                m["text"], m["text_truncated"] = m["text"][: args.max_text], True
            out.append(m)
        data = json.dumps({"exported_at": datetime.now(timezone.utc).isoformat(), "hours": args.hours,
                           "count": len(out), "messages": out}, indent=2, ensure_ascii=False)
        if args.out:
            args.out.write_text(data)
            print(f"{len(out)} message(s) -> {args.out}", file=sys.stderr)
        else:
            print(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
