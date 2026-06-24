/**
 * claude.ts — Claude API client using tool use to extract goal data.
 *
 * Strategy: pass the complete match wikitext to Claude. The wikitext contains:
 * 1. Prose narrative with explicit "header" / "headed" / "head" mentions
 * 2. The football box template with goals1/goals2 listing scorers per team
 *
 * Claude calls record_goal() for each goal with team + isHeader.
 * Penalties, own goals, and deflections are treated as foot goals.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface GoalRecord {
  team: string;    // FIFA 3-letter code
  isHeader: boolean;
  minute?: number;
  player?: string;
}

const RECORD_GOAL_TOOL: Anthropic.Tool = {
  name: 'record_goal',
  description:
    'Record a single goal scored in the match. Call this once per goal. ' +
    'Do not call it for penalties that are saved, missed, or awarded but not taken.',
  input_schema: {
    type: 'object' as const,
    properties: {
      team: {
        type: 'string',
        description: 'FIFA 3-letter code of the team that scored (e.g. "MEX", "RSA")',
      },
      isHeader: {
        type: 'boolean',
        description:
          'True if the goal was explicitly described as scored with the head ' +
          '(words: "header", "headed", "heading"). False for all other goals ' +
          'including penalties, own goals, volleys, and deflections.',
      },
      minute: {
        type: 'number',
        description: 'Minute the goal was scored (optional)',
      },
      player: {
        type: 'string',
        description: 'Scorer last name (optional, for logging)',
      },
    },
    required: ['team', 'isHeader'],
  },
};

const SYSTEM_PROMPT = `You are parsing Wikipedia wikitext for a FIFA World Cup match to extract goal data.

The wikitext contains two complementary data sources:
1. A football box template with |goals1= (home team goals) and |goals2= (away team goals) listing each scorer and minute
2. Prose narrative describing how each goal was scored

Your task: for every goal scored in the match, call the record_goal tool exactly once.

Rules:
- A goal is a HEADER only if the prose explicitly uses words like "header", "headed", or "heading"
- All other goals (volleys, penalties, own goals, deflections, tap-ins, shots, etc.) are FOOT goals (isHeader: false)
- Own goals count as a goal for the team that received them (the team it went into the net of)
- Penalties that are scored count as foot goals
- Do not call record_goal for goals that were disallowed, or penalties that were missed/saved
- The home team is team1 in the football box (|goals1=), the away team is team2 (|goals2=)

You will be told which FIFA code corresponds to the home and away team.`;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _client;
}

/**
 * Extract goals from a match wikitext section using Claude tool use.
 *
 * @param wikitext  Full wikitext for a single match section
 * @param homeTeam  FIFA code for the home team (team1 / goals1)
 * @param awayTeam  FIFA code for the away team (team2 / goals2)
 */
export async function extractGoals(
  wikitext: string,
  homeTeam: string,
  awayTeam: string,
): Promise<GoalRecord[]> {
  const client = getClient();
  const goals: GoalRecord[] = [];

  const userMessage = `The home team is ${homeTeam} and the away team is ${awayTeam}.

Here is the Wikipedia wikitext for this match:

${wikitext}

Please call record_goal for each goal scored in this match.`;

  let messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage },
  ];

  // Agentic loop: keep going until Claude stops calling tools
  while (true) {
    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [RECORD_GOAL_TOOL],
      messages,
    });

    // Collect any tool calls from this turn
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    for (const block of toolUseBlocks) {
      if (block.name === 'record_goal') {
        const input = block.input as {
          team: string;
          isHeader: boolean;
          minute?: number;
          player?: string;
        };
        goals.push({
          team: input.team,
          isHeader: input.isHeader,
          minute: input.minute,
          player: input.player,
        });
      }
    }

    // If Claude is done (no more tool calls), stop
    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
      break;
    }

    // Otherwise, feed the tool results back and continue
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: toolUseBlocks.map((block) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: 'Recorded.',
        })),
      },
    ];
  }

  return goals;
}
