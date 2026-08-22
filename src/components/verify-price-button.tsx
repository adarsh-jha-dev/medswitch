"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

interface VerifyResponse {
  brandName: string | null;
  sellingPrice: number | null;
  inStock: boolean | null;
  changed: boolean;
  error?: string;
}

export function VerifyPriceButton({ listingId }: { listingId: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function verify() {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/verify-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const body = (await res.json()) as VerifyResponse;
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Live verification failed.");
        return;
      }
      setStatus("done");
      setMessage(
        body.sellingPrice !== null
          ? `Live price just now: ₹${body.sellingPrice}${body.changed ? " — updated" : " — unchanged"}`
          : "Bright Data ran, but returned no price for this listing.",
      );
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Live verification failed — network error.");
    }
  }

  return (
    <div className="mt-1 flex flex-col items-start gap-1">
      <Button variant="ghost" size="xs" onClick={verify} disabled={status === "loading"} className="h-auto px-0 text-xs text-muted-foreground underline decoration-dotted hover:bg-transparent hover:text-foreground">
        {status === "loading" ? "Verifying live price… (can take a couple minutes)" : "Verify this price now"}
      </Button>
      {message ? (
        <p className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message}</p>
      ) : null}
    </div>
  );
}
