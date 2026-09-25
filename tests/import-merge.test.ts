import { describe, it, expect } from "vitest";
import { applyPassToSheet, workingSheetSchema } from "@/domain/import/merge";

const blank = () => workingSheetSchema.parse({});

describe("applyPassToSheet", () => {
  it("writes proposals with pass provenance and clears their old notes", () => {
    const sheet = { ...blank(), notes: { "heel.type": "old note" } };
    const out = applyPassToSheet(sheet, "heel", {
      proposals: [{ path: "heel.type", value: "stiletto" }],
      notes: [{ path: "heel.heightStep", note: "not a step reference" }],
    });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBe("stiletto");
    expect(out.provenance["heel.type"]).toBe("heel");
    expect(out.notes).toEqual({ "heel.heightStep": "not a step reference" });
    expect(sheet.notes["heel.type"]).toBe("old note"); // input untouched
  });

  it("a machine proposal skips a user-owned path", () => {
    const sheet = applyPassToSheet(blank(), "heel", { proposals: [{ path: "heel.type", value: "block" }], notes: [] });
    sheet.provenance["heel.type"] = "user";
    const out = applyPassToSheet(sheet, "heel", { proposals: [{ path: "heel.type", value: "stiletto" }], notes: [] });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBe("block");
    expect(out.provenance["heel.type"]).toBe("user");
  });

  it("a re-ask with no proposal clears the machine value", () => {
    const sheet = applyPassToSheet(blank(), "heel", { proposals: [{ path: "heel.type", value: "block" }], notes: [] });
    const out = applyPassToSheet(sheet, "re-ask:heel.type", { proposals: [], notes: [] });
    expect((out.details as { heel?: { type?: string } }).heel?.type).toBeUndefined();
    expect(out.provenance["heel.type"]).toBeUndefined();
  });
});
