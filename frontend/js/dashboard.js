let CURRENT_DATA = [];
// =====================================================
// GLOBAL STATE
// =====================================================
(function(){
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

    dashboardLoaded = false; // always allow reload

    try {
        const res = await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all");
        RAW_DATA = await res.json();
ORIGINAL_DATA = [...RAW_DATA];   // ✅ SAVE ORIGINAL

        // ✅ DEBUG + SAFETY
        if (!RAW_DATA || RAW_DATA.length === 0) {
            console.warn("No data received from API");
        }

        console.log("DATA LOADED:", RAW_DATA);

    } catch (err) {
        console.error("API ERROR", err);
        return;
    }

    // ✅ RUN AFTER DATA LOAD
    buildAggregation();
    initFilters();
    renderAll();
    const btn = document.querySelector(".filters button");
if (btn) btn.onclick = generatePDF;
}

// =====================================================
// AGGREGATION
// =====================================================
function buildAggregation() {

    const map = {};

    RAW_DATA.forEach(p => {

        const id = p.subcontractor_id || "unknown";

        if (!map[id]) {
            map[id] = {
                company: p.company_name || "N/A",
                subcontractor: p.subcontractor_name || p.sub_name || "Unknown",
                work_type: p.work_type || "Other",
                total_work: 0,
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
    el.innerHTML = `<option value="">All</option>` +
        values.map(v => `<option value="${v}">${v}</option>`).join("");
}

function getUnique(key) {
    return [...new Set(AGG_DATA.map(x => x[key]))];
}

function updateDependentFilters() {
    const filtered = applyFilterData();

    populateSelect(document.getElementById("filterType"),
        [...new Set(filtered.map(x => x.work_type))]);

    populateSelect(document.getElementById("filterSub"),
        [...new Set(filtered.map(x => x.subcontractor))]);
}

function applyFilterData() {

    // ✅ if search filter applied → use CURRENT_DATA
    const source = CURRENT_DATA.length ? CURRENT_DATA : AGG_DATA;

    return source.filter(x =>
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
}

// =====================================================
// KPI
// =====================================================
function renderKPIs(data) {

    const totalWork = sum(data, "total_work");
    const totalNet = sum(data, "total_net");
    const totalRetention = sum(data, "total_retention");
    const totalDeduction = sum(data, "total_deduction");

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
        ai.innerText = generateAISummary(data);
    }
}

function generateAISummary(data) {

    if (!data.length) return "• No data available";

    const totalNet = sum(data, "total_net");
    const totalWork = sum(data, "total_work");
    const totalRetention = sum(data, "total_retention");
    const totalDeduction = sum(data, "total_deduction");

    const top = data.reduce((a,b)=> a.total_net > b.total_net ? a : b);

    return `
• Total project value: ${format(totalWork)} SAR
• Net payment: ${format(totalNet)} SAR
• Retention: ${format(totalRetention)} SAR
• Deductions: ${format(totalDeduction)} SAR
• Top subcontractor: ${top.subcontractor}
    `;
}

// =====================================================
// CHARTS
// =====================================================
function renderCharts(data) {

    destroyCharts();

    createTopSubsChart(data);
    createTypeChart(data);
    createFinanceChart(data);
    createRetentionChart(data);
    createTrendChart(data);
    createCertChart(data);
}

// =====================================================
function destroyCharts() {
    ["topSubsChart","typeChart","financeChart","retentionChart","trendChart","certChart"]
        .forEach(k => window[k]?.destroy?.());
}

// =====================================================
function createTopSubsChart(data) {

    const ctx = getCtx("topSubsChart");
    if (!ctx) return;

    window.topSubsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(x => x.subcontractor || "Unknown"),
            datasets: [{
                label: "Net Amount",
                data: data.map(x => x.total_net),
                backgroundColor: "#3b82f6",
                borderRadius: 8
            }]
        }
    });
}

// =====================================================
function createTypeChart(data) {

    const ctx = getCtx("typeChart");
    if (!ctx) return;

    const group = groupBy(data, "work_type", "total_net");

    window.typeChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: Object.keys(group),
            datasets: [{
                data: Object.values(group),
                backgroundColor: ["#3b82f6","#10b981","#f59e0b","#ef4444"]
            }]
        }
    });
}

// =====================================================
function createFinanceChart(data) {

    const ctx = getCtx("financeChart");
    if (!ctx) return;

    window.financeChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Work","Net","Retention","Advance"],
            datasets: [{
                data: [
                    sum(data,"total_work"),
                    sum(data,"total_net"),
                    sum(data,"total_retention"),
                    sum(data,"total_advance")
                ],
                backgroundColor: ["#3b82f6","#22c55e","#f59e0b","#ef4444"]
            }]
        }
    });
}

// =====================================================
function createRetentionChart(data) {

    const ctx = getCtx("retentionChart");
    if (!ctx) return;

    window.retentionChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(x => x.subcontractor || "Unknown"),
            datasets: [
                {
                    label: "Retention",
                    data: data.map(x => x.total_retention),
                    backgroundColor: "#f59e0b"
                },
                {
                    label: "Deduction",
                    data: data.map(x => x.total_deduction),
                    backgroundColor: "#ef4444"
                }
            ]
        }
    });
}

// =====================================================
function createTrendChart(data) {

    const ctx = getCtx("trendChart");
    if (!ctx) return;

    window.trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(x => x.subcontractor || "Unknown"),
            datasets: [
                {
                    label: "Work",
                    data: data.map(x => x.total_work),
                    borderColor: "#3b82f6",
                    tension: 0.4
                },
                {
                    label: "Net",
                    data: data.map(x => x.total_net),
                    borderColor: "#22c55e",
                    tension: 0.4
                }
            ]
        }
    });
}

