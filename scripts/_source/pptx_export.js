/* ============================================================================
 * BRAND PROPOSAL EXPORT (.pptx) — OPslide house style
 * ----------------------------------------------------------------------------
 * Deck nay GUI CHO BRAND. Step 3 cua dashboard la man hinh QUALIFY NOI BO,
 * nen KHONG duoc export nguyen ven. Kien truc 3 lop, fail-closed:
 *
 *   Lop 1 — WHITELIST : buildPayload() chi doc dung nhung field brand-safe.
 *                       Khong co vong lap "quet het roi loai" -> khong the
 *                       lo field moi khi ai do them vao dashboard sau nay.
 *   Lop 2 — SCRUB     : scrub() rewrite cum tu noi bo, roi DROP ca cau con
 *                       chua token noi bo. Neu sau scrub van ban -> tra ''
 *                       (bo han field) thay vi ship ban lo.
 *   Lop 3 — ASSERT    : assertClean() chay tren TOAN BO payload truoc khi ve
 *                       slide. Con token noi bo -> throw, khong xuat file.
 *
 * KHONG BAO GIO dua vao deck: Tier · Commercial Score · band HIGH/MED/LOW ·
 * Hunt Priority (P1/P2/P3) · commercial model de xuat · data-quality warnings ·
 * Internal Brand Brief · re-pitch delta · Lead Source · Blocker · Pending Party.
 *
 * Chart: raster hoa SVG cua dashboard (SVG -> canvas -> PNG). Xem svgToPng().
 * ==========================================================================*/

/* ---- OPslide palette (skill opslide). Khong hardcode hex o cho khac. ---- */
const OP = {
 RED:'EA0600', RED_D:'C90007', CORAL:'FF5757',
 BLUE:'0042D6', BLUE_LT:'3E8DFF', NAVY:'00157F',
 GRAY:'6B7280', CARD:'F5F7FA', TINT_R:'FDECEC', TINT_B:'EAF1FF', WHITE:'FFFFFF',
 FONT:'Aptos'
};
const SLIDE_W = 10, SLIDE_H = 5.625;   // 16:9, khop template OnPoint

/* ============================ LOP 2: SCRUB =============================== */

/* !! CANH BAO KHI SUA CAC REGEX BEN DUOI !!
 * KHONG dung \b quanh chu TIENG VIET co dau. Trong JS, \w = [A-Za-z0-9_] nen
 * 'á', 'đ', 'ạ'... KHONG phai word char => \b khong bao gio khop o ranh gioi do.
 *   /định giá\b/  -> KHONG BAO GIO khop (ket thuc bang 'á')
 *   /\bđề xuất/   -> KHONG BAO GIO khop (bat dau bang 'đ')
 * Loi nay tung lot chuoi "trước khi định giá" ra deck gui brand.
 * Voi tieng Viet: dung khong anchor, hoac (^|[\s(]) ... ($|[\s.,;)]).
 * Chi dung \b cho tu THUAN ASCII (quote, blocker, nurture...).
 */

/* Rewrite AN TOAN — chay TRUOC pha drop. Muc dich: giu lai noi dung co gia tri
   (VD canh bao compliance) ma chi bo tu ngu noi bo, thay vi drop ca cau. */
const SUBS = [
 [/tr(ướ|uo)c khi quote/gi,     'trước khi triển khai'],
 [/tr(ướ|uo)c khi định giá/gi,  'trước khi triển khai'],
 [/tr(ướ|uo)c khi báo giá/gi,   'trước khi triển khai'],
 [/khi quote/gi,                'khi triển khai'],
 [/tr(ướ|uo)c quote/gi,         'trước khi triển khai']
];

/* Token NOI BO — cau nao con chua 1 trong cac pattern nay se bi DROP.
   Them pattern vao day khi dashboard co field noi bo moi. */
const LEAK = [
 /\btier\s*[0-3]\b/i, /\bTIER\b/, /\belephant\b/i,
 /commercial\s*score/i, /\d{1,3}\s*\/\s*100\b/, /\bband\s+(HIGH|MED|LOW)\b/i,
 /hunt\s*priorit/i, /\bP[123]\s*[—–-]/, /\bwatchlist\b/i, /\bnurture\b/i, /\bqualify\b/i,
 /rate\s*card/i, /\bquote\b/i,
 /internal\s+brand\s+brief/i,
 /\bconsignment\b/i, /mua\s*đứt/i, /g(á|a)nh\s*tồn\s*kho/i,
 /c(ả|a)nh\s*b(á|a)o/i, /data\s*quality/i, /panel\s*AI/i,
 /\bblocker\b/i, /pending\s*party/i, /lead\s*source/i,
 /đề\s*xu(ấ|a)t theo brief/i,
 /định\s*giá/i, /báo\s*giá/i,          // buoc thuong mai noi bo
 /* Che trach chat luong brief cua brand — dung mo dau proposal bang viec
    che brand dien brief thieu. Cac cum nay den tu warning noi bo. */
 /brief[^.;]{0,40}(không|khong)\s*ghi/i,
 /(không|khong)\s*ghi\s*r(õ|o)/i,
 /brief[^.;]{0,40}(thiếu|thieu)/i,
 /(thiếu|thieu)[^.;]{0,30}brief/i,
 /brief[^.;]{0,40}(chưa|chua)\s*c(ó|o)/i,
 /SKU\s*list\s*tr(ố|o)ng/i,
 /unit[_\s]?inferred/i, /đơn vị[^.;]{0,30}suy/i
];

