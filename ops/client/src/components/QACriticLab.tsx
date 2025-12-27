
import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Search, Zap, Loader2, FileText, Gavel, Layout, ChevronRight } from 'lucide-react';

const QACriticLab = () => {
    const [subject, setSubject] = useState('');
    const [context, setContext] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [report, setReport] = useState<{score: number, violations: string[], recommendations: string[]} | null>(null);

    const runReview = async () => {
        if (!subject.trim()) return;
        setIsAnalyzing(true);
        setReport(null);
        try {
            const res = await fetch('/api/qa/critic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, context })
            });
            const data = await res.json();
            
            // Parse common format
            const scoreMatch = data.analysis.match(/SCORE:\s*(\d+)/);
            const violations = data.analysis.split('VIOLATIONS:')[1]?.split('RECOMMENDATIONS:')[0]?.split('\n').filter((l: string) => l.trim().startsWith('-')).map((l: string) => l.replace('-', '').trim()) || [];
            const recommendations = data.analysis.split('RECOMMENDATIONS:')[1]?.split('\n').filter((l: string) => l.trim().startsWith('-')).map((l: string) => l.replace('-', '').trim()) || [];

            setReport({
                score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
                violations,
                recommendations
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">QA Adversary</h2>
                    <p className="text-sm text-gray-500 font-medium">Ruthless adversarial testing and compliance auditing.</p>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-google-red/20">
                    <Gavel className="text-google-red" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-google-red">Adversarial Mode: ON</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Audit Subject</label>
                            <input 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl focus:border-google-red outline-none text-sm text-white"
                                placeholder="e.g. New Landing Page Header"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Evidence / Context</label>
                            <textarea 
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-red outline-none text-sm h-64 resize-none shadow-inner"
                                placeholder="Paste code snippet, describe UI behavior, or provide a URL for analysis..."
                            />
                        </div>

                        <button 
                            onClick={runReview}
                            disabled={isAnalyzing || !subject.trim()}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all ${isAnalyzing ? 'bg-dark-700 text-gray-500 cursor-not-allowed' : 'bg-google-red text-white hover:scale-[1.02]'}`}
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                            Initiate Audit
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    {isAnalyzing ? (
                        <div className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl h-[600px] flex flex-col items-center justify-center text-center gap-8">
                            <div className="relative">
                                <ShieldAlert size={80} className="text-google-red animate-pulse" />
                                <div className="absolute inset-0 animate-ping opacity-20"><ShieldAlert size={80} className="text-google-red" /></div>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-widest">Scanning for Vulnerabilities...</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Deconstructing mission artifacts for failure points.</p>
                            </div>
                        </div>
                    ) : report ? (
                        <div className="space-y-8 animate-in zoom-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-xl col-span-1 flex flex-col items-center justify-center text-center gap-2">
                                    <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Compliance Score</div>
                                    <div className={`text-6xl font-black ${report.score > 80 ? 'text-google-green' : report.score > 50 ? 'text-google-yellow' : 'text-google-red'}`}>
                                        {report.score}
                                    </div>
                                    <div className="text-[9px] font-bold text-gray-600 uppercase tracking-tighter">Mission Threshold: 85</div>
                                </div>
                                <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-xl col-span-2 flex items-center gap-8">
                                     <div className="space-y-1">
                                         <div className="text-[10px] font-black uppercase text-gray-500">Audit Status</div>
                                         <div className="text-xl font-black text-white">{report.score > 80 ? 'APPROVED' : 'ACTION REQUIRED'}</div>
                                         <p className="text-[11px] text-gray-500 italic leading-tight">Adversary review complete. Fixes must be applied before deployment sync.</p>
                                     </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-google-red/20 shadow-2xl space-y-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-google-red flex items-center gap-2">
                                        <AlertTriangle size={14} /> Critical Violations
                                    </h4>
                                    <div className="space-y-4">
                                        {report.violations.map((v, i) => (
                                            <div key={i} className="flex gap-4 p-4 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-red/40 transition-all">
                                                <ChevronRight size={14} className="text-google-red shrink-0 mt-0.5" />
                                                <p className="text-xs text-gray-300 font-medium">{v}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-google-blue/20 shadow-2xl space-y-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-google-blue flex items-center gap-2">
                                        <Zap size={14} /> Tactical Fixes
                                    </h4>
                                    <div className="space-y-4">
                                        {report.recommendations.map((r, i) => (
                                            <div key={i} className="flex gap-4 p-4 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-blue/40 transition-all">
                                                <CheckCircle size={14} className="text-google-blue shrink-0 mt-0.5" />
                                                <p className="text-xs text-gray-300 font-medium">{r}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[600px] border-2 border-dashed border-dark-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <Gavel size={64} className="mb-6" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Matrix Silent. Initiate Audit Sequence.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QACriticLab;
