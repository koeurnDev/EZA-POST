import React, { useState, useEffect } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { Zap, Plus, Trash2, Save, TrendingUp, Clock, Heart } from "lucide-react";
import api from "../utils/api";
import toast from "react-hot-toast";

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
            toast.error("Failed to load boost rules");
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
        const newRules = [...rules];
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
                toast.success("Boost rules saved!");
            }
        } catch (err) {
            toast.error("Failed to save rules");
        }
    };

    if (loading) {
        return <DashboardLayout><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                        <Zap className="text-yellow-500" size={32} />
                        Auto-Boost Settings
                    </h1>
                    <p className="text-gray-500">Automatically boost your posts with simulated engagement</p>
                </div>

                {/* Master Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enable Auto-Boost</h3>
                            <p className="text-sm text-gray-500">Automatically promote posts based on rules below</p>
                        </div>
                        <button
                            onClick={() => setEnabled(!enabled)}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* Real Boost Toggle */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg mb-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Enable Real TikTok Boost 🤖</h3>
                            <p className="text-sm text-gray-500">Use browser automation for REAL engagement (requires accounts)</p>
                        </div>
                        <button
                            onClick={() => setRealBoost(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${realBoost.enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                        >
                            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${realBoost.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {realBoost.enabled && (
                        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                ⚠️ Real boost requires TikTok accounts. Go to <a href="/boost-accounts" className="underline font-bold">Boost Accounts</a> to add them.
                            </p>
                        </div>
                    )}
                </div>

                {/* Rules List */}
                <div className="space-y-4 mb-6">
                    {rules.map((rule, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between mb-4">
                                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Rule {index + 1}</h4>
                                <button onClick={() => deleteRule(index)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={20} />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Rule Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rule Type</label>
                                    <select
                                        value={rule.type}
                                        onChange={(e) => updateRule(index, 'type', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="time">Time-Based</option>
                                        <option value="engagement">Engagement-Based</option>
                                    </select>
                                </div>

                                {/* Condition */}
                                {rule.type === 'time' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Boost After (Hours)</label>
                                        <input
                                            type="number"
                                            value={rule.condition.hours || 24}
                                            onChange={(e) => updateRule(index, 'condition.hours', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Likes Threshold</label>
                                        <input
                                            type="number"
                                            value={rule.condition.minLikes || 10}
                                            onChange={(e) => updateRule(index, 'condition.minLikes', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                )}

                                {/* Intensity */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Intensity</label>
                                    <select
                                        value={rule.intensity}
                                        onChange={(e) => updateRule(index, 'intensity', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="low">Low (10-20 likes)</option>
                                        <option value="medium">Medium (30-50 likes)</option>
                                        <option value="high">High (100+ likes)</option>
                                    </select>
                                </div>

                                {/* Actions */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions</label>
                                    <div className="flex gap-2">
                                        {['like', 'comment', 'share'].map(action => (
                                            <button
                                                key={action}
                                                onClick={() => toggleAction(index, action)}
                                                className={`px-4 py-2 rounded-lg font-medium transition-colors ${rule.actions.includes(action)
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                {action.charAt(0).toUpperCase() + action.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Rule Button */}
                <button
                    onClick={addRule}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2 mb-6"
                >
                    <Plus size={20} />
                    Add New Rule
                </button>

                {/* Save Button */}
                <button
                    onClick={saveRules}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                    <Save size={20} />
                    Save Boost Rules
                </button>

                {/* Warning */}
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ <strong>Note:</strong> Simulated engagement may violate platform policies. Use responsibly and at your own risk.
                    </p>
                </div>
            </div>
        </DashboardLayout>
    );
}
