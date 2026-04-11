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
        s.src = src + "?v=" + Date.now(); // prevent cache
        s.onload = resolve;

        document.body.appendChild(s);
    });
}

// ================= LOAD PAGE =================
async function loadPage(page) {

    const role = localStorage.getItem("role");

    // 🔐 BLOCK VIEWER ACCESS (extra safety)
    if (role === "viewer" && !page.includes("dashboard")) {
        alert("Access Denied");
        return;
    }

    const container = document.getElementById("mainContent");

    try {
        // LOAD HTML
        const res = await fetch(page);
        const html = await res.text();
        container.innerHTML = html;

        // WAIT DOM
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        console.log("Page loaded:", page);

        // APPLY ROLE UI AFTER LOAD
        applyRoleUI();

        // ================= PAGE JS =================

        if (page.includes("dashboard")) {

            await loadScript("./js/charts.min.js");
            await loadScript("./js/dashboard.js");

            if (window.loadDashboard) {
                console.log("INIT DASHBOARD");
                window.loadDashboard();
            }
        }

        if (page.includes("subcontractor")) {

            await loadScript("./js/subcontractor.js");

            if (window.initSubcontractorPage) {
                console.log("INIT SUBCONTRACTOR");
                window.initSubcontractorPage();
            }
        }

        if (page.includes("payment")) {

            await loadScript("./js/payment.js");

            if (window.initPaymentPage) {
                console.log("INIT PAYMENT");
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