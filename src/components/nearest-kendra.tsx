import type { NearestKendra } from "../queries/kendra";
import { Card, CardContent } from "./ui/card";

export function NearestKendraList({ kendras }: { kendras: NearestKendra[] }) {
  if (kendras.length === 0) return null;

  return (
    <Card className="mb-8 border-dashed bg-transparent shadow-none">
      <CardContent>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Nearest Jan Aushadhi Kendra
        </p>
        <ul className="flex flex-col gap-3">
          {kendras.map((k) => (
            <li key={k.storeCode} className="text-sm">
              <p>
                {k.address}
                {k.pincode ? ` — ${k.pincode}` : ""}
                {k.distanceKm !== null ? (
                  <span className="ml-1.5 text-xs text-muted-foreground">({k.distanceKm} km)</span>
                ) : null}
              </p>
              {k.contactNumber ? <p className="mt-0.5 text-xs text-muted-foreground">{k.contactNumber}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Sourced directly from janaushadhi.gov.in&rsquo;s own store locator. Call ahead to confirm current stock.
        </p>
      </CardContent>
    </Card>
  );
}
