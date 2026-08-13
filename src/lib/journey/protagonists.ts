// Campaigns that tell the story of a fixed, authored protagonist.
//
// Presentation/launch metadata only: it never touches run state. When a
// campaign appears here the hero picker is skipped entirely — the player
// steps into the authored character instead of forging their own.

export interface Protagonist {
  name: string;
  pronouns?: string;
  origin?: string;
  /** One line shown on the campaign card. */
  blurb: string;
}

export const JOURNEY_PROTAGONISTS: Record<string, Protagonist> = {
  'the-discovery-below': {
    name: 'Theron',
    pronouns: 'he/him',
    origin: 'Edenite miner of Crownvein, Fulminary',
    blurb: 'You play as Theron, a quiet young miner working the newest cut at Crownvein.',
  },
};

export const protagonistFor = (slug?: string | null): Protagonist | null =>
  (slug ? JOURNEY_PROTAGONISTS[slug] ?? null : null);
