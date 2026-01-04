const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const db = require('../db');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function uploadImage(filePath) {
    try {
        console.log(`Uploading ${path.basename(filePath)}...`);
        const result = await cloudinary.uploader.upload(filePath, {
            folder: "girly-shop",
            use_filename: true,
            unique_filename: false
        });
        return result.secure_url;
    } catch (err) {
        console.error(`Failed to upload ${filePath}:`, err.message);
        return null;
    }
}

async function migrate() {
    console.log('--- Starting Cloudinary Migration ---');

    // 1. Get List of Files in uploads
    if (!fs.existsSync(UPLOADS_DIR)) {
        console.log('No uploads directory found.');
        return;
    }

    const files = fs.readdirSync(UPLOADS_DIR);
    console.log(`Found ${files.length} files in uploads directory.`);

    for (const file of files) {
        // Skip hidden files or non-images if necessary
        if (file.startsWith('.')) continue;

        const localPath = path.join(UPLOADS_DIR, file);
        const cloudUrl = await uploadImage(localPath);

        if (cloudUrl) {
            console.log(`✅ Uploaded: ${file} -> ${cloudUrl}`);

            // 🎯 2. Update DB Records - Precise Matching Strategy
            // We assume local file paths in DB might look like "/uploads/myimage.jpg" or just "myimage.jpg"
            // To be safe, we replace occurrences of the exact filename, preferably preceded by a slash or start of string.

            // Standardizing the target to match typical path storage
            // This avoids the "1.jpg" matching "11.jpg" issue by ensuring strict boundaries if possible
            // But since paths vary, strict replacement of the exact string "/uploads/${file}" is safest if that's the convention.
            // If convention is unknown, we can try to be smart but safety is #1.

            // NOTE: Assuming DB stores relative paths like '/uploads/file.jpg' based on standard Multer usage.
            const searchPattern = `/uploads/${file}`;

            // Update Products (image) - Strict match on the path
            const pRes = await db.query(
                `UPDATE products SET image = $1 WHERE image = $2 OR image LIKE $3 RETURNING id, name`,
                [cloudUrl, searchPattern, `/%/${file}`] // matches exact "/uploads/file.jpg"
            );
            if (pRes.rowCount > 0) {
                console.log(`   Updated ${pRes.rowCount} product(s) (image).`);
            }

            // Update Users (avatar)
            const uRes = await db.query(
                `UPDATE users SET avatar = $1 WHERE avatar = $2 OR avatar LIKE $3 RETURNING id, email`,
                [cloudUrl, searchPattern, `/%/${file}`]
            );
            if (uRes.rowCount > 0) {
                console.log(`   Updated ${uRes.rowCount} user(s) (avatar).`);
            }

            // Update Banners (src)
            const bRes = await db.query(
                `UPDATE banners SET src = $1 WHERE src = $2 OR src LIKE $3 RETURNING id, title`,
                [cloudUrl, searchPattern, `/%/${file}`]
            );
            if (bRes.rowCount > 0) {
                console.log(`   Updated ${bRes.rowCount} banner(s).`);
            }

            // ⚡ Optimized JSONB Update (No Nested Loop!)
            // We treat the JSON array as text, perform a safe replace, and cast back to JSONB.
            // This runs entirely in the DB engine, avoiding the O(N*M) JS loop.
            // Escaping the search pattern for JSON string representation
            const jsonSearchPattern = `"/uploads/${file}"`;
            const jsonReplacePattern = `"${cloudUrl}"`;

            const pArrayRes = await db.query(
                `UPDATE products 
                 SET images = REPLACE(images::text, $1, $2)::jsonb 
                 WHERE images::text LIKE $3 RETURNING id`,
                [jsonSearchPattern, jsonReplacePattern, `%${jsonSearchPattern}%`]
            );

            if (pArrayRes.rowCount > 0) {
                console.log(`   Updated images array for ${pArrayRes.rowCount} product(s).`);
            }
        }
    }

    console.log('--- Migration Completed ---');
    process.exit(0);
}

migrate();
