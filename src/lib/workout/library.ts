// FORGE built-in exercise library.
//
// The system builds every weekly gauntlet from this curated set — no
// commissioner authoring required. Each entry carries its logging preset,
// a per-PERSON weekly baseline (canonical unit), a scaling rule, and a
// tutorial. Competition scoring is normalized so hitting ~baseline earns a
// comparable point haul across exercises (points_per_unit = 1000/baseline,
// capped at 1500), keeping the leaderboard fair across very different moves.
//
// `lib_key` is the stable identity; it's stored on the seeded
// workout_exercises row (logging_config.lib_key) so tutorials + baselines
// can be looked up regardless of any later name edits.

import type { MeasurementType, ExerciseCategory, LoggingConfig, ScoringConfig, MilestoneConfig } from './types';

export interface ExerciseTutorial {
  summary: string;
  steps: string[];
  cues: string[];
  mistakes?: string[];
}

export interface LibraryExercise {
  key: string;
  name: string;
  category: ExerciseCategory;
  measurement_type: MeasurementType;
  unit: string;
  icon: string;                 // lucide name
  difficulty: 1 | 2 | 3;        // 1 easy · 3 hard (used to balance a week)
  baseline: number;             // per-person weekly target, canonical unit
  logging_config: LoggingConfig;
  milestone_config: MilestoneConfig;
  tutorial: ExerciseTutorial;
}

function scoringFor(baseline: number): ScoringConfig {
  const ppu = Math.round((1000 / baseline) * 100) / 100;
  return { points_per_unit: ppu, max_weekly_points: 1500, xp_per_unit: Math.round((100 / baseline) * 100) / 100 };
}

const REPS = (quick: number[]): LoggingConfig => ({ quick_add: quick });
const HOLD: LoggingConfig = { timer_mode: 'stopwatch', allow_pause: true };

