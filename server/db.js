const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

if (process.env.DB_SSL === 'true') {
    config.ssl = {
        rejectUnauthorized: false // Often needed for hosted Postgres like Neon/Heroku
    };
}

const pool = new Pool(config);

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
