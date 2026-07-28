/* ============================================================================
 * OnPoint Brand Hunt & Tier Analyzer — LIVE app logic
 * Cac man hinh (so Slide = so thu tu trong design spec noi bo):
 *   Slide 2  -> trang 1: nhap ten brand
 *   Slide 3  -> trang 2 nhanh BRAND MOI, chua upload brief
 *   Slide 4  -> trang 2 nhanh BRAND MOI, da upload -> luoi gate 14 truong / 6 nhom
 *   Slide 5  -> trang 2 nhanh BRAND DA TIEP CAN -> ho so + 10 khoi pill (read-only)
 *   Slide 6-8-> trang 3: market research, sizing, price range, competitor benchmark
 *   Slide 9  -> trang 3 cuoi: bang INTERNAL BRAND BRIEF (auto-fill + sua tay)
 * ==========================================================================*/
let S={brand:null,sub:null,cat2:null,group:'',found:false,parsed:null,fname:null,typed:''};

/* ==========================================================================
   BANG MAU — OnPoint brand identity. Doi mau chi sua o day.
   Blue = mau phan tich mac dinh (chart, bang, so lieu).
   Red  = branding + selected + priority + primary action (~10% giao dien).
   So am KHONG chi dua vao mau: luon co dau tru + mui ▼ + mau status rieng.
   ========================================================================== */
const C={
 red:'#C51B1E', redD:'#991B1E', redL:'#FBEAEA',
 blue:'#1F5AA6', blueD:'#163B66', blueM:'#4B7FBF', blueS:'#7FA8D4', blueL:'#EAF2FB',
 ink:'#383835', ink2:'#667085',
 line:'#D9DEE5', tint:'#F9FAFB', grid:'#E8ECF1',
 pos:'#16855B', neg:'#B42318', warn:'#D97706', neu:'#667085',
 barPrev:'#C4CBD4',         // ky truoc (tham chieu) -> xam trung tinh
 /* --- mau DATA ENCODING (khong phai mau thuong hieu OnPoint) ---------------
    Cac mieng trong cung 1 donut phai tach nhau ro khi trinh chieu tu xa;
    dung nhieu muc blue sat nhau thi khong doc duoc. Chi dung o:
      - khoi 2 Channel Split      -> shopee / tiktok
      - khoi 6 Sales Strategy     -> chBrand / chAff / chMall              */
 shopee:'#EA5024', tiktok:'#1D2440', lazada:'#1F5AA6',
 chBrand:'#1D6FE0', chAff:'#12A05C', chMall:'#6B3FE0'
};
/* so am: dau tru co san tu toFixed, them mui de khong phu thuoc mau */
const fmtPct=x=>(x==null?'—':(x>0?'▲ +':x<0?'▼ ':'')+(x*100).toFixed(1)+'%');
const fmtPctPlain=x=>(x==null?'—':(x>=0?'+':'')+(x*100).toFixed(1)+'%');
const pctc=x=>x==null?'var(--neu)':(x<0?'var(--neg)':x>0?'var(--pos)':'var(--neu)');
/* Tier: Elephant/Tier 0-1 = uu tien cao -> red; Tier 2 = warning; Tier 3 = neutral */
const tierColor=t=>/ELEP|Tier 0|Tier 1|TIER 1/i.test(t||'')?'var(--red)':/2/.test(t||'')?'var(--warn)':'var(--neu)';
const bandColor=b=>/HIGH/i.test(b||'')?'var(--pos)':/MED/i.test(b||'')?'var(--warn)':'var(--neu)';
const prioClass=p=>/P1/.test(p||'')?'p1':/P2/.test(p||'')?'p2':'';
const USDVND=25000;
/* ==========================================================================
   NGON NGU HIEN THI
   - Label / nav / button / header bang / tieu de section / legend chart -> ENGLISH
   - Dien giai / ghi chu / canh bao / nhan dinh / de xuat / next action -> TIENG VIET
     (nguoi dung chinh la VA executive Vietnamese)
   - So: format en-US (1,234.5). Don vi: bn = ti VND, M = trieu, VND.
   ========================================================================== */
const nfvi=x=>(x==null||isNaN(x))?'—':Number(x).toLocaleString('en-US');
const U={bn:'bn',M:'M',vnd:'VND'};   // don vi hien thi
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/* rong? — dung CUNG bo token voi brief_engine.js (EMPTY_TOKENS) de luoi gate 14 truong
   khong dem "-", "Chua co", "N/A", "TBD"... la da dien. */
const EMPTY_TOK=['','-','--','n/a','na','none','not yet','notyet','chưa','chua','chưa có','chua co','tbd','.'];
const nz=v=>{ if(v==null) return true; const s=String(v).trim().toLowerCase(); return s===''||EMPTY_TOK.indexOf(s)!==-1; };

/* ---- verdict Claude viet san (pre-baked, offline) cho brand demo ---- */
const PREBAKE={
 "opc":{
   match:["opc","dược phẩm opc"],
   sub:"Nutrition & Wellness",
   tier:"TIER 3", tierNote:"theo doanh thu Ecom hiện tại (~1.2bn/năm) — dưới ngưỡng 15bn",
   score:58, band:"MED", prio:"P2 — Nurture & qualify",
   model:"Service (brand giữ chủ động SOW; OnPoint vận hành từng phần)",
   pos:"Brand dược lâu đời (từ 1977), equity mạnh & assortment rộng 127 SKU (78 Thuốc, 18 TPBS, 10 TPBVSK). Nhưng quy mô Ecom còn nhỏ (doanh thu 2025 ~1.2bn, 57% đến từ webshop) → xếp TIER 3 theo cổng doanh thu, dù tiềm năng chiến lược cao trong sub-cat PRIME (Chăm sóc sức khỏe/TPCN chiếm ~81% ngành).",
   head:"Dư địa enabler rõ: (1) dịch chuyển từ webshop-heavy (57%) sang Shopee/TikTok nơi ngành đang tăng +23,6% YoY; (2) lọc 127 SKU xuống nhóm đủ điều kiện Ecom (loại thuốc kê đơn) để dựng catalogue bán được; (3) tăng cadence Livestream — sub-cat lệch ~ Affiliate, còn room cho brand-store.",
   risk:"Compliance G1 là cổng cứng: TPBVSK/TPBS phải có công bố đầy đủ trước khi quote. Channel-eligibility G2: nhóm 'Thuốc' (78 SKU) hầu như KHÔNG được bán trên TikTok Shop → phải tách assortment theo kênh. Đơn vị AOV/mục tiêu trong brief brand không ghi rõ → cần xác nhận trước khi định giá.",
   next:"1) Xác nhận đơn vị mục tiêu 2026-2027 + tách SKU đủ điều kiện Ecom · 2) Lấy công bố sản phẩm (G1) · 3) Dựng BP theo Rate Card cho nhóm SKU non-Rx, ưu tiên Shopee Mall.",
   /* headEN/riskEN — ban TIENG ANH cho deck gui brand. Deck phai 100% EN va
      app khong dich duoc luc runtime, nen phai viet tay song song voi ban VI.
      Chi duoc chua noi dung brand-safe (khong Tier/Score/Priority/model). */
   headEN:"The brand is currently webshop-heavy, with 57% of e-commerce revenue outside the marketplaces, while the category itself is growing +23.6% year on year on Shopee and TikTok Shop. Migrating demand onto the marketplaces is the clearest near-term growth path. A second lever is assortment: the 127-SKU range needs to be filtered down to the items that are eligible to trade online, so the listed catalogue is built only from sellable SKUs. Third, the sub-category is heavily affiliate-led, which leaves clear room to build a branded storefront and raise livestream cadence.",
   riskEN:"Product declaration filings are a hard gate: health supplements and functional foods must be fully declared before any SKU can be listed. Channel eligibility is the second constraint — the 78 pharmaceutical SKUs are largely restricted on TikTok Shop, so the assortment must be split by channel rather than listed uniformly.",
   targetGmvVND:2000000*USDVND, aovVND:174678
 },
 "healthbrand":{
   match:["healthbrand","health brand"],
   sub:"Nutrition & Wellness",
   tier:"(pending historical GMV)", tierNote:"brief thiếu doanh thu Ecom cụ thể → chưa chấm được cổng doanh thu",
   score:64, band:"MED", prio:"P2 — Qualify (ưu tiên bổ sung data)",
   model:"Distribution (OnPoint mua đứt tồn kho từ brand)",
   pos:"Định vị premium: AOV 575k & AIV 550k — vượt ngưỡng 270k (factor Economics: điểm cao), margin hấp dẫn. Cạnh tranh trực tiếp nhóm nhập khẩu (Blackmores, Swisse). Nằm trong sub-cat PRIME (Nutrition & Wellness, +18-22% YoY, TikTok share 63%).",
   head:"AOV premium cho phép đầu tư content mạnh & bundle liệu trình. Room lớn ở TikTok (share ngành 63%) nếu xây creator pool riêng. Mô hình Distribution phù hợp brand muốn OnPoint gánh tồn kho & vận hành.",
   risk:"Brief THIẾU 2 mảnh quyết định: (1) SKU list trống → không dựng được assortment/contribution thực; (2) doanh thu Ecom lịch sử 'Chưa có' → không chấm được Tier & không tính headroom. Cạnh tranh giá với hàng xách tay. Compliance TPCN cần kiểm.",
   next:"1) Yêu cầu brand bổ sung SKU list + doanh thu Ecom 12 tháng (bắt buộc trước quote) · 2) Chấm Tier lại khi có GMV · 3) Test 3-5 SKU chủ lực trên TikTok trước khi cam kết Distribution.",
   headEN:"A premium price position — AOV 575k and AIV 550k — sits well above the 270k threshold, which supports heavier content investment and course-based bundling rather than price-led promotion. The brand competes directly with the imported set (Blackmores, Swisse) in a sub-category growing 18-22% year on year, where TikTok Shop already carries 63% of GMV. That combination leaves substantial room to build a dedicated creator pool.",
   riskEN:"Product declaration filings are required for health supplements before any SKU can be listed. The main commercial risk is price competition against grey-market and hand-carried stock, which typically undercuts authorised listings and needs an active marketplace enforcement plan.",
   targetGmvVND:1000000*USDVND, aovVND:575000
 }
};
function findPrebake(){
 const name=(S.brand&&S.brand.name?S.brand.name:'').toLowerCase();
 const intro=(S.parsed&&S.parsed.schema.company_intro?S.parsed.schema.company_intro:'').toLowerCase();
 for(const k in PREBAKE){ if(PREBAKE[k].match.some(m=>name.includes(m)||intro.includes(m))) return PREBAKE[k]; }
 return null;
}

