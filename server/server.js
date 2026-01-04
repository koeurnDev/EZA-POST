const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db'); // Import DB connection
const jwt = require('jsonwebtoken');
const { KHQR, TAG, CURRENCY, COUNTRY } = require("ts-khqr"); // Bakong Import
const bcrypt = require('bcryptjs');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;
const SECRET_KEY = "girly-shop-secret-key-change-this-in-prod"; // In production, use .env

// 🔐 Middleware to authenticate token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401); // Unauthorized

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); // Forbidden
        req.user = user;
        next();
    });
};

// 🛡️ Simple In-Memory Rate Limiter (No external deps)
const loginAttempts = new Map();
// 🛡️ Simple In-Memory Rate Limiter (DISABLED for debugging)
const rateLimiterMiddleware = (req, res, next) => {
    next();
};

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:5176",
            "http://192.168.43.104:5176", // Phone Access
            "https://girly-shop-rlga1zpx5-devezaas-projects.vercel.app",
            "https://girly-shop-eta.vercel.app",
            "https://girly-shop-kskglxcye-devezaas-projects.vercel.app",
            process.env.CLIENT_URL
        ].filter(Boolean),
        methods: ["GET", "POST"]
    }
});

// 🔌 Socket.io Events (Kept same as before)
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_chat', (data) => {
        socket.join(data.room);
        console.log(`User ${socket.id} joined room: ${data.room}`);
    });

    socket.on('send_message', (data) => {
        io.emit('receive_message', data);
    });

    socket.on('edit_message', (data) => {
        io.emit('message_updated', data);
    });

    socket.on('delete_message', (data) => {
        io.emit('message_deleted', data);
    });

    socket.on("callUser", (data) => {
        io.to(data.userToCall).emit("callUser", { signal: data.signalData, from: data.from, name: data.name });
    });

    socket.on("answerCall", (data) => {
        io.to(data.to).emit("callAccepted", data.signal);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        socket.broadcast.emit("callEnded");
    });
});

// 📁 Static folder for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 📸 Multer Config
// 📸 Cloudinary Config
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'girly-shop',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});

const upload = multer({ storage: storage });

// 📤 Upload Endpoint
app.post('/api/upload', (req, res) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error("❌ Upload Error Details:", JSON.stringify(err, null, 2));
            console.error("Error Message:", err.message);
            return res.status(500).json({ success: false, message: "Upload failed: " + err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        // Cloudinary returns the verified URL in req.file.path
        res.json({ success: true, url: req.file.path });
    });
});

// 📜 Audit Logging Helper
async function logActivity(client, user, action, details, ip) {
    try {
        const username = user?.username || "Unknown";
        const role = user?.role || "Guest";
        await db.query(
            'INSERT INTO activity_logs ("user", role, action, details, ip) VALUES ($1, $2, $3, $4, $5)',
            [username, role, action, details, ip]
        );
    } catch (err) {
        console.error("Failed to log activity:", err);
    }
}

// 📜 GET Audit Logs
app.get('/api/admin/logs', authenticateToken, async (req, res) => {
    if (req.user.role !== 'owner') return res.sendStatus(403);
    try {
        const result = await db.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching logs" });
    }
});

// 🛍️ GET Products (with Search)
app.get('/api/products', async (req, res) => {
    const { search, ids } = req.query;
    try {
        let queryText = 'SELECT * FROM products';
        let queryParams = [];
        let whereClauses = [];

        if (search) {
            whereClauses.push('(name ILIKE $' + (queryParams.length + 1) + ' OR category ILIKE $' + (queryParams.length + 1) + ')');
            queryParams.push(`%${search}%`);
        }

        if (ids) {
            const idList = ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (idList.length > 0) {
                whereClauses.push(`id = ANY($${queryParams.length + 1})`);
                queryParams.push(idList);
            } else {
                // ids provided but empty or invalid, return empty result if intent was to filter by specific ids
                return res.json([]);
            }
        }

        if (whereClauses.length > 0) {
            queryText += ' WHERE ' + whereClauses.join(' AND ');
        }

        queryText += ' ORDER BY id ASC'; // Consistent ordering

        const result = await db.query(queryText, queryParams);
        // Ensure price is float and images is array (pg handles JSONB to object/array automatically)
        const products = result.rows.map(p => ({
            ...p,
            price: parseFloat(p.price),
            oldPrice: p.old_price ? parseFloat(p.old_price) : null,
            rating: parseFloat(p.rating),
            images: p.images || [],
            highlights: p.highlights || [],
            howToUse: p.how_to_use || [],
            isNew: p.is_new
        }));
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching products" });
    }
});

