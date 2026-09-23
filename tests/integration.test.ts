import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb, type Db } from "../src/db/db";
import {
  createShoe, updateShoe, getShoeBySlug, listShoes, addImage, approveImage,
  setImageOverlay, snapshotPrompt, listPrompts, setProse, listImages,
} from "../src/lib/shoes";
import { emptyRegistry } from "../src/domain/registry";
import type { Registry, StepRec } from "../src/domain/registry";

let db: Db;
let reg: Registry;
let tmp: string;

function registryFromSeed(): Registry {
  const r = emptyRegistry();
  const seed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../seed/scales.json"), "utf-8"));
  for (const s of seed.scales) {
    const steps: StepRec[] = s.steps.map((st: Record<string, unknown>, i: number) => ({
      id: `${s.id}:${i + 1}`, scaleId: s.id, rank: i + 1, zone: st.zone as StepRec["zone"],
      phrases: st.phrases as string[], adjectives: (st.adjectives as string[]) ?? (st.phrases as string[]),
      nuance: (st.nuance as string) || null, anchors: (st.anchors as string[]) ?? [],
    }));
    steps.forEach((st) => r.steps.set(st.id, st));
    r.stepsByScale.set(s.id, steps);
  }
  return r;
}

import { execSync } from "node:child_process";

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdp-test-"));
  db = getDb(path.join(tmp, "test.db"));
  reg = registryFromSeed();
  execSync(`npx drizzle-kit push --force`, {
    env: { ...process.env, DB_PATH: path.join(tmp, "test.db") },
    stdio: "ignore",
  });
});

describe("shoe data layer", () => {
  it("creates a minimal shoe with unfilled details", async () => {
    const row = await createShoe(db, { slug: "test-shoe", displayName: "Test Shoe" });
    expect(row.slug).toBe("test-shoe");
    expect(row.details).toBeNull();
    const got = await getShoeBySlug(db, "test-shoe");
    expect(got?.displayName).toBe("Test Shoe");
  });

  it("round-trips details and derives promoted facets", async () => {
    await createShoe(db, {
      slug: "disj-shoe",
      displayName: "Disj Shoe",
      upperFamily: "pump",
      details: {
        heel: { type: ["stiletto", "wedge"], heightStep: "shoes.heel_height:7" },
        platform: { heightStep: "shoes.platform_height:7" },
        outsole: { lacquerColor: "crimson red" },
      },
    });
    const got = await getShoeBySlug(db, "disj-shoe");
    expect(got?.heelType).toBe("stiletto"); // first of choice-set
    expect(got?.heelHeightStep).toBe("shoes.heel_height:7");
    expect(got?.outsoleLacquerName).toBe("crimson red");
    expect(got?.upperFamily).toBe("pump");
    const details = JSON.parse(got!.details!);
    expect(details.heel.type).toEqual(["stiletto", "wedge"]);
  });

  it("updates shoes and keeps slug unique", async () => {
    await createShoe(db, { slug: "a", displayName: "A" });
    const updated = await updateShoe(db, "a", { slug: "a", displayName: "A2" });
    expect(updated?.displayName).toBe("A2");
  });

  it("filters gallery by heel zone and search", async () => {
    await createShoe(db, { slug: "low-heel", displayName: "Low Heel Shoe", upperFamily: "mule", details: { heel: { heightStep: "shoes.heel_height:2" } } });
    await createShoe(db, { slug: "high-heel", displayName: "Sky High Shoe", upperFamily: "pump", details: { heel: { heightStep: "shoes.heel_height:6" } } });
    const high = await listShoes(db, reg, { heelZone: "high" });
    expect(high.map((s) => s.slug)).toEqual(["high-heel"]);
    const byName = await listShoes(db, reg, { q: "sky high" });
    expect(byName.map((s) => s.slug)).toEqual(["high-heel"]);
    const byFamily = await listShoes(db, reg, { upperFamily: "mule" });
    expect(byFamily.map((s) => s.slug)).toEqual(["low-heel"]);
  });

  it("approval swaps the gallery card (one approved product shot)", async () => {
    const row = await createShoe(db, { slug: "img-shoe", displayName: "Img Shoe" });
    const img1 = await addImage(db, row.id, "data/images/img-shoe/a.png");
    const img2 = await addImage(db, row.id, "data/images/img-shoe/b.png");
    await approveImage(db, img1.id);
    let list = await listShoes(db, reg, {});
    expect(list.find((s) => s.slug === "img-shoe")?.cardImagePath).toContain("a.png");
    await approveImage(db, img2.id);
    list = await listShoes(db, reg, {});
    expect(list.find((s) => s.slug === "img-shoe")?.cardImagePath).toContain("b.png");
    const imgs = await listImages(db, row.id);
    expect(imgs.filter((i) => i.approved).length).toBe(1);
  });

  it("records overlay per image without touching the sheet", async () => {
    const row = await createShoe(db, {
      slug: "overlay-shoe", displayName: "Overlay Shoe",
      details: { heel: { type: ["stiletto", "wedge"] } },
    });
    const img = await addImage(db, row.id, "data/images/overlay-shoe/x.png");
    await setImageOverlay(db, img.id, {
      resolved: { "heel.type": "stiletto" },
      deviations: ["sheet said wedge-or-stiletto; rendered stiletto"],
      defects: ["AI watermark"],
    });
    const stored = (await listImages(db, row.id))[0];
    expect(JSON.parse(stored.overlay!).resolved["heel.type"]).toBe("stiletto");
    const sheet = await getShoeBySlug(db, "overlay-shoe");
    expect(JSON.parse(sheet!.details!).heel.type).toEqual(["stiletto", "wedge"]); // unchanged
  });

  it("snapshots prompts immutably", async () => {
    const row = await createShoe(db, { slug: "prompt-shoe", displayName: "Prompt Shoe" });
    await snapshotPrompt(db, row.id, "original prompt text");
    await updateShoe(db, "prompt-shoe", { slug: "prompt-shoe", displayName: "Prompt Shoe Renamed" });
    const snaps = await listPrompts(db, row.id);
    expect(snaps.length).toBe(1);
    expect(snaps[0].text).toBe("original prompt text");
  });

  it("replaces prose description on edit", async () => {
    const row = await createShoe(db, { slug: "prose-shoe", displayName: "Prose Shoe", proseDescription: "first" });
    expect(row.proseDescription).toBe("first");
    await setProse(db, row.id, "second");
    const got = await getShoeBySlug(db, "prose-shoe");
    expect(got?.proseDescription).toBe("second");
  });
});
