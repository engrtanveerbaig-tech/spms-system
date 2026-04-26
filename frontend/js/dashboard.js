// =====================================================
// GLOBAL STATE
// =====================================================
(function(){
let CURRENT_DATA = [];
let dashboardLoaded = false;
let RAW_DATA = [];
let ORIGINAL_DATA = [];   // ✅ ADD THIS
let AGG_DATA = [];
let FILTER_STATE = {
    company: "",
    type: "",
    subcontractor: ""
};

// =====================================================
// FORMAT
// =====================================================
function format(n) {
    return Number(n || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// =====================================================
// SAFE CANVAS
// =====================================================
function getCtx(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn("Missing canvas:", id);
        return null;
    }
    return el.getContext("2d");
}

// =====================================================
// LOAD DASHBOARD
// =====================================================
async function loadDashboard() {
    if (dashboardLoaded) return;
dashboardLoaded = true;
    try {
        const token = localStorage.getItem("token");

const res = await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all-full", {
    headers: {
        "Authorization": `Bearer ${token}`
    }
});

    if (!res.ok) {
    const text = await res.text();
    console.error("Server Error:", text);

    if (text.includes("token") || text.includes("Unauthorized")) {
        alert("Session expired. Please login again.");
        localStorage.clear();
        window.location.href = "login.html";
        return;
    }

    alert("Server error. Please try again.");
    return;
}

       const data = await res.json();

// ✅ FIRST validate
if (!Array.isArray(data)) {
    console.error("Invalid API response:", data);

    alert("Failed to load dashboard data");
    return;
}

// ✅ THEN show UI
const skeleton = document.getElementById("dashboardSkeleton");
const content = document.getElementById("dashboardContent");

if (skeleton) skeleton.style.display = "none";

if (content) {
    content.style.display = "block";
    content.classList.add("fade-in");
}
        console.log("DATA:", data);

        // ===============================
        // ✅ IMPORTANT: SET GLOBAL DATA
        // ===============================
ORIGINAL_DATA = data.map(item => Object.freeze({ ...item }));
Object.freeze(ORIGINAL_DATA);

RAW_DATA = data.map(item => ({ ...item }));   

        // ===============================
        // 🔢 BASIC TOTALS (TOP CARDS)
        // ===============================
        let totalWork = 0;
        let totalRetention = 0;
        let totalDeduction = 0;
        let totalNet = 0;

        data.forEach(item => {
            totalWork += Number(item.work_value || 0);
            totalRetention += Number(item.retention_amount || 0);
            totalDeduction += Number(item.deduction || 0);
            totalNet += Number(item.net_payment || 0);
        });

        // ===============================
        // ✅ SAFE UI UPDATE
        // ===============================
        const el1 = document.getElementById("total_work");
        const el2 = document.getElementById("total_retention");
        const el3 = document.getElementById("total_deduction");
        const el4 = document.getElementById("total_paid");
        const el5 = document.getElementById("total_sar");

        if (el1) el1.innerText = totalWork.toFixed(2);
        if (el2) el2.innerText = totalRetention.toFixed(2);
        if (el3) el3.innerText = totalDeduction.toFixed(2);
        if (el4) el4.innerText = totalNet.toFixed(2);
        if (el5) el5.innerText = totalNet.toFixed(2);

        
        // ===============================
        // 🔥 BUILD FULL DASHBOARD
        // ===============================
        buildAggregation();
        initFilters();
        renderAll();

    } catch (err) {
        console.error("Dashboard Error:", err);
    }

}

function renderWorkTypeSummary(data) {

    if (!data || data.length === 0) return;

    const container = document.getElementById("workTypeSummary");
    if (!container) return;

    // 🔹 TOTAL CERTIFICATES
    const total = data.length;

    // 🔹 GROUP BY WORK TYPE
    const typeCounts = {};

    data.forEach(item => {
        const type = item.work_type || "Other";

        if (!typeCounts[type]) {
            typeCounts[type] = 0;
        }

        typeCounts[type]++;
    });

    // 🔹 BUILD TEXT
    let summaryText = `<strong>Total Certificates:</strong> ${total}<br>`;

    const parts = [];

    for (let type in typeCounts) {
        parts.push(`${type}: ${typeCounts[type]}`);
    }

    summaryText += parts.join(" &nbsp; | &nbsp; ");

    container.innerHTML = summaryText;
}
// =====================================================
// AGGREGATION
// =====================================================
function buildAggregation() {

    const map = {};

    RAW_DATA.forEach(p => {

        const id = `${p.subcontractor_id}_${p.work_type}`;

        if (!map[id]) {
            map[id] = {
                company: p.company_name || "N/A",
                subcontractor: p.subcontractor_name || p.sub_name || "Unknown",
                work_type: p.work_type || "Other",
                total_work: 0,
                total_withdrawn: 0,
                total_net: 0,
                total_retention: 0,
                total_advance: 0,
                total_deduction: 0,
                total_refund: 0,
                cert_count: 0
            };
        }

        map[id].total_work += parseFloat(p.work_value) || 0;
map[id].total_net += parseFloat(p.net_payment) || 0;
map[id].total_retention += parseFloat(p.retention_amount) || 0;
map[id].total_withdrawn += parseFloat(
    p.withdrawn || p.work_withdrawn || 0
);
map[id].total_advance += parseFloat(p.advance_deduction) || 0;
map[id].total_deduction += parseFloat(p.deduction) || 0;
map[id].total_refund += parseFloat(p.refund) || 0;
        map[id].cert_count++;
    });

    AGG_DATA = Object.values(map);
}

// =====================================================
// FILTERS
// =====================================================
function initFilters() {

    const companyEl = document.getElementById("filterCompany");
    const typeEl = document.getElementById("filterType");
    const subEl = document.getElementById("filterSub");

    populateSelect(companyEl, getUnique("company"));
    populateSelect(typeEl, getUnique("work_type"));
    populateSelect(subEl, getUnique("subcontractor"));
    

    companyEl.onchange = () => {
        FILTER_STATE.company = companyEl.value;
        updateDependentFilters();
        renderAll();
    };

    typeEl.onchange = () => {
        FILTER_STATE.type = typeEl.value;
        updateDependentFilters();
        renderAll();
    };

    subEl.onchange = () => {
        FILTER_STATE.subcontractor = subEl.value;
        renderAll();
    };
}

function populateSelect(el, values) {
    if (!el) return;

    const currentValue = el.value; // keep selected

    el.innerHTML = `<option value="">All</option>` +
        values.map(v => `<option value="${v}">${v}</option>`).join("");

    // ✅ restore selection if still valid
    if (values.includes(currentValue)) {
        el.value = currentValue;
    } else {
        el.value = ""; // reset to All
    }
}

function getUnique(key) {
    return [...new Set(AGG_DATA.map(x => x[key]))];
}

function updateDependentFilters() {

    const filtered = applyFilterData();

    // ✅ Update ALL filters based on current selection

    populateSelect(
        document.getElementById("filterCompany"),
        [...new Set(filtered.map(x => x.company))]
    );

    populateSelect(
        document.getElementById("filterType"),
        [...new Set(filtered.map(x => x.work_type))]
    );

    populateSelect(
        document.getElementById("filterSub"),
        [...new Set(filtered.map(x => x.subcontractor))]
    );
}

function applyFilterData() {

    // ✅ ALWAYS USE FULL DATA (AGG_DATA)
    return AGG_DATA.filter(x =>
        (!FILTER_STATE.company || x.company?.trim() === FILTER_STATE.company?.trim()) &&
        (!FILTER_STATE.type || x.work_type?.trim() === FILTER_STATE.type?.trim()) &&
        (!FILTER_STATE.subcontractor || x.subcontractor?.trim() === FILTER_STATE.subcontractor?.trim())
    );
}

// =====================================================
// MAIN RENDER
// =====================================================
function renderAll() {

    const data = applyFilterData();

    renderKPIs(data);
    renderCharts(data);
    renderTable(data);

     renderWorkTypeSummary(getFilteredRawData());
}
function getFilteredRawData() {

    return RAW_DATA.filter(x =>
        (!FILTER_STATE.company || (x.company_name || "").trim() === (FILTER_STATE.company || "").trim()) &&
        (!FILTER_STATE.type || (x.work_type || "").trim() === (FILTER_STATE.type || "").trim()) &&
        (!FILTER_STATE.subcontractor || (x.subcontractor_name || "").trim() === (FILTER_STATE.subcontractor || "").trim())
    );

}

window.getReportSafeData = function () {

    // ✅ ALWAYS use original clean dataset
    const base = [...ORIGINAL_DATA];

    // ✅ apply filters WITHOUT mutation
    return base.filter(x =>
        (!FILTER_STATE.company || (x.company_name || "").trim() === (FILTER_STATE.company || "").trim()) &&
        (!FILTER_STATE.type || (x.work_type || "").trim() === (FILTER_STATE.type || "").trim()) &&
        (!FILTER_STATE.subcontractor || (x.subcontractor_name || "").trim() === (FILTER_STATE.subcontractor || "").trim())
    );
}

// =====================================================
// KPI
// =====================================================
function renderKPIs(data) {

    const totalWork = sum(data, "total_work");
    const totalNet = sum(data, "total_net");
    const totalRetention = sum(data, "total_retention");
    const totalDeduction = sum(data, "total_deduction");
    const totalWithdrawn = sum(data, "total_withdrawn");
const totalRefund = sum(data, "total_refund");

document.getElementById("total_withdrawn").innerText = format(totalWithdrawn);
document.getElementById("total_refund").innerText = format(totalRefund);
    document.getElementById("total_work").innerText = format(totalWork);
    document.getElementById("total_paid").innerText = format(totalNet);
    document.getElementById("total_retention").innerText = format(totalRetention);
    document.getElementById("total_deduction").innerText = format(totalDeduction);
    document.getElementById("total_sar").innerText = format(totalNet);

    document.getElementById("total_subs").innerText = data.length;

    document.getElementById("avg_cert").innerText =
        data.length ? (sum(data, "cert_count") / data.length).toFixed(1) : "0";

    // ✅ AI SUMMARY FIX
    const ai = document.getElementById("ai_summary");
    if (ai) {
        const summary = generateAISummary(data);
ai.innerHTML = summary;
    }
}

function generateAISummary(data) {

    if (!data.length) return "No data available for this project.";

    const totalNet = sum(data, "total_net");
    const totalWork = sum(data, "total_work");
    const totalRetention = sum(data, "total_retention");
    const totalDeduction = sum(data, "total_deduction");

    const top = data.reduce((a,b)=> a.total_net > b.total_net ? a : b);

    // work type distribution
    const typeCount = {};
    data.forEach(x => {
        typeCount[x.work_type] = (typeCount[x.work_type] || 0) + 1;
    });

    const mainType = Object.entries(typeCount)
        .sort((a,b)=>b[1]-a[1])[0]?.[0] || "various";

    // performance logic
    let performance = "balanced financial performance";
    if (totalNet > totalWork) performance = "strong positive cash flow";
    if (totalRetention > totalNet * 0.15) performance = "high retention impact on cash flow";
    if (totalDeduction > totalNet * 0.1) performance = "notable deductions affecting profitability";

    return `
This project has a total work value of ${format(totalWork)} SAR, with total net payments reaching ${format(totalNet)} SAR. 
The retention amount stands at ${format(totalRetention)} SAR, while total deductions recorded are ${format(totalDeduction)} SAR. 

The project is primarily driven by ${mainType} works, with the top performing subcontractor being ${top.company}. 

Overall, the project demonstrates ${performance}, indicating ${
        totalNet > totalWork
        ? "efficient financial management and strong execution."
        : "controlled spending with stable progress."
    }
`;
}

// =====================================================
// CHARTS
// =====================================================
function renderCharts(data) {

    destroyCharts();

    createTrendChart(data);
    createTypeChart(data);
    createRetentionChart(data);

    // ❌ REMOVE THIS (not used in UI)
    // createTopSubsChart(data);

    // ✅ ADD THIS (your right panel data)
    createTopSubsList(data);

    renderWorkTypeCards(data);
}

// =====================================================
function destroyCharts() {
    ["topSubsChart","typeChart","financeChart","retentionChart","trendChart","certChart"]
        .forEach(k => window[k]?.destroy?.());
}

function createTopSubsList(data) {

    const container = document.getElementById("topSubsList");
    if (!container) return;

    const grouped = {};

    data.forEach(item => {
        const name = item.subcontractor || "Unknown";

        if (!grouped[name]) grouped[name] = 0;
        grouped[name] += Number(item.total_net || 0);
    });

    const top = Object.entries(grouped)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

    container.innerHTML = "";

    top.forEach(x => {
        container.innerHTML += `
            <div class="top-sub-card">
                <div class="top-sub-name">${x.name}</div>
                <div class="top-sub-value">${format(x.total)}</div>
                <div class="top-sub-currency">SAR</div>
            </div>
        `;
    });
}

// =====================================================
function createTypeChart(data) {

    const ctx = getCtx("typeChart");
    if (!ctx) return;

    const group = groupBy(data, "work_type", "total_net");

    window.typeChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(group),
            datasets: [{
    data: Object.values(group),
    backgroundColor: [
    "#7ea6e0",  // blue
    "#f28b82",  // red
    "#c5e1a5",  // green
    "#ffd180",  // orange
    "#b39ddb",  // purple
    "#80cbc4"   // teal
],
    borderColor: "#ffffff",
borderWidth: 1,          // 🔥 slightly thicker = premium look
    hoverOffset: 6            // 🔥 smooth hover pop
}]
        },
        options: {
            plugins: {
                legend: {
    display: true,
    position: "right",
    labels: {
        color: "#e5e7eb",
        font: { size: 11 }
    }
},
                tooltip: {
    enabled: true,
    mode: 'index',
    intersect: false,
    backgroundColor: "#0f172a",
    titleColor: "#fff",
    bodyColor: "#e5e7eb",
    borderColor: "none",
    borderWidth: 1
},
                scales: {
                x: { display: false },
                y: { display: false
                    
                }
            }
            }
        }
    });
}