// 🛍️ GET Single Product
app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }
        const p = result.rows[0];
        const product = {
            ...p,
            price: parseFloat(p.price),
            oldPrice: p.old_price ? parseFloat(p.old_price) : null,
            rating: parseFloat(p.rating),
            images: p.images || [],
            highlights: p.highlights || [],
            howToUse: p.how_to_use || [],
            isNew: p.is_new
        };
        res.json(product);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching product" });
    }
});

// ➕ POST Add Product
app.post('/api/products', authenticateToken, async (req, res) => {
    // 🔒 RBAC Check
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    const { name, price, image, category, brand, stock, description, oldPrice, volume, howToUse, ingredients, highlights } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ success: false, message: "Name and Price are required" });
    }
    if (parseFloat(price) < 0) {
        return res.status(400).json({ success: false, message: "Price cannot be negative" });
    }

    try {
        const result = await db.query(`
            INSERT INTO products (name, price, old_price, image, category, brand, stock, volume, description, how_to_use, ingredients, highlights, is_new, rating, reviews)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `, [
            name,
            parseFloat(price),
            oldPrice ? parseFloat(oldPrice) : null,
            image || "/products/anua-bottle.jpg",
            category,
            brand || "Generic",
            stock !== undefined ? parseInt(stock) : 50,
            volume || "",
            description || "",
            JSON.stringify(howToUse || []),
            ingredients || "",
            JSON.stringify(highlights || []),
            true, // isNew
            0, // rating
            0  // reviews
        ]);

        const p = result.rows[0];
        res.json({
            success: true, product: {
                ...p,
                price: parseFloat(p.price),
                oldPrice: p.old_price ? parseFloat(p.old_price) : null,
                rating: parseFloat(p.rating),
                isNew: p.is_new,
                howToUse: p.how_to_use,
                highlights: p.highlights
            }
        });

        // 📜 Log It
        logActivity(
            db,
            req.user,
            "CREATE_PRODUCT",
            `Created product: ${name} ($${price})`,
            req.ip
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error adding product" });
    }
});

// ✏️ PUT Update Product
app.put('/api/products/:id', authenticateToken, async (req, res) => {
    // 🔒 RBAC Check
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    const { id } = req.params;
    const { name, price, image, category, brand, stock, description, oldPrice, volume, howToUse, ingredients, highlights } = req.body;

    try {
        // Check if exists
        const check = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ success: false, message: "Product not found" });

        const current = check.rows[0];

        // Prepare values (using COALESCE logic here or in query, easier to prepare values in JS)
        const newName = name !== undefined ? name : current.name;
        const newPrice = price !== undefined ? parseFloat(price) : current.price;
        const newOldPrice = oldPrice !== undefined ? parseFloat(oldPrice) : current.old_price;
        const newImage = image !== undefined ? image : current.image;
        const newCategory = category !== undefined ? category : current.category;
        const newBrand = brand !== undefined ? brand : current.brand;
        const newStock = stock !== undefined ? parseInt(stock) : current.stock;
        const newVolume = volume !== undefined ? volume : current.volume;
        const newDesc = description !== undefined ? description : current.description;
        const newHowToUse = howToUse !== undefined ? JSON.stringify(howToUse) : JSON.stringify(current.how_to_use);
        const newIngredients = ingredients !== undefined ? ingredients : current.ingredients;
        const newHighlights = highlights !== undefined ? JSON.stringify(highlights) : JSON.stringify(current.highlights);

        const result = await db.query(`
            UPDATE products 
            SET name=$1, price=$2, old_price=$3, image=$4, category=$5, brand=$6, stock=$7, volume=$8, description=$9, how_to_use=$10, ingredients=$11, highlights=$12
            WHERE id=$13
            RETURNING *
        `, [newName, newPrice, newOldPrice, newImage, newCategory, newBrand, newStock, newVolume, newDesc, newHowToUse, newIngredients, newHighlights, id]);

        const p = result.rows[0];
        res.json({
            success: true, product: {
                ...p,
                price: parseFloat(p.price),
                oldPrice: p.old_price ? parseFloat(p.old_price) : null,
                rating: parseFloat(p.rating),
                isNew: p.is_new,
                howToUse: p.how_to_use,
                highlights: p.highlights
            }
        });

        // 📜 Log It
        logActivity(
            db,
            req.user,
            "UPDATE_PRODUCT",
            `Updated product ID ${id}. Price: ${newPrice}`,
            req.ip
        );

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating product" });
    }
});

