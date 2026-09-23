#!/usr/bin/env python3
"""Throwaway converter: parse the dimension-guides markdown into seed/scales.json.

Usage: python3 scripts/convert-guides.py [guides_dir] [out_json]
"""
import json
import re
import sys
from pathlib import Path

GUIDES = Path(sys.argv[1] if len(sys.argv) > 1 else
              "/home/flaviocpontes/guide_to_dimensions/Guide To Describing Dimensions")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "seed/scales.json")

# guide file -> (scale id, name, derived_from)
GENERAL = {
    "General Scale of Size": ("general.size", "General Scale of Size", None),
    "General Scale of Height": ("general.height", "General Scale of Height", None),
    "General Scale of Intensity": ("general.intensity", "General Scale of Intensity", None),
    "General Scale of Width": ("general.width", "General Scale of Width", None),
    "General Scale of Length": ("general.length", "General Scale of Length", None),
    "General Scale of Weight": ("general.weight", "General Scale of Weight", None),
    "General Scale of Temperature": ("general.temperature", "General Scale of Temperature", None),
    "General Scale of Distance": ("general.distance", "General Scale of Distance", None),
    "General Scale of Openess": ("general.openness", "General Scale of Openness", None),
    "General Scale of Volume": ("general.volume", "General Scale of Volume", None),
    "General Scale of Agreeableness": ("general.agreeableness", "General Scale of Agreeableness", None),
    "General Scale of Magnitude": ("general.magnitude", "General Scale of Magnitude", None),
    "General Scale of Prominence": ("general.prominence", "General Scale of Prominence", None),
    "General Scale of Smoothness": ("general.smoothness", "General Scale of Smoothness", None),
    "The Scale of Thickness Words (Fine-Grained)": ("general.thickness", "Scale of Thickness (Fine-Grained)", None),
}

DERIVED = {
    "Women’s Shoes Heels Height": ("shoes.heel_height", "Women's Shoes Heel Height", "general.height"),
    "Women’s Shoes Platform Height": ("shoes.platform_height", "Women's Shoes Platform Height", "general.height"),
}

ZONE_PATTERNS = [
    (re.compile(r"Neutral", re.I), "neutral", False),
    (re.compile(r"\(From Most Extreme to Least\)", re.I), "low", True),   # reversed
    (re.compile(r"\(From Least Extreme to Most\)", re.I), "high", False), # in order
]

ANCHOR_RE = re.compile(
    r"\d[\d.]*\s*(?:[-–]\s*\d[\d.]*\s*)?\+?\s*(?:inch(?:es)?|in\b|cm|mm|foot|feet)", re.I)


def parse_scale(md: Path):
    """Return list of (zone, phrases, nuance, anchors) in rank order."""
    steps = []
    zone = None
    for line in md.read_text(encoding="utf-8").splitlines():
        header = re.match(r"^#{3,4}\s+\*\*(.+?)\*\*\s*$", line.strip())
        if header:
            title = header.group(1)
            zone = None
            for pat, z, _rev in ZONE_PATTERNS:
                if pat.search(title):
                    zone = z
                    break
            continue
        bullet = re.match(r"^-\s+\*\*(.+?)\*\*\s*(.*)$", line.strip())
        if bullet and zone:
            phrases_raw, rest = bullet.group(1), bullet.group(2)
            # "From Most Extreme to Least" in the low zone lists the most-low
            # first, so listed order IS rank order for every zone: no reversal.
            if "nuance" in phrases_raw.lower().replace("-", "") or ":" in phrases_raw:
                # nested nuance bullet -> attach to the previous step
                text = rest.strip() or bullet.group(0)
                if steps:
                    steps[-1]["nuance"] = (steps[-1]["nuance"] + " " + text).strip()
                continue
            phrases = [p.strip() for p in phrases_raw.split("/") if p.strip()]
            nuance = rest.strip()
            steps.append({"zone": zone, "phrases": phrases,
                          "nuance": nuance, "anchors": []})
    for s in steps:
        s["anchors"] = sorted(set(ANCHOR_RE.findall(s["nuance"])))
    return steps


# adjective forms used by the prompt compiler for clause assembly,
# keyed by scale id -> rank -> adjective stack
ADJ_OVERRIDE = {
    "shoes.heel_height": {
        1: ["ground-level"], 2: ["kitten-height"], 3: ["low"], 4: ["mid-height"],
        5: ["high"], 6: ["sky-high"], 7: ["extreme", "sky-high"],
    },
    "shoes.platform_height": {
        1: ["ground-flush"], 2: ["subtly lifted"], 3: ["flatform"], 4: ["standard"],
        5: ["chunky"], 6: ["massive"], 7: ["extremely towering", "colossal mega"],
    },
}


