import type { Metadata } from "next";
import { Suspense } from "react";
import { ChapterHub } from "@/components/tutor/chapter-hub";
import { Skeleton } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Study a chapter · Textbook AI Tutor" };

export default function LearnPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      {params.then(({ id }) => (
        <ChapterHub id={id} />
      ))}
    </Suspense>
  );
}