// =====================================================
function createTrendChart(data) {

    const ctx = getCtx("trendChart");
    if (!ctx) return;

    const top10 = [...data]
        .sort((a, b) => b.total_net - a.total_net)
        .slice(0, 100);

    // 🔥 GRADIENTS
    const gradNet = ctx.createLinearGradient(0, 0, 0, 300);
    gradNet.addColorStop(0, "rgba(34,197,94,0.5)");
    gradNet.addColorStop(1, "rgba(34,197,94,0)");

    const gradRet = ctx.createLinearGradient(0, 0, 0, 300);
    gradRet.addColorStop(0, "rgba(245,158,11,0.5)");
    gradRet.addColorStop(1, "rgba(245,158,11,0)");

    const gradDed = ctx.createLinearGradient(0, 0, 0, 300);
    gradDed.addColorStop(0, "rgba(239,68,68,0.5)");
    gradDed.addColorStop(1, "rgba(239,68,68,0)");

    window.trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: top10.map(x => `${x.company} | ${x.subcontractor}`),
            datasets: [
                {
                    label: "Net",
                    data: top10.map(x => x.total_net),
                    borderColor: "#22c55e",
                    backgroundColor: gradNet,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 1
                },
                {
                    label: "Retention",
                    data: top10.map(x => x.total_retention),
                    borderColor: "#f59e0b",
                    backgroundColor: gradRet,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 1
                },
                {
                    label: "Deduction",
                    data: top10.map(x => x.total_deduction),
                    borderColor: "#ef4444",
                    backgroundColor: gradDed,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 1
                }
            ]
        },
        options: {
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
    enabled: true,
    mode: 'index',
    intersect: false,
    backgroundColor: "#0f172a",
    titleColor: "#fff",
    bodyColor: "#e5e7eb",
    borderColor: "#334155",
    borderWidth: 1
}
            },
            scales: {
                x: { display: false },
                y: { display: false
                    
                }
            }
        }
    });
}

