import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { getDb, type Db } from "../src/db/db";
import type { Registry } from "../src/domain/registry";
import { lintShoe } from "../src/domain/lint";
import { getShoeBySlug, listShoes } from "../src/lib/shoes";
import {
  createRun, getRun, appendPass, listPasses, readWorkingSheet,
  executeFamilyPass, executeBattery, executeVibePass, executeReAsk,
  mutateField, setIdentity, acceptRunFlow, discardRun, confirmFamily,
  unresolvedChoicePaths,
} from "../src/lib/import";
import { vlmChat, vlmHealth, InferenceUnreachableError } from "../src/lib/vlm";
import { registryFromSeed } from "./seed-registry";

let db: Db;
let reg: Registry;
let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdp-import-"));
  db = getDb(path.join(tmp, "test.db"));
  reg = registryFromSeed();
  execSync(`npx drizzle-kit push --force`, {
    env: { ...process.env, DB_PATH: path.join(tmp, "test.db") },
    stdio: "ignore",
  });
});

const okVlm = (response: string, finishReason: string | null = "stop") => async () => ({ text: response, finishReason });

describe("import run persistence", () => {
  it("round-trips a run with two passes", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a towering pump" });
    await appendPass(db, run.id, {
      passKey: "vibe",
      templateVersion: "shoe-import/1",
      promptText: "prompt verbatim",
      responseText: '{"upperFamily": "pump"}',
      proposedFields: [{ path: "upperFamily", value: "pump" }],
    });
    await appendPass(db, run.id, {
      passKey: "re-ask:heel.type",
      templateVersion: "shoe-import/1",
      promptText: "re-ask prompt",
      responseText: '{"heel.type": "stiletto"}',
      proposedFields: [{ path: "heel.type", value: "stiletto" }],
    });
    const got = await getRun(db, run.id);
    expect(got?.status).toBe("open");
    expect(got?.sourceIntentText).toBe("a towering pump");
    const passes = await listPasses(db, run.id);
    expect(passes.map((p) => p.passKey)).toEqual(["vibe", "re-ask:heel.type"]);
    expect(passes[0].promptText).toBe("prompt verbatim");
    expect(JSON.parse(passes[0].proposedFields!)).toEqual([{ path: "upperFamily", value: "pump" }]);
  });

  it("working sheet survives navigation (run stays open with proposals)", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "x" });
    await setIdentity(db, run.id, { displayName: "Night Pump" });
    await mutateField(db, run.id, { op: "edit", path: "heel.type", value: "stiletto" });
    const got = await getRun(db, run.id);
    const sheet = readWorkingSheet(got!);
    expect(sheet.displayName).toBe("Night Pump");
    expect(sheet.provenance["heel.type"]).toBe("user");
    expect((sheet.details as { heel?: { type?: string } }).heel?.type).toBe("stiletto");
  });
});

describe("family gate", () => {
  it("family pass proposes the family but battery stays blocked until confirmed", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "pump"}'));
    let got = await getRun(db, run.id);
    expect(readWorkingSheet(got!).upperFamily).toBe("pump");
    expect(got!.family).toBeNull(); // not confirmed yet

    await executeBattery(db, run.id, reg, okVlm("{}")); // no-op without confirmation
    expect((await listPasses(db, run.id)).filter((p) => p.passKey !== "family")).toHaveLength(0);
  });

  it("battery runs gated by the confirmed family", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "flat"}'));
    await confirmFamily(db, run.id, "pump"); // user corrected to pump
    await executeBattery(db, run.id, reg, okVlm('{"heel.type": "stiletto"}'));
    const all = await listPasses(db, run.id);
    const passes = all.map((p) => p.passKey);
    expect(passes.filter((k) => k === "family")).toHaveLength(1); // not re-run
    expect(passes).not.toContain("shaft"); // pump never gets a shaft pass
    expect(passes).toContain("heel");
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { heel?: { type?: string } }).heel?.type).toBe("stiletto");
  });

  it("failures record pass rows with empty proposals", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await confirmFamily(db, run.id, "boot");
    const boom = async () => {
      throw new Error("server unreachable");
    };
    await executeBattery(db, run.id, reg, boom);
    const passes = await listPasses(db, run.id);
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      expect(p.responseText).toContain("server unreachable");
      expect(JSON.parse(p.proposedFields!)).toEqual([]);
    }
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect(unresolvedChoicePaths(sheet)).toEqual([]);
  });
});

