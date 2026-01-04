const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5001;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "https://girly-shop-rlga1zpx5-devezaas-projects.vercel.app", // Allow specific Vercel deployment
            process.env.CLIENT_URL // Allow deployed frontend URL
        ].filter(Boolean),
        methods: ["GET", "POST"]
    }
});

// 🔌 Socket.io Events
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_chat', (data) => {
        socket.join(data.room);
        console.log(`User ${socket.id} joined room: ${data.room}`);
    });

    socket.on('send_message', (data) => {
        // Broadcast to everyone in the room (including sender if needed, or just others)
        // For simplicity in this demo, broadcasting to everyone
        io.emit('receive_message', data);
    });

    socket.on('edit_message', (data) => {
        io.emit('message_updated', data);
    });

    socket.on('delete_message', (data) => {
        io.emit('message_deleted', data);
    });

    // WebRTC Signaling Events (Video/Voice)
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
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads/'))
    },
    filename: function (req, file, cb) {
        // Unique filename: fieldname-timestamp.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 📤 Upload Endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    // Return the URL to the file
    const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
});

// 🗄️ Helper to read/write JSON
const getData = (file) => {
    const filePath = path.join(__dirname, 'data', file);
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};

const saveData = (file, data) => {
    const filePath = path.join(__dirname, 'data', file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// 🛍️ GET Products (with Search)
app.get('/api/products', (req, res) => {
    const { search } = req.query;
    let products = getData('products.json');

    if (search) {
        products = products.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.category && p.category.toLowerCase().includes(search.toLowerCase()))
        );
    }

    res.json(products);
});

// 🛍️ GET Single Product
app.get('/api/products/:id', (req, res) => {
    const products = getData('products.json');
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (product) res.json(product);
    else res.status(404).json({ message: "Product not found" });
});

// ➕ POST Add Product
app.post('/api/products', (req, res) => {
    const { name, price, image, category, brand, stock, description, oldPrice, volume, howToUse, ingredients, highlights } = req.body;

    // Validation
    if (!name || price === undefined) {
        return res.status(400).json({ success: false, message: "Name and Price are required" });
    }
    if (parseFloat(price) < 0) {
        return res.status(400).json({ success: false, message: "Price cannot be negative" });
    }

    const products = getData('products.json');

    // Generate Unique ID (Max ID + 1)
    const maxId = products.reduce((max, p) => (p.id > max ? p.id : max), 0);
    const newProduct = {
        id: maxId + 1,
        name,
        price: parseFloat(price),
        oldPrice: oldPrice ? parseFloat(oldPrice) : null,
        image: image || "/products/anua-bottle.jpg", // Default fallback
        category,
        brand: brand || "Generic",
        stock: stock !== undefined ? parseInt(stock) : 50,
        volume: volume || "",
        description: description || "",
        howToUse: howToUse || [],
        ingredients: ingredients || "",
        highlights: highlights || [],
        rating: 0,
        reviews: 0,
        isNew: true
    };

    products.push(newProduct);
    saveData('products.json', products);
    res.json({ success: true, product: newProduct });
});

// ✏️ PUT Update Product
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, image, category, brand, stock, description, oldPrice, volume, howToUse, ingredients, highlights } = req.body;
    let products = getData('products.json');
    const index = products.findIndex(p => p.id === parseInt(id));

    if (index === -1) return res.status(404).json({ success: false, message: "Product not found" });

    // Validation
    if (price !== undefined && parseFloat(price) < 0) {
        return res.status(400).json({ success: false, message: "Price cannot be negative" });
    }

    const updatedProduct = {
        ...products[index],
        name: name !== undefined ? name : products[index].name,
        price: price !== undefined ? parseFloat(price) : products[index].price,
        oldPrice: oldPrice !== undefined ? parseFloat(oldPrice) : products[index].oldPrice,
        image: image !== undefined ? image : products[index].image,
        category: category !== undefined ? category : products[index].category,
        brand: brand !== undefined ? brand : products[index].brand,
        stock: stock !== undefined ? parseInt(stock) : products[index].stock,
        volume: volume !== undefined ? volume : products[index].volume,
        description: description !== undefined ? description : products[index].description,
        howToUse: howToUse !== undefined ? howToUse : products[index].howToUse,
        ingredients: ingredients !== undefined ? ingredients : products[index].ingredients,
        highlights: highlights !== undefined ? highlights : products[index].highlights
    };

    products[index] = updatedProduct;
    saveData('products.json', products);
    res.json({ success: true, product: updatedProduct });
});