function go(p){for(let i=1;i<=3;i++){document.getElementById('p'+i).classList.toggle('show',i==p);var st=document.getElementById('s'+i);st.classList.toggle('active',i==p);st.classList.toggle('done',i<p);}window.scrollTo({top:0,behavior:'smooth'});}

/* ==========================================================================
   NHAN DIEN BRAND — chiu duoc VA go sai
   norm(): bo dau tieng Viet + ha chu thuong + bo MOI ky tu khong phai chu/so
           => "Well Green" = "wellgreen" = "WELL-GREEN" = "well  green "
   lev() : Levenshtein. Sai <=2 ky tu -> KHONG tu match, hien banner goi y
           de VA tu xac nhan (tranh nhay sai sang brand khac ten gan giong).
   ========================================================================== */
function norm(s){
 return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')  // bo dau tieng Viet
   .replace(/đ/g,'d').replace(/Đ/g,'D')                      // d/D co gach
   .toLowerCase().replace(/[^a-z0-9]/g,'');
}
function lev(a,b){
 if(a===b) return 0;
 if(Math.abs(a.length-b.length)>3) return 99;      // chenh qua dai -> khoi tinh
 let prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const cur=[i];
  for(let j=1;j<=b.length;j++)
   cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+(a[i-1]===b[j-1]?0:1));
  prev=cur;
 }
 return prev[b.length];
}
/* tra ve {hit, near[]} — hit = match chac chan, near = danh sach nghi van.
   Doi chieu voi CA Brand name LAN Group Brand trong history, vi VA co the
   chi biet ten tap doan chu chua co ten brand cu the. */
function matchBrand(input){
 const q=norm(input);
 if(!q) return {hit:null,near:[]};
 const keys=b=>[b.name,b.group].filter(Boolean).map(norm).filter(Boolean);
 const hit=DATA.history.find(b=>keys(b).includes(q));
 if(hit) return {hit,near:[]};
 // chua chac: (1) sai chinh ta <=2, (2) 1 ben chua ben kia (VD "vitanova" vs "VitaNova Health")
 const near=DATA.history.map(b=>{
   const d=Math.min(...keys(b).map(n=>{
     const sub=(q.length>=4&&n.includes(q))||(n.length>=4&&q.includes(n));
     return sub?0.5:lev(q,n);
   }));
   return {b, d};
 }).filter(x=>x.d<=2).sort((x,y)=>x.d-y.d).slice(0,4).map(x=>x.b);
 return {hit:null,near};
}
function lookup(){
 const name=(document.getElementById('i_name').value||'').trim();
 const group=(document.getElementById('i_group').value||'').trim();
 // Brand Name va Group Brand: dien 1 trong 2 la du.
 if(!name && !group){alert('Please enter Brand Name or Group Brand');return;}
 S.sub=document.getElementById('i_cat').value;
 S.cat2=document.getElementById('i_cat2').value||null;
 S.group=group;
 // chua co ten brand cu the -> dung Group Brand lam khoa tra cuu & ten hien thi
 const key = name || group;
 S.typed=key; S.parsed=null; S.fname=null;
 const {hit,near}=matchBrand(key);
 if(hit){ S.found=true; S.brand=hit; S.sub=hit.sub; renderStep2(); go(2); return; }
 if(near.length){ renderSuggest(key,near); go(2); return; }    // chua chac -> hoi VA
 S.found=false; S.brand={name:key,group:group,sub:S.sub,tier:null,isNew:true};
 renderStep2(); go(2);
}
/* banner goi y khi go gan dung */
function renderSuggest(typed,near){
 const opt=near.map(b=>`<button class="btn ghost" style="margin:0 8px 8px 0"
   onclick="pickBrand('${b.name.replace(/'/g,"\\'")}')">${esc(b.name)}
   <span style="font-weight:400;color:var(--ink-2)">· ${esc(b.tier||'')} · ${esc(b.status||'')}</span></button>`).join('');
 document.getElementById('p2').innerHTML=
  `<div class="banner" style="background:var(--warn-l);border-color:#F2DDBB;align-items:flex-start">
    <div class="ic" style="background:var(--warn);color:#fff">?</div>
    <div><div class="tt">No exact match for "${esc(typed)}"</div>
     <div class="ss">Có ${near.length} brand trong Brand history gần giống. Ý bạn là brand nào?</div></div></div>
   <div class="card"><h3>Select the Correct Brand</h3>
    <div class="hint">Bấm vào brand đúng để mở hồ sơ đã tiếp cận, hoặc xác nhận đây là brand mới.</div>
    <div>${opt}</div>
    <div class="btnrow"><button class="btn ghost" onclick="go(1)">← Edit Name</button>
     <button class="btn" onclick="confirmNew()">No, "${esc(typed)}" is a NEW brand →</button></div></div>`;
}
function pickBrand(name){
 const b=DATA.history.find(x=>x.name===name); if(!b) return;
 S.found=true; S.brand=b; S.sub=b.sub;
 document.getElementById('i_name').value=b.name;   // sua lai input cho dung
 renderStep2();
}
function confirmNew(){
 S.found=false; S.brand={name:S.typed,sub:S.sub,tier:null,isNew:true};
 renderStep2();
}

/* ==========================================================================
   BUOC 2 — nhanh BRAND MOI (Slide 3/4) & nhanh BRAND DA TIEP CAN (Slide 5)
   ========================================================================== */