const hasLeak = t => LEAK.some(re => re.test(String(t == null ? '' : t)));

/* Bo tag HTML (cac field verdict co <b>...</b>) */
const stripTags = t => String(t == null ? '' : t)
 .replace(/<[^>]*>/g, '')
 .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
 .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
 .replace(/\s+/g, ' ').trim();

/* scrub: rewrite -> tach cau -> drop cau ban -> ghep lai.
   FAIL-CLOSED: neu ket qua VAN con token noi bo thi tra '' (bo han field). */
function scrub(txt){
 let t = stripTags(txt);
 if(!t) return '';
 SUBS.forEach(([re, rep]) => { t = t.replace(re, rep); });
 // tach theo '. ' / '; ' / ' · ' — giu nguyen '(1)' '(2)' numbering ben trong cau
 const parts = t.split(/(?<=[.;])\s+|\s+·\s+/).map(s => s.trim()).filter(Boolean);
 const kept = parts.filter(p => !hasLeak(p));
 let out = kept.join(' ').replace(/\s+/g, ' ').trim();
 if(out && !/[.!?]$/.test(out)) out += '.';
 return hasLeak(out) ? '' : out;   // fail-closed
}

/* ============================ LOP 3: ASSERT ============================== */

/* Di het payload, gom moi string, kiem tra token noi bo.
   Tra ve mang cac vi phat (rong = sach). */
function auditPayload(payload){
 const bad = [];
 (function walk(node, path){
  if(node == null) return;
  if(typeof node === 'string'){ if(hasLeak(node)) bad.push(path + ' :: ' + node.slice(0, 120)); return; }
  if(Array.isArray(node)){ node.forEach((v, i) => walk(v, path + '[' + i + ']')); return; }
  if(typeof node === 'object'){ Object.keys(node).forEach(k => walk(node[k], path + '.' + k)); }
 })(payload, 'payload');
 return bad;
}

/* =========================== 100% TIENG ANH ==============================
 * Deck gui brand phai TOAN BO tieng Anh, ke ca tieu de va noi dung.
 * Dashboard van giu tieng Viet cho phan dien giai (nguoi dung la VA Việt Nam)
 * — chi RIENG file .pptx la EN.
 *
 * Co 3 nguon tieng Viet phai xu ly, moi nguon mot cach khac nhau:
 *
 *  1. Ten sub-category trong DATA.block2 ("Chăm sóc sức khỏe"...)
 *     -> SUBCAT_EN. Cac ten nay nam TRONG PIXEL sau khi raster hoa chart, nen
 *        khong the dich sau. Phai sinh SVG ban EN rieng (xem renderENCharts).
 *
 *  2. Van ban verdict (head / risk) — tieng Viet do nguoi viet tay hoac engine
 *     sinh ra. KHONG dich duoc luc runtime (app chay offline, khong co LLM).
 *     -> KHONG dung V.head/V.risk nua. Sinh MOI bang tieng Anh tu so lieu
 *        (headroomEN). Loi phu: bo han duoc mot lop rui ro ro ri, vi khong con
 *        cham vao van ban noi bo tieng Viet.
 *     -> Rieng 2 brand demo trong PREBAKE co the ghi de bang headEN/riskEN.
 *
 *  3. Ten brand doi thu ("tiến sĩ an") — DANH TU RIENG, giu nguyen, chi title-case.
 *
 * KHONG can dich: SEG va bandShort() da trung tinh ngon ngu ('<200k', '200k–500k').
 * ======================================================================== */

/* Sua thuat ngu o DUY NHAT bang nay. Neu S&P co bo tu vung chuan khac thi
   doi o day, khong sua rai rac trong code. */
const SUBCAT_EN = {
 'Chăm sóc sức khỏe'            : 'Healthcare',
 'Thực phẩm chức năng'          : 'Dietary Supplements',
 'Vật tư y tế'                  : 'Medical Supplies',
 'Sản phẩm hỗ trợ tình dục'     : 'Sexual Wellness',
 'Dinh dưỡng thể thao  protein' : 'Sports Nutrition',
 'Dinh dưỡng thể thao protein'  : 'Sports Nutrition',
 'Sức khỏe khác'                : 'Other Health',
 'Thiết bị massage'             : 'Massage Devices'
};
/* Khong co trong map -> tra lai nguyen ban + canh bao Console de con bo sung.
   Tha de lot 1 nhan tieng Viet con hon lam vo chart. */
function subEN(v){
 const k = String(v == null ? '' : v).trim();
 if(SUBCAT_EN[k]) return SUBCAT_EN[k];
 if(/[à-ỹÀ-Ỹăâđêôơư]/i.test(k)) console.warn('[pptx] thieu ban dich EN cho sub-cat:', k);
 return k;
}

