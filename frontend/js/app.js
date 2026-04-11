// ================= LOGIN CHECK =================
if (!localStorage.getItem("role")) {
    window.location.href = "login.html";
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

    // 🔐 BLOCK VIEWER ACCESS
    if (role === "viewer" && !page.includes("dashboard")) {
        alert("Access Denied");
        return;
    }

    const container = document.getElementById("mainContent");

    // LOAD HTML
    const res = await fetch(page);
    const html = await res.text();
    container.innerHTML = html;

    // WAIT DOM
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    console.log("Page loaded:", page);

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
}

// ================= DEFAULT LOAD =================
loadPage("./dashboard.html");

// ================= LOGOUT =================
function logout() {
    localStorage.removeItem("role");
    window.location.href = "login.html";
}