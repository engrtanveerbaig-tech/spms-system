const express = require("express");
const cors = require("cors");
const db = require("./db");

const subcontractorRoutes = require("./routes/subcontractorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();   // ✅ FIRST create app

app.use(cors());
app.use(express.json());

// ✅ THEN use routes
app.use("/api/subcontractors", subcontractorRoutes);
app.use("/api/payments", paymentRoutes);

// TEST
app.get("/", (req, res) => {
    res.send("SMS Backend Running 🚀");
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});