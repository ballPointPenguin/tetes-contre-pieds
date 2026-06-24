/**
 * wikipedia.ts — MediaWiki API client for fetching group match data.
 *
 * Uses prop=wikitext which gives us both the football box template
 * (structured goal data per team) and the prose narrative (header mentions).
 */

const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'tetes-contre-pieds/1.0 (score-update-bot; https://github.com/ballPointPenguin/tetes-contre-pieds)';

export interface WikiSection {
  index: string;
  number: string;
  line: string;      // section title, e.g. "Canada vs Bosnia and Herzegovina"
  level: string;     // "2" = h2, "3" = h3
  toclevel: number;
  anchor: string;
}

/** Fetch the full list of sections for a Wikipedia page */
export async function getSections(page: string): Promise<WikiSection[]> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', page);
  url.searchParams.set('prop', 'sections');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`Wikipedia API error: ${data.error.info}`);

  return data.parse.sections as WikiSection[];
}

/** Fetch the raw wikitext for a specific section by index number */
export async function getSectionWikitext(page: string, sectionIndex: string): Promise<string> {
  const url = new URL(WIKI_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', page);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('section', sectionIndex);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status} ${res.statusText}`);

  const data = await res.json();
  if (data.error) throw new Error(`Wikipedia API error: ${data.error.info}`);

  return data.parse.wikitext;
}

/**
 * Find all level-3 match sections (the per-match subsections under "Matches").
 * Returns only sections whose parent h2 is "Matches".
 */
export function findMatchSections(sections: WikiSection[]): WikiSection[] {
  const matchSections: WikiSection[] = [];
  let inMatchesH2 = false;

  for (const section of sections) {
    if (section.level === '2') {
      inMatchesH2 = section.line === 'Matches';
    } else if (section.level === '3' && inMatchesH2) {
      matchSections.push(section);
    }
  }

  return matchSections;
}

/**
 * Parse team FIFA codes from the football box template in wikitext.
 * Returns [homeCode, awayCode] or null if the box isn't present yet.
 *
 * Template format:
 *   |team1={{#invoke:flag|fb-rt|MEX}}
 *   |team2={{#invoke:flag|fb|RSA}}
 */
export function parseTeamCodes(wikitext: string): [string, string] | null {
  const team1Match = wikitext.match(/\|team1=\{\{#invoke:flag\|fb(?:-rt)?\|([A-Z]{2,3})\}\}/);
  const team2Match = wikitext.match(/\|team2=\{\{#invoke:flag\|fb(?:-rt)?\|([A-Z]{2,3})\}\}/);

  if (!team1Match || !team2Match) return null;
  return [team1Match[1], team2Match[1]];
}

/**
 * Check whether a match section has a completed football box
 * (i.e. the match has been played and Wikipedia has the scorecard).
 */
export function isMatchComplete(wikitext: string): boolean {
  // The football box appears inside <section begin=XX /> tags
  // and contains a |score= field with the actual result
  return /\|score=\{\{score link/.test(wikitext) || /\|score=\d/.test(wikitext);
}

/**
 * Parse the score from the football box template.
 * Returns [homeScore, awayScore] or null.
 *
 * Template format:
 *   |score={{score link|...|2–0}}
 *   or |score=2–0
 */
export function parseScore(wikitext: string): [number, number] | null {
  // Try "score link" format: {{score link|...|X–Y}}
  const linkMatch = wikitext.match(/\|score=\{\{score link\|[^|]+\|(\d+)[–\-](\d+)\}\}/);
  if (linkMatch) return [parseInt(linkMatch[1]), parseInt(linkMatch[2])];

  // Try plain format: |score=X–Y
  const plainMatch = wikitext.match(/\|score=(\d+)[–\-](\d+)/);
  if (plainMatch) return [parseInt(plainMatch[1]), parseInt(plainMatch[2])];

  return null;
}
