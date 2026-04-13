const express = require("express");
const router = express.Router();
const db = require("../db");


// ===============================
// ➕ ADD PAYMENT (FINAL CLEAN)
// ===============================
router.post("/add", async (req, res) => {

    const conn = await db.promise().getConnection();

    try {

        await conn.beginTransaction();

        const {
            subcontractor_id,
            project_name,
            contract_number,
            work_type,
            work_value,
            work_withdrawn = 0,
            deduction = 0,
            refund = 0
        } = req.body;

        // 🔒 GET NEXT CERT (LOCKED)
        const [rows] = await conn.query(`
            SELECT COALESCE(MAX(certificate_no), 0) + 1 AS next_no
            FROM payment_certificates
            WHERE subcontractor_id = ?
            AND project_name = ?
            AND work_type = ?
        `, [subcontractor_id, project_name, work_type]);

        const certNo = rows[0].next_no;

        const work = Number(work_value) || 0;
        const withdrawn = Number(work_withdrawn) || 0;
        const ded = Number(deduction) || 0;
        const ref = Number(refund) || 0;

        // 🔥 GET SUBCONTRACTOR
        const [subResult] = await conn.query(
            "SELECT retention_percent, vat_percent, advance_remaining FROM subcontractors WHERE id=?",
            [subcontractor_id]
        );

        const sub = subResult[0] || {};
        
        if (!subResult.length) {
    await conn.rollback();
    return res.status(400).send("Subcontractor not found ❌");
}

        const retentionPercent = Number(sub.retention_percent) || 10;

        let vatPercent = Number(sub.vat_percent);
        if (isNaN(vatPercent)) vatPercent = 0;

        let advanceRemaining = Number(sub.advance_remaining) || 0;

        // ================= CALCULATIONS =================
        const after = work - withdrawn - ded + ref;

        let advance_deduction = 0;
        let vat = 0;
        let retention = 0;
        let net = 0;

        if (after > 0 && advanceRemaining > 0) {

            advance_deduction = after * 0.25;
            advance_deduction = Math.min(advance_deduction, advanceRemaining);

            const afterAdvance = after - advance_deduction;

            vat = afterAdvance * (vatPercent / 100);
            retention = after * (retentionPercent / 100);

            net = afterAdvance + vat - retention;

            advanceRemaining = Math.max(advanceRemaining - advance_deduction, 0);

        } else {

            vat = after * (vatPercent / 100);
            retention = after * (retentionPercent / 100);

            net = after + vat - retention;
        }

        // 🔍 DEBUG
console.log("SUBCONTRACTOR:", sub);
console.log("CERT NO:", certNo);
console.log("VALUES:", {
    subcontractor_id,
    project_name,
    work_type
});

console.log("INSERT VALUES:", {
    certNo,
    subcontractor_id,
    project_name,
    contract_number,
    work_type,
    work,
    withdrawn,
    ded,
    ref,
    after,
    vat,
    retention,
    advance_deduction,
    net
});

        // 🔥 INSERT
       const sql = `
INSERT INTO payment_certificates (
  certificate_no,
  subcontractor_id,
  project_id,
  project_name,
  contract_number,
  work_type,
  work_value,
  work_withdrawn,
  deduction,
  refund,
  after_deduction,
  vat_amount,
  retention_amount,
  advance_deduction,
  net_payment
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const values = [
  req.body.certificate_no,
  req.body.subcontractor_id,
  req.body.project_id || null,
  req.body.project_name,
  req.body.contract_number,
  req.body.work_type,
  req.body.work_value,
  req.body.work_withdrawn,
  req.body.deduction,
  req.body.refund,
  req.body.after_deduction,
  req.body.vat_amount,
  req.body.retention_amount,
  req.body.advance_deduction,
  req.body.net_payment
];
console.log("INSERT VALUES:", values);

        // 🔥 UPDATE ADVANCE
        await conn.query(
            "UPDATE subcontractors SET advance_remaining=? WHERE id=?",
            [advanceRemaining, subcontractor_id]
        );

        await conn.commit();

        res.send({
            message: "Saved ✅ Payment Certificate #" + certNo,
            advance_remaining: advanceRemaining,
            advance_deduction: advance_deduction
        });

    } catch (err) {

        await conn.rollback();

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).send("Duplicate certificate detected. Please try again.");
        }

        console.error("🔥 ERROR:", err);
        res.status(500).send(err.message);

    } finally {
        conn.release();
    }
});


// ===============================
// 📄 GET ALL PAYMENTS
// ===============================
router.get("/all", (req, res) => {

    const sql = `
        SELECT pc.*, 
       s.name AS subcontractor_name, 
       s.work_type,
       s.company_name,
       s.phone,
       s.email,
       s.vat_number,
       s.cr_number,
       s.retention_percent,
       s.initial_advance
        FROM payment_certificates pc
        JOIN subcontractors s ON pc.subcontractor_id = s.id
        ORDER BY 
        pc.project_name,
        pc.work_type,
        s.name,
        pc.certificate_no ASC
    `;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result);
    });
});


// ===============================
// ✏️ UPDATE PAYMENT
// ===============================
router.put("/update/:id", (req, res) => {

    const {
        subcontractor_id,
        work_value,
        work_withdrawn = 0,
        deduction = 0,
        refund = 0
    } = req.body;

    const work = Number(work_value) || 0;
    const withdrawn = Number(work_withdrawn) || 0;
    const ded = Number(deduction) || 0;
    const ref = Number(refund) || 0;

    db.query(
        "SELECT retention_percent, vat_percent, advance_remaining AS advance_remaining FROM subcontractors WHERE id=?",
        [subcontractor_id],
        (err, subResult) => {

            if (err) return res.status(500).send(err);

            const retentionPercent = Number(subResult[0].retention_percent) || 10;

            let vatPercent = Number(subResult[0].vat_percent);
            if (isNaN(vatPercent)) vatPercent = 0;

            const after = work - withdrawn - ded + ref;
            let advanceRemaining = Number(subResult[0].advance_remaining) || 0;

let advance_deduction = 0;
let vat = 0;
let retention = 0;
let net = 0;

if (after > 0 && advanceRemaining > 0) {

    advance_deduction = after * 0.25;
    const afterAdvance = after - advance_deduction;

    vat = afterAdvance * (vatPercent / 100);
    retention = after * (retentionPercent / 100);

    net = afterAdvance + vat - retention;

} else {

    vat = after * (vatPercent / 100);
    retention = after * (retentionPercent / 100);

    net = after + vat - retention;
}

            const sql = `
                UPDATE payment_certificates SET
                    work_value=?,
                    work_withdrawn=?,
                    deduction=?,
                    refund=?,
                    after_deduction=?,
                    vat_amount=?,
                    retention_amount=?,
                    net_payment=?
                WHERE id=?
            `;

            db.query(sql, [
                work,
                withdrawn,
                ded,
                ref,
                after,
                vat,
                retention,
                net,
                req.params.id
            ], (err2) => {

                if (err2) return res.status(500).send("Update failed");

                res.send("Updated successfully ✅");
            });
        }
    );
});


// ===============================
// 🗑️ DELETE
// ===============================
router.delete("/delete/:id", (req, res) => {

    db.query(
        "DELETE FROM payment_certificates WHERE id=?",
        [req.params.id],
        (err) => {
            if (err) return res.status(500).send("Delete failed");
            res.send("Deleted successfully 🗑️");
        }
    );
});


// ===============================
// 🔥 BULK DELETE
// ===============================
router.delete("/bulk-delete", (req, res) => {

    const {
        subcontractor_id,
        work_type,
        project_name,
        from_cert,
        to_cert
    } = req.body;

    const sql = `
        DELETE FROM payment_certificates
        WHERE subcontractor_id = ?
        AND work_type = ?
        AND project_name = ?
        AND certificate_no BETWEEN ? AND ?
    `;

    db.query(sql, [
        subcontractor_id,
        work_type,
        project_name,
        from_cert,
        to_cert
    ], (err, result) => {

        if (err) return res.status(500).send("Bulk delete failed");

        res.send(`Deleted ${result.affectedRows} records ✅`);
    });
});


// ===============================
// 📊 DASHBOARD
// ===============================
router.get("/dashboard", (req, res) => {

    const sql = `
    SELECT 
        COUNT(DISTINCT project_name) AS total_projects,
        COUNT(DISTINCT subcontractor_id) AS total_subcontractors,
        SUM(work_value) AS total_work,
        SUM(net_payment) AS total_paid,
        SUM(retention_amount) AS total_retention,
        SUM(advance_deduction) AS total_advance_used
    FROM payment_certificates
    `;

    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.json(result[0]);
    });

});


module.exports = router;