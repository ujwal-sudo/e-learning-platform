import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ask from "@/app/api/documents/[id]/ask/route";
import * as study from "@/app/api/documents/[id]/study/route";
import * as library from "@/app/api/library/route";
import catalogue from "@/lib/library/catalogue.json";
import { MemoryKV, setKV } from "@/lib/store/kv";
import { basicCards, basicSummary, basicTerms } from "@/lib/tutor/basic-study";
import { cleanChapterText } from "@/lib/tutor/text";

const EN =
  "Plants make their own food by photosynthesis. Photosynthesis needs sunlight, water and carbon dioxide. " +
  "Chlorophyll is the green pigment in leaves that captures sunlight. Leaves are the food factories of a plant. " +
  "Stomata are tiny pores on leaves that let gases move in and out. Roots absorb water and minerals from the soil. " +
  "The xylem carries water from the roots to the leaves. The phloem carries food from the leaves to other parts. " +
  "Plants store extra food in the form of starch. Photosynthesis also releases oxygen into the air.";
const MR =
  "वनस्पती प्रकाशसंश्लेषणाने स्वतःचे अन्न तयार करतात. प्रकाशसंश्लेषणासाठी सूर्यप्रकाश आणि पाणी लागते. " +
  "पानांमधील हरितद्रव्य सूर्यप्रकाश शोषून घेते. मुळे जमिनीतून पाणी शोषून घेतात. पाने ही वनस्पतींची अन्नाची कारखाने आहेत.";

describe("rule-based study material", () => {
  it("summarises, finds terms and makes cloze cards from English text", () => {
    const s = basicSummary(EN);
    expect(s.overview.length).toBeGreaterThan(20);
    expect(s.points.length).toBeGreaterThan(0);
    expect(basicTerms(EN).some((t) => /photosynthesis/i.test(t.term))).toBe(true);
    const cards = basicCards(EN);
    expect(cards.length).toBeGreaterThan(2);
    expect(cards.every((c) => c.front.includes("_____") && !c.front.includes(c.back))).toBe(true);
  });

  it("works on Marathi (Devanagari) text too", () => {
    expect(basicSummary(MR).overview).toMatch(/[ऀ-ॿ]/);
    expect(basicCards(MR).length).toBeGreaterThan(0);
  });

  it("strips PDF markdown debris and is idempotent", () => {
    const dirty = "**Bold** word<br>next <!-- Start of picture text --> kept -- End of picture text --> done";
    const once = cleanChapterText(dirty);
    expect(once).toBe("Bold word next kept done");
    expect(cleanChapterText(once)).toBe(once);
  });
});

const books = catalogue as unknown as { board: string; chapters: [string, number, string, number][] }[];
const chapterId = books.find((b) => b.chapters.some((c) => c[3] >= 3))!.chapters.find((c) => c[3] >= 3)![0];
const docId = `lib-${chapterId}`;
const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ctx = { params: Promise.resolve({ id: docId }) } as never;

describe("chapter study API (no model key → basic mode)", () => {
  beforeEach(() => {
    setKV(new MemoryKV());
    vi.stubEnv("PINECONE_API_KEY", "k");
    vi.stubEnv("PINECONE_INDEX_HOST", "https://idx.test");
    vi.stubGlobal("fetch", async (url: string) => {
      const ids = [...new URL(url).searchParams.getAll("ids")];
      return Response.json({ vectors: Object.fromEntries(ids.map((id) => [id, { metadata: { text: EN } }])) });
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns summary, terms and cards, and answers questions from the chapter", async () => {
    await library.POST(json("http://test/api/library", { chapterId }));
    for (const kind of ["summary", "terms", "cards"]) {
      const res = await study.POST(json("http://test/s", { kind }), ctx);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.source).toBe("basic");
      expect(JSON.stringify(body.data).length).toBeGreaterThan(20);
    }
    const a = await (await ask.POST(json("http://test/a", { question: "What does chlorophyll do?" }), ctx)).json();
    expect(a.data.found).toBe(true);
    expect(a.data.evidence[0].text.toLowerCase()).toContain("chlorophyll");
  });

  it("says so when the chapter does not cover the question", async () => {
    await library.POST(json("http://test/api/library", { chapterId }));
    const a = await (await ask.POST(json("http://test/a", { question: "Who won the cricket world cup?" }), ctx)).json();
    expect(a.data.found).toBe(false);
  });

  it("re-imports a library chapter when storage was cleared", async () => {
    setKV(new MemoryKV()); // nothing imported yet, as on a fresh serverless instance
    const res = await study.POST(json("http://test/s", { kind: "terms" }), ctx);
    expect(res.status).toBe(200);
  });

  it("rejects bad input", async () => {
    expect((await study.POST(json("http://test/s", { kind: "nope" }), ctx)).status).toBe(400);
    expect((await ask.POST(json("http://test/a", { question: "" }), ctx)).status).toBe(400);
  });
});