def build(scale_id, name, domain, derived_from, steps, provenance):
    adj_map = ADJ_OVERRIDE.get(scale_id, {})
    return {
        "id": scale_id, "name": name, "domain": domain,
        "derived_from": derived_from, "provenance": provenance,
        "steps": [
            {"rank": i + 1, "zone": s["zone"], "phrases": s["phrases"],
             "adjectives": adj_map.get(i + 1, s["phrases"]),
             "nuance": s["nuance"], "anchors": s["anchors"]}
            for i, s in enumerate(steps)
        ],
    }


# Hand-authored shoe-domain derivations (phrase lists aligned with the
# magnitude codex in world_of_gynoids' visual-consistency-engine §4c).
AUTHORED = [
    {"id": "shoes.pitch", "name": "Shoe Heel Pitch", "domain": "shoes",
     "derived_from": "general.height",
     "provenance": "authored 2026-09-18 from magnitude codex (visual-consistency-engine §4c)",
     "steps": [
         {"zone": "low", "phrases": ["flat", "zero incline"]},
         {"zone": "low", "phrases": ["minimal incline"]},
         {"zone": "low", "phrases": ["gentle, gradual incline"]},
         {"zone": "neutral", "phrases": ["moderate incline"]},
         {"zone": "high", "phrases": ["steep incline"]},
         {"zone": "high", "phrases": ["very steep"]},
         {"zone": "high", "phrases": ["extremely steep"]},
         {"zone": "high", "phrases": ["near-vertical, en pointe"]},
     ]},
    {"id": "shoes.toe_spring", "name": "Shoe Toe Spring", "domain": "shoes",
     "derived_from": "general.height",
     "provenance": "authored 2026-09-18 from corpus prompts",
     "steps": [
         {"zone": "low", "phrases": ["nearly flat sole"]},
         {"zone": "low", "phrases": ["subtle toe spring"]},
         {"zone": "neutral", "phrases": ["gentle toe spring"]},
         {"zone": "high", "phrases": ["pronounced toe spring"]},
         {"zone": "high", "phrases": ["steep toe spring"]},
         {"zone": "high", "phrases": ["extremely steep toe spring"]},
     ]},
    {"id": "shoes.shaft_height", "name": "Boot Shaft Height", "domain": "shoes",
     "derived_from": "general.height",
     "provenance": "authored 2026-09-18 from taxonomy template shaft heights",
     "steps": [
         {"zone": "low", "phrases": ["ankle-height", "at the ankle bone"]},
         {"zone": "low", "phrases": ["mid-calf"]},
         {"zone": "neutral", "phrases": ["below-knee"]},
         {"zone": "high", "phrases": ["knee-high"]},
         {"zone": "high", "phrases": ["over-the-knee"]},
         {"zone": "high", "phrases": ["thigh-high"]},
         {"zone": "high", "phrases": ["crotch-high"]},
     ]},
]


def main():
    scales = []
    for md in sorted(GUIDES.glob("**/*.md")):
        stem = md.stem
        sid = None
        for key, (gid, name, derived) in {**GENERAL, **DERIVED}.items():
            if stem.startswith(key):
                sid = (gid, name, derived)
                break
        if not sid:
            continue
        gid, name, derived = sid
        domain = "general" if gid.startswith("general.") else "shoes"
        steps = parse_scale(md)
        if not steps:
            print(f"  ! no steps parsed for {gid}", file=sys.stderr)
            continue
        scales.append(build(gid, name, domain, derived, steps,
                            f"converted from '{md.name}' (guide_to_dimensions)"))
        print(f"  {gid}: {len(steps)} steps")

    for authored in AUTHORED:
        steps = [{"rank": i + 1, "zone": s["zone"], "phrases": s["phrases"],
                  "adjectives": s["phrases"], "nuance": s.get("nuance", ""),
                  "anchors": s.get("anchors", [])}
                 for i, s in enumerate(authored["steps"])]
        scales.append(build(authored["id"], authored["name"], authored["domain"],
                            authored["derived_from"], steps, authored["provenance"]))
        print(f"  {authored['id']}: {len(steps)} steps (authored)")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"scales": scales}, indent=1, ensure_ascii=False))
    print(f"wrote {OUT} with {len(scales)} scales")


if __name__ == "__main__":
    main()
