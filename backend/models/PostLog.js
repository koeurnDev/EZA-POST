const mongoose = require("mongoose");

const postLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    pageId: {
        type: String,
        required: true,
        index: true
    },
    fbPostId: {
        type: String,
        unique: true,
        sparse: true // Allow null/undefined if post failed
    },
    type: {
        type: String,
        enum: ["carousel", "video", "tiktok"],
        required: true
    },
    status: {
        type: String,
        enum: ["published", "scheduled", "failed", "processing"],
        default: "processing"
    },
    scheduledTime: {
        type: Date
    },
    cloudinaryVideoId: {
        type: String
    },
    cloudinaryImageIds: {
        type: [String],
        default: []
    },
    error: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("PostLog", postLogSchema);
