import type { NextRequest } from "next/server";
import { z } from "zod";
import { HttpError, handle, rateLimit, readJson } from "@/lib/server/http";
import { askChapter } from "@/lib/server/study";

export const maxDuration = 60;
const Body = z.object({ question: z.string().trim().min(2).max(400), lang: z.enum(["book", "en", "mr"]).default("book") });

/** POST /api/documents/:id/ask — { question } → answer grounded in that chapter's passages only. */
export const POST = handle(async (req: NextRequest, ctx: RouteContext<"/api/documents/[id]/ask">) => {
  rateLimit(req, "ask", 30);
  const { id } = await ctx.params;
  const body = Body.safeParse(await readJson(req));
  if (!body.success) throw new HttpError(400, "Ask a question (2–400 characters).");
  return Response.json(await askChapter(id, body.data.question, body.data.lang));
});
