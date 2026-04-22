function normalize(text) {
    return (text || "")
        .toString()
        .normalize("NFKD")   // 🔥 Arabic fix
        .replace(/[^\w\s\u0600-\u06FF]/g, "") // keep Arabic
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}
// =======================================================
// 🔍 GLOBAL SEARCH SYSTEM (FINAL)
// =======================================================

let SEARCH_DATA = [];
let GLOBAL_DATA = [];
let FILTERED_DATA = [];

// ================= MAINTENANCE MODE =================
const MAINTENANCE_MODE = false; // 🔥 change true/false
let selectedSubcontractorId = null;
const savedTheme = localStorage.getItem("theme");

document.addEventListener("DOMContentLoaded", () => {
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
    }
});
let SELECTED_SEARCH = null;
let CURRENT_SEARCH_TYPE = "company";

document.addEventListener("click", function(e) {

    const modal = document.getElementById("searchModal");
    const box = document.querySelector(".search-box");

    // ❌ IGNORE CLICK ON SEARCH ICON
    if (e.target.closest('[onclick*="openSearchModal"]')) {
        return;
    }

    // CLOSE MODAL
    if (modal && modal.style.display !== "none" && box) {
        if (!box.contains(e.target)) {
            closeSearchModal();
        }
    }

});


// ================= APPLY ROLE UI =================
function applyRoleUI() {
    const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
    window.location.href = "login.html";
    return;
}

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
    return new Promise((resolve, reject) => {

        // ❌ remove existing check completely (temporary fix)
        // because it may skip broken script

        const s = document.createElement("script");
        s.src = src + "?v=" + Date.now();

        s.onload = () => {
            console.log("Loaded:", src);
            resolve();
        };

        s.onerror = () => {
            console.error("Failed to load:", src);
            reject();
        };

        document.body.appendChild(s);
    });
}

// ================= LOAD PAGE =================
async function loadPage(page) {

    // 🔥 ACTIVE SIDEBAR FIX
document.querySelectorAll(".menu-item").forEach(i => i.classList.remove("active"));

if (page.includes("dashboard")) {
    document.querySelector(".menu-item[onclick*='dashboard']").classList.add("active");
}

if (page.includes("subcontractor")) {
    document.getElementById("subMenu").classList.add("active");
}

if (page.includes("payment")) {
    document.getElementById("payMenu").classList.add("active");
}

    const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

if (!token) {
    alert("Please login");
    window.location.href = "login.html";
    return;
}

if (role === "viewer" && !page.includes("dashboard")) {
    alert("Access denied");
    return;
}

    const container = document.getElementById("mainContent");

    try {
        const res = await fetch(page);
        const html = await res.text();
        container.innerHTML = html;
        container.style.opacity = 0;
setTimeout(() => {
    container.style.opacity = 1;
}, 50);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        console.log("Page loaded:", page);

        applyRoleUI();

        // ================= PAGE JS =================

        if (page.includes("dashboard")) {

    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js");

    await loadScript("js/charts.min.js");

    console.log("Chart after load:", typeof Chart);

    await loadScript("js/dashboard.js");

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
const token = localStorage.getItem("token");

if (token) {
    loadPage("dashboard.html");   // ✅ FIXED
    loadSearchData();
} else {
    window.location.href = "login.html";
}

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
    const key = CURRENT_SEARCH_TYPE === "company"
        ? normalize(item.company_name)
        : normalize(item.subcontractor_name);

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
            return normalize(item.company_name) === normalize(value);
        } else {
            return normalize(item.subcontractor_name) === normalize(value);
        }
    });

    // APPLY TO CURRENT PAGE
    if (window.applyGlobalFilter) {
        window.applyGlobalFilter(FILTERED_DATA);
    }
}
// ================= GLOBAL SEARCH MODAL =================

// store full data


async function loadSearchData() {
    if (SEARCH_DATA.length > 0) return; // ✅ cache
    try {
        const res = await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all-full", {
    headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
});
       const result = await res.json();

if (!Array.isArray(result)) {
    console.error("Invalid search data:", result);
    return;
}

SEARCH_DATA = result.map(x => ({
    ...x,
    subcontractor_id: x.subcontractor_id || x.sub_id || 0,
    subcontractor_name: x.subcontractor_name || x.sub_name || "Unknown",
    company_name: x.company_name || "N/A",
    work_type: x.work_type || "Other",
    work_value: x.work_value || 0,
    net_payment: x.net_payment || 0,
    retention_amount: x.retention_amount || 0,
    deduction: x.deduction || 0,
    advance_deduction: x.advance_deduction || 0,
    refund: x.refund || 0
}));

GLOBAL_DATA = SEARCH_DATA;

        console.log("SEARCH DATA LOADED:", SEARCH_DATA.length); // ✅ HERE
    } catch (err) {
        console.error("Search API error", err);
    }
}

// open modal
window.openSearchModal = async function() {

    document.getElementById("searchModal").style.display = "flex";

    // ✅ ADD THIS LINE HERE
    const btn = document.querySelector('[onclick*="openSearchModal"]');
    if (btn) btn.classList.add("search-active");
    if (SEARCH_DATA.length === 0) {
        await loadSearchData();   // 🔥 WAIT FOR DATA
    }

    document.getElementById("popupSearchInput").focus();
}

// close modal
window.closeSearchModal = function() {
    document.getElementById("searchModal").style.display = "none";

    // ✅ REMOVE ACTIVE STATE
    const btn = document.querySelector('[onclick*="openSearchModal"]');
    if (btn) btn.classList.remove("search-active");
}

// ================= SUGGESTION =================
function highlightText(text, query) {
    if (!query) return text;

    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex
    const regex = new RegExp(`(${safeQuery})`, "gi");

    return text.replace(regex, `<span class="highlight">$1</span>`);
}


