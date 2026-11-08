// Public project API key, not a personal API key. Live capture is restricted to the configured production origins.
export const analyticsConfig = Object.freeze({
  site:'city',
  apiHost:'https://us.i.posthog.com',
  projectToken:'phc_sPLnjV7VEbX7WewEGmPcGj4CHaHBTG3nSgizerFTZfoM',
  productionOrigins:[
    'https://city.mariustang.com',
    'https://ember-city-observer.vercel.app'
  ],
  liveEnabled:true
});
