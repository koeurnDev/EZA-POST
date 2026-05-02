import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "../layouts/DashboardLayout";
import { 
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, CartesianGrid 
} from "recharts";
import { 
    TrendingUp, Users, Calendar, Clock, ArrowUp, ArrowDown, 
    Share2, Eye, Heart, BarChart2, CheckCircle2, AlertCircle, Info, Activity, Sparkles, ChevronRight, Globe, Zap
} from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

export default function Analytics() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("30");

    const COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get("/analytics");
                if (res.data.success) {
                    setStats(res.data.stats);
                }
            } catch (err) {
                toast.error("Neural data link failed.");
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const StatCard = ({ title, value, subtext, icon: Icon, color, trend, delay = 0 }) => (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-2xl shadow-black/5 relative overflow-hidden group hover:shadow-blue-500/5 transition-all duration-500"
        >
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
                    <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-500 group-hover:scale-110 transition-transform`}>
                        <Icon size={20} />
                    </div>
                </div>
                <h3 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">{value}</h3>
                <div className={`text-[10px] font-black flex items-center gap-1 ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend === 'up' ? <ArrowUp size={12} strokeWidth={3} /> : <ArrowDown size={12} strokeWidth={3} />}
                    <span className="uppercase tracking-widest">{subtext}</span>
                </div>
            </div>
            <div className={`absolute -right-6 -bottom-6 w-32 h-32 bg-${color}-500/5 rounded-full blur-3xl group-hover:bg-${color}-500/10 transition-colors`} />
        </motion.div>
    );

    if (loading) return (
        <DashboardLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Synchronizing Analytics</p>
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                Data Intelligence
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Neural <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Insights.</span>
                        </h1>
                        <p className="text-gray-500 mt-2 font-medium">Deep-dive into your cross-platform engagement metrics.</p>
                    </div>

                    <div className="flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                        {["7", "30", "365"].map(t => (
                            <button
                                key={t}
                                onClick={() => setFilter(t)}
                                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === t ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-xl border border-gray-100 dark:border-white/10' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {t === "365" ? "Year" : `${t}D`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 📊 Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    <StatCard
                        title="Total Audience Reach"
                        value={stats?.engagement?.views?.toLocaleString() || 0}
                        subtext="+12.5% Momentum"
                        icon={Eye} color="blue" trend="up" delay={0.1}
                    />
                    <StatCard
                        title="Neural Engagement"
                        value={stats?.engagement?.likes?.toLocaleString() || 0}
                        subtext="+5.2% Growth"
                        icon={Heart} color="pink" trend="up" delay={0.2}
                    />
                    <StatCard
                        title="Authorized Nodes"
                        value={stats?.total || 0}
                        subtext="Cross-Platform"
                        icon={Zap} color="purple" trend="up" delay={0.3}
                    />
                    <StatCard
                        title="Queued Payload"
                        value={stats?.scheduled || 0}
                        subtext="Future Slots"
                        icon={Calendar} color="orange" trend="up" delay={0.4}
                    />
                </div>

                {/* 📈 Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
                    {/* Main Chart: Posts Activity */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="lg:col-span-8 bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-2xl shadow-black/5 border border-gray-100 dark:border-white/5"
                    >
                        <div className="flex justify-between items-center mb-12">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                                    <Activity size={20} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Post Density Spectrum</h3>
                            </div>
                        </div>
                        <div className="h-[400px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats?.chartData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b810" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={10} tick={{fontWeight: '900', fontSize: '9px'}} />
                                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dx={-10} tick={{fontWeight: '900', fontSize: '9px'}} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '24px', color: '#fff', padding: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                        labelStyle={{ color: '#64748b', fontSize: '9px', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.2em' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="posts" 
                                        stroke="#3B82F6" 
                                        strokeWidth={4} 
                                        fillOpacity={1} 
                                        fill="url(#colorPosts)" 
                                        animationDuration={2500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Side Chart: Platform Distribution */}
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="lg:col-span-4 bg-white dark:bg-gray-900 p-10 rounded-[3rem] shadow-2xl shadow-black/5 border border-gray-100 dark:border-white/5 flex flex-col"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600">
                                <Globe size={20} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Platform Mix</h3>
                        </div>
                        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-12">Network Distribution</p>
                        
                        <div className="flex-1 h-[250px] w-full flex items-center justify-center">
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
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={8}
                                        dataKey="value"
                                        animationBegin={500}
                                        animationDuration={1500}
                                    >
                                        {COLORS.map((color, index) => (
                                            <Cell key={`cell-${index}`} fill={color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#000', border: 'none', borderRadius: '16px' }}
                                        itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-12">
                            {['Facebook', 'YouTube', 'TikTok', 'Instagram'].map((p, i) => (
                                <div key={p} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-black/50 border border-gray-100 dark:border-white/5">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: COLORS[i] }} />
                                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{p}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* 🕑 Lower Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Recommendation Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7 }}
                        className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden group"
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl">
                                    <Clock size={24} />
                                </div>
                                <h3 className="text-2xl font-black tracking-tight italic uppercase">Peak Activity</h3>
                            </div>
                            
                            <p className="text-blue-100/80 mb-12 max-w-sm font-medium leading-relaxed">
                                Our algorithmic engine identified these peak engagement windows for your network identities.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stats?.bestTimes?.map((time, idx) => (
                                    <motion.div 
                                        key={idx} 
                                        whileHover={{ x: 5 }}
                                        className="flex items-center justify-between bg-white/10 backdrop-blur-2xl p-6 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default"
                                    >
                                        <span className="font-black text-[10px] uppercase tracking-widest opacity-80">{time.day}</span>
                                        <span className="font-black bg-white text-blue-700 px-4 py-2 rounded-xl text-xs shadow-xl">
                                            {time.time}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse" />
                    </motion.div>

                    {/* System Health Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.8 }}
                        className="bg-white dark:bg-gray-900 rounded-[3rem] p-10 border border-gray-100 dark:border-white/5 flex flex-col shadow-2xl shadow-black/5"
                    >
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-600">
                                <Info size={20} />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">System Health</h3>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            {stats?.failed > 0 ? (
                                <div className="w-full space-y-6">
                                    <div className="p-8 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/10 flex flex-col items-center gap-6">
                                        <div className="p-5 bg-rose-500/10 text-rose-500 rounded-2xl">
                                            <AlertCircle size={32} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-rose-500 text-xl uppercase tracking-tight">Action Required</h4>
                                            <p className="text-[10px] font-black text-rose-500/60 mt-2 uppercase tracking-widest leading-relaxed">
                                                {stats.failed} content blocks failed to distribute.
                                            </p>
                                        </div>
                                        <button className="w-full py-4 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-rose-500/20 hover:bg-rose-600 transition-all">
                                            Initiate Error Review
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ scale: 0.9 }}
                                    animate={{ scale: 1 }}
                                    className="flex flex-col items-center"
                                >
                                    <div className="w-24 h-24 bg-emerald-500/5 rounded-full flex items-center justify-center mb-8 border border-emerald-500/10">
                                        <CheckCircle2 size={48} className="text-emerald-500" />
                                    </div>
                                    <h4 className="text-2xl font-black text-gray-900 dark:text-white mb-3 uppercase italic tracking-tight">Optimal Status</h4>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest max-w-[200px] leading-relaxed">
                                        Your orchestration pipeline is running within peak parameters.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </DashboardLayout>
    );
}
