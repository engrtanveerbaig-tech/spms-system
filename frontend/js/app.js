/* ============================================================
   SPMS v2 — app.js  (shell: routing, search, theme, auth)
   ============================================================ */

function normalize(text){
  return(text||"").toString().normalize("NFKD").replace(/[^\w\s\u0600-\u06FF]/g,"").trim().replace(/\s+/g," ").toLowerCase();
}

let SEARCH_DATA=[];
let GLOBAL_DATA=[];
let FILTERED_DATA=[];
let SELECTED_SEARCH=null;
let CURRENT_SEARCH_TYPE="company";
// ── ROLE PERMISSIONS ─────────────────────────────
window.ROLE_PERMISSIONS = window.ROLE_PERMISSIONS || {
  admin: ["dashboard","subcontractor","payment","roles"],
  manager:["dashboard"],
  engineer: ["dashboard"],
  viewer: ["payment"],
  contract_department: ["subcontractor"]
};

// Theme
const savedTheme=localStorage.getItem("theme");
document.addEventListener("DOMContentLoaded",()=>{
  if(savedTheme==="light") document.body.classList.add("light-mode");
});

// Close search on outside click
document.addEventListener("click",function(e){
  const modal=document.getElementById("searchModal");
  const box=document.querySelector(".search-box");
  if(e.target.closest('[onclick*="openSearchModal"]')) return;
  if(modal&&modal.style.display==="flex"&&box&&!box.contains(e.target)) closeSearchModal();
});

