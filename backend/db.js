require("dotenv").config(); // 🔥 load env variables

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// 🔥 connect DB
db.connect(err => {
  if (err) {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  }
  console.log("✅ MySQL Connected");
});

module.exports = db;