function createRetentionChart(data) {

    const ctx = getCtx("retentionChart");
    if (!ctx) return;

    const top10 = [...data]
        .sort((a, b) => b.total_retention - a.total_retention)
        .slice(0, 30);

    window.retentionChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: top10.map(x => `${x.company} | ${x.subcontractor}`),
            
            datasets: [
                {
                    data: top10.map(x => x.total_retention),
                    backgroundColor: "#f59e0b",
                    borderRadius: 6
                },
                {
                    data: top10.map(x => x.total_deduction),
                    backgroundColor: "#ef4444",
                    borderRadius: 15
                }
            ]
        },
        options: {
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: { display: false },
                tooltip: {
    enabled: true,
    mode: 'index',
    intersect: false,
    backgroundColor: "#0f172a",
    titleColor: "#fff",
    bodyColor: "#e5e7eb",
    borderColor: "#334155",
    borderWidth: 1
}
            },
            scales: {
                x: { display: false },
                y: { display: false
                    
                }
            }
        }
    });
}

function renderWorkTypeCards(data) {
    const container = document.getElementById("workTypeCards");
    if (!container) return;

    const grouped = {};

    // ⚠️ USE RAW DATA (VERY IMPORTANT)
    const raw = getFilteredRawData();

    raw.forEach(item => {
        const type = item.work_type || "Unknown";

        if (!grouped[type]) {
            grouped[type] = {
                certs: new Set(),
                subs: new Set()
            };
        }

        // ✅ UNIQUE CERTIFICATE (use real field)
        grouped[type].certs.add(item.id || item.payment_id || item.invoice_no);

        // ✅ UNIQUE SUBCONTRACTOR
        grouped[type].subs.add(item.subcontractor_name);
    });

    let html = "";

    Object.keys(grouped).forEach(type => {
        html += `
    <div class="work-card-premium">
        <div class="card-top">${type}</div>
        <div class="card-main">${grouped[type].certs.size}</div>
        <div class="card-bottom">${grouped[type].subs.size} Subs</div>
    </div>
`;
    });

    container.innerHTML = html;
}
// =====================================================
// TABLE
// =====================================================
function renderTable(data) {

    const table = document.getElementById("summaryTable");
    table.innerHTML = "";

    data.forEach(x => {
        table.innerHTML += `
        <tr>
            <td>${x.company}</td>
            <td>${x.subcontractor}</td>

            <!-- ✅ ORDER FIXED -->
            <td>${x.work_type}</td>
            <td>${x.cert_count}</td>

            <!-- ✅ VALUES -->
            <td>${format(x.total_work)}</td>
            <td>${format(x.total_withdrawn)}</td>
            <td>${format(x.total_deduction)}</td>
            <td>${format(x.total_refund)}</td>
            <td>${format(x.total_retention)}</td>
            <td>${format(x.total_advance)}</td>
            <td>${format(x.total_net)}</td>
        </tr>`;
    });
}

