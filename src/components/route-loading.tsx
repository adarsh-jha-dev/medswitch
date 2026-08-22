import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

// Not used on /composition/[fingerprint] — that route calls notFound(), and a
// Suspense boundary above it would flush a 200 status before notFound() can
// set the response to 404.
export function RouteLoading({ maxWidth = "max-w-4xl" }: { maxWidth?: string }) {
  return (
    <main
      className={cn(
        "mx-auto my-10 flex w-full items-center justify-center rounded-2xl border border-border bg-surface px-6 py-24 shadow-sm sm:px-10",
        maxWidth,
      )}
    >
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </main>
  );
}
