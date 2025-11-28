// ============================================================
// 📅 Scheduled Post Model (Mongoose Schema)
// ============================================================

const mongoose = require("mongoose");

const scheduledPostSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        user_id: {
            type: String,
            required: true,
            ref: "User",
            index: true,
        },
        video_url: {
            type: String,
            required: true,
        },
        thumbnail_url: {
            type: String, // ✅ Added thumbnail support
        },
        caption: {
            type: String,
            default: "",
        },
        accounts: {
            type: [String],
            default: [],
        },
        status: {
            type: String,
            enum: ["scheduled", "processing", "completed", "failed", "retry"],
            default: "scheduled",
            index: true,
        },
        schedule_time: {
            type: Date,
            required: true,
            index: true,
        },
        posted_at: {
            type: Date,
        },
        attempts: {
            type: Number,
            default: 0,
        },
        publishedIds: [
            {
                accountId: String,
                postId: String,
            }
        ],
    },
    {
        timestamps: true,
        collection: "scheduled_posts",
    }
);

// Indexes for scheduler queries
scheduledPostSchema.index({ status: 1, schedule_time: 1 });
scheduledPostSchema.index({ createdAt: 1 });

const ScheduledPost = mongoose.model("ScheduledPost", scheduledPostSchema);

module.exports = ScheduledPost;
