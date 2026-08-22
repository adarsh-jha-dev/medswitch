import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "../src/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto my-10 flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-20 text-center shadow-sm sm:px-10">
      <SearchX className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That page, composition, or link doesn&apos;t exist — it may have been mistyped or the composition isn&apos;t in the
        database yet.
      </p>
      <Button asChild size="lg" className="mt-2">
        <Link href="/search">Back to search</Link>
      </Button>
    </main>
  );
}
