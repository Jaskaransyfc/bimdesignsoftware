#!/usr/bin/env python3
"""Smoke-test 2D Floor Plan Engine output endpoints.

Usage:
  python3 floor_plan_smoke_test.py <project_id>
  python3 floor_plan_smoke_test.py <project_id> --base-url http://127.0.0.1:8000

What it checks:
- plan-view.svg
- section-view.svg
- elevation-view.svg
- plan-view.dxf

Each request is considered successful when it returns HTTP 200 and non-empty content.
"""

from __future__ import annotations

import argparse
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def fetch(url: str) -> tuple[int, bytes, str]:
    request = Request(url, headers={"Accept": "*/*"})
    with urlopen(request, timeout=30) as response:
        return response.status, response.read(), response.headers.get_content_type()


def check_endpoint(name: str, url: str, expect_svg: bool = False, expect_dxf: bool = False) -> int:
    try:
        status, body, content_type = fetch(url)
    except HTTPError as error:
        print(f"FAIL {name}: HTTP {error.code} -> {url}")
        return 1
    except URLError as error:
        print(f"FAIL {name}: {error.reason} -> {url}")
        return 1
    except Exception as error:
        print(f"FAIL {name}: {error} -> {url}")
        return 1

    if status != 200:
        print(f"FAIL {name}: HTTP {status} -> {url}")
        return 1

    if not body:
        print(f"FAIL {name}: empty response -> {url}")
        return 1

    text = body.lstrip()[:80].decode("utf-8", errors="ignore")
    if expect_svg and "<svg" not in text.lower():
        print(f"WARN {name}: expected SVG, got content-type={content_type}, preview={text!r}")
    elif expect_dxf and not text.startswith("0\nSECTION") and not text.startswith("SECTION"):
        print(f"WARN {name}: expected DXF-like content, got content-type={content_type}, preview={text!r}")
    else:
        print(f"OK   {name}: HTTP 200, content-type={content_type}, bytes={len(body)}")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Smoke test 2D Floor Plan Engine backend endpoints.")
    parser.add_argument("project_id", help="Project UUID to test")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Backend base URL")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    project_id = args.project_id.strip()

    checks = [
        ("plan-view.svg", f"{base_url}/api/projects/{project_id}/plan-view.svg", True, False),
        ("section-view.svg", f"{base_url}/api/projects/{project_id}/section-view.svg", True, False),
        ("elevation-view.svg", f"{base_url}/api/projects/{project_id}/elevation-view.svg", True, False),
        ("plan-view.dxf", f"{base_url}/api/projects/{project_id}/plan-view.dxf", False, True),
    ]

    exit_code = 0
    for name, url, expect_svg, expect_dxf in checks:
        exit_code |= check_endpoint(name, url, expect_svg=expect_svg, expect_dxf=expect_dxf)

    if exit_code == 0:
        print("2D Floor Plan Engine smoke test passed.")
    else:
        print("2D Floor Plan Engine smoke test failed.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
