"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "./ui/button";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable — no-op, button just stays in its default state.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? (
        <>
          <Check className="size-3.5" /> Copied
        </>
      ) : (
        <>
          <Link2 className="size-3.5" /> Copy link
        </>
      )}
    </Button>
  );
}