// 🗑️ DELETE Product
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    // 🔒 RBAC Check
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    const { id } = req.params;
    try {
        const result = await db.query('DELETE FROM products WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.json({ success: true, message: "Product deleted successfully" });

        // 📜 Log It
        logActivity(
            db,
            req.user,
            "DELETE_PRODUCT",
            `Deleted product ID ${id}`,
            req.ip
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error deleting product" });
    }
});



// 🔐 Login
app.post('/api/auth/login', rateLimiterMiddleware, async (req, res) => {
    const { password } = req.body;
    const email = req.body.email?.toLowerCase(); // Case insensitive login

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            let validPassword = false;
            // Legacy handling (assuming migration kept passwords as is)
            if (user.password.length < 50) {
                validPassword = (user.password === password);
            } else {
                validPassword = await bcrypt.compare(password, user.password);
            }

            if (validPassword) {
                const { password: _, ...userInfo } = user;
                const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
                res.json({ success: true, user: userInfo, token });
            } else {
                res.status(401).json({ success: false, message: "Invalid credentials" });
            }
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error logging in" });
    }
});

// 📝 Register (Secure)
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await db.query(`
            INSERT INTO users (username, email, password, role, avatar, wishlist)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            username,
            email,
            hashedPassword,
            "customer",
            "/user-avatar.jpg",
            JSON.stringify([])
        ]);

        const newUser = result.rows[0];
        const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, SECRET_KEY, { expiresIn: '7d' });
        const { password: _, ...userInfo } = newUser;

        res.json({ success: true, user: userInfo, token });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error registering user" });
    }
});

// 👥 Get All Users (Admin Only)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    // 🔒 RBAC Check
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    try {
        const result = await db.query('SELECT id, username, email, role, avatar FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching users" });
    }
});

// ➕ Create User (Admin & Owner)
app.post('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const { username, email, password, role } = req.body;

    // RBAC: Admin cannot create 'admin' or 'owner' users
    if (req.user.role === 'admin' && (role === 'admin' || role === 'owner')) {
        return res.status(403).json({ success: false, message: "Forbidden: Admins can only create Customers." });
    }

    try {
        const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (check.rows.length > 0) return res.status(400).json({ success: false, message: "Email already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newRole = role || 'customer';

        const result = await db.query(`
            INSERT INTO users (username, email, password, role, avatar, wishlist) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [username, email, hashedPassword, newRole, "/user-avatar.jpg", JSON.stringify([])]);

        const { password: _, ...userInfo } = result.rows[0];
        res.json({ success: true, user: userInfo });

        // 📜 Log It
        logActivity(db, req.user, "CREATE_USER", `Created user: ${username} (${newRole})`, req.ip);
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error creating user" });
    }
});

// 👤 Get User Profile
app.get('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Check permissions
    // Note: ID in DB is integer, req.params.id is string. Comparison needs care.
    if (req.user.id != id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const { password, ...userInfo } = result.rows[0];
        res.json({ success: true, user: userInfo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error fetching user" });
    }
});

// 👤 Update User Profile
app.put('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (req.user.id != id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { username, email, avatar } = req.body;
    try {
        const check = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

        const current = check.rows[0];
        const newUsername = username || current.username;
        const newEmail = email || current.email;
        const newAvatar = avatar || current.avatar;

        // RBAC: Only Owner can change roles. Admin cannot.
        let newRole = current.role;
        if (req.body.role && req.body.role !== current.role) {
            if (req.user.role !== 'owner') {
                return res.status(403).json({ success: false, message: "Forbidden: Only Owner can change user roles." });
            }
            newRole = req.body.role;
        }

        // RBAC: Admin cannot update other Admins or Owner
        if (req.user.role === 'admin' && (current.role === 'admin' || current.role === 'owner')) {
            return res.status(403).json({ success: false, message: "Forbidden: Admins cannot modify other Admins or Owner." });
        }

        const result = await db.query(`
            UPDATE users SET username=$1, email=$2, avatar=$3, role=$4 WHERE id=$5 RETURNING *
        `, [newUsername, newEmail, newAvatar, newRole, id]);

        const { password, ...userInfo } = result.rows[0];
        res.json({ success: true, user: userInfo });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating user" });
    }
});

