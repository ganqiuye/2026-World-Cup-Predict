#!/usr/bin/env python3
"""Merge data/*.json and inject into dashboard/index.html as window.WC_DATA."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
HTML_FILE = ROOT / "dashboard" / "index.html"

FILES = ["tournament.json", "schedule.json", "standings.json", "predictions.json",
         "team-strength.json", "knockout-bracket.json"]
OPTIONAL = ["players.json", "team-profiles.json"]
KEY_MAP = {
    "tournament.json": "tournament",
    "schedule.json": "schedule",
    "standings.json": "standings",
    "predictions.json": "predictions",
    "team-strength.json": "teamStrength",
    "knockout-bracket.json": "knockoutBracket",
    "players.json": "players",
    "team-profiles.json": "teamProfiles",
}


def load_data() -> dict:
    data = {}
    for fname in FILES:
        path = DATA_DIR / fname
        if not path.exists():
            raise FileNotFoundError(f"Missing {path}")
        with open(path, encoding="utf-8") as f:
            data[KEY_MAP[fname]] = json.load(f)
    for fname in OPTIONAL:
        path = DATA_DIR / fname
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data[KEY_MAP[fname]] = json.load(f)
    return data


def inject(html: str, payload: dict) -> str:
    blob = json.dumps(payload, ensure_ascii=False, indent=2)
    pattern = r"(/\* __WC_DATA__ \*/)(.*?)(/\* __END_WC_DATA__ \*/)"
    replacement = rf"\1\n{blob}\n      \3"
    new_html, n = re.subn(pattern, replacement, html, count=1, flags=re.DOTALL)
    if n != 1:
        raise RuntimeError("WC_DATA markers not found in index.html")
    return new_html


def main() -> None:
    payload = load_data()
    html = HTML_FILE.read_text(encoding="utf-8")
    HTML_FILE.write_text(inject(html, payload), encoding="utf-8")
    pred_count = len(payload.get("predictions", {}).get("matches", []))
    sched_count = len(payload.get("schedule", {}).get("matches", []))
    print(f"Injected WC_DATA: {sched_count} scheduled matches, {pred_count} predictions")
    print(f"Updated: {HTML_FILE}")


if __name__ == "__main__":
    main()
