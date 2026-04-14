const express = require("express");
const router = express.Router();
const db = require("../db");

// ===============================
// ✅ GET ALL (ROOT)
// ===============================
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM subcontractors");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===============================
// ✅ ADD SUBCONTRACTOR
// ===============================
router.post("/add", async (req, res) => {
  try {
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

    const sql = `
      INSERT INTO subcontractors 
      (work_type, name, contract_no, company_name, phone, email, 
       vat_number, vat_percent, cr_number, bank_details, project, 
       retention_percent, advance_remaining, initial_advance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
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
    ]);

    res.send("Subcontractor added successfully ✅");

  } catch (err) {
    console.error(err);
    res.status(500).send("Database error ❌");
  }
});


// ===============================
// ✅ GET ALL
// ===============================
router.get("/all", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM subcontractors");
    res.json(rows);
  } catch (err) {
    console.error("❌ QUERY ERROR:", err);
    res.status(500).json({
      error: err.message,
      code: err.code
    });
  }
});


// ===============================
// ✅ GET ONE
// ===============================
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subcontractors WHERE id=?",
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).send(err);
  }
});


// ===============================
// ✅ UPDATE SUBCONTRACTOR
// ===============================
router.put("/update/:id", async (req, res) => {
  try {
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

    await db.query(sql, [
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
    ]);

    res.send("Updated successfully ✅");

  } catch (err) {
    console.error(err);
    res.status(500).send("Update failed ❌");
  }
});


// ===============================
// ✅ ADD ADVANCE
// ===============================
router.put("/add-advance/:id", async (req, res) => {
  try {
    const { advance_amount } = req.body;
    const amount = Number(advance_amount) || 0;

    const sql = `
      UPDATE subcontractors
      SET 
        advance_remaining = advance_remaining + ?,
        initial_advance = initial_advance + ?
      WHERE id=?
    `;

    await db.query(sql, [amount, amount, req.params.id]);

    res.send("Advance added ✅");

  } catch (err) {
    res.status(500).send("Error ❌");
  }
});


// ===============================
// ✅ DELETE
// ===============================
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;

    await db.query(
      "DELETE FROM payment_certificates WHERE subcontractor_id=?",
      [id]
    );

    await db.query(
      "DELETE FROM subcontractors WHERE id=?",
      [id]
    );

    res.send("Deleted successfully 🗑️");

  } catch (err) {
    res.status(500).send("Delete failed ❌");
  }
});


// ===============================
// 🔍 GET BY WORK TYPE
// ===============================
router.get("/by-type/:type", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subcontractors WHERE work_type = ?",
      [req.params.type]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err);
  }
});


// ===============================
// 🔍 GET BY PROJECT
// ===============================
router.get("/by-project/:project", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM subcontractors WHERE project = ?",
      [req.params.project]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).send(err);
  }
});


// ===============================
// 🔍 GET BY TYPE + PROJECT
// ===============================
router.get("/by-type-project", async (req, res) => {
  try {
    const { work_type, project } = req.query;

    const [rows] = await db.query(
      "SELECT * FROM subcontractors WHERE work_type = ? AND project = ?",
      [work_type, project]
    );

    res.json(rows);

  } catch (err) {
    res.status(500).send(err);
  }
});


// ===============================
module.exports = router;