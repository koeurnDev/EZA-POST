import React from "react";
import { Link } from "react-router-dom";
import { FileText, ArrowLeft } from "lucide-react";

export default function TermsOfService() {
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
          <Link
            to="/privacy"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Privacy Policy
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-khmer">លក្ខខណ្ឌប្រើប្រាស់ — Terms of Service</h1>
              <p className="text-xs text-slate-500">EZA-POST Social Media Automation Platform • Updated 2026</p>
            </div>
          </div>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              1. Acceptable Use
            </h2>
            <p>
              By using EZA-POST, you agree to comply with Meta Platform Terms, Community Standards, and applicable laws. You are solely responsible for the videos, images, captions, and automated replies published to Pages you manage.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              2. Account &amp; Page Ownership
            </h2>
            <p>
              You may only connect Facebook Pages for which you hold authorized administrative or content creation rights. EZA-POST automatically pauses scheduled publishing if Meta invalidates a token or flags a Page to protect your account standing.
            </p>
          </section>

          <section className="space-y-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              3. Service Availability
            </h2>
            <p>
              Publishing relies on third-party platform APIs (including Meta Graph API). We reserve the right to update supported formats and rate limits to remain compliant with platform policies.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