function renderStep2(){
 document.getElementById('p2').innerHTML = S.found ? profileHTML() : (bannerNew()+briefHTML());
 if(!S.found) wireDrop();
}
function bannerNew(){
 return `<div class="banner new"><div class="ic">＋</div>
  <div><div class="tt">${esc(S.brand.name)}<span class="dot">·</span>New Brand</div>
  <div class="ss">Cập nhật thông tin Brand để có được phân tích và đề xuất</div></div></div>`;
}
/* --- Slide 3: dropzone --- */
function briefHTML(){
 return `<div class="card">
  <div class="drop" id="drop">
   <div class="big">📄 Upload Standard Brand Brief</div>
   <div class="sm">Upload/Kéo thả file Standard Brief để tiến hành Phân tích &amp; Đề Xuất</div>
   <input type="file" id="file" accept=".xlsx,.xls" style="display:none"></div>
  <div id="parsezone"></div>
  <div class="btnrow"><button class="btn ghost" onclick="go(1)">← Change Brand</button>
   <button class="btn" id="btnAnalyze" disabled onclick="renderStep3()">Analyze &amp; Recommend →</button></div></div>`;
}
function wireDrop(){
 const drop=document.getElementById('drop'), file=document.getElementById('file');
 if(!drop) return;
 drop.onclick=()=>file.click();
 file.onchange=e=>{ if(e.target.files[0]) handleFile(e.target.files[0]); };
 ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
 ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
 drop.addEventListener('drop',e=>{ if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
}
function handleFile(f){
 const pz=document.getElementById('parsezone');
 pz.innerHTML=`<div class="hint" style="margin-top:16px">⏳ AI đang đọc <b>${esc(f.name)}</b>…</div>`;
 const rd=new FileReader();
 rd.onload=e=>{
  try{
   const res=BriefEngine.parseArrayBuffer(e.target.result);
   S.parsed=res; S.fname=f.name; renderGate(res,f.name);
  }catch(err){ pz.innerHTML=`<div class="warnbox">Không đọc được file: ${esc(err.message)}. Kiểm tra đúng template brief OnPoint (.xlsx).</div>`; }
 };
 rd.readAsArrayBuffer(f);
}

/* --- Slide 4: luoi gate 14 truong / 6 nhom ---------------------------------
   MAP truong brief -> nhom hien thi. Doi map o day neu nghiep vu doi.
   'Price' = gia trong sheet SKU List (suy qua sku_count) — xac nhan lai voi CD.
   Contact Point = tach tu 1 o text duy nhat (row 27) bang regex -> heuristic. */
/* Contact point — 1 NGUON DUY NHAT cho ca 3 cho hien thi (Slide 4 gate, Slide 5
   ho so, Slide 9 Internal Brand Brief). Uu tien brief da parse (brief_engine tra
   ve schema.contact, doc duoc ca template 4 o moi lan 1 o gop cu), fallback sang
   4 column Contact* trong Brand history. */
function contactOf(){
 const s=S.parsed?S.parsed.schema:null, b=S.brand||{};
 const fromBrief=s&&s.contact?s.contact:null;
 const fromHist={name:b.c_name||null,position:b.c_pos||null,email:b.c_email||null,phone:b.c_phone||null};
 const pick=k=>(fromBrief&&!nz(fromBrief[k]))?{v:fromBrief[k],src:'brief'}
              :(!nz(fromHist[k])?{v:fromHist[k],src:'history'}:{v:null,src:null});
 const o={name:pick('name'),position:pick('position'),email:pick('email'),phone:pick('phone')};
 o.filled=['name','position','email','phone'].filter(k=>o[k].v!=null).length;
 o.briefFormat=fromBrief?fromBrief.source:null;   // '4-cell' | 'merged' | 'empty'
 return o;
}
/* giu lai cho tuong thich: tach 1 chuoi gop thanh 4 phan */
function contactParts(txt){
 const s=String(txt||'');
 const email=(s.match(/[\w.+-]+@[\w-]+\.[\w.]+/)||[])[0]||null;
 const phone=(s.match(/(?:\+?84|0)\d[\d\s.\-]{7,}\d/)||[])[0]||null;
 let rest=s.replace(email||'','').replace(phone||'','');
 const parts=rest.split(/[\/,;|\n·–-]+/).map(x=>x.trim()).filter(x=>x.length>1);
 return {name:parts[0]||null, position:parts[1]||null, email:email, phone:phone};
}
function gateGroups(){
 const s=S.parsed.schema, c=contactOf();
 const cp={name:c.name.v,position:c.position.v,email:c.email.v,phone:c.phone.v};
 return [
  {n:'Background', rows:[
    {l:'Competitors', v:s.competitors},
    {l:'Business Objectives', v:s.top2_objectives}]},
  {n:'Product', rows:[
    {l:'Product List', v:s.product_brands},
    {l:'Price', v:(s.sku_count>0?'SKU List: '+s.sku_count+' SKU':null)},
    {l:'AIV / AOV', v:(s.aov.value!=null&&s.aiv.value!=null)?'ok':null},
    {l:'Ecom Platform Store', v:s.ecom_platform_store}]},
  {n:'Historical Data', solo:true, rows:[
    {l:'Historical Data', v:(s.hist_sales_ecom.value!=null?'ok':s.hist_sales_all)}]},
  {n:'KPIs & Budget', rows:[
    {l:'Target 12M', v:(s.objective_2627.value!=null?'ok':null)},
    {l:'%CIR', v:s.budget}]},
  {n:'Timeline', solo:true, rows:[
    {l:'Timeline', v:s.timeline}]},
  {n:"Brand's Contact Point", rows:[
    {l:'Name', v:cp.name},{l:'Position', v:cp.position},
    {l:'Email', v:cp.email},{l:'Phone', v:cp.phone}]}
 ];
}
function gateGridHTML(){
 const gs=gateGroups();
 let total=0, okc=0;
 gs.forEach(g=>g.rows.forEach(r=>{total++; if(!nz(r.v)) okc++;}));
 // xep 2 cot: cot trai = Background/Product/Historical, phai = KPIs/Timeline/Contact
 const L=[gs[0],gs[1],gs[2]], R=[gs[3],gs[4],gs[5]];
 const cardH=g=>{
   const ok=g.rows.filter(r=>!nz(r.v)).length, tot=g.rows.length;
   const chip = ok===tot ? `<span class="cnt full">${ok}/${tot} · complete</span>`
                         : `<span class="cnt part">${ok}/${tot} · ${tot-ok} missing</span>`;
   if(g.solo){ const r=g.rows[0], o=!nz(r.v);
     return `<div class="gcard solo"><div class="gh"><span class="chk ${o?'ok':'miss'}">${o?'✓':'!'}</span>
      <span class="gt">${esc(g.n)}</span><span class="st ${o?'ok':'miss'}" style="margin-left:auto">${o?'Received · parsed':'Missing · required'}</span></div></div>`; }
   return `<div class="gcard"><div class="gh"><span class="gt">${esc(g.n)}</span>${chip}</div>
    ${g.rows.map(r=>{const o=!nz(r.v);
      return `<div class="grow"><span class="chk ${o?'ok':'miss'}">${o?'✓':'!'}</span><span>${esc(r.l)}</span>
       <span class="st ${o?'ok':'miss'}">${o?'Received · parsed':'Missing · required'}</span></div>`;}).join('')}</div>`;
 };
 const miss=total-okc;
 return `<div class="gatehead"><div class="t">Brief Detection Result</div>
   <div class="c">${okc}/${total} fields received${miss?` · <b>${miss} missing</b>`:''}</div></div>
  <div class="gatesub">Các trường còn thiếu (đỏ) có thể bổ sung để nâng chất lượng phân tích &amp; đề xuất.</div>
  <div class="gategrid"><div>${L.map(cardH).join('')}</div><div>${R.map(cardH).join('')}</div></div>`;
}
function renderGate(res,fname){
 const why={"Product (*)":"danh mục & SKU để dựng catalogue","Price (*)":"AOV/AIV để tính P&L & fulfillment","Historical Data (*)":"doanh số để chấm Tier & headroom","Objectives & KPIs (*)":"mục tiêu doanh thu để dựng business plan"};
 const gatemsg = res.brief_valid ? '' :
   `<div class="warnbox" style="border-color:var(--red);background:var(--red-l);color:var(--neg)">
     ⛔ <b>Gate CHẶN</b> — thiếu trường bắt buộc (*): <b>${res.gate.missing.map(m=>esc(m)+' ('+esc(why[m]||'')+')').join(' · ')}</b>.
     AI không phân tích khi thiếu input quyết định. Sửa brief &amp; upload lại.</div>`;
 const warn = res.warnings.length
   ? `<div class="warnbox"><b>⚠ Data quality warnings (${res.warnings.length}):</b><ul>${res.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>` : '';
 document.getElementById('parsezone').innerHTML=
   `<div class="fileok"><span class="chk ok">✓</span><span>${esc(fname)}</span><span class="r">Parsed</span></div>
    ${gateGridHTML()}${gatemsg}${warn}`;
 document.getElementById('btnAnalyze').disabled=!res.brief_valid;
}

/* --- Slide 5: ho so brand da tiep can + 10 khoi pill (read-only) ---------- */
/* cls 'key' = to red (uu tien / trang thai quyet dinh). Con lai selected = blue.
   Chi 2 panel duoc to red de giu ty le red ~10% giao dien:
   STATUS (deal dang o dau) va CONTRACT STATUS (blocker phap ly). */
const PILLS=[
 {key:'cat',      lab:'CAT',             list:'cat'},
 {key:'tier',     lab:'TIER',            list:'tier',   sort:true},
 {key:'elephant', lab:'ELEPHANT',        list:'elephant'},
 {key:'model',    lab:'MODEL',           list:'model'},
 {key:'channel',  lab:'CHANNEL',         list:'channel'},
 {key:'status',   lab:'STATUS',          list:'status',   cls:'key'},
 {key:'contract', lab:'CONTRACT STATUS', list:'contract', cls:'key'},
 {key:'pending',  lab:'PENDING PARTY',   list:'pending'},
 {key:'country',  lab:'COUNTRY',         list:'country'},
 {key:'lead',     lab:'LEAD SOURCE',     list:'lead'}
];
function panelHTML(p,b){
 let opts=(DATA.lists[p.list]||[]).slice();
 if(p.sort) opts.sort((a,c)=>String(a).localeCompare(String(c))); // Tier 0..3
 const cur=b[p.key];
 const hit=opts.some(o=>String(o).toLowerCase()===String(cur||'').toLowerCase());
 const pills=opts.map(o=>{
   const on=String(o).toLowerCase()===String(cur||'').toLowerCase();
   return `<span class="pill${on?' on'+(p.cls?' '+p.cls:''):''}">${esc(o)}</span>`;}).join('');
 let note='';
 if(nz(cur)) note=`<div class="pnote nodata">Chưa có data cho trường này trong Brand history.</div>`;
 else if(!hit) note=`<div class="pnote">Giá trị thật: <b>${esc(cur)}</b> — ngoài danh sách hợp lệ, không highlight được pill nào.</div>`;
 return `<div class="ppanel"><div class="plab">${p.lab}</div><div class="pills">${pills}</div>${note}</div>`;
}
/* khoi Contact point — dung CUNG contactOf() voi Slide 4 va Slide 9 */
function contactBlockHTML(){
 const c=contactOf();
 const F=[['Name','name'],['Position','position'],['Email','email'],['Phone','phone']];
 const cells=F.map(([lab,k])=>{
   const o=c[k], has=o.v!=null;
   const val = !has ? '<span class="na">Not available</span>'
     : (k==='email' ? `<a href="mailto:${esc(o.v)}">${esc(o.v)}</a>`
     :  k==='phone' ? `<a href="tel:${esc(String(o.v).replace(/[^\d+]/g,''))}">${esc(o.v)}</a>`
     :  esc(o.v));
   return `<div class="linkbox"><div class="k">${lab}${has?' <span class="tinyu">· '+o.src+'</span>':''}</div>${val}</div>`;
 }).join('');
 let note='';
 if(c.filled===0) note=`<div class="pnote nodata">Chưa có contact point ở cả brief và Brand history. Cần VA bổ sung — đây là đầu mối để gửi proposal/quotation.</div>`;
 else if(c.filled<4) note=`<div class="pnote">Thiếu ${4-c.filled}/4 trường contact point.</div>`;
 // brief dung template cu (4 thong tin gop 1 o): khong hien ky thuat ra UI, chi nhac VA
 if(c.briefFormat==='merged') note+=`<div class="pnote">Brief dùng mẫu cũ — nên chuyển sang mẫu Standard Brief mới nhất để 4 thông tin liên hệ được tách riêng.</div>`;
 return `<div class="ppanel" style="margin-bottom:14px"><div class="plab">BRAND'S CONTACT POINT</div>
   <div class="linkrow" style="grid-template-columns:repeat(4,1fr);margin-bottom:0">${cells}</div>${note}</div>`;
}
function profileHTML(){
 const b=S.brand;
 const nmv = b.nmv12_vnd ? '~'+(b.nmv12_vnd/1e9).toFixed(0)+U.bn+' / year' : (b.gmv!=null?'~'+b.gmv+U.bn+' / year':'—');
 // badge Hunt Priority: P1 -> red, P2 -> blue, P3 -> neutral (khong dung red cho moi truong hop)
 const badge = (b.prio||b.band||b.score!=null)
   ? `<div class="tierbadge ${prioClass(b.prio)}">${esc(b.prio||'')}${b.band?' · '+esc(b.band):''}${b.score!=null?' '+b.score:''}</div>` : '';
 const stores=(b.linkStore||'').split(/[\s,;]+/).filter(x=>/^https?:/.test(x));
 const storeName=u=>/tiktok/i.test(u)?'TikTok':/lazada/i.test(u)?'Lazada':/shopee/i.test(u)?'Shopee':'Store';
 let h=`<div class="banner old"><div class="ic">✓</div>
  <div><div class="tt">${esc(b.name)}<span class="dot">·</span>Existing Brand</div>
   <div class="ss">Profile &amp; Brief · already in system${b.analysisDate?' · analyzed '+esc(b.analysisDate):''}</div></div>${badge}</div>`;
 h+=`<div class="metrics">
   <div class="metric"><div class="k">Brand</div><div class="v">${esc(b.name)}</div></div>
   <div class="metric"><div class="k">NMV 12M</div><div class="v">${nmv}</div><div class="s">${b.nmv12_usd?'$'+nfvi(b.nmv12_usd):''}</div></div>
   <div class="metric"><div class="k">CD</div><div class="v">${esc(b.cd||b.pic||'—')}</div></div>
   <div class="metric"><div class="k">VA Name</div><div class="v">${esc(b.va||'—')}</div></div></div>`;
 h+=`<div class="linkrow">
   <div class="linkbox"><div class="k">Link Store</div>${stores.length?stores.map(u=>`<a class="chipa" href="${esc(u)}" target="_blank" rel="noopener">${storeName(u)}</a>`).join(''):'<span class="na">Not available</span>'}</div>
   <div class="linkbox"><div class="k">Link Proposal</div>${b.linkProposal?`<a href="${esc(b.linkProposal)}" target="_blank" rel="noopener">Open Proposal Deck</a>`:'<span class="na">Not available</span>'}</div>
   <div class="linkbox"><div class="k">BP &amp; Quotation</div>${b.linkBP?`<a href="${esc(b.linkBP)}" target="_blank" rel="noopener">Open Business Plan</a>`:'<span class="na">Not available</span>'}</div></div>`;
 // 10 khoi pill: CAT full-width, con lai xep 2 cot
 h+=`<div class="pgrid">${panelHTML(PILLS[0],b)}</div>`;
 h+=`<div class="pgrid c2">${panelHTML(PILLS[1],b)}${panelHTML(PILLS[2],b)}</div>`;
 h+=`<div class="pgrid c2">${panelHTML(PILLS[3],b)}${panelHTML(PILLS[4],b)}</div>`;
 h+=`<div class="pgrid">${panelHTML(PILLS[5],b)}</div>`;
 h+=`<div class="pgrid">${panelHTML(PILLS[6],b)}</div>`;
 h+=`<div class="pgrid">${panelHTML(PILLS[7],b)}</div>`;
 h+=`<div class="pgrid c2">${panelHTML(PILLS[8],b)}${panelHTML(PILLS[9],b)}</div>`;
 h+=contactBlockHTML();
 h+=`<div class="btnrow"><span><button class="btn ghost" onclick="go(1)">← Change Brand</button>
   <button class="btn ghost sm" style="margin-left:10px" onclick="showRepitch()">Upload New Brief (Re-pitching)</button></span>
   <button class="btn" onclick="renderStep3()">Analyze &amp; Recommend →</button></div>`;
 return h;
}
/* re-pitching: dung lai chinh UI Slide 3/4 (theo ghi chu trong PPT) */
function showRepitch(){
 document.getElementById('p2').innerHTML=
  `<div class="banner old"><div class="ic">✓</div><div><div class="tt">${esc(S.brand.name)}<span class="dot">·</span>Re-pitching</div>
   <div class="ss">Upload brief mới nhất để chạy lại phân tích &amp; đề xuất</div></div></div>`
  +briefHTML()
  +`<div class="btnrow" style="margin-top:-6px"><button class="btn ghost sm" onclick="renderStep2()">← Back to Brand Profile</button><span></span></div>`;
 wireDrop();
 document.getElementById('btnAnalyze').disabled=false; // brand da co history -> khong chan
}

/* ==========================================================================
   BUOC 3 — Slide 6/7/8 + Slide 9
   ========================================================================== */
const CC=[C.blue,C.blueM,C.blueS];   // cot competitor: 3 muc dam nhat cua blue (khong dung mau la)
const SEG=[['<200k',0,200000],['200k–500k',200000,500000],['500k–1M',500000,1000000],
           ['1M–2M',1000000,2000000],['2M–3.5M',2000000,3500000],['Other (>3.5M)',3500000,Infinity]];

function sheadHTML(t1,t2,sub,rightSub){
 return `<div class="shead"><div class="barv"></div>
  <div><div class="t">${t1} <em>${t2}</em></div><div class="s">${sub}</div></div>
  <div class="rt"><div class="b"><i>${esc(S.brand.name)}</i></div><div class="sub">${esc(rightSub||S.sub)}</div></div></div>`;
}
function bandRange(str){ // "200.000₫ - 350.000₫" -> [200000,350000]
 const ns=(String(str).match(/[\d][\d.,]*/g)||[]).map(x=>parseFloat(x.replace(/[.,]/g,'')));
 if(!ns.length) return [0,0];
 return ns.length===1 ? (/^\s*</.test(str)?[0,ns[0]]:[ns[0],Infinity]) : [ns[0],ns[1]];
}
function bandShort(str){
 const [a,b]=bandRange(str);
 const s=v=>v===Infinity?'∞':(v>=1e6?(v/1e6)+'M':(v/1e3)+'k');
 return s(a)+'-'+s(b);
}
function aovVND(){
 if(S.parsed&&S.parsed.schema.aov.value!=null){
   const a=S.parsed.schema.aov; return a.unit==='USD'?a.value*USDVND:a.value; }
 return null;
}
/* GMV cua brand (ti VND/nam) — uu tien Brand history, fallback sang brief da parse.
   Truoc day chi doc history => brand moi (chua co history) luon hien "tu brief"
   du brief da co so doanh thu Ecom. */
function myGmvTi(){
 if(S.brand&&S.brand.gmv!=null) return {v:S.brand.gmv, src:'history'};
 if(S.parsed){
  const h=S.parsed.schema.hist_sales_ecom;
  const ti=BriefEngine.toBillionVND(h.value,h.unit);
  if(ti!=null) return {v:+ti.toFixed(ti<10?1:0), src:'brief'+(h.unit_inferred?' · unit inferred':'')};
 }
 return {v:null, src:null};
}

/* ---- 1. donut channel split FY2025 vs H1 2026 (data thật Metrics) ---- */
/* tag = data-chart, de pptx_export.js tim dung SVG trong DOM (dung raster hoa).
   MOI chart phai co tag on dinh — dung querySelector theo vi tri se vo khi doi layout. */
function donut(segs,center,label,tag){
 const R=54,C=2*Math.PI*R; let off=0;
 const arcs=segs.filter(s=>s.v>0).map(s=>{
   const len=C*s.v; const el=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${s.c}" stroke-width="26"
     stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
     transform="rotate(-90 70 70)"></circle>`; off+=len; return el;}).join('');
 return `<svg width="140" height="140" viewBox="0 0 140 140" data-chart="${tag||''}">${arcs}
   <text x="70" y="66" text-anchor="middle" font-size="17" font-weight="700" fill="${C.ink}">${center}</text>
   <text x="70" y="83" text-anchor="middle" font-size="9.5" fill="${C.ink2}">${label}</text></svg>`;
}
/* ---- 100% stacked bar — TRUOC day la <div> flex, gio la SVG.
   Ly do doi: canvas KHONG ve duoc HTML div, nen bar cu khong raster hoa duoc
   khi export pptx. SVG thi ve duoc. Dung 1 nguon cho ca dashboard va deck. */
function svgStack100(rows,tag){
 const W=1000,H=34; let x=0,g='';
 rows.forEach(([n,c,v])=>{
  const w=W*v;
  g+=`<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" fill="${c}"></rect>`;
  // nhan % chi in khi mieng du rong, khong thi chu bi tran ra ngoai
  if(v>=0.12) g+=`<text x="${(x+w/2).toFixed(1)}" y="${H/2+4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${(v*100).toFixed(0)}%</text>`;
  x+=w;
 });
 return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:26px;display:block" data-chart="${tag||''}">${g}</svg>`;
}
function channelSplitHTML(){
 const B6=DATA.block6;
 const h1=B6.find(x=>x.t==='H1.2025'), h2=B6.find(x=>x.t==='H2.2025'), c=B6.find(x=>x.t==='H1.2026');
 if(!h1||!h2||!c) return '';
 const P=[{n:'Shopee',c:C.shopee},{n:'TikTok Shop',c:C.tiktok}];
 const mk=(shp,tts,ttl,lab,tag)=>{
   const tot=shp+tts;
   const segs=[{v:shp/tot,c:P[0].c},{v:tts/tot,c:P[1].c}];
   const leg=[[P[0],shp],[P[1],tts]].map(([p,v])=>
     `<div class="r"><span class="sw" style="background:${p.c}"></span><span class="nm">${p.n}</span><span class="pc" style="color:${p.c}">${(v/tot*100).toFixed(0)}%</span></div>`).join('');
   return `<div class="dwrap"><div class="dttl">${lab}</div>
     <div class="dbody">${donut(segs,ttl,'NMV ('+U.bn+' VND)',tag)}<div class="dleg">${leg}</div></div></div>`;};
 const fyS=h1.shp+h2.shp, fyT=h1.tts+h2.tts;
 const rows=[['FY 2025',fyS,fyT],['H1 2026',c.shp,c.tts]].map(([lb,s,t])=>{
   const tot=s+t;
   return `<table class="cmp" style="margin-top:6px"><thead><tr><th>${lb}</th><th>NMV (${U.bn})</th><th>% Contrib</th></tr></thead><tbody>
    <tr><td style="color:${C.shopee};font-weight:700">Shopee</td><td>${nfvi(s)}</td><td>${(s/tot*100).toFixed(0)}%</td></tr>
    <tr><td style="color:${C.tiktok};font-weight:700">TikTok Shop</td><td>${nfvi(t)}</td><td>${(t/tot*100).toFixed(0)}%</td></tr>
    <tr class="tot"><td>Total</td><td>${nfvi(tot)}</td><td>100%</td></tr></tbody></table>`;}).join('');
 const yoy=((c.shp+c.tts)/(h1.shp+h1.tts)-1);
 return `<div class="mr"><div class="h"><span class="num">2</span>Channel Split — FY2025 vs H1 2026<span class="viz">revenue by platform · Metrics</span></div>
  <div class="body"><div class="donuts">${mk(fyS,fyT,nfvi(fyS+fyT),'FY 2025','donut-fy2025')}${mk(c.shp,c.tts,nfvi(c.shp+c.tts),'H1 2026','donut-h12026')}</div>
   <div class="two" style="margin-top:14px">${rows}</div>
   <div class="note">Nguồn Metrics tách theo <b>Shopee</b> và <b>TikTok Shop</b>; Lazada chưa có trong bộ data hiện tại. Tăng trưởng H1.2026 vs H1.2025: <b style="color:${pctc(yoy)}">${fmtPct(yoy)}</b>.</div>
  </div></div>`;
}

/* ---- 2. grouped bar: sizing sub-category + growth HoH ----
   lbl  = ham doi ten sub-cat sang ngon ngu hien thi. Dashboard truyen identity
          (giu tieng Viet nhu data goc); pptx_export.js truyen map EN vi deck
          gui brand phai 100% tieng Anh. Nhan nam TRONG pixel sau khi raster hoa
          nen khong the dich sau — phai sinh SVG rieng cho ban EN.
   tag  = data-chart. Ban EN dung tag khac de khong dung do voi ban tren trang. */
function sizingSVG(sub, lbl, tag){
 lbl = lbl || (x=>x);
 const D=DATA.block2.slice().sort((a,b)=>b.gmv_ti-a.gmv_ti);
 const W=1000,H=330,padL=8,padB=74,padT=46;
 const n=D.length, gw=(W-padL*2)/n, bw=Math.min(34,gw/2.6);
 const mx=Math.max(...D.map(x=>x.gmv_ti));
 const y=v=>padT+(H-padT-padB)*(1-v/mx);
 let g='';
 D.forEach((x,i)=>{
  const prev=x.gmv_ti/(1+(x.grow||0));
  const cx=padL+gw*i+gw/2, x1=cx-bw-3, x2=cx+3;
  const star=x.bucket===sub;
  // ky nay = blue (mau phan tich mac dinh); bucket cua brand = red (priority highlight)
  const cur = star ? C.red : C.blue;
  g+=`<rect x="${x1}" y="${y(prev)}" width="${bw}" height="${H-padB-y(prev)}" fill="${C.barPrev}"></rect>
      <rect x="${x2}" y="${y(x.gmv_ti)}" width="${bw}" height="${H-padB-y(x.gmv_ti)}" fill="${cur}"></rect>
      <text x="${x1+bw/2}" y="${y(prev)-5}" text-anchor="middle" font-size="10.5" fill="${C.ink2}">${nfvi(Math.round(prev))}</text>
      <text x="${x2+bw/2}" y="${y(x.gmv_ti)-5}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.ink}">${nfvi(x.gmv_ti)}</text>
      <rect x="${cx-34}" y="${Math.max(4,y(x.gmv_ti)-40)}" width="68" height="19" rx="9.5" fill="#fff" stroke="${x.grow<0?C.neg:C.pos}"></rect>
      <text x="${cx}" y="${Math.max(4,y(x.gmv_ti)-40)+13.5}" text-anchor="middle" font-size="10" font-weight="700" fill="${x.grow<0?C.neg:C.pos}">${fmtPct(x.grow)}</text>`;
  const words=String(lbl(x.sub)).split(' '); let l1=[],l2=[];
  words.forEach(w=>{ (l1.join(' ').length+w.length<=14?l1:l2).push(w); });
  g+=`<text x="${cx}" y="${H-padB+18}" text-anchor="middle" font-size="10.5" font-weight="${star?'700':'400'}" fill="${star?C.red:C.ink2}">${star?'★ ':''}${esc(l1.join(' '))}</text>
      ${l2.length?`<text x="${cx}" y="${H-padB+32}" text-anchor="middle" font-size="10.5" font-weight="${star?'700':'400'}" fill="${star?C.red:C.ink2}">${esc(l2.join(' '))}</text>`:''}`;
 });
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" data-chart="${tag||'sizing'}">
   <line x1="${padL}" y1="${H-padB}" x2="${W-padL}" y2="${H-padB}" stroke="${C.grid}"></line>
   <rect x="${W-250}" y="8" width="11" height="11" fill="${C.barPrev}"></rect><text x="${W-233}" y="18" font-size="11" fill="${C.ink2}">Prior period (derived)</text>
   <rect x="${W-250}" y="24" width="11" height="11" fill="${C.blue}"></rect><text x="${W-233}" y="34" font-size="11" fill="${C.ink2}">Current period</text>
   <rect x="${W-120}" y="24" width="11" height="11" fill="${C.red}"></rect><text x="${W-103}" y="34" font-size="11" fill="${C.ink2}">★ brand's bucket</text>
   ${g}</svg>`;
}
function sizingHTML(sub){
 const n=DATA.block2.length;
 return `<div class="mr"><div class="h"><span class="num">3</span>Sizing sub-category + growth HoH<span class="viz">${n} sub-cats (VN) · prior vs current period · ★ = brand's bucket</span></div>
  <div class="body">${sizingSVG(sub)}
   <div class="note">Kỳ trước = GMV kỳ này ÷ (1 + growth) — suy ra từ growth HoH trong Metrics, không phải số đo trực tiếp.</div></div></div>`;
}

/* ---- 3. price range chart + bang price segment ---- */
function priceRangeHTML(){
 const D=DATA.block3.filter(x=>x.pct>=0.02);
 const aov=aovVND();
 let hitIdx=-1;
 if(aov!=null) D.forEach((x,i)=>{const [a,b]=bandRange(x.band); if(aov>=a&&aov<b) hitIdx=i;});
 const W=760,H=300,padL=10,padB=52,padT=40;
 const n=D.length, gw=(W-padL*2)/n, bw=Math.min(40,gw*0.62);
 const mx=Math.max(...D.map(x=>x.pct));
 const y=v=>padT+(H-padT-padB)*(1-v/mx);
 let g='';
 D.forEach((x,i)=>{
  const cx=padL+gw*i+gw/2;
  // bar mac dinh blue; band ma AOV brand roi vao -> red (selected data)
  const bc = i===hitIdx ? C.red : C.blue;
  g+=`<rect x="${cx-bw/2}" y="${y(x.pct)}" width="${bw}" height="${H-padB-y(x.pct)}" fill="${bc}"></rect>
      <text x="${cx}" y="${y(x.pct)-6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${C.ink}">${(x.pct*100).toFixed(1)}%</text>
      <text x="${cx}" y="${H-padB+16}" text-anchor="middle" font-size="9" fill="${i===hitIdx?C.red:C.ink2}" font-weight="${i===hitIdx?'700':'400'}">${bandShort(x.band)}</text>`;
  if(i===hitIdx){
   g+=`<rect x="${cx-gw/2+2}" y="${y(x.pct)-18}" width="${gw-4}" height="${H-padB-y(x.pct)+18}" fill="none" stroke="${C.red}" stroke-width="1.6" rx="3"></rect>
       <text x="${cx}" y="${y(x.pct)-24}" text-anchor="middle" font-size="15" fill="${C.red}">★</text>
       <text x="${cx}" y="${H-padB+34}" text-anchor="middle" font-size="10" font-weight="700" fill="${C.red}">brand's band</text>`;}
 });
 // bang segment: aggregate that tu block3 (H1.2026). FY2025 khong co trong Metrics.
 const segRows=SEG.map(([lb,a,b])=>{
   const p=DATA.block3.filter(x=>{const [s,e]=bandRange(x.band); return s>=a&&e<=b;}).reduce((t,x)=>t+x.pct,0);
   const hl = aov!=null && aov>=a && aov<b;
   return `<tr class="${hl?'hl':''}"><td>${lb}${hl?' ★':''}</td><td>${(p*100).toFixed(1)}%</td></tr>`;}).join('');
 const aovNote = aov==null
   ? `<div class="pnote nodata" style="margin:0 0 10px">Chưa có AOV từ brief → không xác định được phân khúc giá của brand (không có ★ / khung đỏ).</div>`
   : `<div class="note" style="margin:0 0 10px">AOV brand (từ brief): <b>${nfvi(aov)} ${U.vnd}</b>${S.parsed.schema.aov.unit_inferred?' — đơn vị SUY theo độ lớn, cần xác nhận':''}.</div>`;
 return `<div class="mr"><div class="h"><span class="num">4</span>Price Range — % GMV by price band<span class="viz">bar % GMV · ★ = brand's band</span></div>
  <div class="body">${aovNote}
   <div class="two" style="grid-template-columns:1.45fr 1fr">
    <div><div style="font-weight:700;font-size:13px;color:var(--ink);text-align:center;margin-bottom:4px">Price Range · % GMV (H1.2026)</div>
     <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" data-chart="price"><line x1="${padL}" y1="${H-padB}" x2="${W-padL}" y2="${H-padB}" stroke="${C.grid}"></line>${g}</svg></div>
    <div><table class="pstbl"><caption>Price Segment · % GMV</caption>
      <thead><tr><th>Price Segment</th><th>H1 2026</th></tr></thead><tbody>${segRows}</tbody></table>
     <div class="note">Phân khúc giá theo % GMV, kỳ H1.2026 (nguồn Metrics).</div></div>
   </div></div></div>`;
}

