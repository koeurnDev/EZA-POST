# EZA-POST - Social Media Automation Platform

## 🚀 Project Overview
EZA-POST is a comprehensive social media management tool designed to automate posting, scheduling, and engagement for Facebook Pages. It features TikTok video integration, Cloudinary media management, and an intelligent Auto-Reply bot.

## ✅ Verified Features

### 1️⃣ User Input & Media
- **TikTok Integration**: Paste a TikTok URL for best-effort local extraction and download. No TikWM downloader/trends API is used; direct media URLs you have permission to download are also supported.
- **Direct Uploads**: Drag-and-drop video uploads (stored in Cloudinary).
- **Post Composer**: Full support for captions, page selection, and scheduling.

### 2️⃣ Backend Processing
- **Cloudinary Storage**: Secure, optimized storage for all media assets.
- **Database**: PostgreSQL (Prisma) stores user data, page tokens, and scheduled posts.
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
- **Frontend**: React, Vite, TailwindCSS, Framer Motion (Cloudflare Pages)
- **Backend**: Hono on Cloudflare Workers (API proxy during migration), legacy Node.js/Express API, PostgreSQL (Prisma)
- **Services**: Cloudinary (Media), Facebook Graph API (Social), Facebook Marketing API (Ads)
- **Deployment**: Cloudflare Pages (frontend) and Cloudflare Workers (Hono API migration)

## 📂 Project Structure
- `/backend`: API server, scheduler, and bot engine (PostgreSQL/Prisma).
- `/frontend`: React application and UI components.

## 🚀 Deployment

The frontend is deployed on Cloudflare Pages, with a Hono API Worker. The health endpoints (`/api/health` and `/api/system/health`) are served natively by Hono; other `/api/*` and `/uploads/*` requests are forwarded to the existing legacy Node.js backend until each route is migrated. Prisma/PostgreSQL, remaining Express routes, and background jobs still require that Node.js backend during this migration phase.

### Cloudflare API Worker

1. From `backend/worker`, run `npm install`.
2. Create `backend/worker/.dev.vars` based on `.dev.vars.example`; set `BACKEND_ORIGIN` to the existing legacy backend URL, `JWT_SECRET` to the same secret used by that backend, `DATABASE_URL` for local development, the Cloudinary credentials, and the Facebook app credentials. Set `FRONTEND_URL` to the Pages site origin and `FACEBOOK_REDIRECT_URI` to that origin plus `/api/auth/facebook/callback`; register that exact URL in the Facebook app. Configure `RESEND_API_KEY` and a verified sender in `EMAIL_FROM` for password-reset mail. Do not commit `.dev.vars`.
3. Apply `backend/prisma/migrations/20261004_worker_migration_fields/migration.sql` to the PostgreSQL database before deploying routes that use the new fields. Run `npm run dev` to test locally, then run `npm run deploy` to publish the Worker. Configure production `BACKEND_ORIGIN`, `JWT_SECRET`, `FB_APP_ID`, `FB_APP_SECRET`, `FRONTEND_URL`, `FACEBOOK_REDIRECT_URI`, `RESEND_API_KEY`, `EMAIL_FROM`, and Cloudinary credentials using Wrangler secrets/vars; also configure `ENCRYPTION_KEY` to match the legacy backend if existing 2FA secrets use it. Bind a Cloudflare Hyperdrive connection as `HYPERDRIVE` for PostgreSQL access from Workers.
4. Confirm `https://<worker-name>.<account>.workers.dev/healthz` returns `{"status":"ok","runtime":"cloudflare-workers"}`.

The production Worker currently has no Cron Trigger. Keep scheduled publishing disabled until the legacy scheduler is confirmed disabled; only then add the Worker Cron Trigger described below.

