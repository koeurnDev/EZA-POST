import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Coins, Zap, TrendingUp, History, Loader2, Sparkles, ArrowRight, Wallet, Check, ChevronRight, Activity, Calendar } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";


export default function BuyCredits() {
    const MotionDiv = motion.div;
    const MotionAnimatePresence = AnimatePresence;
    const [packages, setPackages] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userCredits, setUserCredits] = useState(0);
    const [purchasing, setPurchasing] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [packagesRes, creditsRes, transactionsRes] = await Promise.all([
                api.get('/credits/packages'),
                api.get('/credits'),
                api.get('/credits/transactions?limit=10')
            ]);

            if (packagesRes.data.success) setPackages(packagesRes.data.packages);
            if (creditsRes.data.success) setUserCredits(creditsRes.data.credits);
            if (transactionsRes.data.success) setTransactions(transactionsRes.data.transactions);
        } catch (err) {
            toast.error("Cloud synchronization failed");
        } finally {
            setLoading(false);
        }
    };

    const handleBuyPackage = async (pkg) => {
        if (!confirm(`Initialize purchase of ${pkg.credits} credits?`)) return;

        setPurchasing(pkg._id);
        try {
            const res = await api.post('/credits/add', {
                amount: pkg.credits,
                description: `Authorized purchase: ${pkg.name}`
            });

            if (res.data.success) {
                toast.success(`Allocated ${pkg.credits} credits to your vault`);
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Transaction declined");
        } finally {
            setPurchasing(null);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Updating Ledger</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8 mb-8 md:mb-12 px-1">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-black text-amber-500 uppercase tracking-widest">
                                Financial Vault
                            </div>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Fuel your <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">Growth.</span>
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 mt-2 font-medium">Acquire network credits to power your engagement automation.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-12 md:mb-16">
                    {/* Balance Card */}
                    <MotionDiv 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="lg:col-span-4 bg-gradient-to-br from-gray-900 to-black rounded-[2rem] md:rounded-[3rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl shadow-amber-500/5 border border-white/5 group"
                    >
                        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Coins size={120} md:size={160} />
                        </div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 md:w-14 md:h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-8 md:mb-10 border border-white/10">
                                <Wallet size={20} md:size={24} className="text-amber-400" />
                            </div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Available Balance</p>
                            <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-8 md:mb-10 flex items-end gap-2">
                                {userCredits.toLocaleString()}
                                <span className="text-xs md:text-sm font-black text-amber-500 uppercase tracking-widest pb-2 md:pb-3">CR</span>
                            </h3>
                            <div className="pt-6 md:pt-8 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity size={12} md:size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vault Secure</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Sync</span>
                            </div>
                        </div>
                    </MotionDiv>

                    {/* Quick Add / Featured */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight">Credit Packages</h3>
                            <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                <Sparkles size={14} /> Recommended
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {packages.map((pkg, i) => (
                                <MotionDiv
                                    key={pkg._id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className={`group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 hover:shadow-2xl hover:shadow-blue-500/5 transition-all duration-500 ${pkg.popular ? 'ring-2 ring-blue-500/20 shadow-blue-500/5' : ''}`}
                                >
                                    {pkg.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 z-10">
                                            Most Popular
                                        </div>
                                    )}

                                    <div className="text-center mb-6 md:mb-8">
                                        <h4 className="text-base md:text-lg font-black text-gray-900 dark:text-white tracking-tight mb-4 md:mb-6">{pkg.name}</h4>
                                        <div className="inline-flex flex-col items-center">
                                            <span className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{pkg.credits.toLocaleString()}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Credits</span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-black/40 rounded-2xl md:rounded-3xl p-5 md:p-6 mb-6 md:mb-8 text-center border border-gray-100 dark:border-white/5">
                                        <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">${pkg.price}</p>
                                        <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">≈ {pkg.priceKHR.toLocaleString()} KHR</p>
                                        {pkg.discount > 0 && (
                                            <div className="mt-2.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest inline-block border border-emerald-500/20">
                                                +{pkg.discount}% Bonus
                                            </div>
                                        )}
                                    </div>

                                    <Button 
                                        onClick={() => handleBuyPackage(pkg)} 
                                        isLoading={purchasing === pkg._id}
                                        className={`w-full h-12 md:h-14 rounded-xl md:rounded-2xl text-xs md:text-sm ${pkg.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-900 hover:bg-black'}`}
                                    >
                                        {purchasing === pkg._id ? 'Processing...' : 'Authorize Add'}
                                    </Button>
                                </MotionDiv>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger History */}
                <MotionDiv 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2rem] md:rounded-[3rem] overflow-hidden shadow-2xl shadow-black/5"
                >
                    <div className="p-6 md:p-10 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-50 dark:bg-black rounded-xl md:rounded-2xl flex items-center justify-center text-gray-400">
                                <History size={20} md:size={24} />
                            </div>
                            <h2 className="text-lg md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Financial Ledger</h2>
                        </div>
                    </div>

                    {transactions.length === 0 ? (
                        <div className="py-20 md:py-32 text-center text-gray-400">
                            <Wallet size={40} md:size={48} className="mx-auto mb-6 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No transaction records found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            {/* Mobile View: Card List */}
                            <div className="block md:hidden divide-y divide-gray-100 dark:divide-white/5 px-4">
                                {transactions.map((tx) => (
                                    <div key={tx._id} className="py-5 space-y-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Calendar size={12} />
                                                <span className="text-[10px] font-bold">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${tx.type === 'purchase' || tx.type === 'bonus'
                                                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                                                }`}>
                                                {tx.type}
                                            </span>
                                        </div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{tx.description}</p>
                                        <div className="flex justify-between items-center pt-1">
                                            <p className={`font-black text-sm ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} <span className="text-[10px] uppercase">CR</span>
                                            </p>
                                            <p className="text-xs font-black text-gray-400">
                                                Bal: {tx.balance.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View: Table */}
                            <table className="hidden md:table w-full">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-black/20 text-gray-400">
                                        <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em]">Timestamp</th>
                                        <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em]">Category</th>
                                        <th className="px-10 py-6 text-left text-[10px] font-black uppercase tracking-[0.2em]">Reference</th>
                                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em]">Allocation</th>
                                        <th className="px-10 py-6 text-right text-[10px] font-black uppercase tracking-[0.2em]">New Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {transactions.map((tx) => (
                                        <tr key={tx._id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-10 py-8">
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Calendar size={14} />
                                                    <span className="text-xs font-bold">{new Date(tx.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-8">
                                                <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${tx.type === 'purchase' || tx.type === 'bonus'
                                                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                                                    : 'text-rose-500 bg-rose-500/10 border-rose-500/20'
                                                    }`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className="px-10 py-8 text-sm font-bold text-gray-500 dark:text-gray-400">
                                                {tx.description}
                                            </td>
                                            <td className={`px-10 py-8 text-right font-black ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                            </td>
                                            <td className="px-10 py-8 text-right font-black text-gray-900 dark:text-white">
                                                {tx.balance.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </MotionDiv>
            </div>
        </DashboardLayout>
    );
}
