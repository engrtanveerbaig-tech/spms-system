/* ============================================================
   SPMS v2 — app.js  (shell: routing, search, theme, auth)
   Added: cycles.html and reports.html routing
   ============================================================ */

function normalize(text){
  return(text||"").toString().normalize("NFKD").replace(/[^\w\s\u0600-\u06FF]/g,"").trim().replace(/\s+/g," ").toLowerCase();
}

let GLOBAL_DATA=[];

// ── ROLE PERMISSIONS ─────────────────────────────
window.ROLE_PERMISSIONS = window.ROLE_PERMISSIONS || {
  admin:               ["dashboard","subcontractor","payment","roles","cycles","reports"],
  manager:             ["dashboard","cycles","reports"],
  finance:             ["dashboard","reports","cycles"],
  engineer:            ["dashboard"],
  viewer:              ["payment"],
  contract_department: ["subcontractor"]
};

// Theme
const savedTheme=localStorage.getItem("theme");
document.addEventListener("DOMContentLoaded",()=>{
  if(savedTheme==="light") document.body.classList.add("light-mode");
});


// ── Role UI ──────────────────────────────────────────────
function applyRoleUI(){
  const token=localStorage.getItem("token");
  const role=localStorage.getItem("role");
  if(!token){window.location.href="login.html";return;}

  const allowedPages = window.ROLE_PERMISSIONS[role] || [];

  const menuMap = {
    "subMenu":      "subcontractor",
    "payMenu":      "payment",
    "rolesMenu":    "roles",
    "cyclesMenu":   "cycles",
    "reportsMenu":  "reports"
  };

  Object.entries(menuMap).forEach(([id, page]) => {
    const el = document.getElementById(id);
    if(!el) return;
    if(!allowedPages.includes(page)){
      el.style.display = "none";
    } else {
      el.style.display = "";
    }
  });
}

// ── Execute scripts extracted from fetched HTML ──────────
function executeScripts(container){
  const scripts=container.querySelectorAll("script");
  scripts.forEach(function(oldScript){
    const newScript=document.createElement("script");
    Array.from(oldScript.attributes).forEach(attr=>{
      newScript.setAttribute(attr.name,attr.value);
    });
    if(oldScript.src){
      // src scripts handled by loadScript
    } else {
      newScript.textContent=oldScript.textContent;
      document.body.appendChild(newScript);
      newScript.remove();
    }
    oldScript.remove();
  });
}

// ── Load Script ──────────────────────────────────────────
async function loadScript(src, forceReload){
  return new Promise((resolve,reject)=>{
    const baseSrc = src.split("?")[0];
    if(forceReload){
      document.querySelectorAll(`script[data-spms-src="${baseSrc}"]`).forEach(s=>s.remove());
      if(baseSrc.includes("dashboard"))    { window.loadDashboard=undefined; delete window.loadDashboard; }
      if(baseSrc.includes("payment"))      { window.initPaymentPage=undefined; delete window.initPaymentPage; }
      if(baseSrc.includes("subcontractor")){ window.initSubcontractorPage=undefined; delete window.initSubcontractorPage; }
      if(baseSrc.includes("cycles"))       { window.initCyclesPage=undefined; delete window.initCyclesPage; }
      if(baseSrc.includes("reports"))      { window.initReportsPage=undefined; delete window.initReportsPage; }
    } else {
      if(document.querySelector(`script[data-spms-src="${baseSrc}"]`)){resolve();return;}
    }
    const s=document.createElement("script");
    s.src=baseSrc+"?v="+Date.now();
    s.setAttribute("data-spms-src", baseSrc);
    s.onload=()=>{console.log("Loaded:",baseSrc);resolve();};
    s.onerror=(e)=>{console.error("Failed to load:",baseSrc,e);reject(new Error("Script load failed: "+baseSrc));};
    document.body.appendChild(s);
  });
}

