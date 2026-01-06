
import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";
import { TrendingUp, Users, Calendar, Clock, ArrowUp, ArrowDown, Share2, Eye, Heart, BarChart2 } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Analytics() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get("/analytics");
                if (res.data.success) {
                    setStats(res.data.stats);
                }
            } catch (err) {
                console.error("Failed to load analytics:", err);
                toast.error("Could not load analytics data.");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const StatCard = ({ title, value, subtext, icon: Icon, color, trend }) => (
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{value}</h3>
                <p className={`text-xs font-bold mt-2 flex items-center gap-1 ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                    {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {subtext}
                </p>
            </div>
            <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 dark:bg-${color}-900/20 dark:text-${color}-400`}>
                <Icon size={24} />
            </div>
        </div>
    );

    if (loading) return (
        <DashboardLayout>
            <div className="flex items-center justify-center h-[80vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-4 md:py-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <TrendingUp className="text-blue-600" /> Analytics
                        </h1>
                        <p className="text-gray-500">Performance insights and audience engagement stats.</p>
                    </div>
                    {/* Date Filter (Mock) */}
                    <select className="bg-white dark:bg-gray-800 border-none rounded-xl shadow-sm px-4 py-2 font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                        <option>Last 30 Days</option>
                        <option>Last 7 Days</option>
                        <option>This Year</option>
                    </select>
                </div>

                {/* 📊 Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        title="Total Reach"
                        value={stats?.engagement?.views?.toLocaleString() || 0}
                        subtext="+12.5% vs last month"
                        icon={Eye} color="blue" trend="up"
                    />
                    <StatCard
                        title="Engagement"
                        value={stats?.engagement?.likes?.toLocaleString() || 0}
                        subtext="+5.2% vs last month"
                        icon={Heart} color="pink" trend="up"
                    />
                    <StatCard
                        title="Total Posts"
                        value={stats?.total || 0}
                        subtext="Across 4 platforms"
                        icon={BarChart2} color="purple" trend="up"
                    />
                    <StatCard
                        title="Scheduled"
                        value={stats?.scheduled || 0}
                        subtext="Upcoming posts"
                        icon={Calendar} color="orange" trend="up"
                    />
                </div>

                {/* 📈 Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    {/* Main Chart: Posts Activity */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Posting Activity</h3>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats?.chartData || []}>
                                    <defs>
                                        <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area type="monotone" dataKey="posts" stroke="#3B82F6" fillOpacity={1} fill="url(#colorPosts)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Side Chart: Platform Distribution */}
                    <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Platform Mix</h3>
                        <div className="h-[250px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Facebook', value: stats?.platforms?.facebook || 0 },
                                            { name: 'YouTube', value: stats?.platforms?.youtube || 0 },
                                            { name: 'TikTok', value: stats?.platforms?.tiktok || 0 },
                                            { name: 'Instagram', value: stats?.platforms?.instagram || 0 },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {COLORS.map((color, index) => (
                                            <Cell key={`cell-${index}`} fill={color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-4">
                            {['Facebook', 'YouTube', 'TikTok', 'Instagram'].map((p, i) => (
                                <div key={p} className="flex items-center gap-1 text-xs text-gray-500">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                                    {p}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 🕑 Best Time to Post */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl p-5 md:p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <Clock /> Best Time to Post
                            </h3>
                            <p className="text-indigo-100 mb-8 max-w-sm">
                                Based on your historical engagement data, we recommend posting at these times for maximum reach.
                            </p>

                            <div className="space-y-4">
                                {stats?.bestTimes?.map((time, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                                        <span className="font-bold text-lg">{time.day}</span>
                                        <span className="font-mono bg-white text-indigo-600 px-3 py-1 rounded-lg font-bold">{time.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/30 rounded-full blur-3xl" />
                    </div>

                    {/* Needs Attention / Alerts */}
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 md:p-8 border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Recent Issues</h3>
                        {stats?.failed > 0 ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30 flex items-start gap-4">
                                    <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg">
                                        <ArrowDown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-red-700 dark:text-red-400">Failed Posts ({stats.failed})</h4>
                                        <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                            Some posts failed to publish. Check the scheduled posts log for details.
                                        </p>
                                        <button className="mt-3 text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-lg shadow-sm hover:bg-red-50">
                                            View Logs
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                                <CheckCircle2 size={48} className="mb-4 text-green-500" /> // CheckCircle2 not imported? replaced below
                                <p>No issues detected.</p>
                                <p className="text-sm">Everything is running smoothly!</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </DashboardLayout>
    );
}

// Fix missing icon import locally
import { CheckCircle2 } from "lucide-react";