/* Ten brand trong Kalodata luu chu thuong ('drcung', 'dsd arma'). Trong deck
   gui brand thi de nguyen trong rat cau tha -> viet hoa dau tu.
   LUU Y: khong sua duoc viet tat sai chinh ta (VD 'dsd arma'); VA nen doi chieu
   lai ten dung truoc khi gui. */
function titleCase(s){
 return String(s == null ? '' : s).replace(/\S+/g, w =>
   w.length <= 3 && w === w.toUpperCase() ? w
   : w.charAt(0).toLocaleUpperCase('vi') + w.slice(1));
}

/* ---- Growth headroom + compliance, sinh bang TIENG ANH tu so lieu ----
 * KHONG dich van ban verdict tieng Viet (khong dich duoc offline). Thay vao do
 * dung dung nhung con so da hien tren cac slide truoc de viet lai bang EN.
 * Moi cau deu la SU KIEN doc duoc tu chart, khong phai nhan dinh noi bo.
 */
function headroomEN(sub, comp, B, brandName){
 const head = [], risk = [];

 /* --- headroom --- */
 if(B && B.tiktok_share != null){
  head.push('TikTok Shop now carries ' + (B.tiktok_share*100).toFixed(1) +
   '% of category GMV and the category is growing ' + fmtPctPlain(B.yoy) +
   ' year on year. This is the fastest route to incremental volume.');
 }
 if(comp){
  let sg = 0, af = 0, sl = 0, ml = 0;
  comp.top.forEach(t => { sg += t.gmv_ti; af += t.gmv_ti*t.aff; sl += t.gmv_ti*t.seller; ml += t.gmv_ti*t.mall; });
  const affPct = af/sg*100, selPct = sl/sg*100, malPct = ml/sg*100;
  head.push('Leading brands in ' + sub + ' generate ' + affPct.toFixed(0) +
   '% of GMV through affiliate creators. A structured creator and livestream programme is the single largest lever in this sub-category.');
  if(selPct < 30){
   head.push('Self-operated brand stores account for only ' + selPct.toFixed(0) +
    '% of top-brand GMV, and Mall / showcase for ' + malPct.toFixed(0) +
    '%. Both are under-used channels that give better margin and first-party data control.');
  }
 }
 const aov = aovVND();
 if(aov != null && DATA.block3 && DATA.block3.length){
  const hit = DATA.block3.find(x => { const [a, z] = bandRange(x.band); return aov >= a && aov < z; });
  if(hit) head.push('An average order value of ' + nfvi(Math.round(aov)) + ' ' + U.vnd +
   ' places ' + brandName + ' in the ' + bandShort(hit.band) + ' band, which represents ' +
   (hit.pct*100).toFixed(1) + '% of category GMV.');
 }

 /* --- compliance / channel (Health Vietnam) --- */
 risk.push('Product declaration filings are a hard gate: functional foods and health supplements must be fully declared before any SKU can be listed.');
 risk.push('Channel eligibility differs by platform. Pharmaceutical and regulated SKUs are largely restricted on TikTok Shop, so the assortment has to be split by channel rather than listed uniformly.');
 if(comp) risk.push('Affiliate-led sub-categories move on creator supply. Securing creator capacity ahead of peak campaign periods is the main operational constraint.');

 return {head: head.join(' '), risk: risk.join(' ')};
}

/* ========================== LOP 1: WHITELIST ============================= */
/*
 * buildProposalPayload() la HAM THUAN — khong doc DOM, khong dung canvas.
 * Nho vay test_pptx.js chay duoc headless trong node de kiem tra ro ri.
 * Moi slide co { key, title, color, need } — 'need' la dieu kien co data;
 * slide khong co data thi KHONG duoc tao (user chon: khong placeholder).
 */
