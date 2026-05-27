/** Tiny event bus for opening the Draft Season Welcome from anywhere inside /drafts/*. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function openSeasonWelcome() {
  listeners.forEach(l => l());
}

export function subscribeOpenSeasonWelcome(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
