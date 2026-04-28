/* ============================================================
   SPMS v2 — payment.js  (merged: old API paths + new features)
   New: cert_date, status (Approved/Under Review/On Site/Pending),
        comment, date-range filter on table.
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
const originalData  = window.originalData;

(function () {

  let editId = null;

  const STATUS_CFG = {
    "Approved":     { color:"#10b981", bg:"rgba(16,185,129,.13)",  icon:"✓"  },
    "Under Review": { color:"#f59e0b", bg:"rgba(245,158,11,.13)",  icon:"⏳" },
    "On Site":      { color:"#3b82f6", bg:"rgba(59,130,246,.13)",  icon:"📍" },
    "Pending":      { color:"#8b5cf6", bg:"rgba(139,92,246,.13)",  icon:"◷"  },
    "Rejected":     { color:"#ef4444", bg:"rgba(239,68,68,.13)",   icon:"✕"  }
  };

  function statusBadge(s) {
    const c = STATUS_CFG[s] || { color:"#4a5270", bg:"rgba(74,82,112,.12)", icon:"?" };
    return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;letter-spacing:.03em;color:${c.color};background:${c.bg};border:1px solid ${c.color}22;white-space:nowrap">${c.icon} ${s||"—"}</span>`;
  }

  function fmt(n) {
    return Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  // ── INIT ─────────────────────────────────────────────────
  function initPaymentPage() {
    ["work","withdrawn","deduction","refund"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", calculate);
    });

    const certDateEl = document.getElementById("cert_date");
    if (certDateEl && !certDateEl.value)
      certDateEl.value = new Date().toISOString().slice(0,10);

    document.getElementById("saveBtn")?.addEventListener("click", addPayment);
    document.getElementById("subcontractor_form")?.addEventListener("change", onSubcontractorChange);
    document.getElementById("work_type_form")?.addEventListener("change", loadSubcontractors);
    document.getElementById("date_from")?.addEventListener("change", applyFilter);
    document.getElementById("date_to")?.addEventListener("change", applyFilter);

    showTableSkeleton();
    loadFullData();
    loadSubcontractors();

    setTimeout(() => {
      const wt = document.getElementById("work_type_form")?.value;
      if (wt) loadSubcontractors();
    }, 200);

    initExportButton();
  }

  // ── LOAD SUBS BY WORK TYPE ───────────────────────────────
  async function loadSubcontractors() {
    const work_type = document.getElementById("work_type_form")?.value;
    const select    = document.getElementById("subcontractor_form");
    if (!select) return;

    if (!work_type) {
      select.innerHTML = "<option>Select Work Type First</option>";
      return;
    }

    const res = await fetch(`${window.API}/api/subcontractors/by-type/${work_type}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { console.error("Sub API error:", await res.text()); return; }
    const data = await res.json();
    if (!Array.isArray(data)) { console.error("Invalid sub response:", data); return; }

    select.innerHTML = "<option value=''>Select Subcontractor</option>";
    data.forEach(s => {
      select.innerHTML += `<option value="${s.id}">${s.name} (${s.project}) - ${s.company_name}</option>`;
    });

    if (!select.value && select.options.length > 1) {
      select.value = select.options[1].value;
      select.dispatchEvent(new Event("change"));
    }
  }

  // ── CALCULATE ────────────────────────────────────────────
  function calculate() {
    const work      = +(document.getElementById("work")?.value)      || 0;
    const withdrawn = +(document.getElementById("withdrawn")?.value) || 0;
    const deduction = +(document.getElementById("deduction")?.value) || 0;
    const refund    = +(document.getElementById("refund")?.value)    || 0;
    const after     = work - withdrawn - deduction + refund;

    const retPct = window.currentRetention || 10;
    let vatPct   = Number(window.currentVat); if (isNaN(vatPct)) vatPct = 0;

    let advDeduction = 0, vatAmt = 0, retAmt = 0, netAmt = 0;
    const hasAdv = window.currentAdvance && window.currentAdvance > 0 && after > 0;

    if (hasAdv) {
      advDeduction = Math.min(after * 0.25, window.currentAdvance);
      const afterAdv = after - advDeduction;
      vatAmt = afterAdv * (vatPct / 100);
      retAmt = after    * (retPct / 100);
      netAmt = afterAdv + vatAmt - retAmt;
    } else {
      vatAmt = after * (vatPct / 100);
      retAmt = after * (retPct / 100);
      netAmt = after + vatAmt - retAmt;
    }

    const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v.toFixed(2); };
    sv("vat",               vatAmt);
    sv("retention",         retAmt);
    sv("net",               netAmt);
    sv("advance_deduction", advDeduction);
  }

  // ── ADD / UPDATE ─────────────────────────────────────────
  async function addPayment() {
    const work      = +(document.getElementById("work")?.value)      || 0;
    const withdrawn = +(document.getElementById("withdrawn")?.value) || 0;
    const deduction = +(document.getElementById("deduction")?.value) || 0;
    const refund    = +(document.getElementById("refund")?.value)    || 0;
    const after     = work - withdrawn - deduction + refund;

    let advDeduction = 0;
    if (window.originalAdvance && window.originalAdvance > 0 && after > 0) {
      advDeduction = Math.min(after * 0.25, window.currentAdvance);
    }

    let vatPct   = Number(window.currentVat); if (isNaN(vatPct)) vatPct = 0;
    let retPct   = window.currentRetention || 10;
    let vatAmt   = 0, retAmt = 0, netAmt = 0;
    const hasAdv = window.currentAdvance && window.currentAdvance > 0 && after > 0;

    if (hasAdv) {
      const afterAdv = after - advDeduction;
      vatAmt = afterAdv * (vatPct / 100);
      retAmt = after    * (retPct / 100);
      netAmt = afterAdv + vatAmt - retAmt;
    } else {
      vatAmt = after * (vatPct / 100);
      retAmt = after * (retPct / 100);
      netAmt = after + vatAmt - retAmt;
    }

    const subcontractorId = document.getElementById("subcontractor_form")?.value;
    if (!subcontractorId) { alert("Please select subcontractor ❌"); return; }

    const payload = {
      subcontractor_id:  +subcontractorId,
      certificate_no:    +(document.getElementById("certificate_no")?.value) || 0,
      project_name:      document.getElementById("project_form")?.value      || "",
      project_id:        1,
      contract_number:   document.getElementById("contract_number")?.value   || "",
      work_type:         document.getElementById("work_type_form")?.value     || "",
      work_value:        work,
      work_withdrawn:    withdrawn,
      deduction,
      refund,
      after_deduction:   after,
      vat_amount:        vatAmt,
      retention_amount:  retAmt,
      advance_deduction: advDeduction,
      net_payment:       netAmt,
      cert_date:         document.getElementById("cert_date")?.value          || new Date().toISOString().slice(0,10),
      status:            document.getElementById("cert_status")?.value         || "Approved",
      comment:           document.getElementById("cert_comment")?.value?.trim()|| ""
    };

    let url = `${window.API}/api/payments/add`, method = "POST";
    if (editId) { url = `${window.API}/api/payments/update/${editId}`; method = "PUT"; }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${localStorage.getItem("token")}` },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { alert("Save failed ❌"); return; }

    const msgEl = document.getElementById("msg");
    if (msgEl) { msgEl.innerText = "Saved ✓"; setTimeout(() => { msgEl.innerText = ""; }, 3000); }

    const currentSub = document.getElementById("subcontractor_form")?.value;
    const wasEdit    = !!editId;
    editId           = null;

    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.innerText = "Save Payment Certificate";

    ["work","withdrawn","deduction","refund","cert_comment","vat","retention","net","advance_deduction"].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = "";
    });
    const statusEl = document.getElementById("cert_status"); if (statusEl) statusEl.value = "Approved";
    const dateEl   = document.getElementById("cert_date");   if (dateEl)   dateEl.value   = new Date().toISOString().slice(0,10);

    if (!wasEdit) {
      await loadSubcontractors();
      const sel = document.getElementById("subcontractor_form");
      if (sel && currentSub) { sel.value = currentSub; sel.dispatchEvent(new Event("change")); }
    }

    await loadFullData();
  }

  // ── LOAD FULL DATA ───────────────────────────────────────
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

    populateFilters(originalData);
    loadBulkOptions();
    renderTable(originalData);
  }

  // ── BULK OPTIONS ─────────────────────────────────────────
  function loadBulkOptions() {
    const companies     = [...new Set(originalData.map(p => p.company_name))];
    const companySelect = document.getElementById("bulk_company");
    const subSelect     = document.getElementById("bulk_sub");
    if (!companySelect || !subSelect) return;

    companySelect.innerHTML = "<option value=''>Select Company</option>";
    companies.forEach(c => { companySelect.innerHTML += `<option>${c}</option>`; });

    companySelect.onchange = function () {
      const co     = this.value;
      const unique = [...new Set(originalData.filter(p => p.company_name===co).map(p => p.subcontractor_name))];
      subSelect.innerHTML = "<option value=''>Select Subcontractor</option>";
      unique.forEach(s => { subSelect.innerHTML += `<option>${s}</option>`; });

      subSelect.onchange = function () {
        const su     = subSelect.value;
        const works  = [...new Set(originalData.filter(p => p.company_name===co && p.subcontractor_name===su).map(p => p.work_type))];
        const workSel = document.getElementById("bulk_work");
        if (!workSel) return;
        workSel.innerHTML = "<option value=''>Select Work Type</option>";
        works.forEach(w => { workSel.innerHTML += `<option>${w}</option>`; });
      };
    };
  }

  // ── APPLY FILTER ─────────────────────────────────────────
  window.applyFilter = function () {
    const f     = id => document.getElementById(id)?.value || "";
    const dFrom = f("date_from");
    const dTo   = f("date_to");

    const allEmpty = [
      "f_scid","f_project","f_contract","f_company","f_sub","f_work","f_cert",
      "f_workval","f_withdrawn","f_deduction","f_refund",
      "f_after","f_vat","f_retention","f_advance","f_net","f_date","f_status"
    ].every(id => !document.getElementById(id)?.value) && !dFrom && !dTo;

    let data = originalData;

    if (!allEmpty) {
      data = originalData.filter(p => {
        const pDate  = (p.cert_date || p.created_at || "").slice(0,10);
        return (
          (!f("f_scid")     || p.subcontractor_id     == f("f_scid")) &&
          (!f("f_project")  || p.project_name         == f("f_project")) &&
          (!f("f_contract") || p.contract_number       == f("f_contract")) &&
          (!f("f_company")  || p.company_name          == f("f_company")) &&
          (!f("f_sub")      || p.subcontractor_name    == f("f_sub")) &&
          (!f("f_work")     || p.work_type             == f("f_work")) &&
          (!f("f_cert")     || p.certificate_no        == f("f_cert")) &&
          (!f("f_workval")  || p.work_value            == f("f_workval")) &&
          (!f("f_withdrawn")|| p.work_withdrawn        == f("f_withdrawn")) &&
          (!f("f_deduction")|| p.deduction             == f("f_deduction")) &&
          (!f("f_refund")   || p.refund                == f("f_refund")) &&
          (!f("f_after")    || p.after_deduction       == f("f_after")) &&
          (!f("f_vat")      || p.vat_amount            == f("f_vat")) &&
          (!f("f_retention")|| p.retention_amount      == f("f_retention")) &&
          (!f("f_advance")  || p.advance_deduction     == f("f_advance")) &&
          (!f("f_net")      || p.net_payment           == f("f_net")) &&
          (!f("f_status")   || p.status                == f("f_status")) &&
          (!f("f_date")     || (p.created_at||"").slice(0,10) === f("f_date")) &&
          (!dFrom || pDate >= dFrom) &&
          (!dTo   || pDate <= dTo)
        );
      });
    }

    if (!allEmpty) updateDependentFilters(data); else populateFilters(originalData);
    renderTable(data);
  };

  // ── RENDER TABLE ─────────────────────────────────────────
  function renderTable(data) {
    const table = document.getElementById("table");
    if (!table) return;
    table.innerHTML = "";

    let t = { work:0, wd:0, ded:0, ref:0, after:0, vat:0, ret:0, adv:0, net:0 };

    data.forEach(p => {
      t.work  += +p.work_value       || 0;
      t.wd    += +p.work_withdrawn   || 0;
      t.ded   += +p.deduction        || 0;
      t.ref   += +p.refund           || 0;
      t.after += +p.after_deduction  || 0;
      t.vat   += +p.vat_amount       || 0;
      t.ret   += +p.retention_amount || 0;
      t.adv   += +p.advance_deduction|| 0;
      t.net   += +p.net_payment      || 0;

      const certDate    = p.cert_date  ? new Date(p.cert_date).toLocaleDateString()  : "—";
      const createdDate = p.created_at ? new Date(p.created_at).toLocaleDateString() : "—";
      const netColor    = p.net_payment < 0 ? "#ef4444" : "#10b981";
      const commentIcon = p.comment
        ? `<span title="${(p.comment||"").replace(/"/g,"&quot;")}" style="cursor:help;color:#f59e0b;font-size:13px">💬</span>&nbsp;`
        : "";
      const commentText = p.comment
        ? `<span style="color:var(--text3);font-size:10px">${p.comment.slice(0,36)}${p.comment.length>36?"…":""}</span>`
        : "";

      const row = document.createElement("tr");
      row.innerHTML =
        `<td style="font-family:var(--mono)">${p.subcontractor_id||"—"}</td>`+
        `<td>${p.project_name||"—"}</td>`+
        `<td style="font-family:var(--mono)">${p.contract_number||"—"}</td>`+
        `<td>${p.company_name||"—"}</td>`+
        `<td>${p.subcontractor_name||"—"}</td>`+
        `<td>${p.work_type||"—"}</td>`+
        `<td style="font-family:var(--mono)">${p.certificate_no||"—"}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.work_value)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.work_withdrawn)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.deduction)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.refund)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.after_deduction)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.vat_amount)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.retention_amount)}</td>`+
        `<td style="font-family:var(--mono)">${fmt(p.advance_deduction||0)}</td>`+
        `<td style="font-family:var(--mono);color:${netColor};font-weight:600">${fmt(p.net_payment)}</td>`+
        `<td style="white-space:nowrap">${certDate}</td>`+
        `<td style="white-space:nowrap">${createdDate}</td>`+
        `<td>${statusBadge(p.status)}</td>`+
        `<td style="max-width:130px;white-space:normal">${commentIcon}${commentText}</td>`+
        `<td>`+
          `<button onclick="editPayment(${p.id})">Edit</button>`+
          `<button onclick="deletePayment(${p.id})">Delete</button>`+
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

  // ── EDIT ─────────────────────────────────────────────────
  window.editPayment = function (id) {
    const p = originalData.find(x => x.id === id);
    if (!p) return;
    editId = id;

    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.innerText = "Update Certificate";

    const wtEl = document.getElementById("work_type_form");
    if (wtEl) { wtEl.value = p.work_type || ""; wtEl.dispatchEvent(new Event("change")); }

    setTimeout(async () => {
      const subEl = document.getElementById("subcontractor_form");
      if (subEl) { subEl.value = p.subcontractor_id; await onSubcontractorChange(); }

      const sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
      sv("work",           p.work_value);
      sv("withdrawn",      p.work_withdrawn);
      sv("deduction",      p.deduction);
      sv("refund",         p.refund);
      sv("certificate_no", p.certificate_no);
      sv("cert_date",      (p.cert_date||"").slice(0,10) || new Date().toISOString().slice(0,10));
      sv("cert_status",    p.status  || "Approved");
      sv("cert_comment",   p.comment || "");

      calculate();
      document.querySelector(".pay-sec")?.scrollIntoView({ behavior:"smooth" });
    }, 400);
  };

  // ── DELETE ───────────────────────────────────────────────
  window.deletePayment = async function (id) {
    const p = originalData.find(x => x.id === id);
    if (!confirm(`Delete certificate #${p?.certificate_no||id}?`)) return;

    const res = await fetch(`${window.API}/api/payments/delete/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    if (!res.ok) { alert("Delete failed ❌"); return; }

    const idx = originalData.findIndex(x => x.id === id);
    if (idx !== -1) originalData.splice(idx, 1);
    renderTable(originalData);
  };

  // ── ON SUB CHANGE ────────────────────────────────────────
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
    sv("advance_remaining",         (advRem||0).toFixed(2));
    sv("retention_percent_display", (window.currentRetention||0)+"%");
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
      const maxCert = certs.reduce((mx, p) => Math.max(mx, Number(p.certificate_no)||0), 0);
      sv("certificate_no", maxCert + 1);
    }

    calculate();
  }

  // ── POPULATE FILTERS ─────────────────────────────────────
  function populateFilters(data) {
    const map = [
      {id:"f_scid",      key:"subcontractor_id"},
      {id:"f_project",   key:"project_name"},
      {id:"f_contract",  key:"contract_number"},
      {id:"f_company",   key:"company_name"},
      {id:"f_sub",       key:"subcontractor_name"},
      {id:"f_work",      key:"work_type"},
      {id:"f_cert",      key:"certificate_no"},
      {id:"f_workval",   key:"work_value"},
      {id:"f_withdrawn", key:"work_withdrawn"},
      {id:"f_deduction", key:"deduction"},
      {id:"f_refund",    key:"refund"},
      {id:"f_after",     key:"after_deduction"},
      {id:"f_vat",       key:"vat_amount"},
      {id:"f_retention", key:"retention_amount"},
      {id:"f_advance",   key:"advance_deduction"},
      {id:"f_net",       key:"net_payment"},
      {id:"f_status",    key:"status"},
      {id:"f_date",      key:"created_at"}
    ];
    map.forEach(f => {
      const sel = document.getElementById(f.id);
      if (!sel) return;
      const cur  = sel.value;
      const vals = [...new Set(data.map(x =>
        f.key === "created_at" ? (x[f.key]||"").slice(0,10) : x[f.key]
      ).filter(v => v !== null && v !== undefined && v !== ""))].sort();
      sel.innerHTML = '<option value="">All</option>' + vals.map(v => `<option value="${v}">${v}</option>`).join("");
      if (cur && vals.includes(cur)) sel.value = cur;
    });
  }

  function updateDependentFilters(filteredData) {
    const saved = {};
    ["f_company","f_sub","f_work","f_contract","f_cert","f_status"].forEach(id => {
      saved[id] = document.getElementById(id)?.value;
    });
    [{id:"f_company",key:"company_name"},{id:"f_sub",key:"subcontractor_name"},
     {id:"f_work",key:"work_type"},{id:"f_contract",key:"contract_number"},
     {id:"f_cert",key:"certificate_no"},{id:"f_status",key:"status"}
    ].forEach(f => {
      const sel = document.getElementById(f.id); if (!sel) return;
      const vals = [...new Set(filteredData.map(x => x[f.key]).filter(v => v))];
      sel.innerHTML = '<option value="">All</option>' + vals.map(v => `<option value="${v}">${v}</option>`).join("");
      if (saved[f.id] && vals.includes(saved[f.id])) sel.value = saved[f.id];
    });
  }

  // ── BULK DELETE ──────────────────────────────────────────
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
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${localStorage.getItem("token")}` },
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

  // ── PRINT ────────────────────────────────────────────────
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
      <p><b>Status:</b> ${p.status || "—"}</p>
      <p><b>Comment:</b> ${p.comment || "—"}</p>
      <p><b>Net Payment:</b> ${p.net_payment}</p>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  // ── EXPORT ───────────────────────────────────────────────
  function getFilteredDataForExport() {
    const f    = id => document.getElementById(id)?.value || "";
    const dF   = f("date_from"), dT = f("date_to");
    return originalData.filter(p => {
      const pDate = (p.cert_date || p.created_at || "").slice(0,10);
      return (
        (!f("f_scid")     || p.subcontractor_id    == f("f_scid")) &&
        (!f("f_project")  || p.project_name         == f("f_project")) &&
        (!f("f_contract") || p.contract_number       == f("f_contract")) &&
        (!f("f_company")  || p.company_name          == f("f_company")) &&
        (!f("f_sub")      || p.subcontractor_name    == f("f_sub")) &&
        (!f("f_work")     || p.work_type             == f("f_work")) &&
        (!f("f_cert")     || p.certificate_no        == f("f_cert")) &&
        (!f("f_status")   || p.status                == f("f_status")) &&
        (!dF || pDate >= dF) && (!dT || pDate <= dT)
      );
    });
  }

  function initExportButton() {
    const btn = document.getElementById("exportBtn");
    if (!btn) return;
    btn.onclick = function () {
      const filtered = getFilteredDataForExport();
      filtered.sort((a,b) =>
        (a.project_name||"").localeCompare(b.project_name||"") ||
        (a.work_type||"").localeCompare(b.work_type||"") ||
        (a.subcontractor_name||"").localeCompare(b.subcontractor_name||"") ||
        Number(a.certificate_no) - Number(b.certificate_no)
      );
      if (!filtered.length) { alert("No data to export"); return; }

      const groups = {};
      filtered.forEach(p => {
        const key = `${p.project_name}__${p.work_type}__${p.subcontractor_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      const sColor = s => (STATUS_CFG[s]?.color || "#333");

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
        let t = {work:0,wd:0,ded:0,ref:0,after:0,vat:0,ret:0,adv:0,net:0};
        records.forEach(p => {
          t.work  += +p.work_value||0;  t.wd   += +p.work_withdrawn||0;
          t.ded   += +p.deduction||0;   t.ref  += +p.refund||0;
          t.after += +p.after_deduction||0; t.vat += +p.vat_amount||0;
          t.ret   += +p.retention_amount||0; t.adv += +p.advance_deduction||0;
          t.net   += +p.net_payment||0;
        });

        html += `<div class="page">
          <h1>📊 Payment Certificate Report</h1>
          <h3>Project: ${first.project_name}</h3>
          <div style="font-size:12px;line-height:1.7;margin-bottom:6px">
            <b>Subcontractor:</b> <span style="color:#d35400">${first.subcontractor_name}</span>
            &nbsp;|&nbsp;<b>Work:</b> ${first.work_type}<br>
            <b>Company:</b> ${first.company_name||"—"} &nbsp;|&nbsp;<b>Contract:</b> ${first.contract_number||"—"}<br>
            <b>Phone:</b> ${first.phone||"—"} &nbsp;|&nbsp;<b>Email:</b> ${first.email||"—"}<br>
            <b>VAT No:</b> ${first.vat_number||"—"} &nbsp;|&nbsp;<b>CR:</b> ${first.cr_number||"—"}
          </div>
          <p style="font-size:12px;margin:4px 0">
            <b>Initial Advance:</b> ${Number(first.initial_advance||0).toFixed(2)}
            &nbsp;|&nbsp;<b>Remaining:</b> ${Number(first.advance_remaining||0).toFixed(2)}
          </p>
          <h4>Summary</h4>
          <table><tr><th>Total Work</th><th>Withdrawn</th><th>Deduction</th><th>Refund</th><th>After</th><th>VAT</th><th>Retention</th><th>Net</th></tr>
          <tr><td>${fmt(t.work)}</td><td>${fmt(t.wd)}</td><td>${fmt(t.ded)}</td><td>${fmt(t.ref)}</td><td>${fmt(t.after)}</td><td>${fmt(t.vat)}</td><td>${fmt(t.ret)}</td><td>${fmt(t.net)}</td></tr></table>
          <h4>Details</h4>
          <table>
            <tr><th>Cert#</th><th>Work</th><th>Withdrawn</th><th>Deduction</th><th>Refund</th><th>After</th><th>VAT</th><th>Retention</th><th>Advance</th><th>Net</th><th>Cert Date</th><th>Status</th><th>Comment</th></tr>
            ${records.map(p => `<tr>
              <td>${p.certificate_no}</td><td>${fmt(p.work_value)}</td><td>${fmt(p.work_withdrawn)}</td>
              <td>${fmt(p.deduction)}</td><td>${fmt(p.refund)}</td><td>${fmt(p.after_deduction)}</td>
              <td>${fmt(p.vat_amount)}</td><td>${fmt(p.retention_amount)}</td>
              <td>${fmt(p.advance_deduction||0)}</td><td>${fmt(p.net_payment)}</td>
              <td>${p.cert_date ? new Date(p.cert_date).toLocaleDateString() : "—"}</td>
              <td><b style="color:${sColor(p.status)}">${p.status||"—"}</b></td>
              <td style="text-align:left;font-size:10px">${p.comment||""}</td>
            </tr>`).join("")}
            <tr class="tot"><td>TOTAL</td><td>${fmt(t.work)}</td><td>${fmt(t.wd)}</td><td>${fmt(t.ded)}</td><td>${fmt(t.ref)}</td><td>${fmt(t.after)}</td><td>${fmt(t.vat)}</td><td>${fmt(t.ret)}</td><td>${fmt(t.adv)}</td><td>${fmt(t.net)}</td><td colspan="3"></td></tr>
          </table>
          <p style="margin-top:10px;font-size:10px;color:#888">Prepared by: Eng. Tanveer Ahmad &nbsp;·&nbsp; SPMS v2.0 &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</p>
        </div>`;
      });

      html += "</body></html>";
      const win = window.open("","","width=960,height=750");
      win.document.write(html); win.document.close();
    };
  }

  // ── GLOBALS ──────────────────────────────────────────────
  window.initPaymentPage   = initPaymentPage;
  window.applyGlobalFilter = function(fd) { renderTable(fd); };
  window.renderTable       = renderTable;

})();