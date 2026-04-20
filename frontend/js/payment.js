if (!window.selectedProject) {
    window.selectedProject = "";
}
if (!window.API) {
    window.API = "https://spms-backend-jxzn.onrender.com";
}
let originalData = [];
(function () {

let editId = null;
let fullData = [];
function formatNumber(n) {
    return Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


// INIT
function initPaymentPage() {

    const work = document.getElementById("work");
    const withdrawn = document.getElementById("withdrawn");
    const deduction = document.getElementById("deduction");
    const refund = document.getElementById("refund");

    const vat = document.getElementById("vat");
    const retention = document.getElementById("retention");
    const net = document.getElementById("net");

    work.oninput = calculate;
    withdrawn.oninput = calculate;
    deduction.oninput = calculate;
    refund.oninput = calculate;

    document.getElementById("saveBtn").onclick = addPayment;

    // 🔥 ADD THESE (MISSING)
    loadFullData();   // ONLY load data for filters       // full data for filters         // ✅ load table
    loadSubcontractors();         // ✅ load dropdown

    document.getElementById("subcontractor_form")
        ?.addEventListener("change", onSubcontractorChange);

    document.getElementById("work_type_form")
        ?.addEventListener("change", loadSubcontractors);

    // ✅ AUTO LOAD FIRST SUBCONTRACTOR IF WORK TYPE ALREADY SELECTED
setTimeout(() => {
    const wt = document.getElementById("work_type_form").value;
    if (wt) {
        loadSubcontractors(); // will auto select first
    }
}, 200);

document.getElementById("table").innerHTML = "";
}


// ================= LOAD SUBS BY WORK TYPE =================
async function loadSubcontractors() {

    const work_type = document.getElementById("work_type_form").value;

    const select = document.getElementById("subcontractor_form");

    if (!work_type) {
        select.innerHTML = "<option>Select Work Type First</option>";
        return;
    }

    const res = await fetch(`${API}/api/subcontractors/by-type/${work_type}`);

    const data = await res.json();

    select.innerHTML = "<option value=''>Select Subcontractor</option>";

    data.forEach(s => {
       select.innerHTML += `<option value="${s.id}">
    ${s.name} (${s.project}) - ${s.company_name}
</option>`;
    });
    // 🔥 AUTO SELECT FIRST + TRIGGER
// ✅ ONLY AUTO SELECT IF NOTHING SELECTED
if (!select.value && select.options.length > 1) {
    select.value = select.options[1].value;
    select.dispatchEvent(new Event("change"));
}

}


// ================= CALCULATE =================
function calculate() {

    const after =
        (+work.value || 0)
        - (+withdrawn.value || 0)
        - (+deduction.value || 0)
        + (+refund.value || 0);

    const retentionPercent = window.currentRetention || 10;
    let vatPercent = Number(window.currentVat);
    if (isNaN(vatPercent)) vatPercent = 0;

    let advanceDeduction = 0;
    let vatAmount = 0;
    let retentionAmount = 0;
    let netAmount = 0;

    // ================= 🔥 ADVANCE CONDITION =================
    const hasAdvance =
        window.currentAdvance &&
        window.currentAdvance > 0 &&
        after > 0; // ✅ VERY IMPORTANT

    if (hasAdvance) {

        // B = 25% of A
        advanceDeduction = after * 0.25;

        if (advanceDeduction > window.currentAdvance) {
            advanceDeduction = window.currentAdvance;
        }

        // C = A - B
        const afterAdvance = after - advanceDeduction;

        // VAT on C
        vatAmount = afterAdvance * (vatPercent / 100);

        // Retention ALWAYS on A
        retentionAmount = after * (retentionPercent / 100);

        // NET
        netAmount = afterAdvance + vatAmount - retentionAmount;

    } else {

        // NO ADVANCE
        vatAmount = after * (vatPercent / 100);

        retentionAmount = after * (retentionPercent / 100);

        netAmount = after + vatAmount - retentionAmount;
    }

    // ================= OUTPUT =================
    vat.value = vatAmount.toFixed(2);
    retention.value = retentionAmount.toFixed(2);
    net.value = netAmount.toFixed(2);

    const advField = document.getElementById("advance_deduction");
    if (advField) {
        advField.value = advanceDeduction.toFixed(2);
    }
}

// ================= ADD / UPDATE =================
async function addPayment() {

    let advanceDeduction = 0; // ✅ MUST BE FIRST

    const after =
        (+work.value || 0)
        - (+withdrawn.value || 0)
        - (+deduction.value || 0)
        + (+refund.value || 0);

    // ✅ CALCULATE ADVANCE
    if (
    window.originalAdvance &&
    window.originalAdvance > 0 &&
    after > 0
) {

        advanceDeduction = after * 0.25;

        if (advanceDeduction > window.currentAdvance) {
            advanceDeduction = window.currentAdvance;
        }
    }

    let vatPercent = Number(window.currentVat);
if (isNaN(vatPercent)) vatPercent = 0;

let retentionPercent = window.currentRetention || 10;

let vatAmount = 0;
let retentionAmount = 0;
let netAmount = 0;

const hasAdvance =
    window.currentAdvance &&
    window.currentAdvance > 0 &&
    after > 0;

if (hasAdvance) {

    const afterAdvance = after - advanceDeduction;

    vatAmount = afterAdvance * (vatPercent / 100);
    retentionAmount = after * (retentionPercent / 100);

    netAmount = afterAdvance + vatAmount - retentionAmount;

} else {

    vatAmount = after * (vatPercent / 100);
    retentionAmount = after * (retentionPercent / 100);

    netAmount = after + vatAmount - retentionAmount;
}

    const subcontractorId = document.getElementById("subcontractor_form").value;

// ❌ STOP if not selected
if (!subcontractorId) {
    alert("Please select subcontractor ❌");
    return;
}

// 🔥 GET PROJECT NAME FIRST (OUTSIDE data)
const projectName = document.getElementById("project_form").value || "";

const data = {
    subcontractor_id: +document.getElementById("subcontractor_form").value || 0,

    certificate_no: +document.getElementById("certificate_no").value || 0, // ✅ FIX

    project_name: projectName,
    project_id: 1,

    contract_number: document.getElementById("contract_number").value || "",
    work_type: document.getElementById("work_type_form").value || "",

    work_value: +work.value || 0,
    work_withdrawn: +withdrawn.value || 0,
    deduction: +deduction.value || 0,
    refund: +refund.value || 0,

    after_deduction: after || 0,
    vat_amount: vatAmount || 0,
    retention_amount: retentionAmount || 0,
    advance_deduction: advanceDeduction || 0,
    net_payment: netAmount || 0
};
// 🔍 DEBUG
console.log("FINAL DATA:", data);

    let url = `${API}/api/payments/add`;
let method = "POST";

if (editId) {
    url = `${API}/api/payments/update/${editId}`;
    method = "PUT";
}

    const res = await fetch(url, {
    method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    document.getElementById("msg").innerText = await res.text();

    

    // ✅ SAVE FIRST
const currentSub = document.getElementById("subcontractor_form").value;

// store mode BEFORE reset
const isEdit = !!editId;

// 🔥 RESET EDIT MODE FIRST
editId = null;
document.getElementById("saveBtn").innerText = "Save Payment";

// 🔥 CLEAR FORM
document.querySelectorAll("input").forEach(i => i.value = "");

// reload subcontractors ONLY for ADD
if (!isEdit) {
    await loadSubcontractors();

    const select = document.getElementById("subcontractor_form");

    if (currentSub) {
        select.value = currentSub;
        select.dispatchEvent(new Event("change"));
    }
}

// reload table
// ✅ DO NOT reload everything
console.log("Payment saved, no full reload");
// ✅ SEND TO DASHBOARD (NO RELOAD)
if (window.updateDashboardLive) {
    window.updateDashboardLive(data);
}
}

// ================= LOAD =================
async function loadFullData() {
    const res = await fetch(`${window.API}/api/payments/all-full`);
    originalData = await res.json();

    populateFilters(originalData);
    loadBulkOptions();
}
let currentPage = 1;

function loadBulkOptions() {

    const companies = [...new Set(originalData.map(p => p.company_name))];

    const companySelect = document.getElementById("bulk_company");
    const subSelect = document.getElementById("bulk_sub");

    if (!companySelect || !subSelect) return;

    // COMPANY
    companySelect.innerHTML = "<option value=''>Select Company</option>";

    companies.forEach(c => {
        companySelect.innerHTML += `<option>${c}</option>`;
    });

    // WHEN COMPANY CHANGE → LOAD SUBS
    companySelect.onchange = function () {

    const selectedCompany = this.value;

    const subs = originalData
        .filter(p => p.company_name === selectedCompany)
        .map(p => p.subcontractor_name);

    const uniqueSubs = [...new Set(subs)];

    subSelect.innerHTML = "<option value=''>Select Subcontractor</option>";

    uniqueSubs.forEach(s => {
        subSelect.innerHTML += `<option>${s}</option>`;
    });

    // ✅ MOVE OUTSIDE LOOP
    subSelect.onchange = function () {

        const selectedSub = subSelect.value;

        const works = originalData
            .filter(p =>
                p.company_name === selectedCompany &&
                p.subcontractor_name === selectedSub
            )
            .map(p => p.work_type);

        const uniqueWorks = [...new Set(works)];

        const workSelect = document.getElementById("bulk_work");

        if (!workSelect) return;

        workSelect.innerHTML = "<option value=''>Select Work Type</option>";

        uniqueWorks.forEach(w => {
            workSelect.innerHTML += `<option>${w}</option>`;
        });
    };
};
}

// ================= FILTER DROPDOWN =================
function fillFilters() {

    const subs = [...new Set(originalData.map(p => p.subcontractor_name))];
    const projects = [...new Set(originalData.map(p => p.project_name))];

    filter_sub.innerHTML = "<option value=''>All</option>";
    filter_project.innerHTML = "<option value=''>All</option>";

    subs.forEach(s => filter_sub.innerHTML += `<option>${s}</option>`);
    projects.forEach(p => filter_project.innerHTML += `<option>${p}</option>`);
}

// ================= APPLY FILTER =================
function applyFilter() {

    const f = id => document.getElementById(id)?.value;

    const isAllEmpty =
        !f("f_scid") &&
        !f("f_project") &&
        !f("f_contract") &&
        !f("f_company") &&
        !f("f_sub") &&
        !f("f_work") &&
        !f("f_cert");

    let data = originalData;

    // ✅ IF ANY FILTER SELECTED → FILTER DATA
    if (!isAllEmpty) {
        data = originalData.filter(p =>
            (!f("f_scid") || p.subcontractor_id == f("f_scid")) &&
            (!f("f_project") || p.project_name == f("f_project")) &&
            (!f("f_contract") || p.contract_number == f("f_contract")) &&
            (!f("f_company") || p.company_name == f("f_company")) &&
            (!f("f_sub") || p.subcontractor_name == f("f_sub")) &&
            (!f("f_work") || p.work_type == f("f_work")) &&
            (!f("f_cert") || p.certificate_no == f("f_cert"))
        );
    }

    // ✅ IF ALL FILTERS = ALL → SHOW ALL DATA
    renderTable(data);
}

function resetFilter() {
    filter_sub.value = "";
    filter_project.value = "";
    renderTable(originalData);
}

function applyCurrentFilterForExport(data) {

    const f = id => document.getElementById(id)?.value;

    return data.filter(p =>
        (!f("f_contract") || p.contract_number == f("f_contract")) &&
        (!f("f_sub") || p.subcontractor_name == f("f_sub")) &&
        (!f("f_work") || p.work_type == f("f_work")) &&
        (!f("f_project") || p.project_name == f("f_project"))
    );
}

// ================= RENDER =================
function renderTable(data) {

    // ✅ ADD THIS HERE (VERY IMPORTANT)
    data.sort((a, b) =>
        Number(a.certificate_no) - Number(b.certificate_no)
    );

    const table = document.getElementById("table");
    table.innerHTML = "";

    let t_work=0,t_withdrawn=0,t_deduction=0,t_refund=0,
    t_after=0,t_vat=0,t_retention=0,t_advance=0,t_net=0;

    data.forEach(p => {

        t_work += +p.work_value || 0;
        t_withdrawn += +p.work_withdrawn || 0;
        t_deduction += +p.deduction || 0;
        t_refund += +p.refund || 0;
        t_after += +p.after_deduction || 0;
        t_vat += +p.vat_amount || 0;
        t_retention += +p.retention_amount || 0;
        t_advance += +p.advance_deduction || 0;
        t_net += +p.net_payment || 0;

        const row = document.createElement("tr");

        row.innerHTML =
        "<td>"+p.subcontractor_id+"</td>"+   // ✅ NEW COLUMN
            "<td>"+p.project_name+"</td>"+
            "<td>"+(p.contract_number || "")+"</td>"+
            "<td>"+(p.company_name || "")+"</td>"+ 
            "<td>"+p.subcontractor_name+"</td>"+
            "<td>"+p.work_type+"</td>"+
            "<td>"+p.certificate_no+"</td>"+
            "<td>"+formatNumber(p.work_value)+"</td>"+
            "<td>"+formatNumber(p.work_withdrawn)+"</td>"+
            "<td>"+formatNumber(p.deduction)+"</td>"+
            "<td>"+formatNumber(p.refund)+"</td>"+
            "<td>"+formatNumber(p.after_deduction)+"</td>"+
            "<td>"+formatNumber(p.vat_amount)+"</td>"+
            "<td>"+formatNumber(p.retention_amount)+"</td>"+
            "<td>"+formatNumber(p.advance_deduction || 0)+"</td>"+   // ✅ NEW
            "<td style='color:" + (p.net_payment < 0 ? "red" : "black") + "'>"
+ formatNumber(p.net_payment) +
"</td>"+
            "<td>"+new Date(p.created_at).toLocaleDateString()+"</td>"+
            "<td>"+
                "<button onclick='editPayment("+p.id+")'>Edit</button> "+
            "</td>";

        table.appendChild(row);
        document.getElementById("t_cer").innerText = data.length;
    });

    // TOTALS
    t_work = t_work || 0;

    document.getElementById("t_work").innerText = formatNumber(t_work);
document.getElementById("t_withdrawn").innerText = formatNumber(t_withdrawn);
document.getElementById("t_deduction").innerText = formatNumber(t_deduction);
document.getElementById("t_refund").innerText = formatNumber(t_refund);
document.getElementById("t_after").innerText = formatNumber(t_after);
document.getElementById("t_vat").innerText = formatNumber(t_vat);
document.getElementById("t_retention").innerText = formatNumber(t_retention);
document.getElementById("t_advance").innerText = formatNumber(t_advance);
document.getElementById("t_net").innerText = formatNumber(t_net);
}

// ================= EDIT =================
function editPayment(id) {

    const p = originalData.find(x => x.id === id);

    editId = id;

    document.getElementById("saveBtn").innerText = "Update Payment";

    document.getElementById("project_form").value = p.project_id || "";
    document.getElementById("contract_number").value = p.contract_number;

    work.value = p.work_value;
    withdrawn.value = p.work_withdrawn;
    deduction.value = p.deduction;
    refund.value = p.refund;

    calculate();
}

// ================= DELETE =================
async function deletePayment(id) {

    if (!confirm("Delete?")) return;

    await fetch(`${API}/api/payments/delete/${id}`, {
    method: "DELETE"
});

}

// ================= PRINT =================
function printPayment(id) {

    const p = originalData.find(x => x.id === id);

    const win = window.open("", "_blank");

    win.document.write("<h2>Payment Certificate</h2>");
    win.document.write("<p><b>Work Type:</b> "+p.work_type+"</p>");
    win.document.write("<p><b>Subcontractor:</b> "+p.subcontractor_name+"</p>");
    win.document.write("<p><b>Project:</b> "+p.project_name+"</p>");
    win.document.write("<p><b>Contract:</b> "+p.contract_number+"</p>");
    win.document.write("<p><b>Net:</b> "+p.net_payment+"</p>");

    win.document.close();
    setTimeout(()=>win.print(),300);
}

// ================= EXPORT =================
document.getElementById("exportBtn").onclick = async function () {

    const res = await fetch(`${window.API}/api/payments/all-full`);
    const data = await res.json();

    const filtered = applyCurrentFilterForExport(data);

    // ✅ SORT (PROJECT → WORK → SUB → CERT)
    filtered.sort((a, b) =>
        a.project_name.localeCompare(b.project_name) ||
        a.work_type.localeCompare(b.work_type) ||
        a.subcontractor_name.localeCompare(b.subcontractor_name) ||
        Number(a.certificate_no) - Number(b.certificate_no)
    );

    if (!filtered.length) {
        alert("No data to export");
        return;
    }

    // ✅ GROUPING (PROJECT + WORK + SUB)
    const groups = {};

    filtered.forEach(p => {
        const key = `${p.project_name}__${p.work_type}__${p.subcontractor_id}`;

        if (!groups[key]) {
            groups[key] = [];
        }

        groups[key].push(p);
    });

    // ================= HTML START =================
    let html = `
    <html>
    <head>
    <style>
    @page {
    size: A4;
    margin: 15mm;
}

body {
    font-family: Arial;
    padding: 10px;
    font-size: 12px;
}

h1 {
    text-align: center;
    color: #1f4e79;
    font-size: 22px;
}

h2 {
    color: #1f4e79;
    margin: 5px 0;
}

h3 {
    color: #dba512;
    margin: 5px 0;
}

h4 {
    margin: 5px 0;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 8px;
    page-break-inside: avoid;
}

th {
    background: #1f4e79;
    color: white;
}

td, th {

    border: 1px solid #ccc;
    padding: 4px;
    text-align: center;
    font-size: 11px;
}

.total {
    font-weight: bold;
    background: #f0f0f0;
}

/* ✅ PAGE BREAK */
.page {
    page-break-after: always;
}

/* ✅ HIDE EXTRA SPACE */
@media print {

    @page {
        size: A4;
        margin: 10mm;
    }

    body {
        margin: 0;
        padding: 10px;
        width: 210mm;   /* 🔥 FIX WIDTH */
        font-size: 12px;
    }

    table {
        width: 100% !important;
        border-collapse: collapse;
    }

    th {
        background: #1f4e79 !important;
        color: white !important;

        /* 🔥 FORCE COLOR PRINT */
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    td, th {
        border: 1px solid #ccc;
        padding: 4px;
        text-align: center;
    }

    /* 🔥 PREVENT SHRINKING */
    html, body {
        zoom: 100%;
    }

    /* 🔥 FORCE COLORS FOR ALL */
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    /* 🔥 PAGE BREAK */
    .page {
        page-break-after: always;
    }
}
        body { font-family: Arial; padding:15px; }
        h1 { text-align:center; color:#1f4e79; font-size: 40px; }
        h2 { color:#1f4e79; margin-top:8px; }
        h3 { color:#dba512; margin:4px 0; font-size:20px; }
        h4 { color:#333; margin:3px 0; }

        table { border-collapse:collapse; width:100%; margin-top:10px; }
        th { background:#1f4e79; color:white; }
        p { margin:3px 0; }
h3, h4 { margin:5px 0; }
        td, th { border:1px solid #ccc;  padding:4px; text-align:center; font-size:12px; }

        .total { font-weight:bold; background:#f0f0f0; }

        .footer {
            position: fixed;
            bottom: 10px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 0 40px;
            font-size: 12px;
        }

        .page { page-break-after: always; }
    
    
    </style>
    </head>
    <body>

    <div style="border-bottom:2px dashed #ccc; padding-bottom:10px; margin-bottom:20px;">

    <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h2 style="margin:0; color:#1f4e79;">Payment Certificate Report</h2>
            <p><b>Date:</b> ${new Date().toLocaleDateString()}</p>
        </div>

       
</div>
    `;

    // ================= LOOP GROUPS =================
    Object.values(groups).forEach(records => {

        const first = records[0];

        let t = {
    work:0, withdrawn:0, deduction:0,
    refund:0, after:0, vat:0,
    retention:0, advance:0, net:0
};

        records.forEach(p => {
            t.work += +p.work_value || 0;
            t.withdrawn += +p.work_withdrawn || 0;
            t.deduction += +p.deduction || 0;
            t.refund += +p.refund || 0;
            t.after += +p.after_deduction || 0;
            t.vat += +p.vat_amount || 0;
            t.retention += +p.retention_amount || 0;
            t.advance += +p.advance_deduction || 0;
            t.net += +p.net_payment || 0;
        });

        html += `
<div class="page">

    <h3 style="color:#dba512;">Project: ${first.project_name}</h3>

<div style="font-size:13px; line-height:1.6; margin-bottom:6px;">

    <b>Subcontractor:</b> 
    <span style="color:#d35400;">${first.subcontractor_name}</span>
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>Work:</b> ${first.work_type}

    <br>

    <b>Company:</b> ${first.company_name}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>Contract:</b> ${first.contract_number}

    <br>

    <b>Phone:</b> ${first.phone || '-'}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>Email:</b> ${first.email || '-'}

    <br>

    <b>VAT:</b> ${first.vat_number || '-'}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>CR:</b> ${first.cr_number || '-'}

</div>

${(() => {
    const initial = Number(first.initial_advance || 0);
const remaining = Number(first.advance_remaining || 0);

    return `
<p style="font-size:13px; margin:4px 0;">
    <b>Initial Adv:</b> ${initial.toFixed(2)}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>Remaining:</b> ${remaining.toFixed(2)}
</p>
`;
})()}
    <h4>Summary</h4>
    <table>
        <tr>
            <th>Total Work</th>
            <th>Withdrawn</th>
            <th>Deduction</th>
            <th>Refund</th>
            <th>After</th>
            <th>VAT</th>
            <th>Retention</th>
            <th>Net</th>

        </tr>
        <tr>
            <td>${formatNumber(t.work.toFixed(2))}</td>
            <td>${formatNumber(t.withdrawn.toFixed(2))}</td>
            <td>${formatNumber(t.deduction.toFixed(2))}</td>
            <td>${formatNumber(t.refund.toFixed(2))}</td>
            <td>${formatNumber(t.after.toFixed(2))}</td>
            <td>${formatNumber(t.vat.toFixed(2))}</td>
            <td>${formatNumber(t.retention.toFixed(2))}</td>
            <td>${formatNumber(t.net.toFixed(2))}</td>
        </tr>
    </table>

    <h4>Details</h4>
    <table>
        <tr>
            <th>Contract</th>
            <th>Cert No</th>
            <th>Project</th>
            <th>Work</th>
            <th>Withdrawn</th>
            <th>Deduction</th>
            <th>Refund</th>
            <th>After</th>
            <th>VAT</th>
            <th>Retention</th>
<th>Advance</th>
<th>Net</th>
<th>Date</th>
        </tr>

        ${records.map(p => `
        <tr>
            <td>${p.contract_number}</td>
            <td>${p.certificate_no}</td>
            <td>${p.project_name}</td>
            <td>${formatNumber(p.work_value)}</td>
            <td>${formatNumber(p.work_withdrawn)}</td>
            <td>${formatNumber(p.deduction)}</td>
            <td>${formatNumber(p.refund)}</td>
            <td>${formatNumber(p.after_deduction)}</td>
            <td>${formatNumber(p.vat_amount)}</td>
            <td>${formatNumber(p.retention_amount)}</td>
            <td>${formatNumber(p.advance_deduction || 0)}</td>
            <td>${formatNumber(p.net_payment)}</td>
            <td>${new Date(p.created_at).toLocaleDateString()}</td>
        </tr>
        `).join("")}

        <tr class="total">
            <td colspan="3">TOTAL</td>
            <td>${formatNumber(t.work.toFixed(2))}</td>
            <td>${formatNumber(t.withdrawn.toFixed(2))}</td>
            <td>${formatNumber(t.deduction.toFixed(2))}</td>
            <td>${formatNumber(t.refund.toFixed(2))}</td>
            <td>${formatNumber(t.after.toFixed(2))}</td>
            <td>${formatNumber(t.vat.toFixed(2))}</td>
            <td>${formatNumber(t.retention.toFixed(2))}</td>
            <td>${formatNumber(t.advance.toFixed(2))}</td>
            <td>${formatNumber(t.net.toFixed(2))}</td>
            <td></td>
        </tr>
    </table>

    <div class="footer">
        <span>Prepared by: Eng. Tanveer Ahmad</span>
    </div>

</div>
<br><br>
`;
    });

    html += `</body></html>`;

    const win = window.open("", "", "width=900,height=700");
    win.document.write(html);
    win.document.close();

    
};
async function onSubcontractorChange() {

    const id = document.getElementById("subcontractor_form").value;
    if (!id) return;

    const res = await fetch(`${API}/api/subcontractors/${id}`);
    const d = await res.json();

    let retentionPercent = Number(d.retention_percent || 10);
    window.currentVat = 0; // reset first
window.currentVat = Number(d.vat_percent);

if (isNaN(window.currentVat)) {
    window.currentVat = 0;
}
if (isNaN(window.currentVat)) window.currentVat = 0;
let advanceAmount = Number(d.advance_amount || 0);
let advanceRemaining = Number(d.advance_remaining ?? advanceAmount ?? 0);

    window.originalAdvance = advanceAmount;
    window.currentRetention = retentionPercent;
    window.currentAdvance = advanceRemaining;

    // UI
    document.getElementById("advance_remaining").value =
        (advanceRemaining || 0).toFixed(2);

    document.getElementById("retention_percent_display").value =
        (retentionPercent || 0) + "%";

    document.getElementById("contract_number").value =
        d.contract_no || "";

    window.selectedProject = d.project || "";
    document.getElementById("project_form").value = selectedProject;

    // CERTIFICATE
    const workType = document.getElementById("work_type_form").value;
    if (!workType) return;

    const res2 = await fetch(`${window.API}/api/payments/all-full`);
    const payments = await res2.json();

    const filtered = payments.filter(p =>
    p.subcontractor_id == id &&
    p.project_name == selectedProject &&
    p.work_type == workType
);

// 🔥 GET MAX CERTIFICATE NUMBER
const maxCert = filtered.reduce((max, p) => {
    return Math.max(max, Number(p.certificate_no) || 0);
}, 0);

// ✅ NEXT CERT NUMBER
document.getElementById("certificate_no").value = maxCert + 1;

    // 🔥 MOST IMPORTANT
    calculate();
}

function populateFilters(data) {

    const map = [
    {id:"f_scid", key:"subcontractor_id"},   // ✅ NEW
    {id:"f_project", key:"project_name"},
    {id:"f_contract", key:"contract_number"},
    {id:"f_company", key:"company_name"},     // ✅ ADD
    {id:"f_sub", key:"subcontractor_name"},
    {id:"f_work", key:"work_type"},
    {id:"f_cert", key:"certificate_no"},      // ✅ ADD
    {id:"f_workval", key:"work_value"},
    {id:"f_withdrawn", key:"work_withdrawn"},
    {id:"f_deduction", key:"deduction"},
    {id:"f_refund", key:"refund"},
    {id:"f_after", key:"after_deduction"},
    {id:"f_vat", key:"vat_amount"},
    {id:"f_retention", key:"retention_amount"},
    {id:"f_advance", key:"advance_deduction"}, // ✅ ADD
    {id:"f_net", key:"net_payment"},
    {id:"f_date", key:"created_at"}
];

    map.forEach(f => {
        const select = document.getElementById(f.id);

        if (!select) return;

        select.innerHTML = '<option value="">All</option>';

        const values = [...new Set(data.map(x => x[f.key]).filter(v => v))];

        values.forEach(v => {
            select.innerHTML += `<option value="${v}">${v}</option>`;
        });
    });
}


async function bulkDelete() {

    const subName = document.getElementById("bulk_sub").value;
    const work = document.getElementById("bulk_work").value;
    const from = +document.getElementById("from_cert").value;
    const to = +document.getElementById("to_cert").value;

    if (!subName || !work || !from || !to) {
        alert("Fill all fields");
        return;
    }

    const record = originalData.find(p =>
    p.subcontractor_name === subName &&
    p.work_type === work &&
    p.company_name === document.getElementById("bulk_company").value
);

    if (!record) {
        alert("No matching data found");
        return;
    }

    if (!confirm(`Delete certificates ${from} → ${to}?`)) return;

    const res = await fetch(`${API}/api/payments/bulk-delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        subcontractor_id: record.subcontractor_id,
        work_type: work,
        project_name: record.project_name,
        from_cert: from,
        to_cert: to
    })
});

    const msg = await res.text();
    alert(msg);
}
window.initPaymentPage = initPaymentPage;

// ================= GLOBAL FIX =================
window.applyFilter = applyFilter;
window.bulkDelete = bulkDelete;
window.deletePayment = deletePayment;
window.editPayment = editPayment;
window.printPayment = printPayment;
})();
window.applyGlobalFilter = function(filteredData) {

    window.applyGlobalFilter = function(filteredData) {
    renderTable(filteredData);
};

    renderTable(originalData);
};
