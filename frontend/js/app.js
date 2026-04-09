async function loadScript(src) {
    return new Promise((resolve) => {

        // remove old script if exists
        const old = document.querySelector(`script[src^="${src}"]`);
        if (old) old.remove();

        const s = document.createElement("script");
        s.src = src + "?v=" + Date.now(); // prevent cache
        s.onload = resolve;

        document.body.appendChild(s);
    });
}

async function loadPage(page) {

    const container = document.getElementById("mainContent");

    // ================= LOAD HTML =================
    const res = await fetch(page);
    const html = await res.text();
    container.innerHTML = html;

    // ================= WAIT DOM =================
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    console.log("Page loaded:", page);

    // ================= LOAD PAGE JS =================

    if (page.includes("dashboard")) {

    // ✅ LOAD CHART FIRST
    await loadScript("./js/charts.min.js");

    // ✅ THEN DASHBOARD
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
loadPage("dashboard.html");