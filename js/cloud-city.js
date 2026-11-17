import { mountCloudVault } from './cloud-vault.js';
import { validate } from './state.js';
import { checkRecords } from './route-record.js';
import { analyticsConfig } from './analytics-config.js';
const allowed=k=>/^(ember-city-(observation|small-cards|route-records)-v1|ember-city-card-session:[a-f0-9-]{36})$/.test(k);
function check(k,v){
 if(!allowed(k)||typeof v!=='string')throw Error('invalid_payload');
 const value=JSON.parse(v);
 if(k==='ember-city-route-records-v1')checkRecords(value);
 else if(k==='ember-city-small-cards-v1'){if(!Array.isArray(value)||value.length>500)throw Error('invalid_payload')}
 else validate(value);
}
mountCloudVault({site:'city',getState:()=>{const storage=Object.fromEntries(Object.keys(localStorage).filter(allowed).map(k=>[k,localStorage.getItem(k)]));for(const [k,v]of Object.entries(storage))check(k,v);return {schema:1,storage}},restore:payload=>{
 if(payload?.schema!==1||!payload.storage||Array.isArray(payload.storage)||Object.keys(payload.storage).length>200)throw Error('invalid_payload');
 const entries=Object.entries(payload.storage);for(const [k,v]of entries)check(k,v);
 const before=Object.fromEntries(Object.keys(localStorage).filter(allowed).map(k=>[k,localStorage.getItem(k)]));
 try{localStorage.setItem('ember-cloud-before-restore-city-v1',JSON.stringify(before));for(const k of Object.keys(localStorage).filter(allowed))localStorage.removeItem(k);for(const [k,v]of entries)localStorage.setItem(k,v)}catch(error){for(const k of Object.keys(localStorage).filter(allowed))localStorage.removeItem(k);for(const [k,v]of Object.entries(before))localStorage.setItem(k,v);throw error}
 setTimeout(()=>location.reload(),350);
},analytics:{enabled:analyticsConfig.liveEnabled&&analyticsConfig.productionOrigins.includes(location.origin),token:analyticsConfig.projectToken,apiHost:analyticsConfig.apiHost}});
