import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, DollarSign, Calendar, Users, Target, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const BoostPostModal = ({ post, onClose, onSuccess }) => {
    const [step, setStep] = useState(1); // 1: Configure, 2: Preview, 3: Confirm
    const [loading, setLoading] = useState(false);

    const [config, setConfig] = useState({
        budget: post.recommendedBudget?.recommended || 10,
        duration: 3,
        targeting: {
            ageMin: 18,
            ageMax: 65,
            genders: ['all'],
            locations: ['US'],
            interests: []
        }
    });

    const handleBudgetChange = (value) => {
        const budget = Math.max(5, Math.min(500, parseInt(value) || 5));
        setConfig({ ...config, budget });
    };

    const handleDurationChange = (duration) => {
        setConfig({ ...config, duration });
    };

    const handleTargetingChange = (field, value) => {
        setConfig({
            ...config,
            targeting: {
                ...config.targeting,
                [field]: value
            }
        });
    };

    const calculateTotalCost = () => {
        return config.budget * config.duration;
    };

    const calculateEstimatedReach = () => {
        // Simple estimation based on budget
        const baseReach = config.budget * 100;
        const durationMultiplier = 1 + (config.duration * 0.1);
        return Math.round(baseReach * durationMultiplier);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await api.post('/api/boost/campaigns/create', {
                postId: post.post._id,
                budget: config.budget,
                duration: config.duration,
                targeting: config.targeting
            });

            toast.success('🚀 Campaign created successfully!');
            onSuccess();
        } catch (error) {
            console.error('Error creating campaign:', error);
            toast.error(error.response?.data?.error || 'Failed to create campaign');
        } finally {
            setLoading(false);
        }
    };

    const durationOptions = [
        { value: 1, label: '1 Day' },
        { value: 3, label: '3 Days' },
        { value: 7, label: '1 Week' },
        { value: 14, label: '2 Weeks' },
        { value: 30, label: '1 Month' }
    ];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                >
                    {/* Header */}
                    <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-6 h-6" />
                                Boost This Post
                            </h2>
                            <p className="text-blue-100 text-sm mt-1">
                                Viral Score: {Math.round(post.viralScore)} • {post.viralTier.toUpperCase()}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Step 1: Configuration */}
                        {step === 1 && (
                            <div className="space-y-6">
                                {/* Budget */}
                                <div>
                                    <label className="flex items-center gap-2 text-white font-semibold mb-3">
                                        <DollarSign className="w-5 h-5 text-green-400" />
                                        Daily Budget
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="5"
                                            max="500"
                                            value={config.budget}
                                            onChange={(e) => handleBudgetChange(e.target.value)}
                                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <div className="bg-gray-800 px-4 py-2 rounded-lg min-w-[100px] text-center">
                                            <span className="text-2xl font-bold text-white">${config.budget}</span>
                                            <span className="text-gray-400 text-sm">/day</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-2">
                                        Recommended: ${post.recommendedBudget?.recommended}/day
                                    </p>
                                </div>

                                {/* Duration */}
                                <div>
                                    <label className="flex items-center gap-2 text-white font-semibold mb-3">
                                        <Calendar className="w-5 h-5 text-blue-400" />
                                        Campaign Duration
                                    </label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {durationOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => handleDurationChange(option.value)}
                                                className={`py-3 px-2 rounded-lg font-medium transition-all ${config.duration === option.value
                                                        ? 'bg-blue-600 text-white shadow-lg'
                                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Audience Targeting */}
                                <div>
                                    <label className="flex items-center gap-2 text-white font-semibold mb-3">
                                        <Target className="w-5 h-5 text-purple-400" />
                                        Audience Targeting
                                    </label>

                                    {/* Age Range */}
                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-2">Age Range</p>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="number"
                                                min="13"
                                                max="65"
                                                value={config.targeting.ageMin}
                                                onChange={(e) => handleTargetingChange('ageMin', parseInt(e.target.value))}
                                                className="bg-gray-800 text-white px-4 py-2 rounded-lg w-20 text-center"
                                            />
                                            <span className="text-gray-500">to</span>
                                            <input
                                                type="number"
                                                min="13"
                                                max="65"
                                                value={config.targeting.ageMax}
                                                onChange={(e) => handleTargetingChange('ageMax', parseInt(e.target.value))}
                                                className="bg-gray-800 text-white px-4 py-2 rounded-lg w-20 text-center"
                                            />
                                        </div>
                                    </div>

                                    {/* Gender */}
                                    <div className="mb-4">
                                        <p className="text-gray-400 text-sm mb-2">Gender</p>
                                        <div className="flex gap-2">
                                            {['all', 'male', 'female'].map((gender) => (
                                                <button
                                                    key={gender}
                                                    onClick={() => handleTargetingChange('genders', [gender])}
                                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${config.targeting.genders.includes(gender)
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                                        }`}
                                                >
                                                    {gender.charAt(0).toUpperCase() + gender.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Location */}
                                    <div>
                                        <p className="text-gray-400 text-sm mb-2">Location</p>
                                        <select
                                            value={config.targeting.locations[0]}
                                            onChange={(e) => handleTargetingChange('locations', [e.target.value])}
                                            className="bg-gray-800 text-white px-4 py-2 rounded-lg w-full"
                                        >
                                            <option value="US">United States</option>
                                            <option value="GB">United Kingdom</option>
                                            <option value="CA">Canada</option>
                                            <option value="AU">Australia</option>
                                            <option value="KH">Cambodia</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Estimated Reach */}
                                <div className="bg-gradient-to-r from-blue-900 to-purple-900 p-4 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-300 text-sm">Estimated Reach</p>
                                            <p className="text-3xl font-bold text-white">
                                                {calculateEstimatedReach().toLocaleString()}
                                            </p>
                                            <p className="text-gray-400 text-xs mt-1">people</p>
                                        </div>
                                        <Users className="w-12 h-12 text-blue-400 opacity-50" />
                                    </div>
                                </div>

                                {/* Total Cost */}
                                <div className="bg-gray-800 p-4 rounded-lg border-2 border-green-600">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-gray-400 text-sm">Total Campaign Cost</p>
                                            <p className="text-3xl font-bold text-green-400">
                                                ${calculateTotalCost()}
                                            </p>
                                        </div>
                                        <DollarSign className="w-12 h-12 text-green-400 opacity-50" />
                                    </div>
                                </div>

                                {/* Warning */}
                                <div className="bg-yellow-900 bg-opacity-30 border border-yellow-600 p-4 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-yellow-200">
                                        <p className="font-semibold mb-1">Important:</p>
                                        <p>This will charge your connected Facebook Ad Account. Make sure you have sufficient balance.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-gray-800 p-6 flex items-center justify-between border-t border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    Creating Campaign...
                                </>
                            ) : (
                                <>
                                    <TrendingUp className="w-5 h-5" />
                                    Create Campaign (${calculateTotalCost()})
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default BoostPostModal;
