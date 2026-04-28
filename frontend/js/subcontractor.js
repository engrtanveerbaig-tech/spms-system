/* ============================================================
   SPMS v2 — subcontractor.js
   Handles subcontractor CRUD, table filtering, edit/delete.
   ============================================================ */
(function () {
  const API = "https://spms-backend-jxzn.onrender.com/api";
  let ALL_SUBS = [];
  let EDIT_ID = null;

  function getToken() { return localStorage.getItem("token"); }
  function fmt(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function showMsg(text, isError) {
    const el = document.getElementById("msg");
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? "var(--red)" : "var(--green)";
    if (!isError) setTimeout(() => { if (el) el.textContent = ""; }, 3500);
  }

  // ── FETCH ALL SUBCONTRACTORS ────────────────────────────
  async function fetchSubs() {
    try {
      const res = await fetch(`${API}/subcontractors`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!Array.isArray(data)) { console.error("Invalid subs data:", data); return; }
      ALL_SUBS = data;
      populateFilterSelects(data);
      renderTable(data);
    } catch (err) {
      console.error("Fetch subs error:", err);
      showMsg("Failed to load subcontractors.", true);
    }
  }

  // ── POPULATE FILTER DROPDOWNS ───────────────────────────
  function populateFilterSelects(data) {
    const fields = {
      f_name: "subcontractor_name",
      f_contract: "contract_no",
      f_company: "company",
      f_phone: "phone",
      f_email: "email",
      f_vat: "vat_number",
      f_cr: "cr_number",
      f_iban: "advance_remaining"
    };
    Object.entries(fields).forEach(([selId, key]) => {
      const el = document.getElementById(selId);
      if (!el) return;
      const vals = [...new Set(data.map(x => x[key]).filter(Boolean))].sort();
      const cur = el.value;
      el.innerHTML = '<option value="">All</option>' + vals.map(v => `<option value="${v}">${v}</option>`).join("");
      if (vals.includes(cur)) el.value = cur;
    });
  }

  // ── RENDER TABLE ────────────────────────────────────────
  function renderTable(data) {
    const tb = document.getElementById("table");
    if (!tb) return;
    if (!data.length) {
      tb.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:22px">No subcontractors found.</td></tr>`;
      return;
    }
    tb.innerHTML = data.map(s => `
      <tr>
        <td>${s.project || "—"}</td>
        <td>${s.work_type || "—"}</td>
        <td>${s.subcontractor_name || "—"}</td>
        <td style="font-family:var(--mono)">${s.contract_no || "—"}</td>
        <td>${s.company || "—"}</td>
        <td>${s.phone || "—"}</td>
        <td>${s.email || "—"}</td>
        <td style="font-family:var(--mono)">${s.vat_number || "—"}</td>
        <td style="font-family:var(--mono)">${s.cr_number || "—"}</td>
        <td style="font-family:var(--mono);color:var(--green)">${fmt(s.advance_remaining || 0)}</td>
        <td>
          <button onclick="editSub(${s.id})">Edit</button>
          <button onclick="deleteSub(${s.id})">Delete</button>
        </td>
      </tr>`).join("");
  }

  // ── FILTER TABLE ─────────────────────────────────────────
  window.filterTable = function () {
    const fProject = document.getElementById("f_project")?.value || "";
    const fWork = document.getElementById("f_work")?.value || "";
    const fName = document.getElementById("f_name")?.value || "";
    const fContract = document.getElementById("f_contract")?.value || "";
    const fCompany = document.getElementById("f_company")?.value || "";
    const fPhone = document.getElementById("f_phone")?.value || "";
    const fEmail = document.getElementById("f_email")?.value || "";
    const fVat = document.getElementById("f_vat")?.value || "";
    const fCr = document.getElementById("f_cr")?.value || "";

    const filtered = ALL_SUBS.filter(s => {
      return (!fProject || s.project === fProject)
        && (!fWork || s.work_type === fWork)
        && (!fName || s.subcontractor_name === fName)
        && (!fContract || s.contract_no === fContract)
        && (!fCompany || s.company === fCompany)
        && (!fPhone || s.phone === fPhone)
        && (!fEmail || s.email === fEmail)
        && (!fVat || s.vat_number === fVat)
        && (!fCr || s.cr_number === fCr);
    });
    renderTable(filtered);
  };

  // ── VALIDATE EMAIL ───────────────────────────────────────
  function validateEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── COLLECT FORM DATA ────────────────────────────────────
  function collectForm() {
    return {
      project: document.getElementById("project")?.value || "",
      work_type: document.getElementById("work_type")?.value || "",
      retention_percent: document.getElementById("retention_percent")?.value || "10",
      vat_percent: document.getElementById("vat_percent")?.value || "15",
      has_advance: document.getElementById("has_advance")?.checked ? 1 : 0,
      advance_amount: parseFloat(document.getElementById("advance_amount")?.value) || 0,
      contract_no: document.getElementById("contract_no")?.value.trim() || "",
      company: document.getElementById("company")?.value.trim() || "",
      email: document.getElementById("email")?.value.trim() || "",
      cr_number: document.getElementById("cr")?.value.trim() || "",
      vat_number: document.getElementById("vat_number")?.value.trim() || "",
      subcontractor_name: document.getElementById("subcontractor_name")?.value.trim() || "",
      phone: document.getElementById("phone")?.value.trim() || ""
    };
  }

  // ── CLEAR FORM ───────────────────────────────────────────
  function clearForm() {
    ["project", "work_type", "contract_no", "company", "email", "cr", "vat_number", "subcontractor_name", "phone", "advance_amount"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const ha = document.getElementById("has_advance");
    if (ha) ha.checked = false;
    const rp = document.getElementById("retention_percent");
    if (rp) rp.value = "10";
    const vp = document.getElementById("vat_percent");
    if (vp) vp.value = "15";
    EDIT_ID = null;
    const btn = document.getElementById("mainBtn");
    if (btn) btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Subcontractor`;
    const emailErr = document.getElementById("email_error");
    if (emailErr) emailErr.style.display = "none";
  }

  // ── SAVE (ADD OR EDIT) ───────────────────────────────────
  window.save = async function () {
    const payload = collectForm();

    // Validation
    if (!payload.project) { showMsg("Please select a project.", true); return; }
    if (!payload.work_type) { showMsg("Please select a work type.", true); return; }
    if (!payload.subcontractor_name) { showMsg("Please enter subcontractor name.", true); return; }
    if (!payload.contract_no) { showMsg("Please enter contract number.", true); return; }

    const emailErr = document.getElementById("email_error");
    if (!validateEmail(payload.email)) {
      if (emailErr) emailErr.style.display = "block";
      showMsg("Invalid email format.", true);
      return;
    }
    if (emailErr) emailErr.style.display = "none";

    const btn = document.getElementById("mainBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = "Saving…"; }

    try {
      const url = EDIT_ID ? `${API}/subcontractors/${EDIT_ID}` : `${API}/subcontractors`;
      const method = EDIT_ID ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.message || "Save failed.", true); return; }
      showMsg(EDIT_ID ? "Subcontractor updated." : "Subcontractor added successfully.");
      clearForm();
      await fetchSubs();
    } catch (err) {
      console.error("Save error:", err);
      showMsg("Server error.", true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>${EDIT_ID ? "Update Subcontractor" : "Add Subcontractor"}`;
      }
    }
  };

  // ── EDIT ─────────────────────────────────────────────────
  window.editSub = function (id) {
    const s = ALL_SUBS.find(x => x.id === id);
    if (!s) return;
    EDIT_ID = id;

    const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ""; };
    setVal("project", s.project);
    setVal("work_type", s.work_type);
    setVal("retention_percent", s.retention_percent || "10");
    setVal("vat_percent", s.vat_percent || "15");
    setVal("advance_amount", s.advance_amount || "");
    setVal("contract_no", s.contract_no);
    setVal("company", s.company);
    setVal("email", s.email);
    setVal("cr", s.cr_number);
    setVal("vat_number", s.vat_number);
    setVal("subcontractor_name", s.subcontractor_name);
    setVal("phone", s.phone);

    const ha = document.getElementById("has_advance");
    if (ha) ha.checked = !!s.has_advance;

    const btn = document.getElementById("mainBtn");
    if (btn) btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Update Subcontractor`;

    // Scroll to form
    document.querySelector(".prem-card")?.scrollIntoView({ behavior: "smooth" });
    showMsg(`Editing: ${s.subcontractor_name}`);
  };

  // ── DELETE ───────────────────────────────────────────────
  window.deleteSub = async function (id) {
    const s = ALL_SUBS.find(x => x.id === id);
    if (!confirm(`Delete subcontractor "${s?.subcontractor_name || id}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/subcontractors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const data = await res.json();
      if (!res.ok) { showMsg(data.message || "Delete failed.", true); return; }
      showMsg("Subcontractor deleted.");
      await fetchSubs();
    } catch (err) {
      console.error("Delete error:", err);
      showMsg("Server error.", true);
    }
  };

  // ── INIT ─────────────────────────────────────────────────
  window.initSubcontractorPage = async function () {
    clearForm();
    await fetchSubs();

    // Email live validation
    const emailEl = document.getElementById("email");
    const emailErr = document.getElementById("email_error");
    if (emailEl && emailErr) {
      emailEl.addEventListener("blur", () => {
        emailErr.style.display = emailEl.value && !validateEmail(emailEl.value) ? "block" : "none";
      });
    }

    // Has advance toggle
    const ha = document.getElementById("has_advance");
    const advField = document.getElementById("advance_amount");
    if (ha && advField) {
      const toggle = () => { advField.disabled = !ha.checked; if (!ha.checked) advField.value = ""; };
      ha.addEventListener("change", toggle);
      toggle();
    }
  };

  // Auto-init if already in DOM
  if (document.getElementById("table")) {
    window.initSubcontractorPage();
  }
})();