// =====================================================
function createCertChart(data) {

    const ctx = getCtx("certChart");
    if (!ctx) return;

    window.certChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: data.map(x => x.subcontractor || "Unknown"),
            datasets: [{
                label: "Certificates",
                data: data.map(x => x.cert_count),
                backgroundColor: "#8b5cf6"
            }]
        }
    });
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
            <td>${x.cert_count}</td>
            <td>${x.work_type}</td>
            <td>${format(x.total_work)}</td>
            <td>${format(x.total_deduction)}</td>
            <td>${format(x.total_refund)}</td>
            <td>${format(x.total_retention)}</td>
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
function fixArabic(text) {
    return text.split("").reverse().join("");
}

// =====================================================
// =====================================================
// PDF EXPORT (ADVANCED)
// =====================================================
async function generatePDF() {

    const data = applyFilterData();

    // ================================
    // 🔷 CAPTURE CHARTS
    // ================================
    function getChartImage(id) {
        const canvas = document.getElementById(id);
        if (!canvas) return "";
        return canvas.toDataURL("image/png");
    }

    const charts = [
        getChartImage("topSubsChart"),
        getChartImage("typeChart"),
        getChartImage("financeChart"),
        getChartImage("retentionChart"),
        getChartImage("trendChart"),
        getChartImage("certChart")
    ];

    // ================================
    // 🔷 BUILD HTML
    // ================================
    let html = `
    <html>
    <head>
    <style>

    body {
        font-family: 'Amiri', serif;
        padding:20px;
        direction: rtl;
    }

    h1,h2 {
        text-align:center;
    }

    .cover {
        text-align:center;
        margin-top:80px;
    }

    .header-logo {
        position:absolute;
        top:10px;
        right:20px;
        width:120px;
    }

    .chart-grid {
        display:grid;
        grid-template-columns: repeat(3, 1fr);
        gap:10px;
        margin-top:20px;
    }

    .chart-box {
        border:1px solid #ddd;
        padding:5px;
        text-align:center;
    }

    .chart-box img {
        width:100%;
        height:180px;
        object-fit:contain;
    }

    table {
        width:100%;
        border-collapse:collapse;
        margin-top:15px;
    }

    th {
        background:#1f4e79;
        color:white;
    }

    td, th {
        border: none;
        padding:5px;
        text-align:center;
        font-size:12px;
    }
    td {
    color: #000000;
}

    .page {
        page-break-after: always;
    }

    </style>
    </head>

    <body>

    <!-- ================= COVER ================= -->
    <div class="cover page">
        <img src="assets/logo2.png" width="300"><br><br>

        <h1>NAM-153VILLAS-040624</h1>
        <p>Subcontractors | Payment Certificates Report</p>

        <br><br>

        <p>Prepared by: Eng. Tanveer Ahmad</p>
        <p>Date: ${new Date().toLocaleDateString()}</p>
    </div>

    <!-- ================= MAIN ================= -->
    <div>

    <img src="assets/nam.png" class="header-logo">

    <h2>📊 Analysis Charts</h2>

    <div class="chart-grid">
        ${charts.map(img => `
            <div class="chart-box">
                <img src="${img}">
            </div>
        `).join("")}
    </div>

    <h2>Summary</h2>

    <table>
        <tr>
            <th>Total Work</th>
            <th>Net</th>
            <th>Retention</th>
            <th>Advance</th>
        </tr>
        <tr>
            <td>${format(sum(data,"total_work"))}</td>
            <td>${format(sum(data,"total_net"))}</td>
            <td>${format(sum(data,"total_retention"))}</td>
            <td>${format(sum(data,"total_advance"))}</td>
        </tr>
    </table>

    <h2>Details</h2>

    <table>
        <tr>
            <th>Company</th>
            <th>Subcontractor</th>
            <th>Cert</th>
            <th>Type</th>
            <th>Work</th>
            <th>Deduction</th>
            <th>Refund</th>
            <th>Retention</th>
            <th>Net</th>
        </tr>

        ${data.map(x => `
        <tr>
            <td>${x.company}</td>
            <td>${x.subcontractor}</td>
            <td>${x.cert_count}</td>
            <td>${x.work_type}</td>
            <td>${format(x.total_work)}</td>
            <td>${format(x.total_deduction)}</td>
            <td>${format(x.total_refund)}</td>
            <td>${format(x.total_retention)}</td>
            <td>${format(x.total_net)}</td>
        </tr>
        `).join("")}

    </table>

    </div>

    </body>
    </html>
    `;

    // ================================
    // 🔷 OPEN PRINT WINDOW
    // ================================
    const win = window.open("", "", "width=1200,height=800");
    win.document.write(html);
    win.document.close();
}

window.applyGlobalFilter = function(filteredData) {

    console.log("Applying filter:", filteredData.length);

    if (!filteredData || filteredData.length === 0) {
        alert("No data found");
        return;
    }

    // 🔥 STEP 1: SET RAW DATA TO FILTERED
    RAW_DATA = [...filteredData];

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

    RAW_DATA = [...ORIGINAL_DATA];
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
// =====================================================


window.loadDashboard = loadDashboard;
window.generateReport = generatePDF;
})();
setInterval(() => {

    // ❌ do not refresh if user is filtering
    if (CURRENT_DATA.length > 0) return;

    console.log("🔄 Auto refreshing dashboard...");
    loadDashboard();

}, 500000);
