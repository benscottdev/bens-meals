import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const MODELS = {
  planner: process.env.CLAUDE_MODEL_PLANNER ?? "claude-sonnet-5-5",
  fast: process.env.CLAUDE_MODEL_FAST ?? "claude-haiku-5-5",
};

let _client: Anthropic | null = null;
export const claude = () => (_client ??= new Anthropic());

type StructuredOpts<S extends z.ZodType> = {
  model: string;
  system: string;
  prompt: string;
  schema: S;
  /** Let Claude search the web for real recipes (Sonnet/Opus only). */
  webSearch?: number;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  images?: { media_type: "image/jpeg" | "image/png" | "image/webp"; data: string }[];
};

export class ClaudeError extends Error {}

/**
 * One structured call: streams (so big plans don't hit HTTP timeouts), resumes
 * server-tool `pause_turn`s, and validates the final JSON against `schema`.
 */
export async function structured<S extends z.ZodType>(opts: StructuredOpts<S>): Promise<z.infer<S>> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(opts.images ?? []).map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.media_type, data: img.data },
    })),
    { type: "text", text: opts.prompt },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
  // Server-side refusal fallback is only offered on the bigger models.
  const canFallback = !opts.model.includes("haiku");

  for (let turn = 0; turn < 4; turn++) {
    const stream = claude().beta.messages.stream({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 32000,
      system: opts.system,
      messages,
      output_config: {
        format: zodOutputFormat(opts.schema),
        ...(opts.effort ? { effort: opts.effort } : {}),
      },
      ...(opts.webSearch
        ? {
            tools: [
              {
                type: "web_search_20260209" as const,
                name: "web_search" as const,
                max_uses: opts.webSearch,
                user_location: { type: "approximate" as const, country: "AU" },
              },
            ],
          }
        : {}),
      ...(canFallback
        ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
        : {}),
    });
    const msg = await stream.finalMessage();

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }
    if (msg.stop_reason === "refusal") throw new ClaudeError("Claude declined this request.");
    if (msg.stop_reason === "max_tokens") throw new ClaudeError("Claude ran out of room — try fewer meals.");

    const text = [...msg.content].reverse().find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new ClaudeError("Claude returned no answer.");
    return opts.schema.parse(JSON.parse(text.text));
  }
  throw new ClaudeError("Claude kept pausing; try again.");
}
