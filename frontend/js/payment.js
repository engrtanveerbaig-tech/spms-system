/* ============================================================
   SPMS v2 — payment.js  (updated)
   CHANGES:
   1. Status field unlocks only when a comment is typed
   2. Table filters = multi-select with search, fully cascading
   ============================================================ */

function showTableSkeleton() {
  const table = document.getElementById("table");
  if (!table) return;
  table.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="21"><div class="skeleton skeleton-row"></div></td>`;
    table.appendChild(row);
  }
}

if (!window.selectedProject) window.selectedProject = "";
if (!window.API) window.API = "https://spms-backend-jxzn.onrender.com";
window.originalData = window.originalData || [];
const originalData = window.originalData;

(function () {

  let editId = null;

  const STATUS_CFG = {
    "Submitted":            { color: "#06b6d4", bg: "rgba(6,182,212,.13)",   icon: "◉"  },
    "Under Review":         { color: "#f59e0b", bg: "rgba(245,158,11,.13)",  icon: "⏳" },
    "Approved":             { color: "#10b981", bg: "rgba(16,185,129,.13)",  icon: "✓"  },
    "Forwarded to Finance": { color: "#3b82f6", bg: "rgba(59,130,246,.13)",  icon: "📤" },
    "Released":             { color: "#34d399", bg: "rgba(52,211,153,.13)",  icon: "💚" },
    "On Site":              { color: "#3b82f6", bg: "rgba(59,130,246,.13)",  icon: "📍" },
    "Pending":              { color: "#8b5cf6", bg: "rgba(139,92,246,.13)",  icon: "◷"  },
    "Rejected":             { color: "#ef4444", bg: "rgba(239,68,68,.13)",   icon: "✕"  }
  };

  function statusBadge(s) {
    const c = STATUS_CFG[s] || { color: "#4a5270", bg: "rgba(74,82,112,.12)", icon: "?" };
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.03em;color:${c.color};background:${c.bg};border:1px solid ${c.color}22;white-space:nowrap">${c.icon} ${s || "—"}</span>`;
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* ═══════════════════════════════════════════════════════
     MULTI-SELECT FILTER SYSTEM
     Each filter = a dropdown panel with search + checkboxes.
     All filters are fully cascading (interdependent).
  ═══════════════════════════════════════════════════════ */

  /* State: map of filterId → Set of selected values */
  const filterState = {};

  /* Filter definitions — order matters for cascade */
  const FILTER_DEFS = [
    { id: "f_scid",      key: "subcontractor_id",  label: "SC ID"         },
    { id: "f_project",   key: "project_name",       label: "Project"       },
    { id: "f_contract",  key: "contract_number",    label: "Contract"      },
    { id: "f_company",   key: "company_name",       label: "Company"       },
    { id: "f_sub",       key: "subcontractor_name", label: "Subcontractor" },
    { id: "f_work",      key: "work_type",          label: "Work Type"     },
    { id: "f_cert",      key: "certificate_no",     label: "Cert #"        },
    { id: "f_workval",   key: "work_value",         label: "Work Value"    },
    { id: "f_withdrawn", key: "work_withdrawn",     label: "Withdrawn"     },
    { id: "f_deduction", key: "deduction",          label: "Deduction"     },
    { id: "f_refund",    key: "refund",             label: "Refund"        },
    { id: "f_after",     key: "after_deduction",    label: "After(-)"      },
    { id: "f_vat",       key: "vat_amount",         label: "VAT"           },
    { id: "f_retention", key: "retention_amount",   label: "Retention"     },
    { id: "f_advance",   key: "advance_deduction",  label: "Advance"       },
    { id: "f_net",       key: "net_payment",        label: "Net"           },
    { id: "f_date",      key: "created_at_date",    label: "Entry Date"    },
    { id: "f_status",    key: "cert_status",        label: "Status"        }
  ];

  FILTER_DEFS.forEach(f => { filterState[f.id] = new Set(); });

  /* Build the multi-select UI inside each <th> that has a filter placeholder */
  function buildMultiSelectFilters() {
    FILTER_DEFS.forEach(def => {
      const th = document.querySelector(`th [data-filter="${def.id}"]`);
      if (!th) return; /* placeholder not present — skip */
      th.innerHTML = buildMsfHtml(def.id, def.label);
      attachMsfEvents(def.id);
    });
  }

  function buildMsfHtml(id, label) {
    return `
      <div class="msf-wrap" id="msf_${id}">
        <button type="button" class="msf-trigger" data-id="${id}">
          <span class="msf-label" id="msf_lbl_${id}">All</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="msf-panel" id="msf_panel_${id}">
          <div class="msf-search-row">
            <input type="text" class="msf-search" id="msf_q_${id}" placeholder="Search…" autocomplete="off">
          </div>
          <div class="msf-actions">
            <button type="button" class="msf-act" onclick="msfSelectAll('${id}')">All</button>
            <button type="button" class="msf-act" onclick="msfClear('${id}')">None</button>
          </div>
          <ul class="msf-list" id="msf_list_${id}"></ul>
        </div>
      </div>`;
  }

  function attachMsfEvents(id) {
    const trigger = document.querySelector(`#msf_${id} .msf-trigger`);
    const panel   = document.getElementById(`msf_panel_${id}`);
    const search  = document.getElementById(`msf_q_${id}`);

    trigger?.addEventListener("click", e => {
      e.stopPropagation();
      /* Close all other open panels */
      document.querySelectorAll(".msf-panel.msf-open").forEach(p => {
        if (p !== panel) p.classList.remove("msf-open");
      });
      panel.classList.toggle("msf-open");
      if (panel.classList.contains("msf-open")) {
        search?.focus();
        renderMsfList(id, "");
      }
    });

    search?.addEventListener("input", () => renderMsfList(id, search.value));
    search?.addEventListener("click", e => e.stopPropagation());
    panel?.addEventListener("click", e => e.stopPropagation());
  }

  /* Close panels on outside click */
  document.addEventListener("click", () => {
    document.querySelectorAll(".msf-panel.msf-open").forEach(p => p.classList.remove("msf-open"));
  });

  function renderMsfList(id, query) {
    const list = document.getElementById(`msf_list_${id}`);
    if (!list) return;
    const def = FILTER_DEFS.find(d => d.id === id);
    if (!def) return;

    /* Get values available in currently filtered data (cascade) */
    const available = getAvailableValues(id, def.key);
    const q         = query.trim().toLowerCase();
    const filtered  = q ? available.filter(v => String(v).toLowerCase().includes(q)) : available;

    const selected  = filterState[id];

    list.innerHTML = filtered.map(v => {
      const checked = selected.has(String(v)) ? "checked" : "";
      const valStr  = String(v);
      return `<li class="msf-item">
        <label>
          <input type="checkbox" value="${valStr}" ${checked}
            onchange="msfToggle('${id}','${valStr.replace(/'/g, "\\'")}',this.checked)">
          <span>${valStr || "—"}</span>
        </label>
      </li>`;
    }).join("") || `<li class="msf-empty">No options</li>`;
  }

  /* Which values are possible given ALL OTHER active filters */
  function getAvailableValues(excludeId, key) {
    const base = applyFiltersExcept(excludeId);
    const vals  = [...new Set(base.map(p => {
      if (key === "created_at_date") return (p.created_at || "").slice(0, 10);
      if (key === "cert_status") return p.cert_status || p.status || "Submitted";
      return p[key];
    }).filter(v => v !== null && v !== undefined && v !== ""))];
    return vals.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }

  function applyFiltersExcept(excludeId) {
    const dFrom = document.getElementById("date_from")?.value || "";
    const dTo   = document.getElementById("date_to")?.value   || "";

    return originalData.filter(p => {
      const pStatus = p.cert_status || p.status || "";
      const pDate   = (p.cert_date || p.created_at || "").slice(0, 10);
      const pEntryD = (p.created_at || "").slice(0, 10);

      for (const def of FILTER_DEFS) {
        if (def.id === excludeId) continue;
        const sel = filterState[def.id];
        if (!sel || sel.size === 0) continue;

        let val;
        if (def.key === "created_at_date") val = pEntryD;
        else if (def.key === "cert_status") val = pStatus;
        else val = String(p[def.key] ?? "");

        if (!sel.has(String(val))) return false;
      }

      if (dFrom && pDate < dFrom) return false;
      if (dTo   && pDate > dTo)   return false;
      return true;
    });
  }

  function getFilteredData() {
    const dFrom = document.getElementById("date_from")?.value || "";
    const dTo   = document.getElementById("date_to")?.value   || "";

    return originalData.filter(p => {
      const pStatus = p.cert_status || p.status || "";
      const pDate   = (p.cert_date || p.created_at || "").slice(0, 10);
      const pEntryD = (p.created_at || "").slice(0, 10);

      for (const def of FILTER_DEFS) {
        const sel = filterState[def.id];
        if (!sel || sel.size === 0) continue;

        let val;
        if (def.key === "created_at_date") val = pEntryD;
        else if (def.key === "cert_status") val = pStatus;
        else val = String(p[def.key] ?? "");

        if (!sel.has(String(val))) return false;
      }

      if (dFrom && pDate < dFrom) return false;
      if (dTo   && pDate > dTo)   return false;
      return true;
    });
  }

  /* Exposed helpers called from inline HTML */
  window.msfToggle = function(id, val, checked) {
    if (checked) filterState[id].add(String(val));
    else         filterState[id].delete(String(val));
    updateMsfLabel(id);
    applyFilter();
    /* Re-render sibling panels that are open so their options cascade */
    FILTER_DEFS.forEach(def => {
      if (def.id !== id && document.getElementById(`msf_panel_${def.id}`)?.classList.contains("msf-open")) {
        const q = document.getElementById(`msf_q_${def.id}`)?.value || "";
        renderMsfList(def.id, q);
      }
    });
  };

  window.msfSelectAll = function(id) {
    const def = FILTER_DEFS.find(d => d.id === id);
    if (!def) return;
    const available = getAvailableValues(id, def.key);
    available.forEach(v => filterState[id].add(String(v)));
    updateMsfLabel(id);
    renderMsfList(id, document.getElementById(`msf_q_${id}`)?.value || "");
    applyFilter();
  };

  window.msfClear = function(id) {
    filterState[id].clear();
    updateMsfLabel(id);
    renderMsfList(id, document.getElementById(`msf_q_${id}`)?.value || "");
    applyFilter();
  };

  function updateMsfLabel(id) {
    const lbl = document.getElementById(`msf_lbl_${id}`);
    if (!lbl) return;
    const sel = filterState[id];
    if (sel.size === 0)       lbl.textContent = "All";
    else if (sel.size === 1)  lbl.textContent = [...sel][0];
    else                      lbl.textContent = `${sel.size} selected`;
    lbl.style.color = sel.size > 0 ? "var(--violet, #7c3aed)" : "";
  }

  window.applyFilter = function () {
    const filtered = getFilteredData();
    renderTable(filtered);
  };

  /* Inject multi-select CSS once */
  (function injectMsfCss() {
    if (document.getElementById("msf-style")) return;
    const style = document.createElement("style");
    style.id    = "msf-style";
    style.textContent = `
.msf-wrap{position:relative;width:100%;}
.msf-trigger{
  display:flex;align-items:center;justify-content:space-between;gap:4px;
  width:100%;box-sizing:border-box;padding:3px 7px;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
  border-radius:5px;color:var(--text2,#94a3b8);
  font-size:10px;font-family:var(--mono,'JetBrains Mono',monospace);
  cursor:pointer;white-space:nowrap;overflow:hidden;
  transition:border-color .15s;min-height:26px;
}
.msf-trigger:hover{border-color:rgba(255,255,255,.22);}
.msf-panel{
  display:none;position:absolute;top:calc(100% + 3px);left:0;
  min-width:200px;max-width:280px;
  z-index:99999;
  background:var(--card,#1a2035);
  border:1px solid rgba(255,255,255,.14);
  border-radius:7px;box-shadow:0 8px 28px rgba(0,0,0,.55);overflow:hidden;
}
.msf-panel.msf-open{display:block;}
.msf-search-row{padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.07);}
.msf-search{
  width:100%;box-sizing:border-box;padding:4px 8px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
  border-radius:4px;color:var(--text,#e2e8f0);font-size:11px;
  font-family:var(--sans,'Outfit',sans-serif);outline:none;
}
.msf-search:focus{border-color:var(--violet,#7c3aed);}
.msf-actions{display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.07);}
.msf-act{
  flex:1;padding:3px 0;font-size:10px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
  border-radius:4px;color:var(--text3,#4a5270);cursor:pointer;
  font-family:var(--mono,'JetBrains Mono',monospace);
  transition:background .1s,color .1s;
}
.msf-act:hover{background:rgba(124,58,237,.15);color:var(--violet,#7c3aed);}
.msf-list{list-style:none;margin:0;padding:4px 0;max-height:200px;overflow-y:auto;}
.msf-list::-webkit-scrollbar{width:4px;}
.msf-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px;}
.msf-item label{
  display:flex;align-items:center;gap:7px;
  padding:5px 10px;cursor:pointer;
  font-size:11px;color:var(--text2,#94a3b8);
  transition:background .1s,color .1s;
}
.msf-item label:hover{background:rgba(255,255,255,.05);color:var(--text,#e2e8f0);}
.msf-item input[type=checkbox]{accent-color:var(--violet,#7c3aed);flex-shrink:0;}
.msf-empty{padding:10px;text-align:center;font-size:11px;color:var(--text3,#4a5270);font-style:italic;}
    `;
    document.head.appendChild(style);
  })();

  /* ════════════════════════════════════════════════════════
     COMMENT-DRIVEN STATUS UNLOCK
     - No comment → status locked to "Submitted"
     - Comment typed → status dropdown enabled
  ════════════════════════════════════════════════════════ */

  function onCommentInput() {
    if (editId) return; /* In edit mode, status is always free */
    const comment = (document.getElementById("cert_comment")?.value || "").trim();
    syncStatusFieldMode(false, comment.length > 0);
  }

  /* ── STATUS FIELD MODE (updated) ── */
  function syncStatusFieldMode(isEditMode, commentPresent) {
    const sel   = document.getElementById("cert_status");
    const hint  = document.getElementById("cert_status_hint");
    const badge = document.getElementById("status_edit_badge");

    if (!sel) return;

    if (isEditMode) {
      /* Edit mode: always fully editable */
      sel.disabled      = false;
      sel.style.opacity = "1";
      sel.style.cursor  = "pointer";
      if (hint)  hint.style.display  = "none";
      if (badge) badge.style.display = "inline";
    } else if (commentPresent) {
      /* New cert with comment: user can choose status */
      sel.disabled      = false;
      sel.style.opacity = "1";
      sel.style.cursor  = "pointer";
      if (hint)  hint.style.display  = "none";
      if (badge) badge.style.display = "none";
    } else {
      /* New cert, no comment: locked to Submitted */
      sel.value         = "Submitted";
      sel.disabled      = true;
      sel.style.opacity = "0.6";
      sel.style.cursor  = "not-allowed";
      if (hint)  hint.style.display  = "block";
      if (badge) badge.style.display = "none";
    }
  }
  window.syncStatusFieldMode = syncStatusFieldMode;

  /* ════════════════════════════════════════════════════════
     SEARCHABLE SUBCONTRACTOR DROPDOWN (unchanged)
  ════════════════════════════════════════════════════════ */
  let _subOptions = [];

  function buildSearchableDropdown() {
    const wrapper = document.getElementById("sub_search_wrapper");
    if (!wrapper) return;
    wrapper.innerHTML = `
      <div class="ssd-trigger" id="ssd_trigger" tabindex="0">
        <span id="ssd_label" class="ssd-placeholder">Select Subcontractor</span>
        <svg class="ssd-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="ssd-panel" id="ssd_panel">
        <div class="ssd-search-wrap">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="ssd_search" class="ssd-search" placeholder="Search subcontractor…" autocomplete="off">
        </div>
        <ul class="ssd-list" id="ssd_list"></ul>
      </div>`;

    const trigger = document.getElementById("ssd_trigger");
    const panel   = document.getElementById("ssd_panel");
    const search  = document.getElementById("ssd_search");
    const list    = document.getElementById("ssd_list");

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.toggle("ssd-open");
      if (isOpen) { search.value = ""; renderSsdList(""); setTimeout(() => search.focus(), 50); }
    });
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger.click(); }
    });
    search.addEventListener("input", () => renderSsdList(search.value));
    search.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => panel.classList.remove("ssd-open"));

    function renderSsdList(query) {
      const q = query.trim().toLowerCase();
      const filtered = q ? _subOptions.filter(o => o.label.toLowerCase().includes(q)) : _subOptions;
      list.innerHTML = "";
      if (!filtered.length) { list.innerHTML = `<li class="ssd-empty">No results</li>`; return; }
      filtered.forEach(o => {
        const li = document.createElement("li");
        li.className = "ssd-item";
        li.dataset.id = o.id;
        if (q) {
          const idx = o.label.toLowerCase().indexOf(q);
          li.innerHTML = o.label.slice(0, idx) + `<mark>${o.label.slice(idx, idx + q.length)}</mark>` + o.label.slice(idx + q.length);
        } else { li.textContent = o.label; }
        const hidden = document.getElementById("subcontractor_form");
        if (hidden && String(hidden.value) === String(o.id)) li.classList.add("ssd-selected");
        li.addEventListener("click", (e) => {
          e.stopPropagation();
          selectSsdOption(o.id, o.label);
          panel.classList.remove("ssd-open");
        });
        list.appendChild(li);
      });
    }
    window._renderSsdList = renderSsdList;
  }

  function selectSsdOption(id, label) {
    const hidden  = document.getElementById("subcontractor_form");
    const display = document.getElementById("ssd_label");
    if (hidden)  { hidden.value = id; hidden.dispatchEvent(new Event("change")); }
    if (display) { display.textContent = label; display.classList.remove("ssd-placeholder"); }
  }

  function setSsdOptions(options, selectedId) {
    _subOptions = options;
    const panel   = document.getElementById("ssd_panel");
    const display = document.getElementById("ssd_label");
    if (!panel?.classList.contains("ssd-open") && window._renderSsdList) window._renderSsdList("");
    if (selectedId) {
      const found = options.find(o => String(o.id) === String(selectedId));
      if (found && display) { display.textContent = found.label; display.classList.remove("ssd-placeholder"); }
    } else if (display) { display.textContent = "Select Subcontractor"; display.classList.add("ssd-placeholder"); }
  }

  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  function initPaymentPage() {
    ["work", "withdrawn", "deduction", "refund"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", calculate);
    });

    document.getElementById("work_type_form")?.addEventListener("change", function () {
      loadSubcontractors();
      calculate();
    });

    /* Comment drives status unlock */
    document.getElementById("cert_comment")?.addEventListener("input", onCommentInput);

    const certDateEl = document.getElementById("cert_date");
    if (certDateEl && !certDateEl.value)
      certDateEl.value = new Date().toISOString().slice(0, 10);

    syncStatusFieldMode(false, false);

    document.getElementById("saveBtn")?.addEventListener("click", addPayment);
    document.getElementById("subcontractor_form")?.addEventListener("change", onSubcontractorChange);
    document.getElementById("date_from")?.addEventListener("change", applyFilter);
    document.getElementById("date_to")?.addEventListener("change", applyFilter);

    buildSearchableDropdown();

    showTableSkeleton();
    loadFullData();
    loadSubcontractors();

    setTimeout(() => {
      const wt = document.getElementById("work_type_form")?.value;
      if (wt) loadSubcontractors();
    }, 200);

    initExportButton();
  }

  /* ════════════════════════════════════════════════════════
     LOAD SUBS
  ════════════════════════════════════════════════════════ */
  async function loadSubcontractors() {
    const work_type = document.getElementById("work_type_form")?.value;
    const hidden    = document.getElementById("subcontractor_form");
    const display   = document.getElementById("ssd_label");
    if (!work_type) {
      _subOptions = [];
      if (display) { display.textContent = "Select Work Type First"; display.classList.add("ssd-placeholder"); }
      if (hidden)  hidden.value = "";
      return;
    }
    const res = await fetch(`${window.API}/api/subcontractors/by-type/${work_type}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { console.error("Sub API error:", await res.text()); return; }
    const data = await res.json();
    if (!Array.isArray(data)) { console.error("Invalid sub response:", data); return; }
    const options = data.map(s => ({ id: s.id, label: `${s.name} (${s.project}) — ${s.company_name}` }));
    setSsdOptions(options, null);
    if (options.length > 0) selectSsdOption(options[0].id, options[0].label);
  }

  /* ════════════════════════════════════════════════════════
     CALCULATE (unchanged logic)
  ════════════════════════════════════════════════════════ */
  function calculate() {
    const work      = +(document.getElementById("work")?.value)      || 0;
    const withdrawn = +(document.getElementById("withdrawn")?.value) || 0;
    const deduction = +(document.getElementById("deduction")?.value) || 0;
    const refund    = +(document.getElementById("refund")?.value)    || 0;
    const workType  = document.getElementById("work_type_form")?.value || "";
    const retPct    = window.currentRetention || 10;
    let   vatPct    = Number(window.currentVat); if (isNaN(vatPct)) vatPct = 0;
    let advDeduction = 0, vatAmt = 0, retAmt = 0, netAmt = 0;

    if (workType === "Insulation") {
      advDeduction   = work * 0.25;
      const afterAdv = work - advDeduction;
      vatAmt         = afterAdv * (vatPct / 100);
      retAmt         = work     * (retPct / 100);
      const afterVat = afterAdv + vatAmt;
      netAmt         = afterVat - deduction + refund - withdrawn - retAmt;
    } else {
      const after  = work - withdrawn - deduction + refund;
      const hasAdv = window.currentAdvance && window.currentAdvance > 0 && after > 0;
      if (hasAdv) {
        advDeduction   = Math.min(after * 0.25, window.currentAdvance);
        const afterAdv = after - advDeduction;
        vatAmt         = afterAdv * (vatPct / 100);
        retAmt         = after    * (retPct / 100);
        netAmt         = afterAdv + vatAmt - retAmt;
      } else {
        vatAmt = after * (vatPct / 100);
        retAmt = after * (retPct / 100);
        netAmt = after + vatAmt - retAmt;
      }
    }

    const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v.toFixed(2); };
    sv("vat", vatAmt); sv("retention", retAmt); sv("net", netAmt); sv("advance_deduction", advDeduction);
  }

  /* ════════════════════════════════════════════════════════
     ADD / UPDATE
  ════════════════════════════════════════════════════════ */
  async function addPayment() {
    const work      = +(document.getElementById("work")?.value)      || 0;
    const withdrawn = +(document.getElementById("withdrawn")?.value) || 0;
    const deduction = +(document.getElementById("deduction")?.value) || 0;
    const refund    = +(document.getElementById("refund")?.value)    || 0;
    const workType  = document.getElementById("work_type_form")?.value || "";
    let   vatPct    = Number(window.currentVat); if (isNaN(vatPct)) vatPct = 0;
    let   retPct    = window.currentRetention || 10;
    let advDeduction = 0, vatAmt = 0, retAmt = 0, netAmt = 0, afterField = 0;

    if (workType === "Insulation") {
      advDeduction   = work * 0.25;
      const afterAdv = work - advDeduction;
      vatAmt         = afterAdv * (vatPct / 100);
      retAmt         = work     * (retPct / 100);
      const afterVat = afterAdv + vatAmt;
      netAmt         = afterVat - deduction + refund - withdrawn - retAmt;
      afterField     = afterAdv;
    } else {
      afterField       = work - withdrawn - deduction + refund;
      const hasAdv     = window.currentAdvance && window.currentAdvance > 0 && afterField > 0;
      if (hasAdv) {
        advDeduction   = Math.min(afterField * 0.25, window.currentAdvance);
        const afterAdv = afterField - advDeduction;
        vatAmt         = afterAdv   * (vatPct / 100);
        retAmt         = afterField * (retPct / 100);
        netAmt         = afterAdv + vatAmt - retAmt;
      } else {
        vatAmt = afterField * (vatPct / 100);
        retAmt = afterField * (retPct / 100);
        netAmt = afterField + vatAmt - retAmt;
      }
    }

    const subcontractorId = document.getElementById("subcontractor_form")?.value;
    if (!subcontractorId) { alert("Please select subcontractor ❌"); return; }

    const statusValue = editId
      ? (document.getElementById("cert_status")?.value || "Submitted")
      : "Submitted";

    const payload = {
      subcontractor_id:  +subcontractorId,
      certificate_no:    +(document.getElementById("certificate_no")?.value) || 0,
      project_name:      document.getElementById("project_form")?.value      || "",
      project_id:        1,
      contract_number:   document.getElementById("contract_number")?.value   || "",
      work_type:         workType,
      work_value:        work,
      work_withdrawn:    withdrawn,
      deduction,
      refund,
      after_deduction:   afterField,
      vat_amount:        vatAmt,
      retention_amount:  retAmt,
      advance_deduction: advDeduction,
      net_payment:       netAmt,
      cert_date:         document.getElementById("cert_date")?.value || new Date().toISOString().slice(0, 10),
      status:            statusValue,
      cert_status:       statusValue,
      comment:           document.getElementById("cert_comment")?.value?.trim() || "",
      submitted_at:      editId ? undefined : new Date().toISOString()
    };

    let url = `${window.API}/api/payments/add`, method = "POST";
    if (editId) { url = `${window.API}/api/payments/update/${editId}`; method = "PUT"; }

    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "Saving…"; }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify(payload)
    });

    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = editId ? "Update Certificate" : "Save Payment Certificate"; }
    if (!res.ok) { alert("Save failed ❌"); return; }

    const msgEl = document.getElementById("msg");
    if (msgEl) {
      msgEl.innerText = editId ? "Updated ✓" : "Submitted ✓ — status: Submitted";
      msgEl.style.color = "#10b981";
      setTimeout(() => { msgEl.innerText = ""; }, 3500);
    }

    const currentSub = document.getElementById("subcontractor_form")?.value;
    const wasEdit    = !!editId;
    editId           = null;
    if (saveBtn) saveBtn.innerText = "Save Payment Certificate";

    ["work", "withdrawn", "deduction", "refund", "cert_comment",
     "vat", "retention", "net", "advance_deduction"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    const dateEl = document.getElementById("cert_date");
    if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);

    syncStatusFieldMode(false, false);

    if (!wasEdit) {
      await loadSubcontractors();
      const hidden = document.getElementById("subcontractor_form");
      if (hidden && currentSub) {
        const found = _subOptions.find(o => String(o.id) === String(currentSub));
        if (found) selectSsdOption(found.id, found.label);
        else { hidden.value = currentSub; hidden.dispatchEvent(new Event("change")); }
      }
    }

    await loadFullData();
  }

  /* ════════════════════════════════════════════════════════
     LOAD FULL DATA
  ════════════════════════════════════════════════════════ */
  async function loadFullData() {
    const res = await fetch(`${window.API}/api/payments/all-full`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { console.error("Payment API error:", await res.text()); return; }
    const data = await res.json();
    if (!Array.isArray(data)) { console.error("Invalid response:", data); return; }

    originalData.length = 0;
    originalData.push(...data);
    originalData.sort((a, b) => Number(a.certificate_no) - Number(b.certificate_no));

    /* Rebuild multi-select filter lists */
    FILTER_DEFS.forEach(def => renderMsfList(def.id, ""));
    loadBulkOptions();
    renderTable(getFilteredData());
  }

  /* ════════════════════════════════════════════════════════
     RENDER TABLE
  ════════════════════════════════════════════════════════ */
  function renderTable(data) {
    const table = document.getElementById("table");
    if (!table) return;
    table.innerHTML = "";
    let t = { work: 0, wd: 0, ded: 0, ref: 0, after: 0, vat: 0, ret: 0, adv: 0, net: 0 };

    data.forEach(p => {
      t.work  += +p.work_value        || 0;
      t.wd    += +p.work_withdrawn    || 0;
      t.ded   += +p.deduction         || 0;
      t.ref   += +p.refund            || 0;
      t.after += +p.after_deduction   || 0;
      t.vat   += +p.vat_amount        || 0;
      t.ret   += +p.retention_amount  || 0;
      t.adv   += +p.advance_deduction || 0;
      t.net   += +p.net_payment       || 0;

      const certDate    = p.cert_date  ? new Date(p.cert_date).toLocaleDateString()  : "—";
      const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString() : "—";
      const netColor    = p.net_payment < 0 ? "#ef4444" : "#10b981";
      const displayStatus = p.cert_status || p.status || "Submitted";
      const commentIcon = p.comment
        ? `<span title="${(p.comment || "").replace(/"/g, "&quot;")}" style="cursor:help;color:#f59e0b;font-size:13px">💬</span>&nbsp;`
        : "";
      const commentText = p.comment
        ? `<span style="color:var(--text3);font-size:10px">${p.comment.slice(0, 36)}${p.comment.length > 36 ? "…" : ""}</span>`
        : "";

      const row = document.createElement("tr");
      row.innerHTML =
        `<td style="font-family:var(--mono)">${p.subcontractor_id || "—"}</td>` +
        `<td>${p.project_name || "—"}</td>` +
        `<td style="font-family:var(--mono)">${p.contract_number || "—"}</td>` +
        `<td>${p.company_name || "—"}</td>` +
        `<td>${p.subcontractor_name || "—"}</td>` +
        `<td>${p.work_type || "—"}</td>` +
        `<td style="font-family:var(--mono)">${p.certificate_no || "—"}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.work_value)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.work_withdrawn)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.deduction)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.refund)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.after_deduction)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.vat_amount)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.retention_amount)}</td>` +
        `<td style="font-family:var(--mono)">${fmt(p.advance_deduction || 0)}</td>` +
        `<td style="font-family:var(--mono);color:${netColor};font-weight:600">${fmt(p.net_payment)}</td>` +
        `<td style="white-space:nowrap">${certDate}</td>` +
        `<td style="white-space:nowrap">${createdDate}</td>` +
        `<td>${statusBadge(displayStatus)}</td>` +
        `<td style="max-width:130px;white-space:normal">${commentIcon}${commentText}</td>` +
        `<td>` +
          `<button onclick="editPayment(${p.id})">Edit</button>` +
          `<button onclick="deletePayment(${p.id})">Delete</button>` +
        `</td>`;
      table.appendChild(row);
    });

    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setT("t_cer",       data.length);
    setT("t_work",      fmt(t.work));
    setT("t_withdrawn", fmt(t.wd));
    setT("t_deduction", fmt(t.ded));
    setT("t_refund",    fmt(t.ref));
    setT("t_after",     fmt(t.after));
    setT("t_vat",       fmt(t.vat));
    setT("t_retention", fmt(t.ret));
    setT("t_advance",   fmt(t.adv));
    setT("t_net",       fmt(t.net));
  }

  /* ════════════════════════════════════════════════════════
     EDIT
  ════════════════════════════════════════════════════════ */
  window.editPayment = function (id) {
    const p = originalData.find(x => x.id === id);
    if (!p) return;
    editId = id;
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.innerText = "Update Certificate";
    syncStatusFieldMode(true);

    const wtEl = document.getElementById("work_type_form");
    if (wtEl) { wtEl.value = p.work_type || ""; wtEl.dispatchEvent(new Event("change")); }

    setTimeout(async () => {
      const subEl = document.getElementById("subcontractor_form");
      if (subEl) {
        subEl.value = p.subcontractor_id;
        await onSubcontractorChange();
        const found = _subOptions.find(o => String(o.id) === String(p.subcontractor_id));
        if (found) selectSsdOption(found.id, found.label);
        else {
          const display = document.getElementById("ssd_label");
          if (display) { display.textContent = p.subcontractor_name || ""; display.classList.remove("ssd-placeholder"); }
        }
      }
      const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
      sv("work",           p.work_value);
      sv("withdrawn",      p.work_withdrawn);
      sv("deduction",      p.deduction);
      sv("refund",         p.refund);
      sv("certificate_no", p.certificate_no);
      sv("cert_date",      (p.cert_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10));
      sv("cert_status",    p.cert_status || p.status || "Submitted");
      sv("cert_comment",   p.comment || "");
      calculate();
      document.querySelector(".pay-sec")?.scrollIntoView({ behavior: "smooth" });
    }, 400);
  };

  /* ════════════════════════════════════════════════════════
     DELETE
  ════════════════════════════════════════════════════════ */
  window.deletePayment = async function (id) {
    const p = originalData.find(x => x.id === id);
    if (!confirm(`Delete certificate #${p?.certificate_no || id}?`)) return;
    const res = await fetch(`${window.API}/api/payments/delete/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { alert("Delete failed ❌"); return; }
    const idx = originalData.findIndex(x => x.id === id);
    if (idx !== -1) originalData.splice(idx, 1);
    renderTable(getFilteredData());
  };

  /* ════════════════════════════════════════════════════════
     ON SUB CHANGE
  ════════════════════════════════════════════════════════ */
  async function onSubcontractorChange() {
    const id = document.getElementById("subcontractor_form")?.value;
    if (!id) return;
    const res = await fetch(`${window.API}/api/subcontractors/${id}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { console.error("Sub details error:", await res.text()); return; }
    const d = await res.json();
    window.currentRetention = Number(d.retention_percent || 10);
    window.currentVat       = Number(d.vat_percent); if (isNaN(window.currentVat)) window.currentVat = 0;
    const advAmt            = Number(d.advance_amount || 0);
    const advRem            = Number(d.advance_remaining ?? advAmt ?? 0);
    window.originalAdvance  = advAmt;
    window.currentAdvance   = advRem;
    const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    sv("advance_remaining",         (advRem || 0).toFixed(2));
    sv("retention_percent_display", (window.currentRetention || 0) + "%");
    sv("contract_number",            d.contract_no || "");
    window.selectedProject = d.project || "";
    sv("project_form", window.selectedProject);
    const workType = document.getElementById("work_type_form")?.value;
    if (workType) {
      const certs   = originalData.filter(p =>
        p.subcontractor_id == id &&
        p.project_name     == window.selectedProject &&
        p.work_type        == workType
      );
      const maxCert = certs.reduce((mx, p) => Math.max(mx, Number(p.certificate_no) || 0), 0);
      sv("certificate_no", maxCert + 1);
    }
    calculate();
  }

  /* ════════════════════════════════════════════════════════
     BULK OPTIONS
  ════════════════════════════════════════════════════════ */
  function loadBulkOptions() {
    const companies     = [...new Set(originalData.map(p => p.company_name))];
    const companySelect = document.getElementById("bulk_company");
    const subSelect     = document.getElementById("bulk_sub");
    if (!companySelect || !subSelect) return;
    companySelect.innerHTML = "<option value=''>Select Company</option>";
    companies.forEach(c => { companySelect.innerHTML += `<option>${c}</option>`; });
    companySelect.onchange = function () {
      const co     = this.value;
      const unique = [...new Set(originalData.filter(p => p.company_name === co).map(p => p.subcontractor_name))];
      subSelect.innerHTML = "<option value=''>Select Subcontractor</option>";
      unique.forEach(s => { subSelect.innerHTML += `<option>${s}</option>`; });
      subSelect.onchange = function () {
        const su    = subSelect.value;
        const works = [...new Set(originalData.filter(p => p.company_name === co && p.subcontractor_name === su).map(p => p.work_type))];
        const workSel = document.getElementById("bulk_work");
        if (!workSel) return;
        workSel.innerHTML = "<option value=''>Select Work Type</option>";
        works.forEach(w => { workSel.innerHTML += `<option>${w}</option>`; });
      };
    };
  }

  /* ════════════════════════════════════════════════════════
     BULK DELETE
  ════════════════════════════════════════════════════════ */
  window.bulkDelete = async function () {
    const subName = document.getElementById("bulk_sub")?.value;
    const work    = document.getElementById("bulk_work")?.value;
    const from    = +document.getElementById("from_cert")?.value;
    const to      = +document.getElementById("to_cert")?.value;
    if (!subName || !work || !from || !to) { alert("Fill all fields"); return; }
    const record = originalData.find(p =>
      p.subcontractor_name === subName &&
      p.work_type          === work &&
      p.company_name       === document.getElementById("bulk_company")?.value
    );
    if (!record) { alert("No matching data found"); return; }
    if (!confirm(`Delete certificates ${from} → ${to}?`)) return;
    const res = await fetch(`${window.API}/api/payments/bulk-delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify({
        subcontractor_id: record.subcontractor_id,
        work_type:        work,
        project_name:     record.project_name,
        from_cert:        from,
        to_cert:          to
      })
    });
    alert(await res.text());
    await loadFullData();
  };

  /* ════════════════════════════════════════════════════════
     PRINT
  ════════════════════════════════════════════════════════ */
  window.printPayment = function (id) {
    const p = originalData.find(x => x.id === id);
    if (!p) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <h2>Payment Certificate</h2>
      <p><b>Work Type:</b> ${p.work_type}</p>
      <p><b>Subcontractor:</b> ${p.subcontractor_name}</p>
      <p><b>Project:</b> ${p.project_name}</p>
      <p><b>Contract:</b> ${p.contract_number}</p>
      <p><b>Certificate #:</b> ${p.certificate_no}</p>
      <p><b>Cert Date:</b> ${p.cert_date ? new Date(p.cert_date).toLocaleDateString() : "—"}</p>
      <p><b>Status:</b> ${p.cert_status || p.status || "Submitted"}</p>
      <p><b>Comment:</b> ${p.comment || "—"}</p>
      <p><b>Net Payment:</b> ${p.net_payment}</p>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  /* ════════════════════════════════════════════════════════
     EXPORT
  ════════════════════════════════════════════════════════ */
  function getFilteredDataForExport() {
    return getFilteredData();
  }

  function initExportButton() {
    const btn = document.getElementById("exportBtn");
    if (!btn) return;
    const STATUS_CFG_LOCAL = STATUS_CFG;

    btn.onclick = function () {
      const filtered = getFilteredDataForExport();
      filtered.sort((a, b) =>
        (a.project_name || "").localeCompare(b.project_name || "") ||
        (a.work_type    || "").localeCompare(b.work_type    || "") ||
        (a.subcontractor_name || "").localeCompare(b.subcontractor_name || "") ||
        Number(a.certificate_no) - Number(b.certificate_no)
      );
      if (!filtered.length) { alert("No data to export"); return; }

      const groups = {};
      filtered.forEach(p => {
        const key = `${p.project_name}__${p.work_type}__${p.subcontractor_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      const sColor = s => (STATUS_CFG_LOCAL[s]?.color || "#333");

      let html = `<html><head><style>
        @page{size:A4;margin:12mm}
        body{font-family:Arial;padding:10px;font-size:12px}
        h1{text-align:center;color:#1f4e79;font-size:20px}
        h3{color:#dba512;margin:5px 0}h4{margin:6px 0 3px}
        table{border-collapse:collapse;width:100%;margin-top:8px;page-break-inside:avoid}
        th{background:#1f4e79;color:#fff;padding:4px 6px;font-size:11px}
        td,th{border:1px solid #ccc;padding:3px 5px;text-align:center;font-size:11px}
        .tot{font-weight:bold;background:#eef0f8}
        .page{page-break-after:always}
        @media print{th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
      </style></head><body>`;

      Object.values(groups).forEach(records => {
        const first = records[0];
        let t = { work: 0, wd: 0, ded: 0, ref: 0, after: 0, vat: 0, ret: 0, adv: 0, net: 0 };
        records.forEach(p => {
          t.work  += +p.work_value || 0;    t.wd  += +p.work_withdrawn || 0;
          t.ded   += +p.deduction  || 0;    t.ref += +p.refund || 0;
          t.after += +p.after_deduction || 0; t.vat += +p.vat_amount || 0;
          t.ret   += +p.retention_amount || 0; t.adv += +p.advance_deduction || 0;
          t.net   += +p.net_payment || 0;
        });
        html += `<div class="page">
          <h1>Payment Certificate Report</h1>
          <h3>Project: ${first.project_name}</h3>
          <div style="font-size:12px;line-height:1.7;margin-bottom:6px">
            <b>Subcontractor:</b> <span style="color:#d35400">${first.subcontractor_name}</span>
            &nbsp;|&nbsp;<b>Work:</b> ${first.work_type}<br>
            <b>Company:</b> ${first.company_name || "—"} &nbsp;|&nbsp;<b>Contract:</b> ${first.contract_number || "—"}<br>
          </div>
          <h4>Summary</h4>
          <table><tr><th>Total Work</th><th>Withdrawn</th><th>Deduction</th><th>Refund</th><th>After</th><th>VAT</th><th>Retention</th><th>Net</th></tr>
          <tr><td>${fmt(t.work)}</td><td>${fmt(t.wd)}</td><td>${fmt(t.ded)}</td><td>${fmt(t.ref)}</td><td>${fmt(t.after)}</td><td>${fmt(t.vat)}</td><td>${fmt(t.ret)}</td><td>${fmt(t.net)}</td></tr></table>
          <h4>Details</h4>
          <table>
            <tr><th>Cert#</th><th>Work</th><th>Withdrawn</th><th>Deduction</th><th>Refund</th><th>After</th><th>VAT</th><th>Retention</th><th>Advance</th><th>Net</th><th>Cert Date</th><th>Status</th><th>Comment</th></tr>
            ${records.map(p => {
              const st = p.cert_status || p.status || "Submitted";
              return `<tr>
                <td>${p.certificate_no}</td><td>${fmt(p.work_value)}</td><td>${fmt(p.work_withdrawn)}</td>
                <td>${fmt(p.deduction)}</td><td>${fmt(p.refund)}</td><td>${fmt(p.after_deduction)}</td>
                <td>${fmt(p.vat_amount)}</td><td>${fmt(p.retention_amount)}</td>
                <td>${fmt(p.advance_deduction || 0)}</td><td>${fmt(p.net_payment)}</td>
                <td>${p.cert_date ? new Date(p.cert_date).toLocaleDateString() : "—"}</td>
                <td><b style="color:${sColor(st)}">${st}</b></td>
                <td style="text-align:left;font-size:10px">${p.comment || ""}</td>
              </tr>`;
            }).join("")}
            <tr class="tot"><td>TOTAL</td><td>${fmt(t.work)}</td><td>${fmt(t.wd)}</td><td>${fmt(t.ded)}</td><td>${fmt(t.ref)}</td><td>${fmt(t.after)}</td><td>${fmt(t.vat)}</td><td>${fmt(t.ret)}</td><td>${fmt(t.adv)}</td><td>${fmt(t.net)}</td><td colspan="3"></td></tr>
          </table>
          <p style="margin-top:10px;font-size:10px;color:#888">SPMS v2.0 &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</p>
        </div>`;
      });

      html += "</body></html>";
      const win = window.open("", "", "width=960,height=750");
      win.document.write(html);
      win.document.close();
    };
  }

  /* ════════════════════════════════════════════════════════
     GLOBALS
  ════════════════════════════════════════════════════════ */
  window.initPaymentPage   = initPaymentPage;
  window.applyGlobalFilter = function (fd) { renderTable(fd); };
  window.renderTable       = renderTable;
  window.buildMultiSelectFilters = buildMultiSelectFilters;

})();