function buildProposalPayload(){
 const b = S.brand, sub = S.sub, comp = DATA.competitor[sub], B = DATA.block1;
 /* CO Y KHONG doc S.verdict: object do chua tier/score/prio/model + van ban
    tieng Viet. Deck lay noi dung tu headroomEN() sinh bang tieng Anh. */
 const brandName = (b && b.name) ? b.name : (S.group || S.typed || 'Brand');
 const slides = [];

 /* ---- S1 · Cover (luon co) ---- */
 slides.push({
  key:'cover', kind:'cover',
  brand: brandName,
  title: 'E-commerce Growth Opportunity',
  sub: sub + (S.cat2 ? ' + ' + S.cat2 : '') + ' · Vietnam',
  date: new Date().toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'})
 });

 /* ---- S2 · Category health — KPI cards ---- */
 if(B){
  slides.push({
   key:'category', kind:'kpi', color: OP.NAVY,
   title: 'Category health — ' + sub,
   caption: 'Shopee + TikTok Shop, Vietnam · trailing 12 months · source: Metrics, Kalodata',
   /* Dong ket luan — chi dien giai lai CHINH 4 con so o tren, khong them
      nhan dinh noi bo nao. An toan tuyet doi ve ro ri. */
   note: 'The ' + sub + ' category in Vietnam is growing ' + fmtPctPlain(B.yoy) +
         ' year on year, with TikTok Shop accounting for ' + (B.tiktok_share*100).toFixed(1) +
         '% of GMV — the channel that will set the pace of category growth over the next 12 months.',
   cards: [
    {label:'Category GMV 12M', value: nfvi(B.gmv12_ti) + ' ' + U.bn, sub1:'VND', sub2:'Shopee + TikTok', accent: OP.RED},
    {label:'Growth YoY',       value: fmtPctPlain(B.yoy),             sub1:'H1.2026 vs H1.2025', sub2:'', accent: B.yoy >= 0 ? OP.BLUE : OP.RED_D},
    {label:'TikTok Shop share',value: (B.tiktok_share*100).toFixed(1) + '%', sub1:'of category GMV', sub2:'H1.2026', accent: OP.NAVY},
    {label:'Items sold',       value: B.item_h126_tr + U.M,           sub1:'units', sub2:'H1.2026', accent: OP.BLUE_LT}
   ]
  });
 }

 /* ---- S3 · Channel split (can block6 du 3 ky) ---- */
 const h1 = DATA.block6 && DATA.block6.find(x => x.t === 'H1.2025');
 const h2 = DATA.block6 && DATA.block6.find(x => x.t === 'H2.2025');
 const cc = DATA.block6 && DATA.block6.find(x => x.t === 'H1.2026');
 if(h1 && h2 && cc){
  const fyS = h1.shp + h2.shp, fyT = h1.tts + h2.tts, fyTot = fyS + fyT;
  const cTot = cc.shp + cc.tts;
  slides.push({
   key:'channel', kind:'twoChart', color: OP.BLUE,
   title: 'Where the category sells — platform mix',
   caption: 'NMV by platform, ' + U.bn + ' VND · Lazada not in current dataset · source: Metrics',
   charts: [{tag:'donut-fy2025', label:'FY 2025'}, {tag:'donut-h12026', label:'H1 2026'}],
   table: {
    head: ['Platform', 'FY 2025 (' + U.bn + ')', '% mix', 'H1 2026 (' + U.bn + ')', '% mix'],
    rows: [
     ['Shopee',      nfvi(fyS), (fyS/fyTot*100).toFixed(0)+'%', nfvi(cc.shp), (cc.shp/cTot*100).toFixed(0)+'%'],
     ['TikTok Shop', nfvi(fyT), (fyT/fyTot*100).toFixed(0)+'%', nfvi(cc.tts), (cc.tts/cTot*100).toFixed(0)+'%'],
     ['Total',       nfvi(fyTot), '100%',                        nfvi(cTot),   '100%']
    ]
   }
  });
 }

 /* ---- S4 · Sizing sub-category ---- */
 if(DATA.block2 && DATA.block2.length){
  slides.push({
   key:'sizing', kind:'oneChart', color: OP.NAVY,
   title: 'Sub-category sizing and growth',
   caption: 'GMV by sub-category, ' + U.bn + ' VND · prior period derived from HoH growth · ★ = ' + brandName + "'s sub-category · source: Metrics",
   chart: {tag:'sizing'}
  });
 }

 /* ---- S5 · Price positioning ---- */
 if(DATA.block3 && DATA.block3.length){
  const aov = aovVND();
  const seg = SEG.map(([lb, a, z]) => {
   const p = DATA.block3.filter(x => { const [s0, e0] = bandRange(x.band); return s0 >= a && e0 <= z; })
                        .reduce((t, x) => t + x.pct, 0);
   return [lb, (p*100).toFixed(1) + '%', (aov != null && aov >= a && aov < z) ? '★' : ''];
  });
  /* Cot ★ chi co nghia khi biet AOV cua brand. Khong biet -> bo cot,
     de lai 1 cot rong toan o trong deck gui brand la thua. */
  const hasStar = seg.some(r => r[2] === '★');
  slides.push({
   key:'price', kind:'chartTable', color: OP.BLUE,
   title: 'Price architecture of the category',
   caption: '% of category GMV by price band, H1.2026' + (aov != null ? ' · ★ = ' + brandName + "'s current AOV (" + nfvi(Math.round(aov)) + ' ' + U.vnd + ')' : '') + ' · source: Metrics',
   chart: {tag:'price'},
   table: {head: hasStar ? ['Price segment', '% GMV', ''] : ['Price segment', '% GMV'],
           rows: hasStar ? seg : seg.map(r => r.slice(0, 2))}
  });
 }

 /* ---- S6 · Competitive landscape (can comp) ---- */
 if(comp){
  const t3 = comp.top.slice(0, 3);
  const g = myGmvTi(), myAov = aovVND();
  const s = S.parsed ? S.parsed.schema : null;
  const dash = '—';
  const r = (label, mine, vals, unit) => [label, mine].concat(vals.map(v => v == null ? dash : nfvi(v) + (unit ? ' ' + unit : '')));
  const rows = [
   r('GMV 365D', g.v != null ? nfvi(g.v) + ' ' + U.bn : dash, t3.map(t => t.gmv_ti), U.bn),
   r('AOV', myAov != null ? nfvi(Math.round(myAov)) + ' ' + U.vnd : dash, t3.map(t => t.price), U.vnd),
   r('SKUs listed', s && s.sku_count ? nfvi(s.sku_count) : dash, t3.map(t => t.item), 'item'),
   ['Revenue mix', dash].concat(t3.map(t =>
     'Brand ' + (t.seller*100).toFixed(0) + '% / Aff ' + (t.aff*100).toFixed(0) + '% / Mall ' + (t.mall*100).toFixed(0) + '%')),
   r('Influencers / month', dash, t3.map(t => Math.round(t.creator/12))),
   r('Videos / month', dash, t3.map(t => Math.round(t.video/12))),
   r('Livestreams / month', dash, t3.map(t => Math.round(t.ls/12))),
   r('GMV per livestream', dash, t3.map(t => t.gmv_ls), U.M),
   r('Sub-category share', dash, t3.map(t => +(t.share*100).toFixed(1)), '%')
  ];
  /* Cot cua brand toan '—' thi BO HAN cot (user: khong placeholder). Mot cot
     trong deck gui brand chi toan dau gach la vua thua vua kem chuyen nghiep. */
  const mineFilled = rows.filter(rw => rw[1] !== dash).length;
  const keepMine = mineFilled >= 2;
  slides.push({
   key:'competitor', kind:'table', color: OP.NAVY,
   title: keepMine ? (brandName + ' vs top-3 in ' + sub) : ('Top-3 competitors in ' + sub),
   caption: 'TikTok Shop, trailing 365 days · per-month figures derived from 365d total ÷ 12 · source: Kalodata',
   table: {
    head: ['Metric'].concat(keepMine ? [brandName] : []).concat(t3.map(t => titleCase(t.brand))),
    rows: rows.map(rw => keepMine ? rw : [rw[0]].concat(rw.slice(2)))
   }
  });

  /* ---- S7 · How the sub-category sells ---- */
  let sg = 0, af = 0, ml = 0, sl = 0;
  comp.top.forEach(t => { sg += t.gmv_ti; af += t.gmv_ti*t.aff; ml += t.gmv_ti*t.mall; sl += t.gmv_ti*t.seller; });
  slides.push({
   key:'strategy', kind:'twoChart', color: OP.BLUE,
   title: 'How this sub-category sells',
   caption: 'Revenue contribution by sales channel, top-6 brands in ' + sub + ' (total GMV ' + nfvi(Math.round(sg)) + ' ' + U.bn + ') · source: Kalodata',
   charts: [{tag:'donut-channel', label:'Channel mix'}, {tag:'stack100', label:'Share of GMV'}],
   legend: [
    {name:'Brand (self-operated)', color: C.chBrand.replace('#',''), pct:(sl/sg*100).toFixed(1) + '%'},
    {name:'Affiliate',             color: C.chAff.replace('#',''),   pct:(af/sg*100).toFixed(1) + '%'},
    {name:'Showcase / Mall',       color: C.chMall.replace('#',''),  pct:(ml/sg*100).toFixed(1) + '%'}
   ]
  });
 }

 /* ---- S8 · Headroom + compliance ----
    Sinh bang EN tu so lieu. PREBAKE co the ghi de bang headEN/riskEN (tieng Anh).
    KHONG dung V.head/V.risk — do la van ban tieng Viet noi bo. */
 const pk8 = findPrebake();
 const gen = headroomEN(sub, comp, B, brandName);
 const head = scrub((pk8 && pk8.headEN) || gen.head);
 const risk = scrub((pk8 && pk8.riskEN) || gen.risk);
 if(head || risk){
  slides.push({
   key:'headroom', kind:'twoCol', color: OP.RED,
   title: 'Growth headroom for ' + brandName,
   caption: 'OnPoint assessment based on the category data above',
   left:  {title:'Where we see headroom', body: head, tint: OP.TINT_B, ink: OP.BLUE},
   right: {title:'Compliance & channel considerations', body: risk, tint: OP.TINT_R, ink: OP.RED_D}
  });
 }

 return {brand: brandName, sub: sub, slides: slides};
}

