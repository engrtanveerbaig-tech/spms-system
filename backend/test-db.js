const mysql = require("mysql2/promise");

async function testDB() {
  try {
    const db = await mysql.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "",   // your root password (maybe empty)
      database: "railway",
      port: 3306
    });

    const [rows] = await db.query("SELECT 1");
    console.log("✅ ROOT WORKING:", rows);

  } catch (err) {
    console.error("❌ ROOT ERROR:", err);
  }
}

testDB();