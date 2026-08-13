#!/usr/bin/env python3
"""Measure the official channel's recent audiovisual editing without storing media.

The input is a directory of yt-dlp metadata-only ``*.info.json`` files. Video
and audio are decoded from their temporary public stream URLs, but only derived
measurements and disposable contact sheets are written.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import math
import re
import statistics
import subprocess
import threading
from pathlib import Path


PRINT_LOCK = threading.Lock()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--contact-sheet-dir", type=Path, required=True)
    parser.add_argument("--first-index", type=int, default=1)
    parser.add_argument("--last-index", type=int, default=119)
    parser.add_argument("--indices", help="Comma-separated override, e.g. 1,83,119")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--max-video-height", type=int, default=240)
    parser.add_argument("--video-timeout", type=int, default=150)
    parser.add_argument("--audio-timeout", type=int, default=90)
    return parser.parse_args()


def load_items(args: argparse.Namespace) -> list[tuple[int, Path, dict]]:
    selected = None
    if args.indices:
        selected = {int(value) for value in args.indices.split(",")}
    items = []
    for path in sorted(args.metadata_dir.glob("*.info.json")):
        match = re.match(r"(\d{3})-", path.name)
        if not match:
            continue
        index = int(match.group(1))
        if index == 0 or not (args.first_index <= index <= args.last_index):
            continue
        if selected is not None and index not in selected:
            continue
        items.append((index, path, json.loads(path.read_text())))
    return items


def choose_video(formats: list[dict], max_height: int) -> dict:
    candidates = [
        fmt for fmt in formats
        if fmt.get("url") and fmt.get("vcodec") not in (None, "none")
        and fmt.get("acodec") in (None, "none") and (fmt.get("height") or 0) <= max_height
    ]
    if not candidates:
        candidates = [
            fmt for fmt in formats
            if fmt.get("url") and fmt.get("vcodec") not in (None, "none")
            and fmt.get("acodec") in (None, "none")
        ]
    if not candidates:
        raise ValueError("no video-only format")
    return max(candidates, key=lambda fmt: (fmt.get("height") or 0, -(fmt.get("tbr") or 99999)))


def choose_audio(formats: list[dict]) -> dict:
    candidates = [
        fmt for fmt in formats
        if fmt.get("url") and fmt.get("acodec") not in (None, "none")
        and fmt.get("vcodec") in (None, "none")
    ]
    if not candidates:
        raise ValueError("no audio-only format")
    preferred = [fmt for fmt in candidates if fmt.get("format_id") in {"140", "251"}]
    if preferred:
        return min(preferred, key=lambda fmt: 0 if fmt.get("format_id") == "140" else 1)
    return min(candidates, key=lambda fmt: (abs((fmt.get("abr") or 96) - 96), fmt.get("abr") or 99999))


def run(command: list[str], timeout: int = 150) -> str:
    completed = subprocess.run(command, text=True, stdout=subprocess.DEVNULL,
                               stderr=subprocess.PIPE, check=False, timeout=timeout)
    if completed.returncode:
        tail = "\n".join(completed.stderr.splitlines()[-12:])
        raise RuntimeError(f"ffmpeg exited {completed.returncode}:\n{tail}")
    return completed.stderr


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def measure_video(url: str, duration: float, sheet: Path, timeout: int) -> dict:
    fps = 12 / max(duration, 1)
    graph = (
        "[0:v]scale=192:-2,split=2[scene][sample];"
        "[scene]scdet=threshold=10,metadata=mode=print:key=lavfi.scd.time[sceneout];"
        f"[sample]fps={fps:.8f},scale=256:-2,tile=4x3:padding=4:margin=4[sheet]"
    )
    stderr = run([
        "ffmpeg", "-y", "-nostdin", "-hide_banner", "-loglevel", "info", "-i", url,
        "-filter_complex", graph,
        "-map", "[sceneout]", "-f", "null", "-",
        "-map", "[sheet]", "-frames:v", "1", "-q:v", "5", str(sheet),
    ], timeout=timeout)
    cuts = sorted({
        round(float(value), 3)
        for value in re.findall(r"lavfi\.scd\.time=([0-9.]+)", stderr)
        if 0.3 < float(value) < duration - 0.3
    })
    boundaries = [0.0, *cuts, duration]
    shots = [boundaries[i + 1] - boundaries[i] for i in range(len(boundaries) - 1)]
    return {
        "scene_threshold_percent": 10,
        "detected_cuts": len(cuts),
        "cuts_per_minute": round(len(cuts) / max(duration / 60, 1 / 60), 2),
        "median_shot_seconds": round(statistics.median(shots), 2),
        "p10_shot_seconds": round(percentile(shots, 0.1) or 0, 2),
        "p90_shot_seconds": round(percentile(shots, 0.9) or 0, 2),
        "contact_sheet": sheet.name,
    }


def measure_audio(url: str, duration: float, timeout: int) -> dict:
    stderr = run([
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "info", "-i", url,
        "-af", "silencedetect=noise=-40dB:d=0.25,ebur128=peak=true", "-f", "null", "-",
    ], timeout=timeout)
    starts = [float(value) for value in re.findall(r"silence_start: ([0-9.]+)", stderr)]
    ends = [float(value) for value in re.findall(r"silence_end: ([0-9.]+)", stderr)]
    if len(ends) < len(starts):
        ends.append(duration)
    silence_seconds = sum(max(0, end - start) for start, end in zip(starts, ends))
    summary = stderr.rsplit("Summary:", 1)[-1]
    integrated = re.search(r"I:\s+(-?[0-9.]+) LUFS", summary)
    range_match = re.search(r"LRA:\s+([0-9.]+) LU", summary)
    peak = re.search(r"Peak:\s+(-?[0-9.]+) dBFS", summary)
    return {
        "silence_events": len(starts),
        "silence_events_per_minute": round(len(starts) / max(duration / 60, 1 / 60), 2),
        "silence_ratio": round(min(1, silence_seconds / max(duration, 1)), 4),
        "integrated_lufs": float(integrated.group(1)) if integrated else None,
        "loudness_range_lu": float(range_match.group(1)) if range_match else None,
        "true_peak_dbfs": float(peak.group(1)) if peak else None,
    }


def content_signals(info: dict) -> dict:
    text = " ".join([
        info.get("title") or "", info.get("description") or "",
        " ".join(info.get("tags") or []),
    ]).lower()
    return {
        "art_process": bool(re.search(r"\b(art|artist|paint|draw|canvas|underpaint|creative|color|masterpiece)\b", text)),
        "tutorial": bool(re.search(r"\b(tutorial|how to|guide|technique|step-by-step|lesson)\b", text)),
        "story_or_portrait": bool(re.search(r"\b(story|remember|journey|portrait|mom|dad|friends?|old boyz|thumbs up|explores?)\b", text)),
        "direct_address": bool(re.search(r"\b(you|your|yourself|why|how can|how to|don't|be |learn|embrace|overcome)\b", text)),
    }


def analyze_one(item: tuple[int, Path, dict], sheet_dir: Path, max_height: int,
                video_timeout: int, audio_timeout: int) -> dict:
    index, _path, info = item
    duration = float(info.get("duration") or 0)
    video = choose_video(info.get("formats") or [], max_height)
    audio = choose_audio(info.get("formats") or [])
    sheet = sheet_dir / f"{index:03d}-{info['id']}.jpg"
    result = {
        "playlist_index": index,
        "id": info["id"],
        "title": info.get("title"),
        "upload_date": info.get("upload_date"),
        "duration_seconds": duration,
        "url": info.get("webpage_url"),
        "channel": info.get("channel"),
        "channel_id": info.get("channel_id"),
        "content_signals": content_signals(info),
        "measurement_provenance": {
            "video_format": video.get("format_id"),
            "video_height": video.get("height"),
            "audio_format": audio.get("format_id"),
            "media_retained": False,
            "contact_sheet_retained_locally": True,
        },
    }
    try:
        result["edit_metrics"] = measure_video(video["url"], duration, sheet, video_timeout)
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        result["edit_metrics"] = None
        result["video_measurement_error"] = type(error).__name__
    try:
        result["sound_metrics"] = measure_audio(audio["url"], duration, audio_timeout)
    except (RuntimeError, subprocess.TimeoutExpired) as error:
        result["sound_metrics"] = None
        result["sound_measurement_error"] = type(error).__name__
    with PRINT_LOCK:
        cut_rate = result["edit_metrics"]["cuts_per_minute"] if result["edit_metrics"] else "ERR"
        print(f"[{index:03d}] {result['title']} — {cut_rate} cuts/min", flush=True)
    return result


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.contact_sheet_dir.mkdir(parents=True, exist_ok=True)
    items = load_items(args)
    if not items:
        raise SystemExit("No metadata records selected")
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(
                analyze_one, item, args.contact_sheet_dir, args.max_video_height,
                args.video_timeout, args.audio_timeout,
            ): item[0]
            for item in items
        }
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())
            args.output.write_text(json.dumps({
                "scope": {
                    "channel": "David Choe",
                    "channel_id": "UC8nsCoikuQdKJflLAOEwlTw",
                    "first_playlist_index": min(item[0] for item in items),
                    "last_playlist_index": max(item[0] for item in items),
                    "expected_videos": len(items),
                    "measured_videos": len(results),
                    "rights": "metadata and derived measurements only; source media not retained",
                },
                "videos": sorted(results, key=lambda value: value["playlist_index"]),
            }, indent=2) + "\n")


if __name__ == "__main__":
    main()
