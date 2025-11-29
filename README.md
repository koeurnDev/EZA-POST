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

### 6️⃣ Authentication & Security 🔐
- **Facebook Login**: Secure OAuth flow with requested permissions.
- **Long-Lived Tokens**: Automatic exchange for ~60-day tokens.
- **Auto-Refresh**: Daily background job refreshes tokens automatically—users never need to reconnect.
- **JWT**: Secure session management with encrypted cookies.

## 🛠️ Tech Stack
- **Frontend**: React, Vite, TailwindCSS, Framer Motion
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Services**: Cloudinary (Media), Facebook Graph API (Social)
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

## ⚠️ Considerations & Best Practices
- **Rate Limits**: The Auto-Reply bot uses random delays (1-2 mins) to avoid Facebook spam filters. Monitor logs for 429 errors.
- **Error Handling**: All API failures (Cloudinary, Facebook) trigger UI toasts. Check browser console for detailed logs.
- **Mobile**: Dashboard is responsive, but ensure video playback works on older mobile browsers.
- **Monitoring**: Regularly check Render logs for `[Scheduler]` and `[Bot]` activity to ensure background jobs are running.

## 🛠️ Common Issues & Troubleshooting
### 1️⃣ Stale JWT / Cookies
- **Symptoms**: Page selection appears to save but changes don’t persist; dashboard doesn’t refresh.
- **Solution**: Clear browser cookies for your domain, then log out and log back in to generate a fresh JWT.

### 2️⃣ Facebook Permissions
Ensure the Facebook App is **Live** and has these scopes:
- `pages_manage_metadata`
- `pages_read_engagement`
- `pages_messaging`
- `pages_manage_posts`

*Missing any of these can prevent page selection and auto-replies from working.*

### 3️⃣ Backend / Database
- **MongoDB**: User must have write access to update `connectedPages`.
- **JWT_SECRET**: Must match between the frontend and backend; otherwise token validation will fail.

### 4️⃣ Deployment & Environment Variables
- **CLOUDINARY**: Keys must be correct to upload media.
- **FB_VERIFY_TOKEN**: Should be set for webhooks.
- **Verify**: Check all environment variables on Render before deploying.

## 🔮 Future Roadmap
- **Analytics Dashboard**: Engagement tracking for posts and auto-replies.
- **Multi-Page Posting**: Post to multiple pages simultaneously.
- **Instagram Integration**: Expand platform coverage.
- **Onboarding**: Guided setup for new users.
- **2FA**: Two-factor authentication for admins.
