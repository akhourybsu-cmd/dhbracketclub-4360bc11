// FORGE freeform log — in-progress ENTRY draft persistence.
//
// A session and each *committed* entry already live in the DB, so they
// survive an app kill. The one piece that doesn't is the entry a member is
// still composing in the sheet (sets typed, distance entered, which movement).
// This persists that draft to localStorage, keyed per session, so closing the
// app mid-exercise and coming back restores exactly where they were. (A
// running timer persists separately via useStopwatch's own timestamp store.)

import type { ExercisePick, LogSet } from './logScoring';

export interface LogDraft {
  pick: ExercisePick;
  sets: LogSet[];
  seconds: number;
  distanceMi: number;
  updatedAt: number;
}

const key = (sessionId: string) => `dh_workout_log_draft_v1:${sessionId}`;

export function loadDraft(sessionId?: string | null): LogDraft | null {
  if (!sessionId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (!raw) return null;
    const d = JSON.parse(raw) as LogDraft;
    return d && d.pick ? d : null;
  } catch { return null; }
}

export function saveDraft(sessionId: string | null | undefined, draft: Omit<LogDraft, 'updatedAt'>): void {
  if (!sessionId || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(key(sessionId), JSON.stringify({ ...draft, updatedAt: Date.now() })); } catch { /* ignore */ }
}

export function clearDraft(sessionId?: string | null): void {
  if (!sessionId || typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(key(sessionId)); } catch { /* ignore */ }
}

/** Whether a stored draft is for the same movement currently open. */
export function draftMatchesPick(draft: LogDraft | null, pick: ExercisePick | null): boolean {
  if (!draft || !pick) return false;
  return draft.pick.catalogId === pick.catalogId
    && draft.pick.name === pick.name
    && draft.pick.logKind === pick.logKind;
}
