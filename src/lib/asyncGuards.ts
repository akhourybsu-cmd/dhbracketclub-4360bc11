// DH Club — Async guards
//
// Shared helpers for keeping data-loading hooks from getting stuck on
// "perpetual loading" skeletons. The class of bug these prevent:
//
//   • A Supabase query (or any thenable) that never settles. Realtime
//     hiccups, dropped WebSockets, browser tab throttling, or a network
//     stall on the underlying fetch can leave a promise in an
//     unresolved state forever. If your hook does:
//
//         setLoading(true);
//         await Promise.allSettled([...queries]);
//         setLoading(false);   // ← never runs because allSettled
//                              //   only resolves when EVERY input
//                              //   settles, and one of them hung
//
//     the skeleton stays on screen with no way to recover short of a
//     full reload.
//
//   • A try/finally rescues `throw`s but NOT hangs. The promise inside
//     `await` simply never resumes — the `finally` block is unreachable.
//
// The fix is a hard deadline on every async dependency. `withTimeout`
// races a promise against a timer; if the timer wins, the awaiter sees
// a rejection and the surrounding `finally` runs as designed. Use
// `withTimeout` on individual queries (preferred — lets the other
// queries still complete) or wrap a whole `Promise.allSettled(...)` in
// it as a belt-and-suspenders deadline for the entire hydrate.
//
// Always include a `label` — it lands in the rejection message and the
// console warning so the next person debugging a stuck hook can tell
// which query hung instead of guessing.

/** Wrap a promise with a hard deadline. If `ms` elapses before `p`
 *  settles, the returned promise rejects with `${label} timed out after
 *  ${ms}ms`. The original promise is NOT cancelled (JS has no built-in
 *  cancellation) but its result is ignored — callers see the timeout.
 *
 *  Use this on every external async dependency in a loading hook so a
 *  hung query can never strand the UI on a skeleton. */
export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T>;
// Supabase query builders are thenables typed loosely (`any` when accessed via
// the `sb as any` escape hatch) — this overload keeps them usable without
// collapsing the result type to `{}`.
export function withTimeout<T = any>(p: any, ms: number, label: string): Promise<T>;
export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/** Default deadline for a single Supabase query inside a parallel
 *  hydrate. Long enough to survive a slow connection, short enough that
 *  the user isn't stuck staring at a skeleton for a full minute. */
export const QUERY_TIMEOUT_MS = 12_000;

/** Default deadline for an entire parallel hydrate (the outer
 *  `Promise.allSettled` race). Slightly longer than `QUERY_TIMEOUT_MS`
 *  so individual queries get a chance to time out cleanly first — only
 *  the outer race fires if something has gone catastrophically wrong
 *  (e.g. an unhandled microtask stall). */
export const HYDRATE_TIMEOUT_MS = 18_000;
