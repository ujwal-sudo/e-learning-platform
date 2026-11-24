import { splitSentences, tokenize } from "./text";

/** Rule-based study material. Used when no model key is set or the model fails, so every feature still works. */

export interface Term {
  term: string;
  meaning: string;
}
export interface Card {
  front: string;
  back: string;
}
export interface Summary {
  overview: string;
  points: string[];
  mustKnow: string[];
}

const usable = (s: string) => s.length >= 25 && s.length <= 260 && (s.match(/[\p{L}\p{M}]/gu)?.length ?? 0) / s.length > 0.6;

/** Sentences ranked by how many of the chapter's frequent words they carry; returned in reading order. */
export function topSentences(text: string, n: number): string[] {
  const sentences = [...new Set(splitSentences(text).map((s) => s.replace(/\s+/g, " ").trim()))].filter(usable);
  const freq = new Map<string, number>();
  for (const s of sentences) for (const t of tokenize(s)) if (t.length > 3) freq.set(t, (freq.get(t) ?? 0) + 1);
  const score = (s: string) => {
    const toks = tokenize(s).filter((t) => t.length > 3);
    return toks.length ? toks.reduce((a, t) => a + (freq.get(t) ?? 0), 0) / Math.sqrt(toks.length) : 0;
  };
  const keep = new Set(
    sentences
      .map((s, i) => ({ s, i, v: score(s) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, n)
      .map((x) => x.i),
  );
  return sentences.filter((_, i) => keep.has(i));
}

export function basicSummary(text: string): Summary {
  const pts = topSentences(text, 8);
  return { overview: pts.slice(0, 2).join(" "), points: pts.slice(2, 8), mustKnow: pts.slice(0, 3) };
}

/** Frequent content words (any script) with the sentence that explains them best. */
export function basicTerms(text: string, n = 12): Term[] {
  const sentences = splitSentences(text).map((s) => s.replace(/\s+/g, " ").trim()).filter(usable);
  const count = new Map<string, { surface: string; n: number }>();
  for (const s of sentences)
    for (const w of s.match(/[\p{L}\p{M}]{5,}/gu) ?? []) {
      const k = w.toLowerCase();
      const e = count.get(k) ?? { surface: w, n: 0 };
      e.n += 1;
      count.set(k, e);
    }
  return [...count.entries()]
    .filter(([k, v]) => v.n >= 2 && tokenize(k).length > 0) // tokenize() drops stopwords
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, n)
    .map(([k, v]) => ({
      term: v.surface,
      meaning: sentences.find((s) => s.toLowerCase().includes(k)) ?? "",
    }))
    .filter((t) => t.meaning);
}

/** Fill-in-the-blank cards from the most important sentences. */
export function basicCards(text: string, n = 12): Card[] {
  const out: Card[] = [];
  for (const s of topSentences(text, n * 2)) {
    const word = (s.match(/[\p{L}\p{M}]{6,}/gu) ?? []).sort((a, b) => b.length - a.length)[0];
    if (!word) continue;
    out.push({ front: s.replace(word, "_____"), back: word });
    if (out.length >= n) break;
  }
  return out;
}
