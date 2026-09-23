import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/** Serves images stored under data/images (runtime writes never touch public/). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  const root = path.resolve("data/images");
  const file = path.resolve(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
    headers: { "content-type": type, "cache-control": "private, max-age=60" },
  });
}