export const LIBRARY: LibraryExercise[] = [
  {
    key: 'push-ups', name: 'Push-Ups', category: 'upper_body', measurement_type: 'reps', unit: 'reps',
    icon: 'Dumbbell', difficulty: 2, baseline: 150, logging_config: REPS([5, 10, 20]),
    milestone_config: { lifetime: [100, 500, 1000, 2500, 5000, 10000] },
    tutorial: {
      summary: 'The classic upper-body push — chest, shoulders and triceps.',
      steps: [
        'Start in a high plank: hands under shoulders, body in a straight line.',
        'Brace your core and squeeze your glutes.',
        'Bend your elbows and lower until your chest is ~a fist off the floor.',
        'Press back up to the start. That’s one rep.',
      ],
      cues: ['Keep elbows ~45° from your body, not flared out.', 'Hips in line — don’t let them sag or pike.'],
      mistakes: ['Half reps — lower with control.', 'Head dropping forward; keep a neutral neck.'],
    },
  },
  {
    key: 'knee-push-ups', name: 'Knee Push-Ups', category: 'upper_body', measurement_type: 'reps', unit: 'reps',
    icon: 'Dumbbell', difficulty: 1, baseline: 120, logging_config: REPS([5, 10, 20]),
    milestone_config: { lifetime: [100, 500, 1000, 2500] },
    tutorial: {
      summary: 'A scaled push-up from the knees — build pressing strength.',
      steps: ['Kneel and place hands under shoulders.', 'Form a straight line from knees to head.', 'Lower your chest toward the floor.', 'Press back up.'],
      cues: ['Cross your ankles for stability.', 'Keep the core tight so hips don’t sag.'],
    },
  },
  {
    key: 'squats', name: 'Squats', category: 'lower_body', measurement_type: 'reps', unit: 'reps',
    icon: 'Footprints', difficulty: 1, baseline: 300, logging_config: REPS([10, 25, 50]),
    milestone_config: { lifetime: [250, 1000, 2500, 5000, 10000] },
    tutorial: {
      summary: 'Bodyweight squat — the foundational lower-body move.',
      steps: ['Stand with feet shoulder-width, toes slightly out.', 'Push your hips back and bend your knees.', 'Lower until thighs are ~parallel to the floor.', 'Drive through your heels to stand tall.'],
      cues: ['Knees track over your toes, not caving in.', 'Chest up, weight in your heels.'],
      mistakes: ['Rising onto your toes.', 'Not going deep enough — aim for parallel.'],
    },
  },
  {
    key: 'lunges', name: 'Lunges', category: 'lower_body', measurement_type: 'reps', unit: 'reps',
    icon: 'Footprints', difficulty: 2, baseline: 150, logging_config: REPS([5, 10, 20]),
    milestone_config: { lifetime: [100, 500, 1000, 2500] },
    tutorial: {
      summary: 'Alternating lunges — single-leg strength and balance. Count each leg.',
      steps: ['Stand tall, hands on hips.', 'Step one foot forward and lower until both knees are ~90°.', 'Push back to standing.', 'Alternate legs — each step is one rep.'],
      cues: ['Front knee stays over the ankle.', 'Torso upright, core braced.'],
    },
  },
  {
    key: 'glute-bridges', name: 'Glute Bridges', category: 'lower_body', measurement_type: 'reps', unit: 'reps',
    icon: 'Footprints', difficulty: 1, baseline: 200, logging_config: REPS([10, 20, 30]),
    milestone_config: { lifetime: [200, 1000, 2500] },
    tutorial: {
      summary: 'Hip bridges — glutes and posterior chain.',
      steps: ['Lie on your back, knees bent, feet flat.', 'Drive through your heels and lift your hips.', 'Squeeze your glutes at the top.', 'Lower with control.'],
      cues: ['Make a straight line from knees to shoulders.', 'Don’t arch your lower back — squeeze the glutes.'],
    },
  },
  {
    key: 'sit-ups', name: 'Sit-Ups', category: 'core', measurement_type: 'reps', unit: 'reps',
    icon: 'Target', difficulty: 1, baseline: 200, logging_config: REPS([10, 25, 50]),
    milestone_config: { lifetime: [200, 1000, 2500, 5000] },
    tutorial: {
      summary: 'Full sit-ups for the abs.',
      steps: ['Lie back, knees bent, feet flat.', 'Cross arms or reach toward your knees.', 'Curl all the way up.', 'Lower with control.'],
      cues: ['Lead with your chest, not your neck.', 'Exhale on the way up.'],
      mistakes: ['Yanking your head with your hands.'],
    },
  },
  {
    key: 'plank', name: 'Plank', category: 'core', measurement_type: 'timed_hold', unit: 'seconds',
    icon: 'Timer', difficulty: 2, baseline: 600, logging_config: HOLD,
    milestone_config: { session: [30, 60, 120, 180, 300], lifetime: [1800, 3600, 7200] },
    tutorial: {
      summary: 'An isometric hold for the whole core.',
      steps: ['Forearms on the floor, elbows under shoulders.', 'Extend your legs, toes on the floor.', 'Make a straight line from head to heels.', 'Hold — start the timer and breathe.'],
      cues: ['Squeeze glutes and brace your abs.', 'Don’t let hips sag or pike.'],
      mistakes: ['Holding your breath.', 'Hips creeping up.'],
    },
  },
  {
    key: 'wall-sit', name: 'Wall Sit', category: 'lower_body', measurement_type: 'timed_hold', unit: 'seconds',
    icon: 'Timer', difficulty: 2, baseline: 480, logging_config: HOLD,
    milestone_config: { session: [30, 60, 120, 180], lifetime: [1200, 3600] },
    tutorial: {
      summary: 'An isometric quad burner against a wall.',
      steps: ['Stand with your back against a wall.', 'Slide down until thighs are parallel, knees at 90°.', 'Keep your back flat against the wall.', 'Hold.'],
      cues: ['Knees over ankles, not past your toes.', 'Weight in your heels.'],
    },
  },
  {
    key: 'superman-hold', name: 'Superman Hold', category: 'core', measurement_type: 'timed_hold', unit: 'seconds',
    icon: 'Timer', difficulty: 1, baseline: 240, logging_config: HOLD,
    milestone_config: { session: [20, 45, 90], lifetime: [600, 1800] },
    tutorial: {
      summary: 'A back-extension hold for the posterior chain.',
      steps: ['Lie face down, arms extended overhead.', 'Lift arms, chest and legs off the floor.', 'Hold the “flying” position.'],
      cues: ['Look at the floor to keep your neck neutral.', 'Squeeze glutes and lower back.'],
    },
  },
  {
    key: 'jumping-jacks', name: 'Jumping Jacks', category: 'cardio', measurement_type: 'reps', unit: 'reps',
    icon: 'HeartPulse', difficulty: 1, baseline: 500, logging_config: REPS([10, 25, 50]),
    milestone_config: { lifetime: [500, 2500, 10000] },
    tutorial: {
      summary: 'Classic full-body cardio.',
      steps: ['Stand tall, arms at your sides.', 'Jump feet out while raising arms overhead.', 'Jump back to the start. That’s one rep.'],
      cues: ['Land soft through the knees.', 'Keep a steady rhythm.'],
    },
  },
  {
    key: 'high-knees', name: 'High Knees', category: 'cardio', measurement_type: 'reps', unit: 'reps',
    icon: 'HeartPulse', difficulty: 2, baseline: 400, logging_config: REPS([10, 25, 50]),
    milestone_config: { lifetime: [400, 2000, 8000] },
    tutorial: {
      summary: 'Running in place, driving the knees high. Count each knee.',
      steps: ['Stand tall, arms bent.', 'Drive one knee up to hip height.', 'Quickly switch — pump your arms.', 'Each knee up is one rep.'],
      cues: ['Stay on the balls of your feet.', 'Keep your chest tall.'],
    },
  },
  {
    key: 'mountain-climbers', name: 'Mountain Climbers', category: 'cardio', measurement_type: 'reps', unit: 'reps',
    icon: 'HeartPulse', difficulty: 2, baseline: 300, logging_config: REPS([10, 20, 50]),
    milestone_config: { lifetime: [300, 1500, 6000] },
    tutorial: {
      summary: 'A high-plank cardio move. Count each knee drive.',
      steps: ['Start in a high plank.', 'Drive one knee toward your chest.', 'Switch legs quickly, keeping hips low.'],
      cues: ['Shoulders stay over your wrists.', 'Don’t bounce your hips up.'],
    },
  },
  {
    key: 'burpees', name: 'Burpees', category: 'full_body', measurement_type: 'reps', unit: 'reps',
    icon: 'PersonStanding', difficulty: 3, baseline: 80, logging_config: REPS([1, 5, 10]),
    milestone_config: { lifetime: [50, 250, 1000, 2500] },
    tutorial: {
      summary: 'The full-body finisher — squat, plank, push, jump.',
      steps: ['From standing, squat and place hands on the floor.', 'Jump your feet back to a plank (add a push-up to make it harder).', 'Jump your feet back in.', 'Explode up into a jump. That’s one rep.'],
      cues: ['Land soft.', 'Keep the core braced in the plank.'],
      mistakes: ['Sagging hips in the plank.'],
    },
  },
  {
    key: 'mobility-flow', name: 'Mobility Flow', category: 'mobility', measurement_type: 'duration', unit: 'seconds',
    icon: 'StretchHorizontal', difficulty: 1, baseline: 1200, logging_config: { timer_mode: 'stopwatch', allow_pause: true, allow_manual: true },
    milestone_config: { lifetime: [1800, 7200, 21600, 54000] },

    tutorial: {
      summary: 'Gentle stretching / mobility — log the minutes you move.',
      steps: ['Pick a few areas: hips, hamstrings, shoulders, back.', 'Move slowly through each stretch, breathing deeply.', 'Start the timer (or log minutes) while you flow.'],
      cues: ['Never bounce — hold each stretch.', 'Breathe into the stretch, don’t force it.'],
    },
  },
  {
    key: 'walk-run', name: 'Walk / Run', category: 'cardio', measurement_type: 'distance', unit: 'mi',
    icon: 'MapPin', difficulty: 1, baseline: 6, logging_config: { distance_unit: 'mi', allow_manual: true },
    milestone_config: { lifetime: [10, 26, 100, 250] },
    tutorial: {
      summary: 'Log the miles you walk, jog or run this week.',
      steps: ['Head out for a walk or run.', 'When you’re done, log the distance in miles.'],
      cues: ['Warm up with an easy few minutes.', 'Consistency beats intensity — get out often.'],
    },
  },
];