/* ---- 4. competitor benchmark (Slide 8) ---- */
function competitorHTML(sub,comp){
 if(!comp) return `<div class="mr"><div class="h"><span class="num">5</span>Competitor Benchmark</div>
   <div class="body"><div class="warnbox">Sub-cat <b>${esc(sub)}</b> chưa có data Kalodata → không dựng được bảng benchmark.</div></div></div>`;
 const t3=comp.top.slice(0,3), s=S.parsed?S.parsed.schema:null;
 const g=myGmvTi();                       // {v, src} — history hoac brief
 const myGmv=g.v;
 const myAov=aovVND();
 const tick=' <span class="lead">✓</span>';
 const fb='<span class="fb">from brief</span>', dash='<span class="fb">—</span>';
 // row helper: vals = [{v:number|null, txt:string}], hi = 'max'|'min'|null
 const row=(label,mine,vals,hi,unit)=>{
   let best=null;
   if(hi==='max') best=Math.max(...vals.filter(v=>v!=null));
   const cells=vals.map(v=>v==null?`<td>${dash}</td>`:
     `<td>${nfvi(v)}${unit?' <span class="tinyu">'+unit+'</span>':''}${v===best?tick:''}</td>`).join('');
   return `<tr><td>${label}</td><td class="you">${mine}</td>${cells}</tr>`;
 };
 let h=`<div class="mr"><div class="h"><span class="num">5</span>Competitor Benchmark<span class="viz">comparison table · Kalodata</span></div>
  <div class="body" style="overflow-x:auto">
  <div class="warnbox">"từ brief" = data brand cần điền · "—" = chưa có data · chỉ số /tháng suy ra từ tổng 365d ÷ 12.</div>
  <table class="cmp"><thead><tr><th>Metrics</th><th class="you">${esc(S.brand.name)} (you)</th>
   ${t3.map((t,i)=>`<th style="background:${CC[i]}">${esc(t.brand)}</th>`).join('')}</tr></thead><tbody>`;
 const aovInf=S.parsed&&S.parsed.schema.aov.unit_inferred;
 h+=row('GMV 365D', myGmv!=null?nfvi(myGmv)+' <span class="tinyu">'+U.bn+'</span><div class="tinyu">'+esc(g.src)+'</div>':fb, t3.map(t=>t.gmv_ti),'max',U.bn);
 h+=row('AOV', myAov!=null?nfvi(Math.round(myAov))+' <span class="tinyu">'+U.vnd+'</span>'+(aovInf?'<div class="tinyu" style="color:var(--red)">brand không ghi đơn vị · mặc định VND</div>':''):fb, t3.map(t=>t.price),'max',U.vnd);
 h+=row('Items Sold', s&&s.sku_count?nfvi(s.sku_count)+' <span class="tinyu">SKU</span>':dash, t3.map(t=>t.item),'max','item');
 // revenue contribution: Kalodata tach Self-operated (Brand) / Affiliated / Shopping Mall (Showcase)
 const rc=t=>`Brand: <b>${(t.seller*100).toFixed(0)}%</b><br>Affiliate: <b>${(t.aff*100).toFixed(0)}%</b><br>Showcase: <b>${(t.mall*100).toFixed(0)}%</b>`;
 h+=`<tr><td>Revenue contribution<div class="tinyu">Brand / Affiliate / Showcase</div></td>
   <td class="you" style="text-align:left">Brand: —<br>Affiliate: —<br>Showcase: —</td>
   ${t3.map(t=>`<td style="text-align:left">${rc(t)}</td>`).join('')}</tr>`;
 h+=row('Influencer / month', fb, t3.map(t=>Math.round(t.creator/12)),'max');
 h+=row('Video / month', fb, t3.map(t=>Math.round(t.video/12)),'max');
 h+=row('Livestream / month', fb, t3.map(t=>Math.round(t.ls/12)),'max');
 h+=row('GMV / Livestream', dash, t3.map(t=>t.gmv_ls),'max',U.M);
 h+=row('Market share sub-cat (%)', dash, t3.map(t=>+(t.share*100).toFixed(1)),'max','%');
 h+=`</tbody></table><div class="note">✓ = chỉ số dẫn đầu trong nhóm so sánh. Followers / Gender / Age: Kalodata không cung cấp → N/A.</div></div></div>`;
 return h;
}

