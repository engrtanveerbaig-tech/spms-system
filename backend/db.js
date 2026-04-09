const mysql = require("mysql2");

// Create connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "mr@TanVeer1998", // 🔥 your password here
    database: "subcontractor_system"
});

// Connect
db.connect((err) => {
    if (err) {
        console.error("❌ DB Connection Failed:", err);
        return;
    }
    console.log("✅ MySQL Connected Successfully");
});

module.exports = db;