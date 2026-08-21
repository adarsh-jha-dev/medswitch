"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const DEBOUNCE_MS = 300;
const QUICK_LINKS = ["Telma AM", "Glycomet", "Camylofin"];

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  // Tracks the query the URL reflects, so the effect below can skip navigating on mount/unchanged value.
  const lastNavigatedRef = useRef(initialQuery);

  function goTo(q: string) {
    lastNavigatedRef.current = q;
    const trimmed = q.trim();
    const target = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search";
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  }

  useEffect(() => {
    if (value === lastNavigatedRef.current) return;
    const timer = setTimeout(() => goTo(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goTo(value);
        }}
        className="mt-8 flex gap-2"
      >
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Brand name (Telma AM) or molecule (Metformin)"
          className="h-10 px-4 text-sm"
          autoFocus
        />
        <Button type="submit" size="lg" className="h-10" disabled={isPending}>
          {isPending ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
        {QUICK_LINKS.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setValue(term);
              goTo(term);
            }}
            className="hover:text-brand"
          >
            {term}
          </button>
        ))}
      </div>
    </>
  );
}