/* ---- 5. Sub-category Sales Strategy (Slide 8: revenue contribution by channel)
   Kalodata tach: Self-operated (Brand) / Affiliated / Shopping Mall (Showcase). */
function salesStrategyHTML(sub,comp){
 if(!comp) return '';
 let sg=0,af=0,ml=0,sl=0; comp.top.forEach(t=>{sg+=t.gmv_ti;af+=t.gmv_ti*t.aff;ml+=t.gmv_ti*t.mall;sl+=t.gmv_ti*t.seller;});
 const rows=[['Brand (self-operated)',C.chBrand,sl/sg,sl],['Affiliated',C.chAff,af/sg,af],['Showcase / Mall',C.chMall,ml/sg,ml]];
 const segs=rows.map(([,c,v])=>({v:v,c:c}));
 const leg=rows.map(([n,c,v,abs])=>
   `<div class="r"><span class="sw" style="background:${c}"></span><span class="nm">${n}</span><span class="pc" style="color:${c}">${(v*100).toFixed(1)}%</span></div>`).join('');
 const bar=svgStack100(rows,'stack100');
 return `<div class="mr"><div class="h"><span class="num">6</span>Sub-category Sales Strategy<span class="viz">revenue contribution by sales channel · Kalodata</span></div>
  <div class="desc">Tổng GMV top-6 brand trong sub-cat ${esc(sub)} = ${nfvi(Math.round(sg))}${U.bn}. Đây là cách sub-cat này đang bán — dùng để chọn chiến lược kênh cho brand.</div>
  <div class="body"><div class="dbody" style="justify-content:flex-start">${donut(segs,nfvi(Math.round(sg))+U.bn,'GMV 365d','donut-channel')}<div class="dleg">${leg}</div></div>
   <div style="border-radius:7px;overflow:hidden;margin-top:12px">${bar}</div></div></div>`;
}

