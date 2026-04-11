const express = require("express");
const router = express.Router();
const db = require("../db");

// ✅ GET ALL (ROOT)
router.get("/", (req, res) => {
  db.query("SELECT * FROM subcontractors", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ===============================
// ✅ ADD SUBCONTRACTOR
// ===============================
router.post("/add", (req, res) => {

  const {
    work_type,
    name,
    contract_no,
    company_name,
    phone,
    email,
    vat_number,
    vat_percent,
    cr_number,
    bank_details,
    project,
    retention_percent,
    advance_amount
  } = req.body;

  // ================= VALIDATION =================
  if (!work_type || !name || !contract_no) {
    return res.status(400).send("Required fields missing ❌");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailPattern.test(email)) {
    return res.status(400).send("Invalid email format ❌");
  }

  // ================= SAFE VALUES =================
  const safeVatPercent = Number(vat_percent) || 0;
  const safeRetention = Number(retention_percent) || 10;
  const safeAdvance = Number(advance_amount) || 0;

  // ================= INSERT =================
  const sql = `
    INSERT INTO subcontractors 
    (work_type, name, contract_no, company_name, phone, email, 
     vat_number, vat_percent, cr_number, bank_details, project, 
     retention_percent, advance_remaining, initial_advance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [
    work_type,
    name,
    contract_no,
    company_name,
    phone,
    email,
    vat_number,
    safeVatPercent,
    cr_number,
    bank_details || null,
    project,
    safeRetention,
    safeAdvance,
    safeAdvance
  ], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error ❌");
    }
    res.send("Subcontractor added successfully ✅");
  });
});


// ===============================
// ✅ GET ALL
// ===============================
router.get("/all", (req, res) => {
  db.query("SELECT * FROM subcontractors", (err, results) => {
    if (err) {
      console.error("❌ QUERY ERROR:", err);
      return res.status(500).json({
        error: err.message,
        code: err.code
      });
    }
    res.json(results);
  });
});


// ===============================
// ✅ GET ONE
// ===============================
router.get("/:id", (req, res) => {
  db.query(
    "SELECT * FROM subcontractors WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result[0]);
    }
  );
});


// ===============================
// ✅ UPDATE SUBCONTRACTOR
// ===============================
router.put("/update/:id", (req, res) => {

  const id = req.params.id;

  const {
    work_type,
    name,
    contract_no,
    company_name,
    phone,
    email,
    vat_number,
    vat_percent,
    cr_number,
    bank_details,
    project,
    retention_percent
  } = req.body;

  // ================= SAFE VALUES =================
  const safeVatPercent = Number(vat_percent) || 0;
  const safeRetention = Number(retention_percent) || 10;

  const sql = `
    UPDATE subcontractors SET
      work_type = ?,
      name = ?,
      contract_no = ?,
      company_name = ?,
      phone = ?,
      email = ?,
      vat_number = ?,
      vat_percent = ?,
      cr_number = ?,
      bank_details = ?,
      project = ?,
      retention_percent = ?
    WHERE id = ?
  `;

  const values = [
    work_type,
    name,
    contract_no,
    company_name,
    phone,
    email,
    vat_number,
    safeVatPercent,
    cr_number,
    bank_details || null,
    project,
    safeRetention,
    id
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Update failed ❌");
    }
    res.send("Updated successfully ✅");
  });
});


// ===============================
// ✅ ADD ADVANCE
// ===============================
router.put("/add-advance/:id", (req, res) => {

  const { advance_amount } = req.body;
  const amount = Number(advance_amount) || 0;

  const sql = `
    UPDATE subcontractors
    SET 
      advance_remaining = advance_remaining + ?,
      initial_advance = initial_advance + ?
    WHERE id=?
  `;

  db.query(sql, [amount, amount, req.params.id], (err) => {
    if (err) return res.status(500).send("Error ❌");
    res.send("Advance added ✅");
  });
});


// ===============================
// ✅ DELETE
// ===============================
router.delete("/delete/:id", (req, res) => {

  const id = req.params.id;

  db.query(
    "DELETE FROM payment_certificates WHERE subcontractor_id=?",
    [id],
    (err) => {

      if (err) return res.status(500).send("Error deleting payments ❌");

      db.query(
        "DELETE FROM subcontractors WHERE id=?",
        [id],
        (err2) => {

          if (err2) return res.status(500).send("Delete failed ❌");

          res.send("Deleted successfully 🗑️");
        }
      );
    }
  );
});


// ===============================
// 🔍 GET BY WORK TYPE
// ===============================
router.get("/by-type/:type", (req, res) => {

  db.query(
    "SELECT * FROM subcontractors WHERE work_type = ?",
    [req.params.type],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});


// ===============================
// 🔍 GET BY PROJECT
// ===============================
router.get("/by-project/:project", (req, res) => {

  db.query(
    "SELECT * FROM subcontractors WHERE project = ?",
    [req.params.project],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});


// ===============================
// 🔍 GET BY TYPE + PROJECT
// ===============================
router.get("/by-type-project", (req, res) => {

  const { work_type, project } = req.query;

  db.query(
    "SELECT * FROM subcontractors WHERE work_type = ? AND project = ?",
    [work_type, project],
    (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result);
    }
  );
});


// ===============================
module.exports = router;