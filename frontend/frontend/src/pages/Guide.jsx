import React from 'react';
import { 
    HelpCircle, 
    UserPlus, 
    Mail, 
    Facebook, 
    ShieldCheck, 
    Layers, 
    Video, 
    Image, 
    ExternalLink, 
    CheckCircle2, 
    AlertTriangle,
    ArrowRight,
    MousePointer2,
    Layout,
    Download,
    MessageSquare,
    Zap,
    Link as LinkIcon,
    Settings
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';

const Guide = () => {
    const MotionDiv = motion.div;
    const navigate = useNavigate();

    const workflows = [
        {
            id: 'upload',
            title: "ផុសវីដេអូ",
            icon: <Video className="text-blue-500" />,
            steps: [
                "ចូលទៅកាន់ទំព័រ 'Video Carousel' ហើយជ្រើសរើស Ad Account របស់អ្នក។",
                "បង្ហោះវីដេអូរបស់អ្នក — ប្រព័ន្ធនឹងបង្កើតរូបភាពតូច (thumbnails) ឱ្យអ្នកដោយស្វ័យប្រវត្តិ។",
                "ជ្រើសរើស Thumbnail របស់អ្នក (ឬបង្ហោះដោយខ្លួនឯង)។",
                "ជ្រើសរើសផេកដែលអ្នកចង់ផុសទៅ។",
                "បញ្ចូលការពិពណ៌នារបស់អ្នក (ជម្រើស)។",
                "បញ្ចូលតំណភ្ជាប់គោលដៅ (ជម្រើស)។",
                "ជ្រើសរើសប្រភេទប៊ូតុង (Action Type)។ យើងណែនាំឱ្យប្រើ 'Like Page' ដើម្បីបង្កើនការគាំទ្រ។",
                "បញ្ចូលចំណងជើង CTA (ឧទាហរណ៍៖ 'សូមចុច Like ផេក')។",
                "កំណត់រូបភាពនៅខាងស្តាំ (កាតទី ២) ឬរក្សាទុកតាមលំនាំដើម។",
                "ចុចប៊ូតុង publish ដើម្បីផុស។"
            ]
        },
        {
            id: 'clone',
            title: "ចម្លងវីដេអូ TikTok",
            icon: <Layers className="text-purple-500" />,
            steps: [
                "ចូលទៅកាន់ទំព័រ 'Clone TikTok Video Carousel'។",
                "ដាក់តំណភ្ជាប់ (URL) វីដេអូ TikTok របស់អ្នក។",
                "ជ្រើសរើស Ad Account និងបន្តការកំណត់ carousel តាមធម្មតា។",
                "ប្រព័ន្ធនឹងរៀបចំការទាញយក និងទម្រង់ដោយស្វ័យប្រវត្តិ។"
            ]
        }
    ];

    const faq = [
        {
            q: "តើ Facebook video carousel មានរូបរាងដូចម្តេច?",
            a: "ការផ្សាយពាណិជ្ជកម្មបែប Carousel នៅលើ Facebook ឬបណ្តាញសង្គមផ្សេងទៀត អាចមានរហូតដល់ ១០ កាត ដែលកាតនីមួយៗមានរូបភាព ឬវីដេអូផ្ទាល់ខ្លួន។ ទម្រង់អន្តរកម្មនេះអនុញ្ញាតឱ្យអ្នកប្រើប្រាស់អូសមើលខ្លឹមសារតាមដេក។"
        },
        {
            q: "តើអ្វីទៅជា Facebook carousel post?",
            a: "Facebook carousel គឺជាការផុសតែមួយដែលមានរូបភាព ឬវីដេអូច្រើន ដែលអាចមើលបានដោយការអូស ឬចុចទៅខាងឆ្វេងលើអេក្រង់។ វាគឺជាវិធីដ៏ល្អមួយក្នុងការនិទានរឿង ឬបង្ហាញផលិតផលច្រើនក្នុងពេលតែមួយ។"
        },
        {
            q: "តើគេការពារ Website ពីការ Web Scraping តាមរបៀបណា?",
            a: "Website ជាច្រើនប្រើប្រាស់ការការពារដូចជា Bot Detection, CAPTCHA, IP Blocking, Session Validation និង Data Encryption ដើម្បីទប់ស្កាត់ការ Scrape។ ចំពោះ Website ដែលមិនបានការពារ ទិន្នន័យរបស់ពួកគេអាចត្រូវបានទាញចេញបានដោយងាយ។ នេះជាមូលហេតុដែល Developer គួរតែយល់ដឹងពីជំនាញនេះ ទាំងក្នុងការប្រើប្រាស់ និងការការពារ។"
        }
    ];

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto py-4 px-4">
                {/* Header */}
                <div className="mb-8 text-center">
                    <MotionDiv 
                        initial={{ opacity: 0, y: window.innerWidth < 768 ? 0 : -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-xs font-semibold mb-3"
                    >
                        <HelpCircle size={13} /> មគ្គុទ្ទេសក៍ការប្រើប្រាស់
                    </MotionDiv>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-1.5">
                        របៀបប្រើប្រាស់ <span className="text-blue-600 dark:text-blue-400">ឧបករណ៍ផុសមាតិកា</span>
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">អនុវត្តតាមជំហានទាំងនេះ ដើម្បីផុស និងពង្រីកផេករបស់អ្នក</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-10">
                        {/* Setup Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white px-1 flex items-center gap-2">
                                <UserPlus size={18} className="text-blue-600" /> ជំហានទី ១: ការរៀបចំ
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl shadow-xs">
                                    <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 text-blue-600">
                                        <Mail size={18} />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">ការចុះឈ្មោះ</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">បង្កើតគណនីរបស់អ្នកដើម្បីចាប់ផ្តើមប្រើប្រាស់ឧបករណ៍។</p>
                                </div>
                                <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/5 rounded-2xl shadow-xs">
                                    <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 text-blue-600">
                                        <Facebook size={18} />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">ភ្ជាប់ផេកតាម EZA-POST FB Extension</h4>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2.5">
                                        ចូលទៅកាន់ទំព័រ 'ភ្ជាប់ផេក Facebook' ដើម្បីទាញយក Extension ដំឡើងលើ Chrome រួចចុចភ្ជាប់ដោយមិនបាច់ប្រើ Token ដោយដៃ។
                                    </p>
                                    <a
                                        href="/eza-post-fb-extension.zip"
                                        download="EZA-POST-FB-Extension.zip"
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                        <Download size={13} />
                                        <span>ទាញយក Extension</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Workflow Tabs/Sections */}
                        {workflows.map((flow, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-[3rem] p-10 shadow-2xl shadow-black/5">
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-8 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gray-50 dark:bg-black rounded-xl flex items-center justify-center">
                                        {flow.icon}
                                    </div>
                                    {flow.title}
                                </h3>
                                <div className="space-y-4">
                                    {flow.steps.map((step, sIdx) => (
                                        <div key={sIdx} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-2xl">
                                            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                                                {sIdx + 1}
                                            </div>
                                            <p className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-tight leading-relaxed">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {/* Knowledge Base */}
                        <div className="space-y-6">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight px-2 flex items-center gap-3">
                                <HelpCircle className="text-indigo-600" /> សំណួរដែលគេសួរញឹកញាប់
                            </h3>
                            {faq.map((item, idx) => (
                                <div key={idx} className="p-8 bg-gray-50 dark:bg-black border border-gray-100 dark:border-white/5 rounded-[2rem]">
                                    <h4 className="text-md font-black text-gray-900 dark:text-white uppercase tracking-tight mb-3">{item.q}</h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[3rem] p-10 text-white shadow-2xl shadow-blue-500/20 sticky top-28">
                            <h3 className="text-2xl font-black tracking-tight mb-6">ឧបករណ៍ Facebook ផ្សេងទៀត</h3>
                            <div className="space-y-4">
                                {[
                                    { label: "Facebook Video Carousel", icon: <Layers size={18} />, state: { postFormat: 'carousel', videoTab: 'upload' } },
                                    { label: "Facebook Image Carousel", icon: <Image size={18} />, state: { postFormat: 'carousel', videoTab: 'upload' } },
                                    { label: "ចម្លង TikTok ទៅ Carousel", icon: <Zap size={18} />, state: { postFormat: 'carousel', videoTab: 'tiktok' } },
                                    { label: "វីដេអូជាមួយប៊ូតុងសកម្មភាព", icon: <Video size={18} />, state: { postFormat: 'single', videoTab: 'upload' } },
                                    { label: "រូបភាពជាមួយប៊ូតុងសកម្មភាព", icon: <Image size={18} />, state: { postFormat: 'single', videoTab: 'upload' } }
                                ].map((tool, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => navigate('/post', { state: tool.state })}
                                        className="flex items-center justify-between p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {tool.icon}
                                            <span className="text-[10px] font-black uppercase tracking-widest">{tool.label}</span>
                                        </div>
                                        <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-12 pt-12 border-t border-white/10">
                                <div className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl">
                                    <AlertTriangle className="text-yellow-400 shrink-0" size={20} />
                                    <p className="text-[9px] font-bold uppercase tracking-widest leading-loose opacity-80">
                                        យើងណែនាំឱ្យប្រើប៊ូតុង 'Like Page' ដើម្បីពន្លឿនការរីកចម្រើនតាមបែបធម្មជាតិ។
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default Guide;
