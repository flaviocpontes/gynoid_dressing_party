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
  executeFamilyPass, executeBattery, executeReAsk,
  mutateField, setIdentity, acceptRunFlow, discardRun, confirmFamily,
  unresolvedChoicePaths, reparseRun, type VlmFn,
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

const noPreflight = async () => {};

/** Intent draft through the gate: confirm the family, then every battery pass gets `answer`. */
async function intentDraft(runId: string, answer: string, family = "pump") {
  await confirmFamily(db, runId, family);
  await executeBattery(db, runId, reg, okVlm(answer), noPreflight);
}

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
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "pump"}'), noPreflight);
    let got = await getRun(db, run.id);
    expect(readWorkingSheet(got!).upperFamily).toBe("pump");
    expect(got!.family).toBeNull(); // not confirmed yet

    await executeBattery(db, run.id, reg, okVlm("{}"), noPreflight); // no-op without confirmation
    expect((await listPasses(db, run.id)).filter((p) => p.passKey !== "family")).toHaveLength(0);
  });

  it("battery runs gated by the confirmed family", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "flat"}'), noPreflight);
    await confirmFamily(db, run.id, "pump"); // user corrected to pump
    await executeBattery(db, run.id, reg, okVlm('{"heel.type": "stiletto"}'), noPreflight);
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
    await executeBattery(db, run.id, reg, boom, noPreflight);
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

describe("intent runs", () => {
  it("pass through the family gate: no section pass before confirmation", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a towering black patent stripper platform pump with gold hardware" });
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "pump"}'), noPreflight);
    const passes = await listPasses(db, run.id);
    expect(passes.map((p) => p.passKey)).toEqual(["family"]);
    expect(passes[0].promptText).toContain("stripper platform pump");
    const got = await getRun(db, run.id);
    expect(readWorkingSheet(got!).upperFamily).toBe("pump");
    expect(got!.family).toBeNull();
    await executeBattery(db, run.id, reg, okVlm("{}"), noPreflight);
    expect(await listPasses(db, run.id)).toHaveLength(1);
  });

  it("get the same section battery as an image run, carrying the intent and never an image", async () => {
    const intent = await createRun(db, { sourceType: "intent", sourceIntentText: "a towering black patent pump" });
    const image = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    const images: (string | undefined)[] = [];
    const vlm: VlmFn = async ({ imagePath }) => {
      images.push(imagePath);
      return { text: "{}", finishReason: "stop" };
    };
    await confirmFamily(db, intent.id, "pump");
    await confirmFamily(db, image.id, "pump");
    await executeBattery(db, intent.id, reg, vlm, noPreflight);
    expect(images.every((i) => i === undefined)).toBe(true);
    await executeBattery(db, image.id, reg, okVlm("{}"), noPreflight);
    const intentPasses = await listPasses(db, intent.id);
    const imagePasses = await listPasses(db, image.id);
    expect(intentPasses.map((p) => p.passKey).sort()).toEqual(imagePasses.map((p) => p.passKey).sort());
    for (const p of intentPasses) {
      expect(p.promptText).toContain("a towering black patent pump");
      expect(p.promptText).not.toContain("photograph");
    }
  });
});

describe("failed-pass retry", () => {
  it("an empty response is recorded with its finish reason and re-executed on the next battery", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await confirmFamily(db, run.id, "pump");
    const heelEmpty: VlmFn = async ({ prompt }) =>
      prompt.includes("- heel.type ") ? { text: "", finishReason: "length" } : { text: "{}", finishReason: "stop" };
    await executeBattery(db, run.id, reg, heelEmpty, noPreflight);
    const first = await listPasses(db, run.id);
    const heel = first.find((p) => p.passKey === "heel")!;
    expect(heel.responseText).toBe("");
    expect(heel.finishReason).toBe("length");

    const seen: string[] = [];
    const recorder: VlmFn = async ({ prompt }) => {
      seen.push(prompt);
      return { text: '{"heel.type": "stiletto"}', finishReason: "stop" };
    };
    await executeBattery(db, run.id, reg, recorder, noPreflight);
    expect(seen).toHaveLength(1); // only the failed heel pass runs again
    const after = await listPasses(db, run.id);
    expect(after.length).toBe(first.length + 1);
    expect(after.at(-1)!.passKey).toBe("heel");
  });
});