function renderStep3(){
 const b=S.brand, pk=findPrebake();
 const sub = pk? pk.sub : S.sub; S.sub=sub;
 const comp=DATA.competitor[sub], B=DATA.block1;
 let h='';

 /* ---- Slide 6: Market Research ---- */
 h+=`<div class="card">
  ${sheadHTML('Market Research:', esc(sub)+' Sub-Cat', 'Category Health tăng trưởng '+(B.yoy>0?'mạnh':'chậm')+', '+(B.tiktok_share>0.5?'TikTok':'Shopee')+' là kênh dẫn dắt.', sub)}
  <div class="tag">A · MARKET RESEARCH</div>
  <div class="mr"><div class="h"><span class="num">1</span>Overall Category Health<span class="viz">Metrics · Kalodata</span></div>
   <div class="body"><div class="metrics">
    <div class="metric"><div class="k">Health GMV 12M</div><div class="v" style="font-size:22px">${nfvi(B.gmv12_ti)} ${U.bn}</div><div class="s">Shopee + TikTok</div></div>
    <div class="metric"><div class="k">Growth</div><div class="v" style="font-size:22px;color:${pctc(B.yoy)}">${fmtPct(B.yoy)}</div><div class="s">H1.26 vs H1.25</div></div>
    <div class="metric"><div class="k">TikTok share</div><div class="v" style="font-size:22px">${(B.tiktok_share*100).toFixed(1)}%</div><div class="s">H1.2026</div></div>
    <div class="metric"><div class="k">Item sold</div><div class="v" style="font-size:22px">${B.item_h126_tr}${U.M}</div><div class="s">H1.2026</div></div>
   </div></div></div>
  ${channelSplitHTML()}</div>`;

 /* ---- Slide 7: Sizing & Price Range ---- */
 h+=`<div class="card">
  ${sheadHTML('Sizing &amp;','Price Range','Vị trí sub-cat của brand trong ngành và phân khúc giá brand đang rơi vào.','TRAILING 12M · H1 2026')}
  ${sizingHTML(sub)}${priceRangeHTML()}</div>`;

 /* ---- Slide 8: Competitor Benchmark ---- */
 h+=`<div class="card">
  ${sheadHTML('Top-3','Competitor Benchmark','So sánh brand vs 3 đối thủ dẫn đầu sub-cat trên TikTok Shop.','TIKTOK · H1 2026')}
  ${competitorHTML(sub,comp)}${salesStrategyHTML(sub,comp)}</div>`;

 /* ---- AI doc brief + re-pitch delta + verdict ---- */
 h+=aiReadingHTML();
 h+=targetDeltaHTML();
 h+=verdictHTML(pk);

 /* ---- Slide 9: Internal Brand Brief ---- */
 h+=internalBriefHTML();

 /* Export deck GUI CHO BRAND — da loc het noi dung noi bo (pptx_export.js). */
 h+=`<div class="card key" style="margin-bottom:12px">
  <div class="keyhead"><span class="kb">C · Export</span><span class="kt">Brand Proposal Deck</span></div>
  <div class="keysub">Xuất file .pptx theo style OnPoint để gửi brand. Deck <b>chỉ chứa market research, competitor benchmark và growth headroom</b> — đã tự động loại Tier, Commercial Score, Hunt Priority, commercial model, data-quality warning và Internal Brand Brief.</div>
  <div class="btnrow" style="margin-top:10px"><span></span>
   <button class="btn" onclick="exportBrandProposal(this)">Export Brand Proposal (.pptx)</button></div></div>`;
 h+=`<div class="btnrow"><button class="btn ghost" onclick="go(2)">← Back to Step 2</button><span></span></div>`;
 document.getElementById('p3').innerHTML=h; go(3);
}

