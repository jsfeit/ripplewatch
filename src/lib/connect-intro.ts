// What a visitor told us on the "try it on a competitor" step before signup,
// kept in this browser so the setup after payment starts filled in and the
// first read is waiting for them. Never trusted by the server: setup saves
// whatever the person confirms on its own steps.
export type IntroRead = {
  found: string;
  meaning: string;
  move: string;
  question: string;
  confidence: "evidence" | "thin";
};

export type ConnectIntro = {
  companyName: string;
  positioning: string;
  icp: string;
  competitor: { name: string; domain: string } | null;
  read: IntroRead | null;
  evidence: string[];
  // The saved read's id, sent back at the end of setup so the read can be linked to the account.
  readId: string | null;
};

const KEY = "ripplewatch-connect-intro";

export function saveIntro(intro: ConnectIntro): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(intro));
  } catch {
    // Private mode or blocked storage: the flow works without it.
  }
}

export function loadIntro(): ConnectIntro | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<ConnectIntro>;
    if (typeof p.companyName !== "string") return null;
    return {
      companyName: p.companyName,
      positioning: typeof p.positioning === "string" ? p.positioning : "",
      icp: typeof p.icp === "string" ? p.icp : "",
      competitor:
        p.competitor && typeof p.competitor.name === "string" && typeof p.competitor.domain === "string"
          ? p.competitor
          : null,
      read: p.read && typeof p.read.found === "string" ? p.read : null,
      evidence: Array.isArray(p.evidence) ? p.evidence.filter((e): e is string => typeof e === "string") : [],
      readId: typeof p.readId === "string" ? p.readId : null,
    };
  } catch {
    return null;
  }
}

export function clearIntro(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