/* ======================= RASTER HOA SVG -> PNG =========================== */
/*
 * Vi sao phai clone + set font: SVG khi serialize ra roi load lai qua <img>
 * la mot DOCUMENT DOC LAP — no KHONG thua huong CSS cua trang, nen text se
 * roi ve font serif mac dinh. Phai bom font-family vao trong SVG.
 *
 * Vi sao dung data: URL (khong dung blob:): tranh tainted canvas va tranh
 * rac roi CORS khi mo file bang file:// (dashboard chay offline).
 */
function svgToPng(svgEl, scale){
 scale = scale || 3;   // 3x cho net khi trinh chieu / in
 return new Promise((resolve, reject) => {
  if(!svgEl) return reject(new Error('svgToPng: khong tim thay SVG'));
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('font-family', "Aptos,'Segoe UI',Arial,sans-serif");

  const vb = (clone.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const w = (vb.length === 4 && vb[2]) ? vb[2] : (+clone.getAttribute('width')  || 600);
  const h = (vb.length === 4 && vb[3]) ? vb[3] : (+clone.getAttribute('height') || 400);
  clone.setAttribute('width', w);
  clone.setAttribute('height', h);
  clone.removeAttribute('style');   // bo width:100% cua CSS trang

  const src = 'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(new XMLSerializer().serializeToString(clone));
  const img = new Image();
  img.onload = () => {
   const cv = document.createElement('canvas');
   cv.width = Math.round(w*scale); cv.height = Math.round(h*scale);
   const ctx = cv.getContext('2d');
   ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, cv.width, cv.height);   // pptx khong ho tro alpha tot
   ctx.drawImage(img, 0, 0, cv.width, cv.height);
   resolve({data: cv.toDataURL('image/png'), w: w, h: h});
  };
  img.onerror = () => reject(new Error('svgToPng: browser tu choi render SVG'));
  img.src = src;
 });
}