describe("review mutations", () => {
  it("resolve collapses a choice-set, clear empties, absent is zod-validated", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "x" });
    await executeVibePass(db, run.id, reg, okVlm('{"silhouette.toeShape": ["pointed", "almond"]}'));
    let sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect(unresolvedChoicePaths(sheet)).toEqual(["silhouette.toeShape"]);

    await mutateField(db, run.id, { op: "resolve", path: "silhouette.toeShape", value: "almond" });
    sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect(unresolvedChoicePaths(sheet)).toEqual([]);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBe("almond");

    await mutateField(db, run.id, { op: "clear", path: "silhouette.toeShape" });
    sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBeUndefined();
    expect(sheet.provenance["silhouette.toeShape"]).toBe("user"); // the clear is user-owned

    // absence on an illegal path is rejected by the sheet zod validation
    await expect(
      mutateField(db, run.id, { op: "absent", path: "silhouette.toeShape" }),
    ).rejects.toThrow();
    await mutateField(db, run.id, { op: "absent", path: "construction.welt" });
    sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { construction?: { welt?: { absent: boolean } } }).construction?.welt).toEqual({ absent: true });
  });

  it("re-ask appends a pass row and a committed answer replaces the proposal", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a pointed pump" });
    await executeVibePass(db, run.id, reg, okVlm('{"silhouette.toeShape": ["pointed", "almond"]}'));
    await executeReAsk(db, run.id, "silhouette.toeShape", reg, okVlm('{"silhouette.toeShape": "pointed"}'));
    const passes = await listPasses(db, run.id);
    expect(passes.map((p) => p.passKey)).toContain("re-ask:silhouette.toeShape");
    expect(passes[1].promptText).toContain("pointed, almond"); // candidates stamped into the prompt
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBe("pointed");
  });

  it("re-ask that cannot discern clears the proposal to unfilled", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a pointed pump" });
    await executeVibePass(db, run.id, reg, okVlm('{"silhouette.toeShape": ["pointed", "almond"]}'));
    await executeReAsk(db, run.id, "silhouette.toeShape", reg, okVlm('{"silhouette.toeShape": "cannot tell from this image"}'));
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBeUndefined();
    expect(sheet.notes["silhouette.toeShape"]).toContain("cannot-discern");
  });
});

describe("acceptance", () => {
  it("blocks on unresolved choice-sets and missing identity", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a pump" });
    await executeVibePass(db, run.id, reg, okVlm('{"silhouette.toeShape": ["pointed", "almond"], "heel.type": "kitten", "heel.heightStep": "shoes.heel_height:7"}'));
    let res = await acceptRunFlow(db, run.id);
    expect(res.ok).toBe(false);
    expect(res.ok === false ? res.error : "").toContain("silhouette.toeShape");

    await mutateField(db, run.id, { op: "resolve", path: "silhouette.toeShape", value: "pointed" });
    res = await acceptRunFlow(db, run.id);
    expect(res.ok).toBe(false);
    expect(res.ok === false ? res.error : "").toContain("identity");

    await setIdentity(db, run.id, { slug: "imported-pump", displayName: "Imported Pump" });
    res = await acceptRunFlow(db, run.id);
    expect(res.ok, JSON.stringify(res)).toBe(true); // lint warning (kitten at sky-high) does not block
  });

  it("an image run produces an imported shoe whose sheet equals the working sheet", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await mutateField(db, run.id, { op: "edit", path: "heel.type", value: "stiletto" });
    await mutateField(db, run.id, { op: "edit", path: "heel.heightStep", value: "shoes.heel_height:6" });
    await setIdentity(db, run.id, { slug: "stiletto-import", displayName: "Stiletto Import" });
    const res = await acceptRunFlow(db, run.id);
    expect(res.ok).toBe(true);

    const shoe = await getShoeBySlug(db, "stiletto-import");
    expect(shoe?.sheetKind).toBe("imported");
    const runAfter = await getRun(db, run.id);
    expect(runAfter?.status).toBe("accepted");
    expect(runAfter?.resultShoeId).toBe(shoe!.id);
    const sheet = readWorkingSheet(runAfter!);
    expect(JSON.parse(shoe!.details!)).toEqual(sheet.details);

    // lint over the accepted sheet shows the warning but did not block (kitten+high not used here; sanity only)
    const warnings = lintShoe({ upperFamily: sheet.upperFamily, details: sheet.details, sheetKind: "imported" }, reg);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("an intent run accepts as an authored shoe", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a towering pump" });
    await executeVibePass(db, run.id, reg, okVlm('{"upperFamily": "pump", "heel.type": "stiletto"}'));
    await setIdentity(db, run.id, { slug: "vibe-pump", displayName: "Vibe Pump" });
    const res = await acceptRunFlow(db, run.id);
    expect(res.ok).toBe(true);
    const shoe = await getShoeBySlug(db, "vibe-pump");
    expect(shoe?.sheetKind).toBe("authored");
  });

  it("a discarded run leaves no shoe", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "x" });
    await executeVibePass(db, run.id, reg, okVlm('{"heel.type": "stiletto"}'));
    await discardRun(db, run.id);
    const after = await getRun(db, run.id);
    expect(after?.status).toBe("discarded");
    expect((await listShoes(db, reg, {})).length).toBe(0);
  });
});

