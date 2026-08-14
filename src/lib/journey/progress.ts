// The Splendid Journey — lightweight UI-position persistence.
//
// Mobile webviews and preview iframes reload the page when it's backgrounded,
// which throws away in-memory React state: scroll position, which panel of a
// scene you were reading, the Studio editor contents. The run itself is safe
// (it lives server-side, addressed by the runId in the URL); this module just
// remembers the *ephemeral reading position* so a reload lands you back where
// you were instead of at the top of the scene.

export interface ReadPos {
  sceneKey: string;
  panel: number;
  scrollY: number;
}

const posKey = (runId: string) => `dh_journey_pos_v1:${runId}`;

export function loadReadPos(runId?: string | null): ReadPos | null {
  if (!runId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(posKey(runId));
    return raw ? (JSON.parse(raw) as ReadPos) : null;
  } catch {
    return null;
  }
}

export function saveReadPos(runId: string | undefined | null, pos: ReadPos): void {
  if (!runId || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(posKey(runId), JSON.stringify(pos));
  } catch {
    /* storage full / unavailable — position is a nicety, never fatal */
  }
}
