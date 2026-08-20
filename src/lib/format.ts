export function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatRupeesWhole(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatStrength(value: string | null, unit: string | null): string {
  if (!value) return "";
  const n = Number(value);
  return `${Number.isFinite(n) ? n.toString() : value}${unit ?? ""}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
