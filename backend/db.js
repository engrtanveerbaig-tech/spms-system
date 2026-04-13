require("dotenv").config();
const mysql = require("mysql2/promise");

let db;

if (process.env.DATABASE_URL) {
  // ✅ PRODUCTION (Railway / Render)
  const url = new URL(process.env.DATABASE_URL);

  db = mysql.createPool({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.replace("/", ""),
    port: url.port,
    ssl: {
      rejectUnauthorized: false
    }
  });

} else {
  // ✅ LOCAL
  db = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "spms_db",
    port: 3306
  });
}

module.exports = db;