describe("vlm client", () => {
  it("request body carries the image and model id; response text is returned", async () => {
    const img = path.join(tmp, "shoe.png");
    fs.writeFileSync(img, Buffer.from("89504e47", "hex"));
    let captured: { url: string; body: Record<string, unknown> } | undefined;
    const stub: typeof fetch = async (url, init) => {
      captured = { url: String(url), body: JSON.parse(String(init!.body)) };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"upperFamily": "pump"}' }, finish_reason: "stop" }] }), {
        status: 200,
      });
    };
    const out = await vlmChat({ prompt: "what family?", imagePath: img }, stub);
    expect(out).toEqual({ text: '{"upperFamily": "pump"}', finishReason: "stop" });
    expect(captured!.body.max_tokens).toBe(4096);
    expect(captured!.url).toBe("http://192.168.0.20:13305/v1/chat/completions");
    expect(captured!.body.model).toBe("Gemma-4-31B-it-GGUF");
    const messages = captured!.body.messages as { role: string; content: unknown }[];
    expect(messages[0].role).toBe("system");
    const userContent = messages[1].content as { type: string; image_url?: { url: string } }[];
    expect(userContent[0]).toEqual({ type: "text", text: "what family?" });
    expect(userContent[1]!.image_url!.url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("empty content is returned verbatim with its finish reason", async () => {
    const stub: typeof fetch = async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "", reasoning_content: "thinking…" }, finish_reason: "length" }] }), {
        status: 200,
      });
    expect(await vlmChat({ prompt: "x" }, stub)).toEqual({ text: "", finishReason: "length" });
  });

  it("propagates server errors", async () => {
    const stub: typeof fetch = async () => new Response("boom", { status: 500 });
    await expect(vlmChat({ prompt: "x", retryDelayMs: 1 }, stub)).rejects.toThrow("500");
  });
});

describe("vlm health preflight", () => {
  it("resolves on 200", async () => {
    let url = "";
    const stub: typeof fetch = async (u) => {
      url = String(u);
      return new Response("{}", { status: 200 });
    };
    await expect(vlmHealth(stub)).resolves.toBeUndefined();
    expect(url).toBe("http://192.168.0.20:13305/v1/health");
  });

  it("network errors, timeouts, and non-2xx throw InferenceUnreachableError", async () => {
    const down: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(vlmHealth(down)).rejects.toBeInstanceOf(InferenceUnreachableError);
    const hang: typeof fetch = (_u, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)));
    await expect(vlmHealth(hang, 20)).rejects.toBeInstanceOf(InferenceUnreachableError);
    const sick: typeof fetch = async () => new Response("no", { status: 500 });
    await expect(vlmHealth(sick)).rejects.toThrow("500");
  });
});
