const express = require("express");
const router = express.Router();
const db = require("../db");


// ===============================
// ➕ ADD PAYMENT
// ===============================
router.post("/add", async (req, res) => {
    const conn = await db.getConnection();

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
            refund = 0,
            certificate_no,
            cert_date,
            status = "Approved",
            comment = ""
        } = req.body;

        const certNo    = Number(certificate_no);
        const work      = Number(work_value)      || 0;
        const withdrawn = Number(work_withdrawn)  || 0;
        const ded       = Number(deduction)        || 0;
        const ref       = Number(refund)           || 0;

        const result = await conn.query(
            "SELECT retention_percent, vat_percent, advance_remaining FROM subcontractors WHERE id=?",
            [subcontractor_id]
        );
        const subResult = result[0];

        if (!subResult.length) {
            await conn.rollback();
            return res.status(400).send("Subcontractor not found ❌");
        }

        const sub = subResult[0];

        const retentionPercent = Number(sub.retention_percent) || 10;
        const vatPercent       = Number(sub.vat_percent)       || 0;
        let   advanceRemaining = Number(sub.advance_remaining) || 0;

        const after = work - withdrawn - ded + ref;

        let advance_deduction = 0;
        let vat       = 0;
        let retention = 0;
        let net       = 0;

        if (after > 0 && advanceRemaining > 0) {
            advance_deduction  = Math.min(after * 0.25, advanceRemaining);
            const afterAdvance = after - advance_deduction;
            vat       = afterAdvance * (vatPercent       / 100);
            retention = after        * (retentionPercent / 100);
            net       = afterAdvance + vat - retention;
            advanceRemaining = Math.max(advanceRemaining - advance_deduction, 0);
        } else {
            vat       = after * (vatPercent       / 100);
            retention = after * (retentionPercent / 100);
            net       = after + vat - retention;
        }

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
                net_payment,
                cert_date,
                status,
                comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await conn.query(sql, [
            certNo,
            subcontractor_id,
            1,
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
            net,
            cert_date || null,
            status,
            comment
        ]);

        await conn.query(
            "UPDATE subcontractors SET advance_remaining=? WHERE id=?",
            [advanceRemaining, subcontractor_id]
        );

        await conn.commit();

        res.json({
            message:          "Saved ✅ Certificate #" + certNo,
            advance_remaining: advanceRemaining
        });

    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        conn.release();
    }
});


// ===============================
// 📄 GET ALL PAYMENTS (paginated)
// ===============================
router.get("/all", async (req, res) => {
    try {
        const page   = parseInt(req.query.page) || 1;
        const limit  = 50;
        const offset = (page - 1) * limit;

        const [rows] = await db.query(`
            SELECT 
                p.id,
                p.certificate_no,
                p.project_name,
                p.work_type,
                p.net_payment,
                p.cert_date,
                p.status,
                p.comment,
                s.name         AS subcontractor_name,
                s.company_name
            FROM payment_certificates p
            LEFT JOIN subcontractors s ON p.subcontractor_id = s.id
            ORDER BY p.id DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json(rows);

    } catch (err) {
        console.error("❌ ERROR:", err);
        res.status(500).json({ error: "Database error" });
    }
});


// ===============================
// 📄 GET ALL FULL DATA (no limit)
// ===============================
router.get("/all-full", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.*,
                s.name         AS subcontractor_name,
                s.company_name
            FROM payment_certificates p
            LEFT JOIN subcontractors s ON p.subcontractor_id = s.id
            ORDER BY p.subcontractor_id, p.work_type, p.certificate_no
        `);

        res.json(rows);

    } catch (err) {
        console.error("❌ all-full error:", err);
        res.status(500).json({ error: "Database error" });
    }
});


// ===============================
// ✏️ UPDATE PAYMENT
// ===============================
router.put("/update/:id", async (req, res) => {
    try {
        const {
            subcontractor_id,
            work_value,
            work_withdrawn = 0,
            deduction      = 0,
            refund         = 0,
            cert_date,
            status  = "Approved",
            comment = ""
        } = req.body;

        const work      = Number(work_value)     || 0;
        const withdrawn = Number(work_withdrawn) || 0;
        const ded       = Number(deduction)       || 0;
        const ref       = Number(refund)          || 0;

        const [sub] = await db.query(
            "SELECT retention_percent, vat_percent FROM subcontractors WHERE id=?",
            [subcontractor_id]
        );

        if (!sub.length) return res.status(400).send("Subcontractor not found ❌");

        const retentionPercent = Number(sub[0].retention_percent) || 10;
        const vatPercent       = Number(sub[0].vat_percent)       || 0;

        const after     = work - withdrawn - ded + ref;
        const vat       = after * (vatPercent       / 100);
        const retention = after * (retentionPercent / 100);
        const net       = after + vat - retention;

        await db.query(`
            UPDATE payment_certificates SET
                work_value       = ?,
                work_withdrawn   = ?,
                deduction        = ?,
                refund           = ?,
                after_deduction  = ?,
                vat_amount       = ?,
                retention_amount = ?,
                net_payment      = ?,
                cert_date        = ?,
                status           = ?,
                comment          = ?
            WHERE id = ?
        `, [work, withdrawn, ded, ref, after, vat, retention, net,
            cert_date || null, status, comment,
            req.params.id]);

        res.send("Updated ✅");

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


// ===============================
// ✏️ UPDATE CERT STATUS ONLY
// ===============================
router.patch("/:id/status", async (req, res) => {
    try {
        const { cert_status } = req.body;
        const validStatuses = ["Approved", "Under Review", "On Site", "Pending", "Rejected"];

        if (!validStatuses.includes(cert_status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const [result] = await db.query(
            "UPDATE payment_certificates SET status=? WHERE id=?",
            [cert_status, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Certificate not found" });
        }

        res.json({ message: "Status updated ✅", id: req.params.id, status: cert_status });

    } catch (err) {
        console.error("Status update error:", err);
        res.status(500).json({ message: err.message });
    }
});


// ===============================
// 🗑️ DELETE SINGLE
// ===============================
router.delete("/delete/:id", async (req, res) => {
    try {
        await db.query(
            "DELETE FROM payment_certificates WHERE id=?",
            [req.params.id]
        );
        res.send("Deleted ✅");
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


// ===============================
// 🔥 BULK DELETE
// ===============================
router.delete("/bulk-delete", async (req, res) => {
    try {
        const {
            subcontractor_id,
            work_type,
            project_name,
            from_cert,
            to_cert
        } = req.body;

        if (!subcontractor_id || !work_type || !project_name || !from_cert || !to_cert) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const [result] = await db.query(`
            DELETE FROM payment_certificates
            WHERE subcontractor_id = ?
              AND work_type        = ?
              AND project_name     = ?
              AND certificate_no BETWEEN ? AND ?
        `, [subcontractor_id, work_type, project_name, from_cert, to_cert]);

        res.send(`Deleted ${result.affectedRows} records ✅`);

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


// ===============================
// 📊 DASHBOARD SUMMARY
// ===============================
router.get("/dashboard", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                COUNT(*)               AS total_records,
                SUM(net_payment)       AS total_net,
                SUM(retention_amount)  AS total_retention,
                SUM(deduction)         AS total_deductions
            FROM payment_certificates
        `);

        res.json(rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


module.exports = router;