#!/usr/bin/env python3
"""Build the public Dirty Hands edited transcript from verified local ASR.

The full-film pass has one decoder timing failure in the musical opening.  A
separate 180-500 second pass replaces that window before the corpus cleaner is
run.  The release then folds the film-checked scene guide into the transcript
as clearly labelled bracketed notes; those notes are editorial, not dialogue.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile


def read(path: pathlib.Path) -> dict:
    return json.loads(path.read_text())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", type=pathlib.Path, required=True)
    parser.add_argument("--repair", type=pathlib.Path, required=True)
    parser.add_argument("--scenes", type=pathlib.Path, required=True)
    parser.add_argument("--cleaner", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    parser.add_argument("--catalog", type=pathlib.Path)
    args = parser.parse_args()

    raw = read(args.raw)
    repair = read(args.repair)

    # The repair file begins at film time 03:00 and ends at 08:20.
    repaired = [s for s in raw["segments"] if s["end"] <= 180 or s["start"] >= 500]
    repaired += [
        {**s, "start": round(s["start"] + 180, 3), "end": round(s["end"] + 180, 3)}
        for s in repair["segments"]
    ]
    repaired.sort(key=lambda s: (s["start"], s["end"]))
    for left, right in zip(repaired, repaired[1:]):
        if left["start"] > right["start"]:
            raise SystemExit("repaired transcript is not in time order")

    with tempfile.TemporaryDirectory(prefix="dirty-hands-release-") as td:
        td = pathlib.Path(td)
        stitched_path = td / "dirty-hands.asr.json"
        cleaned_path = td / "dirty-hands.clean.json"
        raw["segments"] = repaired
        stitched_path.write_text(json.dumps(raw))
        subprocess.run(
            [sys.executable, str(args.cleaner), str(stitched_path), "--out", str(cleaned_path)],
            check=True,
        )
        cleaned = read(cleaned_path)

    scene_doc = read(args.scenes)
    scene_doc["survey"]["provenance"] = (
        "EDITORIAL — bracketed scene descriptions were checked against the local "
        "640x480 source video on 2026-08-09. They describe picture and action; "
        "they are not recorded dialogue."
    )
    scene_doc["survey"]["why"] = (
        "The transcript is published as Jerry's edited study edition. Scene notes "
        "are bracketed and visually distinct so editorial description is not "
        "mistaken for recorded speech."
    )
    args.scenes.write_text(json.dumps(scene_doc, ensure_ascii=False, separators=(",", ":")))
    scenes = scene_doc["scenes"]
    def publishable(segment: dict) -> bool:
        start = round(float(segment["start"]), 2)
        text = segment.get("text", "").strip()
        if not text or text == "Thank you.":
            return False
        # These are musical passages. Whisper's earlier "ASEASE..." output was
        # a failed rendering of the repeated chant; an edited transcript should
        # describe the sequence once rather than print guessed lyrics dozens of
        # times. The replacement scene notes below preserve what is happening.
        if (188.0 <= start < 247.5
                or 403.0 <= start < 452.3
                or 780.0 <= start < 861.0
                or 4563.0 <= start < 4579.0
                or 5322.0 <= start < 5351.5
                or start == 902.6):
            return False
        return True

    rows = [
        {
            "t": round(float(s["start"]), 2),
            "x": s["text"].strip(),
            **({"marker": s["marker"]} if s.get("marker") else {}),
        }
        for s in cleaned["segments"]
        if publishable(s)
    ]
    scene_overrides = {
        3: "[Opening — Color bars and title imagery give way to a studio interview, then handheld footage of David and his group travelling through Brazzaville and rural Congo.]",
        186: "[Music/chant montage — Congo travel footage, villagers, drawings and painted walls cut against a deliberately crude repeated refrain. The repeated lyrics are summarized instead of reproduced line by line.]",
        378: "[Studio and artwork montage — David explains who he makes art for while the film cuts between his interview, drawings, paintings and hands working at close range.]",
    }
    rows += [
        {
            "t": float(scene["t"]),
            "x": scene_overrides.get(
                int(scene["t"]),
                f"[Scene — {scene['title']}: {scene['description']}]",
            ),
            "scene": True,
        }
        for scene in scenes
    ]
    extra_notes = [
        (780.0, "[Family-history montage — Hallways, family photographs and artwork bridge the graffiti section into interviews about David’s father. Repetitive machine text over the music was removed.]"),
        (902.6, "[Archival/interview transition — The soundtrack masks the words here, so the unverified machine caption was removed.]"),
        (4563.0, "[Sung refrain — ‘Take it away’ repeats over the montage; the refrain is summarized once.]"),
        (5322.0, "[Brief art-and-music transition — The speech model produced repeated fragments that could not be verified, so they were removed.]"),
        (5413.0, "[Closing montage — Night footage, art, friends and party images carry the film toward its final title; stray repeated ‘Thank you’ captions from the speech model were removed because they are not dialogue.]"),
    ]
    rows += [{"t": t, "x": note, "scene": True} for t, note in extra_notes]
    rows.sort(key=lambda s: (s["t"], 0 if s.get("scene") else 1))

    output = {
        "id": "vimeo-dirty-hands-laff",
        "title": "Dirty Hands: The Art and Crimes of David Choe",
        "kind": "film",
        "group": "Films",
        "source": "whisper-large-v3-turbo + editorial review",
        "provenance": {
            "archive": "Owner-supplied film copy",
            "file": "dirty_hands_laff (480p).mp4",
            "runtime_seconds": 5588.16,
        },
        "verification": {
            "reviewed_against_video": "2026-08-09",
            "video": "640x480 H.264/AAC local source",
            "method": "Full-film re-transcription, isolated repair of the 03:00-08:20 music window, automated hallucination cleaning, and visual scene review.",
            "scene_notes": len(scenes) + len(extra_notes),
        },
        "cleaning": cleaned.get("cleaning", {}),
        "vocab": {},
        "segments": rows,
        "text_withheld": False,
    }
    args.out.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    if args.catalog:
        catalog = read(args.catalog)
        item = next(i for i in catalog["items"] if i["id"] == output["id"])
        dialogue = [s for s in rows if not s.get("scene")]
        item.update({
            "k": "film",
            "g": "Films",
            "d": 5588,
            "s": "edited whisper",
            "w": sum(len(re.findall(r"[A-Za-z0-9']+", s["x"])) for s in dialogue),
            "n": len(rows),
            "e": 1,
            "c": "Films",
        })
        args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {len(rows)} rows ({len(scenes) + len(extra_notes)} scene notes) to {args.out}")


if __name__ == "__main__":
    main()