// ── Load Page ────────────────────────────────────────────
async function loadPage(page){

  // ── Active nav highlight ──
  document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
  const navMap = {
    "dashboard":     '.nav-item[onclick*="dashboard"]',
    "subcontractor": "#subMenu",
    "payment":       "#payMenu",
    "roles":         "#rolesMenu",
    "cycles":        "#cyclesMenu",
    "reports":       "#reportsMenu"
  };
  Object.entries(navMap).forEach(([key, sel]) => {
    if(page.includes(key)){
      const el = sel.startsWith("#") ? document.getElementById(sel.slice(1)) : document.querySelector(sel);
      if(el) el.classList.add("active");
    }
  });

  const token=localStorage.getItem("token");
  const role=localStorage.getItem("role");
  if(!token){alert("Please login");window.location.href="login.html";return;}

  // ── Access guards ──
  const allowedPages = window.ROLE_PERMISSIONS[role] || [];
  const pageKey =
    page.includes("dashboard")     ? "dashboard"     :
    page.includes("subcontractor") ? "subcontractor" :
    page.includes("payment")       ? "payment"       :
    page.includes("roles")         ? "roles"         :
    page.includes("cycles")        ? "cycles"        :
    page.includes("reports")       ? "reports"       : "";

  if(!allowedPages.includes(pageKey)){
    alert("Access denied");
    return;
  }

  const container=document.getElementById("mainContent");

  container.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:12px;">
    <div style="width:34px;height:34px;border:2px solid rgba(245,158,11,.25);border-top-color:#f59e0b;border-radius:50%;animation:spin .8s linear infinite;"></div>
    <div style="font-size:11px;letter-spacing:.12em;color:#3d4a6a;font-family:'JetBrains Mono',monospace;">LOADING</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`;

  try{
    const res=await fetch(page+"?v="+Date.now());
    if(!res.ok) throw new Error("HTTP "+res.status+" fetching "+page);
    const html=await res.text();

    const parser=new DOMParser();
    const doc=parser.parseFromString(html,"text/html");

    doc.querySelectorAll("head style").forEach(function(s){
      const existing=document.head.querySelector(`style[data-page="${page}"]`);
      if(existing)existing.remove();
      const newStyle=document.createElement("style");
      newStyle.setAttribute("data-page",page);
      newStyle.textContent=s.textContent;
      document.head.appendChild(newStyle);
    });

    container.innerHTML=doc.body.innerHTML;
    container.style.opacity=0;
    setTimeout(()=>{container.style.transition="opacity .25s";container.style.opacity=1;},30);

    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    applyRoleUI();

    // ── DASHBOARD ──────────────────────────────────────
    if(page.includes("dashboard")){
      await loadScript("js/charts.min.js", false);
      executeScripts(container);
      try{ await loadScript("js/dashboard.js", true); }
      catch(e){
        container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:monospace'>Dashboard script failed to load.</div>";
        return;
      }
      await new Promise(r=>setTimeout(r,80));
      if(typeof window.loadDashboard==="function") window.loadDashboard();
      else container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:monospace'>Dashboard init failed.</div>";
    }

    // ── SUBCONTRACTORS ─────────────────────────────────
    if(page.includes("subcontractor")){
      executeScripts(container);
      await loadScript("js/subcontractor.js", true);
      await new Promise(r=>setTimeout(r,50));
      if(window.initSubcontractorPage) window.initSubcontractorPage();
    }

    // ── PAYMENTS ───────────────────────────────────────
    if(page.includes("payment")){
      executeScripts(container);
      await loadScript("js/payment.js", true);
      await new Promise(r=>setTimeout(r,50));
      if(window.initPaymentPage) window.initPaymentPage();
    }

    // ── ROLES ──────────────────────────────────────────
    if(page.includes("roles")){
      executeScripts(container);
      await new Promise(r=>setTimeout(r,60));
      if(typeof window._rolesPageInit==="function") window._rolesPageInit();
      else {
        container.dispatchEvent(new CustomEvent("spms:pageload"));
        if(typeof window._loadRolesUsers==="function") window._loadRolesUsers();
      }
    }

    // ── CYCLES ─────────────────────────────────────────
    if(page.includes("cycles")){
      executeScripts(container);
      await new Promise(r=>setTimeout(r,60));
      if(typeof window._cyclesPageInit==="function") window._cyclesPageInit();
    }

    // ── REPORTS ────────────────────────────────────────
    if(page.includes("reports")){
      await loadScript("js/charts.min.js", false);
      executeScripts(container);
      await new Promise(r=>setTimeout(r,60));
      if(typeof window._reportsPageInit==="function") window._reportsPageInit();
    }

  }catch(err){
    console.error("Page Load Error:",err);
    container.innerHTML=`<div style='padding:40px;color:#f43f5e;font-family:monospace'>Error loading page: ${err.message}</div>`;
  }
}

// ── Default load ─────────────────────────────────────────
const _token=localStorage.getItem("token");
if(_token){
  const role = localStorage.getItem("role");
  const allowedPages = window.ROLE_PERMISSIONS[role] || [];
  if(allowedPages.includes("dashboard"))      loadPage("dashboard.html");
  else if(allowedPages.includes("subcontractor")) loadPage("subcontractor.html");
  else if(allowedPages.includes("payment"))   loadPage("payment.html");
  else if(allowedPages.includes("reports"))   loadPage("reports.html");
  else loadPage("dashboard.html");
}
else window.location.href="login.html";


function highlightText(text,query){
  if(!query) return text;
  const safe=query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return text.replace(new RegExp(`(${safe})`,"gi"),'<span class="highlight">$1</span>');
}


window.toggleTheme=function(){
  const body=document.body;
  if(body.classList.contains("light-mode")){body.classList.remove("light-mode");localStorage.setItem("theme","dark");}
  else{body.classList.add("light-mode");localStorage.setItem("theme","light");}
};

function logout(){localStorage.clear();window.location.href="login.html";}