/* Chart co nhan tieng Viet phai duoc VE LAI bang tieng Anh roi moi raster hoa —
   nhan da nam trong pixel thi khong sua duoc nua.
   Hien chi 'sizing' can (nhan sub-category). Donut/price/stack100 von da EN
   hoac chi co so, dung thang ban tren trang.
   SVG duoc dat vao mot container offscreen: phai NAM TRONG DOM that thi
   getAttribute/serialize moi chac chan dung, nhung khong duoc lam nhay layout. */
function renderENCharts(){
 const host = document.createElement('div');
 host.setAttribute('aria-hidden', 'true');
 host.style.cssText = 'position:absolute;left:-99999px;top:0;width:1000px;visibility:hidden';
 host.innerHTML = sizingSVG(S.sub, subEN, 'sizing-en');
 document.body.appendChild(host);
 return host;
}

/* Raster hoa tat ca chart co data-chart, tra ve map {tag: {data,w,h}}.
   Chart nao loi thi bo qua (slide se ve khong co anh) — khong lam hong ca file. */
async function rasterizeCharts(tags){
 const out = {};
 const host = renderENCharts();
 try{
  for(const tag of tags){
   // uu tien ban EN neu co, roi moi den ban tren trang
   const el = host.querySelector('[data-chart="' + tag + '-en"]')
           || document.querySelector('#p3 [data-chart="' + tag + '"]');
   if(!el){ console.warn('[pptx] thieu chart:', tag); continue; }
   try { out[tag] = await svgToPng(el); }
   catch(e){ console.warn('[pptx] raster loi', tag, e.message); }
  }
 } finally {
  host.remove();   // luon don dep, ke ca khi loi
 }
 return out;
}

/* ============================ VE SLIDE =================================== */

function opHeaderBar(slide, pptx, title, color, caption){
 slide.addShape(pptx.ShapeType.rect, {x:0, y:0, w:SLIDE_W, h:0.72,
   fill:{color: color}, line:{type:'none'}});
 slide.addText(title, {x:0.5, y:0, w:SLIDE_W-1, h:0.72, valign:'middle',
   fontSize:19, bold:true, color: OP.WHITE, fontFace: OP.FONT});
 if(caption) slide.addText(caption, {x:0.5, y:0.78, w:SLIDE_W-1, h:0.26,
   fontSize:8.5, italic:true, color: OP.GRAY, fontFace: OP.FONT});
}

function opFooter(slide, pptx, n){
 slide.addText('OnPoint · confidential', {x:0.5, y:SLIDE_H-0.34, w:5, h:0.24,
   fontSize:8, color: OP.GRAY, fontFace: OP.FONT});
 slide.addText(String(n), {x:SLIDE_W-1, y:SLIDE_H-0.34, w:0.5, h:0.24,
   fontSize:8, color: OP.GRAY, fontFace: OP.FONT, align:'right'});
}

function opTable(slide, pptx, t, x, y, w, fontSize, colW){
 const head = t.head.map(h => ({text:String(h), options:{bold:true, color: OP.WHITE, fill:{color: OP.NAVY}}}));
 const rows = t.rows.map((r, i) => r.map((cRaw, j) => {
  const c = String(cRaw == null ? '' : cRaw);
  const isTot = /^total$/i.test(String(r[0]));
  return {text:c, options:{
   bold: j === 0 || isTot,
   color: isTot ? OP.NAVY : (j === 0 ? OP.NAVY : '333333'),
   fill: {color: isTot ? OP.CARD : (i % 2 ? OP.CARD : OP.WHITE)},
   align: j === 0 ? 'left' : 'center'
  }};
 }));
 slide.addTable([head].concat(rows), {
  x: x, y: y, w: w, colW: colW,
  fontFace: OP.FONT, fontSize: fontSize || 9,
  border:{type:'solid', pt:0.5, color:'D9DEE5'},
  valign:'middle', autoPage:false
 });
}

/* ========================= VE TOAN BO DECK ==============================
 * Tach rieng khoi exportBrandProposal() de test_pptx.js goi duoc headless
 * (truyen anh stub) — test chay DUNG code ve slide, khong phai ban chep lai.
 * ======================================================================== */
