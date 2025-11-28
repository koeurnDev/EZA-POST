import React from "react";
import { Clock, Trash2, AlertCircle, RefreshCw, Calendar, CheckCircle2 } from "lucide-react";
import Button from "./ui/Button";

const ScheduledPostList = ({ posts, onCancel, onRetry }) => {
    if (!posts || posts.length === 0) {
        return (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar size={32} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No scheduled posts</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Posts you schedule will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Post</th>
                            <th className="hidden md:table-cell px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pages</th>
                            <th className="hidden sm:table-cell px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {posts.map((post) => (
                            <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                {/* 🎥 Post Info */}
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 border border-gray-200 dark:border-gray-700">
                                            {post.thumbnailUrl ? (
                                                <img src={post.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                    <Calendar size={20} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 max-w-xs">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2" title={post.caption}>
                                                {post.caption || "No caption"}
                                            </p>
                                            {post.videoUrl && (
                                                <a href={post.videoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
                                                    View Video
                                                </a>
                                            )}
                                            {/* Mobile: Show Schedule Time if hidden column */}
                                            <div className="sm:hidden text-xs text-gray-500 mt-1">
                                                {new Date(post.scheduleTime).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* 📄 Pages (Hidden on Mobile) */}
                                <td className="hidden md:table-cell px-6 py-4">
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {post.accounts?.map((acc, i) => (
                                            <div
                                                key={i}
                                                className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600"
                                                title={acc.name}
                                            >
                                                {acc.name?.[0]}
                                            </div>
                                        ))}
                                        {post.accounts?.length > 3 && (
                                            <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                                                +{post.accounts.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </td>

                                {/* ⏰ Schedule Time (Hidden on Small Mobile) */}
                                <td className="hidden sm:table-cell px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <Clock size={16} className="text-gray-400" />
                                        {new Date(post.scheduleTime).toLocaleString(undefined, {
                                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                                        })}
                                    </div>
                                </td>

                                {/* 🟢 Status */}
                                <td className="px-6 py-4">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${post.status === "scheduled"
                                            ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
                                            : post.status === "processing"
                                                ? "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800"
                                                : post.status === "expired"
                                                    ? "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                                                    : "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                                            }`}
                                    >
                                        {post.status === "scheduled" && <Clock size={12} />}
                                        {post.status === "processing" && <RefreshCw size={12} className="animate-spin" />}
                                        {post.status === "expired" && <AlertCircle size={12} />}
                                        <span className="hidden sm:inline">{post.status.charAt(0).toUpperCase() + post.status.slice(1)}</span>
                                    </span>
                                </td>

                                {/* ⚙️ Actions */}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {post.status === "failed" && onRetry && (
                                            <button
                                                onClick={() => onRetry(post.id)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="Retry Post"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                        )}

                                        {(post.status === "scheduled" || post.status === "failed" || post.status === "expired") && (
                                            <button
                                                onClick={() => onCancel(post.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Cancel / Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScheduledPostList;
