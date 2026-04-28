/* ============================================================
   SPMS v2 — dashboard.js
   All API calls, data flow, and business logic unchanged.
   ============================================================ */
(function(){
var CURRENT_DATA=[],dashboardLoaded=false,RAW_DATA=[],ORIGINAL_DATA=[],AGG_DATA=[];
var FILTER_STATE={company:"",type:"",subcontractor:""};

function fmt(n){return Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});}
function getCtx(id){var el=document.getElementById(id);if(!el){console.warn("Missing canvas:",id);return null;}return el.getContext("2d");}
function sum(arr,key){return arr.reduce(function(a,b){return a+(b[key]||0);},0);}
function groupBy(arr,key,val){var r={};arr.forEach(function(x){r[x[key]]=(r[x[key]]||0)+(x[val]||0);});return r;}

// ── LOAD ─────────────────────────────────────────────────
async function loadDashboard(){
  if(dashboardLoaded) return;
  dashboardLoaded=true;
  try{
    var token=localStorage.getItem("token");
    var res=await fetch("https://spms-backend-jxzn.onrender.com/api/payments/all-full",{headers:{"Authorization":"Bearer "+token}});
    if(!res.ok){
      var text=await res.text();
      if(text.includes("token")||text.includes("Unauthorized")){alert("Session expired.");localStorage.clear();window.location.href="login.html";return;}
      alert("Server error.");return;
    }
    var data=await res.json();
    if(!Array.isArray(data)){alert("Failed to load dashboard data.");return;}

    var skel=document.getElementById("dashboardSkeleton");
    var cont=document.getElementById("dashboardContent");
    if(skel) skel.style.display="none";
    if(cont){cont.style.display="block";cont.classList.add("fade-in");}

    ORIGINAL_DATA=data.map(function(item){return Object.freeze(Object.assign({},item));});
    Object.freeze(ORIGINAL_DATA);
    RAW_DATA=data.map(function(item){return Object.assign({},item);});

    var tWork=0,tRet=0,tDed=0,tNet=0;
    data.forEach(function(item){tWork+=Number(item.work_value||0);tRet+=Number(item.retention_amount||0);tDed+=Number(item.deduction||0);tNet+=Number(item.net_payment||0);});
    setEl("total_work",tWork.toFixed(2));
    setEl("total_retention",tRet.toFixed(2));
    setEl("total_deduction",tDed.toFixed(2));
    setEl("total_paid",tNet.toFixed(2));
    setEl("total_sar",tNet.toFixed(2));

    buildAggregation();initFilters();renderAll();
  }catch(err){console.error("Dashboard Error:",err);}
}

function setEl(id,val){var el=document.getElementById(id);if(el) el.innerText=val;}

// ── WORK TYPE SUMMARY ────────────────────────────────────
function renderWorkTypeSummary(data){
  var c=document.getElementById("workTypeSummary");if(!c) return;
  var tc={};data.forEach(function(item){var t=item.work_type||"Other";tc[t]=(tc[t]||0)+1;});
  c.innerHTML="<strong>Total Certificates:</strong> "+data.length+"<br>"+Object.entries(tc).map(function(e){return e[0]+": "+e[1];}).join(" &nbsp;|&nbsp; ");
}

// ── AGGREGATION ──────────────────────────────────────────
function buildAggregation(){
  var map={};
  RAW_DATA.forEach(function(p){
    var id=p.subcontractor_id+"_"+p.work_type;
    if(!map[id]) map[id]={company:p.company_name||"N/A",subcontractor:p.subcontractor_name||p.sub_name||"Unknown",work_type:p.work_type||"Other",total_work:0,total_withdrawn:0,total_net:0,total_retention:0,total_advance:0,total_deduction:0,total_refund:0,cert_count:0};
    map[id].total_work+=parseFloat(p.work_value)||0;
    map[id].total_net+=parseFloat(p.net_payment)||0;
    map[id].total_retention+=parseFloat(p.retention_amount)||0;
    map[id].total_withdrawn+=parseFloat(p.withdrawn||p.work_withdrawn||0);
    map[id].total_advance+=parseFloat(p.advance_deduction)||0;
    map[id].total_deduction+=parseFloat(p.deduction)||0;
    map[id].total_refund+=parseFloat(p.refund)||0;
    map[id].cert_count++;
  });
  AGG_DATA=Object.values(map);
}

