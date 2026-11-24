"use client";
/* eslint-disable react-hooks/set-state-in-effect -- these effects fetch data and reset local state when their inputs change */

import { BookOpenText } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { api, ApiError } from "@/lib/client/api";
import type { LibraryBook } from "@/lib/server/library";
import type { SourceDocument } from "@/lib/tutor/types";

/** Pick a Maharashtra State Board / NCERT textbook chapter; only that chapter becomes the quiz source. */
export function LibraryPanel({ onChanged }: { onChanged: (highlightId?: string) => void }) {
  const router = useRouter();
  const [board, setBoard] = useState("maharashtra");
  const [cls, setCls] = useState("1");
  const [medium, setMedium] = useState("english");
  const [books, setBooks] = useState<LibraryBook[] | null>(null);
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setBooks(null);
    setBookId("");
    setChapterId("");
    api<{ books: LibraryBook[] }>(`/api/library?board=${board}&class=${cls}&medium=${medium}`)
      .then((r) => live && (setBooks(r.books), setBookId(r.books[0]?.id ?? "")))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Couldn't load the library."));
    return () => {
      live = false;
    };
  }, [board, cls, medium]);

  const book = books?.find((b) => b.id === bookId);
  useEffect(() => setChapterId(book?.chapters[0]?.[0] ?? ""), [book]);

  async function add(study = false) {
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const { document } = await api<{ document: SourceDocument }>("/api/library", { method: "POST", json: { chapterId } });
      if (study) {
        router.push(`/tutor/learn/${document.id}`);
        return;
      }
      setAdded(document.title);
      onChanged(document.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add that chapter.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="library-heading" className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 id="library-heading" className="font-display text-xl font-semibold">Study a chapter</h2>
      <p className="mt-1 text-sm text-ink-2">Pick your class, book and chapter. You get a summary, key terms, flashcards, a chapter Q&A and quizzes — all from that chapter only.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Board" htmlFor="lib-board">
          <Select id="lib-board" value={board} onChange={(e) => setBoard(e.target.value)}>
            <option value="maharashtra">Maharashtra State Board</option>
            <option value="cbse">CBSE (NCERT)</option>
          </Select>
        </Field>
        <Field label="Class" htmlFor="lib-class">
          <Select id="lib-class" value={cls} onChange={(e) => setCls(e.target.value)}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Class {i + 1}</option>
            ))}
          </Select>
        </Field>
        <Field label="Medium" htmlFor="lib-medium">
          <Select id="lib-medium" value={medium} onChange={(e) => setMedium(e.target.value)}>
            <option value="english">English</option>
            <option value="marathi">Marathi</option>
          </Select>
        </Field>
      </div>
      {books && books.length === 0 ? (
        <Notice tone="info" className="mt-4">No books for this selection yet.</Notice>
      ) : (
        <div className="mt-3 space-y-3">
          <Field label="Book" htmlFor="lib-book">
            <Select id="lib-book" value={bookId} disabled={!books} onChange={(e) => setBookId(e.target.value)}>
              {books?.map((b) => (
                <option key={b.id} value={b.id}>{b.subject} — {b.title}</option>
              ))}
            </Select>
          </Field>
          <Field label="Chapter" htmlFor="lib-chapter">
            <Select id="lib-chapter" value={chapterId} disabled={!book} onChange={(e) => setChapterId(e.target.value)}>
              {book?.chapters.map((c) => (
                <option key={c[0]} value={c[0]}>{c[1]}. {c[2]}</option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => add(true)} loading={busy} disabled={!chapterId} icon={<BookOpenText className="size-4" />}>
              Study this chapter
            </Button>
            <Button variant="secondary" onClick={() => add(false)} disabled={!chapterId || busy}>
              Add to my sources
            </Button>
          </div>
        </div>
      )}
      {error && <Notice tone="bad" className="mt-3">{error}</Notice>}
      {added && <Notice tone="ok" className="mt-3">Added “{added}”. It is now in your Sources.</Notice>}
    </section>
  );
}