/* ---- Slide 9: INTERNAL BRAND BRIEF — auto-fill + sua tay ---- */
function ICO(name){
 const p={
  bld:'M3 21V5l6-2v18M9 21V9l6 2v10M15 21V13l6 2v6M3 21h18',
  tgt:'M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 100 10 5 5 0 000-10zm0 4a1 1 0 100 2 1 1 0 000-2',
  cal:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  lnk:'M9 15l6-6M8 8H6a4 4 0 100 8h2M16 8h2a4 4 0 110 8h-2',
  usd:'M12 3v18M9 20h6a3.5 3.5 0 000-7h-3a3.5 3.5 0 010-7h5',
  bar:'M4 20V11M10 20V5M16 20v-7M4 20h16',
  pie:'M12 3v9h9a9 9 0 11-9-9z',
  box:'M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9',
  usr:'M12 11a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  mal:'M3 6h18v12H3zM3 7l9 6 9-6',
  tel:'M6 3h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z'
 }[name]||'';
 return `<span class="ico"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${C.blueD}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg></span>`;
}
function internalBriefHTML(){
 const s=S.parsed?S.parsed.schema:null, b=S.brand, c=contactOf();
 const money=o=>o&&o.value!=null?(nfvi(o.value)+' '+(o.unit||'?')+(o.unit_inferred?' (unit inferred)':'')):'';
 const stores=[b.linkStore, s?s.ecom_platform_store:null].filter(x=>!nz(x)).join(' · ');
 const R=[
  ['bld','Group Brand Name', S.group||b.group||''],
  ['tgt','Target GMV (1 Year)', s?money(s.objective_2627):''],
  ['tgt','Target NMV (1 Year)', ''],
  ['cal','Go-Live Timeline', s?(s.timeline||''):''],
  ['lnk','Link Stores', stores],
  ['usd','AOV', s?money(s.aov):''],
  ['bar','AIV', s?money(s.aiv):''],
  ['pie','Category', S.sub+(S.cat2?' + '+S.cat2:'')],
  ['cal','Historical Sales (Last 365 Days)', s?(money(s.hist_sales_ecom)||s.hist_sales_all||''):(b.nmv12_vnd?nfvi(b.nmv12_vnd)+' VND':'')],
  ['box','Number of SKUs', s&&s.sku_count?String(s.sku_count):''],
  // 4 dong contact point — cung nguon voi Slide 4 & Slide 5
  ['usr','Contact Name', c.name.v||''],
  ['usr','Contact Position', c.position.v||''],
  ['mal','Contact Email', c.email.v||''],
  ['tel','Contact Phone', c.phone.v||'']
 ];
 const filled=R.filter(r=>!nz(r[2])).length;
 return `<div class="ibb" style="margin-bottom:12px">
  <div class="ih">INTERNAL BRAND BRIEF</div>
  <table>${R.map(([ic,k,v])=>`<tr><td class="k">${ICO(ic)}${esc(k)}</td>
    <td class="v"><div class="ed" contenteditable="true" data-ph="chưa có — điền tay">${esc(v)}</div></td></tr>`).join('')}</table></div>
  <div class="ibbbar"><button class="btn ghost sm" onclick="copyIBB(this)">Copy Table</button></div>`;
}
function copyIBB(btn){
 const tbl=document.querySelector('.ibb table');
 const txt=[...tbl.rows].map(r=>r.cells[0].innerText.trim()+'\t'+r.cells[1].innerText.trim()).join('\n');
 navigator.clipboard.writeText(txt).then(()=>{btn.textContent='Copied ✓';setTimeout(()=>btn.textContent='Copy Table',1600);},
   ()=>{btn.textContent='Copy failed';});
}