// 🗑️ DELETE User (Admin Only)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.status(403).json({ success: false, message: "Forbidden: Admins Only" });
    }

    try {
        // Check target user role
        const target = await db.query('SELECT role FROM users WHERE id = $1', [id]);
        if (target.rows.length === 0) return res.status(404).json({ success: false, message: "User not found" });

        const targetRole = target.rows[0].role;

        // RBAC Prevention
        if (req.user.role === 'admin' && (targetRole === 'admin' || targetRole === 'owner')) {
            return res.status(403).json({ success: false, message: "Forbidden: You cannot delete Admins or Owners." });
        }

        const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error deleting user" });
    }
});

// 🖼️ GET Banners
app.get('/api/banners', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM banners ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching banners" });
    }
});

// 🖼️ POST Update Banners
app.post('/api/banners', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    const banners = req.body;
    if (!Array.isArray(banners)) {
        return res.status(400).json({ success: false, message: "Invalid data format. Expected array." });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM banners'); // Replace all logic

        for (const b of banners) {
            await client.query(`
                INSERT INTO banners (id, src, alt, title, subtitle, btn_text)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [b.id, b.src, b.alt, b.title, b.subtitle, b.btnText]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Banners updated successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating banners" });
    } finally {
        client.release();
    }
});





// 📩 POST Subscribe
app.post('/api/subscribe', async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: "Invalid email" });
    }

    try {
        await db.query(`
            INSERT INTO subscribers (email) VALUES ($1)
            ON CONFLICT (email) DO NOTHING
        `, [email]);
        res.json({ success: true, message: "Subscribed successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error subscribing" });
    }
});

// 🎟️ GET Vouchers
app.get('/api/vouchers', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM vouchers ORDER BY id ASC');
        // CamelCase conversion for frontend compatibility
        const vouchers = result.rows.map(v => ({
            id: v.id,
            code: v.code,
            title: v.title,
            subtitle: v.subtitle,
            discountAmount: parseFloat(v.discount_amount),
            type: v.type,
            displayDiscount: v.display_discount,
            valid: v.valid,
            color: v.color,
            textColor: v.text_color
        }));
        res.json(vouchers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching vouchers" });
    }
});

// 🛒 Cart Persistence Endpoints

// GET Cart
app.get('/api/cart', authenticateToken, async (req, res) => {
    try {
        const result = await db.query('SELECT cart FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.json([]);
        // Ensure it returns an array
        const cart = result.rows[0].cart || [];
        res.json(cart);
    } catch (err) {
        console.error("Error fetching cart:", err);
        res.status(500).json({ message: "Error fetching cart" });
    }
});

// SYNC Cart (Replace)
app.put('/api/cart', authenticateToken, async (req, res) => {
    const { cart } = req.body;
    if (!Array.isArray(cart)) return res.status(400).json({ message: "Cart must be an array" });

    try {
        await db.query('UPDATE users SET cart = $1 WHERE id = $2', [JSON.stringify(cart), req.user.id]);
        res.json({ success: true, message: "Cart synced" });
    } catch (err) {
        console.error("Error syncing cart:", err);
        res.status(500).json({ message: "Error syncing cart" });
    }
});

// 🚚 Delivery Options Endpoints

// GET All Options
app.get('/api/delivery-options', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM delivery_options ORDER BY price ASC');
        res.json(result.rows.map(row => ({
            ...row,
            price: parseFloat(row.price) // Ensure number
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching delivery options" });
    }
});

// POST New Option
app.post('/api/delivery-options', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);

    const { name, price, duration, description } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO delivery_options (name, price, duration, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, price, duration, description]
        );
        const newOption = result.rows[0];
        newOption.price = parseFloat(newOption.price);
        res.json({ success: true, option: newOption });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error adding option" });
    }
});

// PUT Update Option
app.put('/api/delivery-options/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);

    const { id } = req.params;
    const { name, price, duration, description } = req.body;
    try {
        const result = await db.query(
            'UPDATE delivery_options SET name=$1, price=$2, duration=$3, description=$4 WHERE id=$5 RETURNING *',
            [name, price, duration, description, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Option not found" });

        const updatedOption = result.rows[0];
        updatedOption.price = parseFloat(updatedOption.price);
        res.json({ success: true, option: updatedOption });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating option" });
    }
});

// DELETE Option
app.delete('/api/delivery-options/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);

    const { id } = req.params;
    try {
        await db.query('DELETE FROM delivery_options WHERE id=$1', [id]);
        res.json({ success: true, message: "Deleted" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error deleting option" });
    }
});

// 🌟 GET Promotions (Migrated to DB)
app.get('/api/promotions', async (req, res) => {
    try {
        // Fetch from banners table as promotions are now consolidated there
        const result = await db.query('SELECT * FROM banners ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching promotions" });
    }
});


// 🎟️ POST Update Vouchers
app.post('/api/vouchers', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);
    const vouchers = req.body;
    if (!Array.isArray(vouchers)) {
        return res.status(400).json({ success: false, message: "Invalid data format. Expected array." });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM vouchers'); // Replace all logic

        for (const v of vouchers) {
            await client.query(`
                INSERT INTO vouchers (code, title, subtitle, discount_amount, type, display_discount, valid, color, text_color)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [v.code, v.title, v.subtitle, v.discountAmount, v.type, v.displayDiscount, v.valid, v.color, v.textColor]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "Vouchers updated successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating vouchers" });
    } finally {
        client.release();
    }
});

