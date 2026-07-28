/* ============================================================================
 * OnPoint VA Hub - Brief Engine (in-browser)
 * Port của brief_parser.py + scoring theo Health_Rule_Definition_VN.
 * Chạy được cả trong browser (SheetJS toàn cục `XLSX`) lẫn node (require).
 * Không phụ thuộc mạng. Parse + gate + unit-inference + SKU warning + Tier/Score/P&L.
 * ==========================================================================*/
(function (root) {
  "use strict";

  // ---- rule tham chiếu Health_Rule_Definition_VN ----
  var STD_SHEET = "1. STANDARD BRIEF";
  var ANSWER_COL = 4; // index 0-based cột E (A=0,B=1,C=2,D=3,E=4)
  var ROW_MAP = { // 1-based như Excel; chuyển sang 0-based khi đọc
    company_intro: 10, competitors: 11, top2_objectives: 12, product_brands: 13,
    aov: 14, aiv: 15, usp: 16, promotion_tpr: 17, promotion_ecom: 18,
    ecom_platform_store: 19, hist_sales_all: 20, hist_sales_ecom: 21, paid_media: 22,
    objective_2627: 23, budget: 24, timeline: 25, business_model: 26, contact_point: 27,
    // Template MỚI tách 4 ô riêng (row 27-30). Template CŨ gộp cả 4 vào row 27.
    // Parser đọc cả 2: ưu tiên 4 ô riêng, nếu rỗng thì tách row 27 bằng regex.
    contact_name: 27, contact_position: 28, contact_email: 29, contact_phone: 30
  };
  var MANDATORY = {
    "Product (*)": ["product_brands", "aov", "aiv"],
    "Price (*)": ["aov", "aiv"],
    "Historical Data (*)": ["hist_sales_all", "hist_sales_ecom"],
    "Objectives & KPIs (*)": ["objective_2627"]
  };
  var EMPTY_TOKENS = ["", "-", "--", "n/a", "na", "none", "not yet", "notyet",
    "chưa", "chua", "chưa có", "tbd", "."];

  function isEmpty(v) {
    if (v === null || v === undefined) return true;
    var s = String(v).trim().toLowerCase();
    return EMPTY_TOKENS.indexOf(s) !== -1 || s === "";
  }
  function clean(v) { return (v === null || v === undefined) ? null : String(v).trim(); }

  // bóc số lớn nhất trong chuỗi
  function extractNumber(text) {
    if (text === null || text === undefined) return { value: null, unit: null };
    var s = String(text);
    var matches = s.match(/[\d][\d.,]*\d|\d/g) || [];
    var best = null;
    matches.forEach(function (n) {
      var dots = (n.match(/[.,]/g) || []).length;
      var raw = dots > 1 ? n.replace(/[.,]/g, "") : n.replace(/,/g, "");
      var val = parseFloat(raw);
      if (!isNaN(val) && (best === null || val > best)) best = val;
    });
    var unit = null, low = s.toLowerCase();
    if (low.indexOf("usd") !== -1 || s.indexOf("$") !== -1) unit = "USD";
    else if (low.indexOf("vnđ") !== -1 || low.indexOf("vnd") !== -1 ||
             low.indexOf("đ") !== -1 || low.indexOf("tỉ") !== -1 || low.indexOf("tỷ") !== -1) unit = "VND";
    return { value: best, unit: unit };
  }

  // rule (a): suy đơn vị theo độ lớn khi brand không ghi - CHỈ áp cho DOANH THU / TARGET.
  // Vùng 1e5..1e9 với doanh thu năm thì USD hợp lý ($500k-$2M), nên giữ nguyên.
  function inferCurrency(value) {
    if (value === null || value === undefined) return { unit: null, inferred: false };
    if (value >= 1e9) return { unit: "VND", inferred: true };
    if (value >= 1e5) return { unit: "USD", inferred: true };
    return { unit: null, inferred: false };
  }
  // rule (a2): AOV/AIV KHÔNG dùng rule magnitude ở trên. Xác nhận với Alex 2026-07-26:
  // AOV/AIV không ghi đơn vị -> mặc định VND. Lý do: AOV $405.856 là vô lý với ngành
  // Health VN; 405.856 VND (~$16) mới là cách đọc đúng. Vẫn flag inferred để CD xác nhận.
  function inferCurrencyUnitPrice(value) {
    if (value === null || value === undefined) return { unit: null, inferred: false };
    return { unit: "VND", inferred: true };
  }
  function resolveUnit(value, unit) {
    if (unit !== null) return { unit: unit, inferred: false };
    return inferCurrency(value);
  }
  function resolveUnitPrice(value, unit) {
    if (unit !== null) return { unit: unit, inferred: false };
    return inferCurrencyUnitPrice(value);
  }

  // đọc 1 ô theo tọa độ (rows = mảng mảng từ sheet_to_json header:1)
  function cell(rows, r1based, c0based) {
    var r = rows[r1based - 1];
    if (!r) return null;
    var v = r[c0based];
    return (v === undefined) ? null : v;
  }

  function parseStandard(rows) {
    var raw = {};
    Object.keys(ROW_MAP).forEach(function (k) {
      raw[k] = clean(cell(rows, ROW_MAP[k], ANSWER_COL));
    });
    var aov = extractNumber(raw.aov), aiv = extractNumber(raw.aiv),
        ecom = extractNumber(raw.hist_sales_ecom), tgt = extractNumber(raw.objective_2627);
    // AOV/AIV = đơn giá -> resolveUnitPrice (mặc định VND). Doanh thu/target -> resolveUnit.
    var aovU = resolveUnitPrice(aov.value, aov.unit), aivU = resolveUnitPrice(aiv.value, aiv.unit),
        ecomU = resolveUnit(ecom.value, ecom.unit), tgtU = resolveUnit(tgt.value, tgt.unit);
    raw._derived = {
      aov_value: aov.value, aov_unit: aovU.unit, aov_unit_inferred: aovU.inferred,
      aiv_value: aiv.value, aiv_unit: aivU.unit, aiv_unit_inferred: aivU.inferred,
      hist_ecom_value: ecom.value, hist_ecom_unit: ecomU.unit, hist_ecom_unit_inferred: ecomU.inferred,
      target_2627_value: tgt.value, target_2627_unit: tgtU.unit, target_2627_unit_inferred: tgtU.inferred
    };
    return raw;
  }

  /* ---- Contact point: đọc được CẢ 2 format template -------------------------
     Format MỚI: 4 ô riêng row 27/28/29/30 (Name/Position/Email/Phone).
     Format CŨ : 1 ô gộp row 27, VA gõ "Tên / Chức danh / email / phone".
     Ưu tiên format mới; ô nào rỗng thì lấy từ chuỗi gộp. Trả về source để UI biết
     brief đang dùng template nào.                                              */
  function parseContact(raw) {
    var f = {
      name: isEmpty(raw.contact_name) ? null : clean(raw.contact_name),
      position: isEmpty(raw.contact_position) ? null : clean(raw.contact_position),
      email: isEmpty(raw.contact_email) ? null : clean(raw.contact_email),
      phone: isEmpty(raw.contact_phone) ? null : clean(raw.contact_phone)
    };
    var splitCount = (f.position ? 1 : 0) + (f.email ? 1 : 0) + (f.phone ? 1 : 0);
    var source = splitCount > 0 ? "4-cell" : (f.name ? "merged" : "empty");
    // nếu chỉ có row 27 (template cũ) -> tách chuỗi
    if (splitCount === 0 && f.name) {
      var s = String(f.name);
      var em = s.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
      var ph = s.match(/(?:\+?84|0)\d[\d\s.\-]{7,}\d/);
      f.email = em ? em[0] : null;
      f.phone = ph ? ph[0] : null;
      var rest = s.replace(em ? em[0] : "", "").replace(ph ? ph[0] : "", "");
      var parts = rest.split(/[\/,;|\n·–-]+/).map(function (x) { return x.trim(); })
                      .filter(function (x) { return x.length > 1; });
      f.name = parts[0] || null;
      f.position = parts[1] || null;
    }
    f.source = source;
    f.filled = ["name", "position", "email", "phone"]
      .filter(function (k) { return !isEmpty(f[k]); }).length;
    return f;
  }

  function findSkuHeaderRow(rows) {
    for (var r = 0; r < Math.min(rows.length, 15); r++) {
      var vals = (rows[r] || []).slice(0, 7).map(function (v) {
        return v ? String(v).trim().toLowerCase() : "";
      });
      if (vals.indexOf("product group") !== -1 && vals.indexOf("sku") !== -1) return r + 1;
    }
    return 3;
  }

  function parseSkuList(rows) {
    if (!rows || !rows.length) return { sku_count: 0, contribution_sum: 0, subcat_mix: {}, header_row: null };
    var hdr = findSkuHeaderRow(rows), cnt = 0, contrib = 0, subcats = {};
    for (var r = hdr; r < rows.length; r++) { // hdr(1-based) => data từ index hdr
      var row = rows[r] || [];
      var grp = row[0], sub = row[1], sku = row[2], c = row[6];
      if (sku === undefined || sku === null || sku === "" ||
          grp === undefined || grp === null || grp === "") continue;
      if (String(sub).trim().toUpperCase() === "SUB-CATE") continue;
      cnt++;
      var cv = parseFloat(c); if (!isNaN(cv)) contrib += cv;
      var key = (sub !== undefined && sub !== null && sub !== "") ? String(sub).trim() : "(unknown)";
      subcats[key] = (subcats[key] || 0) + 1;
    }
    return { sku_count: cnt, contribution_sum: Math.round(contrib * 10000) / 10000, subcat_mix: subcats, header_row: hdr };
  }

  function parseWarehouse(rows) {
    if (!rows) return { filled_answers: 0 };
    var filled = 0;
    for (var r = 2; r < Math.min(rows.length, 200); r++) {
      var v = (rows[r] || [])[2]; // cột C
      if (v !== undefined && v !== null && v !== "") filled++;
    }
    return { filled_answers: filled };
  }

  function runGate(raw) {
    var missing = [], detail = {};
    Object.keys(MANDATORY).forEach(function (label) {
      var has = MANDATORY[label].some(function (k) { return !isEmpty(raw[k]); });
      detail[label] = has ? "OK" : "MISSING";
      if (!has) missing.push(label);
    });
    return { briefValid: missing.length === 0, missing: missing, detail: detail };
  }

  function buildWarnings(raw, sku, d) {
    var w = [];
    if (sku.sku_count === 0)
      w.push("SKU list trống (0 SKU) - không tính được assortment/contribution/P&L. Một số brand không có SKU list nên chỉ cảnh báo.");
    if (sku.sku_count > 0 && Math.abs(sku.contribution_sum - 1) > 0.05)
      w.push("Tổng contribution SKU = " + sku.contribution_sum + " (khác 100% >5%) - kiểm tra cột Contribution NMV.");
    if (isEmpty(raw.hist_sales_ecom))
      w.push("Doanh thu Ecom lịch sử rỗng - gate chỉ pass nhờ 'size of business'. Thiếu số Ecom cụ thể để tính headroom.");
    // isPrice = AOV/AIV (mặc định VND) vs doanh thu/target (suy theo độ lớn)
    [["Mục tiêu 2026-2027", "target_2627", false], ["AOV", "aov", true],
     ["AIV", "aiv", true], ["Doanh thu Ecom", "hist_ecom", false]]
      .forEach(function (p) {
        var label = p[0], key = p[1], isPrice = p[2];
        if (d[key + "_unit_inferred"]) {
          w.push(isPrice
            ? label + ": brand không ghi đơn vị - MẶC ĐỊNH hiểu là VND (" + Number(d[key + "_value"]).toLocaleString("vi") + " đ). Cần xác nhận nếu brand ý là USD."
            : label + ": đơn vị '" + d[key + "_unit"] + "' được SUY theo độ lớn (brand không ghi) - cần xác nhận.");
        }
        else if (d[key + "_value"] !== null && d[key + "_unit"] === null)
          w.push(label + ": có số nhưng không xác định được đơn vị (<100k) - cần brand ghi rõ.");
      });
    return w;
  }

  // ---- SCORING theo Health_Rule_Definition_VN ----
  // Tier theo annualized GMV (tỉ VND): ELEPHANT>=60, TIER1 30-60, TIER2 15-30, TIER3 <15
  function classifyTier(gmvTi) {
    if (gmvTi === null || gmvTi === undefined || isNaN(gmvTi)) return null;
    if (gmvTi >= 60) return "ELEPHANT";
    if (gmvTi >= 30) return "TIER 1";
    if (gmvTi >= 15) return "TIER 2";
    return "TIER 3";
  }
  // đổi doanh thu Ecom (raw value+unit) sang tỉ VND
  function toBillionVND(value, unit, usdVnd) {
    if (value === null || value === undefined) return null;
    var rate = usdVnd || 25000;
    var vnd = unit === "USD" ? value * rate : value;
    return vnd / 1e9;
  }
  // Commercial economics factor D từ AOV (VND)
  function economicsBand(aovVnd) {
    if (aovVnd === null) return { pts: 0, label: "N/A" };
    if (aovVnd > 270000) return { pts: 3, label: "Premium (>270k)" };
    if (aovVnd >= 90000) return { pts: 2, label: "Trung bình (90-270k)" };
    return { pts: 1, label: "Thấp (<90k)" };
  }

  // ---- entrypoint browser: từ ArrayBuffer ----
  function parseWorkbookObject(wb) {
    function sheetRows(name, maxRows) {
      var ws = wb.Sheets[name];
      if (!ws) return null;
      maxRows = maxRows || 3000; // cắt dòng ma (một số file có hàng trăm nghìn dòng định dạng thừa)
      var opt = { header: 1, blankrows: true, defval: null };
      if (ws["!ref"]) {
        var rng = XLSX.utils.decode_range(ws["!ref"]);
        // ÉP gốc vùng về A1 => index dòng/cột tuyệt đối theo Excel (rows[N-1] = dòng N).
        // Nếu không, file resave có !ref bắt đầu A2/A3 sẽ làm lệch ROW_MAP.
        rng.s.r = 0; rng.s.c = 0;
        if (rng.e.r > maxRows) rng.e.r = maxRows; // cắt dòng ma
        opt.range = XLSX.utils.encode_range(rng);
      }
      return XLSX.utils.sheet_to_json(ws, opt);
    }
    // tìm tên sheet linh hoạt
    var names = wb.SheetNames;
    var stdName = names.find(function (n) { return n.trim().toLowerCase().indexOf("standard brief") !== -1; }) || STD_SHEET;
    var whName = names.find(function (n) { return n.trim().toLowerCase().indexOf("warehouse") !== -1; });
    var skuName = names.find(function (n) { return n.trim().toLowerCase().indexOf("sku list") !== -1; });

    var stdRows = sheetRows(stdName) || [];
    var skuRows = skuName ? sheetRows(skuName) : [];
    var whRows = whName ? sheetRows(whName) : [];

    var raw = parseStandard(stdRows);
    var sku = parseSkuList(skuRows);
    var wh = parseWarehouse(whRows);
    var gate = runGate(raw);
    var d = raw._derived;
    var warnings = buildWarnings(raw, sku, d);

    return {
      brief_valid: gate.briefValid,
      gate: gate,
      warnings: warnings,
      schema: {
        company_intro: raw.company_intro, competitors: raw.competitors,
        top2_objectives: raw.top2_objectives, usp: raw.usp,
        // product_brands + promotion_tpr: can cho luoi gate 14 truong (Slide 4)
        product_brands: raw.product_brands, promotion_tpr: raw.promotion_tpr,
        promotion_ecom: raw.promotion_ecom,
        aov: { raw: raw.aov, value: d.aov_value, unit: d.aov_unit, unit_inferred: d.aov_unit_inferred },
        aiv: { raw: raw.aiv, value: d.aiv_value, unit: d.aiv_unit, unit_inferred: d.aiv_unit_inferred },
        hist_sales_all: raw.hist_sales_all,
        hist_sales_ecom: { raw: raw.hist_sales_ecom, value: d.hist_ecom_value, unit: d.hist_ecom_unit, unit_inferred: d.hist_ecom_unit_inferred },
        objective_2627: { raw: raw.objective_2627, value: d.target_2627_value, unit: d.target_2627_unit, unit_inferred: d.target_2627_unit_inferred },
        budget: raw.budget, timeline: raw.timeline, business_model: raw.business_model,
        paid_media: raw.paid_media, ecom_platform_store: raw.ecom_platform_store, contact_point: raw.contact_point,
        contact: parseContact(raw),   // {name,position,email,phone,source,filled}
        sku_count: sku.sku_count, sku_contribution_sum: sku.contribution_sum,
        subcat_mix: sku.subcat_mix, warehouse_filled_answers: wh.filled_answers
      }
    };
  }

  var API = {
    parseArrayBuffer: function (ab) {
      var wb = XLSX.read(ab, { type: "array" });
      return parseWorkbookObject(wb);
    },
    parseWorkbookObject: parseWorkbookObject,
    classifyTier: classifyTier,
    toBillionVND: toBillionVND,
    economicsBand: economicsBand,
    _internal: { parseStandard: parseStandard, parseSkuList: parseSkuList, runGate: runGate,
                 parseContact: parseContact }
  };

  // export
  if (typeof module !== "undefined" && module.exports) {
    // node: cần global XLSX
    root.BriefEngine = API; module.exports = API;
  } else {
    root.BriefEngine = API;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
