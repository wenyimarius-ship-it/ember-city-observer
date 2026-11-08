import {createFunnel} from './funnel.js';
import {analyticsConfig} from './analytics-config.js';
import {createPostHogSender} from './posthog-transport.js';
const params = new URLSearchParams(window.location.search);
let storage;
try { storage = window.sessionStorage; } catch { /* Storage disabled: in-memory fallback. */ }
const traffic = params.get('analytics_test') === '1' ? 'test' : 'live';
const liveAllowed = analyticsConfig.liveEnabled && analyticsConfig.productionOrigins.includes(window.location.origin);
// Freeze mode for this tab session, so a reload without test parameters cannot become live.
let sessionTraffic = traffic;
try {
  const saved = storage?.getItem('city.funnel.traffic.v1');
  if (saved === 'test' || (saved === 'live' && liveAllowed)) sessionTraffic = saved;
  // Merely opening a disabled, untagged Preview must not block a later test link.
  else if (traffic === 'test' || liveAllowed) storage?.setItem('city.funnel.traffic.v1',traffic);
} catch { /* Keep in-memory mode. */ }
const enabled = analyticsConfig.projectToken && (sessionTraffic === 'test' || liveAllowed);
const record = enabled ? createFunnel({storage,search:window.location.search,emit:createPostHogSender({
  ...analyticsConfig, traffic:sessionTraffic
})}) : () => false;
export function trackFunnel(node) { return record(`city_${node}`); }
