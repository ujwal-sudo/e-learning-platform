"use client";
/* eslint-disable react-hooks/set-state-in-effect -- these effects fetch data and reset local state when their inputs change */

import { ArrowsClockwise, Check, Lightbulb, MagnifyingGlass, PaperPlaneRight, Shuffle, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Skeleton } from "@/components/ui/spinner";
import { api, ApiError } from "@/lib/client/api";
import { cn } from "@/lib/cn";
import type { Card, Summary, Term } from "@/lib/tutor/basic-study";

export type Lang = "book" | "en" | "mr";
interface Study<T> {
  data: T;
  source: "ai" | "basic";
}

/** Loads one kind of study material for a chapter; reloads when the language changes. */
function useStudy<T>(docId: string, kind: "summary" | "terms" | "cards", lang: Lang) {
  const [res, setRes] = useState<Study<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setRes(null);
    setError(null);
    api<Study<T>>(`/api/documents/${docId}/study`, { method: "POST", json: { kind, lang } }).then(
      (r) => live && setRes(r),
      (e) => live && setError(e instanceof ApiError ? e.message : "Couldn't load this."),
    );
    return () => {
      live = false;
    };
  }, [docId, kind, lang, nonce]);
  return { res, error, retry: () => setNonce((n) => n + 1) };
}

const Loading = () => (
  <div className="space-y-3" aria-busy="true" aria-label="Preparing study material">
    <Skeleton className="h-24 rounded-2xl" />
    <Skeleton className="h-40 rounded-2xl" />
  </div>
);

function Failed({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Notice tone="bad" title="Couldn't prepare this" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
      {message}
    </Notice>
  );
}

function SourceNote({ source, retry }: { source: "ai" | "basic"; retry?: () => void }) {
  return (
    <p className="text-xs text-ink-3">
      {source === "ai" ? (
        "Written by AI from this chapter only."
      ) : (
        <>
          Basic mode: picked straight from the chapter text, because the AI was busy or isn’t set up.{" "}
          {retry && (
            <button type="button" className="font-semibold text-accent-ink underline" onClick={retry}>
              Try AI again
            </button>
          )}
        </>
      )}
    </p>
  );
}

/* ----------------------------------------------------------------- listen */

function speakLang(text: string) {
  return /[ऀ-ॿ]/.test(text) ? "mr-IN" : "en-IN";
}

