/**
 * groups.ts — Static configuration for all 12 World Cup groups.
 *
 * Maps each group to its Wikipedia page and provides a lookup from
 * Wikipedia full-name variants → FIFA 3-letter codes.
 */

export interface GroupConfig {
  id: string;
  wikiPage: string;
  /** Maps any Wikipedia name variant for a team to its FIFA code */
  teamNames: Record<string, string>;
}

export const GROUPS: GroupConfig[] = [
  {
    id: 'A',
    wikiPage: '2026_FIFA_World_Cup_Group_A',
    teamNames: {
      Mexico: 'MEX',
      'South Africa': 'RSA',
      'South Korea': 'KOR',
      'Czech Republic': 'CZE',
      Czechia: 'CZE',
    },
  },
  {
    id: 'B',
    wikiPage: '2026_FIFA_World_Cup_Group_B',
    teamNames: {
      Canada: 'CAN',
      'Bosnia and Herzegovina': 'BIH',
      Bosnia: 'BIH',
      Qatar: 'QAT',
      Switzerland: 'SUI',
    },
  },
  {
    id: 'C',
    wikiPage: '2026_FIFA_World_Cup_Group_C',
    teamNames: {
      Brazil: 'BRA',
      Morocco: 'MAR',
      Haiti: 'HAI',
      Scotland: 'SCO',
    },
  },
  {
    id: 'D',
    wikiPage: '2026_FIFA_World_Cup_Group_D',
    teamNames: {
      Australia: 'AUS',
      Paraguay: 'PAR',
      Turkey: 'TUR',
      'United States': 'USA',
      'United States of America': 'USA',
    },
  },
  {
    id: 'E',
    wikiPage: '2026_FIFA_World_Cup_Group_E',
    teamNames: {
      Germany: 'GER',
      'Curaçao': 'CUW',
      Curacao: 'CUW',
      'Ivory Coast': 'CIV',
      "Côte d'Ivoire": 'CIV',
      Ecuador: 'ECU',
    },
  },
  {
    id: 'F',
    wikiPage: '2026_FIFA_World_Cup_Group_F',
    teamNames: {
      Japan: 'JPN',
      Netherlands: 'NED',
      Sweden: 'SWE',
      Tunisia: 'TUN',
    },
  },
  {
    id: 'G',
    wikiPage: '2026_FIFA_World_Cup_Group_G',
    teamNames: {
      Belgium: 'BEL',
      Egypt: 'EGY',
      Iran: 'IRN',
      'New Zealand': 'NZL',
    },
  },
  {
    id: 'H',
    wikiPage: '2026_FIFA_World_Cup_Group_H',
    teamNames: {
      Spain: 'ESP',
      'Cape Verde': 'CPV',
      'Saudi Arabia': 'KSA',
      Uruguay: 'URU',
    },
  },
  {
    id: 'I',
    wikiPage: '2026_FIFA_World_Cup_Group_I',
    teamNames: {
      France: 'FRA',
      Senegal: 'SEN',
      Iraq: 'IRQ',
      Norway: 'NOR',
    },
  },
  {
    id: 'J',
    wikiPage: '2026_FIFA_World_Cup_Group_J',
    teamNames: {
      Argentina: 'ARG',
      Algeria: 'ALG',
      Austria: 'AUT',
      Jordan: 'JOR',
    },
  },
  {
    id: 'K',
    wikiPage: '2026_FIFA_World_Cup_Group_K',
    teamNames: {
      Portugal: 'POR',
      'DR Congo': 'COD',
      'Democratic Republic of the Congo': 'COD',
      Uzbekistan: 'UZB',
      Colombia: 'COL',
    },
  },
  {
    id: 'L',
    wikiPage: '2026_FIFA_World_Cup_Group_L',
    teamNames: {
      England: 'ENG',
      Croatia: 'CRO',
      Ghana: 'GHA',
      Panama: 'PAN',
    },
  },
];