// ⚙️ GET Maintenance Status (Public)
app.get('/api/maintenance', async (req, res) => {
    try {
        const result = await db.query("SELECT value FROM settings WHERE key = 'maintenance_mode'");
        const isMaintenance = result.rows.length > 0 && result.rows[0].value === 'true';
        res.json({ maintenance: isMaintenance });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching maintenance status" });
    }
});

// ⚙️ POST Update Settings (Admin/Owner)
app.post('/api/settings', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);

    const { key, value } = req.body;
    if (!key || value === undefined) return res.status(400).json({ message: "Key and Value required" });

    try {
        await db.query(`
            INSERT INTO settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, String(value)]);

        res.json({ success: true, message: "Setting updated" });

        logActivity(
            db,
            req.user,
            "UPDATE_SETTING",
            `Updated setting ${key} to ${value}`,
            req.ip
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating setting" });
    }
});



// 💸 BAKONG KHQR INTEGRATION 💸
// 💸 BAKONG KHQR INTEGRATION 💸
app.post("/api/pay", async (req, res) => {
    console.log("Received payment request:", req.body);
    const { amount, userId, items, address } = req.body; // Expect userId/items context if available
    const orderId = "ORD-" + Date.now();

    try {
        const safeAmount = parseFloat(amount);
        if (isNaN(safeAmount) || safeAmount <= 0) {
            throw new Error(`Invalid amount: ${amount}`);
        }

        console.log(`Generating QR for: ${safeAmount} USD, Order: ${orderId}`);

        if (!process.env.KHQR_ACCOUNT_ID) {
            throw new Error("Server Misconfiguration: KHQR_ACCOUNT_ID is missing in .env");
        }

        const result = KHQR.generate({
            tag: TAG.INDIVIDUAL,
            accountID: process.env.KHQR_ACCOUNT_ID,
            merchantName: "Girly Shop",
            amount: safeAmount,
            currency: CURRENCY.USD,
            countryCode: COUNTRY.KH,
            expirationTimestamp: Date.now() + 5 * 60 * 1000,
            additionalData: {
                billNumber: orderId
            }
        });

        if (result.status.code !== 0) {
            throw new Error(`KHQR Gen Error: ${result.status.message || 'Unknown error'}`);
        }

        // Save order as PENDING
        await db.query(`
            INSERT INTO orders (order_id, user_id, items, total, status, payment_method, shipping_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            orderId,
            userId || null, // Might be guest?
            JSON.stringify(items || []),
            safeAmount,
            "pending",
            "KHQR",
            JSON.stringify(address || {})
        ]);

        console.log("Created PENDING Order:", orderId);
        res.json({ ...result.data, orderId });
    } catch (error) {
        console.error("Error generating KHQR or Saving Order:", error);
        res.status(500).json({ error: "Failed to generate QR code: " + error.message });
    }
});