// ── FILTERS ──────────────────────────────────────────────
function initFilters(){
  var cEl=document.getElementById("filterCompany"),tEl=document.getElementById("filterType"),sEl=document.getElementById("filterSub");
  populateSel(cEl,getUniq("company"));populateSel(tEl,getUniq("work_type"));populateSel(sEl,getUniq("subcontractor"));
  cEl.onchange=function(){FILTER_STATE.company=cEl.value;updDep();renderAll();};
  tEl.onchange=function(){FILTER_STATE.type=tEl.value;updDep();renderAll();};
  sEl.onchange=function(){FILTER_STATE.subcontractor=sEl.value;updDep();renderAll();};
}
function populateSel(el,vals){
  if(!el) return;var cur=el.value;
  el.innerHTML='<option value="">All</option>'+vals.map(function(v){return'<option value="'+v+'">'+v+'</option>';}).join("");
  if(vals.indexOf(cur)>-1) el.value=cur;else el.value="";
}
function getUniq(key){
  return[...new Set(RAW_DATA.map(function(x){if(key==="company") return x.company_name;if(key==="work_type") return x.work_type;if(key==="subcontractor") return x.subcontractor_name;}).filter(Boolean))];
}
function updDep(){
  var f=getFilteredRaw();
  populateSel(document.getElementById("filterCompany"),[...new Set(f.map(function(x){return x.company_name;}).filter(Boolean))]);
  populateSel(document.getElementById("filterType"),[...new Set(f.map(function(x){return x.work_type;}).filter(Boolean))]);
  populateSel(document.getElementById("filterSub"),[...new Set(f.map(function(x){return x.subcontractor_name;}).filter(Boolean))]);
}
function applyFilt(){
  return AGG_DATA.filter(function(x){
    return(!FILTER_STATE.company||x.company.trim()===FILTER_STATE.company.trim())&&
           (!FILTER_STATE.type||x.work_type.trim()===FILTER_STATE.type.trim())&&
           (!FILTER_STATE.subcontractor||x.subcontractor===FILTER_STATE.subcontractor);
  });
}
function getFilteredRaw(){
  return RAW_DATA.filter(function(x){
    return(!FILTER_STATE.company||(x.company_name||"").trim()===(FILTER_STATE.company||"").trim())&&
           (!FILTER_STATE.type||(x.work_type||"").trim()===(FILTER_STATE.type||"").trim())&&
           (!FILTER_STATE.subcontractor||(x.subcontractor_name||"")===(FILTER_STATE.subcontractor||""));
  });
}

// ── RENDER ALL ───────────────────────────────────────────
function renderAll(){var d=applyFilt();renderKPIs(d);renderCharts(d);renderTable(d);renderWorkTypeSummary(getFilteredRaw());}

// ── KPIs ─────────────────────────────────────────────────
function renderKPIs(data){
  setEl("total_withdrawn",fmt(sum(data,"total_withdrawn")));
  setEl("total_refund",fmt(sum(data,"total_refund")));
  setEl("total_work",fmt(sum(data,"total_work")));
  setEl("total_paid",fmt(sum(data,"total_net")));
  setEl("total_retention",fmt(sum(data,"total_retention")));
  setEl("total_deduction",fmt(sum(data,"total_deduction")));
  setEl("total_sar",fmt(sum(data,"total_net")));
  setEl("total_subs",""+data.length);
  setEl("avg_cert",data.length?(sum(data,"cert_count")/data.length).toFixed(1):"0");
  // extra mini
  var types=[...new Set(data.map(function(d){return d.work_type;}).filter(Boolean))];
  setEl("mini_types",""+types.length);
  var top=data.length?data.reduce(function(a,b){return a.total_net>b.total_net?a:b;}):null;
  setEl("mini_top",top?top.subcontractor:"—");
  var tWork=sum(data,"total_work"),tRet=sum(data,"total_retention");
  setEl("mini_ret_pct",tWork>0?((tRet/tWork)*100).toFixed(1)+"%":"0%");
  var ai=document.getElementById("ai_summary");
  if(ai) ai.innerHTML=genAI(data);
}