function renderDeck(pptx, payload, imgs){
  imgs = imgs || {};
  pptx.defineLayout({name:'OP', width: SLIDE_W, height: SLIDE_H});
  pptx.layout = 'OP';
  pptx.author = 'OnPoint'; pptx.company = 'OnPoint Ecommerce';
  pptx.title = payload.brand + ' — E-commerce Growth Opportunity';

  let pageNo = 0;
  payload.slides.forEach(sp => {
   const s = pptx.addSlide();
   s.background = {color: OP.WHITE};

   /* ---------- COVER ---------- */
   if(sp.kind === 'cover'){
    s.addShape(pptx.ShapeType.rect, {x:0, y:0, w:SLIDE_W, h:0.16, fill:{color: OP.RED}, line:{type:'none'}});
    s.addText('OnPoint', {x:0.7, y:1.25, w:8.6, h:0.4, fontSize:15, bold:true, color: OP.GRAY, fontFace: OP.FONT, charSpacing:1});
    s.addText(sp.brand, {x:0.7, y:1.75, w:8.6, h:0.9, fontSize:40, bold:true, color: OP.NAVY, fontFace: OP.FONT});
    s.addShape(pptx.ShapeType.rect, {x:0.7, y:2.72, w:1.5, h:0.05, fill:{color: OP.RED}, line:{type:'none'}});
    s.addText(sp.title, {x:0.7, y:2.95, w:8.6, h:0.5, fontSize:22, color: OP.RED, fontFace: OP.FONT});
    s.addText(sp.sub,   {x:0.7, y:3.5,  w:8.6, h:0.35, fontSize:13, color: OP.GRAY, fontFace: OP.FONT});
    s.addText(sp.date,  {x:0.7, y:4.6,  w:8.6, h:0.3,  fontSize:11, color: OP.GRAY, fontFace: OP.FONT});
    return;   // cover khong danh so
   }

   pageNo++;
   opHeaderBar(s, pptx, sp.title, sp.color, sp.caption);
   opFooter(s, pptx, pageNo);

   /* ---------- KPI CARDS ---------- */
   if(sp.kind === 'kpi'){
    const n = sp.cards.length, gap = 0.18, cw = (SLIDE_W - 0.9 - gap*(n-1))/n;
    sp.cards.forEach((c, i) => {
     const x = 0.45 + i*(cw + gap);
     /* co chu theo DO DAI gia tri — '20,532.3 bn' o 26pt bi xuong dong va tran
        ra ngoai card. Tinh deterministic, khong dua vao autofit cua PowerPoint. */
     const vlen = String(c.value).length;
     const vfs = vlen > 10 ? 18 : vlen > 7 ? 22 : 26;
     s.addShape(pptx.ShapeType.rect, {x:x, y:1.5, w:cw, h:2.15, fill:{color: OP.CARD}, line:{type:'none'}});
     s.addShape(pptx.ShapeType.rect, {x:x, y:1.5, w:cw, h:0.075, fill:{color: c.accent}, line:{type:'none'}});
     s.addText(c.label, {x:x+0.14, y:1.68, w:cw-0.28, h:0.3, fontSize:10, bold:true, color: OP.GRAY, fontFace: OP.FONT});
     s.addText(c.value, {x:x+0.14, y:2.05, w:cw-0.28, h:0.62, fontSize:vfs, bold:true, color: c.accent, fontFace: OP.FONT, valign:'middle'});
     if(c.sub1) s.addText(c.sub1, {x:x+0.14, y:2.76, w:cw-0.28, h:0.24, fontSize:9.5, color:'333333', fontFace: OP.FONT});
     if(c.sub2) s.addText(c.sub2, {x:x+0.14, y:3.0,  w:cw-0.28, h:0.24, fontSize:9.5, color: OP.GRAY, fontFace: OP.FONT});
    });
    if(sp.note) s.addText(sp.note, {x:0.45, y:4.05, w:9.1, h:0.5, fontSize:11.5,
      color: OP.NAVY, fontFace: OP.FONT, valign:'top'});
    return;
   }

   /* ---------- 1 CHART full width ---------- */
   if(sp.kind === 'oneChart'){
    const im = imgs[sp.chart.tag];
    if(im){
     const w = 9.1, h = Math.min(3.9, w*im.h/im.w);
     s.addImage({data: im.data, x:(SLIDE_W-w)/2, y:1.25, w:w, h:h});
    }
    return;
   }

   /* ---------- CHART + TABLE canh nhau ---------- */
   if(sp.kind === 'chartTable'){
    const im = imgs[sp.chart.tag];
    if(im){
     const w = 5.85, h = Math.min(3.5, w*im.h/im.w);
     s.addImage({data: im.data, x:0.4, y:1.3, w:w, h:h});
    }
    opTable(s, pptx, sp.table, 6.45, 1.3, 3.15, 9,
      sp.table.head.length === 3 ? [1.75, 0.9, 0.5] : [2.05, 1.1]);
    return;
   }

   /* ---------- 2 CHART (+ legend / table) ---------- */
   if(sp.kind === 'twoChart'){
    const a = imgs[sp.charts[0].tag], b2 = imgs[sp.charts[1].tag];
    const DW = 2.05;                       // be rong donut
    const dy = sp.legend ? 1.30 : 1.55;    // co legend thi day donut len
    if(a){
     const h = DW*a.h/a.w;
     s.addImage({data: a.data, x:0.55, y:dy, w:DW, h:h});
     s.addText(sp.charts[0].label, {x:0.35, y:dy+h+0.06, w:2.45, h:0.26,
       fontSize:9.5, bold:true, color: OP.NAVY, fontFace: OP.FONT, align:'center'});
    }
    if(sp.legend){
     /* legend ve NATIVE (khong raster) — chu net, doi mau duoc trong PowerPoint */
     sp.legend.forEach((lg, i) => {
      const y = 1.55 + i*0.36;
      s.addShape(pptx.ShapeType.rect, {x:3.30, y:y+0.04, w:0.17, h:0.17, fill:{color: lg.color}, line:{type:'none'}});
      s.addText(lg.name, {x:3.60, y:y, w:2.3, h:0.26, fontSize:10.5, color:'333333', fontFace: OP.FONT});
      s.addText(lg.pct,  {x:5.95, y:y, w:0.9, h:0.26, fontSize:10.5, bold:true, color: lg.color, fontFace: OP.FONT});
     });
     if(b2){
      /* nhan cua stack bar phai nam DUOI nhan donut, neu khong 2 nhan de len nhau */
      s.addText(sp.charts[1].label, {x:0.45, y:4.10, w:4, h:0.26, fontSize:9.5, bold:true, color: OP.NAVY, fontFace: OP.FONT});
      s.addImage({data: b2.data, x:0.45, y:4.40, w:9.1, h:0.31});
     }
    } else if(b2){
     const h = DW*b2.h/b2.w;
     s.addImage({data: b2.data, x:3.05, y:dy, w:DW, h:h});
     s.addText(sp.charts[1].label, {x:2.85, y:dy+h+0.06, w:2.45, h:0.26,
       fontSize:9.5, bold:true, color: OP.NAVY, fontFace: OP.FONT, align:'center'});
    }
    if(sp.table) opTable(s, pptx, sp.table, 5.55, 1.55, 4.0, 8.5, [1.15, 0.75, 0.6, 0.85, 0.65]);
    return;
   }

   /* ---------- TABLE full width ---------- */
   if(sp.kind === 'table'){
    const ncol = sp.table.head.length;
    const first = 1.85, rest = (9.1 - first)/(ncol-1);
    opTable(s, pptx, sp.table, 0.45, 1.3, 9.1, 8, [first].concat(Array(ncol-1).fill(rest)));
    return;
   }

   /* ---------- 2 COT text ---------- */
   if(sp.kind === 'twoCol'){
    [[sp.left, 0.45], [sp.right, 5.15]].forEach(([col, x]) => {
     if(!col || !col.body) return;
     s.addShape(pptx.ShapeType.rect, {x:x, y:1.3, w:4.4, h:3.6, fill:{color: col.tint}, line:{type:'none'}});
     s.addText(col.title, {x:x+0.22, y:1.45, w:3.96, h:0.32, fontSize:11, bold:true, color: col.ink, fontFace: OP.FONT});
     s.addText(col.body,  {x:x+0.22, y:1.82, w:3.96, h:2.9, fontSize:10, color: OP.NAVY, fontFace: OP.FONT, valign:'top', lineSpacingMultiple:1.15});
    });
    return;
   }
  });
  return pptx;
}

