"use client";
/* eslint-disable react-hooks/set-state-in-effect -- these effects fetch data and reset local state when their inputs change */

import { ArrowLeft, BookOpenText, Cards, ChatCircleText, Exam, FileText, ListChecks, Notebook, Sparkle, Translate } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/spinner";
import { api, ApiError, postStream } from "@/lib/client/api";
import { startQuiz } from "@/lib/client/quiz";
import { cn } from "@/lib/cn";
import type { Difficulty, SourceDocument } from "@/lib/tutor/types";
import { rememberChapter } from "./recent-chapters";
import { AskPanel, CardsPanel, ListenButton, SummaryPanel, TermsPanel, type Lang } from "./study-panels";

type Tab = "summary" | "terms" | "cards" | "ask" | "quiz" | "read";
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "summary", label: "Summary", icon: <Notebook className="size-5" /> },
  { id: "terms", label: "Key terms", icon: <BookOpenText className="size-5" /> },
  { id: "cards", label: "Flashcards", icon: <Cards className="size-5" /> },
  { id: "ask", label: "Ask", icon: <ChatCircleText className="size-5" /> },
  { id: "quiz", label: "Quiz", icon: <Exam className="size-5" /> },
  { id: "read", label: "Read", icon: <FileText className="size-5" /> },
];

interface QuizRow {
  id: string;
  documentIds: string[];
  title: string;
  questionCount: number;
  createdAt: string;
  lastAttempt: { id: string; totalScore: number; maxScore: number } | null;
}

const progressKey = (id: string) => `alp-known:${id}`;

