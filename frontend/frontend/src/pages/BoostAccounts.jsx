import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Users, Plus, Trash2, Check, X, Loader2, TestTube } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function BoostAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAccount, setNewAccount] = useState({
        username: '',
        password: '',
        dailyLimit: 25  // Reduced from 50 to 25 (more conservative)
    });
    const [testing, setTesting] = useState(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await api.get("/boost-accounts");
            if (res.data.success) {
                setAccounts(res.data.accounts);
            }
        } catch (err) {
            toast.error("Failed to load accounts");
        } finally {
            setLoading(false);
        }
    };

    const addAccount = async () => {
        if (!newAccount.username || !newAccount.password) {
            return toast.error("Username and password required");
        }

        setAdding(true);
        try {
            const res = await api.post("/boost-accounts", newAccount);
            if (res.data.success) {
                toast.success("Account added & auto-logged in!");
                setAccounts([...accounts, res.data.account]);
                setNewAccount({ username: '', password: '', dailyLimit: 50 });
                setShowAddForm(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to add account");
        } finally {
            setAdding(false);
        }
    };

    const deleteAccount = async (id) => {
        if (!confirm("Delete this account?")) return;

        try {
            const res = await api.delete(`/boost-accounts/${id}`);
            if (res.data.success) {
                toast.success("Account deleted");
                setAccounts(accounts.filter(a => a._id !== id));
            }
        } catch (err) {
            toast.error("Failed to delete account");
        }
    };

    const testLogin = async (id) => {
        setTesting(id);
        try {
            const res = await api.post(`/boost-accounts/${id}/test`);
            if (res.data.success) {
                toast.success("Login successful! ✅");
                fetchAccounts();
            } else {
                toast.error("Login failed ❌");
            }
        } catch (err) {
            toast.error("Test failed");
        } finally {
            setTesting(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'banned': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            case 'cooldown': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'error': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                            <Users className="text-blue-500" size={32} />
                            Boost Accounts
                        </h1>
                        <p className="text-gray-500">Manage TikTok accounts for real boosting</p>
                    </div>
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                    >
                        <Plus size={20} />
                        Add Account
                    </button>
                </div>

                {/* Add Account Form */}
                {showAddForm && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add New TikTok Account</h3>

                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                                ℹ️ <strong>Auto-Login:</strong> System will automatically login and save cookies
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                🛡️ <strong>Conservative Settings:</strong> Daily Limit: 25 actions, Delay: 5-12s, Cooldown: 4h (safer)
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <input
                                type="text"
                                placeholder="TikTok Username"
                                value={newAccount.username}
                                onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={newAccount.password}
                                onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <input
                                type="number"
                                placeholder="Daily Limit (25)"
                                value={newAccount.dailyLimit}
                                onChange={(e) => setNewAccount({ ...newAccount, dailyLimit: parseInt(e.target.value) })}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={addAccount}
                                disabled={adding}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Adding & Logging in...
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        Add Account
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => setShowAddForm(false)}
                                disabled={adding}
                                className="bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"
                            >
                                <X size={16} />
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Accounts List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {accounts.length === 0 ? (
                        <div className="p-6 md:p-12 text-center text-gray-500">
                            <Users size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No accounts yet. Add your first TikTok account!</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Username</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Daily Limit</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions Today</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total Actions</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {accounts.map((account) => (
                                        <tr key={account._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {account.username}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                                                    {account.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {account.dailyLimit}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {account.actionsToday || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {account.totalActions || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => testLogin(account._id)}
                                                        disabled={testing === account._id}
                                                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                        title="Test Login"
                                                    >
                                                        {testing === account._id ? (
                                                            <Loader2 size={18} className="animate-spin" />
                                                        ) : (
                                                            <TestTube size={18} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => deleteAccount(account._id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Warning */}
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm text-red-800 dark:text-red-200">
                        ⚠️ <strong>Security Warning:</strong> Use burner accounts only. Passwords are encrypted. Accounts may get banned by TikTok.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
