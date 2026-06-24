#!/usr/bin/env tsx
/**
 * update-scores.ts — Main entry point for the score update script.
 *
 * Fetches Wikipedia wikitext for each group's match sections,
 * passes them to Claude to extract goal data, and patches wc2026.json.
 *
 * Usage:
 *   pnpm update-scores                    # all groups, skip already-complete
 *   pnpm update-scores --group A          # single group only
 *   pnpm update-scores --force            # overwrite existing results
 *   pnpm update-scores --dry-run          # print diffs, don't write
 *   pnpm update-scores --group A --dry-run --force
 */

import 'dotenv/config';
import { GROUPS } from './lib/groups.js';
import {
  getSections,
  findMatchSections,
  getSectionWikitext,
  parseTeamCodes,
  isMatchComplete,
  parseScore,
} from './lib/wikipedia.js';
import { extractGoals } from './lib/claude.js';
import {
  loadData,
  saveData,
  computeResult,
  patchMatch,
  hasResult,
  type WC2026Data,
  type MatchResult,
} from './lib/patcher.js';

// ─── CLI argument parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);

const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

const groupFlagIdx = args.indexOf('--group');
const onlyGroup = groupFlagIdx !== -1 ? args[groupFlagIdx + 1]?.toUpperCase() : null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY is not set. Add it to .env or the environment.');
  process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────

const data: WC2026Data = loadData();
let anyChanges = false;

const groupsToProcess = onlyGroup
  ? GROUPS.filter((g) => g.id === onlyGroup)
  : GROUPS;

if (groupsToProcess.length === 0) {
  console.error(`❌  Unknown group "${onlyGroup}". Valid groups: A–L.`);
  process.exit(1);
}

console.log(`\n🌍  2026 FIFA World Cup — Score Updater`);
console.log(`    Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
console.log(`    Groups: ${groupsToProcess.map((g) => g.id).join(', ')}`);
console.log(`    Force: ${force ? 'yes' : 'no (skipping already-filled matches)'}\n`);

for (const group of groupsToProcess) {
  console.log(`\n📋  Group ${group.id} — ${group.wikiPage}`);

  // 1. Fetch section list from Wikipedia
  let sections;
  try {
    sections = await getSections(group.wikiPage);
  } catch (err) {
    console.error(`  ❌  Failed to fetch sections: ${err}`);
    continue;
  }

  // 2. Find the level-3 match sub-sections
  const matchSections = findMatchSections(sections);
  if (matchSections.length === 0) {
    console.log(`  ⏳  No match sections found yet — group may not have started.`);
    continue;
  }

  console.log(`  Found ${matchSections.length} match section(s)`);

  // 3. Process each match section
  for (const section of matchSections) {
    const title = section.line; // e.g. "Canada vs Bosnia and Herzegovina"
    console.log(`\n  ⚽  ${title}`);

    // 4. Fetch wikitext for this section
    let wikitext: string;
    try {
      wikitext = await getSectionWikitext(group.wikiPage, section.index);
    } catch (err) {
      console.error(`    ❌  Failed to fetch wikitext: ${err}`);
      continue;
    }

    // 5. Check if match has been played (football box present)
    if (!isMatchComplete(wikitext)) {
      console.log(`    ⏳  Match not yet played — skipping.`);
      continue;
    }

    // 6. Extract team FIFA codes from the football box
    const teamCodes = parseTeamCodes(wikitext);
    if (!teamCodes) {
      console.warn(`    ⚠  Could not parse team codes from football box — skipping.`);
      continue;
    }
    const [homeTeam, awayTeam] = teamCodes;
    console.log(`    Teams: ${homeTeam} (home) vs ${awayTeam} (away)`);

    // 7. Skip if already complete and not forcing
    if (!force && hasResult(data, group.id, homeTeam, awayTeam)) {
      console.log(`    ✅  Already has result data — skipping. (use --force to overwrite)`);
      continue;
    }

    // 8. Quick sanity check: parse the score from the football box
    const score = parseScore(wikitext);
    if (score) {
      console.log(`    Score: ${homeTeam} ${score[0]}–${score[1]} ${awayTeam}`);
    }

    // 9. Ask Claude to extract goals
    console.log(`    🤖  Asking Claude to extract goals...`);
    let goals;
    try {
      goals = await extractGoals(wikitext, homeTeam, awayTeam);
    } catch (err) {
      console.error(`    ❌  Claude extraction failed: ${err}`);
      continue;
    }

    if (goals.length === 0 && score && (score[0] + score[1]) > 0) {
      console.warn(`    ⚠  Claude returned 0 goals but score is ${score[0]}–${score[1]}. Investigate!`);
    }

    // 10. Compute result from goals
    const result: MatchResult = computeResult(goals, homeTeam, awayTeam);

    console.log(
      `    Goals: ${homeTeam} ${result.homeScore} (${result.homeHeadGoals}H + ${result.homeFeetGoals}F) ` +
      `vs ${awayTeam} ${result.awayScore} (${result.awayHeadGoals}H + ${result.awayFeetGoals}F)`,
    );

    for (const g of goals) {
      const type = g.isHeader ? '🗣️ head' : '🦶 foot';
      const min = g.minute ? `${g.minute}'` : '';
      const name = g.player ?? '?';
      console.log(`      ${type}  ${g.team} — ${name} ${min}`);
    }

    // 11. Sanity-check total against Wikipedia score
    if (score) {
      const homeOk = result.homeScore === score[0];
      const awayOk = result.awayScore === score[1];
      if (!homeOk || !awayOk) {
        console.warn(
          `    ⚠  Goal count mismatch! Wikipedia: ${score[0]}–${score[1]}, Claude: ${result.homeScore}–${result.awayScore}. Patching anyway.`,
        );
      }
    }

    // 12. Patch the data (or just print in dry-run mode)
    if (dryRun) {
      console.log(`    🔍  DRY RUN — would write result to wc2026.json`);
    } else {
      const patched = patchMatch(data, group.id, homeTeam, awayTeam, result);
      if (patched) {
        console.log(`    💾  Patched wc2026.json`);
        anyChanges = true;
      }
    }
  }
}

// 13. Save if anything changed
if (!dryRun && anyChanges) {
  saveData(data);
  console.log('\n✅  wc2026.json saved successfully.\n');
} else if (dryRun) {
  console.log('\n🔍  Dry run complete — no files were written.\n');
} else {
  console.log('\n✅  No changes needed.\n');
}
