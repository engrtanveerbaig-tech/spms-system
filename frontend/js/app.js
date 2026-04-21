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

    // CLOSE MODAL
    const modal = document.getElementById("searchModal");
    const box = document.querySelector(".search-box");

    if (modal && modal.style.display !== "none") {
    if (!box.contains(e.target)) {
        modal.style.display = "none";
    }
}

    // CLOSE SUGGESTIONS
    if (!e.target.closest(".search-container")) {
        const sug = document.getElementById("searchSuggestions");
        if (sug) sug.style.display = "none";
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
// ================= GLOBAL SEARCH MODAL =================

// store full data


async function loadSearchData() {
    if (SEARCH_DATA.length > 0) return; // ✅ cache
    try {
        const res = await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all", {
    headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
    }
});
       const result = await res.json();

if (!Array.isArray(result)) {
    console.error("Invalid search data:", result);
    return;
}

SEARCH_DATA = result;
GLOBAL_DATA = SEARCH_DATA;

        console.log("SEARCH DATA LOADED:", SEARCH_DATA.length); // ✅ HERE
    } catch (err) {
        console.error("Search API error", err);
    }
}

// open modal
async function openSearchModal() {

    document.getElementById("searchModal").style.display = "flex";

    if (SEARCH_DATA.length === 0) {
        await loadSearchData();   // 🔥 WAIT FOR DATA
    }

    document.getElementById("popupSearchInput").focus();
}

// close modal
function closeSearchModal() {
    document.getElementById("searchModal").style.display = "none";
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

    const input = inputEl.value.toLowerCase().trim();

    console.log("Typing:", input);

    // 🔥 WAIT FOR DATA
    if (!SEARCH_DATA || SEARCH_DATA.length === 0) {
        box.innerHTML = "<div>Loading...</div>";
        box.style.display = "block";
        return;
    }

    // ❌ EMPTY INPUT
    if (!input) {
        box.style.display = "none";
        return;
    }

    // 🎯 FILTER BASED ON TYPE
    const results = SEARCH_DATA.filter(x => {

        const company = (x.company_name || "").toLowerCase();
        const subcontractor = (x.subcontractor_name || "").toLowerCase();

        if (CURRENT_SEARCH_TYPE === "company") {
            return company.includes(input);
        }

        if (CURRENT_SEARCH_TYPE === "subcontractor") {
            return subcontractor.includes(input);
        }

        return false;
    });

    // ❌ NO RESULT
    if (results.length === 0) {
        box.innerHTML = "<div>No results found</div>";
        box.style.display = "block";
        return;
    }

    // ✅ CLEAR OLD RESULTS
    box.innerHTML = "";

    // 🔥 LIMIT RESULTS
    results.slice(0, 10).forEach(r => {

        const div = document.createElement("div");

        let text = "";

        if (CURRENT_SEARCH_TYPE === "company") {
            text = r.company_name || "No Company";
        } else {
            text = r.subcontractor_name || "No Subcontractor";
        }

        // ✅ 🔥 APPLY HIGHLIGHT HERE
        div.innerHTML = highlightText(text, input);

        // 🖱 CLICK SELECT
        div.onclick = () => {

            SELECTED_SEARCH = {
                id: r.subcontractor_id,
                company: (r.company_name || "").trim(),
                subcontractor: (r.subcontractor_name || "").trim()
            };

            document.getElementById("popupSearchInput").value =
                CURRENT_SEARCH_TYPE === "company"
                ? r.company_name
                : r.subcontractor_name;

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

    if (body.classList.contains("light-mode")) {
        body.classList.remove("light-mode");
        localStorage.setItem("theme", "dark");
    } else {
        body.classList.add("light-mode");
        localStorage.setItem("theme", "light");
    }
};

function setSearchType(type) {
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
function confirmSearch() {

    if (!SELECTED_SEARCH) {
        alert("Please select from list");
        return;
    }

    console.log("Selected:", SELECTED_SEARCH);

    let filtered = [];

    if (CURRENT_SEARCH_TYPE === "company") {
    filtered = SEARCH_DATA.filter(x =>
        x.company_name === SELECTED_SEARCH.company
    );
}

   if (CURRENT_SEARCH_TYPE === "subcontractor") {
    filtered = SEARCH_DATA.filter(x =>
        x.subcontractor_id == SELECTED_SEARCH.id   // ✅ FIX
    );
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