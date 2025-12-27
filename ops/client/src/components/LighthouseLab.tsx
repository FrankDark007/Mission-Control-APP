
import React, { useState } from 'react';
import { Shield, Zap, Search, Loader2, BarChart, AlertTriangle, CheckCircle, ExternalLink, RefreshCw, Cpu, Monitor, Smartphone, Globe, Sparkles } from 'lucide-react';

const LighthouseLab = () => {
    const [report, setReport] = useState<any>(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    const runAudit = async () => {
        setIsAuditing(true);
        setReport(null);
        setAnalysis(null);
        try {
            const res = await fetch('/api/lighthouse/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: 'http://localhost:4000' })
            });
            const data = await res.json();
            setReport(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsAuditing(false);
        }
    };

    const runNeuralFix = async () => {
        if (!report) return;
        setIsAnalyzing(true);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Analyze these Lighthouse failures and provide a tactical fix command: ${JSON.stringify(report.audits)}`,
                    model: 'gemini-3-pro-preview',
                    systemInstruction: "You are a Web Performance Engineer. Provide clear, actionable CLI commands to fix performance issues."
                })
            });
            const data = await res.json();
            setAnalysis(data.text);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const ScoreRing = ({ label, score, color }: { label: string, score: number, color: string }) => {
        const radius = 32;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (score / 100) * circumference;
        return (
            <div className="flex flex-col items-center gap-3">
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r={radius} fill="transparent" stroke="#1f2937" strokeWidth="6" />
                        <circle 
                            cx="40" cy="40" r={radius} 
                            fill="transparent" 
                            stroke={color} 
                            strokeWidth="6" 
                            strokeDasharray={circumference} 
                            strokeDashoffset={offset} 
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                        />
                    </svg>
                    <span className="absolute text-sm font-black text-white">{Math.round(score)}</span>
                </div>
                <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
            </div>
        );
    };

    return (
        <div className="space-y-10 animate-in fade-in pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Lighthouse Node</h2>
                    <p className="text-sm text-gray-500 font-medium">Neural performance auditing and automated UX optimization.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={runAudit}
                        disabled={isAuditing}
                        className="bg-google-blue text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {isAuditing ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                        Initiate Audit
                    </button>
                </div>
            </div>

            {report ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-dark-800 p-10 rounded-[3rem] border border-dark-700 shadow-2xl space-y-10 flex flex-col items-center">
                            <div className="grid grid-cols-2 gap-10">
                                <ScoreRing label="Performance" score={report.scores.performance} color="#34a853" />
                                <ScoreRing label="Accessibility" score={report.scores.accessibility} color="#1a73e8" />
                                <ScoreRing label="Best Practices" score={report.scores.bestPractices} color="#fbbc04" />
                                <ScoreRing label="SEO" score={report.scores.seo} color="#ea4335" />
                            </div>
                            <div className="w-full pt-8 border-t border-dark-700 text-center">
                                <div className="text-[8px] font-black uppercase text-gray-600 mb-2">Audit Timestamp</div>
                                <div className="text-[10px] font-mono text-gray-400">{new Date(report.timestamp).toLocaleString()}</div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={runNeuralFix}
                            disabled={isAnalyzing}
                            className="w-full py-5 bg-google-yellow text-dark-900 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Cpu size={20} />}
                            Neural Performance Analysis
                        </button>
                    </div>

                    <div className="lg:col-span-2 space-y-8">
                        {analysis && (
                            <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-google-yellow/30 shadow-2xl space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-google-yellow/10 rounded-xl border border-google-yellow/20">
                                        <span className="text-google-yellow"><Sparkles size={20} /></span>
                                    </div>
                                    <h3 className="text-xl font-black text-white italic">Tactical Fixes</h3>
                                </div>
                                <div className="bg-dark-900 p-6 rounded-3xl border border-dark-700 font-mono text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {analysis}
                                </div>
                            </div>
                        )}

                        <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                            <div className="flex items-center gap-4 mb-4">
                                <AlertTriangle className="text-google-yellow" size={24} />
                                <h3 className="text-xl font-black text-white">Opportunities for Optimization</h3>
                            </div>
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                                {report.audits.map((audit: any, i: number) => (
                                    <div key={i} className="p-6 bg-dark-900 rounded-[2rem] border border-dark-700 group hover:border-google-blue/30 transition-all flex items-start gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-google-red/10 flex items-center justify-center text-google-red border border-google-red/20 shadow-lg shrink-0">
                                            <span className="text-xs font-black">{Math.round(audit.score * 100)}</span>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <h4 className="text-sm font-black text-white uppercase group-hover:text-google-blue transition-colors">{audit.title}</h4>
                                            <p className="text-[11px] text-gray-500 leading-relaxed font-medium">{audit.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[600px] border-2 border-dashed border-dark-800 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                    <BarChart size={64} className="mb-6" />
                    <p className="text-sm font-black uppercase tracking-[0.3em]">No Audit Data. Initiate Sequence to Analyze Site Pulse.</p>
                </div>
            )}
        </div>
    );
};

export default LighthouseLab;
