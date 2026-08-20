"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/safety", label: "Safety" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/review", label: "Review" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          MedSwitch
        </Link>
        <nav className="flex gap-5 text-sm">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
