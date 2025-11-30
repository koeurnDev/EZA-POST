const mongoose = require("mongoose");

const RepliedCommentSchema = new mongoose.Schema({
    commentId: { type: String, required: true, unique: true },
    postId: { type: String, required: true },
    repliedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("RepliedComment", RepliedCommentSchema);