function genAI(data){
  if(!data.length) return"No data available for current filter.";
  var tNet=sum(data,"total_net"),tWork=sum(data,"total_work"),tRet=sum(data,"total_retention"),tDed=sum(data,"total_deduction");
  var top=data.reduce(function(a,b){return a.total_net>b.total_net?a:b;});
  var tc={};data.forEach(function(x){tc[x.work_type]=(tc[x.work_type]||0)+1;});
  var mainType=Object.entries(tc).sort(function(a,b){return b[1]-a[1];})[0]?.[0]||"various";
  var perf="balanced financial performance";
  if(tNet>tWork) perf="strong positive cash flow";
  if(tRet>tNet*0.15) perf="high retention impact on cash flow";
  if(tDed>tNet*0.1) perf="notable deductions affecting profitability";
  return"Total work value: <strong>"+fmt(tWork)+"</strong> SAR &nbsp;·&nbsp; Net payments: <strong>"+fmt(tNet)+"</strong> SAR &nbsp;·&nbsp; Retention: <strong>"+fmt(tRet)+"</strong> SAR &nbsp;·&nbsp; Deductions: <strong>"+fmt(tDed)+"</strong> SAR<br>Primarily driven by <strong>"+mainType+"</strong> works. Top performer: <strong>"+top.company+"</strong>. Overall: <em>"+perf+"</em>.";
}

// ── CHARTS ───────────────────────────────────────────────
var PAL=["#7ea6e0","#346cc1","#f28b82","#c5e1a5","#ffd180","#b39ddb","#80cbc4","#93e6a4"];

function renderCharts(data){
  destroyCharts();
  createTrend(data);createType(data);createRetention(data);createTopSubs(data);renderWTCards(data);
}
function destroyCharts(){
  ["trendChart","typeChart","retentionChart"].forEach(function(k){if(window[k+"_inst"]) window[k+"_inst"].destroy();});
}

function createTrend(data){
  var ctx=getCtx("trendChart");if(!ctx) return;
  var top=[...data].sort(function(a,b){return b.total_net-a.total_net;}).slice(0,50);
  var gN=ctx.createLinearGradient(0,0,0,200);gN.addColorStop(0,"rgba(16,185,129,.38)");gN.addColorStop(1,"rgba(16,185,129,0)");
  var gR=ctx.createLinearGradient(0,0,0,200);gR.addColorStop(0,"rgba(245,158,11,.32)");gR.addColorStop(1,"rgba(245,158,11,0)");
  var gD=ctx.createLinearGradient(0,0,0,200);gD.addColorStop(0,"rgba(244,63,94,.32)");gD.addColorStop(1,"rgba(244,63,94,0)");
  window.trendChart_inst=new Chart(ctx,{type:"line",data:{labels:top.map(function(x){return x.company;}),datasets:[
    {label:"Net",data:top.map(function(x){return x.total_net;}),borderColor:"#10b981",backgroundColor:gN,fill:true,tension:.4,borderWidth:1.5,pointRadius:2},
    {label:"Retention",data:top.map(function(x){return x.total_retention;}),borderColor:"#f59e0b",backgroundColor:gR,fill:true,tension:.4,borderWidth:1.5,pointRadius:2},
    {label:"Deduction",data:top.map(function(x){return x.total_deduction;}),borderColor:"#f43f5e",backgroundColor:gD,fill:true,tension:.4,borderWidth:1.5,pointRadius:2}
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:"#101420",borderColor:"rgba(255,255,255,.08)",borderWidth:1,titleColor:"#e8eaf2",bodyColor:"#8892aa"}},scales:{x:{display:false},y:{display:false}}}});
}

