// ============================================================
// 👤 User Model (Mongoose Schema)
// ============================================================

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            default: "User",
        },
        last_login: {
            type: Date,
        },
        facebookId: {
            type: String,
            unique: true,
            sparse: true, // Allows null/undefined values to not conflict
        },
        facebookAccessToken: {
            type: String,
        },
        facebookName: {
            type: String, // 👤 Store Facebook User Name
        },
        selectedPages: {
            type: [String], // 📋 Array of Page IDs that are "ON"
            default: [],
        },
        avatar: {
            type: String,
        },
        coverImage: {
            type: String,
        },
        role: {
            type: String,
            default: "user",
            enum: ["user", "admin"],
        },
        resetPasswordToken: {
            type: String,
        },
        resetPasswordExpires: {
            type: Date,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
        collection: "users",
    }
);

// Index for faster queries
// userSchema.index({ email: 1 }); // ❌ Removed duplicate (already in schema)
// userSchema.index({ id: 1 });    // ❌ Removed duplicate (already in schema)

const User = mongoose.model("User", userSchema);

module.exports = User;
