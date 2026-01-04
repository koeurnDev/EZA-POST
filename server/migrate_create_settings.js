const db = require('./db');

const createSettingsTable = async () => {
    try {
        console.log('Creating settings table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(50) PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Settings table created.');

        // Insert default maintenance mode if not exists
        await db.query(`
            INSERT INTO settings (key, value) 
            VALUES ('maintenance_mode', 'false')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log('Default maintenance_mode set to false.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating settings table:', err);
        process.exit(1);
    }
};

createSettingsTable();
