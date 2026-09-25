import fs from "node:fs";
import path from "node:path";

/** Homelab Lemonade server (AGENTS generation-environment section). */
export const LEMONADE_URL = process.env.LEMONADE_URL ?? "http://192.168.0.20:13305";

/** Vision interrogator; one-line change when the bake-off picks a different model. */
export const INTERROGATOR_MODEL = "Gemma-4-31B-it-GGUF";

export const INTERROGATOR_SYSTEM = `You are a meticulous shoe-cataloguing assistant with excellent vision.
You answer with a single JSON object and nothing else — no prose before or after it.
You only state what the source actually supports; when unsure you hedge explicitly as instructed.
You never use digits, numbers, units, or measurements in field values.`;

export type VlmRequest = {
  prompt: string;
  imagePath?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  retryDelayMs?: number;
};

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function dataUrl(imagePath: string): string {
  const buf = fs.readFileSync(imagePath);
  const mime = MIME[path.extname(imagePath).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export type VlmResult = { text: string; finishReason: string | null };

/**
 * Chat completions against the Lemonade server; the only place that knows the server exists.
 * Empty content comes back verbatim as "" (with its finish reason) so the pass log records it.
 */
export async function vlmChat(req: VlmRequest, fetchImpl: typeof fetch = fetch): Promise<VlmResult> {
  const content: unknown[] = [{ type: "text", text: req.prompt }];
  if (req.imagePath) {
    content.push({ type: "image_url", image_url: { url: dataUrl(req.imagePath) } });
  }
  const body = {
    model: INTERROGATOR_MODEL,
    messages: [
      { role: "system", content: req.system ?? INTERROGATOR_SYSTEM },
      { role: "user", content },
    ],
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 4096,
  };
  const url = `${LEMONADE_URL}/v1/chat/completions`;
  // ponytail: one retry with backoff — the single-slot server drops concurrent connections
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`lemonade ${res.status}: ${(await res.text()).slice(0, 400)}`);
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: unknown }; finish_reason?: unknown }[];
      };
      const choice = json.choices?.[0];
      if (!choice) throw new Error("lemonade: no choices in response");
      const content = choice.message?.content;
      return {
        text: typeof content === "string" ? content : "",
        finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
      };
    } catch (e) {
      lastErr = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, req.retryDelayMs ?? 5000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
