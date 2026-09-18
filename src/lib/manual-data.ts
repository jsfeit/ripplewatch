// Marks pricing a person entered by hand (Admin -> Follow-ups). The daily
// crawl checks for this before overwriting competitor_pricing with a failure
// placeholder or a stale archived copy, so a manual entry survives until a
// live read of the real page replaces it.
export const MANUAL_NOTE_PREFIX = "Checked manually by Ripplewatch";
