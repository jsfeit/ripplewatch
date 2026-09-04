import "server-only";

// Real, working integration — unlike seo-data.ts/producthunt-data.ts, GitHub's
// REST API needs no account or paid tier for this: public repo stats are
// unauthenticated by default (60 requests/hour per IP). Set GITHUB_TOKEN (a
// free personal access token, no scopes needed for public data) to raise that
// to 5,000/hour once enough competitors have github_repo set for the
// unauthenticated limit to matter.
const GITHUB_API_BASE = "https://api.github.com";

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RipplewatchBot/1.0 (+https://ripplewatch.ai)",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

// GitHub computes commit-activity stats asynchronously the first time a repo
// is queried and returns 202 with an empty body while it works — not an
// error, just "check back later" (their own docs say up to a few minutes,
// in practice sometimes longer for a rarely-queried repo). Returning null
// here rather than 0 means the state-history write is skipped for this
// crawl instead of recording a false "zero commits" reading; the next
// crawl's request naturally retries once GitHub has finished computing it.
type CommitActivityWeek = { total: number; week: number };

// Sum of commits in the trailing ~4 weeks — the scalar computeMomentum's
// hiring/pricing-style magnitude comparison needs (see recordCommitVelocity
// in scraping.ts and the "github_commit_velocity" metric in momentum.ts).
// 4 weeks rather than exactly matching WINDOW_DAYS's 30 days: GitHub's stats
// are bucketed by calendar week (Sunday-starting), so 4 whole weeks is the
// closest clean alignment without slicing a partial week.
const VELOCITY_WEEKS = 4;

export async function fetchGithubCommitVelocity(repo: string): Promise<number | null> {
  const trimmed = repo.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return null;

  let res: Response;
  try {
    res = await fetch(`${GITHUB_API_BASE}/repos/${trimmed}/stats/commit_activity`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error(`GitHub commit-activity fetch failed for ${trimmed}:`, err);
    return null;
  }

  // 202 = stats still computing (see comment above); 404 = wrong slug or a
  // private/deleted repo; 403 = rate-limited (or, rarely, an empty repo
  // GitHub refuses to compute stats for) — all three are "no reading this
  // run," not a reason to throw and take the rest of the competitor's crawl
  // down with it.
  if (res.status === 202 || res.status === 404 || res.status === 403) return null;
  if (!res.ok) {
    console.error(`GitHub commit-activity fetch returned ${res.status} for ${trimmed}`);
    return null;
  }

  const weeks = (await res.json().catch(() => null)) as CommitActivityWeek[] | null;
  if (!Array.isArray(weeks) || weeks.length === 0) return null;

  return weeks
    .slice(-VELOCITY_WEEKS)
    .reduce((sum, w) => sum + (typeof w.total === "number" ? w.total : 0), 0);
}
