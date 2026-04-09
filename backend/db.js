const mysql = require("mysql2");

// Parse Railway URL
const url = new URL(process.env.MYSQL_PUBLIC_URL);

const db = mysql.createConnection({
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.replace("/", ""),
  port: url.port,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err);
    return;
  }
  console.log("✅ Connected to Railway MySQL");
});

module.exports = db;