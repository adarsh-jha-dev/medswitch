"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { SubstitutionGroup } from "../../src/queries/substitution";
import { PriceTable } from "../../src/components/price-table";
import { Badge } from "../../src/components/ui/badge";
import { Button } from "../../src/components/ui/button";
import { Card, CardContent } from "../../src/components/ui/card";
import { formatRupeesWhole } from "../../src/lib/format";

const MAX_DIMENSION = 1400;

interface ScanItem {
  rawText: string;
  brandGuess: string | null;
  strengthGuess: string | null;
  confidence: "high" | "low";
  matched: boolean;
  group: SubstitutionGroup | null;
  savings: { annualSaving: number } | null;
}

interface ScanResponse {
  items: ScanItem[];
  combinedAnnualSaving: number;
}

// Downscales client-side before it ever leaves the browser — keeps the
// upload small and the vision call cheap.
function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      img.onerror = () => reject(new Error("Could not decode the image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function ItemCard({ item }: { item: ScanItem }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Extracted from photo</p>
            <p className="text-sm font-medium">{item.rawText}</p>
          </div>
          {item.confidence === "low" ? (
            <Badge variant="outline" className="border-danger-text/30 text-danger-text">
              low confidence
            </Badge>
          ) : null}
        </div>

        {item.matched && item.group ? (
          <>
            <p className="text-sm text-muted-foreground">
              Matched to <span className="font-medium text-foreground">{item.group.normalizedText}</span>
            </p>
            <PriceTable ranked={item.group.ranked} pendingReview={item.group.pendingReview} />
            <Link href={`/composition/${item.group.fingerprintHash}`} className="text-xs text-brand hover:underline">
              View full comparison
            </Link>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Couldn&apos;t confidently match this to a known brand or molecule. Double-check the reading above, then{" "}
            <Link href={`/?q=${encodeURIComponent(item.brandGuess ?? item.rawText)}`} className="text-brand hover:underline">
              search for it directly
            </Link>
            .
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ScanPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    try {
      const resized = await fileToResizedDataUrl(file);
      setDataUrl(resized);
      setPreview(resized);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  async function submit() {
    if (!dataUrl) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Scan failed.");
      }
      const body: ScanResponse = await res.json();
      setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setBusy(false);
      // The image has done its job — drop it from memory now that results are in.
      setDataUrl(null);
    }
  }

  return (
    <main className="mx-auto my-10 w-full max-w-4xl rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm sm:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">Scan a prescription</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a photo of a prescription, strip, or box. Processed in memory only — never saved to disk or a
        database, and discarded as soon as results are back.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Choose photo
          </Button>
          <Button type="button" onClick={submit} disabled={!dataUrl || busy}>
            {busy ? "Reading…" : "Extract & compare"}
          </Button>
        </div>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Prescription preview" className="max-h-64 w-fit rounded-lg border border-border object-contain" />
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {result ? (
        <div className="mt-8 flex flex-col gap-4">
          {result.combinedAnnualSaving > 0 ? (
            <Card className="bg-brand-tint">
              <CardContent>
                <p className="tnum text-3xl font-semibold text-brand">
                  {formatRupeesWhole(result.combinedAnnualSaving)}
                  <span className="ml-2 text-base font-medium text-foreground">/year cheaper, combined</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cheapest vs. priciest listed option across every matched item, at one unit/day.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No medicine lines were found in that photo.</p>
          ) : (
            result.items.map((item, i) => <ItemCard key={i} item={item} />)
          )}

          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            Substitution is a decision for your doctor or pharmacist. MedSwitch compares composition and price, not
            clinical suitability.
          </p>
        </div>
      ) : null}
    </main>
  );
}
