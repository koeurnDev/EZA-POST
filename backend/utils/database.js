// ============================================================
// 🧠 database.js — MongoDB Handler (KR_POST)
// ============================================================

const User = require("../models/User");
const Post = require("../models/Post");

// ============================================================
// 👤 USERS
// ============================================================
async function createUser({ id, email, password, name }) {
  const user = await User.create({ id, email, password, name });
  return { id: user.id, email: user.email, name: user.name };
}

async function getUserByEmail(email) {
  return await User.findOne({ email });
}

async function getUserById(id) {
  return await User.findOne({ id }).select("id email name createdAt");
}

async function updateUserLastLogin(userId) {
  await User.updateOne({ id: userId }, { last_login: new Date() });
}

// ============================================================
// 📹 POSTS
// ============================================================
async function createPost({ id, userId, videoUrl, caption, accounts, scheduledTime }) {
  const post = await Post.create({
    id,
    user_id: userId,
    video_url: videoUrl,
    caption,
    accounts,
    scheduled_time: scheduledTime,
    status: "scheduled",
  });
  return { id: post.id, user_id: post.user_id, video_url: post.video_url };
}

async function getUserPosts(userId) {
  const posts = await Post.find({ user_id: userId }).sort({ createdAt: -1 });
  return posts.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    video_url: p.video_url,
    caption: p.caption,
    accounts: p.accounts,
    status: p.status,
    scheduled_time: p.scheduled_time,
    created_at: p.createdAt,
    posted_at: p.posted_at,
  }));
}

async function updatePostStatus(postId, status) {
  await Post.updateOne({ id: postId }, { status });
}

async function deletePost(postId) {
  await Post.deleteOne({ id: postId });
}

// ============================================================
// 🔑 SESSIONS (Handled by connect-mongo)
// ============================================================
// Sessions are now handled automatically by connect-mongo
// No need for manual session management

// ============================================================
// 💾 BACKUP & MAINTENANCE
// ============================================================
function backupDatabase() {
  console.log("⚠️ MongoDB backup should be handled via mongodump or Atlas backups");
}

// ============================================================
// 📦 Exports
// ============================================================
module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUserLastLogin,
  createPost,
  getUserPosts,
  updatePostStatus,
  deletePost,
  backupDatabase,
};
