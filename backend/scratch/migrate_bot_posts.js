require("dotenv").config({ path: ".env" });
const { Client } = require("pg");

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("✅ Connected to DB");

        // Create bot_monitored_posts table
        await client.query(`
            CREATE TABLE IF NOT EXISTS "bot_monitored_posts" (
                "id" TEXT NOT NULL,
                "user_id" TEXT NOT NULL,
                "page_id" TEXT NOT NULL,
                "facebook_post_id" TEXT NOT NULL,
                "enabled" BOOLEAN NOT NULL DEFAULT true,
                "last_checked" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL,

                CONSTRAINT "bot_monitored_posts_pkey" PRIMARY KEY ("id")
            );
        `);
        console.log("✅ Created bot_monitored_posts table");

        // Add index/unique
        await client.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "bot_monitored_posts_user_id_facebook_post_id_key" ON "bot_monitored_posts"("user_id", "facebook_post_id");
        `);
        console.log("✅ Created unique index");

        // Add foreign key
        await client.query(`
            ALTER TABLE "bot_monitored_posts" ADD CONSTRAINT "bot_monitored_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        `);
        console.log("✅ Added foreign key");

    } catch (err) {
        console.error("❌ Migration failed:", err.message);
    } finally {
        await client.end();
    }
}

run();
