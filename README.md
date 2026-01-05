# EZA-POST - Social Media Automation Platform

## 🚀 Project Overview
EZA-POST is a comprehensive social media management tool designed to automate posting, scheduling, and engagement for Facebook Pages. It features TikTok video integration, Cloudinary media management, and an intelligent Auto-Reply bot.

## ✅ Verified Features

### 1️⃣ User Input & Media
- **TikTok Integration**: Paste TikTok URLs to auto-load videos without watermarks.
- **Direct Uploads**: Drag-and-drop video uploads (stored in Cloudinary).
- **Post Composer**: Full support for captions, page selection, and scheduling.

### 2️⃣ Backend Processing
- **Cloudinary Storage**: Secure, optimized storage for all media assets.
- **Database**: MongoDB stores user data, page tokens, and scheduled posts.
- **Security**: Temp files are auto-deleted after processing.

### ☁️ Cloudinary Integration Advantages
- **Scalability**: No server disk limitations; media is hosted in the cloud.
- **Transformations**: On-the-fly video/image processing (1:1 padding) without heavy backend FFmpeg.
- **Performance**: Fast preview delivery via global CDN.
- **Lifecycle Management**: Easy to manage deletes, updates, and auto-comments via `public_id`.
- **Concurrency**: Supports multiple concurrent post uploads without server strain.

### 3️⃣ Posting Workflow
- **Immediate Posting**: Instant publishing to selected Facebook Pages.
- **Scheduling**: Background scheduler runs every minute to process due posts.
- **Reliability**: Automatic retries and error logging.

### 4️⃣ Real-Time Feedback
- **Dashboard**: Auto-refreshes every 10 seconds to show live post status.
- **Notifications**: Toast messages for success, errors, and loading states.
- **Visuals**: Status badges and page avatars for better UX.

### 5️⃣ Auto-Reply Bot 🤖
- **Real-Time Detection**: Webhooks capture comments instantly.
- **Smart Queue**: Replies are queued with a 1-2 minute random delay to mimic human behavior.
- **Rules Engine**: Keyword matching (Exact/Contains) and "All Posts" fallback.
- **AI Integration**: Auto-generate reply rules using AI.

### 6️⃣ Auto-Boost Posts 🚀
- **Viral Detection**: AI-powered viral score calculation (0-100) for all published posts.
- **Smart Recommendations**: Automatic budget recommendations based on post performance.
- **One-Click Boosting**: Create Facebook ad campaigns with a single click.
- **Audience Targeting**: Configure age, gender, location, and interests.
- **Campaign Management**: Real-time monitoring of spend, impressions, clicks, and CTR.
- **Auto-Sync**: Metrics update every 15 minutes, campaign performance every 30 minutes.

## 🛠️ Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Services**: Cloudinary (Media), Facebook Graph API (Social), Facebook Marketing API (Ads)
- **Deployment**: Render (Web Service)

## 📂 Project Structure
- `/backend`: API server, scheduler, and bot engine.
- `/frontend`: React application and UI components.

## 🚀 Deployment
The project is configured for deployment on **Render**.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### 📋 Deployment Checklist
Ensure the following Environment Variables are set on Render:
- `JWT_SECRET`: Secure random string.
- `CLOUDINARY_CLOUD_NAME`: Your Cloud Name.
- `CLOUDINARY_API_KEY`: Your API Key.
- `CLOUDINARY_API_SECRET`: Your API Secret.
- `FB_VERIFY_TOKEN`: Token for Facebook Webhooks.
- `FB_AD_ACCOUNT_ID`: Facebook Ad Account ID (for Auto-Boost).
- `FB_APP_SECRET`: Facebook App Secret (for Auto-Boost).

## ⚠️ Considerations & Best Practices
- **Rate Limits**: The Auto-Reply bot uses random delays (1-2 mins) to avoid Facebook spam filters. Monitor logs for 429 errors.
- **Error Handling**: All API failures (Cloudinary, Facebook) trigger UI toasts. Check browser console for detailed logs.
- **Mobile**: Dashboard is responsive, but ensure video playback works on older mobile browsers.
- **Monitoring**: Regularly check Render logs for `[Scheduler]` and `[Bot]` activity to ensure background jobs are running.
- **Auto-Boost**: Requires Facebook Marketing API approval and `ads_management` permission. See implementation plan for setup.

## 🛠️ Common Issues & Troubleshooting
### 1️⃣ Stale JWT / Cookies
- **Symptoms**: Page selection appears to save but changes don't persist; dashboard doesn't refresh.
- **Solution**: Clear browser cookies for your domain, then log out and log back in to generate a fresh JWT.

### 2️⃣ Facebook Permissions
Ensure the Facebook App is **Live** and has these scopes:
- `pages_manage_metadata`
- `pages_read_engagement`
- `pages_messaging`
- `pages_manage_posts`
- `ads_management` (for Auto-Boost feature)

*Missing any of these can prevent page selection and auto-replies from working.*

### 3️⃣ Backend / Database
- **MongoDB**: User must have write access to update `connectedPages`.
- **JWT_SECRET**: Must match between the frontend and backend; otherwise token validation will fail.

### 4️⃣ Deployment & Environment Variables
- **CLOUDINARY**: Keys must be correct to upload media.
- **FB_VERIFY_TOKEN**: Should be set for webhooks.
- **FB_AD_ACCOUNT_ID**: Required for Auto-Boost feature.
- **Verify**: Check all environment variables on Render before deploying.

## 🔮 Future Roadmap
- **Analytics Dashboard**: Engagement tracking for posts and auto-replies. ✅ (Implemented)
- **Auto-Boost Posts**: Identify viral content and promote with one-click ad campaigns. ✅ (Implemented)
- **Multi-Page Posting**: Post to multiple pages simultaneously.
- **Instagram Integration**: Expand platform coverage.
- **Onboarding**: Guided setup for new users.
- **2FA**: Two-factor authentication for admins.
- **Advanced Boost Targeting**: Custom audiences, lookalike audiences, A/B testing.
