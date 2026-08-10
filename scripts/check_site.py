#!/usr/bin/env python3
"""Dependency-free checks for the public static archive."""

from __future__ import annotations

import re
import json
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
MEDIA_EXTENSIONS = {".aac", ".m4a", ".mov", ".mp3", ".mp4", ".wav"}
PRIVATE_MARKERS = ("/" + "Users/", "/private/" + "tmp/", "Personal/" + "playground/")


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if value and name in {"href", "src"}:
                self.links.append(value)


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    )
    return [ROOT / item.decode() for item in result.stdout.split(b"\0") if item]


def local_target(source: Path, value: str) -> Path | None:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("#", "mailto:", "tel:", "data:")):
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    target = ROOT / path.lstrip("/") if path.startswith("/") else source.parent / path
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target


def main() -> int:
    errors: list[str] = []
    files = tracked_files()

    for path in files:
        if path.suffix.lower() in MEDIA_EXTENSIONS:
            errors.append(f"downloaded audio/video is not allowed: {path.relative_to(ROOT)}")

        if path.suffix.lower() not in {".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".txt", ".yml", ".yaml"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for marker in PRIVATE_MARKERS:
            if marker in text:
                errors.append(f"private machine path `{marker}` found in {path.relative_to(ROOT)}")

    for html in sorted(ROOT.rglob("*.html")):
        if ".git" in html.parts:
            continue
        parser = LinkParser()
        parser.feed(html.read_text(encoding="utf-8"))
        for value in parser.links:
            target = local_target(html, value)
            if target is not None and not target.exists():
                errors.append(
                    f"missing local target in {html.relative_to(ROOT)}: {value}"
                )

    culture = (ROOT / "tennis-culture" / "index.html").read_text(encoding="utf-8")
    for required in ("PEOPLE", "PLACES", "DAVID CHOE", "SOURCES.md"):
        if not re.search(re.escape(required), culture, re.IGNORECASE):
            errors.append(f"tennis-culture record lost required section/link: {required}")

    try:
        catalog = json.loads((ROOT / "data/catalog.json").read_text(encoding="utf-8"))
        corpus = json.loads((ROOT / "data/corpus-map.json").read_text(encoding="utf-8"))
        routes = {item["id"] for item in catalog["items"]}
        documented = {item["id"] for item in corpus.get("documents", [])}
        if routes != documented:
            errors.append(f"corpus map coverage mismatch: {len(documented)} documented for {len(routes)} reader routes")
        for item in corpus.get("documents", []):
            if not isinstance(item.get("anchors"), list) or not isinstance(item.get("related"), list) or not item.get("segments"):
                errors.append(f"corpus map entry incomplete: {item.get('id')}")
    except (OSError, ValueError, KeyError) as exc:
        errors.append(f"invalid corpus map: {exc}")

    if errors:
        print("Public archive validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Public archive validation passed: {len(files)} tracked files checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
