/* ============================================================
   SPMS v2 — app.js  (shell: routing, search, theme, auth)
   All API endpoints and business logic unchanged.
   ============================================================ */

function normalize(text){
  return(text||"").toString().normalize("NFKD").replace(/[^\w\s\u0600-\u06FF]/g,"").trim().replace(/\s+/g," ").toLowerCase();
}

let SEARCH_DATA=[];
let GLOBAL_DATA=[];
let FILTERED_DATA=[];
let SELECTED_SEARCH=null;
let CURRENT_SEARCH_TYPE="company";

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
  if(!subMenu||!payMenu) return;
  if(role==="viewer"){
    [subMenu,payMenu].forEach(el=>{el.style.opacity="0.3";el.style.pointerEvents="none";el.title="No access";});
  }
}

// ── Load Script ──────────────────────────────────────────
async function loadScript(src){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[src^="${src}"]`)){resolve();return;}
    const s=document.createElement("script");
    s.src=src+"?v="+Date.now();
    s.onload=()=>resolve();
    s.onerror=()=>reject();
    document.body.appendChild(s);
  });
}

// ── Load Page ────────────────────────────────────────────
async function loadPage(page){
  // Active nav
  document.querySelectorAll(".nav-item").forEach(i=>i.classList.remove("active"));
  if(page.includes("dashboard")){const el=document.querySelector('.nav-item[onclick*="dashboard"]');if(el)el.classList.add("active");}
  if(page.includes("subcontractor")){const el=document.getElementById("subMenu");if(el)el.classList.add("active");}
  if(page.includes("payment")){const el=document.getElementById("payMenu");if(el)el.classList.add("active");}

  const token=localStorage.getItem("token");
  const role=localStorage.getItem("role");
  if(!token){alert("Please login");window.location.href="login.html";return;}
  if(role==="viewer"&&!page.includes("dashboard")){alert("Access denied");return;}

  const container=document.getElementById("mainContent");
  try{
    const res=await fetch(page);
    const html=await res.text();
    container.innerHTML=html;
    container.style.opacity=0;
    setTimeout(()=>{container.style.transition="opacity .25s";container.style.opacity=1;},30);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    applyRoleUI();

    if(page.includes("dashboard")){
      await loadScript("js/charts.min.js");
      try{await loadScript("js/dashboard.js");}catch(e){console.error("Dashboard JS failed",e);}
      if(typeof window.loadDashboard==="function") window.loadDashboard();
      else container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:Outfit,sans-serif'>Dashboard script failed to load.</div>";
    }
    if(page.includes("subcontractor")){
      await loadScript("js/subcontractor.js");
      if(window.initSubcontractorPage) window.initSubcontractorPage();
    }
    if(page.includes("payment")){
      await loadScript("js/payment.js");
      if(window.initPaymentPage) window.initPaymentPage();
    }
  }catch(err){
    console.error("Page Load Error:",err);
    container.innerHTML="<div style='padding:40px;color:#f43f5e;font-family:Outfit,sans-serif'>Error loading page.</div>";
  }
}

// ── Default load ─────────────────────────────────────────
const _token=localStorage.getItem("token");
if(_token){loadPage("dashboard.html");loadSearchData();}
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