/* ========================= MAIN: EXPORT ================================== */

async function exportBrandProposal(btn){
 const label = btn ? btn.textContent : null;
 const setLbl = t => { if(btn) btn.textContent = t; };
 try{
  if(typeof PptxGenJS === 'undefined') throw new Error('thiếu thư viện PptxGenJS');
  setLbl('Building deck…');

  /* --- lop 1: whitelist --- */
  const payload = buildProposalPayload();

  /* --- lop 3: chan TRUOC khi ve. Fail-closed. --- */
  const bad = auditPayload(payload);
  if(bad.length){
   console.error('[pptx] CHAN EXPORT — payload con noi dung noi bo:\n' + bad.join('\n'));
   throw new Error('Chặn export: payload còn ' + bad.length + ' nội dung nội bộ (xem Console).\n' +
                   'Đây là cơ chế an toàn để deck không lộ thông tin nội bộ ra brand. Báo S&P để sửa whitelist.');
  }

  /* --- raster hoa chart --- */
  const tags = [];
  payload.slides.forEach(s => {
   if(s.chart) tags.push(s.chart.tag);
   if(s.charts) s.charts.forEach(c => tags.push(c.tag));
  });
  const imgs = await rasterizeCharts(tags);

  /* --- ve + ghi file --- */
  const pptx = renderDeck(new PptxGenJS(), payload, imgs);
  const fname = 'OnPoint_' + String(payload.brand).replace(/[^A-Za-z0-9]+/g, '_') + '_Growth_Opportunity.pptx';
  await pptx.writeFile({fileName: fname});
  setLbl('Exported ✓');
  setTimeout(() => setLbl(label), 2200);
 }catch(e){
  console.error('[pptx]', e);
  setLbl('Export failed');
  alert('Không export được deck:\n' + e.message);
  setTimeout(() => setLbl(label), 2600);
 }
}

/* export cho test headless trong node */
if(typeof module !== 'undefined' && module.exports){
 module.exports = {buildProposalPayload, auditPayload, renderDeck, scrub, hasLeak, stripTags, LEAK, SUBS, OP};
}
