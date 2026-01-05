import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Coins, Zap, TrendingUp, History, Loader2 } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function BuyCredits() {
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
            console.log('🔄 Fetching credit data...');
            const [packagesRes, creditsRes, transactionsRes] = await Promise.all([
                api.get('/credits/packages'),
                api.get('/credits'),
                api.get('/credits/transactions?limit=10')
            ]);

            console.log('📦 Packages response:', packagesRes.data);
            console.log('💰 Credits response:', creditsRes.data);
            console.log('📊 Transactions response:', transactionsRes.data);

            if (packagesRes.data.success) {
                console.log('✅ Setting packages:', packagesRes.data.packages);
                setPackages(packagesRes.data.packages);
            } else {
                console.log('❌ Packages response not successful');
            }

            if (creditsRes.data.success) setUserCredits(creditsRes.data.credits);
            if (transactionsRes.data.success) setTransactions(transactionsRes.data.transactions);
        } catch (err) {
            console.error('❌ Fetch error:', err);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleBuyPackage = async (pkg) => {
        // For now, add credits directly (testing mode)
        // TODO: Integrate real KHQR payment
        if (!confirm(`Add ${pkg.credits} credits for testing?`)) return;

        setPurchasing(pkg._id);
        try {
            const res = await api.post('/credits/add', {
                amount: pkg.credits,
                description: `Test purchase: ${pkg.name} package`
            });

            if (res.data.success) {
                toast.success(`Added ${pkg.credits} credits!`);
                fetchData(); // Refresh data
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to add credits");
        } finally {
            setPurchasing(null);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin" size={48} />
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <Coins className="text-yellow-500" size={32} />
                        Buy Credits
                    </h1>
                    <p className="text-gray-500">Purchase credits to power your Real TikTok Boost</p>
                </div>

                {/* Current Balance */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-6 text-white shadow-lg mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90 font-medium">Current Balance</p>
                            <p className="text-5xl font-bold">{userCredits.toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-2">Credits available for boost actions</p>
                        </div>
                        <Coins size={64} className="opacity-50" />
                    </div>
                </div>

                {/* Packages */}
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Credit Packages</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {packages.map((pkg) => (
                            <div
                                key={pkg._id}
                                className={`bg-white dark:bg-gray-800 rounded-xl p-6 border-2 ${pkg.popular
                                    ? 'border-blue-500 shadow-xl scale-105'
                                    : 'border-gray-200 dark:border-gray-700'
                                    } hover:shadow-lg transition-all relative`}
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                        <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                            <Zap size={12} />
                                            POPULAR
                                        </span>
                                    </div>
                                )}

                                <div className="text-center mb-4">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{pkg.name}</h3>
                                    <div className="flex items-baseline justify-center gap-2">
                                        <span className="text-4xl font-extrabold text-blue-600">{pkg.credits}</span>
                                        <span className="text-gray-500">credits</span>
                                    </div>
                                </div>

                                <div className="text-center mb-4">
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">${pkg.price}</p>
                                    <p className="text-sm text-gray-500">{pkg.priceKHR.toLocaleString()} KHR</p>
                                    {pkg.discount > 0 && (
                                        <span className="inline-block mt-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                                            Save {pkg.discount}%
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => handleBuyPackage(pkg)}
                                    disabled={purchasing === pkg._id}
                                    className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${pkg.popular
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400'
                                        : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white disabled:bg-gray-300'
                                        }`}
                                >
                                    {purchasing === pkg._id ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Credits (Test)'
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transaction History */}
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <History size={24} />
                        Recent Transactions
                    </h2>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <History size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No transactions yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {transactions.map((tx) => (
                                            <tr key={tx._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                    {new Date(tx.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${tx.type === 'purchase' || tx.type === 'bonus'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">
                                                    {tx.description}
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-bold text-right ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right font-medium">
                                                    {tx.balance}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
