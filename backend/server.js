const express = require("express");
const cors = require("cors");
const db = require("./db");

const subcontractorRoutes = require("./routes/subcontractorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= AUTH SYSTEM =================

// 🔐 Generate simple token
function generateToken(user) {
    return "SPMS_" + user.id + "_" + Date.now();
}

// 🔐 Verify token middleware
function verifyToken(req, res, next) {

    let token = req.headers["authorization"];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    // ✅ REMOVE "Bearer "
    if (token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
    }

    if (!token.startsWith("SPMS_")) {
        return res.status(403).json({ message: "Invalid token" });
    }

    next();
}

// ================= LOGIN API =================
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // 🔥 IMPORTANT: only check username
        const [rows] = await db.execute(
            "SELECT * FROM users WHERE username = ?",
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        const user = rows[0];

        // ⚠️ plain comparison (works with your current DB)
        if (user.password !== password) {
            return res.status(401).json({ message: "Wrong password" });
        }

        const token = generateToken(user);

        res.json({
            message: "Login success",
            token,
            role: user.role,
            username: user.username
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= ROUTES =================

// 🔐 Protected APIs
app.use("/api/subcontractors", verifyToken, subcontractorRoutes);
app.use("/api/payments", verifyToken, paymentRoutes);

// ================= ROOT =================
app.get("/", (req, res) => {
    res.send("SPMS Backend Running 🚀");
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});