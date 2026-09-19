import { relativeTime, topFeatures } from "@/lib/activity";

export type ActivityUser = {
  id: string;
  email: string;
  role: string | null;
  signedUpAt: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  lastActiveAt: string | null;
  features: Record<string, number>;
};

export type AdoptionItem = { label: string; detail: string; used: boolean };

// The "who is using this and what are they using" panel on an account's admin
// page: per-person sign-in and activity, then a checklist of which product
// areas the account has actually touched (from their data, not just page
// views, so it reflects real use rather than curiosity).
export function AccountActivityCard({
  users,
  adoption,
  featureTotals,
  windowDays,
}: {
  users: ActivityUser[];
  adoption: AdoptionItem[];
  featureTotals: Record<string, number>;
  windowDays: number;
}) {
  const features = topFeatures(featureTotals, 9);
  const max = features[0]?.[1] ?? 1;

  return (
    <section className="mb-10 rounded-lg border border-border p-5">
      <h2 className="text-sm font-semibold">Activity</h2>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">User</th>
              <th className="pb-2 pr-4 font-medium">Signed up</th>
              <th className="pb-2 pr-4 font-medium">Last login</th>
              <th className="pb-2 pr-4 font-medium">Logins</th>
              <th className="pb-2 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="py-2 pr-4">
                  {u.email}
                  {u.role ? <span className="ml-2 text-xs capitalize text-muted-foreground">{u.role}</span> : null}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">
                  {u.signedUpAt ? new Date(u.signedUpAt).toLocaleDateString() : "–"}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">{relativeTime(u.lastLoginAt)}</td>
                <td className="py-2 pr-4 tabular-nums text-muted-foreground">{u.loginCount || "–"}</td>
                <td className="py-2 text-muted-foreground">{u.lastActiveAt ? relativeTime(u.lastActiveAt) : "–"}</td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-muted-foreground">
                  No users on this account.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium text-muted-foreground">Pages opened (last {windowDays} days)</h3>
          {features.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {features.map(([label, count]) => (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0">{label}</span>
                  <span className="h-1.5 flex-1 rounded-full bg-muted">
                    <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
                  </span>
                  <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-xs font-medium text-muted-foreground">What they&apos;ve set up</h3>
          <ul className="mt-2 space-y-1.5">
            {adoption.map((item) => (
              <li key={item.label} className="flex items-baseline gap-2 text-sm">
                <span className={item.used ? "text-primary" : "text-muted-foreground/60"}>{item.used ? "●" : "○"}</span>
                <span className={item.used ? "" : "text-muted-foreground"}>{item.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