/* ---- re-pitch: target moi vs quy mo cu ---- */
function targetDeltaHTML(){
 if(!S.found || !S.parsed || S.brand.gmv==null) return '';
 const oldGmv=S.brand.gmv;
 const o=S.parsed.schema.objective_2627;
 const tgtTi=BriefEngine.toBillionVND(o.value,o.unit);
 if(tgtTi==null) return `<div class="card key">
   <div class="keyhead"><span class="kb">Re-pitch</span><span class="kt">New Target vs Historical Scale</span></div>
   <div class="warnbox">Brief chưa nêu rõ mục tiêu doanh thu 2026-2027 → không so sánh được với quy mô cũ (${oldGmv}${U.bn}).</div></div>`;
 const d=(tgtTi-oldGmv)/oldGmv, up=d>=0;
 const col=up?'var(--pos)':'var(--neg)', arrow=up?'▲ UP':'▼ DOWN';
 const imp=up
   ? `Brand nâng tham vọng: mục tiêu cao hơn quy mô cũ ${(d*100).toFixed(0)}%. Re-assess Tier &amp; dựng lộ trình scale-up; kiểm năng lực cung ứng/kho + ngân sách marketing đi kèm.`
   : `Brand hạ mục tiêu ${(Math.abs(d)*100).toFixed(0)}% so với quy mô cũ. Soi lý do (cạnh tranh/margin?); điều chỉnh kỳ vọng GMV &amp; mô hình hợp tác cho phù hợp, tránh over-commit nguồn lực.`;
 return `<div class="card key">
   <div class="keyhead"><span class="kb">Re-pitch</span>
    <span class="kt">New Target vs Historical Scale <span style="color:${col}">${arrow} ${(d>=0?'+':'')+(d*100).toFixed(0)}%</span></span></div>
   <div class="keysub">So sánh target trong brief mới với quy mô đã ghi nhận trong Brand history — cơ sở để re-assess Tier.</div>
   <div class="metrics">
    <div class="metric"><div class="k">Historical scale (Brand history)</div><div class="v">${oldGmv} ${U.bn}</div><div class="s">GMV/năm · ${esc(S.brand.tier||'')}</div></div>
    <div class="metric"><div class="k">Target 2026-2027 (brief)</div><div class="v">${tgtTi.toFixed(0)} ${U.bn}</div><div class="s">${nfvi(o.value)} ${o.unit||''}${o.unit_inferred?' (inferred)':''}</div></div>
    <div class="metric hero"><div class="k">Gap</div><div class="v" style="color:${col}">${(d>=0?'+':'')+(d*100).toFixed(0)}%</div><div class="s" style="color:${col}">${arrow}</div></div>
    <div class="metric"><div class="k">Deal stage</div><div class="v" style="font-size:13px">${esc(S.brand.status||'—')}</div></div>
   </div><div style="font-size:13.5px;color:var(--ink);margin-top:6px">${imp}</div></div>`;
}
function aiReadingHTML(){
 if(!S.parsed) return '';
 const s=S.parsed.schema;
 const mix=Object.keys(s.subcat_mix).slice(0,6).map(k=>esc(k)+': '+s.subcat_mix[k]).join(' · ')||'—';
 const unit=o=>o.value==null?'—':(nfvi(o.value)+' '+(o.unit||'?')+(o.unit_inferred?' <span class="note" style="color:var(--warn)">(inferred)</span>':''));
 const warn = S.parsed.warnings.length? `<div class="warnbox"><b>⚠ Data quality warnings (${S.parsed.warnings.length}):</b><ul>${S.parsed.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:'';
 return `<div class="card"><h3>🤖 What the AI extracted from the brief</h3>
  <table class="cmp" style="font-size:13px">
   <tbody>
   <tr><td>Brand (company intro)</td><td style="text-align:left">${esc((s.company_intro||'—').slice(0,160))}</td></tr>
   <tr><td>AOV / AIV (B2C)</td><td style="text-align:left">${unit(s.aov)} &nbsp;/&nbsp; ${unit(s.aiv)}</td></tr>
   <tr><td>Historical Ecom revenue</td><td style="text-align:left">${unit(s.hist_sales_ecom)} <span class="note">${esc(s.hist_sales_all||'')}</span></td></tr>
   <tr><td>Ecom target 2026-2027</td><td style="text-align:left">${unit(s.objective_2627)}</td></tr>
   <tr><td>SKU / Contribution</td><td style="text-align:left">${s.sku_count} SKU · Σcontribution ${(s.sku_contribution_sum*100).toFixed(0)}%</td></tr>
   <tr><td>Sub-cat mix (SKU)</td><td style="text-align:left">${mix}</td></tr>
   <tr><td>Business model</td><td style="text-align:left">${esc((s.business_model||'—').slice(0,110))}</td></tr>
   <tr><td>Budget · Timeline</td><td style="text-align:left">${esc(s.budget||'—')} · ${esc(s.timeline||'—')}</td></tr>
   </tbody></table>${warn}</div>`;
}

/* do hap dan sub-cat theo Health_Rule_Definition */
function attractiveness(sub){
 if(sub==='Nutrition & Wellness') return {label:'PRIME',pts:3};
 if(sub==='Medical Supplies') return {label:'SOLID',pts:2};
 return {label:'NGÁCH',pts:1};
}
function commercialLive(sub, aovVnd, comp){
 const bk=DATA.block2.filter(x=>x.bucket===sub);
 const gsum=bk.reduce((a,x)=>a+x.gmv_ti,0)||1;
 const grow=bk.reduce((a,x)=>a+x.gmv_ti*x.grow,0)/gsum;
 const A = grow>0.20?3 : grow>0?1.5 : 0;
 const B = attractiveness(sub).pts;
 let affShare=null;
 if(comp){let sg=0,af=0;comp.top.forEach(t=>{sg+=t.gmv_ti;af+=t.gmv_ti*t.aff;});affShare=af/sg;}
 const C = affShare==null?2 : (affShare>0.85?3 : affShare>0.6?2 : 1);
 const D = aovVnd==null?1.5 : (aovVnd>270000?3 : aovVnd>=90000?2 : 1);
 const E=2, F=2;
 const raw = A*0.25 + B*0.15 + C*0.20 + D*0.15 + E*0.15 + F*0.10;
 const score = Math.round(raw/3*100);
 const band = score>=70?'HIGH' : score>=40?'MED' : 'LOW';
 return {score,band,A,B,C,D,affShare,grow,attractive:attractiveness(sub).label};
}
function huntPriority(tier,band){
 if(tier==='ELEPHANT'||tier==='TIER 1') return band==='HIGH'?'P1 — tiếp cận ngay':band==='MED'?'P1/P2 — ưu tiên':'P2 — nurture';
 if(tier==='TIER 2') return band==='HIGH'?'P1 — ưu tiên':band==='MED'?'P2 — qualify':'P3 — watchlist';
 return band==='HIGH'?'P2 — qualify':'P3 — watchlist';
}
function verdictHTML(pk){
 let tier,score,band,prio,model,pos,head,risk,next,tnote,srcTag;
 if(pk){ tier=pk.tier;score=pk.score;band=pk.band;prio=pk.prio;model=pk.model;pos=pk.pos;head=pk.head;risk=pk.risk;next=pk.next;tnote=pk.tierNote;srcTag='Claude + rule Health'; }
 else if(!S.parsed && S.found){ // brand da tiep can, chua upload brief moi -> dung ket luan trong history
  const b=S.brand; srcTag='Brand history';
  tier=b.tier; tnote='GMV annualized ~'+(b.gmv!=null?b.gmv+U.bn+'/year':'—');
  score=b.score; band=b.band; prio=b.prio; model=b.model;
  pos=b.pos; head=b.head; risk=b.risk; next=b.next;
 }
 else {
  srcTag='engine live · rule Health';
  const s=S.parsed?S.parsed.schema:null, sub=S.sub, comp=DATA.competitor[sub];
  const aovVnd = aovVND();
  const ti = s? BriefEngine.toBillionVND(s.hist_sales_ecom.value,s.hist_sales_ecom.unit) : null;
  tier = ti!=null? BriefEngine.classifyTier(ti) : '(pending GMV)';
  tnote = ti!=null? ('doanh thu Ecom ~'+ti.toFixed(1)+U.bn+'/năm') : 'brief chưa có doanh thu Ecom → chưa chấm được cổng doanh thu';
  const cs = commercialLive(sub, aovVnd, comp);
  score=cs.score; band=cs.band; prio=huntPriority(tier==='(pending GMV)'?'TIER 2':tier, band);
  const eco = aovVnd==null?'chưa rõ':(aovVnd>270000?'Premium (>270k)':aovVnd>=90000?'Trung bình (90-270k)':'Thấp (<90k)');
  model = (s&&/distribution|mua đứt|outright/i.test(s.business_model||''))?'Distribution (đề xuất theo brief)':'Service / Consignment (đề xuất)';
  const warns = S.parsed?S.parsed.warnings:[];
  pos=`Brand thuộc <b>${esc(sub)}</b> — độ hấp dẫn ngành <b>${cs.attractive}</b> (growth bucket ${fmtPct(cs.grow)}). Economics theo AOV: <b>${eco}</b>. Tier: <b>${tier}</b> (${tnote}). Commercial Score ${score}/100 (band ${band}).`;
  head = comp
    ? `Sub-cat lệch <b>${(cs.affShare*100).toFixed(0)}% Affiliate</b> → dư địa enabler ở brand-store + Shopee Mall + tăng cadence Livestream. TikTok share ngành cao, còn room content.`
    : `Sub-cat ${esc(sub)} chưa có data Kalodata → dư địa đánh giá qua sizing/price band.`;
  let riskParts=['Compliance G1 (công bố sản phẩm) là cổng cứng với TPCN/TPBVSK trước khi quote','Channel-eligibility G2: nhóm thuốc/nhạy cảm bị hạn chế trên TikTok Shop'];
  if(warns.length) riskParts.push('Data brief: '+warns.length+' cảnh báo (xem panel AI đọc)');
  risk = riskParts.join('. ')+'.';
  let steps=[];
  if(warns.some(w=>/SKU list trống/.test(w))) steps.push('Bổ sung SKU list để dựng assortment/contribution');
  if(warns.some(w=>/Doanh thu Ecom lịch sử rỗng/.test(w))||ti==null) steps.push('Lấy doanh thu Ecom 12 tháng để chốt Tier');
  if(warns.some(w=>/đơn vị/.test(w))) steps.push('Xác nhận đơn vị AOV/mục tiêu (brand không ghi)');
  steps.push('Lấy công bố sản phẩm (G1) trước khi quote');
  steps.push(band==='HIGH'?'Dựng BP theo Rate Card, pitch trong 2 tuần':'Qualify thêm rồi gửi credential + tier deck');
  next = steps.map((x,i)=>(i+1)+') '+x).join(' · ');
 }
 /* Luu ket luan de pptx_export.js doc lai. CHU Y: object nay chua CA field
    noi bo (tier/score/prio/model). pptx_export.js CHI duoc doc head + risk,
    va van phai chay qua scrub() — xem lop 1/2/3 trong pptx_export.js. */
 S.verdict={tier,score,band,prio,model,pos,head,risk,next,srcTag};
 const prioCol=/P1/.test(prio||'')?'var(--red)':/P2/.test(prio||'')?'var(--blue)':'var(--neu)';
 return `<div class="card key">
  <div class="keyhead"><span class="kb">B · Verdict</span><span class="kt">Suggestion &amp; Next Action</span></div>
  <div class="keysub">Kết luận thương mại &amp; việc cần làm tiếp — nguồn: ${esc(srcTag)}.</div>
  <div class="metrics">
   <div class="metric"><div class="k">Tier</div><div class="v" style="color:${tierColor(tier)}">${esc(tier||'—')}</div><div class="s">${esc(tnote||'')}</div></div>
   <div class="metric"><div class="k">Commercial Score</div><div class="v">${score!=null?score:'—'}${band?' · <span style="color:'+bandColor(band)+'">'+esc(band)+'</span>':''}</div></div>
   <div class="metric hero"><div class="k">Hunt Priority</div><div class="v" style="color:${prioCol};font-size:16px">${esc(prio||'—')}</div></div>
   <div class="metric"><div class="k">Model</div><div class="v" style="font-size:13px">${esc(model||'—')}</div></div></div>
  <table class="cmp" style="font-size:13px"><tbody>
   <tr><td style="width:24%">Assessment &amp; positioning</td><td style="text-align:left">${pos||'—'}</td></tr>
   <tr><td>Enabler opportunity (headroom)</td><td style="text-align:left">${head||'—'}</td></tr>
   <tr><td>Risk / compliance</td><td style="text-align:left">${risk||'—'}</td></tr>
   <tr><td>Next action</td><td style="text-align:left">${next||'—'}</td></tr>
   ${S.found&&S.brand.blocker?`<tr><td>Blocker (history)</td><td style="text-align:left">${esc(S.brand.blocker)}</td></tr>`:''}
  </tbody></table></div>`;
}
