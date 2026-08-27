-- Which ATS (if any) the hiring snapshot actually came from — surfaced in
-- the UI as a small provenance label ("via Greenhouse") and useful for
-- knowing which competitors are getting the structured-API read (real
-- department field) versus the generic HTML-scrape fallback (keyword-
-- guessed department). Null means the generic scrape was used.
alter table competitor_hiring add column if not exists source text;