// ── Role UI ──────────────────────────────────────────────
function applyRoleUI(){
  const token=localStorage.getItem("token");
  const role=localStorage.getItem("role");
  if(!token){window.location.href="login.html";return;}
  const subMenu=document.getElementById("subMenu");
  const payMenu=document.getElementById("payMenu");
 // if(!subMenu||!payMenu) return;
  const allowedPages = ROLE_PERMISSIONS[role] || [];

// Hide Subcontractor menu
if(subMenu && !allowedPages.includes("subcontractor")){
  subMenu.style.display = "none";
}

// Hide Payment menu
if(payMenu && !allowedPages.includes("payment")){
  payMenu.style.display = "none";
}

// Hide Roles menu
const rolesMenu = document.getElementById("rolesMenu");
if(rolesMenu && !allowedPages.includes("roles")){
  rolesMenu.style.display = "none";
}
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
  if(page.includes("dashboard"))     { const el=document.querySelector('.nav-item[onclick*="dashboard"]');    if(el)el.classList.add("active"); }
  if(page.includes("subcontractor")) { const el=document.getElementById("subMenu");                           if(el)el.classList.add("active"); }
  if(page.includes("payment"))       { const el=document.getElementById("payMenu");                           if(el)el.classList.add("active"); }
  if(page.includes("roles"))         { const el=document.getElementById("rolesMenu");                         if(el)el.classList.add("active"); }

  const token=localStorage.getItem("token");
  const role=localStorage.getItem("role");
  if(!token){alert("Please login");window.location.href="login.html";return;}

// ── Access guards (NEW SYSTEM) ──
const allowedPages = ROLE_PERMISSIONS[role] || [];

const pageKey =
  page.includes("dashboard") ? "dashboard" :
  page.includes("subcontractor") ? "subcontractor" :
  page.includes("payment") ? "payment" :
  page.includes("roles") ? "roles" : "";

if(!allowedPages.includes(pageKey)){
  alert("Access denied");
  return;
}

  const container=document.getElementById("mainContent");

  // Inline spinner
  container.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:60vh;flex-direction:column;gap:12px;">
    <div style="width:34px;height:34px;border:2px solid rgba(245,158,11,.25);border-top-color:#f59e0b;border-radius:50%;animation:spin .8s linear infinite;"></div>
    <div style="font-size:11px;letter-spacing:.12em;color:#3d4a6a;font-family:'JetBrains Mono',monospace;">LOADING</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`;

  try{
    const res=await fetch(page+"?v="+Date.now());
    if(!res.ok) throw new Error("HTTP "+res.status+" fetching "+page);
    const html=await res.text();

    // Parse — extract body + inject head styles
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

    // Fade in
    container.style.opacity=0;
    setTimeout(()=>{container.style.transition="opacity .25s";container.style.opacity=1;},30);

    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    applyRoleUI();

    // ── DASHBOARD ──────────────────────────────────────
    if(page.includes("dashboard")){
      await loadScript("js/charts.min.js", false);
      console.log("Chart available:", typeof Chart);
      executeScripts(container);
      try{
        await loadScript("js/dashboard.js", true);
      }catch(e){
        console.error("dashboard.js failed to load:", e);
        container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:monospace'>Dashboard script failed to load. Check that <code>js/dashboard.js</code> exists.</div>";
        return;
      }
      await new Promise(r=>setTimeout(r,80));
      if(typeof window.loadDashboard==="function"){
        window.loadDashboard();
      } else {
        console.error("loadDashboard not found after script load");
        container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:monospace'>Dashboard initialisation failed. Check js/dashboard.js.</div>";
      }
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
    // roles.html is self-contained (all JS inline) — just execute its scripts.
    // No external JS file needed.
    if(page.includes("roles")){
      executeScripts(container);
      // roles.html calls its own loadUsers() on DOMContentLoaded.
      // Since DOMContentLoaded already fired, trigger it manually:
      await new Promise(r=>setTimeout(r,60));
      if(typeof window._rolesPageInit==="function"){
        window._rolesPageInit();
      } else {
        // Fallback: dispatch a custom event roles.html can listen to
        container.dispatchEvent(new CustomEvent("spms:pageload"));
        // Also directly call loadUsers if it was registered globally
        if(typeof window._loadRolesUsers==="function") window._loadRolesUsers();
      }
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
  const allowedPages = ROLE_PERMISSIONS[role] || [];

  if(allowedPages.includes("dashboard")) loadPage("dashboard.html");
  else if(allowedPages.includes("subcontractor")) loadPage("subcontractor.html");
  else if(allowedPages.includes("payment")) loadPage("payment.html");
  else loadPage("dashboard.html");

  loadSearchData();
}
else window.location.href="login.html";

// ── Search Data ──────────────────────────────────────────
async function loadSearchData(){
  if(SEARCH_DATA.length>0) return;
  try{
    const res=await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all-full",{
      headers:{"Authorization":`Bearer ${localStorage.getItem("token")}`}
    });
    const result=await res.json();
    if(!Array.isArray(result)){console.error("Invalid search data:",result);return;}
    SEARCH_DATA=result.map(x=>({...x,
      subcontractor_id:x.subcontractor_id||x.sub_id||0,
      subcontractor_name:x.subcontractor_name||x.sub_name||"Unknown",
      company_name:x.company_name||"N/A",
      work_type:x.work_type||"Other",
      work_value:Number(x.work_value||0),
      net_payment:Number(x.net_payment||0),
      retention_amount:Number(x.retention_amount||0),
      deduction:Number(x.deduction||0),
      advance_deduction:Number(x.advance_deduction||0),
      refund:Number(x.refund||0)
    }));
    GLOBAL_DATA=SEARCH_DATA;
    console.log("Search data loaded:", SEARCH_DATA.length, "records");
  }catch(err){console.error("Search API error",err);}
}

// ── Search Modal ─────────────────────────────────────────
window.openSearchModal=async function(){
  const modal=document.getElementById("searchModal");
  if(!modal) return;
  modal.style.display="flex";
  if(SEARCH_DATA.length===0) await loadSearchData();
  const inp=document.getElementById("popupSearchInput");
  if(inp) inp.focus();
};

window.closeSearchModal=function(){
  const modal=document.getElementById("searchModal");
  if(modal) modal.style.display="none";
  SELECTED_SEARCH=null;
  const inp=document.getElementById("popupSearchInput");
  if(inp) inp.value="";
  const box=document.getElementById("popupSuggestions");
  if(box) box.innerHTML="";
};

// ── Highlight ────────────────────────────────────────────
function highlightText(text,query){
  if(!query) return text;
  const safe=query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return text.replace(new RegExp(`(${safe})`,"gi"),'<span class="highlight">$1</span>');
}

// ── Popup search input ───────────────────────────────────
function handlePopupSearch(){
  const inputEl=document.getElementById("popupSearchInput");
  const box=document.getElementById("popupSuggestions");
  if(!inputEl||!box) return;
  const input=inputEl.value.trim();
  const inputNorm=normalize(input);
  if(!SEARCH_DATA||!SEARCH_DATA.length){box.innerHTML="<div>Loading…</div>";box.style.display="block";return;}
  if(!inputNorm){box.style.display="none";return;}
  const results=SEARCH_DATA.filter(x=>{
    const co=normalize(x.company_name);
    const su=normalize(x.subcontractor_name);
    return CURRENT_SEARCH_TYPE==="company"?co.includes(inputNorm):su.includes(inputNorm);
  });
  const unique=[...new Map(results.map(r=>[normalize(CURRENT_SEARCH_TYPE==="company"?r.company_name:r.subcontractor_name),r])).values()];
  if(!unique.length){box.innerHTML="<div>No results found</div>";box.style.display="block";return;}
  box.innerHTML="";
  unique.slice(0,10).forEach(r=>{
    const div=document.createElement("div");
    const text=CURRENT_SEARCH_TYPE==="company"?`${r.company_name} (${r.subcontractor_name})`:`${r.subcontractor_name} — ${r.company_name}`;
    div.innerHTML=highlightText(text,inputNorm);
    div.onclick=()=>{
      SELECTED_SEARCH={id:r.subcontractor_id,company:(r.company_name||"").trim(),subcontractor:(r.subcontractor_name||"").trim()};
      inputEl.value=text;box.style.display="none";
    };
    box.appendChild(div);
  });
  box.style.display="block";
}

window.setSearchType=function(type){
  CURRENT_SEARCH_TYPE=type;
  document.getElementById("btnCompany")?.classList.remove("active");
  document.getElementById("btnSubcontractor")?.classList.remove("active");
  if(type==="company") document.getElementById("btnCompany")?.classList.add("active");
  else document.getElementById("btnSubcontractor")?.classList.add("active");
};

window.confirmSearch=function(){
  if(!SELECTED_SEARCH){
    const input=document.getElementById("popupSearchInput")?.value.trim();
    if(!input){alert("Please type or select");return;}
    SELECTED_SEARCH={id:null,company:input,subcontractor:input};
  }
  let filtered=[];
  if(CURRENT_SEARCH_TYPE==="company")
    filtered=SEARCH_DATA.filter(x=>normalize(x.company_name).includes(normalize(SELECTED_SEARCH.company)));
  if(CURRENT_SEARCH_TYPE==="subcontractor")
    filtered=SEARCH_DATA.filter(x=>{
      const name=normalize(x.subcontractor_name);
      const inputNorm=normalize(SELECTED_SEARCH.subcontractor);
      return(SELECTED_SEARCH.id&&x.subcontractor_id==SELECTED_SEARCH.id)||name.includes(inputNorm);
    });
  const label=document.getElementById("activeFilter");
  if(label){
    label.innerText=CURRENT_SEARCH_TYPE==="company"?`Company: ${SELECTED_SEARCH.company}`:`Sub: ${SELECTED_SEARCH.subcontractor}`;
    label.classList.add("show");
  }
  if(typeof window.applyGlobalFilter==="function") window.applyGlobalFilter(filtered);
  else console.error("applyGlobalFilter not available — dashboard may not be loaded yet");
  closeSearchModal();
};

// ── Theme ────────────────────────────────────────────────
window.toggleTheme=function(){
  const body=document.body;
  if(body.classList.contains("light-mode")){body.classList.remove("light-mode");localStorage.setItem("theme","dark");}
  else{body.classList.add("light-mode");localStorage.setItem("theme","light");}
};

// ── Logout ───────────────────────────────────────────────
function logout(){localStorage.clear();window.location.href="login.html";}