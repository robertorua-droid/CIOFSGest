export function createEventBus() {
  /** @type {Record<string, Function[]>} */
  const map = Object.create(null);

  return {
    on(ev, fn) {
      (map[ev] = map[ev] || []).push(fn);
      return () => this.off(ev, fn);
    },
    off(ev, fn) {
      map[ev] = (map[ev] || []).filter(f => f !== fn);
    },
    emit(ev, payload) {
      (map[ev] || []).slice().forEach(f => {
        try { f(payload); } catch (e) { console.error('[events]', ev, e); }
      });
    }
  };
}
