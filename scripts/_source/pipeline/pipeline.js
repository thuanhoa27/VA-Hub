/*
  pipeline.js
  Vanilla JS only. No React/JSX/TypeScript/bundler/import-export.
  Exposes exactly one global: window.PipelineTracker, with:
    PipelineTracker.mount(rootEl, data)   - render into rootEl
    PipelineTracker.unmount()             - remove listeners/timers/chart instances
    PipelineTracker.setData(data)         - load new data and re-render
  Nothing runs at load time — no DOMContentLoaded/onload/top-level init calls.
  All DOM lookups are scoped to the rootEl passed into mount(), not `document`,
  except the two things the constraints explicitly call out as acceptable to
  attach to window: a single `resize` listener (removed in unmount) and the
  window.PipelineTracker global itself.

  Optional peer libraries (loaded by the HOST page, not by this file):
    - echarts   (https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js)
                used for the two charts. If window.echarts is missing at mount
                time, charts are skipped (console.warn) and the rest of the
                dashboard still works.
    - ExcelJS   (https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js)
                used only for the "Export Excel" button. If window.ExcelJS is
                missing, the button is disabled with an explanatory title.
  See README-MERGE.md for exact versions/URLs and the host-app vendoring note.
*/
(function () {
  'use strict';

  /* ============================================================
     Module-private state (nothing here touches `window` directly)
     ============================================================ */
  var rootEl = null;
  var deals = [];               // current dataset, set via mount()/setData()
  var VALID = {};                // current validation/dropdown lists
  var OFFICIAL_KPI = null;       // data._meta.officialKpi — xem updateKPIs() ve che do hybrid
  var chart1 = null;
  var chart2 = null;
  var boundListeners = [];       // [{el, type, handler}] added during mount, removed on unmount/cleanup
  var resizeHandler = null;      // the one window-level listener we're allowed to add
  var mounted = false;

  var monthsOrder = [1, 2, 3, 4, 5, 6, 7];
  var stageCats = ['Go Live', 'Verbal / Onboarding', 'Potential'];
  var stageColors = ['#2E7D32', '#1F3864', '#E97132']; // matches table header colors

  /* ============================================================
     Small helpers (pure functions, no DOM/global side effects)
     ============================================================ */
  function fmtBil(vnd) {
    return (vnd / 1e9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BIL';
  }
  function fmtUSDBil(usd) {
    return '$' + (usd / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'M';
  }
  function fmtUSD(n) { return '$' + n.toLocaleString('en-US'); }
  function fmtVND(n) { return n.toLocaleString('en-US'); }
  function plStatusClass(s) { return 'pl-status-' + String(s).replace(/\s+/g, '-'); }
  function norm(s) { return (s || '').toString().trim().toLowerCase(); }
  function monthLabel(m) { return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][m] || String(m); }

  // brand_key = brand name, lowercased, Vietnamese diacritics stripped, [a-z0-9] only.
  // Exposed for reuse (see mount/setData) and documented in SCHEMA.md.
  function toBrandKey(str) {
    if (!str) return '';
    var s = String(str).toLowerCase();
    s = s.replace(/đ/g, 'd');
    try {
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) { /* normalize not supported: fall through with best-effort ascii */ }
    s = s.replace(/[^a-z0-9]/g, '');
    return s;
  }

  function normalizeDeals(rawDeals) {
    return (rawDeals || []).map(function (d) {
      var copy = {};
      for (var k in d) { if (Object.prototype.hasOwnProperty.call(d, k)) copy[k] = d[k]; }
      if (!copy.brand_key) copy.brand_key = toBrandKey(copy.brand);
      if (copy.dateISO === undefined) copy.dateISO = null;
      return copy;
    });
  }

  /* ============================================================
     Scoped DOM helpers — always relative to rootEl, never `document`
     ============================================================ */
  function qs(sel) { return rootEl ? rootEl.querySelector(sel) : null; }
  function qsa(sel) { return rootEl ? rootEl.querySelectorAll(sel) : []; }
  function byId(id) { return qs('#' + id); }

  function on(el, type, handler) {
    if (!el) return;
    el.addEventListener(type, handler);
    boundListeners.push({ el: el, type: type, handler: handler });
  }

  /* ============================================================
     Time filter helpers (Day / Week / Month)
     ============================================================ */
  function isoToDate(iso) { return new Date(iso + 'T00:00:00'); }
  function mondayOf(iso) {
    var dt = isoToDate(iso);
    var dow = dt.getDay(); // 0=Sun..6=Sat
    var diff = (dow === 0 ? -6 : 1 - dow);
    var mon = new Date(dt); mon.setDate(dt.getDate() + diff);
    return mon;
  }
  function fmtShort(dt) { return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

  function inTimeRange(d) {
    var modeEl = byId('pl-f-time-mode');
    var mode = modeEl ? modeEl.value : 'all';
    if (mode === 'all') return true;
    if (mode === 'month') {
      var mVal = byId('pl-f-time-month').value; // 'YYYY-MM'
      if (!mVal) return true;
      var m = Number(mVal.split('-')[1]);
      // Month view uses the business "Lived / Expected Lived Month" field, so
      // it still matches deals whose exact date is TBU.
      return d.month === m;
    }
    // Day / Week views need an exact date - rows with date = "TBU" have none
    // and are excluded (there's no calendar day to place them on yet).
    if (!d.dateISO) return false;
    var dVal = byId('pl-f-time-day').value; // 'YYYY-MM-DD'
    if (!dVal) return true;
    if (mode === 'day') return d.dateISO === dVal;
    if (mode === 'week') {
      var mon = mondayOf(dVal);
      var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      var dDate = isoToDate(d.dateISO);
      return dDate >= mon && dDate <= sun;
    }
    return true;
  }

  function updateTimeRangeNote() {
    var mode = byId('pl-f-time-mode').value;
    var note = byId('pl-time-range-note');
    if (!note) return;
    if (mode === 'week') {
      var val = byId('pl-f-time-day').value;
      if (val) {
        var mon = mondayOf(val);
        var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
        note.textContent = 'Showing week: ' + fmtShort(mon) + ' \u2013 ' + fmtShort(sun) +
          ', 2026 (rows with no confirmed date/"TBU" are excluded in Day/Week view).';
        return;
      }
    }
    if (mode === 'day' || mode === 'week') {
      note.textContent = 'Pick a date above to see only deals landing on that day/week ("TBU" rows are excluded until they get a confirmed date).';
      return;
    }
    note.textContent = '';
  }

  /**
   * Doc va validate data._meta.officialKpi.
   *
   * Tra ve null neu thieu hoac sai kieu -> updateKPIs() tu dong roi ve che do
   * tinh tu rows. Fail-safe co y: neu business xoa/lam hong block nay thi
   * dashboard van chay va hien so tinh duoc, khong bao gio hien "NaN"/"-".
   */
  function readOfficialKpi(data) {
    var raw = data && data._meta && data._meta.officialKpi;
    if (!raw || typeof raw !== 'object') return null;
    var required = ['totalNmvVnd', 'goLiveNmvVnd', 'brandGoLive', 'brandVerbal', 'brandPotential'];
    for (var i = 0; i < required.length; i++) {
      var v = raw[required[i]];
      if (typeof v !== 'number' || !isFinite(v)) {
        console.warn('[PipelineTracker] _meta.officialKpi.' + required[i] +
          ' thieu hoac khong phai so — KPI se tinh tu cac dong deal.');
        return null;
      }
    }
    return raw;
  }

  /* ============================================================
     Filtering
     ============================================================ */

  /**
   * Co bat ky filter nao dang active khong?
   *
   * Dung de quyet dinh che do KPI (official vs computed) — xem updateKPIs().
   * Luu y: mode thoi gian 'day'/'week' duoc coi la CO filter ngay ca khi o input
   * ngay con trong, vi 2 mode nay tu dong loai cac dong co date = "TBU".
   */
  function isFiltered() {
    var i, el;
    for (i = 0; i < FILTER_IDS.length; i++) {
      el = byId(FILTER_IDS[i]);
      if (el && el.value !== 'all') return true;
    }
    el = byId('pl-f-search');
    if (el && norm(el.value) !== '') return true;
    el = byId('pl-f-time-mode');
    if (el && el.value !== 'all') return true;
    return false;
  }

  function getFilteredDeals() {
    var stage = byId('pl-f-stage').value;
    var tier = byId('pl-f-tier').value;
    var cd = byId('pl-f-cd').value;
    var cat = byId('pl-f-cat').value;
    var va = byId('pl-f-va').value;
    var channel = byId('pl-f-channel').value;
    var status = byId('pl-f-status').value;
    var elephant = byId('pl-f-elephant').value;
    var search = norm(byId('pl-f-search').value);

    return deals.filter(function (d) {
      if (stage !== 'all' && d.stage !== stage) return false;
      if (tier !== 'all' && norm(d.tier) !== norm(tier)) return false;
      if (cd !== 'all' && norm(d.cd) !== norm(cd)) return false;
      if (cat !== 'all' && norm(d.cat) !== norm(cat)) return false;
      if (va !== 'all' && norm(d.va) !== norm(va)) return false;
      // Channel in the deal table can combine several validation values
      // (e.g. "SHP & TTS"), so match if the selected channel is a token of it.
      if (channel !== 'all' && norm(d.channel).indexOf(norm(channel)) === -1) return false;
      if (status !== 'all' && norm(d.status) !== norm(status)) return false;
      if (elephant !== 'all' && norm(d.elephant) !== norm(elephant)) return false;
      if (!inTimeRange(d)) return false;
      if (search) {
        var hay = norm(d.brand + ' ' + d.cd + ' ' + d.va + ' ' + d.cat);
        if (hay.indexOf(search) === -1) return false;
      }
      return true;
    });
  }

  /* ============================================================
     Rendering: tables / KPIs / charts
     ============================================================ */
  function renderTables(filtered) {
    var groups = { 'Go Live': '#pl-tbl-go-live tbody', 'Verbal': '#pl-tbl-verbal tbody', 'Potential': '#pl-tbl-potential tbody' };
    Object.keys(groups).forEach(function (stage) {
      var tbody = qs(groups[stage]);
      if (!tbody) return;
      var rows = filtered.filter(function (d) { return d.stage === stage; });
      if (rows.length === 0) {
        tbody.innerHTML = '<tr class="pl-tr pl-empty-row"><td class="pl-td" colspan="14">No deals match the current filters</td></tr>';
        return;
      }
      tbody.innerHTML = rows.map(function (d) {
        return '' +
          '<tr class="pl-tr">' +
          '<td class="pl-td">' + d.no + '</td><td class="pl-td">' + d.brand + '</td><td class="pl-td">' + d.tier + '</td><td class="pl-td">' + d.model + '</td>' +
          '<td class="pl-td">' + d.cd + '</td><td class="pl-td">' + d.elephant + '</td><td class="pl-td">' + d.cat + '</td><td class="pl-td">' + d.va + '</td><td class="pl-td">' + d.channel + '</td>' +
          '<td class="pl-td pl-status-pill ' + plStatusClass(d.status) + '">' + d.status + '</td>' +
          '<td class="pl-td">' + d.month + '</td><td class="pl-td">' + d.date + '</td>' +
          '<td class="pl-td pl-num">' + fmtUSD(d.usd) + '</td><td class="pl-td pl-num">' + fmtVND(d.vnd) + '</td>' +
          '</tr>';
      }).join('');
    });
  }

  /**
   * KPI hybrid \u2014 2 che do.
   *
   * TAI SAO: header cua source workbook ghi so "official" (34 BIL, Go Live 5 brand)
   * lech han voi tong cac dong deal thuc te trong sheet (193 BIL, Go Live 2 dong)
   * \u2014 header la so cua ky truoc hoac dem theo scope khac. Business muon KPI card
   * khop voi con so official ho dang bao cao, nhung neu hardcode cung thi card se
   * dung yen khi bam filter -> bo filter tro nen gay nham lan.
   *
   * Nen:
   *   - Chua filter gi  -> hien OFFICIAL (data._meta.officialKpi), badge "Official"
   *   - Co filter active -> hien so TINH TU ROWS, badge "Filtered"
   *
   * So official KHONG hardcode o day \u2014 doc tu pipeline.json de business tu sua.
   */
  function updateKPIs(filtered) {
    var nmvFC = filtered.reduce(function (s, d) { return s + d.vnd; }, 0);
    var nmvFCUsd = filtered.reduce(function (s, d) { return s + d.usd; }, 0);
    var goLiveRows = filtered.filter(function (d) { return d.stage === 'Go Live'; });
    var verbalRows = filtered.filter(function (d) { return d.stage === 'Verbal'; });
    var potentialRows = filtered.filter(function (d) { return d.stage === 'Potential'; });
    var nmvGoLive = goLiveRows.reduce(function (s, d) { return s + d.vnd; }, 0);

    // Che do official chi ap dung khi khong co filter nao va co du lieu officialKpi.
    var useOfficial = !isFiltered() && OFFICIAL_KPI !== null;

    var vFc = useOfficial ? fmtBil(OFFICIAL_KPI.totalNmvVnd) : fmtBil(nmvFC);
    var vFcUsd = useOfficial && typeof OFFICIAL_KPI.totalNmvUsd === 'number'
      ? fmtUSDBil(OFFICIAL_KPI.totalNmvUsd)
      : fmtUSDBil(nmvFCUsd); // workbook header khong co o USD -> luon tinh tu rows
    var vGl = useOfficial ? fmtBil(OFFICIAL_KPI.goLiveNmvVnd) : fmtBil(nmvGoLive);
    var vGlCount = useOfficial ? OFFICIAL_KPI.brandGoLive : goLiveRows.length;
    var vVbCount = useOfficial ? OFFICIAL_KPI.brandVerbal : verbalRows.length;
    var vPtCount = useOfficial ? OFFICIAL_KPI.brandPotential : potentialRows.length;

    var elFc = byId('pl-kpi-nmv-fc'); if (elFc) elFc.textContent = vFc;
    var elFcUsd = byId('pl-kpi-nmv-fc-usd'); if (elFcUsd) elFcUsd.textContent = vFcUsd;
    var elGl = byId('pl-kpi-nmv-golive'); if (elGl) elGl.textContent = vGl;
    var elGlCount = byId('pl-kpi-golive'); if (elGlCount) elGlCount.textContent = vGlCount;
    var elVbCount = byId('pl-kpi-verbal'); if (elVbCount) elVbCount.textContent = vVbCount;
    var elPtCount = byId('pl-kpi-potential'); if (elPtCount) elPtCount.textContent = vPtCount;

    // Badge che do \u2014 bat buoc phai co, neu khong nguoi xem khong biet so tu dau ra.
    var modeEl = byId('pl-kpi-mode');
    if (modeEl) {
      modeEl.classList.remove('pl-kpi-mode-official', 'pl-kpi-mode-filtered');
      if (useOfficial) {
        modeEl.classList.add('pl-kpi-mode-official');
        modeEl.textContent = 'Official figures per source workbook'
          + (OFFICIAL_KPI.as_of ? ' \u00b7 as of ' + OFFICIAL_KPI.as_of : '')
          + ' \u2014 apply any filter to switch to figures computed from the rows below';
      } else if (OFFICIAL_KPI !== null) {
        modeEl.classList.add('pl-kpi-mode-filtered');
        modeEl.textContent = 'Filtered \u00b7 computed from ' + filtered.length + ' of ' + deals.length
          + ' rows below \u2014 reset all filters to see the official workbook figures';
      } else {
        modeEl.classList.add('pl-kpi-mode-filtered');
        modeEl.textContent = 'Computed from ' + filtered.length + ' of ' + deals.length + ' rows below';
      }
    }

    // Breakdown note luon la so TINH TU ROWS \u2014 day la cho de doi chieu voi official.
    var note = byId('pl-kpi-breakdown-note');
    if (note) {
      note.textContent = 'Computed from rows \u2014 Total NMV FC 2026: ' + fmtBil(nmvFC) + ' VND (' + fmtUSDBil(nmvFCUsd) + ') \u2014 Go Live ' + fmtBil(nmvGoLive) +
        ' \u00b7 Verbal ' + fmtBil(verbalRows.reduce(function (s, d) { return s + d.vnd; }, 0)) +
        ' \u00b7 Potential ' + fmtBil(potentialRows.reduce(function (s, d) { return s + d.vnd; }, 0)) +
        (filtered.length !== deals.length ? '  (based on current filter selection)' : '');
    }
  }

  function sumByMonth(rows, stageFilter, field, divisor) {
    var map = {};
    monthsOrder.forEach(function (m) { map[m] = 0; });
    rows.filter(stageFilter).forEach(function (d) { map[d.month] += d[field] / divisor; });
    return monthsOrder.map(function (m) { return Math.round(map[m] * 100) / 100; });
  }

  function updateChart1(filtered) {
    if (!chart1) return;
    var confirmedVnd = sumByMonth(filtered, function (d) { return d.stage === 'Go Live'; }, 'vnd', 1e6);
    var pipelineVnd = sumByMonth(filtered, function (d) { return d.stage !== 'Go Live'; }, 'vnd', 1e6);
    var confirmedUsd = sumByMonth(filtered, function (d) { return d.stage === 'Go Live'; }, 'usd', 1e3);
    var pipelineUsd = sumByMonth(filtered, function (d) { return d.stage !== 'Go Live'; }, 'usd', 1e3);
    chart1.setOption({
      series: [
        { name: 'Confirmed NMV (Go Live) \u2014 VND', data: confirmedVnd },
        { name: 'Pipeline NMV (Verbal + Potential) \u2014 VND', data: pipelineVnd },
        { name: 'Confirmed NMV (Go Live) \u2014 USD', data: confirmedUsd },
        { name: 'Pipeline NMV (Verbal + Potential) \u2014 USD', data: pipelineUsd }
      ]
    });
  }

  function updateChart2(filtered) {
    if (!chart2) return;
    var counts = [
      filtered.filter(function (d) { return d.stage === 'Go Live'; }).length,
      filtered.filter(function (d) { return d.stage === 'Verbal'; }).length,
      filtered.filter(function (d) { return d.stage === 'Potential'; }).length
    ];
    chart2.setOption({ series: [{ data: counts.map(function (v, i) { return { value: v, itemStyle: { color: stageColors[i] } }; }) }] });
  }

  function initCharts() {
    if (typeof window.echarts === 'undefined') {
      console.warn('PipelineTracker: window.echarts not found — charts will be skipped. ' +
        'Load echarts before calling PipelineTracker.mount() if you want charts. See README-MERGE.md.');
      chart1 = null; chart2 = null;
      return;
    }
    var el1 = byId('pl-chart1');
    var el2 = byId('pl-chart2');
    if (el1) {
      chart1 = window.echarts.init(el1);
      chart1.setOption({
        title: { text: 'Confirmed vs Pipeline NMV \u2014 by Month 2026', left: 'center', top: 6, textStyle: { fontSize: 13, fontWeight: 600 } },
        tooltip: {
          trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: function (params) {
            var out = params[0].axisValueLabel + '<br/>';
            params.forEach(function (p) {
              var isUsd = p.seriesName.indexOf('USD') !== -1;
              var val = isUsd ? ('$' + p.value.toLocaleString('en-US') + 'K') : (p.value.toLocaleString('en-US') + ' M VND');
              out += p.marker + ' ' + p.seriesName + ': <b>' + val + '</b><br/>';
            });
            return out;
          }
        },
        legend: { bottom: 0, type: 'scroll', data: ['Confirmed NMV (Go Live) \u2014 VND', 'Pipeline NMV (Verbal + Potential) \u2014 VND', 'Confirmed NMV (Go Live) \u2014 USD', 'Pipeline NMV (Verbal + Potential) \u2014 USD'] },
        grid: { left: 60, right: 60, top: 46, bottom: 56 },
        xAxis: { type: 'category', data: monthsOrder.map(monthLabel), axisTick: { show: false } },
        yAxis: [
          { type: 'value', name: 'Mil VND', axisLabel: { formatter: function (v) { return (v / 1000).toFixed(0) + 'k'; } } },
          { type: 'value', name: 'USD ($K)', axisLabel: { formatter: function (v) { return '$' + v.toLocaleString('en-US'); } }, splitLine: { show: false } }
        ],
        series: [
          { name: 'Confirmed NMV (Go Live) \u2014 VND', type: 'bar', data: [], itemStyle: { color: '#898781' }, barGap: '20%' },
          { name: 'Pipeline NMV (Verbal + Potential) \u2014 VND', type: 'bar', data: [], itemStyle: { color: '#2A78D6' } },
          { name: 'Confirmed NMV (Go Live) \u2014 USD', type: 'bar', yAxisIndex: 1, data: [], itemStyle: { color: '#2E7D32' } },
          { name: 'Pipeline NMV (Verbal + Potential) \u2014 USD', type: 'bar', yAxisIndex: 1, data: [], itemStyle: { color: '#E97132' } }
        ],
        animationDuration: 600
      });
    }
    if (el2) {
      chart2 = window.echarts.init(el2);
      chart2.setOption({
        title: { text: 'Brand Count \u2014 by Deal Stage', left: 'center', top: 6, textStyle: { fontSize: 13, fontWeight: 600 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: function (v) { return v + ' brand' + (v === 1 ? '' : 's'); } },
        grid: { left: 50, right: 30, top: 46, bottom: 20 },
        xAxis: { type: 'category', data: stageCats, axisTick: { show: false } },
        yAxis: { type: 'value', name: 'Brands', minInterval: 1 },
        series: [{ name: 'Brand Count', type: 'bar', data: [], barWidth: '42%', label: { show: true, position: 'top', fontWeight: 700 }, itemStyle: { borderRadius: [6, 6, 0, 0] } }],
        animationDuration: 600
      });
    }
    resizeHandler = function () { if (chart1) chart1.resize(); if (chart2) chart2.resize(); };
    window.addEventListener('resize', resizeHandler);
  }

  /* ============================================================
     Filter dropdown population
     ============================================================ */
  function populateSelect(id, options) {
    var sel = byId(id);
    if (!sel) return;
    // Keep only the first ("All") option, drop anything added by a previous mount/setData.
    while (sel.options.length > 1) sel.remove(1);
    (options || []).forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function populateAllSelects() {
    populateSelect('pl-f-tier', VALID.tier);
    populateSelect('pl-f-cd', VALID.cd);
    populateSelect('pl-f-cat', VALID.cat);
    populateSelect('pl-f-va', VALID.vaName);
    populateSelect('pl-f-channel', VALID.channel);
    populateSelect('pl-f-status', VALID.status);
    populateSelect('pl-f-elephant', VALID.elephant);
  }

  /* ============================================================
     Export to Excel (guarded — needs window.ExcelJS from the host page)
     ============================================================ */
  function exportToExcel() {
    var btn = byId('pl-f-export');
    if (typeof window.ExcelJS === 'undefined') {
      alert('Export unavailable: the ExcelJS library is not loaded on this page. See README-MERGE.md.');
      return;
    }
    var oldLabel = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '\u23f3 Exporting...'; btn.disabled = true; }

    var finish = function () { if (btn) { btn.textContent = oldLabel; btn.disabled = false; } };

    try {
      var filtered = getFilteredDeals();
      var goLive = filtered.filter(function (d) { return d.stage === 'Go Live'; });
      var verbal = filtered.filter(function (d) { return d.stage === 'Verbal'; });
      var potential = filtered.filter(function (d) { return d.stage === 'Potential'; });

      var wb = new window.ExcelJS.Workbook();
      var ws = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] });
      ws.getColumn(1).width = 2;
      [6, 22, 9, 14, 14, 9, 15, 14, 14, 14, 16, 11, 15, 16].forEach(function (w, i) { ws.getColumn(2 + i).width = w; });

      var r = 1;
      var set = function (row, col, v, opts) {
        opts = opts || {};
        var c = ws.getCell(row, col);
        c.value = v;
        if (opts.font) c.font = opts.font;
        if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + opts.fill } };
        if (opts.align) c.alignment = opts.align;
        if (opts.numFmt) c.numFmt = opts.numFmt;
        return c;
      };
      var mergeRow = function (row, c1, c2) { ws.mergeCells(row, c1 || 2, row, c2 || 15); };
      var white = { argb: 'FFFFFFFF' };
      var gray = { argb: 'FF5B6470' };
      var statusColor = { 'Lived': 'FF548235', 'Onboarding': 'FF1F4E78', 'Verbally Agreement': 'FFBF8F00', 'Negotiation': 'FFC55A11' };

      set(r, 2, 'VA Distribution Performance \u2014 2026', { font: { bold: true, size: 16 } }); mergeRow(r); r++;
      set(r, 2, 'Brand pipeline & NMV tracking \u00b7 Go Live \u00b7 Verbal Agreement \u00b7 Potential deals',
        { font: { italic: true, size: 10, color: gray } }); mergeRow(r); r += 2;

      var nmvFC = filtered.reduce(function (s, d) { return s + d.vnd; }, 0);
      var nmvFCUsd = filtered.reduce(function (s, d) { return s + d.usd; }, 0);
      var nmvGL = goLive.reduce(function (s, d) { return s + d.vnd; }, 0);
      var kpiCols = [2, 4, 6, 8, 10, 12];
      // File export luon dung so TINH TU ROWS (khong dung officialKpi) — vi day la
      // ban xuat cua chinh cac dong dang hien. Ghi ro trong tieu de de nguoi mo file
      // khong doi chieu nham voi KPI card o che do "Official".
      var kpiHeads = ['Total NMV FC 2026\n(computed from rows)', 'Total NMV FC 2026 (USD)\n(computed from rows)', 'Total NMV Go Live YTD 2026\n(computed from rows)', 'Total Brand Golive YTD 2026\n(computed from rows)', 'Total Brand Verbal YTD 2026\n(computed from rows)', 'Total Brand Potential\n(computed from rows)'];
      var kpiVals = [(nmvFC / 1e9).toFixed(2) + ' BIL', '$' + (nmvFCUsd / 1e6).toFixed(2) + 'M', (nmvGL / 1e9).toFixed(2) + ' BIL', goLive.length, verbal.length, potential.length];
      kpiCols.forEach(function (c, i) {
        set(r, c, kpiHeads[i], { font: { bold: true, size: 9, color: { argb: 'FF4D4400' } }, fill: 'FFFF00', align: { horizontal: 'center', vertical: 'middle', wrapText: true } });
      });
      r++;
      kpiCols.forEach(function (c, i) { set(r, c, kpiVals[i], { font: { bold: true, size: 13 }, align: { horizontal: 'center' } }); });
      r++;
      set(r, 2,
        'Breakdown of Total NMV FC 2026: ' + (nmvFC / 1e9).toFixed(2) + ' BIL VND ($' + (nmvFCUsd / 1e6).toFixed(2) + 'M) \u2014 ' +
        'Go Live ' + (nmvGL / 1e9).toFixed(2) + ' BIL \u00b7 Verbal ' + (verbal.reduce(function (s, d) { return s + d.vnd; }, 0) / 1e9).toFixed(2) + ' BIL \u00b7 ' +
        'Potential ' + (potential.reduce(function (s, d) { return s + d.vnd; }, 0) / 1e9).toFixed(2) + ' BIL' +
        (filtered.length !== deals.length ? '  (based on current filter selection)' : ''),
        { font: { italic: true, size: 9, color: gray } });
      mergeRow(r); r += 2;

      function writeSection(title, winRate, bg, rows, monthLbl, dateLbl, nmvLabel) {
        set(r, 2, '\u2299 ' + title + '   ||   Win-rate: ' + winRate, { font: { bold: true, size: 11, color: white }, fill: bg, align: { vertical: 'middle', indent: 1 } });
        mergeRow(r); r++;
        var headers = ['No.', 'Brand', 'Tier', 'Model', 'CD', 'ELEPHANT', 'CAT', 'VA Name', 'Channel', 'Status', monthLbl, dateLbl, nmvLabel + ' (USD)', nmvLabel + ' (VND)'];
        headers.forEach(function (h, i) { set(r, 2 + i, h, { font: { bold: true, size: 9, color: white }, fill: bg, align: { vertical: 'middle', wrapText: true, horizontal: 'left', indent: 1 } }); });
        r++;
        if (rows.length === 0) {
          set(r, 2, 'No deals match the current filters', { font: { italic: true, size: 9, color: gray } });
          mergeRow(r); r++;
        } else {
          rows.forEach(function (d) {
            set(r, 2, d.no, { align: { vertical: 'middle' } });
            set(r, 3, d.brand, { align: { vertical: 'middle' } });
            set(r, 4, d.tier, { align: { vertical: 'middle' } });
            set(r, 5, d.model, { align: { vertical: 'middle' } });
            set(r, 6, d.cd, { align: { vertical: 'middle' } });
            set(r, 7, d.elephant, { align: { vertical: 'middle' } });
            set(r, 8, d.cat, { align: { vertical: 'middle' } });
            set(r, 9, d.va, { align: { vertical: 'middle' } });
            set(r, 10, d.channel, { align: { vertical: 'middle' } });
            set(r, 11, d.status, { font: { bold: true, size: 9, color: { argb: statusColor[d.status] || 'FF1B1F23' } } });
            set(r, 12, d.month, { align: { vertical: 'middle' } });
            set(r, 13, d.date, { align: { vertical: 'middle' } });
            set(r, 14, d.usd, { align: { vertical: 'middle', horizontal: 'right' }, numFmt: '$#,##0' });
            set(r, 15, d.vnd, { align: { vertical: 'middle', horizontal: 'right' }, numFmt: '#,##0' });
            ws.getRow(r).eachCell(function (c) { if (!c.font) c.font = { size: 9 }; });
            r++;
          });
        }
        r++;
      }

      writeSection('GO LIVE DEAL', '100%', '2E7D32', goLive, 'Lived Month', 'Lived Date (mm/dd/yyyy)', 'NMV 2026');
      writeSection('VERBAL AGREEMENT & ONBOARDING DEAL', '>80%', '1F3864', verbal, 'Lived Month (BP)', 'Expected Lived Date (mm/dd/yyyy)', 'NMV 2026');
      writeSection('POTENTIAL DEAL', '40\u201360%', 'E97132', potential, 'Lived Month (BP)', 'Expected Lived Date (mm/dd/yyyy)', 'NMV live\u2192EO26');

      set(r, 2, 'Filters applied \u2014 Stage: ' + byId('pl-f-stage').value + ', Tier: ' + byId('pl-f-tier').value +
        ', CD: ' + byId('pl-f-cd').value + ', CAT: ' + byId('pl-f-cat').value + ', VA Name: ' + byId('pl-f-va').value +
        ', Channel: ' + byId('pl-f-channel').value + ', Status: ' + byId('pl-f-status').value + ', Elephant: ' + byId('pl-f-elephant').value +
        ', Search: "' + byId('pl-f-search').value + '", Time view: ' + byId('pl-f-time-mode').value + ' ' +
        (byId('pl-f-time-day').value || byId('pl-f-time-month').value || '') + '. Exported ' + new Date().toLocaleString('en-US') + '.',
        { font: { italic: true, size: 8, color: { argb: 'FF9AA1A9' } } });
      mergeRow(r); r++;

      var rawSheet = wb.addWorksheet('Raw Data');
      var rawHeaders = ['Stage', 'No.', 'Brand', 'Tier', 'Model', 'CD', 'ELEPHANT', 'CAT', 'VA Name', 'Channel', 'Status', 'Month', 'Date', 'NMV (USD)', 'NMV (VND)', 'brand_key'];
      rawSheet.addRow(rawHeaders).eachCell(function (c) { c.font = { bold: true, color: white }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } }; });
      filtered.forEach(function (d) { rawSheet.addRow([d.stage, d.no, d.brand, d.tier, d.model, d.cd, d.elephant, d.cat, d.va, d.channel, d.status, d.month, d.date, d.usd, d.vnd, d.brand_key]); });
      rawHeaders.forEach(function (h, i) { rawSheet.getColumn(i + 1).width = Math.max(10, h.length + 2); });

      wb.xlsx.writeBuffer().then(function (buf) {
        var blob = new Blob([buf], { type: 'application/octet-stream' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var stamp = new Date().toISOString().slice(0, 10);
        a.href = url; a.download = 'OnPoint_VA_Dashboard_Report_' + stamp + '.xlsx';
        // Not appended to document.body (constraint forbids touching body outside rootEl) —
        // click() on a detached <a> still triggers the download in evergreen browsers.
        a.click();
        URL.revokeObjectURL(url);
        finish();
      }).catch(function (err) {
        console.error('Export failed:', err);
        alert('Export failed: ' + err.message);
        finish();
      });
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
      finish();
    }
  }

  /* ============================================================
     Filter wiring / apply
     ============================================================ */
  var FILTER_IDS = ['pl-f-stage', 'pl-f-tier', 'pl-f-cd', 'pl-f-cat', 'pl-f-va', 'pl-f-channel', 'pl-f-status', 'pl-f-elephant'];

  function applyFilters() {
    var filtered = getFilteredDeals();
    updateTimeRangeNote();
    renderTables(filtered);
    updateKPIs(filtered);
    updateChart1(filtered);
    updateChart2(filtered);
  }

  function bindEvents() {
    FILTER_IDS.forEach(function (id) {
      var el = byId(id);
      if (el) on(el, 'change', applyFilters);
    });
    var searchEl = byId('pl-f-search');
    if (searchEl) on(searchEl, 'input', applyFilters);

    var timeModeEl = byId('pl-f-time-mode');
    if (timeModeEl) {
      on(timeModeEl, 'change', function () {
        var mode = byId('pl-f-time-mode').value;
        byId('pl-f-time-day-wrap').style.display = (mode === 'day' || mode === 'week') ? '' : 'none';
        byId('pl-f-time-month-wrap').style.display = (mode === 'month') ? '' : 'none';
        applyFilters();
      });
    }
    var timeDayEl = byId('pl-f-time-day');
    if (timeDayEl) on(timeDayEl, 'change', applyFilters);
    var timeMonthEl = byId('pl-f-time-month');
    if (timeMonthEl) on(timeMonthEl, 'change', applyFilters);

    var resetEl = byId('pl-f-reset');
    if (resetEl) {
      on(resetEl, 'click', function () {
        FILTER_IDS.forEach(function (id) { var el = byId(id); if (el) el.value = 'all'; });
        byId('pl-f-search').value = '';
        byId('pl-f-time-mode').value = 'all';
        byId('pl-f-time-day').value = '';
        byId('pl-f-time-month').value = '';
        byId('pl-f-time-day-wrap').style.display = 'none';
        byId('pl-f-time-month-wrap').style.display = 'none';
        applyFilters();
      });
    }

    var exportEl = byId('pl-f-export');
    if (exportEl) {
      if (typeof window.ExcelJS === 'undefined') {
        exportEl.disabled = true;
        exportEl.title = 'Export unavailable: ExcelJS library not loaded on this page.';
      }
      on(exportEl, 'click', exportToExcel);
    }
  }

  function renderValidationNote() {
    var note = byId('pl-validation-note');
    if (!note) return;
    note.innerHTML =
      'Filter options (Tier, CD, CAT, VA Name, Channel, Status, Elephant) come from the validation/data object ' +
      'passed into <code>PipelineTracker.mount()</code> \u2014 every valid option is selectable even if no deal currently uses it. ' +
      'See SCHEMA.md for the full enum lists and README-MERGE.md for the data contract.';
  }

  function renderFooterNote() {
    var note = byId('pl-footer-note');
    if (!note) return;
    note.innerHTML =
      'Chart 1 and Chart 2 are re-derived from the deals dataset (Confirmed/Pipeline NMV by month, and brand count by stage) ' +
      'rather than from any separate pre-aggregated source \u2014 see SCHEMA.md for the exact formulas.';
  }

  /* ============================================================
     Cleanup (used by both mount() — to be idempotent — and unmount())
     ============================================================ */
  function cleanup() {
    boundListeners.forEach(function (rec) { rec.el.removeEventListener(rec.type, rec.handler); });
    boundListeners = [];
    if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
    if (chart1) { try { chart1.dispose(); } catch (e) {} chart1 = null; }
    if (chart2) { try { chart2.dispose(); } catch (e) {} chart2 = null; }
  }

  /* ============================================================
     Public API
     ============================================================ */
  function mount(el, data) {
    if (!el) { console.error('PipelineTracker.mount: no element provided.'); return; }
    cleanup(); // idempotent: safe even if mount() is called twice without unmount()

    // `el` may be #pipeline-root itself, or a container that has #pipeline-root
    // somewhere inside it (e.g. the host wrapped our body.html in its own div).
    rootEl = (el.id === 'pipeline-root') ? el : (el.querySelector('#pipeline-root') || el);

    data = data || {};
    deals = normalizeDeals(data.deals);
    VALID = data.validationLists || {};
    OFFICIAL_KPI = readOfficialKpi(data);

    populateAllSelects();
    bindEvents();
    initCharts();
    renderValidationNote();
    renderFooterNote();
    applyFilters(); // initial render with default (all) filters
    mounted = true;
  }

  function unmount() {
    cleanup();
    rootEl = null;
    deals = [];
    VALID = {};
    mounted = false;
  }

  function setData(data) {
    if (!mounted || !rootEl) { console.warn('PipelineTracker.setData called before mount().'); return; }
    data = data || {};
    deals = normalizeDeals(data.deals);
    if (data.validationLists) VALID = data.validationLists;
    OFFICIAL_KPI = readOfficialKpi(data);
    populateAllSelects();
    // Reset filter controls to "all" since option lists may have changed shape.
    FILTER_IDS.forEach(function (id) { var elx = byId(id); if (elx) elx.value = 'all'; });
    byId('pl-f-search').value = '';
    applyFilters();
  }

  window.PipelineTracker = {
    mount: mount,
    unmount: unmount,
    setData: setData,
    // exposed for host apps that want to derive brand_key themselves (e.g. before join)
    toBrandKey: toBrandKey
  };
})();
