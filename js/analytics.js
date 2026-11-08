// Only source + two fixed funnel nodes leave the browser. No session/user ID.
export const SESSION_KEY = "city-funnel-session-v1";
export const IDLE_MS = 30 * 60 * 1000;
const names = { home: "city_home_session", content: "city_content_session" };
export function createFunnel({
  storage,
  send,
  now = Date.now,
  source = "other",
}) {
  source = source === "wechat_moments" ? "wechat_moments" : "other";
  function session(touch = false) {
    const time = now();
    let state;
    try {
      state = JSON.parse(storage.getItem(SESSION_KEY));
      if (
        !state ||
        !["wechat_moments", "other"].includes(state.source) ||
        typeof state.home !== "boolean" ||
        typeof state.content !== "boolean" ||
        !Number.isFinite(state.lastActivity) ||
        state.lastActivity > time ||
        time - state.lastActivity >= IDLE_MS
      )
        state = { source, home: false, content: false, lastActivity: time };
      if (touch) state.lastActivity = time;
      // Prove writable storage before counting; otherwise do not guess sessions.
      storage.setItem(SESSION_KEY, JSON.stringify(state));
      return state;
    } catch {
      return null;
    }
  }
  return {
    touch() {
      session(true);
    },
    shown(node) {
      if (!Object.hasOwn(names, node)) return false;
      const state = session(true);
      if (!state || state[node] || (node === "content" && !state.home))
        return false;
      if (node === "home" && !state.home) state.source = source;
      state[node] = true;
      try {
        storage.setItem(SESSION_KEY, JSON.stringify(state));
        send(names[node], { source: state.source });
        return true;
      } catch {
        return false;
      }
    },
  };
}
let funnel;
function currentFunnel() {
  if (funnel) return funnel;
  // localhost stays offline; deployed Preview and Production use the same adapter.
  if (!location.hostname.endsWith(".vercel.app")) return null;
  try {
    const storage = window.sessionStorage;
    // This queue and same-origin script integration follow @vercel/analytics.
    window.va ||= function (...args) {
      (window.vaq ||= []).push(args);
    };
    window.va("beforeSend", (event) =>
      event.type === "event" ? { ...event, url: location.origin + "/" } : null,
    );
    if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
      const script = document.createElement("script");
      script.src = "/_vercel/insights/script.js";
      script.defer = true;
      script.dataset.disableAutoTrack = "1";
      script.dataset.sdkn = "city-funnel";
      script.referrerPolicy = "no-referrer";
      document.head.append(script);
    }
    const source =
      new URLSearchParams(location.search).get("utm_source") ===
      "wechat_moments"
        ? "wechat_moments"
        : "other";
    funnel = createFunnel({
      storage,
      source,
      send: (name, data) => window.va("event", { name, data }),
    });
    const touch = () => funnel.touch();
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) touch();
    });
    return funnel;
  } catch {
    return null;
  }
}
export function homeShown() {
  try {
    currentFunnel()?.shown("home");
  } catch {}
}
export function contentShown() {
  try {
    currentFunnel()?.shown("content");
  } catch {}
}

// Keep the idle window accurate on internal tools without loading a collector there.
export function resumeSession() {
  try {
    if (
      !location.hostname.endsWith(".vercel.app") ||
      !sessionStorage.getItem(SESSION_KEY)
    )
      return;
    const tracker = createFunnel({ storage: sessionStorage, send: () => {} });
    const touch = () => tracker.touch();
    touch();
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) touch();
    });
  } catch {}
}
