import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ShieldCheck, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

export default function PrivacyPolicy() {
  const [searchParams] = useSearchParams();
  const deletionCode = searchParams.get("deletion_code");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft size={14} />
            <span>ត្រឡប់ទៅ EZA-POST</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/terms"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              Terms of Service
            </Link>
            <span>•</span>
            <Link
              to="/data-deletion"
              className="text-xs font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 font-bold"
            >
              Data Deletion
            </Link>
          </div>
        </div>

        {deletionCode && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3">
            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={18} />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold text-emerald-700 dark:text-emerald-300 font-khmer">
                សំណើលុបទិន្នន័យ Facebook ត្រូវបានបញ្ជាក់ជោគជ័យ
              </p>
              <p className="text-emerald-800/80 dark:text-emerald-200/80">
                Facebook Data Deletion Confirmation Code: <strong className="font-mono">{deletionCode}</strong>. All associated Facebook Page tokens and page connections have been removed from EZA-POST.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-khmer">គោលការណ៍ឯកជនភាព — Privacy Policy</h1>
              <p className="text-xs text-slate-500">EZA-POST Social Media Automation Platform • Updated 2026</p>
            </div>
          </div>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              1. Information We Collect / ព័ត៌មានដែលយើងប្រមូល
            </h2>
            <p>
              When you sign in to EZA-POST or connect your Facebook Pages via official Meta OAuth, we store only the information required to operate your account and publish posts you explicitly schedule:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account email, display name, and authentication identifiers (Email, Google, Telegram, or Facebook ID).</li>
              <li>Connected Facebook Page IDs, Page names, profile pictures, and AES-256-CBC encrypted Page Access Tokens.</li>
              <li>Media files (videos, Reels, images) and captions uploaded by you for publishing or scheduling.</li>
            </ul>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              2. How We Use Facebook Permissions / ការប្រើប្រាស់សិទ្ធិ Facebook
            </h2>
            <p>
              EZA-POST uses Meta Graph API permissions (such as <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">pages_show_list</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">pages_manage_posts</code>, <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">publish_video</code>, and <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">pages_read_engagement</code>) strictly to list your Pages, publish scheduled videos/Reels/photos on your behalf, and display recent post insights. We never sell or share your tokens or personal data with third parties.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 size={15} className="text-rose-500" />
              <span>3. Data Deletion Instructions / ការលុបទិន្នន័យចេញពីប្រព័ន្ធ</span>
            </h2>
            <p>
              You can disconnect and delete all your stored Facebook tokens and Page connections at any time using either method:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>In EZA-POST: Go to <strong>Settings / Connections</strong> and disconnect your Facebook account.</li>
              <li>In Facebook: Go to <strong>Settings &amp; Privacy → Settings → Business Integrations / Apps and Websites</strong>, select <strong>EZA-POST</strong>, and click <strong>Remove</strong>. Meta automatically notifies our deletion endpoint (<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">/api/auth/facebook/data-deletion</code>) to purge your tokens immediately.</li>
              <li>Official Instructions: You can review our full step-by-step instructions or submit an email request on our <Link to="/data-deletion" className="font-bold text-blue-600 dark:text-blue-400 hover:underline">User Data Deletion Instructions Page</Link>.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