// 🗑️ DELETE Product
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    let products = getData('products.json');
    const initialLength = products.length;

    products = products.filter(p => p.id !== parseInt(id));

    if (products.length === initialLength) {
        return res.status(404).json({ success: false, message: "Product not found" });
    }

    saveData('products.json', products);
    res.json({ success: true, message: "Product deleted successfully" });
});

// 🔐 JWT Config
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const SECRET_KEY = "girly-shop-secret-key-change-this-in-prod"; // In production, use .env

// Middleware to authenticate token
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

// 🔐 Login (Secure)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const users = getData('users.json');
    const user = users.find(u => u.email === email);

    if (user) {
        // Compare hashed password
        // Note: For existing plain text passwords (legacy), we might need a migration or check
        // For now, assuming new users use hash, old users might need a manual reset or handling
        let validPassword = false;

        // Simple check: if password length < 60 (bcrypt hash length) it's likely plain text
        if (user.password.length < 50) {
            validPassword = (user.password === password); // Legacy plain text fallback
        } else {
            validPassword = await bcrypt.compare(password, user.password);
        }

        if (validPassword) {
            const { password: _, ...userInfo } = user;
            // Generate Token
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '7d' });
            res.json({ success: true, user: userInfo, token });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
    }
});

// 📝 Register (Secure)
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    const users = getData('users.json');

    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
        id: "u" + (users.length + 1),
        username,
        email,
        password: hashedPassword, // Store hashed password
        role: "customer",
        avatar: "/user-avatar.jpg",
        wishlist: []
    };

    users.push(newUser);
    saveData('users.json', users);

    // Generate Token
    const token = jwt.sign({ id: newUser.id, email: newUser.email, role: newUser.role }, SECRET_KEY, { expiresIn: '7d' });

    const { password: _, ...userInfo } = newUser;
    res.json({ success: true, user: userInfo, token });
});

// ❤️ User Profile & Wishlist (Secure)
// 👤 Get User Profile by ID (Protected)
app.get('/api/users/:id', authenticateToken, (req, res) => {
    const users = getData('users.json');
    const user = users.find(u => u.id === req.params.id);

    // Security check: only allow users to fetch their own data or admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (user) {
        const { password, ...userInfo } = user;
        res.json({ success: true, user: userInfo });
    } else {
        res.status(404).json({ success: false, message: "User not found" });
    }
});

// 👤 Update User Profile (Protected)
app.put('/api/users/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    // Security check
    if (req.user.id !== id && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Forbidden: You can only update your own profile" });
    }

    console.log(`[PUT] Update request for user: ${id}`);

    const { username, email, avatar } = req.body;
    let users = getData('users.json');
    const index = users.findIndex(u => u.id === id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update user but keep existing data like password/wishlist if not provided
    const updatedUser = {
        ...users[index],
        username: username || users[index].username,
        email: email || users[index].email,
        avatar: avatar || users[index].avatar
    };

    users[index] = updatedUser;

    try {
        saveData('users.json', users);
        console.log(`User ${id} updated successfully`);
    } catch (err) {
        console.error("Error saving data:", err);
        return res.status(500).json({ success: false, message: "Internal Server Error during save" });
    }

    // Return user info excluding password
    const { password: _, ...userInfo } = updatedUser;
    res.json({ success: true, user: userInfo });
});

// 🖼️ GET Banners
app.get('/api/banners', (req, res) => {
    const banners = getData('banners.json');
    res.json(banners);
});

// 🖼️ POST Update Banners
app.post('/api/banners', (req, res) => {
    const banners = req.body; // Expecting array of banners
    if (!Array.isArray(banners)) {
        return res.status(400).json({ success: false, message: "Invalid data format. Expected array." });
    }
    saveData('banners.json', banners);
    res.json({ success: true, message: "Banners updated successfully" });
});

// 🎟️ GET Vouchers
app.get('/api/vouchers', (req, res) => {
    const vouchers = getData('vouchers.json');
    res.json(vouchers);
});

// 🎟️ POST Update Vouchers
app.post('/api/vouchers', (req, res) => {
    const vouchers = req.body;
    if (!Array.isArray(vouchers)) {
        return res.status(400).json({ success: false, message: "Invalid data format. Expected array." });
    }
    saveData('vouchers.json', vouchers);
    res.json({ success: true, message: "Vouchers updated successfully" });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
