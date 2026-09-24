#!/usr/bin/env python3
"""One-time converter: harvest deep shoe taxonomies from the legacy KB shoe
sheet template into seed/vocabularies_deep.json (kebab-case {value} terms).

Usage: python3 scripts/harvest_legacy_vocabs.py
"""
import json
import re
import sys
from pathlib import Path

TEMPLATE = Path(
    "~/Insync/flaviocpontes@gmail.com/Google Drive/PersonalProjects/"
    "Extract into IA/People for IA/templates/outfit_components/shoe_sheet_template.md"
).expanduser()
OUT = Path("seed/vocabularies_deep.json")

VOCAB_NAMES = {
    "throat": "Throat",
    "quarter_style": "Quarter Style",
    "topline_finish": "Topline Finish",
    "toe_box_structure": "Toe Box Structure",
    "heel_seat": "Heel Seat",
    "heel_breast_finish": "Heel Breast Finish",
    "heel_breast_profile": "Heel Breast Profile",
    "welt_type": "Welt Type",
    "welt_visibility": "Welt Visibility",
    "outsole_style": "Outsole Style",
    "outsole_finish": "Outsole Finish",
    "insole_cushioning": "Insole Cushioning",
    "counter_rigidity": "Counter Rigidity",
    "counter_grip": "Counter Grip",
    "hardware_type": "Hardware Type",
    "strap_type": "Strap Type",
    "strap_closure": "Strap Closure",
    "transition_edge": "Transition Edge",
    # no dedicated template line — small curated seed, custom terms always legal
    "strap_anchor": "Strap Anchor",
    "transition_wrap": "Transition Wrap",
}

# bold sub-section header -> {inline label: vocab ids}; "" = template front matter
SUBSECTION_LABELS: dict[str, dict[str, list[str]]] = {
    "": {"Strap Styles": ["strap_type"]},
    "Vamp & Toe Box": {"Toe Box Structure": ["toe_box_structure"]},
    "The Throat (Opening)": {
        "V-Shapes": ["throat"],
        "Curved": ["throat"],
        "Straight/Angular": ["throat"],
        "Decorative": ["throat"],
        "High/Low": ["throat"],
    },
    "Quarters & Topline": {"Quarter Style": ["quarter_style"], "Topline Finish": ["topline_finish"]},
    "Fastening/Closure": {
        "Straps": ["strap_type"],
        "Buckles": ["strap_closure"],
        "Other": ["strap_closure"],
    },
    "The Insole": {"Cushioning Level": ["insole_cushioning"]},
    "The Outsole": {"Texture/Tread": ["outsole_style"], "Finish": ["outsole_finish"]},
    "The Counter (Heel Stiffener)": {"Rigidity": ["counter_rigidity"], "Grip/Lining": ["counter_grip"]},
    "The Welt": {"Type": ["welt_type"], "Visibility": ["welt_visibility"]},
    "Heel Breast (Inner-Facing Side)": {"Finish": ["heel_breast_finish"], "Profile": ["heel_breast_profile"]},
    "Hardware Type": {
        "Buckles": ["hardware_type"],
        "Rings": ["hardware_type"],
        "Studs": ["hardware_type"],
        "Rivets": ["hardware_type"],
        "Eyelets/Grommets": ["hardware_type"],
        "Chains": ["hardware_type"],
        "Clips/Clasps": ["hardware_type"],
        "Decorative": ["hardware_type"],
        "Zippers (Decorative)": ["hardware_type"],
        "Locks/Keys": ["hardware_type"],
        "Aglets": ["hardware_type"],
    },
}

# headers whose terms follow as bare bullets ("**Header:** [Select one]" + bullet list)
HEADER_BULLETS = {
    "Heel Seat": "heel_seat",
    "Platform Edge Profile": "transition_edge",
}

# ponytail: template has no dedicated lines for these; minimal curated seeds
CURATED = {
    "strap_anchor": [
        "ankle", "instep", "vamp", "throat", "quarter", "heel-collar",
        "back-collar", "topline", "shaft-top", "toe-post",
    ],
    "transition_wrap": [
        "monolithic-seamless-wrap", "wrapped-seamless", "integrated-flush",
        "overlapped-seam", "butt-joint", "welted-junction",
    ],
}

DROP_TERMS = {"", "n/a", "na", "none", "none-absent", "no-closure", "no-hardware"}


def kebab(t: str) -> str:
    t = re.sub(r"\(.*?\)", "", t)  # strip parenthetical qualifiers
    t = t.lower().replace("/", " ").replace("&", " ").replace("—", " ").replace(",", " ")
    t = re.sub(r"[^a-z0-9'+\s-]", "", t)
    return re.sub(r"\s+", " ", t).strip().replace(" ", "-")


def line_terms(body: str) -> list[str]:
    body = body.strip().lstrip("*").strip()
    body = re.sub(r"^\[[^\]]*\]\s*", "", body)  # drop "[Select one]" prefixes
    body = re.sub(r"\(.*?\)", "", body)  # strip parentheticals BEFORE comma-split
    if not body or body.startswith("["):
        return []
    out = []
    for raw in body.split(","):
        t = kebab(raw)
        if len(t) > 1 and "specify" not in t and t not in DROP_TERMS:
            out.append(t)
    return out


def main():
    text = TEMPLATE.read_text(encoding="utf-8")
    vocabs: dict[str, list[str]] = {vid: list(CURATED.get(vid, [])) for vid in VOCAB_NAMES}
    subsection = ""
    bullet_target = None
    label_re = re.compile(r"^\**([^:*]+?)\**:\s*(.*)$")

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):  # top-level section resets context
            subsection = ""
            bullet_target = None
            continue
        if not stripped.startswith("*"):
            continue
        content = stripped.lstrip("*").strip()
        m = label_re.match(content)

        # bare bullet feeding a previous "[Select one]" header
        if bullet_target and not m:
            terms = line_terms(content)
            if terms:
                vocabs[bullet_target].extend(terms)
            continue

        if not m:
            continue
        label, body = m.group(1).strip(), m.group(2).lstrip("*").strip()
        bullet_target = None

        if content.startswith("**"):  # bold line = sub-section header
            subsection = label
            if label in HEADER_BULLETS:
                bullet_target = HEADER_BULLETS[label]
            continue

        targets = SUBSECTION_LABELS.get(subsection, {}).get(label, [])
        if not targets:
            continue
        terms = line_terms(body)
        for vid in targets:
            vocabs[vid].extend(terms)

    payload = {"vocabularies": []}
    for vid, terms in vocabs.items():
        seen, deduped = set(), []
        for t in terms:
            if t not in seen:
                seen.add(t)
                deduped.append(t)
        if not deduped:
            print(f"WARNING: {vid} harvested 0 terms", file=sys.stderr)
        payload["vocabularies"].append({
            "id": vid,
            "name": VOCAB_NAMES[vid],
            "provenance": "harvested from legacy shoe_sheet_template.md (People for IA KB) 2026-09-23",
            "terms": [{"value": v} for v in deduped],
        })

    OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {OUT}")
    for v in payload["vocabularies"]:
        print(f"  {v['id']}: {len(v['terms'])} terms")


if __name__ == "__main__":
    main()
