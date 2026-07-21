import { lazy, type ComponentType } from "react";

/**
 * Wraps React.lazy() with automatic recovery from stale-chunk errors.
 * After a redeploy, cached HTML may reference chunk hashes that no longer
 * exist, producing "Failed to fetch dynamically imported module". We reload
 * once (with a session flag guard) to pick up the fresh index.html + chunks.
 */
const RELOAD_KEY = "dh_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

function shouldReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
    return Date.now() - last > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markReload() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      const msg = String((err as any)?.message ?? err ?? "");
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk [\w-]+ failed/i.test(msg);

      if (isChunkError && shouldReload()) {
        markReload();
        const url = new URL(window.location.href);
        url.searchParams.set("_v", Date.now().toString());
        window.location.replace(url.toString());
        // Return a never-resolving promise so Suspense keeps its fallback
        // visible until the reload actually happens.
        return await new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
