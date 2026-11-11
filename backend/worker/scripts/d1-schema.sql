-- EZA POST Cloudflare D1 Database Schema
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT DEFAULT 'User',
  plan TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  avatar TEXT,
  coverImage TEXT,
  facebookId TEXT UNIQUE,
  facebookName TEXT,
  facebookAccessToken TEXT,
  facebookTokenExpiresAt TEXT,
  googleId TEXT UNIQUE,
  googleEmail TEXT,
  telegramId TEXT UNIQUE,
  telegramUsername TEXT,
  resetPasswordToken TEXT UNIQUE,
  resetPasswordExpires TEXT,
  twoFactorSecret TEXT,
  twoFactorEnabled INTEGER DEFAULT 0,
  twoFactorVerified INTEGER DEFAULT 0,
  credits INTEGER DEFAULT 100,
  lastLogin TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facebook_pages (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  accessToken TEXT NOT NULL,
  picture TEXT,
  category TEXT,
  isConnected INTEGER DEFAULT 1,
  isSelected INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  content TEXT,
  mediaUrls TEXT,
  mediaType TEXT,
  status TEXT DEFAULT 'draft',
  scheduledFor TEXT,
  publishedAt TEXT,
  error TEXT,
  platform TEXT DEFAULT 'facebook',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_rules (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  trigger TEXT NOT NULL,
  response TEXT NOT NULL,
  type TEXT DEFAULT 'KEYWORD',
  scope TEXT DEFAULT 'ALL',
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