function handlePopupSearch() {

    const inputEl = document.getElementById("popupSearchInput");
    const box = document.getElementById("popupSuggestions");

    if (!inputEl || !box) return;

    const input = inputEl.value.trim();
    const inputNorm = normalize(input);

    // 🔥 WAIT FOR DATA
    if (!SEARCH_DATA || SEARCH_DATA.length === 0) {
        box.innerHTML = "<div>Loading...</div>";
        box.style.display = "block";
        return;
    }

    // ❌ EMPTY INPUT
    if (!inputNorm) {
        box.style.display = "none";
        return;
    }

    const results = SEARCH_DATA.filter(x => {

        const company = normalize(x.company_name);
        const subcontractor = normalize(x.subcontractor_name);

        if (CURRENT_SEARCH_TYPE === "company") {
            return company.includes(inputNorm);
        }

        if (CURRENT_SEARCH_TYPE === "subcontractor") {
            return subcontractor.includes(inputNorm);
        }

        return false;
    });

    console.log("DATA:", SEARCH_DATA.length);
    console.log("RESULTS:", results.length);

    // ✅ REMOVE DUPLICATES
    const unique = [...new Map(results.map(r => [
        normalize(
            CURRENT_SEARCH_TYPE === "company"
            ? r.company_name
            : r.subcontractor_name
        ),
        r
    ])).values()];

    if (unique.length === 0) {
        box.innerHTML = "<div>No results found</div>";
        box.style.display = "block";
        return;
    }

    box.innerHTML = "";

    unique.slice(0, 10).forEach(r => {

        const div = document.createElement("div");

        const text =
    CURRENT_SEARCH_TYPE === "company"
    ? `${r.company_name} (${r.subcontractor_name})`
    : `${r.subcontractor_name} — ${r.company_name}`;

        div.innerHTML = highlightText(text, inputNorm);

        div.onclick = () => {
            SELECTED_SEARCH = {
                id: r.subcontractor_id,
                company: (r.company_name || "").trim(),
                subcontractor: (r.subcontractor_name || "").trim()
            };

            inputEl.value = text;
            box.style.display = "none";
        };

        box.appendChild(div);
    });

    box.style.display = "block";
}
window.resetDashboard = function() {

    RAW_DATA = [...ORIGINAL_DATA];

    FILTER_STATE = {
        company: "",
        type: "",
        subcontractor: ""
    };

    buildAggregation();
    initFilters();
    renderAll();

    // 🔥 CLEAR SEARCH
    const input = document.getElementById("popupSearchInput");
    if (input) input.value = "";

    SELECTED_SEARCH = null;

// ✅ ADD HERE
const label = document.getElementById("activeFilter");
if (label) label.innerText = "";

    // ✅ CLOSE MODAL (IMPORTANT UX)
    const modal = document.getElementById("searchModal");
    if (modal) modal.style.display = "none";
};
// ================= SELECT =================
function selectPopupSuggestion(company, subcontractor) {

    document.getElementById("popupSearchInput").value = subcontractor;

    // FILTER DASHBOARD
    if (window.applyGlobalFilter) {

        const filtered = SEARCH_DATA.filter(x =>
            x.subcontractor_name === subcontractor
        );

        window.applyGlobalFilter(filtered);
    }

    closeSearchModal();
}
window.toggleTheme = function () {

    const body = document.body;

    if (body.classList.contains("dark-mode")) {
        body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
    } else {
        body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
    }
};

window.setSearchType = function(type) {
    CURRENT_SEARCH_TYPE = type;

    document.getElementById("btnCompany").classList.remove("active");
    document.getElementById("btnSubcontractor").classList.remove("active");

    if (type === "company") {
        document.getElementById("btnCompany").classList.add("active");
    } else {
        document.getElementById("btnSubcontractor").classList.add("active");
    }
}

// ================= BUTTON ACTION =================
window.confirmSearch = function() {

    if (!SELECTED_SEARCH) {
    const input = document.getElementById("popupSearchInput").value.trim();

    if (!input) {
        alert("Please type or select");
        return;
    }

    // fallback search
    SELECTED_SEARCH = {
    id: null, // 🔥 important
    company: input,
    subcontractor: input
};
}

    console.log("Selected:", SELECTED_SEARCH);

    let filtered = [];

    if (CURRENT_SEARCH_TYPE === "company") {
    filtered = SEARCH_DATA.filter(x =>
    normalize(x.company_name)
    .includes(normalize(SELECTED_SEARCH.company))
);
}

   if (CURRENT_SEARCH_TYPE === "subcontractor") {

    filtered = SEARCH_DATA.filter(x => {

    const name = normalize(x.subcontractor_name);
const inputNorm = normalize(SELECTED_SEARCH.subcontractor);
        // 🔥 match by ID OR name
        return (
            (SELECTED_SEARCH.id && x.subcontractor_id == SELECTED_SEARCH.id)
            ||
            name.includes(inputNorm)
        );
    });
}

    console.log("Filtered Result:", filtered.length);

// ✅ ADD HERE
const label = document.getElementById("activeFilter");

if (label) {
    label.innerText =
        CURRENT_SEARCH_TYPE === "company"
        ? `Filtered by Company: ${SELECTED_SEARCH.company}`
        : `Filtered by Subcontractor: ${SELECTED_SEARCH.subcontractor}`;
}


    // 🚨 IMPORTANT FIX
    if (window.applyGlobalFilter && typeof window.applyGlobalFilter === "function") {
        window.applyGlobalFilter(filtered);
    } else {
        console.error("applyGlobalFilter NOT FOUND");
    }

    closeSearchModal();
}
function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}