The Worker builds its Prisma Client from the shared `backend/prisma/schema.prisma`. Native Hono + Prisma auth routes include `/api/auth/login`, `/api/auth/login/2fa`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/status`, Facebook OAuth start/callback/disconnect, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/2fa/{setup,verify,disable}`. Facebook OAuth state is bound to a short-lived HttpOnly cookie; set `FACEBOOK_REDIRECT_URI` to the Pages same-origin proxy callback URL and configure that exact URL in the Facebook app. Password reset uses Resend; configure `RESEND_API_KEY` and a verified `EMAIL_FROM`. Reset tokens are stored hashed and expire after one hour. Native user routes include `/api/user/pages` (list, toggle and settings), `/api/user/update`, `/api/user/stats`, and `/api/user/connections`. Native upload routes include `/api/upload/avatar` (2 MiB maximum) and `/api/upload/cover` (5 MiB maximum), which upload directly to Cloudinary. Native post routes include `POST /api/posts` (single image/video or text posts), `POST /api/posts/mixed-carousel`, `GET /api/posts/queue`, `DELETE /api/posts/queue/:id`, `POST /api/posts/bulk`, and `POST /api/posts/schedule`. The authenticated Worker TikTok lookup extracts metadata and a candidate media address from the public page's embedded JSON; `GET /api/tools/tiktok/download` streams media only from allowlisted TikTok media hosts, with redirect validation and a 100 MiB limit. It does not use yt-dlp, third-party downloader services, login cookies, or protection bypasses. TikTok may deny access to a media URL; the Worker reports that denial and the UI retains the TikTok player/open link. Download only content you have permission to save. Profile/bulk operations, conversion, and other TikTok tools still require the legacy Node.js backend. Mixed carousel files are uploaded to Cloudinary and queued in PostgreSQL for Worker processing. The Worker Cron Trigger runs every minute to publish due scheduled video, image, text, and photo/mixed-carousel posts; the processor claims jobs safely, retries failures up to three times, records per-page publication results, and expires posts overdue by 48 hours. Scheduled multipart media is limited to 90 MiB total and 10 files. The FFmpeg transformations and TikTok auto-downloader still use the legacy backend. TikTok extraction is best effort using the locally run extractor and local media processing; all TikTok download routes now use local yt-dlp only, with no third-party downloader API fallbacks. TikTok downloader inputs are restricted to HTTPS TikTok pages and known TikTok media hosts, temporary local stream paths must remain inside the video temp directory, individual videos are capped at 100 MiB, and TikTok tool requests are rate-limited. TikTok trends, trending audio, and the Viral Finder feed are unavailable until a supported data source is integrated. The 2FA code uses Web Crypto while preserving the existing AES-GCM database format and TOTP defaults. Facebook access tokens are encrypted with the legacy AES-CBC format so the existing backend can continue reading them. If a legacy Express session cookie is present, logout is still forwarded to the legacy backend so the server-side session can be destroyed. The Worker registration route does not send the legacy SMTP welcome email. Keep `JWT_SECRET` identical between Worker and the legacy backend while both issue and verify tokens; set `ENCRYPTION_KEY` to the same value used by the legacy backend when it is configured, so existing 2FA and Facebook secrets remain decryptable. Apply the additive SQL migration before deploying Worker routes that use the new fields; bind Cloudflare Hyperdrive to `HYPERDRIVE` before using native database-backed routes in production. Disable the legacy scheduled-post scheduler before enabling the Worker Cron Trigger, to prevent two schedulers from publishing the same posts.

The Worker also serves dashboard analytics, bot rule CRUD and AI suggestions, per-user/per-page bot settings, monitored-post CRUD, reply history, Facebook recent-post insights, and read-only credit balance/package/transaction endpoints natively. Configure `GEMINI_API_KEY` as a Worker secret to enable AI suggestions. Avatar, cover, bot-reply image, and thumbnail uploads are handled directly by the Worker and Cloudinary. Cloudinary video and thumbnail library listing/deletion is also native, with deletion restricted to their managed folders. Video uploads remain on the legacy backend because its 100 MB per-file and 50-file bulk limits can exceed Worker request-size limits. Analytics uses scheduled posts and post metrics from the shared Prisma schema. Credit mutation and package seeding remain on the legacy backend. YouTube extraction and FFmpeg processing stay on the legacy Node.js backend; the Worker proxies those requests without rewriting their streamed responses. YouTube requests are restricted to HTTPS YouTube hosts and supported formats/qualities, with heavy routes rate-limited. Facebook downloading also stays on the legacy backend with local yt-dlp; the Worker proxies it, and Facebook URLs are validated against HTTPS platform hosts before extraction. Arbitrary direct media URLs and browser-only `blob:` URLs are not accepted by that server-side downloader. Instagram downloading also stays on local yt-dlp; only HTTPS Instagram post/reel/IGTV permalinks are accepted, and its image fallback is limited to HTTPS Instagram/Facebook media CDNs and 25 MiB per image. Instagram downloader requests are rate-limited, and temporary Instagram media is included in backend cleanup. Pinterest downloads use local yt-dlp with HTTPS Pinterest/`pin.it` input URLs; temporary outputs are capped at 50 MiB and cleaned up, while its optional authenticated media proxy only serves HTTPS `pinimg.com` URLs. Pinterest downloader requests are rate-limited. Cloudflare Pages proxies `/uploads/*` through the API Worker to legacy temporary files. The legacy build pins yt-dlp to `2026.08.19` (Python package version `2026.8.19`), verifies the downloaded release binary by SHA-256, and checks the binary version before completing. The Facebook webhook and bot reply-processing engine continue running there.