function createType(data){
  var ctx=getCtx("typeChart");if(!ctx) return;
  var g=groupBy(data,"work_type","total_net");
  window.typeChart_inst=new Chart(ctx,{type:"pie",data:{labels:Object.keys(g),datasets:[{data:Object.values(g),backgroundColor:PAL,borderColor:"rgba(255,255,255,.05)",borderWidth:1,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:"right",labels:{color:"#8892aa",font:{size:10},boxWidth:10,padding:8}},tooltip:{backgroundColor:"#101420",borderColor:"rgba(255,255,255,.08)",borderWidth:1,titleColor:"#e8eaf2",bodyColor:"#8892aa"}}}});
}

function createRetention(data){
  var ctx=getCtx("retentionChart");if(!ctx) return;
  var top=[...data].sort(function(a,b){return b.total_retention-a.total_retention;}).slice(0,30);
  window.retentionChart_inst=new Chart(ctx,{type:"bar",data:{labels:top.map(function(x){return x.subcontractor;}),datasets:[{data:top.map(function(x){return x.total_retention;}),backgroundColor:"rgba(245,158,11,.7)",borderRadius:4},{data:top.map(function(x){return x.total_deduction;}),backgroundColor:"rgba(244,63,94,.65)",borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:"#101420",borderColor:"rgba(255,255,255,.08)",borderWidth:1,titleColor:"#e8eaf2",bodyColor:"#8892aa"}},scales:{x:{display:false},y:{display:false}}}});
}

function createTopSubs(data){
  var c=document.getElementById("topSubsList");if(!c) return;
  var g={};data.forEach(function(item){var n=item.subcontractor||"Unknown";g[n]=(g[n]||0)+Number(item.total_net||0);});
  var top=Object.entries(g).map(function(e){return{name:e[0],total:e[1]};}).sort(function(a,b){return b.total-a.total;}).slice(0,6);
  c.innerHTML=top.map(function(x){return'<div class="ts-card"><div class="ts-name">'+x.name+'</div><div class="ts-val">'+fmt(x.total)+'</div><div class="ts-cur">SAR</div></div>';}).join("");
}

function renderWTCards(data){
  var c=document.getElementById("workTypeCards");if(!c) return;
  var g={};var raw=getFilteredRaw();
  raw.forEach(function(item){var t=item.work_type||"Unknown";if(!g[t]) g[t]={certs:new Set(),subs:new Set()};g[t].certs.add(item.id||item.payment_id||item.invoice_no);g[t].subs.add(item.subcontractor_id);});
  c.innerHTML=Object.keys(g).map(function(t){return'<div class="wt-card"><div class="wt-top">'+t+'</div><div class="wt-main">'+g[t].certs.size+'</div><div class="wt-bot">'+g[t].subs.size+' Subs</div></div>';}).join("");
}

// ── TABLE ────────────────────────────────────────────────
function renderTable(data){
  var tb=document.getElementById("summaryTable");if(!tb) return;
  tb.innerHTML=data.map(function(x){return"<tr><td>"+x.company+"</td><td>"+x.subcontractor+"</td><td>"+x.work_type+"</td><td style='font-family:var(--mono)'>"+x.cert_count+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_work)+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_withdrawn)+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_deduction)+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_refund)+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_retention)+"</td><td style='font-family:var(--mono)'>"+fmt(x.total_advance)+"</td><td style='font-family:var(--mono);color:var(--green)'>"+fmt(x.total_net)+"</td></tr>";}).join("");
}

