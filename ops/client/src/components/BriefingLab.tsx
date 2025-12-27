
import React, { useState } from 'react';
import { Loader2, Radio, Sparkles, MessageSquare, FileText } from 'lucide-react';

const BriefingLab = () => {
    const [topic, setTopic] = useState('');
    const [briefing, setBriefing] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const generateBriefing = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/briefing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });
            const data = await res.json();
            setBriefing(data.briefing);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Mission Briefing</h2>
                    <p className="text-sm text-gray-500 font-medium">Generate tactical mission summaries and intelligence reports.</p>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-dark-700">
                    <Radio className="text-google-red animate-pulse" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Intel Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                    <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <MessageSquare size={12} className="text-google-blue" /> Briefing Objective
                            </label>
                            <div className="relative">
                                <input 
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Current Swarm health and deployment status"
                                    className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm text-white shadow-inner"
                                />
                                <button 
                                    onClick={generateBriefing}
                                    disabled={isGenerating || !topic.trim()}
                                    className="absolute right-3 top-3 p-3 bg-google-blue text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-google-blue" />
                                <span className="text-[10px] font-black uppercase text-gray-400">Format</span>
                            </div>
                            <div className="text-sm font-bold text-white">Military-Style SMEAC</div>
                            <div className="text-[9px] text-gray-600 font-black uppercase">Situation, Mission, Execution, Admin, Command</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {briefing ? (
                        <div className="bg-dark-800 rounded-[2.5rem] border border-google-blue/30 shadow-2xl overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4">
                            <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-google-blue/5">
                                <div className="flex items-center gap-4">
                                    <span className="p-2 bg-google-blue/10 rounded-lg text-google-blue"><FileText size={24} /></span>
                                    <h3 className="text-xl font-black text-white">Intelligence Report</h3>
                                </div>
                            </div>
                            <div className="p-10 flex-1 overflow-y-auto max-h-[500px]">
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300 leading-relaxed">{briefing}</pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-dark-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <FileText size={64} className="mb-6" />
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Briefing Matrix Ready</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BriefingLab;