export function ListenButton({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => () => void window.speechSynthesis?.cancel(), []);
  if (typeof window !== "undefined" && !("speechSynthesis" in window)) return null;
  return (
    <Button
      size="sm"
      variant="secondary"
      icon={on ? <SpeakerSlash className="size-4" /> : <SpeakerHigh className="size-4" />}
      onClick={() => {
        const s = window.speechSynthesis;
        if (on) {
          s.cancel();
          setOn(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = speakLang(text);
        u.rate = 0.9;
        u.onend = u.onerror = () => setOn(false);
        s.cancel();
        s.speak(u);
        setOn(true);
      }}
    >
      {on ? "Stop" : "Listen"}
    </Button>
  );
}

/* ---------------------------------------------------------------- summary */

export function SummaryPanel({ docId, lang }: { docId: string; lang: Lang }) {
  const { res, error, retry } = useStudy<Summary>(docId, "summary", lang);
  if (error) return <Failed message={error} retry={retry} />;
  if (!res) return <Loading />;
  const s = res.data;
  const all = [s.overview, ...s.points].join(" ");
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">The big picture</h3>
          <ListenButton text={all} />
        </div>
        <p className="mt-2 leading-relaxed text-ink">{s.overview}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft lg:col-span-3">
          <h3 className="font-display text-lg font-semibold">Key points</h3>
          <ol className="mt-3 space-y-2.5">
            {s.points.map((p, i) => (
              <li key={i} className="flex gap-3 leading-relaxed">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-ink">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-warn/30 bg-warn-soft p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Lightbulb weight="fill" className="size-5" /> Remember this
          </h3>
          <ul className="mt-3 space-y-2">
            {s.mustKnow.map((p, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <Check weight="bold" className="mt-1 size-4 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <SourceNote source={res.source} retry={retry} />
    </div>
  );
}

/* ------------------------------------------------------------- key terms */

export function TermsPanel({ docId, lang }: { docId: string; lang: Lang }) {
  const { res, error, retry } = useStudy<Term[]>(docId, "terms", lang);
  const [q, setQ] = useState("");
  if (error) return <Failed message={error} retry={retry} />;
  if (!res) return <Loading />;
  const terms = res.data.filter((t) => !q.trim() || `${t.term} ${t.meaning}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="space-y-4">
      <label className="relative block max-w-sm">
        <span className="sr-only">Search key terms</span>
        <MagnifyingGlass className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search terms…"
          className="h-11 w-full rounded-xl border border-line-2 bg-surface pr-3 pl-9 text-sm focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
        />
      </label>
      {terms.length === 0 ? (
        <p className="text-ink-2">No terms match “{q}”.</p>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          {terms.map((t, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
              <dt className="font-display text-lg font-semibold text-accent-ink">{t.term}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
      <SourceNote source={res.source} retry={retry} />
    </div>
  );
}

/* -------------------------------------------------------------- flashcards */

const shuffled = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export function CardsPanel({
  docId,
  lang,
  known,
  onKnown,
}: {
  docId: string;
  lang: Lang;
  known: string[];
  onKnown: (fronts: string[]) => void;
}) {
  const { res, error, retry } = useStudy<Card[]>(docId, "cards", lang);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flip, setFlip] = useState(false);
  const cards = res?.data;
  const knownSet = useMemo(() => new Set(known), [known]);

  useEffect(() => {
    if (cards) {
      const todo = cards.map((_, i) => i).filter((i) => !knownSet.has(cards[i].front));
      setOrder(todo.length ? todo : cards.map((_, i) => i));
      setPos(0);
      setFlip(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const mark = useCallback(
    (got: boolean) => {
      if (!cards) return;
      const c = cards[order[pos]];
      const next = got ? [...new Set([...known, c.front])] : known.filter((f) => f !== c.front);
      onKnown(next);
      setFlip(false);
      setPos((p) => (p + 1) % Math.max(1, order.length));
    },
    [cards, order, pos, known, onKnown],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlip((f) => !f);
      }
      if (e.key === "ArrowRight") mark(true);
      if (e.key === "ArrowLeft") mark(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mark]);

  if (error) return <Failed message={error} retry={retry} />;
  if (!cards) return <Loading />;
  if (cards.length === 0) return <Notice tone="info">This chapter doesn’t have enough text to make flashcards.</Notice>;
  const card = cards[order[pos]] ?? cards[0];
  const done = cards.filter((c) => knownSet.has(c.front)).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm font-semibold text-ink-2">
        <span>
          Card {Math.min(pos + 1, order.length)} of {order.length} · {done}/{cards.length} known
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={<Shuffle className="size-4" />}
          onClick={() => {
            setOrder((o) => shuffled(o));
            setPos(0);
            setFlip(false);
          }}
        >
          Shuffle
        </Button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={done} aria-valuemax={cards.length}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / cards.length) * 100}%` }} />
      </div>
      <button
        type="button"
        onClick={() => setFlip((f) => !f)}
        aria-label={flip ? "Showing answer. Click to show question" : "Showing question. Click to show answer"}
        className={cn(
          "grid min-h-64 w-full place-items-center rounded-3xl border p-8 text-center shadow-soft transition-colors",
          flip ? "border-accent/40 bg-accent-soft" : "border-line bg-surface hover:border-ink-3",
        )}
      >
        <div>
          <p className="mb-3 text-xs font-bold tracking-wider text-ink-3 uppercase">{flip ? "Answer" : "Question"}</p>
          <p className="font-display text-xl leading-relaxed font-medium sm:text-2xl">{flip ? card.back : card.front}</p>
          {!flip && <p className="mt-4 text-xs text-ink-3">Tap or press space to flip</p>}
        </div>
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" icon={<ArrowsClockwise className="size-5" />} onClick={() => mark(false)}>
          Review again
        </Button>
        <Button size="lg" icon={<Check weight="bold" className="size-5" />} onClick={() => mark(true)}>
          I know this
        </Button>
      </div>
      {done > 0 && (
        <button type="button" className="text-sm font-semibold text-ink-3 underline" onClick={() => onKnown([])}>
          Reset my progress
        </button>
      )}
      <SourceNote source={res!.source} retry={retry} />
    </div>
  );
}

/* --------------------------------------------------------------------- ask */

interface Answer {
  answer: string;
  evidence: { text: string; chunk: number }[];
  found: boolean;
}

export function AskPanel({ docId, lang, suggestions }: { docId: string; lang: Lang; suggestions: string[] }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ q: string; a: Study<Answer> }[]>([]);
  const end = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await api<Study<Answer>>(`/api/documents/${docId}/ask`, { method: "POST", json: { question, lang } });
      setTurns((t) => [...t, { q: question, a }]);
      setQ("");
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't get an answer.");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-ink-2">Ask anything about this chapter. Answers come only from this chapter’s text, with the lines they’re based on.</p>
      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-white">{t.q}</p>
            <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-surface p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <p className="leading-relaxed">{t.a.data.answer}</p>
                <ListenButton text={t.a.data.answer} />
              </div>
              {t.a.data.evidence.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  <p className="text-xs font-bold tracking-wider text-ink-3 uppercase">From the chapter</p>
                  {t.a.data.evidence.map((e, k) => (
                    <blockquote key={k} className="border-l-2 border-accent/50 pl-3 text-sm text-ink-2">
                      {e.text}
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <Skeleton className="h-20 max-w-[70%] rounded-2xl" />}
        <div ref={end} />
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      {turns.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line-2 bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-2 hover:border-accent hover:text-accent-ink">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="ask-q">Your question</label>
        <input
          id="ask-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={400}
          placeholder="Type your question…"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line-2 bg-surface px-4 focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
        />
        <Button type="submit" size="lg" loading={busy} disabled={q.trim().length < 2} icon={<PaperPlaneRight weight="fill" className="size-5" />}>
          Ask
        </Button>
      </form>
    </div>
  );
}
