(function () {
    const API = "https://spms-backend-jxzn.onrender.com";
window.API = API;

let editId = null;
let fullData = [];
function initSubcontractorPage() {

    console.log("INIT subcontractor page");

    setTimeout(() => {

        const table = document.getElementById("table");

        if (!table) {
            console.error("❌ TABLE NOT FOUND - DOM not ready");
            return;
        }

        console.log("✅ TABLE FOUND → loading data");

        bindAdvanceToggle();   // ✅ ADD THIS LINE
        load();

    }, 200);
}

async function load() {

    console.log("STEP 2 → Loading API...");

    const res = await fetch(`${API}/api/subcontractors/all`);

    const data = await res.json();

    console.log("STEP 2 → DATA RECEIVED:", data);

    fullData = data;

    populateFilters(fullData);
    render(fullData);
}

// RENDER
function render(data) {

    const table = document.getElementById("table");

    if (!table) {
        console.error("❌ TABLE NOT FOUND in render()");
        return;
    }

    table.innerHTML = "";

    if (!data || data.length === 0) {
        table.innerHTML = `<tr><td colspan="11">No Data Found</td></tr>`;
        return;
    }

    data.forEach(x => {
        table.innerHTML += `
        <tr>
        <td>${x.project || ""}</td>
        <td>${x.work_type || ""}</td>
        <td>${x.name || ""}</td>
        <td>${x.contract_no || ""}</td>
        <td>${x.company_name || ""}</td>
        <td>${x.phone || ""}</td>
        <td>${x.email || ""}</td>
        <td>${x.vat_number || 0}</td>
        <td>${x.cr_number || ""}</td>
        <td>${x.advance_remaining || 0}</td>
        <td>
        <button onclick="edit(${x.id})">Edit</button>
        <button onclick="del(${x.id})">Delete</button>
        </td>
        </tr>`;
    });
}

// FILTER DROPDOWNS
function populateFilters(data) {
    const fields = [
        {id: "f_name", key: "name"},
        {id: "f_contract", key: "contract_no"},
        {id: "f_company", key: "company_name"},
        {id: "f_phone", key: "phone"},
        {id: "f_email", key: "email"},
        {id: "f_vat", key: "vat_number"},
        {id: "f_cr", key: "cr_number"},
        {id: "f_iban", key: "advance_remaining"}
    ];

    fields.forEach(f => {
    const select = document.getElementById(f.id);

    if (!select) return;   // ✅ ADD THIS LINE

    select.innerHTML = '<option value="">All</option>';

        const values = [...new Set(data.map(x => x[f.key]).filter(v => v !== null && v !== ""))];

        values.forEach(v => {
            select.innerHTML += `<option value="${v}">${v}</option>`;
        });
    });
}

// SAVE / UPDATE
async function save() {

    const emailInput = document.getElementById("email");
    const emailError = document.getElementById("email_error");

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailInput.value && !emailPattern.test(emailInput.value)) {
        emailError.style.display = "block";
        return;
    } else {
        emailError.style.display = "none";
    }

    const hasAdvance = document.getElementById("has_advance").checked;
    const advanceValue = document.getElementById("advance_amount").value;

    if (hasAdvance && (!advanceValue || isNaN(advanceValue) || advanceValue <= 0)) {
        alert("Enter valid advance amount");
        return;
    }

    const data = {
        project: document.getElementById("project").value,
        work_type: document.getElementById("work_type").value,
        name: document.getElementById("subcontractor_name").value,
        contract_no: document.getElementById("contract_no").value,
        company_name: document.getElementById("company").value,
        phone: document.getElementById("phone").value,
        email: emailInput.value.toLowerCase(),
        vat_number: document.getElementById("vat_number").value,
        vat_percent: Number(document.getElementById("vat_percent").value) || 0,
        cr_number: document.getElementById("cr").value,
        bank_details: null,
        retention_percent: Number(document.getElementById("retention_percent").value) || 10,
        // 🔥 ONLY used for ADD (not update)
        advance_amount: hasAdvance ? advanceValue : 0,
        has_advance: hasAdvance ? 1 : 0
    };

    let url = `${API}/api/subcontractors/add`;
    let method = "POST";

    // 🚨 IMPORTANT: DO NOT SEND advance on edit
    if (editId) {
        url = `${API}/api/subcontractors/update/${editId}`;
        method = "PUT";

        delete data.advance_amount;
        delete data.has_advance;
    }

    const res = await fetch(url, {
        method,
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    document.getElementById("msg").innerText = await res.text();

    // RESET
    editId = null;
    document.querySelectorAll("input").forEach(i => i.value = "");
    document.getElementById("has_advance").checked = false;
    document.getElementById("advance_amount").style.display = "none";
    document.getElementById("mainBtn").innerText = "Add";

    load();
}

// EDIT
async function edit(id) {

    const res = await fetch(`${API}/api/subcontractors/${id}`);
    const d = await res.json();

    editId = id;

    document.getElementById("project").value = d.project;
    document.getElementById("work_type").value = d.work_type;
    document.getElementById("subcontractor_name").value = d.name;
    document.getElementById("contract_no").value = d.contract_no;
    document.getElementById("company").value = d.company_name;
    document.getElementById("phone").value = d.phone;
    document.getElementById("email").value = d.email;
    document.getElementById("vat_number").value = d.vat_number || "";
document.getElementById("vat_percent").value = d.vat_percent || 0;
    document.getElementById("cr").value = d.cr_number;
    document.getElementById("retention_percent").value = d.retention_percent || 10;

    // ADVANCE VIEW ONLY (not editable here)
    document.getElementById("has_advance").checked = d.has_advance ? true : false;
    document.getElementById("advance_amount").style.display = "none";

    document.getElementById("mainBtn").innerText = "Update";
}

// DELETE
async function del(id) {
    if (!confirm("Delete?")) return;

    await fetch(`${API}/api/subcontractors/delete/${id}`, {
        method: "DELETE"
    });

    load();
}

// FILTER
function filterTable() {

    const project = document.getElementById("f_project").value;
    const wt = document.getElementById("f_work").value;
    const name = document.getElementById("f_name").value;
    const contract = document.getElementById("f_contract").value;
    const company = document.getElementById("f_company").value;
    const phone = document.getElementById("f_phone").value;
    const email = document.getElementById("f_email").value;
    const vat = document.getElementById("f_vat").value;
    const cr = document.getElementById("f_cr").value;
    const advance = document.getElementById("f_iban").value;

    const filtered = fullData.filter(x =>
        (!project || x.project === project) &&
        (!wt || x.work_type === wt) &&
        (!name || x.name === name) &&
        (!contract || x.contract_no === contract) &&
        (!company || x.company_name === company) &&
        (!phone || x.phone === phone) &&
        (!email || x.email === email) &&
(!vat || Number(x.vat_number) === Number(vat)) &&
(!cr || x.cr_number === cr) &&
        (!advance || x.advance_remaining == advance)
    );

    render(filtered);
}

// EMAIL VALIDATION LIVE
document.getElementById("email").addEventListener("input", function () {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const error = document.getElementById("email_error");

    if (this.value && !pattern.test(this.value)) {
        error.style.display = "block";
    } else {
        error.style.display = "none";
    }
});

function bindAdvanceToggle() {

    const checkbox = document.getElementById("has_advance");
    const advanceInput = document.getElementById("advance_amount");

    if (!checkbox || !advanceInput) return;

    // default hidden
    advanceInput.style.display = "none";

    checkbox.addEventListener("change", function () {
        advanceInput.style.display = this.checked ? "block" : "none";
    });
}
window.initSubcontractorPage = initSubcontractorPage;


// ================= GLOBAL FIX =================
window.save = save;
window.filterTable = filterTable;
window.edit = edit;
window.del = del;
})();
