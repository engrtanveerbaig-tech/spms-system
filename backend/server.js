const express = require("express");
const cors = require("cors");
const db = require("./db");
const puppeteer = require("puppeteer");

const subcontractorRoutes = require("./routes/subcontractorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const userRoutes = require("./routes/userRoutes");              // ← NEW

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
        const [rows] = await db.execute(
            "SELECT * FROM users WHERE username = ?",
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ message: "User not found" });
        }

        const user = rows[0];

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

// ================= PDF DOWNLOAD API =================
app.post("/api/download-pdf", async (req, res) => {
    try {
        const { html } = req.body;

        if (!html) {
            return res.status(400).json({ message: "No HTML provided" });
        }

        const browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-first-run",
                "--no-zygote",
                "--single-process"
            ]
        });

        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "networkidle0"
        });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "10mm",
                bottom: "10mm",
                left: "10mm",
                right: "10mm"
            }
        });

        await browser.close();

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=SPMS_Report.pdf"
        });

        res.send(pdfBuffer);

    } catch (err) {
        console.error("PDF ERROR:", err);
        res.status(500).json({ message: "PDF generation failed" });
    }
});

// ================= ROUTES =================

// 🔐 Protected APIs
app.use("/api/subcontractors", verifyToken, subcontractorRoutes);
app.use("/api/payments",       verifyToken, paymentRoutes);
app.use("/api/users",          verifyToken, userRoutes);        // ← NEW

// ================= ROOT =================
app.get("/", (req, res) => {
    res.send("SPMS Backend Running 🚀");
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});