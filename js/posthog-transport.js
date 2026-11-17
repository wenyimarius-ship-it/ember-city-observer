// Explicit capture only: no SDK, autocapture, pageviews, replay, identity or browser metadata.
const events = {city_open:'city_open',city_start:'city_start',city_complete:'city_complete',city_feedback:'city_feedback'};
export function createPostHogSender({apiHost,projectToken,site,traffic,send=fetch}) {
  if (site !== 'city' || !['test','live'].includes(traffic)) throw new TypeError('Invalid funnel configuration');
  const endpoint = new URL('/capture/',apiHost);
  if (endpoint.origin !== 'https://us.i.posthog.com') throw new TypeError('Unexpected PostHog host');
  if (!/^phc_[A-Za-z0-9]+$/.test(projectToken)) throw new TypeError('Missing public PostHog project key');
  return async (name,{source,rating}) => {
    if (!Object.hasOwn(events,name)) return;
    if (name === 'city_feedback' && !['accurate','partial','off'].includes(rating)) return;
    const details = name === 'city_feedback' ? {rating} : {source};
    const response = await send(endpoint.href,{
      method:'POST',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({api_key:projectToken,event:events[name],properties:{
        // One fixed non-person key fulfils the capture protocol without identifying visitors.
        // Dashboard must use Total event count, never Unique users / identity-based funnels.
        distinct_id:'ember-funnel-aggregate',site,...details,traffic,
        $process_person_profile:false,$geoip_disable:true
      }})
    });
    if (!response.ok) throw new Error(`PostHog capture rejected (${response.status})`);
  };
}
