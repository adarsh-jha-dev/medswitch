"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/search", label: "Search", show: true },
  { href: "/ask", label: "Ask", show: process.env.NEXT_PUBLIC_SHOW_LLM_FEATURES === "true" },
  { href: "/scan", label: "Scan", show: process.env.NEXT_PUBLIC_SHOW_LLM_FEATURES === "true" },
  { href: "/safety", label: "Safety", show: true },
  { href: "/pipeline", label: "Pipeline", show: true },
  { href: "/review", label: "Review", show: true },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Link href="/" className="shrink-0 text-sm font-semibold tracking-tight">
          MedSwitch
        </Link>
        <nav className="flex flex-1 justify-end gap-4 overflow-x-auto text-sm scrollbar-none sm:gap-5">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              link.show && (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    "shrink-0 " +
                    (active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {link.label}
                </Link>
              )
            );
          })}
        </nav>
      </div>
    </header>
  );
}