describe("inference preflight", () => {
  it("an unreachable server stops the battery before any pass row is written", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await confirmFamily(db, run.id, "pump");
    const down = async () => {
      throw new InferenceUnreachableError("fetch failed");
    };
    let called = false;
    const vlm: VlmFn = async () => {
      called = true;
      return { text: "{}", finishReason: "stop" };
    };
    await expect(executeBattery(db, run.id, reg, vlm, down)).rejects.toBeInstanceOf(InferenceUnreachableError);
    await expect(executeReAsk(db, run.id, "heel.type", reg, vlm, down)).rejects.toBeInstanceOf(InferenceUnreachableError);
    expect(called).toBe(false);
    expect(await listPasses(db, run.id)).toHaveLength(0);
  });
});

describe("re-parse", () => {
  it("recovers lost answers without touching pass rows", async () => {
    const run = await createRun(db, { sourceType: "image", sourceImagePath: "data/images/imports/x.png" });
    await confirmFamily(db, run.id, "pump");
    // a stored pass whose answers an older parser failed to map (proposed_fields recorded empty)
    await appendPass(db, run.id, {
      passKey: "silhouette",
      templateVersion: "shoe-import/1",
      promptText: "silhouette prompt",
      responseText: '```json\n{"silhouette": {"toeShape": "round", "vampCoverage": "low-vamp"}}\n```',
      proposedFields: [],
    });
    const before = await listPasses(db, run.id);
    await reparseRun(db, run.id, reg);
    const after = await listPasses(db, run.id);
    expect(after).toEqual(before);
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: Record<string, string> }).silhouette).toEqual({
      toeShape: "round",
      vampCoverage: "low-vamp",
    });
    expect(sheet.upperFamily).toBe("pump");
  });
});

describe("review mutations", () => {
  it("resolve collapses a choice-set, clear empties, absent is zod-validated", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "x" });
    await intentDraft(run.id, '{"silhouette.toeShape": ["pointed", "almond"]}');
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
    await intentDraft(run.id, '{"silhouette.toeShape": ["pointed", "almond"]}');
    await executeReAsk(db, run.id, "silhouette.toeShape", reg, okVlm('{"silhouette.toeShape": "pointed"}'), noPreflight);
    const passes = await listPasses(db, run.id);
    expect(passes.map((p) => p.passKey)).toContain("re-ask:silhouette.toeShape");
    const reAsk = passes.find((p) => p.passKey === "re-ask:silhouette.toeShape")!;
    expect(reAsk.promptText).toContain("pointed, almond"); // candidates stamped into the prompt
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBe("pointed");
  });

  it("re-ask that cannot discern clears the proposal to unfilled", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a pointed pump" });
    await intentDraft(run.id, '{"silhouette.toeShape": ["pointed", "almond"]}');
    await executeReAsk(db, run.id, "silhouette.toeShape", reg, okVlm('{"silhouette.toeShape": "cannot tell from this image"}'), noPreflight);
    const sheet = readWorkingSheet((await getRun(db, run.id))!);
    expect((sheet.details as { silhouette?: { toeShape?: string } }).silhouette?.toeShape).toBeUndefined();
    expect(sheet.notes["silhouette.toeShape"]).toContain("cannot-discern");
  });
});

describe("acceptance", () => {
  it("blocks on unresolved choice-sets and missing identity", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "a pump" });
    await intentDraft(run.id, '{"silhouette.toeShape": ["pointed", "almond"], "heel.type": "kitten", "heel.heightStep": "shoes.heel_height:7"}');
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
    await executeFamilyPass(db, run.id, reg, okVlm('{"upperFamily": "pump"}'), noPreflight);
    await intentDraft(run.id, '{"heel.type": "stiletto"}');
    await setIdentity(db, run.id, { slug: "vibe-pump", displayName: "Vibe Pump" });
    const res = await acceptRunFlow(db, run.id);
    expect(res.ok).toBe(true);
    const shoe = await getShoeBySlug(db, "vibe-pump");
    expect(shoe?.sheetKind).toBe("authored");
  });

  it("a discarded run leaves no shoe", async () => {
    const run = await createRun(db, { sourceType: "intent", sourceIntentText: "x" });
    await intentDraft(run.id, '{"heel.type": "stiletto"}');
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
