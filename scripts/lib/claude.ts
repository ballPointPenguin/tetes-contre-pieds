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

const SYSTEM_PROMPT = `You are a football expert parsing Wikipedia wikitext for a 2026 FIFA World Cup match.

The wikitext contains:
1. A football box template listing goals per team: |goals1= (home) and |goals2= (away)
2. Prose narrative describing how the match unfolded

Your task: call record_goal once for every goal that was scored and counted.

For each goal, determine whether it was a HEADER — meaning the player made contact with the ball using their head to score. Use your understanding of the prose description as a whole; you don't need an explicit trigger word, just a clear indication the player used their head. When the prose doesn't describe the method of a goal at all, assume it was scored with the foot (isHeader: false).

A few mechanical rules to follow precisely:
- Own goals are credited to the team that benefited (the ball went into their net), not the player who scored them. Apply the header/foot judgment to own goals the same way you would any other goal.
- Penalties that are scored count as foot goals.
- Do not record goals that were disallowed, or penalties that were missed or saved.
- The home team is team1 (|goals1=), the away team is team2 (|goals2=).

You will be told the FIFA 3-letter codes for the home and away team.`;

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