// =====================================================
function sum(arr, key) {
    return arr.reduce((a,b)=>a + (b[key] || 0),0);
}

function groupBy(arr, key, valueKey) {
    const res = {};
    arr.forEach(x => {
        res[x[key]] = (res[x[key]] || 0) + (x[valueKey] || 0);
    });
    return res;
}

async function loadImageBase64(url) {
    const res = await fetch(url);
    const blob = await res.blob();

    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

// =====================================================
// PDF EXPORT (ADVANCED)
// =====================================================


window.applyGlobalFilter = function(filteredData) {

    console.log("Applying filter:", filteredData.length);

    if (!filteredData || filteredData.length === 0) {
        alert("No data found");
        return;
    }

    // 🔥 STEP 1: SET RAW DATA TO FILTERED
    RAW_DATA = filteredData
    .filter(x => ORIGINAL_DATA.some(o => o.id === x.id))
    .map(x => ({
        ...x,
        work_value: Number(x.work_value || 0),
        net_payment: Number(x.net_payment || 0),
        retention_amount: Number(x.retention_amount || 0),
        deduction: Number(x.deduction || 0),
        advance_deduction: Number(x.advance_deduction || 0),
        refund: Number(x.refund || 0)
    }));

    // 🔥 STEP 2: CLEAR CURRENT DATA (IMPORTANT)
    CURRENT_DATA = [];

    // 🔥 STEP 3: RESET FILTER STATE
    FILTER_STATE = {
        company: "",
        type: "",
        subcontractor: ""
    };

    // 🔥 STEP 4: REBUILD FROM FILTERED DATA
    buildAggregation();
    initFilters();
    renderAll();
};

window.resetDashboard = function() {

    RAW_DATA = ORIGINAL_DATA.map(x => ({ ...x }));
    CURRENT_DATA = [];

    FILTER_STATE = {
        company: "",
        type: "",
        subcontractor: ""
    };

    buildAggregation();
    initFilters();
    renderAll();
};

function openReportWindow(print = false) {

    const win = window.open("", "_blank");

    win.document.open();
    win.document.write(buildDashboardHTML());
    win.document.close();

    if (print) {
        setTimeout(() => win.print(), 500);
    }

    return win;
}

window.generatePDFPreview = () => openReportWindow(false);
window.printPDF = () => openReportWindow(true);
window.downloadPDF = async function () {
    try {
        const pdf = await createPDF();
        pdf.save("SPMS_Report.pdf");
    } catch (err) {
        console.error(err);
        alert("Download failed");
    }
};
// =====================================================
// EXPORT FUNCTIONS (FINAL POSITION)
// =====================================================
window.loadDashboard = loadDashboard;
window.generateReport = generatePDFPreview;
window.downloadPDF = downloadPDF;
window.printPDF = printPDF;
window.resetDashboard = resetDashboard;
window.applyGlobalFilter = applyGlobalFilter;


function buildDashboardHTML() {

   const data = getReportSafeData();

    if (!data || data.length === 0) {
        return "<h2>No data available</h2>";
    }
    data.sort((a, b) =>
    (a.project_name || "").localeCompare(b.project_name || "") ||
    (a.contract_number || "").localeCompare(b.contract_number || "") ||
    Number(a.certificate_no) - Number(b.certificate_no)
);

    const groups = {};

    data.forEach(p => {
        const key = `${p.project_name}__${p.contract_number}__${p.subcontractor_id}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
    });
    
const groupValues = Object.values(groups);


    let html = `
    <html>
    <head>

    <link href="https://fonts.googleapis.com/css2?family=Tajawal&family=Amiri&display=swap" rel="stylesheet">

    <style>

    body {
        font-family: 'Tajawal', 'Amiri', Arial;
    direction: rtl;
    text-align: right;
        padding: 20px;
        font-size: 13px;
        background: #e5e7eb;
    }

    h1 {
        text-align: center;
        color: #1f4e79;
    }

    h3 {
        color: #dba512;
        margin: 6px 0;
    }

    table {
        width: 100%;
        border: 1px solid #ccc;
        border-collapse: collapse;
        margin-top: 10px;
    }

    th {
        background: #1f4e79;
        color: white;
    }

    td, th {
    padding: 3px 4px;
    border: 1px solid #ccc;
    font-size: 12px;
}
        .report-block {
    page-break-inside: avoid;
    margin-bottom: 15px;
}
    @page {
    size: A4;
    margin: 6.35mm;
}
    .page::after {
    right: 20px;
    font-size: 12px;
    color: #555;
}
    .footer {
    margin-top: 10px;
    font-size: 11px;
    text-align: left;
    border-top: 1px solid #ccc;
    padding-top: 5px;
}

    </style>
    </head>

    <body>

    `;

    groupValues.forEach((records, index) => {

        const first = records[0];

        let tWork = 0, tNet = 0, tRet = 0, tDed = 0;
let tWithdrawn = 0, tRefund = 0, tAfterVAT = 0, tAdvance = 0;

        records.forEach(p => {
    tWork += +p.work_value || 0;
    tNet += +p.net_payment || 0;
    tRet += +p.retention_amount || 0;
    tDed += +p.deduction || 0;

    tWithdrawn += +p.withdrawn || 0;
    tRefund += +p.refund || 0;
    tAfterVAT += +p.after_vat || 0;
    tAdvance += +p.advance_deduction || 0;
});

        const pageBreak = index !== 0 ? 'page-break-before: always;' : '';

html += `
    <div class="report-block" style="${pageBreak}">
<h1>📊 تقرير الدفعات</h1>
            <h3>المشروع: ${first.project_name}</h3>

<div style="font-size:13px; line-height:1.6; margin-bottom:6px;">

    <b>المقاول:</b> ${first.subcontractor_name}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>نوع العمل:</b> ${first.work_type}

    <br>

    <b>الشركة:</b> ${first.company_name || '-'}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>العقد:</b> ${first.contract_number || '-'}

    <br>

    <b>الهاتف:</b> ${first.phone || '-'}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>البريد:</b> ${first.email || '-'}

    <br>

    <b>الرقم الضريبي:</b> ${first.vat_number || '-'}
    &nbsp;&nbsp; | &nbsp;&nbsp;
    <b>السجل التجاري:</b> ${first.cr_number || '-'}

</div>

    <table>
<tr>
    <th>الشهادة</th>
    <th>قيمة العمل</th>
    <th>المسحوب</th>
    <th>الخصم</th>
    <th>الاسترجاع</th>
    <th>بعد الضريبة</th>
    <th>الاحتجاز</th>
    <th>السلفة</th>
    <th>الصافي</th>
</tr>
        `;

        records.forEach(p => {
            html += `
            <tr>
<td>${p.certificate_no}</td>
<td>${(+p.work_value).toFixed(2)}</td>
<td>${(+p.withdrawn || 0).toFixed(2)}</td>
<td>${(+p.deduction).toFixed(2)}</td>
<td>${(+p.refund || 0).toFixed(2)}</td>
<td>${(+p.after_vat || 0).toFixed(2)}</td>
<td>${(+p.retention_amount).toFixed(2)}</td>
<td>${(+p.advance_deduction || 0).toFixed(2)}</td>
<td>${(+p.net_payment).toFixed(2)}</td>
</tr>
            `;
        });

        html += `
<tr style="font-weight:bold;background:#f0f0f0;">
<td>الإجمالي</td>
<td>${tWork.toFixed(2)}</td>
<td>${tWithdrawn.toFixed(2)}</td>
<td>${tDed.toFixed(2)}</td>
<td>${tRefund.toFixed(2)}</td>
<td>${tAfterVAT.toFixed(2)}</td>
<td>${tRet.toFixed(2)}</td>
<td>${tAdvance.toFixed(2)}</td>
<td>${tNet.toFixed(2)}</td>
</tr>
            </table>

            <div class="footer">
       Prepared by: Eng. Tanveer Ahmad
    </div>

        </div>
        `;
    });

    html += `</body></html>`;

    return html;
}
})();
//setInterval(() => {
//
    // ❌ do not refresh if user is filtering
  //  if (CURRENT_DATA.length > 0) return;

    //console.log("🔄 Auto refreshing dashboard...");
    //loadDashboard();

//}, 500000);
// ===============================
// 🔥 LIVE UPDATE FROM PAYMENT PAGE
// ===============================
window.updateDashboardLive = function(newPayment) {

    console.log("Live update received:", newPayment);

    // ✅ PUSH into RAW DATA
    const normalized = {
    ...newPayment,
    work_value: Number(newPayment.work_value || 0),
    net_payment: Number(newPayment.net_payment || 0),
    retention_amount: Number(newPayment.retention_amount || 0),
    deduction: Number(newPayment.deduction || 0),
    advance_deduction: Number(newPayment.advance_deduction || 0),
    refund: Number(newPayment.refund || 0)
};

RAW_DATA = [...RAW_DATA, normalized];

// ❌ DO NOT TOUCH ORIGINAL_DATA

    // ✅ REBUILD EVERYTHING
    buildAggregation();
    renderAll();
};

window.downloadExcel = function () {

    const data = getReportSafeData();

    if (!data.length) {
        alert("No data to export");
        return;
    }

    let csv = [];

    // headers
    const headers = Object.keys(data[0]);
    csv.push(headers.join(","));

    // rows
    data.forEach(row => {
        const values = headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`);
        csv.push(values.join(","));
    });

    // create file
    const BOM = "\uFEFF"; // 🔥 important for Arabic

const blob = new Blob([BOM + csv.join("\n")], {
    type: "text/csv;charset=utf-8;"
});

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "SPMS_Report.csv";
    link.click();
};

async function createPDF() {

    const { jsPDF } = window.jspdf;
    const element = document.getElementById("dashboardContent");

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
    }

    return pdf;
}