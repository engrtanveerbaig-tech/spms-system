const express = require("express");
const router = express.Router();
const db = require("../db");

// ===============================
// GET ALL PROJECTS
// ===============================
router.get("/", async (req, res) => {
    try {

        const [rows] = await db.execute(`
            SELECT id, project_name
            FROM projects
            ORDER BY project_name
        `);

        res.json(rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Failed to load projects"
        });
    }
});

module.exports = router;