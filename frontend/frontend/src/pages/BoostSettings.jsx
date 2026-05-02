import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Zap, Plus, Trash2, Save, TrendingUp, Clock, Heart, ShieldCheck, Activity, Settings2, Sliders, ChevronRight, AlertTriangle, Sparkles } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../components/ui/Button";

export default function BoostSettings() {
    const [enabled, setEnabled] = useState(false);
    const [rules, setRules] = useState([]);
    const [realBoost, setRealBoost] = useState({ enabled: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        try {
            const res = await api.get("/boost/rules");
            if (res.data.success) {
                setEnabled(res.data.rules.enabled);
                setRules(res.data.rules.rules || []);
                setRealBoost(res.data.rules.realBoost || { enabled: false });
            }
        } catch (err) {
            toast.error("Failed to load automation profile");
        } finally {
            setLoading(false);
        }
    };

    const addRule = () => {
        setRules([...rules, {
            type: 'time',
            condition: { hours: 24 },
            actions: ['like'],
            intensity: 'medium'
        }]);
    };

    const updateRule = (index, field, value) => {
        const newRules = JSON.parse(JSON.stringify(rules));
        if (field.includes('.')) {
            const [parent, child] = field.split('.');
            newRules[index][parent][child] = value;
        } else {
            newRules[index][field] = value;
        }
        setRules(newRules);
    };

    const deleteRule = (index) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const toggleAction = (index, action) => {
        const newRules = [...rules];
        const actions = newRules[index].actions;
        if (actions.includes(action)) {
            newRules[index].actions = actions.filter(a => a !== action);
        } else {
            newRules[index].actions = [...actions, action];
        }
        setRules(newRules);
    };

    const saveRules = async () => {
        try {
            const res = await api.post("/boost/rules", { enabled, rules, realBoost });
            if (res.data.success) {
                toast.success("Automation profile updated 🚀");
            }
        } catch (err) {
            toast.error("Cloud sync failed");
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading Automation Profile</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-6 py-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                AI Configuration
                            </div>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                            Auto <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Pilot.</span>
                        </h1>
                        <p className="text-gray-500 mt-2 font-medium">Fine-tune your automated engagement behavior and rules.</p>
                    </div>
                    
                    <Button onClick={saveRules} className="h-14 px-10 rounded-2xl shadow-xl shadow-blue-500/20">
                        <Save size={20} className="mr-2" />
                        Save Profile
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Master Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div 
                            whileHover={{ y: -4 }}
                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-black/5"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${enabled ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-100 dark:bg-black text-gray-400'}`}>
                                        <Activity size={24} className={enabled ? 'animate-pulse' : ''} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Main Engine</h3>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Auto-Boost System</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setEnabled(!enabled)}
                                    className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 ${enabled ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-800'}`}
                                >
                                    <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-xl transition-transform duration-300 ${enabled ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </motion.div>

                        <motion.div 
                            whileHover={{ y: -4 }}
                            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-black/5 overflow-hidden relative"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Sparkles size={80} className="text-purple-500" />
                            </div>
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${realBoost.enabled ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-gray-100 dark:bg-black text-gray-400'}`}>
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Real Network</h3>
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Identity Engagement</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setRealBoost(prev => ({ ...prev, enabled: !prev.enabled }))}
                                    className={`relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-300 ${realBoost.enabled ? 'bg-purple-500' : 'bg-gray-200 dark:bg-gray-800'}`}
                                >
                                    <span className={`inline-block h-7 w-7 transform rounded-full bg-white shadow-xl transition-transform duration-300 ${realBoost.enabled ? 'translate-x-8' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </motion.div>
                    </div>

                    {realBoost.enabled && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-6 bg-purple-500/5 border border-purple-500/10 rounded-3xl flex items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-4 text-purple-500">
                                <AlertTriangle size={20} />
                                <p className="text-xs font-bold uppercase tracking-widest">
                                    Network accounts required for identity-based engagement.
                                </p>
                            </div>
                            <a href="/boost-accounts" className="text-[10px] font-black uppercase tracking-widest bg-purple-500 text-white px-4 py-2 rounded-xl hover:bg-purple-600 transition-colors">Manage Accounts</a>
                        </motion.div>
                    )}

                    {/* Rules Engine */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-4">
                            <div className="flex items-center gap-3">
                                <Sliders size={20} className="text-blue-500" />
                                <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Rules Engine</h3>
                            </div>
                            <button 
                                onClick={addRule}
                                className="p-3 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-2xl transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                            >
                                <Plus size={18} /> Add Rule
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <AnimatePresence mode="popLayout">
                                {rules.map((rule, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-2xl shadow-black/5 relative group"
                                    >
                                        <div className="flex items-start justify-between mb-8">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center text-gray-400 font-black">
                                                    {index + 1}
                                                </div>
                                                <h4 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Automation Trigger</h4>
                                            </div>
                                            <button 
                                                onClick={() => deleteRule(index)}
                                                className="p-3 text-gray-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Logic Type</label>
                                                <select
                                                    value={rule.type}
                                                    onChange={(e) => updateRule(index, 'type', e.target.value)}
                                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                                >
                                                    <option value="time">Chronological</option>
                                                    <option value="engagement">Engagement Threshold</option>
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                                    {rule.type === 'time' ? 'Interval (Hours)' : 'Likes Target'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={rule.type === 'time' ? rule.condition.hours : rule.condition.minLikes}
                                                    onChange={(e) => updateRule(index, rule.type === 'time' ? 'condition.hours' : 'condition.minLikes', parseInt(e.target.value))}
                                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Engagement Volume</label>
                                                <select
                                                    value={rule.intensity}
                                                    onChange={(e) => updateRule(index, 'intensity', e.target.value)}
                                                    className="w-full px-6 py-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-gray-900 dark:text-white font-bold"
                                                >
                                                    <option value="low">Optimized (10-20)</option>
                                                    <option value="medium">Accelerated (30-50)</option>
                                                    <option value="high">Maximum (100+)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Action Protocol</label>
                                                <div className="flex gap-2">
                                                    {['like', 'comment', 'share'].map(action => (
                                                        <button
                                                            key={action}
                                                            onClick={() => toggleAction(index, action)}
                                                            className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${rule.actions.includes(action)
                                                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                                                : 'bg-gray-100 dark:bg-black text-gray-400 hover:text-gray-600'
                                                                }`}
                                                        >
                                                            {action}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>

                {/* Risk Notice */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-12 flex items-center gap-4 p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl"
                >
                    <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                        <Settings2 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-1">Safety Advisory</p>
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed">
                            Simulated engagement behavior is managed via decentralized worker nodes. Adjust intensity levels to maintain platform compliance and account longevity.
                        </p>
                    </div>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
