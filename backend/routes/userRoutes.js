/* ============================================================
   SPMS — Users & Roles API
   File: backend/routes/userRoutes.js

   Matches your existing server.js exactly:
   ✓ Simple SPMS_ token (no JWT / no bcrypt)
   ✓ Plain password storage (same as login)
   ✓ db.execute() — same as subcontractorRoutes / paymentRoutes
   ✓ Same verifyToken logic
   ============================================================ */

const express = require("express");
const router  = express.Router();
const db      = require("../db");

/* ── VALID ROLES ─────────────────────────────────────────── */
const VALID_ROLES = ["admin", "manager", "finance", "engineer", "viewer","contract_department"];

/* ── EXTRACT USER ID FROM TOKEN ──────────────────────────── */
// Token format: "SPMS_{userId}_{timestamp}"
function getUserIdFromToken(req) {
    const header = req.headers["authorization"] || "";
    const token  = header.startsWith("Bearer ") ? header.split(" ")[1] : header;
    if (!token || !token.startsWith("SPMS_")) return null;
    const parts = token.split("_");
    return parts[1] ? parseInt(parts[1]) : null;
}

/* ── GET CURRENT USER'S ROLE FROM DB ─────────────────────── */
async function getCurrentUser(req) {
    const userId = getUserIdFromToken(req);
    if (!userId) return null;
    const [rows] = await db.execute(
        "SELECT id, username, role FROM users WHERE id = ?",
        [userId]
    );
    return rows[0] || null;
}

/* ============================================================
   GET /api/users
   Returns all users.
   Admin  → full details (id, name, username, email, phone,
             role, notes, active, last_active, created_at)
   Others → basic view (id, name, username, role, active)
   ============================================================ */
