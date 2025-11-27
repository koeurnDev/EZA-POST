// ============================================================
// 🧠 MongoDB Connection Configuration (mongkul DB)
// ============================================================

const mongoose = require("mongoose");

const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/mongkul";

// Connection options
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI, options);
        console.log(`✅ Connected to MongoDB database: mongkul`);
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
        // Don't exit process, allow retry
        setTimeout(connectDB, 5000);
    }
};

// Connection event handlers
mongoose.connection.on("connected", () => {
    console.log("🔗 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
    await mongoose.connection.close();
    console.log("📁 MongoDB connection closed (SIGINT)");
    process.exit(0);
});

module.exports = { connectDB, mongoose };
