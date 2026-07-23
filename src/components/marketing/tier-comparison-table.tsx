import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIERS } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const ROWS: { label: string; key: keyof (typeof TIERS)[number] }[] = [
  { label: "Competitors tracked", key: "competitors" },
  { label: "Signal sources", key: "signalSources" },
  { label: "Relevance scoring", key: "relevanceScoring" },
  { label: "Onboarding", key: "onboarding" },
  { label: "Delivery", key: "delivery" },
  { label: "CRM / churn data", key: "crm" },
  { label: "Team seats", key: "seats" },
];

export function TierComparisonTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-48 text-muted-foreground">Feature</TableHead>
            {TIERS.map((tier) => (
              <TableHead
                key={tier.id}
                className={cn(
                  "min-w-40 text-foreground",
                  tier.highlight && "bg-accent/50"
                )}
              >
                <div className="font-semibold">{tier.name}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {tier.price}
                  {tier.priceNote}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROWS.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-muted-foreground">{row.label}</TableCell>
              {TIERS.map((tier) => (
                <TableCell key={tier.id} className={cn(tier.highlight && "bg-accent/30")}>
                  {tier[row.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