// 🛍️ GET All Orders (Admin or User)
app.get("/api/orders", async (req, res) => {
    const { userId } = req.query;

    try {
        let queryText = 'SELECT * FROM orders';
        let queryParams = [];

        if (userId) {
            queryText += ' WHERE user_id = $1';
            queryParams.push(userId);
        }

        queryText += ' ORDER BY created_at DESC';

        const result = await db.query(queryText, queryParams);
        const userOrders = result.rows.map(o => ({
            ...o,
            order_id: o.order_id,
            userId: o.user_id,
            total: parseFloat(o.total),
            items: o.items || [],
            address: o.shipping_address || {},
            created_at: o.created_at
        }));

        res.json(userOrders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching orders" });
    }
});

// Check Status
app.get("/api/orders/:orderId", async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM orders WHERE order_id = $1', [req.params.orderId]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Order not found" });

        const o = result.rows[0];
        const order = {
            ...o,
            orderId: o.order_id,
            userId: o.user_id,
            total: parseFloat(o.total),
            items: o.items || [],
            address: o.shipping_address || {},
            created_at: o.created_at
        };
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching order" });
    }
});

// 🔔 PUT Mark Notification as Read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        console.error("Error marking read:", err);
        res.status(500).json({ success: false, message: "Error" });
    }
});

// 💬 Chat History (Mock) - Moved here for visibility
app.get('/api/chat/:roomId/history', (req, res) => {
    console.log("Fetching chat history for room:", req.params.roomId);
    res.json([
        { id: 1, text: "Hello! How can we help you?", sender: "admin", timestamp: new Date() } // Dummy message
    ]);
});

// 🚚 GET Delivery Options
app.get('/api/delivery-options', (req, res) => {
    res.json([
        { id: 'standard', name: 'J&T Express', price: 1.50, icon: null },
        { id: 'express', name: 'Virak Buntham', price: 2.00, icon: null },
        { id: 'same-day', name: 'GrabExpress', price: 3.50, icon: null }
    ]);
});

// 🔔 GET Notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        // If admin, maybe see all system alerts? For now just user specific or if we implement 'admin' notifications channel.
        // Let's say Admins see notifications where user_id IS NULL (System) OR user_id = their id.
        // But for simplicity, we'll assign notifications to specific user IDs (including admin's ID).

        // Fetch recent 20
        const result = await db.query(`
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 20
        `, [userId]);

        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching notes:", err);
        res.status(500).json({ message: "Error" });
    }
});

// 🔔 POST Send Notification (Admin/Owner)
app.post('/api/notifications', authenticateToken, async (req, res) => {
    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        return res.sendStatus(403);
    }

    const { userId, text } = req.body;
    if (!userId || !text) {
        return res.status(400).json({ success: false, message: "User ID and Text are required" });
    }

    try {
        await db.query("INSERT INTO notifications (user_id, text) VALUES ($1, $2)", [userId, text]);
        res.json({ success: true, message: "Notification sent" });

        // Log it
        logActivity(db, req.user, "SEND_NOTIFICATION", `Sent notification to User ${userId}: ${text}`, req.ip);
    } catch (err) {
        console.error("Error sending notification:", err);
        res.status(500).json({ success: false, message: "Error sending notification" });
    }
});

// 📊 GET Admin Stats (Mocked or Calculated)
// 📊 GET Admin Stats (Calculated from DB)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'owner') return res.sendStatus(403);

    try {
        const orderStats = await db.query('SELECT COUNT(*) as count, SUM(total) as revenue FROM orders');
        const userStats = await db.query('SELECT COUNT(*) as count FROM users');

        const totalOrders = parseInt(orderStats.rows[0].count, 10) || 0;
        const totalRevenue = parseFloat(orderStats.rows[0].revenue || 0).toFixed(2);
        const totalUsers = parseInt(userStats.rows[0].count, 10) || 0;
        // Sales is usually count of paid orders, but using total orders for simple stat
        const totalSales = totalOrders;

        // Fetch Recent Orders (Limit 5)
        const recentOrdersResult = await db.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
        const recentOrders = recentOrdersResult.rows.map(o => ({
            ...o,
            total: parseFloat(o.total)
        }));

        // 🔒 RBAC: Only Owner sees Revenue
        const isOwner = req.user.role === 'owner';

        res.json({
            revenue: isOwner ? totalRevenue : null, // Hide if not owner
            sales: totalSales,
            orders: totalOrders,
            users: totalUsers,
            recentOrders: recentOrders
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching stats" });
    }
});

