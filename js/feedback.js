const ratings = new Set(['accurate', 'partial', 'off']);

// A fresh recorder belongs to each displayed result, not the whole tab session.
export function createFeedback(emit) {
  let sent = false;
  return (rating) => {
    if (sent || !ratings.has(rating)) return false;
    sent = true;
    try { Promise.resolve(emit(rating)).catch(() => {}); } catch { /* Never block the result. */ }
    return true;
  };
}