export const LIBRARY_BY_KEY: Record<string, LibraryExercise> =
  Object.fromEntries(LIBRARY.map(e => [e.key, e]));

/** The DB-shaped payload for a library exercise (what ensure_forge_week upserts). */
export function toExercisePayload(e: LibraryExercise) {
  return {
    lib_key: e.key,
    name: e.name,
    category: e.category,
    measurement_type: e.measurement_type,
    unit: e.unit,
    icon_name: e.icon,
    logging_config: { ...e.logging_config, lib_key: e.key },
    scoring_config: scoringFor(e.baseline),
    default_weekly_goal: e.baseline,
    milestone_config: e.milestone_config,
  };
}

/**
 * Deterministically pick a category-balanced set of exercises for a given
 * week index — rotates weekly, identical for the whole club so the
 * competition is shared. Always includes one upper, lower, core, cardio,
 * and a rotating "wildcard" (mobility / full-body / distance).
 */
export function pickWeeklySet(weekIndex: number): LibraryExercise[] {
  const byCat = (c: ExerciseCategory) => LIBRARY.filter(e => e.category === c);
  const rot = <T,>(arr: T[], i: number) => arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : undefined;

  const upper = rot(byCat('upper_body'), weekIndex);
  const lower = rot(byCat('lower_body'), weekIndex);
  const core = rot(byCat('core'), weekIndex);
  const cardio = rot(byCat('cardio'), weekIndex);
  const wildcardPool = [...byCat('mobility'), ...byCat('full_body')];
  const wildcard = rot(wildcardPool, weekIndex);

  return [upper, lower, core, cardio, wildcard].filter((x): x is LibraryExercise => !!x);
}

/** Whole weeks since a fixed Monday epoch — the rotation index. */
export function weekIndexOf(mondayStart: Date): number {
  const epoch = Date.UTC(2024, 0, 1); // a Monday
  return Math.floor((mondayStart.getTime() - epoch) / (7 * 86400000));
}

const WEEK_TITLES = [
  'Full Body Blitz', 'Iron Monday', 'The Grind', 'Sweat Equity', 'Forge Ahead',
  'Burn Week', 'No Days Off', 'The Anvil', 'Heat Wave', 'Molten Monday',
];
export function weekTitleFor(weekIndex: number): string {
  return WEEK_TITLES[((weekIndex % WEEK_TITLES.length) + WEEK_TITLES.length) % WEEK_TITLES.length];
}
