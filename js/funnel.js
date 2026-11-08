// Session-level funnel bookkeeping only. No session ID, route choice or place data.
export const funnelEvents = Object.freeze(['city_open', 'city_start', 'city_complete']);
const storageKey = 'city.funnel.v1';
const sources = new Set(['wechat_moments', 'direct', 'other']);

export function createFunnel({storage, search = '', emit}) {
  const incomingSource = new URLSearchParams(search).get('utm_source');
  let state = {
    source: incomingSource === 'wechat_moments' ? 'wechat_moments' : incomingSource ? 'other' : 'direct',
    sent: []
  };
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved && sources.has(saved.source) && Array.isArray(saved.sent)) {
      state = {source: saved.source, sent: saved.sent.filter(event => funnelEvents.includes(event))};
    }
  } catch { /* Storage denied/corrupted: keep in-memory deduplication. */ }

  return function record(event) {
    if (!funnelEvents.includes(event) || state.sent.includes(event)) return false;
    // Record an attempt before emitting: retries/re-renders must not double-count.
    state.sent.push(event);
    try { storage?.setItem(storageKey, JSON.stringify(state)); } catch { /* No impact on the walk. */ }
    try {
      Promise.resolve(emit(event, {source: state.source})).catch(() => {});
    } catch { /* Analytics failures must never block the walk. */ }
    return true;
  };
}
