require("dotenv").config();

const mysql = require("mysql2/promise");

// ✅ Use pool (stable for Render)
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  ssl: {
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10,
});

// ✅ Test connection (but DO NOT crash server)
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ MySQL Connected");
    conn.release();
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
    // ❌ DO NOT exit
  }
})();

module.exports = db;