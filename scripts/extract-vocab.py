#!/usr/bin/env python3
"""Throwaway extractor: build seed/vocabularies.json from the world_of_gynoids
shoe template (mechanically-parseable lists + curated core vocabularies) and
validate coverage against the Gallery/Shoes corpus filenames.

Usage: python3 scripts/extract-vocab.py
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

TEMPLATE = Path("/home/flaviocpontes/PersonalProjects/world_of_gynoids/templates/outfits/shoe_sheet_template.md")
CORPUS = Path("/home/flaviocpontes/Insync/flaviocpontes@gmail.com/Google Drive/PersonalProjects/Gallery/Shoes")
OUT = Path("seed/vocabularies.json")

# template category-line name -> vocabulary id(s) the terms feed
CATEGORY_MAP = {
    "Neutrals": ["upper_color", "outsole_lacquer_color"],
    "Nudes/Skin Tones": ["upper_color", "outsole_lacquer_color"],
    "Browns": ["upper_color", "outsole_lacquer_color"],
    "Reds": ["upper_color", "outsole_lacquer_color"],
    "Pinks": ["upper_color", "outsole_lacquer_color"],
    "Oranges": ["upper_color", "outsole_lacquer_color"],
    "Yellows": ["upper_color", "outsole_lacquer_color"],
    "Greens": ["upper_color", "outsole_lacquer_color"],
    "Blues": ["upper_color", "outsole_lacquer_color"],
    "Purples/Violets": ["upper_color", "outsole_lacquer_color"],
    "Metallics": ["upper_color", "outsole_lacquer_color"],
    "Special Effects": ["upper_color", "outsole_lacquer_color"],
    "Hardware Finish": ["hardware_finish"],
    "Smooth Leathers": ["primary_material"],
    "Patent/High-Shine Leathers": ["primary_material"],
    "Suede/Napped Leathers": ["primary_material"],
    "Exotic/Embossed Leathers": ["primary_material"],
    "Metallic Leathers": ["primary_material"],
    "Textiles—Wovens": ["primary_material"],
    "Textiles—Specialty": ["primary_material"],
    "Textiles—Embellished": ["primary_material"],
    "Synthetic/Technical": ["primary_material"],
    "Transparent/Architectural": ["primary_material"],
    "Natural/Artisan": ["primary_material"],
    "Faux Fur/Pile": ["primary_material"],
    "Casual": ["occasion"],
    "Business/Professional": ["occasion"],
    "Semi-Formal": ["occasion"],
    "Formal/Black Tie": ["occasion"],
    "Bridal/Wedding": ["occasion"],
    "Evening/Nightlife": ["occasion"],
    "Formal Dance": ["occasion"],
    "Performance/Stage": ["occasion"],
    "Editorial/Production": ["occasion"],
    "Specialty/Themed": ["occasion"],
    "Academic/Uniform": ["occasion"],
    "Classic Heels": ["style_family"],
    "Platform Styles": ["style_family"],
    "Open/Cut Styles": ["style_family"],
    "Strap Styles": ["style_family"],
    "Wedge Styles": ["style_family"],
    "Boot Styles": ["style_family"],
    "Flat/Low Styles": ["style_family"],
    "Avant-Garde/Specialty": ["style_family"],
}

VOCAB_NAMES = {
    "upper_family": "Upper Family",
    "toe_shape": "Toe Shape",
    "vamp_coverage": "Vamp Coverage",
    "fastening": "Fastening",
    "heel_type": "Heel Type",
    "platform_shape": "Platform Shape",
    "platform_edge": "Platform Edge Profile",
    "primary_material": "Primary Material",
    "upper_color": "Upper Color",
    "outsole_lacquer_color": "Outsole Lacquer Color",
    "hardware_finish": "Hardware Finish",
    "embellishment": "Embellishment",
    "adornment_placement": "Adornment Placement",
    "occasion": "Occasion",
    "style_family": "Style Family",
    "appearance_tier": "Appearance Tier",
}

CURATED = {
    "upper_family": [
        "pump", "mary-jane", "t-strap", "slingback", "mule", "sandal", "loafer",
        "oxford", "derby", "brogue", "clog", "boot", "bootie", "shootie",
        "sneaker", "d'orsay", "spectator",
    ],
    "toe_shape": [
        "sharp-point", "standard-point", "softened-point", "snip-toe", "dagger-point",
        "almond", "narrow-almond", "wide-almond", "elongated-almond", "round",
        "wide-round", "square", "softened-square", "chisel", "moc-toe",
        "tabi-split", "peep-toe", "open-toe", "keyhole-peep-toe", "heart-peep-toe",
    ],
    "vamp_coverage": [
        "full-coverage", "high-vamp", "extra-high-vamp", "mid-vamp",
        "three-quarter-vamp", "low-vamp", "deep-v-cut", "sweetheart-cut",
        "scalloped-cut", "cutout-vamp", "cage-vamp", "lattice-vamp",
        "single-strap", "minimal-straps", "thong", "open-front-slide",
    ],
    "fastening": [
        "slip-on", "pull-on", "side-zip", "back-zip", "front-zip", "concealed-zip",
        "front-lace-up", "side-lace-up", "back-lace-up", "corset-lace-up",
        "ankle-strap-buckle", "mary-jane-strap", "t-strap", "slingback-strap",
        "slingback-elastic", "monk-buckle", "double-monk-buckle", "elastic-gusset",
        "button-row", "toggle", "magnetic-closure", "hook-and-eye",
    ],
    "heel_type": [
        "stiletto", "italian-stiletto", "curved-stiletto", "waisted-stiletto",
        "pin-heel", "dagger-heel", "kitten", "setback-kitten", "cone",
        "inverted-cone", "spool", "louis", "block", "chunky", "column",
        "flared", "trumpet", "comma", "banana", "blade", "dagger-blade",
        "sculpted", "architectural", "twisted-spiral", "geometric-cube",
        "geometric-sphere", "stacked-leather", "cuban", "wedge", "cutout-wedge",
        "espadrille-wedge", "flatform", "lucite", "hollow-lucite", "metal",
        "leather-wrapped", "heel-less", "cantilever", "ballet-heel", "pony-heel",
    ],
    "platform_shape": [
        "flat-even", "graduated-tapered", "reverse-graduated", "sculpted-contoured",
        "wave-s-curve", "angular-stepped", "terraced", "faceted", "prismatic",
        "split-level", "two-tier", "convex", "concave", "barrel", "wedge-integrated",
        "sole-integrated", "cutout-window", "floating", "cantilever", "asymmetric",
    ],
    "platform_edge": [
        "straight-vertical", "slightly-beveled", "heavily-beveled", "rounded",
        "bullnose", "stacked-layers", "sculpted", "wavy", "stepped-tiered",
        "concave", "convex", "faceted", "scalloped", "channeled", "fluted",
        "knife-edge", "flared", "inverted",
    ],
    "embellishment": [
        "rhinestone", "crystal-pave", "pearl", "sequin", "glitter", "beading",
        "embroidery", "applique", "3d-floral-applique", "ostrich-feather",
        "marabou", "peacock-eye", "feather-fringe", "bow", "oversized-bow",
        "mini-bow", "rosette", "fabric-flower", "ruffle", "fringe", "tassel",
        "chain", "charm", "coin", "stud", "pyramid-stud", "spike", "cone-stud",
        "gem-cabochon", "mirror-tile", "crystal-butterfly", "heart-buckle",
    ],
    "adornment_placement": [
        "vamp", "toe-cap", "t-junction", "ankle-strap", "back-collar", "heel-counter",
        "heel-stem", "platform-edge", "throat", "quarter", "shaft-top", "instep",
    ],
    "appearance_tier": ["source", "public", "private"],
}

# corpus filename tokens that are NOT upper families (architecture or generic)
GENERIC_TOKENS = {
    "shoe", "shoes", "heel", "heels", "platform", "platforms", "stiletto",
    "stilettos", "outsole", "outsoles", "sole", "soles", "lacquer", "toe",
    "peeptoe", "wedge", "wedges", "star", "outsoles2", "closedtoe",
    # non-type tokens from ad-hoc (non-snake-case) corpus filenames
    "bow", "strap", "red", "black", "lacquered", "lac", "preta", "vermelha",
    "zenithpump", "rustyregalia", "promt", "01", "janes2", "janes", "lace",
    "extremestilletobowmaryjan", "insanestilletobowmaryjan",
    "platformstilettobowmaryjan", "extremestilletobowmaryjane",
    "insanestilletobowmaryjane", "platformstilettobowmaryjane", "brog",
}
TOKEN_VOCAB_REDIRECT = {"tabi": "toe_shape", "mary": "upper_family", "jane": "upper_family"}


def clean_term(t: str) -> str:
    t = re.sub(r"\(.*?\)", "", t).strip()
    return re.sub(r"\s+", " ", t)


def singular(t: str) -> str:
    t = t.lower().replace("-", "").replace("'", "")
    if t.endswith("ies") and len(t) > 4:
        return t[:-3] + "y"
    if t.endswith("ie") and len(t) > 3:
        return t[:-2] + "y"
    if t.endswith("es") and (t[-3] in "sxz" or t[-3:-1] in ("ch", "sh")):
        return t[:-2]
    if t.endswith("s") and not t.endswith("ss"):
        return t[:-1]
    return t


def main():
    vocabs: dict[str, list[str]] = {vid: [] for vid in VOCAB_NAMES}

    text = TEMPLATE.read_text(encoding="utf-8")
    cat_re = re.compile(r"\*([^*]+?):\*\s*(.+)$")  # *Label:* body (italic labels)
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith(("*", "-")):
            continue
        m = cat_re.search(stripped)
        if not m:
            continue
        cat, body = clean_term(m.group(1)), m.group(2).strip()
        body = re.sub(r"^\[[^\]]*\]\s*", "", body)  # drop "[Select one...]" prefixes
        if not body or body.startswith("["):
            continue  # instruction bodies without terms
        targets = CATEGORY_MAP.get(cat)
        if not targets:
            continue
        terms = [clean_term(x) for x in body.split(",")]
        terms = [t for t in terms if t and len(t) > 1 and "specify" not in t.lower()]
        for vid in targets:
            vocabs[vid].extend(terms)

    for vid, terms in CURATED.items():
        vocabs[vid].extend(terms)

    # dedupe, preserving order
    out = {}
    for vid, terms in vocabs.items():
        seen, deduped = set(), []
        for t in terms:
            k = t.lower()
            if k not in seen:
                seen.add(k)
                deduped.append(t)
        out[vid] = deduped

    # corpus coverage validation (compare singularized forms on both sides)
    upper_sing = {singular(t) for t in out["upper_family"]}
    uncovered = Counter()
    for f in CORPUS.iterdir():
        stem = f.stem
        token = stem.split("_")[-1].lower() if "_" in stem else stem.split()[-1].lower()
        token = singular(token)
        if not token or token in GENERIC_TOKENS:
            continue
        if token in upper_sing:
            continue
        uncovered[token] += 1

    print("== corpus type-token coverage vs upper_family ==")
    if uncovered:
        for tok, n in uncovered.most_common():
            redirect = TOKEN_VOCAB_REDIRECT.get(tok, "NOT COVERED")
            print(f"  {tok} x{n} -> {redirect}")
    else:
        print("  all corpus type tokens covered")

    payload = {
        "vocabularies": [
            {"id": vid, "name": VOCAB_NAMES[vid],
             "provenance": "curated 2026-09-18 + shoe_sheet_template.md extraction",
             "terms": [{"value": v} for v in terms]}
            for vid, terms in out.items()
        ]
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False))
    print(f"wrote {OUT}")
    for vid, terms in out.items():
        print(f"  {vid}: {len(terms)} terms")


if __name__ == "__main__":
    main()
