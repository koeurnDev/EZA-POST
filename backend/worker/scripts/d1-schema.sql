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
  totalCreditsSpent INTEGER DEFAULT 0,
  totalCreditsPurchased INTEGER DEFAULT 0,
  pageSettings TEXT DEFAULT '[]',
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
  enableBot INTEGER DEFAULT 0,
  enableSchedule INTEGER DEFAULT 1,
  enableInbox INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  content TEXT,
  caption TEXT,
  mediaUrls TEXT,
  mediaFiles TEXT DEFAULT '[]',
  mediaType TEXT DEFAULT 'video',
  postType TEXT DEFAULT 'video',
  videoUrl TEXT,
  thumbnailUrl TEXT,
  carouselCards TEXT DEFAULT '[]',
  accounts TEXT DEFAULT '[]',
  publishedIds TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  scheduledFor TEXT,
  scheduleTime TEXT,
  publishedAt TEXT,
  postedAt TEXT,
  attempts INTEGER DEFAULT 0,
  error TEXT,
  lastError TEXT,
  platform TEXT DEFAULT 'facebook',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_rules (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  keyword TEXT,
  trigger TEXT,
  reply TEXT,
  response TEXT,
  ruleType TEXT DEFAULT 'KEYWORD',
  type TEXT DEFAULT 'KEYWORD',
  scope TEXT DEFAULT 'ALL',
  enabled INTEGER DEFAULT 1,
  isActive INTEGER DEFAULT 1,
  postId TEXT,
  attachmentUrl TEXT,
  dmReply TEXT,
  enableDm INTEGER DEFAULT 0,
  pageId TEXT,
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

CREATE TABLE IF NOT EXISTS bio_pages (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  businessName TEXT NOT NULL,
  category TEXT,
  bio TEXT,
  avatarUrl TEXT,
  coverUrl TEXT,
  theme TEXT DEFAULT 'dark',
  contacts TEXT DEFAULT '{}',
  businessHours TEXT DEFAULT '{}',
  googleMapsUrl TEXT,
  address TEXT,
  youtubeUrl TEXT,
  khqrString TEXT,
  khqrImage TEXT,
  khqrBankName TEXT,
  khqrAccountName TEXT,
  products TEXT DEFAULT '[]',
  views INTEGER DEFAULT 0,
  qrScans INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bio_pages_slug ON bio_pages(slug);
CREATE INDEX IF NOT EXISTS idx_bio_pages_user ON bio_pages(userId);
