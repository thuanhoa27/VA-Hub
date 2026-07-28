/**
 * verify-roundtrip.mjs
 * ----------------------------------------------------------------------------
 * Kiem chung khau noi nguy hiem nhat cua ca he thong:
 *
 *     data_line.js (DATA goc)
 *        -> generate-seed.mjs -> 0002_seed.sql
 *        -> Postgres
 *        -> loadReferenceData() trong src/lib/data.js
 *        -> DATA' ma engine thuc su doc
 *
 * Neu DATA' lech DATA du chi 1 con so, engine van chay binh thuong nhung ra ket
 * qua sai — khong co gi bao loi. Script nay so sanh tung field mot.
 *
 * Chay:
 *     pip install pglast
 *     python scripts/parse-seed.py
 *     node scripts/verify-roundtrip.mjs
 *
 * LUU Y: file nay TAI HIEN LAI logic cua loadReferenceData(). Sua data.js thi
 * phai sua ca day, neu khong bai test se kiem tra nham thu khac.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// chay duoc tu bat ky thu muc nao
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const DB_ROWS = path.join(process.cwd(), '.tmp', 'db_rows.json');

const src = fs.readFileSync('scripts/_source/data_line.js','utf8');
const ORIG = new Function('return (' + src.replace(/^\s*const\s+DATA\s*=/,'').replace(/;\s*$/,'') + ')')();
const db = JSON.parse(fs.readFileSync(DB_ROWS,'utf8'));

const num = v => (v===null||v===undefined) ? null : Number(v);
const by  = k => (a,b) => (a[k]??0)-(b[k]??0);

// --- tai hien DUNG logic loadReferenceData() trong src/lib/data.js ---
const k = db.market_kpi[0];
const block1 = { gmv12_ti:num(k.gmv12_ti), tiktok_share:num(k.tiktok_share), hoh:num(k.hoh),
                 yoy:num(k.yoy), item_h126_tr:num(k.item_h126_tr) };
const block6 = [...db.market_period].sort(by('sort_order'))
  .map(r=>({t:r.period,nmv_ti:num(r.nmv_ti),shp:num(r.shp),tts:num(r.tts),item_tr:num(r.item_tr)}));
const block2 = [...db.subcategory].sort(by('sort_order'))
  .map(r=>({sub:r.sub,gmv_ti:num(r.gmv_ti),grow:num(r.grow),bucket:r.bucket,pct:num(r.pct)}));
const block5 = [...db.subcategory_channel].sort(by('sort_order'))
  .map(r=>({sub:r.sub,shp:num(r.shp),tts:num(r.tts)}));
const block3 = [...db.price_band].sort(by('sort_order')).map(r=>({band:r.band,pct:num(r.pct)}));

const competitor = {};
db.competitor_bucket.forEach(b=>{competitor[b.bucket]={subtot_ti:num(b.subtot_ti),top:[]};});
[...db.competitor].sort((a,b)=>a.bucket.localeCompare(b.bucket)||a.sort_order-b.sort_order)
 .forEach(c=>competitor[c.bucket].top.push({brand:c.brand,gmv_ti:num(c.gmv_ti),price:num(c.price),
   aff:num(c.aff),seller:num(c.seller),mall:num(c.mall),item:num(c.item),creator:num(c.creator),
   ls:num(c.ls),video:num(c.video),gmv_ls:num(c.gmv_ls),share:num(c.share)}));

const rule={tier:[],band:[],factors:[]};
[...db.scoring_rule].sort((a,b)=>a.kind.localeCompare(b.kind)||a.sort_order-b.sort_order).forEach(r=>{
  if(r.kind==='tier')   rule.tier.push([num(r.threshold),r.label]);
  if(r.kind==='band')   rule.band.push([num(r.threshold),r.label]);
  if(r.kind==='factor') rule.factors.push([r.factor_key,num(r.weight)]);
});

const lists={};
[...db.validation_list].sort((a,b)=>a.list_name.localeCompare(b.list_name)||a.sort_order-b.sort_order)
  .forEach(r=>{(lists[r.list_name] ||= []).push(r.value);});

const history=[...db.brand_history].sort(by('sort_order')).map(r=>{const{sort_order,...rest}=r;return rest;});

const NEW={block1,block6,block2,block5,block3,total12:block1.gmv12_ti,competitor,rule,lists,history};

// --- so sanh ---
let fails=0;
const eq=(a,b)=>{
  if(a===b) return true;
  if(typeof a==='number'&&typeof b==='number') return Math.abs(a-b)<1e-9;
  if((a===null||a===''||a===undefined)&&(b===null||b===''||b===undefined)) return true;
  return false;
};
function cmp(path,a,b){
  if(Array.isArray(a)||Array.isArray(b)){
    if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length){
      console.log(`  LECH ${path}: length ${a?.length} vs ${b?.length}`); fails++; return; }
    a.forEach((_,i)=>cmp(`${path}[${i}]`,a[i],b[i])); return;
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    new Set([...Object.keys(a),...Object.keys(b)]).forEach(k2=>cmp(`${path}.${k2}`,a[k2],b[k2])); return;
  }
  if(!eq(a,b)){ console.log(`  LECH ${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); fails++; }
}
for(const key of Object.keys(ORIG)){ cmp(key, ORIG[key], NEW[key]); }
const extra=Object.keys(NEW).filter(k2=>!(k2 in ORIG));
if(extra.length){ console.log('  Key thua trong ban dung lai:',extra); fails++; }

console.log(fails===0
  ? `KHOP 100% — ${Object.keys(ORIG).length} key, ${ORIG.history.length} brand, ${ORIG.block3.length} price band, tat ca so lieu trung khop`
  : `*** ${fails} diem lech ***`);
process.exit(fails===0?0:1);