/** One chapter, everything a student needs: summary, terms, flashcards, ask, quiz, read. */
export function ChapterHub({ id }: { id: string }) {
  const [doc, setDoc] = useState<SourceDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [lang, setLang] = useState<Lang>("book");
  const [known, setKnown] = useState<string[]>([]);
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => {
    api<{ document: SourceDocument }>(`/api/documents/${id}`).then(
      (r) => {
        setDoc(r.document);
        rememberChapter({ id, title: r.document.chapters[0]?.title ?? r.document.title, sub: `Class ${r.document.grade} · ${r.document.subject}` });
      },
      (e) => setError(e instanceof ApiError ? e.message : "Couldn't open this chapter."),
    );
    try {
      setKnown(JSON.parse(localStorage.getItem(progressKey(id)) ?? "[]"));
    } catch {
      /* private mode: progress simply isn't remembered */
    }
    const hash = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    if (hash && TABS.some((t) => t.id === hash)) setTab(hash);
  }, [id]);

  // Question starters for the Ask tab come from the chapter's own key terms.
  useEffect(() => {
    api<{ data: { term: string }[] }>(`/api/documents/${id}/study`, { method: "POST", json: { kind: "terms", lang: "book" } }).then(
      (r) => setTerms(r.data.slice(0, 3).map((t) => t.term)),
      () => undefined,
    );
  }, [id]);

  const saveKnown = useCallback(
    (next: string[]) => {
      setKnown(next);
      try {
        localStorage.setItem(progressKey(id), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [id],
  );

  if (error)
    return (
      <Notice tone="bad" title="Chapter unavailable" action={<LinkButton href="/tutor" size="sm" variant="secondary">Choose a chapter</LinkButton>}>
        {error}
      </Notice>
    );
  if (!doc)
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );

  const chapterTitle = doc.chapters[0]?.title ?? doc.title;
  const bookTitle = doc.title.replace(` — ${chapterTitle}`, "");

  return (
    <div className="space-y-6">
      <Link href="/tutor" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" /> Choose another chapter
      </Link>

      <header className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Class {doc.grade}</Badge>
          <Badge>{doc.subject}</Badge>
          <span className="text-sm text-ink-3">{bookTitle}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{chapterTitle}</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">
            Everything below is built from this chapter only · {doc.chunkCount} passages
          </p>
          <div className="flex items-center gap-2">
            <Translate className="size-5 text-ink-3" aria-hidden />
            <Segmented
              label="Language of notes"
              value={lang}
              onChange={setLang}
              options={[
                { value: "book", label: "As in book" },
                { value: "en", label: "English" },
                { value: "mr", label: "मराठी" },
              ]}
            />
          </div>
        </div>
      </header>

      <div role="tablist" aria-label="Study tools" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="hub-panel"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === t.id ? "bg-accent text-white shadow-soft" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="hub-panel" aria-labelledby={`tab-${tab}`} className="min-h-72">
        {tab === "summary" && <SummaryPanel docId={id} lang={lang} />}
        {tab === "terms" && <TermsPanel docId={id} lang={lang} />}
        {tab === "cards" && <CardsPanel docId={id} lang={lang} known={known} onKnown={saveKnown} />}
        {tab === "ask" && <AskPanel docId={id} lang={lang} suggestions={terms.map((t) => `What is ${t}?`)} />}
        {tab === "quiz" && <QuizPanel doc={doc} />}
        {tab === "read" && <ReadPanel doc={doc} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- quiz */

function QuizPanel({ doc }: { doc: SourceDocument }) {
  const router = useRouter();
  const [count, setCount] = useState("8");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [busy, setBusy] = useState<null | "take" | "paper">(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [past, setPast] = useState<QuizRow[]>([]);

  useEffect(() => {
    api<{ quizzes: QuizRow[] }>("/api/quizzes").then(
      (r) => setPast(r.quizzes.filter((q) => q.documentIds?.includes(doc.id))),
      () => undefined,
    );
  }, [doc.id]);

  async function make(goal: "take" | "paper", forceDemo = false) {
    setBusy(goal);
    setError(null);
    setStage("Reading the chapter…");
    try {
      const last = await postStream(
        "/api/quizzes/generate",
        {
          documentId: doc.id,
          grade: doc.grade,
          subject: doc.subject,
          scope: { chapter: null, pageFrom: null, pageTo: null },
          questionCount: Number(count),
          difficulty,
          questionTypes: ["mcq", "fill_blank"],
          learningObjective: "",
          forceDemo,
        },
        (e) => {
          if (e.stage === "generating") setStage("Writing questions…");
          if (e.stage === "validating") setStage("Checking answers against the chapter…");
        },
      );
      // The AI provider is busy: fall back to the built-in question writer so the student isn't stuck.
      if (last.stage !== "done" && last.canUseDemo && !forceDemo) return make(goal, true);
      if (last.stage !== "done") throw new ApiError(last.message ?? "Couldn't make the quiz.", 0);
      const quizId = last.quizId as string;
      router.push(goal === "paper" ? `/tutor/paper/${quizId}` : `/tutor/quiz/${await startQuiz(quizId)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't make the quiz.");
      setBusy(null);
      setStage(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-6">
        <h3 className="font-display text-lg font-semibold">Test yourself on this chapter</h3>
        <p className="mt-1 text-sm text-ink-2">Fresh questions every time, written from this chapter. You see what you got right and why.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Segmented label="Number of questions" value={count} onChange={setCount} options={[{ value: "5", label: "5" }, { value: "8", label: "8" }, { value: "12", label: "12" }]} />
          <Segmented
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "challenging", label: "Hard" }]}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="lg" onClick={() => make("take")} loading={busy === "take"} disabled={!!busy} icon={<Sparkle weight="fill" className="size-5" />}>
            Start quiz
          </Button>
          <Button size="lg" variant="secondary" onClick={() => make("paper")} loading={busy === "paper"} disabled={!!busy} icon={<FileText className="size-5" />}>
            Printable practice paper
          </Button>
        </div>
        {busy && stage && <p className="mt-3 text-sm font-semibold text-accent-ink" role="status">{stage}</p>}
        {error && <Notice tone="bad" className="mt-3">{error}</Notice>}
      </div>

      {past.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <h3 className="font-display text-lg font-semibold">Your quizzes on this chapter</h3>
          <ul className="mt-3 divide-y divide-line">
            {past.slice(0, 6).map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm">
                  {q.questionCount} questions
                  {q.lastAttempt && (
                    <span className="ml-2 font-semibold">
                      · {q.lastAttempt.totalScore}/{q.lastAttempt.maxScore}
                    </span>
                  )}
                </span>
                <span className="flex gap-1.5">
                  {q.lastAttempt && (
                    <LinkButton size="sm" variant="ghost" href={`/tutor/results/${q.lastAttempt.id}`}>Results</LinkButton>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<ListChecks className="size-4" />}
                    onClick={async () => router.push(`/tutor/quiz/${await startQuiz(q.id)}`)}
                  >
                    Retake
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- read */

function ReadPanel({ doc }: { doc: SourceDocument }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const page = doc.chapters[0]?.pageStart ?? 1;
    api<{ page: { text: string } }>(`/api/documents/${doc.id}?page=${page}`).then(
      (r) => setText(r.page.text),
      () => setText(""),
    );
  }, [doc]);
  if (text === null) return <Skeleton className="h-64 rounded-2xl" />;
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 shadow-soft sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-semibold">Chapter text</h3>
        <ListenButton text={text.slice(0, 6000)} />
      </div>
      <div className="space-y-3 leading-relaxed whitespace-pre-line">{text || "The text couldn't be loaded."}</div>
      
    </article>
  );
}
