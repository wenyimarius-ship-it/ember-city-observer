import { checkRecords } from './route-record.js';
import { dimensions } from './state.js';

export const backupSchema = 'ember-city-route-records';
export const backupVersion = 1;
export const maxBackupBytes = 2 * 1024 * 1024;

export function exportRecords(records) {
  return {schema:backupSchema, version:backupVersion, exportedAt:new Date().toISOString(), records:checkRecords(records)};
}

// Only the documented record fields cross the import boundary. Local records
// are never migrated or rewritten by this sanitizer.
function cleanRecord(raw) {
  const [r] = checkRecords([raw]);
  const s = r.space;
  return {
    id:r.id, completed:r.completed,
    space:{
      ...Object.fromEntries(['name','city','type','description','date'].map(k=>[k,s[k]])),
      nodes:s.nodes.map(n=>Object.fromEntries(['id','label','type','note','x','y'].map(k=>[k,n[k]]))),
      notes:Object.fromEntries(dimensions.map(([k])=>[k,s.notes[k]])),
      markers:s.markers.map(m=>Object.fromEntries(['id','kind','x','y','note'].map(k=>[k,m[k]])))
    }
  };
}

export function parseRecordBackup(text) {
  if (new TextEncoder().encode(text).byteLength > maxBackupBytes) throw Error('文件不能超过 2 MB。');
  let data;
  try { data = JSON.parse(text); } catch { throw Error('无法读取 JSON，请选择有效的路线备份文件。'); }
  if (!data || data.schema !== backupSchema || data.version !== backupVersion) throw Error('路线备份 schema 或版本不匹配。');
  if (!Array.isArray(data.records) || data.records.length > 500) throw Error('路线记录数量或格式不正确，最多 500 条。');
  // Validate every record, including duplicates that would otherwise be skipped.
  return data.records.map(cleanRecord);
}

export function mergeRecords(local, incoming) {
  checkRecords(local);
  const records = [...local], ids = new Set(local.map(r=>r.id));
  let skipped = 0;
  for (const raw of incoming) {
    const r = cleanRecord(raw);
    if (ids.has(r.id)) { skipped++; continue; }
    ids.add(r.id);
    records.push(r);
  }
  if (records.length > 500) throw Error('合并后超过 500 条路线，请先导出备份。');
  return {records, added:records.length-local.length, skipped};
}