// ── REPORT SAFE DATA ─────────────────────────────────────
window.getReportSafeData=function(){
  return[...ORIGINAL_DATA].filter(function(x){
    return(!FILTER_STATE.company||(x.company_name||"").trim()===(FILTER_STATE.company||"").trim())&&
           (!FILTER_STATE.type||(x.work_type||"").trim()===(FILTER_STATE.type||"").trim())&&
           (!FILTER_STATE.subcontractor||(x.subcontractor_name||"").trim()===(FILTER_STATE.subcontractor||"").trim());
  });
};

// ── GLOBAL FILTER (from search modal) ───────────────────
window.applyGlobalFilter=function(filteredData){
  if(!filteredData||!filteredData.length){alert("No data found");return;}
  RAW_DATA=filteredData.map(function(x){return Object.assign({},x,{work_value:Number(x.work_value||0),net_payment:Number(x.net_payment||0),retention_amount:Number(x.retention_amount||0),deduction:Number(x.deduction||0),advance_deduction:Number(x.advance_deduction||0),refund:Number(x.refund||0)});});
  CURRENT_DATA=[];
  var first=filteredData[0];
  FILTER_STATE={company:first?.company_name||"",type:first?.work_type||"",subcontractor:first?.subcontractor_name||""};
  buildAggregation();initFilters();
  setSelVal("filterCompany",FILTER_STATE.company);setSelVal("filterType",FILTER_STATE.type);setSelVal("filterSub",FILTER_STATE.subcontractor);
  renderAll();
};
function setSelVal(id,val){var el=document.getElementById(id);if(el) el.value=val||"";}

window.resetDashboard=function(){
  RAW_DATA=ORIGINAL_DATA.map(function(x){return Object.assign({},x);});
  CURRENT_DATA=[];FILTER_STATE={company:"",type:"",subcontractor:""};
  buildAggregation();initFilters();renderAll();
  var lbl=document.getElementById("activeFilter");if(lbl){lbl.innerText="";lbl.classList.remove("show");}
};

