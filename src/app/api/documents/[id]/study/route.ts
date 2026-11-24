import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, handle, rateLimit, readJson } from "@/lib/server/http";
import { getCards, getSummary, getTerms } from "@/lib/server/study";

export const maxDuration = 90;
const Body = z.object({ kind: z.enum(["summary", "terms", "cards"]), lang: z.enum(["book", "en", "mr"]).default("book") });

/** POST /api/documents/:id/study — { kind, lang } → AI (or rule-based) summary / key terms / flashcards for one chapter. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/documents/[id]/study">) => {
  rateLimit(req, "study", 30);
  const { id } = await ctx.params;
  const body = Body.safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "Send { kind: summary | terms | cards }.");
  const { kind, lang } = body.data;
  const result = kind === "summary" ? await getSummary(id, lang) : kind === "terms" ? await getTerms(id, lang) : await getCards(id, lang);
  return Response.json(result);
});
