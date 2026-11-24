"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

export interface Recent {
  id: string;
  title: string;
  sub: string;
  at: number;
}
const KEY = "alp-recent";

export function rememberChapter(r: Omit<Recent, "at">) {
  try {
    const all: Recent[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    const next = [{ ...r, at: Date.now() }, ...all.filter((x) => x.id !== r.id)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode: nothing is remembered */
  }
}

const subscribe = () => () => undefined;
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

/** "Continue studying" shortcuts, kept only in this browser. */
export function RecentChapters() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items: Recent[] = JSON.parse(raw).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading">
      <h2 id="recent-heading" className="mb-3 font-display text-xl font-semibold">Continue studying</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/tutor/learn/${r.id}`} className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-soft transition-colors hover:border-accent">
              <span>
                <span className="block text-xs font-semibold text-ink-3">{r.sub}</span>
                <span className="mt-1 block font-display text-lg leading-snug font-semibold">{r.title}</span>
              </span>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-ink">
                Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
