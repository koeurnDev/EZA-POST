import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function BookmarkletInstructions() {
    const [copied, setCopied] = useState(false);

    const bookmarkletCode = `javascript:(function(){const u=prompt('Enter TikTok username:');if(!u)return;const getCookies=()=>{const c=[];document.cookie.split(';').forEach(cookie=>{const[name,value]=cookie.trim().split('=');if(name&&value){c.push({name,value,domain:'.tiktok.com',path:'/',expires:Math.floor(Date.now()/1000)+86400*30})}});return c};const cookies=getCookies();if(cookies.length===0){alert('No cookies found! Please login to TikTok first.');return}fetch('${window.location.origin}/api/boost-accounts/import-cookies',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:u,cookies})}).then(r=>r.json()).then(d=>{if(d.success){alert('✅ Cookies exported successfully for '+u+'!')}else{alert('❌ Error: '+d.error)}}).catch(e=>alert('❌ Failed: '+e.message))})();`;

    const copyBookmarklet = () => {
        navigator.clipboard.writeText(bookmarkletCode);
        setCopied(true);
        toast.success("Bookmarklet copied!");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                🔖 Quick Export Bookmarklet
            </h3>

            <div className="space-y-4">
                {/* Instructions */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">📝 Setup (One-time):</p>
                    <ol className="text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside space-y-2">
                        <li>Click the button below to copy the bookmarklet</li>
                        <li>Create a new bookmark in your browser (Ctrl+D)</li>
                        <li>Name it "Export TikTok Cookies"</li>
                        <li>Paste the copied code as the URL</li>
                        <li>Save the bookmark</li>
                    </ol>
                </div>

                {/* Copy Button */}
                <button
                    onClick={copyBookmarklet}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                    {copied ? (
                        <>
                            <Check size={20} />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy size={20} />
                            Copy Bookmarklet Code
                        </>
                    )}
                </button>

                {/* Usage */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">🚀 How to Use:</p>
                    <ol className="text-sm text-gray-700 dark:text-gray-300 list-decimal list-inside space-y-2">
                        <li>Login to TikTok in your browser</li>
                        <li>Click the "Export TikTok Cookies" bookmark</li>
                        <li>Enter your TikTok username when prompted</li>
                        <li>Done! Cookies are automatically sent to your account</li>
                    </ol>
                </div>

                {/* Benefits */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-800 dark:text-green-200">✅ One-Click Export</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-800 dark:text-green-200">✅ No Extension Needed</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-800 dark:text-green-200">✅ Works on Any Browser</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                        <p className="text-xs font-medium text-green-800 dark:text-green-200">✅ Auto-Update Account</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
