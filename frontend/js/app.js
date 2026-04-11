// ================= LOGIN CHECK =================
const role = localStorage.getItem("role");

if (!role) {
    window.location.href = "login.html";
}

// ================= APPLY ROLE UI =================
function applyRoleUI() {
    const role = localStorage.getItem("role");

    const subMenu = document.getElementById("subMenu");
    const payMenu = document.getElementById("payMenu");

    if (!subMenu || !payMenu) return;

    if (role === "viewer") {
        subMenu.style.opacity = "0.5";
        payMenu.style.opacity = "0.5";

        subMenu.style.pointerEvents = "none";
        payMenu.style.pointerEvents = "none";

        subMenu.title = "No access";
        payMenu.title = "No access";
    }
}

// ================= LOAD SCRIPT =================
async function loadScript(src) {
    return new Promise((resolve) => {

        const old = document.querySelector(`script[src^="${src}"]`);
        if (old) old.remove();

        const s = document.createElement("script");
        s.src = src + "?v=" + Date.now();
        s.onload = resolve;

        document.body.appendChild(s);
    });
}

// ================= LOAD PAGE =================
async function loadPage(page) {

    const role = localStorage.getItem("role");

    if (role === "viewer" && !page.includes("dashboard")) {
        alert("Access Denied");
        return;
    }

    const container = document.getElementById("mainContent");

    try {
        const res = await fetch(page);
        const html = await res.text();
        container.innerHTML = html;

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        console.log("Page loaded:", page);

        applyRoleUI();

        // ================= PAGE JS =================

        if (page.includes("dashboard")) {

            await loadScript("./js/charts.min.js");
            await loadScript("./js/dashboard.js");

            if (window.loadDashboard) {
                window.loadDashboard();
            }
        }

        if (page.includes("subcontractor")) {

            await loadScript("./js/subcontractor.js");

            if (window.initSubcontractorPage) {
                window.initSubcontractorPage();
            }
        }

        if (page.includes("payment")) {

            await loadScript("./js/payment.js");

            if (window.initPaymentPage) {
                window.initPaymentPage();
            }
        }

    } catch (err) {
        console.error("Page Load Error:", err);
        container.innerHTML = "<h2>Error loading page</h2>";
    }
}

// ================= DEFAULT LOAD =================
loadPage("./dashboard.html");

// ================= LOGOUT =================
function logout() {
    localStorage.removeItem("role");
    window.location.href = "login.html";
}

// =======================================================
// 🔍 GLOBAL SEARCH SYSTEM (FINAL)
// =======================================================

let GLOBAL_DATA = [];
let FILTERED_DATA = [];

// ================= LOAD GLOBAL DATA =================
async function loadGlobalData() {
    try {
        const res = await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all");
        GLOBAL_DATA = await res.json();
    } catch (err) {
        console.error("Global search load error", err);
    }
}

// load once
loadGlobalData();

// ================= HANDLE SEARCH =================
function handleSearchInput() {

    const input = document.getElementById("globalSearch").value.toLowerCase();
    const type = document.getElementById("searchType").value;
    const box = document.getElementById("searchSuggestions");

    if (!input || input.length < 2) {
        box.style.display = "none";
        return;
    }

    let results = GLOBAL_DATA.filter(item => {
        if (type === "company") {
            return (item.company_name || "").toLowerCase().includes(input);
        } else {
            return (item.subcontractor_name || "").toLowerCase().includes(input);
        }
    });

    // remove duplicates
    const unique = [...new Map(results.map(item => {
        const key = type === "company" ? item.company_name : item.subcontractor_name;
        return [key, item];
    })).values()];

    renderSuggestions(unique, type);
}

// ================= RENDER SUGGESTIONS =================
function renderSuggestions(list, type) {

    const box = document.getElementById("searchSuggestions");

    if (!list.length) {
        box.style.display = "none";
        return;
    }

    box.innerHTML = "";

    list.slice(0, 10).forEach(item => {

        const value = type === "company"
            ? item.company_name
            : item.subcontractor_name;

        const div = document.createElement("div");
        div.innerText = value;

        div.onclick = () => selectSuggestion(value, type);

        box.appendChild(div);
    });

    box.style.display = "block";
}

// ================= SELECT SUGGESTION =================
function selectSuggestion(value, type) {

    document.getElementById("globalSearch").value = value;
    document.getElementById("searchSuggestions").style.display = "none";

    FILTERED_DATA = GLOBAL_DATA.filter(item => {
        if (type === "company") {
            return item.company_name === value;
        } else {
            return item.subcontractor_name === value;
        }
    });

    // APPLY TO CURRENT PAGE
    if (window.applyGlobalFilter) {
        window.applyGlobalFilter(FILTERED_DATA);
    }
}

// ================= CLOSE SUGGESTIONS =================
document.addEventListener("click", function(e) {
    if (!e.target.closest(".search-container")) {
        const box = document.getElementById("searchSuggestions");
        if (box) box.style.display = "none";
    }
});