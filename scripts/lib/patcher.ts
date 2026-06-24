/**
 * patcher.ts — Reads and writes src/data/wc2026.json.
 *
 * Computes goal breakdowns from a list of GoalRecord objects and
 * patches the relevant match's result fields in-place.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GoalRecord } from './claude.js';

// Resolved path to the data file (relative to repo root)
const DATA_FILE = resolve(import.meta.dirname, '../../src/data/wc2026.json');

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  homeFeetGoals: number;
  homeHeadGoals: number;
  awayFeetGoals: number;
  awayHeadGoals: number;
}

export interface MatchData {
  id: number;
  home: string;
  away: string;
  date: string;
  venue: string;
  result?: MatchResult;
}

export interface GroupData {
  id: string;
  name: string;
  teams: string[];
  matches: MatchData[];
}

export interface WC2026Data {
  groups: GroupData[];
}

/** Load and parse the JSON data file */
export function loadData(): WC2026Data {
  return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
}

/** Write updated data back to the JSON file */
export function saveData(data: WC2026Data): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/** Compute a MatchResult from a list of GoalRecord objects */
export function computeResult(
  goals: GoalRecord[],
  homeTeam: string,
  awayTeam: string,
): MatchResult {
  let homeFeet = 0, homeHead = 0, awayFeet = 0, awayHead = 0;

  for (const goal of goals) {
    if (goal.team === homeTeam) {
      goal.isHeader ? homeHead++ : homeFeet++;
    } else if (goal.team === awayTeam) {
      goal.isHeader ? awayHead++ : awayFeet++;
    } else {
      // Unknown team — log a warning but don't crash
      console.warn(`  ⚠  Unknown team in goal: "${goal.team}" (expected ${homeTeam} or ${awayTeam})`);
    }
  }

  return {
    homeScore: homeFeet + homeHead,
    awayScore: awayFeet + awayHead,
    homeFeetGoals: homeFeet,
    homeHeadGoals: homeHead,
    awayFeetGoals: awayFeet,
    awayHeadGoals: awayHead,
  };
}

/**
 * Patch a specific match's result in the data object.
 * Returns true if the match was found and updated.
 */
export function patchMatch(
  data: WC2026Data,
  groupId: string,
  homeTeam: string,
  awayTeam: string,
  result: MatchResult,
): boolean {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) {
    console.warn(`Group ${groupId} not found in data`);
    return false;
  }

  const match = group.matches.find(
    (m) => m.home === homeTeam && m.away === awayTeam,
  );
  if (!match) {
    console.warn(`Match ${homeTeam} vs ${awayTeam} not found in group ${groupId}`);
    return false;
  }

  match.result = result;
  return true;
}

/** Check if a match already has result data */
export function hasResult(
  data: WC2026Data,
  groupId: string,
  homeTeam: string,
  awayTeam: string,
): boolean {
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return false;
  const match = group.matches.find(
    (m) => m.home === homeTeam && m.away === awayTeam,
  );
  return !!match?.result;
}
