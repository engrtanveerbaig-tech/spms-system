const express = require("express");
const router = express.Router();
const db = require("../db");


// ===============================
// ➕ ADD PAYMENT (FIXED FINAL)
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

        // ===============================
        // 🔒 GET NEXT CERT NUMBER
        // ===============================
        const [rows] = await conn.query(`
            SELECT COALESCE(MAX(certificate_no), 0) + 1 AS next_no
            FROM payment_certificates
            WHERE subcontractor_id = ?
            AND project_name = ?
            AND work_type = ?
        `, [subcontractor_id, project_name, work_type]);

        const certNo = rows[0].next_no;

        // ===============================
        // 🔢 SAFE NUMBERS
        // ===============================
        const work = Number(work_value) || 0;
        const withdrawn = Number(work_withdrawn) || 0;
        const ded = Number(deduction) || 0;
        const ref = Number(refund) || 0;

        // ===============================
        // 🔥 GET SUBCONTRACTOR DATA
        // ===============================
        const [subResult] = await conn.query(
            "SELECT retention_percent, vat_percent, advance_remaining FROM subcontractors WHERE id=?",
            [subcontractor_id]
        );

        if (!subResult.length) {
            await conn.rollback();
            return res.status(400).send("Subcontractor not found ❌");
        }

        const sub = subResult[0];

        const retentionPercent = Number(sub.retention_percent) || 10;
        const vatPercent = isNaN(Number(sub.vat_percent)) ? 0 : Number(sub.vat_percent);
        let advanceRemaining = Number(sub.advance_remaining) || 0;

        // ===============================
        // 🧮 CALCULATIONS
        // ===============================
        const after = work - withdrawn - ded + ref;

        let advance_deduction = 0;
        let vat = 0;
        let retention = 0;
        let net = 0;

        if (after > 0 && advanceRemaining > 0) {

            advance_deduction = Math.min(after * 0.25, advanceRemaining);

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

        // ===============================
        // 🔍 DEBUG LOG
        // ===============================
        console.log("FINAL INSERT DATA:", {
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

        // ===============================
        // 🔥 INSERT (FIXED)
        // ===============================
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
            String(certNo),                // ✅ FIXED
            subcontractor_id,
            1,                  // ✅ avoid FK issue (projects empty)
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
        ];

        await conn.query(sql, values);

        // ===============================
        // 🔄 UPDATE ADVANCE
        // ===============================
        await conn.query(
            "UPDATE subcontractors SET advance_remaining=? WHERE id=?",
            [advanceRemaining, subcontractor_id]
        );

        await conn.commit();

        res.send({
            message: "Saved ✅ Payment Certificate #" + certNo,
            advance_remaining: advanceRemaining,
            advance_deduction
        });

    } catch (err) {

        await conn.rollback();

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
        ORDER BY pc.project_name, pc.work_type, s.name, pc.certificate_no ASC
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
        "SELECT retention_percent, vat_percent FROM subcontractors WHERE id=?",
        [subcontractor_id],
        (err, subResult) => {

            if (err) return res.status(500).send(err);

            const retentionPercent = Number(subResult[0].retention_percent) || 10;
            const vatPercent = Number(subResult[0].vat_percent) || 0;

            const after = work - withdrawn - ded + ref;

            const vat = after * (vatPercent / 100);
            const retention = after * (retentionPercent / 100);
            const net = after + vat - retention;

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