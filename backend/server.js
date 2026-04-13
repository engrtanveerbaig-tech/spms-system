const express = require("express");
const cors = require("cors");
const db = require("./db");

const subcontractorRoutes = require("./routes/subcontractorRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/subcontractors", subcontractorRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
    res.send("SPMS Backend Running 🚀");
});

// ✅ FIXED PORT
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});