router.get("/", async (req, res) => {
    try {
        const me = await getCurrentUser(req);
        if (!me) return res.status(401).json({ message: "Unauthorized" });

        let rows;

        if (me.role === "admin") {
            [rows] = await db.execute(`
                SELECT
                    id, name, username, email, phone,
                    role, notes, active, last_active, created_at
                FROM users
                ORDER BY
                    CASE role
                        CASE role
  WHEN 'admin'                THEN 1
  WHEN 'manager'              THEN 2
  WHEN 'finance'              THEN 3
  WHEN 'engineer'             THEN 4
  WHEN 'contract_department'  THEN 5
  ELSE 6
END
                    END,
                    name ASC
            `);
        } else {
            [rows] = await db.execute(`
                SELECT id, name, username, role, active
                FROM users
                ORDER BY name ASC
            `);
        }

        res.json(rows);

    } catch (err) {
        console.error("GET /api/users error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ============================================================
   GET /api/users/:id
   Single user. Admin sees all fields, user sees own record.
   ============================================================ */
router.get("/:id", async (req, res) => {
    try {
        const me = await getCurrentUser(req);
        if (!me) return res.status(401).json({ message: "Unauthorized" });

        const targetId = parseInt(req.params.id);

        // Only admin or the user themselves
        if (me.role !== "admin" && me.id !== targetId) {
            return res.status(403).json({ message: "Access denied" });
        }

        const [rows] = await db.execute(
            `SELECT id, name, username, email, phone,
                    role, notes, active, last_active, created_at
             FROM users WHERE id = ?`,
            [targetId]
        );

        if (!rows.length) return res.status(404).json({ message: "User not found" });
        res.json(rows[0]);

    } catch (err) {
        console.error("GET /api/users/:id error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ============================================================
   POST /api/users
   Create a new user — admin only.
   Body: { name, username, email, password, role,
           phone?(opt), notes?(opt) }
   ============================================================ */
router.post("/", async (req, res) => {
    try {
        const me = await getCurrentUser(req);
        if (!me)             return res.status(401).json({ message: "Unauthorized" });
        if (me.role !== "admin") return res.status(403).json({ message: "Admin access required" });

        const { name, username, email, password, role, phone, notes } = req.body;

        /* ── Validation ── */
        if (!name     || !name.trim())      return res.status(400).json({ message: "Name is required" });
        if (!username || !username.trim())  return res.status(400).json({ message: "Username is required" });
        if (!email    || !email.includes("@")) return res.status(400).json({ message: "Valid email is required" });
        if (!password || password.length < 8)  return res.status(400).json({ message: "Password must be at least 8 characters" });
        if (!role || !VALID_ROLES.includes(role)) return res.status(400).json({ message: "Invalid role. Must be: " + VALID_ROLES.join(", ") });

        /* ── Check username/email unique ── */
        const [existing] = await db.execute(
            "SELECT id FROM users WHERE username = ? OR email = ?",
            [username.trim(), email.trim()]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: "Username or email already exists" });
        }

        /* ── Insert ── */
        // Storing plain password to match your existing login system
        const [result] = await db.execute(
            `INSERT INTO users
                (name, username, email, password, role, phone, notes, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [
                name.trim(),
                username.trim().toLowerCase(),
                email.trim().toLowerCase(),
                password,               // plain text — matches your existing login
                role,
                phone  || null,
                notes  || null
            ]
        );

        /* ── Return the created user (no password) ── */
        const [newUser] = await db.execute(
            `SELECT id, name, username, email, phone,
                    role, notes, active, created_at
             FROM users WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json(newUser[0]);

    } catch (err) {
        console.error("POST /api/users error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ============================================================
   PATCH /api/users/:id
   Update user details or role — admin only (or user updating
   their own name/email/phone/password).
   Body: any subset of { name, username, email, password,
                         role, phone, notes, active }
   ============================================================ */
router.patch("/:id", async (req, res) => {
    try {
        const me = await getCurrentUser(req);
        if (!me) return res.status(401).json({ message: "Unauthorized" });

        const targetId = parseInt(req.params.id);
        const isSelf   = me.id === targetId;
        const isAdmin  = me.role === "admin";

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: "Access denied" });
        }

        const { name, username, email, password, role, phone, notes, active } = req.body;

        /* Non-admins cannot change their own role or active status */
        if (!isAdmin && (role !== undefined || active !== undefined)) {
            return res.status(403).json({ message: "Only admins can change role or active status" });
        }

        if (role !== undefined && !VALID_ROLES.includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        /* Build dynamic SET clause — only update provided fields */
        const fields = [];
        const values = [];

        if (name     !== undefined) { fields.push("name = ?");     values.push(name.trim()); }
        if (username !== undefined) { fields.push("username = ?"); values.push(username.trim().toLowerCase()); }
        if (email    !== undefined) { fields.push("email = ?");    values.push(email.trim().toLowerCase()); }
        if (password !== undefined && password.length >= 8) {
            fields.push("password = ?");
            values.push(password);      // plain text — matches login
        }
        if (role     !== undefined && isAdmin) { fields.push("role = ?");   values.push(role); }
        if (phone    !== undefined) { fields.push("phone = ?");    values.push(phone || null); }
        if (notes    !== undefined) { fields.push("notes = ?");    values.push(notes || null); }
        if (active   !== undefined && isAdmin) { fields.push("active = ?"); values.push(active ? 1 : 0); }

        if (!fields.length) {
            return res.status(400).json({ message: "No fields to update" });
        }

        /* Check username/email unique (exclude self) */
        if (username !== undefined || email !== undefined) {
            const [dup] = await db.execute(
                "SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?",
                [
                    username || "",
                    email    || "",
                    targetId
                ]
            );
            if (dup.length > 0) {
                return res.status(409).json({ message: "Username or email already in use" });
            }
        }

        values.push(targetId);
        await db.execute(
            `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
            values
        );

        /* Return updated user */
        const [updated] = await db.execute(
            `SELECT id, name, username, email, phone,
                    role, notes, active, last_active, created_at
             FROM users WHERE id = ?`,
            [targetId]
        );

        if (!updated.length) return res.status(404).json({ message: "User not found" });
        res.json(updated[0]);

    } catch (err) {
        console.error("PATCH /api/users/:id error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ============================================================
   DELETE /api/users/:id
   Remove a user — admin only. Cannot delete yourself.
   ============================================================ */
router.delete("/:id", async (req, res) => {
    try {
        const me = await getCurrentUser(req);
        if (!me)             return res.status(401).json({ message: "Unauthorized" });
        if (me.role !== "admin") return res.status(403).json({ message: "Admin access required" });

        const targetId = parseInt(req.params.id);

        if (me.id === targetId) {
            return res.status(400).json({ message: "You cannot delete your own account" });
        }

        const [check] = await db.execute("SELECT id, name FROM users WHERE id = ?", [targetId]);
        if (!check.length) return res.status(404).json({ message: "User not found" });

        await db.execute("DELETE FROM users WHERE id = ?", [targetId]);

        res.json({ message: "User deleted", id: targetId, name: check[0].name });

    } catch (err) {
        console.error("DELETE /api/users/:id error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;