// 📈 GET Admin Reports (Charts)
app.get('/api/admin/reports', authenticateToken, async (req, res) => {
    if (req.user.role !== 'owner') return res.sendStatus(403); // 🔒 Strict Owner Only

    const type = req.query.type || 'week'; // week, month, year

    try {
        let query;

        // 📅 Postgres Date Aggregation
        if (type === 'week') {
            // Last 7 days
            query = `
                SELECT TO_CHAR(created_at, 'Dy') as label, SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '6 days'
                GROUP BY TO_CHAR(created_at, 'Dy'), DATE(created_at)
                ORDER BY DATE(created_at) ASC
            `;
        } else if (type === 'month') {
            // Last 30 days (grouped by ~3-4 day intervals or just days)
            // Let's do daily for month view for better fidelity
            query = `
                SELECT TO_CHAR(created_at, 'DD Mon') as label, SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '30 days'
                GROUP BY TO_CHAR(created_at, 'DD Mon'), DATE(created_at)
                ORDER BY DATE(created_at) ASC
            `;
        } else {
            // Last 12 months
            query = `
                SELECT TO_CHAR(created_at, 'Mon') as label, SUM(total) as revenue, COUNT(*) as orders
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '1 year'
                GROUP BY TO_CHAR(created_at, 'Mon'), DATE_TRUNC('month', created_at)
                ORDER BY DATE_TRUNC('month', created_at) ASC
            `;
        }

        const result = await db.query(query);

        // Map numeric strings to floats
        const data = result.rows.map(row => ({
            label: row.label,
            revenue: parseFloat(row.revenue || 0),
            orders: parseInt(row.orders || 0)
        }));

        res.json(data);
    } catch (err) {
        console.error("Error fetching reports:", err);
        res.status(500).json({ message: "Error loading reports" });
    }
});

// 🛍️ Standard Checkout (Non-Bakong) or Order Placement
// 🛍️ Standard Checkout (Non-Bakong) or Order Placement
app.post("/api/orders", async (req, res) => {
    console.log("Received Order:", req.body);
    const { userId, items, total, address, paymentMethod } = req.body;

    // Validate
    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const orderId = "ORD-" + Date.now();
    // Default status for COD is 'pending'. For Paid methods it might be 'paid' if verified client-side (insecure but common for MVP)
    const status = "pending";

    try {
        await db.query(`
            INSERT INTO orders (order_id, user_id, items, total, status, payment_method, shipping_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            orderId,
            userId,
            JSON.stringify(items),
            total,
            status,
            paymentMethod,
            JSON.stringify(address)
        ]);

        console.log(`Order Placed: ${orderId} by ${userId}`);

        // 🔔 Notify Admins
        // Find all admins/owners
        const admins = await db.query("SELECT id FROM users WHERE role IN ('admin', 'owner')");
        for (const admin of admins.rows) {
            await db.query("INSERT INTO notifications (user_id, text) VALUES ($1, $2)", [admin.id, `New Order ${orderId} received!`]);
        }

        // 🔔 Notify User
        await db.query("INSERT INTO notifications (user_id, text) VALUES ($1, $2)", [userId, `Order ${orderId} placed successfully.`]);

        res.json({ success: true, orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to create order" });
    }
});


// Admin Confirm Payment (Manual)
app.post("/api/admin/confirm/:orderId", (req, res) => {
    const order = orders.find(o => o.orderId === req.params.orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    order.status = "paid";
    console.log(`Order ${order.orderId} marked as PAID`);
    res.json({ success: true, status: "paid" });
});

// 🚨 Centralized Error Handler
app.use((err, req, res, next) => {
    console.error("🔥 Unhandled Error:", err.stack);
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
