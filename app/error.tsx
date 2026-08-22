"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "../src/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto my-10 flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-20 text-center shadow-sm sm:px-10">
      <TriangleAlert className="size-8 text-destructive" />
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That&apos;s usually a dropped database connection, not a data problem — retrying almost always fixes it.
      </p>
      <div className="mt-2 flex gap-3">
        <Button size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