// ── REPORT HTML ──────────────────────────────────────────
window.buildDashboardHTML=function(){
  var data=window.getReportSafeData();
  if(!data||!data.length) return"<h2>No data available</h2>";
  data.sort(function(a,b){return(a.project_name||"").localeCompare(b.project_name||"")||(a.contract_number||"").localeCompare(b.contract_number||"")||Number(a.certificate_no)-Number(b.certificate_no);});
  var groups={};
  data.forEach(function(p){var k=p.project_name+"__"+p.contract_number+"__"+p.subcontractor_id;if(!groups[k]) groups[k]=[];groups[k].push(p);});
  var html='<html><head><link href="https://fonts.googleapis.com/css2?family=Tajawal&display=swap" rel="stylesheet"><style>body{font-family:Tajawal,Arial;direction:rtl;text-align:right;padding:20px;font-size:13px;background:#f5f5f5}h1{text-align:center;color:#1f4e79;font-size:20px}h3{color:#c0392b;margin:5px 0}table{width:100%;border-collapse:collapse;margin-top:8px}th{background:#1f4e79;color:white;padding:4px 6px;font-size:11px}td,th{border:1px solid #ccc;padding:3px 5px;font-size:11px}.rb{page-break-inside:avoid;margin-bottom:16px;background:#fff;padding:12px;border-radius:6px}.tot{font-weight:bold;background:#eef0f8}.ft{margin-top:8px;font-size:10px;color:#888;border-top:1px solid #ddd;padding-top:4px}@page{size:A4;margin:8mm}</style></head><body>';
  Object.values(groups).forEach(function(records){
    var first=records[0];var tW=0,tN=0,tR=0,tD=0,tWd=0,tRf=0,tAV=0,tAd=0;
    records.forEach(function(p){tW+=+p.work_value||0;tN+=+p.net_payment||0;tR+=+p.retention_amount||0;tD+=+p.deduction||0;tWd+=+p.withdrawn||0;tRf+=+p.refund||0;tAV+=+p.after_vat||0;tAd+=+p.advance_deduction||0;});
    html+='<div class="rb"><h1>📊 تقرير الدفعات</h1><h3>المشروع: '+first.project_name+'</h3><div style="font-size:12px;line-height:1.7;margin-bottom:6px"><b>المقاول:</b> '+first.subcontractor_name+' &nbsp;|&nbsp; <b>نوع العمل:</b> '+first.work_type+'<br><b>الشركة:</b> '+(first.company_name||"-")+' &nbsp;|&nbsp; <b>العقد:</b> '+(first.contract_number||"-")+'<br><b>الهاتف:</b> '+(first.phone||"-")+' &nbsp;|&nbsp; <b>البريد:</b> '+(first.email||"-")+'<br><b>الرقم الضريبي:</b> '+(first.vat_number||"-")+' &nbsp;|&nbsp; <b>السجل التجاري:</b> '+(first.cr_number||"-")+'</div><table><tr><th>الشهادة</th><th>قيمة العمل</th><th>المسحوب</th><th>الخصم</th><th>الاسترجاع</th><th>بعد الضريبة</th><th>الاحتجاز</th><th>السلفة</th><th>الصافي</th></tr>';
    records.forEach(function(p){html+='<tr><td>'+p.certificate_no+'</td><td>'+(+p.work_value).toFixed(2)+'</td><td>'+((+p.withdrawn)||0).toFixed(2)+'</td><td>'+(+p.deduction).toFixed(2)+'</td><td>'+((+p.refund)||0).toFixed(2)+'</td><td>'+((+p.after_vat)||0).toFixed(2)+'</td><td>'+(+p.retention_amount).toFixed(2)+'</td><td>'+((+p.advance_deduction)||0).toFixed(2)+'</td><td>'+(+p.net_payment).toFixed(2)+'</td></tr>';});
    html+='<tr class="tot"><td>الإجمالي</td><td>'+tW.toFixed(2)+'</td><td>'+tWd.toFixed(2)+'</td><td>'+tD.toFixed(2)+'</td><td>'+tRf.toFixed(2)+'</td><td>'+tAV.toFixed(2)+'</td><td>'+tR.toFixed(2)+'</td><td>'+tAd.toFixed(2)+'</td><td>'+tN.toFixed(2)+'</td></tr></table><div class="ft">Prepared by: Eng. Tanveer Ahmad</div></div>';
  });
  html+='</body></html>';return html;
};

function openWin(print){var w=window.open("","_blank");w.document.open();w.document.write(window.buildDashboardHTML());w.document.close();if(print) setTimeout(function(){w.print();},500);}

window.generatePDFPreview=function(){openWin(false);};
window.printPDF=function(){openWin(true);};
window.downloadPDF=function(){openWin(true);};

window.downloadExcel=function(){
  var data=window.getReportSafeData();if(!data.length){alert("No data");return;}
  var headers=Object.keys(data[0]);
  var csv=[headers.join(",")];
  data.forEach(function(row){csv.push(headers.map(function(h){return'"'+((row[h]||"").toString().replace(/"/g,'""'))+'"';}).join(","));});
  var blob=new Blob(["\uFEFF"+csv.join("\n")],{type:"text/csv;charset=utf-8;"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="SPMS_Report.csv";a.click();
};

// ── LIVE UPDATE ──────────────────────────────────────────
window.updateDashboardLive=function(newPayment){
  RAW_DATA=[...RAW_DATA,Object.assign({},newPayment,{work_value:Number(newPayment.work_value||0),net_payment:Number(newPayment.net_payment||0),retention_amount:Number(newPayment.retention_amount||0),deduction:Number(newPayment.deduction||0),advance_deduction:Number(newPayment.advance_deduction||0),refund:Number(newPayment.refund||0)})];
  buildAggregation();renderAll();
};

window.loadDashboard=loadDashboard;
})();