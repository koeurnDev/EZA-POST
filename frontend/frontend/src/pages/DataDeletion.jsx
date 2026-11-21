// ============================================================
// 🗑️ DataDeletion.jsx - User Data Deletion Instructions
// Moneaa (formerly EZA) - Compliant with Meta Platform Terms
// ============================================================

import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Trash2, ArrowLeft, CheckCircle2, ShieldAlert, Mail, ExternalLink, Globe, FileText, Lock } from "lucide-react";

export default function DataDeletion() {
  const [searchParams] = useSearchParams();
  const deletionCode = searchParams.get("deletion_code") || searchParams.get("code") || searchParams.get("id");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-slate-100 py-10 px-4 font-['Kantumruy_Pro']">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* 🧭 Top Navigation */}
        <div className="flex items-center justify-between text-xs font-semibold">
          <Link
            to="/welcome"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft size={14} />
            <span>ត្រឡប់ទៅ Moneaa</span>
          </Link>

          <div className="flex items-center gap-4 text-slate-500">
            <Link to="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

        {/* 🟢 Confirmation Banner (If redirected from Meta with deletion code) */}
        {deletionCode && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-3 shadow-sm">
            <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div className="text-xs sm:text-sm space-y-1">
              <p className="font-bold text-emerald-700 dark:text-emerald-300">
                សំណើលុបទិន្នន័យ Facebook ត្រូវបានទទួលជោគជ័យ
              </p>
              <p className="text-emerald-800/80 dark:text-emerald-200/80">
                Confirmation Code: <strong className="font-mono bg-emerald-500/20 px-1.5 py-0.5 rounded text-emerald-300">{deletionCode}</strong>.
                All associated Facebook tokens, page connections, and stored data have been queued for permanent deletion.
              </p>
            </div>
          </div>
        )}

        {/* 📄 Main Content Card */}
        <div className="bg-white dark:bg-[#10131b] border border-slate-200 dark:border-white/8 rounded-3xl p-6 sm:p-10 shadow-xl space-y-8">

          {/* Header Title */}
          <div className="flex items-center gap-3.5 border-b border-slate-100 dark:border-white/5 pb-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <Trash2 size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                EZA / Moneaa – User Data Deletion Instructions
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ការណែនាំអំពីការស្នើសុំលុបទិន្នន័យអ្នកប្រើប្រាស់ • Updated 2026
              </p>
            </div>
          </div>

          {/* Intro Statement */}
          <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            <p>
              <strong>EZA / Moneaa</strong> respects your privacy and your fundamental right to request the deletion of your personal data. In compliance with the <strong>Meta Platform Terms</strong> and international privacy regulations, this page details how you can request the permanent deletion of any data associated with your account, including information collected through Facebook Login and Meta Graph APIs.
            </p>
          </div>

          {/* Section 1: How to Request Data Deletion */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail size={16} className="text-blue-500" />
              <span>1. How to Request Data Deletion / របៀបស្នើសុំលុបទិន្នន័យ</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              To request the deletion of your account and any Facebook-related data stored by EZA / Moneaa, please follow these steps:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>
                Send an email directly to our support team at:{" "}
                <a
                  href="mailto:support@moneaa.site?subject=EZA%20Data%20Deletion%20Request"
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  support@moneaa.site
                </a>{" "}
                (Alternate:{" "}
                <a
                  href="mailto:koeurnseab630@gmail.com?subject=EZA%20Data%20Deletion%20Request"
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  koeurnseab630@gmail.com
                </a>
                )
              </li>
              <li>
                Use the subject line:{" "}
                <strong className="font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  "EZA Data Deletion Request"
                </strong>{" "}
                or{" "}
                <strong className="font-mono bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  "Moneaa Data Deletion Request"
                </strong>
                .
              </li>
              <li>
                Include the <strong>email address</strong> associated with your Moneaa / EZA account and, if applicable, your Facebook User ID or connected Page name.
              </li>
            </ol>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 mt-2">
              <Lock size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Security Note:</strong> We may ask you to verify ownership by confirming a one-time link sent to your registered email. We will <strong>NEVER</strong> ask for your Facebook password, personal credentials, or access tokens.
              </span>
            </div>
          </section>

          {/* Section 2: Data to Be Deleted */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Trash2 size={16} className="text-rose-500" />
              <span>2. Data to Be Deleted / ទិន្នន័យដែលនឹងត្រូវលុប</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Upon verification of your request, we permanently delete all applicable records from our databases and storage, including:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>Facebook user information (display name, Facebook User ID, email identifier).</li>
              <li>All encrypted Facebook Access Tokens and refresh tokens stored in our database.</li>
              <li>Connected Facebook Page profiles, Page IDs, and automated publishing permissions.</li>
              <li>Scheduled posts, uploaded media assets (videos, photos, captions), and queued drafts.</li>
              <li>Any other personal data or identifiers collected through Meta APIs.</li>
            </ul>
          </section>

          {/* Section 3: Remove Facebook Access Directly */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert size={16} className="text-indigo-400" />
              <span>3. How to Remove Facebook Access / របៀបផ្ដាច់សិទ្ធិពីក្នុង Facebook</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              You can also revoke EZA / Moneaa's access directly from your Facebook settings at any time:
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>Log in to your Facebook account on web or mobile.</li>
              <li>
                Navigate to <strong>Settings &amp; Privacy → Settings</strong>.
              </li>
              <li>
                Scroll to <strong>Apps and Websites</strong> (or <strong>Business Integrations</strong>).
              </li>
              <li>
                Find <strong>EZA-POST</strong> or <strong>Moneaa</strong> in the list.
              </li>
              <li>
                Click <strong>Remove</strong> to revoke all active permissions.
              </li>
            </ol>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 italic">
              * Note: Removing access stops future data synchronization. To permanently purge existing data already stored in EZA / Moneaa, please email us as described in Step 1.
            </p>
          </section>

          {/* Section 4: Processing Requests */}
          <section className="space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText size={16} className="text-emerald-500" />
              <span>4. Processing Requests / រយៈពេលអនុវត្តសំណើ</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              We process verified deletion requests promptly, typically within <strong>24 to 72 business hours</strong>. Once your data has been completely erased from our servers, you will receive an official confirmation email. Information that must be retained by law (such as statutory billing records) may be excluded from immediate deletion.
            </p>
          </section>

          {/* Section 5: Contact Us */}
          <section className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              5. Contact Us / ទំនាក់ទំនងយើងខ្ញុំ
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">Support Email</span>
                <a
                  href="mailto:support@moneaa.site"
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                >
                  <Mail size={14} />
                  <span>support@moneaa.site</span>
                </a>
                <span className="text-[10px] text-slate-500">Alt: koeurnseab630@gmail.com</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-400 font-bold block">Official Website</span>
                <a
                  href="https://moneaa.site"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                >
                  <Globe size={14} />
                  <span>https://moneaa.site</span>
                  <ExternalLink size={12} />
                </a>
                <span className="text-[10px] text-slate-500">Moneaa Platform (EZA-POST)</span>
              </div>
            </div>
          </section>

        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 py-4">
          <p>© 2026 Moneaa (formerly EZA). All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
