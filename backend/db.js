const { Pool } = require("pg");

// 🧠 PostgreSQL Connection
const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:password@localhost:5432/krpost",
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

pool.on("connect", () => {
    // Optional: log connection events if needed
    // console.log("✅ DB Connected");
});

pool.on("error", (err) => {
    console.error("❌ PostgreSQL Pool Error:", err.message);
});

module.exports = { pool };
