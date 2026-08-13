// Optional, replayable story introductions shown BEFORE a campaign starts.
//
// These are presentation-only lore prefaces keyed by campaign slug. They are
// deliberately NOT part of any campaign package: they never touch the scene
// graph, campaign state variables, runs, progress or ending resolution.

export interface ProloguePanel {
  /** Short caption describing the intended still image. */
  visual_brief: string;
  /** Paragraphs displayed on this panel. */
  paragraphs: string[];
}

export interface Prologue {
  eyebrow: string;
  title: string;
  subtitle: string;
  panels: ProloguePanel[];
  /** Label for the final action that launches the real campaign. */
  launchLabel: string;
}

export const JOURNEY_PROLOGUES: Record<string, Prologue> = {
  'the-discovery-below': {
    eyebrow: 'A prologue from the closing days before the Age of Reckoning',
    title: 'The Discovery Below',
    subtitle: 'Before the Age of Reckoning had a name',
    launchLabel: "Begin Theron's Story",
    panels: [
      {
        visual_brief: 'Mesoplasia, with Fulminary emphasized in the northwest. ASSET UNRESOLVED.',
        paragraphs: [
          'Before historians named the Age of Reckoning, the people of Mesoplasia believed their greatest dangers were the ones they already understood.',
          'Kingdoms argued over borders. Roads carried merchants, pilgrims, and rumor. Old tales spoke of horrors driven from the world long ago, but such stories belonged to ruined books and frightened children.',
        ],
      },
      {
        visual_brief: 'Fulminary beneath gathering storm clouds. ASSET UNRESOLVED.',
        paragraphs: [
          'In the northwest lay Fulminary, a remote elven territory shaped by stone, storm, and the luminous mineral called Edenite.',
        ],
      },
      {
        visual_brief: 'The capital city of Sturmvale. ASSET UNRESOLVED.',
        paragraphs: [
          "Most of Fulminary's people lived near Sturmvale, its crowded capital and the center of an expanding mining industry. For generations, Edenite had been valued for its beauty and resilience. Only recently had its greater properties become known.",
        ],
      },
      {
        visual_brief: 'Miners extracting Edenite while healers and builders use it. ASSET UNRESOLVED.',
        paragraphs: [
          'In the hands of healers, it could strengthen damaged flesh.',
          "Set into walls and foundations, it could help buildings endure Fulminary's violent weather.",
          'And as the storms worsened, the people needed more of it.',
        ],
      },
      {
        visual_brief: 'Crownvein Mine newly opened beneath a darkening sky. ASSET UNRESOLVED.',
        paragraphs: [
          'The High Council ordered the mines expanded. New shafts were driven deeper. Extraction quotas rose. Every cart of Edenite promised stronger homes, fuller infirmaries, and another season of survival.',
          'Few questioned why the storms grew harsher as the mines grew richer.',
          'Fewer still wondered whether the stone beneath their feet had been left there for a reason.',
          'At Crownvein, the newest and most productive mine in Fulminary, workers had uncovered an Edenite concentration unlike anything previously recorded.',
          'Among those assigned to the new cut was a quiet young miner named Theron.',
          'He was not a soldier, a scholar, or anyone the leaders of Sturmvale considered important.',
          'But Theron had spent years asking what Edenite could do.',
          'He was about to discover what it had been doing all along.',
        ],
      },
    ],
  },
};

export const prologueFor = (slug?: string | null): Prologue | null =>
  (slug ? JOURNEY_PROLOGUES[slug] ?? null : null);
