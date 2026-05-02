import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Users, Plus, Trash2, Check, X, Loader2, ShieldAlert, Activity, Fingerprint, Lock, ChevronRight, AlertCircle } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";

const MotionDiv = motion.div;
const MotionAnimatePresence = AnimatePresence;

export default function BoostAccounts() {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAccount, setNewAccount] = useState({
        username: '',
        password: '',
        dailyLimit: 25
    });
    const [testing, setTesting] = useState(null);
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            const res = await api.get("/boost-accounts");
            if (res.data.success) setAccounts(res.data.accounts);
        } catch (err) {
            toast.error("Cloud sync failed");
        } finally {
            setLoading(false);
        }
    };

    const addAccount = async () => {
        if (!newAccount.username || !newAccount.password) return toast.error("Credentials required");
        setAdding(true);
        try {
            const res = await api.post("/boost-accounts", newAccount);
            if (res.data.success) {
                toast.success("Identity linked & authorized");
                setAccounts([...accounts, res.data.account]);
                setNewAccount({ username: '', password: '', dailyLimit: 25 });
                setShowAddForm(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Auth handshake failed");
        } finally {
            setAdding(false);
        }
    };

    const deleteAccount = async (id) => {
        if (!confirm("Deauthorize this identity?")) return;
        try {
            const res = await api.delete(`/boost-accounts/${id}`);
            if (res.data.success) {
                toast.success("Identity purged");
                setAccounts(accounts.filter(a => a._id !== id));
            }
        } catch (err) {
            toast.error("Purge failed");
        }
    };

    const testLogin = async (id) => {
        setTesting(id);
        try {
            const res = await api.post(`/boost-accounts/${id}/test`);
            if (res.data.success) {
                toast.success("Handshake verified ✅");
                fetchAccounts();
            } else {
                toast.error("Auth failed ❌");
            }
        } catch (err) {
            toast.error("Test failed");
        } finally {
            setTesting(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'banned': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
            case 'cooldown': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
            default: return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                        <div className="absolute inset-0 border-4 border-transparent border-b-purple-500 rounded-full animate-spin [animation-duration:1.5s]" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Syncing Identities</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                Network Engine
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Boost <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Identities.</span>
                        </h1>
                        <p className="text-gray-500 mt-2 font-medium tracking-tight">Manage and scale your automated TikTok engagement network.</p>
                    </div>
                    
                    <Button 
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="h-14 px-8 rounded-2xl shadow-xl shadow-blue-500/20"
                    >
                        {showAddForm ? <X size={20} className="mr-2" /> : <Plus size={20} className="mr-2" />}
                        {showAddForm ? "Close Panel" : "Link Account"}
                    </Button>
                </div>

                <MotionAnimatePresence>
                    {showAddForm && (
                        <MotionDiv
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-10 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-blue-500/5 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Plus size={120} />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white">
                                        <Fingerprint size={20} />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">New Identity Handshake</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">TikTok Username</label>
                                        <input
                                            type="text"
                                            placeholder="@username"
                                            value={newAccount.username}
                                            onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Access Token / Password</label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            value={newAccount.password}
                                            onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Daily Capacity</label>
                                        <input
                                            type="number"
                                            value={newAccount.dailyLimit}
                                            onChange={(e) => setNewAccount({ ...newAccount, dailyLimit: parseInt(e.target.value) })}
                                            className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-4 text-gray-400">
                                        <ShieldAlert size={18} className="text-amber-500" />
                                        <p className="text-xs font-bold leading-relaxed max-w-md">
                                            System will perform a secure handshake to verify credentials and store session cookies in our encrypted vault.
                                        </p>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={() => setShowAddForm(false)} className="px-6 py-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors">Discard</button>
                                        <Button onClick={addAccount} isLoading={adding} className="px-8 rounded-xl shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700">Link Now</Button>
                                    </div>
                                </div>
                            </div>
                        </MotionDiv>
                    )}
                </MotionAnimatePresence>

                {/* Grid View for Identities */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accounts.length === 0 ? (
                        <div className="col-span-full py-32 text-center bg-gray-50 dark:bg-white/5 rounded-[3rem] border border-dashed border-gray-200 dark:border-white/10">
                            <Users size={64} className="mx-auto mb-6 text-gray-300" />
                            <h3 className="text-2xl font-black text-gray-400 tracking-tight">No Active Identities</h3>
                            <p className="text-gray-500 mt-2 font-medium">Link your first TikTok account to start boosting.</p>
                        </div>
                    ) : (
                        accounts.map((account, i) => (
                            <MotionDiv
                                key={account._id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2rem] p-6 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gray-50 dark:bg-black rounded-2xl flex items-center justify-center text-xl font-black text-blue-500 border border-gray-100 dark:border-white/5 group-hover:scale-110 transition-transform duration-500">
                                            {account.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">{account.username}</h4>
                                            <div className={`px-2 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-widest inline-block ${getStatusColor(account.status)}`}>
                                                {account.status}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => deleteAccount(account._id)} className="p-2 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Today</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">{account.actionsToday || 0}<span className="text-[10px] text-gray-400 ml-1">/ {account.dailyLimit}</span></p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-black/50 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lifetime</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">{account.totalActions || 0}</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/5">
                                    <div className="flex items-center gap-2">
                                        <Activity size={14} className="text-blue-500 animate-pulse" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Engine Ready</span>
                                    </div>
                                    <button 
                                        onClick={() => testLogin(account._id)}
                                        disabled={testing === account._id}
                                        className="flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-widest"
                                    >
                                        {testing === account._id ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                        Verify Auth
                                    </button>
                                </div>
                            </MotionDiv>
                        ))
                    )}
                </div>

                {/* Footer Warning */}
                <MotionDiv 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-12 flex items-center gap-4 p-6 bg-rose-500/5 border border-rose-500/10 rounded-3xl"
                >
                    <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Security Protocol</p>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
                            Always use burner identities. Passwords are salted and encrypted with AES-256. We do not store raw credentials in our primary databases.
                        </p>
                    </div>
                </MotionDiv>
            </div>
        </DashboardLayout>
    );
}
