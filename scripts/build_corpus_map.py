#!/usr/bin/env python3
"""Build an auditable, corpus-wide documentation and related-transcript map.

This is deliberately not a story detector.  Every transcript is documented
with measured source facts and distinctive terms, then compared against every
other transcript using only their full text.  A related result is a lead for a
reader to inspect, not a claim that two passages tell the same story.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORD = re.compile(r"[A-Za-z][A-Za-z']{2,}")
STOP = frozenset("""about after again also always among another around because been being before between both but can cant could didnt does dont down each even every for from get getting got had has have having her here hers him his how into its just like maybe more most much must not now off often once one only other our out over own really said says see she should since some still such take than that the their them then there these they this those through time to too two up use very was were what when where which while who will with without would you your youre yeah yes and are as at be by do he if in is it me my no of on or so we a an i im its thats theyre were youd ive ill isnt arent wasnt werent doesnt dont didnt wont wouldnt couldnt shouldnt havent hasnt hadnt""".split())


def tokens(text: str) -> list[str]:
    return [w.lower() for w in WORD.findall(text) if w.lower() not in STOP]


def main() -> None:
    catalog = json.loads((ROOT / "data/catalog.json").read_text())
    # The catalog intentionally has a few alternate-source cards for one
    # reader route.  Documentation is per real reader route, not per card.
    items = {}
    for item in catalog["items"]:
        items.setdefault(item["id"], item)

    docs = []
    df: Counter[str] = Counter()
    for ident, item in sorted(items.items(), key=lambda pair: pair[1]["t"].lower()):
        source = json.loads((ROOT / "data" / f"{ident}.json").read_text())
        words = tokens(" ".join(s.get("x", "") for s in source.get("segments", [])))
        counts = Counter(words)
        df.update(counts)
        docs.append({"item": item, "counts": counts, "words": len(words),
                     "segments": len(source.get("segments", []))})

    total = len(docs)
    vectors = []
    for doc in docs:
        # Very rare one-offs cannot relate two transcripts; very common words
        # make every long interview look alike.  The middle range gives leads a
        # reader can verify in the source text.
        weights = {
            term: (1 + math.log(count)) * math.log((total + 1) / (df[term] + 1))
            for term, count in doc["counts"].items()
            if 2 <= df[term] <= max(8, total // 4)
        }
        top = sorted(weights, key=lambda term: (-weights[term], term))[:48]
        vector = {term: weights[term] for term in top}
        norm = math.sqrt(sum(weight * weight for weight in vector.values())) or 1.0
        vectors.append((vector, norm))
        doc["anchors"] = top[:8]

    related: list[list[dict]] = [[] for _ in docs]
    for left in range(total):
        va, na = vectors[left]
        for right in range(left + 1, total):
            vb, nb = vectors[right]
            shared = set(va).intersection(vb)
            if len(shared) < 2:
                continue
            score = sum(va[t] * vb[t] for t in shared) / (na * nb)
            if score <= 0:
                continue
            row_l = {"id": docs[right]["item"]["id"], "terms": sorted(shared)[:5], "score": round(score, 4)}
            row_r = {"id": docs[left]["item"]["id"], "terms": sorted(shared)[:5], "score": round(score, 4)}
            related[left].append(row_l)
            related[right].append(row_r)

    output_docs = []
    for index, doc in enumerate(docs):
        item = doc["item"]
        output_docs.append({
            "id": item["id"], "title": item["t"], "kind": item["k"], "group": item["g"],
            "duration": item["d"], "words": doc["words"], "segments": doc["segments"],
            "anchors": doc["anchors"],
            "related": sorted(related[index], key=lambda row: (-row["score"], row["id"]))[:4],
        })

    output = {
        "schema": "choe-corpus/corpus-map@1",
        "survey": {
            "reader_routes": total,
            "catalog_cards": len(catalog["items"]),
            "full_text_scanned": total,
            "method": "Every reader-route transcript was tokenized in full. Distinctive terms use document frequency and TF-IDF; related entries share at least two such terms across full transcripts.",
            "boundary": "This documents coverage and gives related-transcript leads. It does not claim that a lexical overlap is the same story; the separate Stories shelf remains hand-verified.",
        },
        "documents": output_docs,
    }
    (ROOT / "data/corpus-map.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote corpus map for {total} reader routes")


if __name__ == "__main__":
    main()