Downloader note: Threads extraction remains on the legacy Node.js backend and uses local yt-dlp plus public-page metadata parsing. Accepted input links must use HTTPS on `threads.net` or `threads.com`; media proxy downloads require authentication and are restricted to HTTPS Threads/Meta CDN hosts, media content types, and a 100 MiB response limit. Threads download routes share the legacy heavy-tool rate limit. CapCut extraction and downloads also use local yt-dlp on the legacy backend; inputs must be HTTPS CapCut URLs, downloads are capped at 100 MiB, temporary files are cleaned up, and tool requests are rate-limited.

Document conversion accepts PDF, DOC, DOCX, PPT, and PPTX uploads up to 25 MiB and only exposes supported source/target combinations. Temporary source and conversion files are removed after processing, and conversion requests use the heavy-tool rate limit. In production, documents are temporarily uploaded to Google Drive for conversion and then deleted; do not use this feature for documents that must remain exclusively on this server.

### Cloudflare Pages Frontend

1. Create a Pages project from this repository with root directory `frontend/frontend`, build command `npm run build`, and output directory `dist`.
2. Set the Pages environment variable `API_ORIGIN` to the deployed API Worker origin (for example, `https://eza-post-api.<account>.workers.dev`) for both production and preview deployments.
3. Set the Pages build environment variable `VITE_API_BASE_URL` to `/api`, redeploy the Pages project, and set the legacy backend's `FRONTEND_URL` to the Pages production origin so credentialed requests from the Pages Functions are accepted.
4. Pages Functions forward `/api/*` and `/uploads/*` to the Worker, allowing the frontend to use same-origin URLs while keeping the API Worker separate.

Keep the legacy Node.js backend deployed at `BACKEND_ORIGIN` until its remaining Express routes and background jobs have been migrated to Worker-compatible implementations. Choose a Node.js hosting provider for that service; this repository no longer contains a provider-specific deployment manifest.

### 📋 Deployment Checklist
Ensure the following environment variables are set on the legacy Node.js backend host:
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
- **Monitoring**: Regularly check backend logs for `[Scheduler]` and `[Bot]` activity to ensure background jobs are running.
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
- **PostgreSQL**: Ensure the database is running and accessible via the `DATABASE_URL`.
- **JWT_SECRET**: Must match between the frontend and backend; otherwise token validation will fail.

### 4️⃣ Deployment & Environment Variables
- **CLOUDINARY**: Keys must be correct to upload media.
- **FB_VERIFY_TOKEN**: Should be set for webhooks.
- **FB_AD_ACCOUNT_ID**: Required for Auto-Boost feature.
- **Verify**: Check all backend and Worker environment variables before deploying.

## 🔮 Future Roadmap
- **Analytics Dashboard**: Engagement tracking for posts and auto-replies. ✅ (Implemented)
- **Auto-Boost Posts**: Identify viral content and promote with one-click ad campaigns. ✅ (Implemented)
- **Multi-Page Posting**: Post to multiple pages simultaneously.
- **Instagram Integration**: Expand platform coverage.
- **Onboarding**: Guided setup for new users.
- **2FA**: Two-factor authentication for admins.
- **Advanced Boost Targeting**: Custom audiences, lookalike audiences, A/B testing.
