
import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, TrendingDown, BarChart, Globe, Target, Search, 
    MousePointer2, Percent, Loader2, CheckCircle, Activity, 
    ShieldCheck, Zap, Brain, Sparkles, AlertCircle, ExternalLink, 
    RefreshCw, Calendar, ArrowRight, MapPin, Users, Award, Play,
    Signal
} from 'lucide-react';
import { KeywordRank, SeoPageMetric } from '../types';

const HealthMetric = ({ label, score, color }: { label: string, score: number, color: string }) => (
    <div className="flex flex-col items-center gap-2 p-4 bg-dark-900 rounded-3xl border border-dark-700">
        <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
                <circle cx="32" cy="32" r="28" fill="transparent" stroke="#1f2937" strokeWidth="4" />
                <circle 
                    cx="32" cy="32" r="28" 
                    fill="transparent" 
                    stroke={color} 
                    strokeWidth="4" 
                    strokeDasharray={176} 
                    strokeDashoffset={176 - (score / 100) * 176} 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <span className="absolute text-xs font-black text-white">{score}</span>
        </div>
        <span className="text-[8px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
    </div>
);

const SeoLab = () => {
    const [keywords, setKeywords] = useState<KeywordRank[]>([]);
    const [pages, setPages] = useState<SeoPageMetric[]>([]);
    const [health, setHealth] = useState<any>(null);
    const [localVisibility, setLocalVisibility] = useState<any>(null);
    const [competitors, setCompetitors] = useState<any[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isCrawling, setIsCrawling] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isStrategizing, setIsStrategizing] = useState(false);
    const [isCommitting, setIsCommitting] = useState(false);

    const [strategyMode, setStrategyMode] = useState<'tactical' | 'content'>('tactical');
    const [tacticalPlan, setTacticalPlan] = useState<string | null>(null);
    const [contentStrategy, setContentStrategy] = useState<string | null>(null);

    const fetchMetrics = () => {
        setIsLoading(true);
        fetch('/api/seo/metrics')
            .then(res => res.json())
            .then(data => {
                setKeywords(data.keywords || []);
                setPages(data.pages || []);
                setHealth(data.health);
                setLocalVisibility(data.localVisibility);
                setCompetitors(data.competitors || []);
            })
            .catch(err => console.error("Metrics Sync Failed", err))
            .finally(() => setIsLoading(false));
    };

    const runNeuralAnalysis = async () => {
        if (!health) return;
        setIsAnalyzing(true);
        setStrategyMode('tactical');
        try {
            const res = await fetch('/api/seo/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metrics: { health, keywords, pages } })
            });
            const data = await res.json();
            setTacticalPlan(data.analysis);
        } catch (e) {
            console.error("Neural Analysis Failed", e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const runContentStrategy = async () => {
        if (!health) return;
        setIsStrategizing(true);
        setStrategyMode('content');
        try {
            const res = await fetch('/api/seo/strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ metrics: { health, keywords, pages } })
            });
            const data = await res.json();
            setContentStrategy(data.strategy);
        } catch (e) {
            console.error("Roadmap Generation Failed", e);
        } finally {
            setIsStrategizing(false);
        }
    };

    const commitStrategyToSwarm = async () => {
        const strategy = strategyMode === 'tactical' ? tacticalPlan : contentStrategy;
        if (!strategy) return;
        
        setIsCommitting(true);
        try {
            const res = await fetch('/api/seo/commit-strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Successfully deployed ${data.tasks.length} missions to the swarm.`);
            }
        } catch (e) {
            console.error("Committing strategy failed", e);
        } finally {
            setIsCommitting(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const handleCrawl = async () => {
        setIsCrawling(true);
        try {
            const res = await fetch('/api/seo/crawl', { method: 'POST' });
            if (res.ok) {
                alert("SEO Audit mission successfully queued.");
            }
        } catch (e) {
            console.error("Crawl Trigger Failed:", e);
        } finally {
            setIsCrawling(false);
        }
    };

    if (isLoading && !health) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                <Activity size={64} className="animate-spin text-google-blue" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Synching SEO Core Intelligence</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">SEO Intelligence</h2>
                    <p className="text-sm text-gray-500 font-medium">Local search dominance, Local Heatmaps, and Neural Growth Stratagems.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={handleCrawl}
                        disabled={isCrawling}
                        className="bg-dark-800 border border-dark-700 text-gray-400 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all shadow-lg flex items-center gap-2"
                    >
                        {isCrawling ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        Engage Swarm Audit
                    </button>
                    <button 
                        onClick={fetchMetrics}
                        className="bg-google-blue text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg flex items-center gap-2"
                    >
                        <RefreshCw size={16} /> Update Metrics
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col items-center gap-6">
                        <div className="text-center space-y-1">
                            <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Global Health Index</div>
                            <div className="text-4xl font-black text-white">{health?.score}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <HealthMetric label="Perf" score={health?.performance} color="#34a853" />
                            <HealthMetric label="Access" score={health?.accessibility} color="#1a73e8" />
                            <HealthMetric label="Best Pr." score={health?.bestPractices} color="#fbbc04" />
                            <HealthMetric label="SEO" score={health?.seo} color="#ea4335" />
                        </div>
                    </div>
                    
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <MapPin className="text-google-red" size={20} />
                                <h3 className="text-sm font-black text-white uppercase tracking-tight">Local Pulse</h3>
                            </div>
                            <span className="text-[8px] font-black text-google-green uppercase">#{localVisibility?.mapsRank} Overall</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            {localVisibility?.heatmap?.map((zone: any, i: number) => (
                                <div key={i} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 ${zone.rank === 1 ? 'bg-google-green/10 border-google-green/30' : 'bg-dark-900 border-dark-700'}`}>
                                    <span className="text-[8px] font-black text-gray-500 uppercase truncate w-full text-center">{zone.zone}</span>
                                    <span className={`text-sm font-black ${zone.rank === 1 ? 'text-google-green' : 'text-gray-400'}`}>#{zone.rank}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 bg-dark-800 p-10 rounded-[2.5rem] border border-google-blue/30 shadow-2xl relative overflow-hidden group flex flex-col">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Brain size={120} />
                    </div>
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-google-blue/10 rounded-2xl border border-google-blue/20">
                                <Sparkles className="text-google-blue" size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Neural Strategy Console</h3>
                                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Autonomous Content Optimization Logic</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={runNeuralAnalysis}
                                disabled={isAnalyzing || isStrategizing}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${strategyMode === 'tactical' && tacticalPlan ? 'bg-google-blue text-white shadow-lg' : 'bg-dark-900 border border-dark-700 text-google-blue hover:border-google-blue'}`}
                            >
                                {isAnalyzing ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                                Tactical Plan
                            </button>
                            <button 
                                onClick={runContentStrategy}
                                disabled={isAnalyzing || isStrategizing}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${strategyMode === 'content' && contentStrategy ? 'bg-google-yellow text-dark-900 shadow-lg' : 'bg-dark-900 border border-dark-700 text-google-yellow hover:border-google-yellow'}`}
                            >
                                {isStrategizing ? <Loader2 className="animate-spin" size={14} /> : <Calendar size={14} />}
                                3-Month Roadmap
                            </button>
                        </div>
                    </div>

                    <div className="bg-dark-900/50 p-8 rounded-3xl border border-dark-700 flex-1 relative overflow-y-auto max-h-[400px] mb-8">
                        {(isAnalyzing || isStrategizing) ? (
                            <div className="h-full flex flex-col items-center justify-center gap-4 py-8">
                                <Loader2 className="animate-spin text-google-blue" size={32} />
                                <p className="text-[10px] font-black uppercase text-gray-600 animate-pulse">
                                    {isAnalyzing ? 'Processing Site Flux...' : 'Synthesizing Strategic Roadmap...'}
                                </p>
                            </div>
                        ) : (strategyMode === 'tactical' ? tacticalPlan : contentStrategy) ? (
                            <div className="prose prose-invert prose-sm max-w-none animate-in fade-in slide-in-from-bottom-2">
                                <p className="text-gray-300 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                                    {strategyMode === 'tactical' ? tacticalPlan : contentStrategy}
                                </p>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center gap-4 py-8">
                                <Brain size={48} />
                                <p className="text-[10px] font-black uppercase tracking-widest">Neural Link Idle. Initiate Strategy Sequence.</p>
                            </div>
                        )}
                    </div>

                    {(tacticalPlan || contentStrategy) && (
                        <div className="flex justify-end pt-4 border-t border-dark-700">
                            <button 
                                onClick={commitStrategyToSwarm}
                                disabled={isCommitting}
                                className="bg-google-green text-dark-900 px-10 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-google-green/10 flex items-center gap-3 disabled:opacity-50"
                            >
                                {isCommitting ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                                Commit Strategy to Swarm
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-dark-700 bg-dark-900/40 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <Target className="text-google-yellow" size={24} />
                            <h3 className="text-xl font-black text-white">Keyword Pulse</h3>
                        </div>
                        <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Active Rank Tracking</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-dark-900 border-b border-dark-700">
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-gray-500 tracking-widest">Keyword</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-gray-500 tracking-widest">Rank</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-gray-500 tracking-widest">7D Delta</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-gray-500 tracking-widest">Vol</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-gray-500 tracking-widest">Target URL</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                {keywords.map((k, i) => (
                                    <tr key={i} className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-all">
                                        <td className="px-8 py-4 font-bold text-white">{k.keyword}</td>
                                        <td className="px-8 py-4">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${k.position <= 3 ? 'bg-google-green/10 text-google-green' : 'bg-dark-900 text-gray-400'}`}>
                                                #{k.position}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className={`flex items-center gap-1 font-black text-[10px] ${k.delta > 0 ? 'text-google-green' : k.delta < 0 ? 'text-google-red' : 'text-gray-600'}`}>
                                                {k.delta > 0 ? <TrendingUp size={12} /> : k.delta < 0 ? <TrendingDown size={12} /> : null}
                                                {k.delta !== 0 ? Math.abs(k.delta) : '-'}
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 font-bold text-gray-400">{(k as any).volume?.toLocaleString() || '--'}</td>
                                        <td className="px-8 py-4">
                                            <a href={k.url} target="_blank" className="text-google-blue hover:underline flex items-center gap-1 truncate max-w-[150px]">
                                                {k.url} <ExternalLink size={10} />
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8 flex flex-col">
                    <div className="flex items-center gap-4">
                        <Award className="text-google-blue" size={24} />
                        <h3 className="text-lg font-black text-white">Benchmarks</h3>
                    </div>
                    <div className="space-y-6 flex-1">
                        {competitors.map((comp, i) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between items-end">
                                    <div className="text-xs font-black text-white">{comp.name}</div>
                                    <div className={`text-[10px] font-black ${comp.name.includes('You') ? 'text-google-green' : 'text-gray-600'}`}>{comp.shareOfVoice}%</div>
                                </div>
                                <div className="h-1.5 bg-dark-900 rounded-full overflow-hidden">
                                    <div className={`h-full ${comp.name.includes('You') ? 'bg-google-blue' : 'bg-dark-700'}`} style={{ width: `${comp.shareOfVoice * 3}%` }} />
                                </div>
                                <div className="flex justify-between text-[8px] font-black uppercase text-gray-500">
                                    <span>DR: {comp.dr}</span>
                                    <span>BL: {comp.backlinks}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-google-blue/5 rounded-2xl border border-google-blue/10 flex gap-2">
                        <Signal className="text-google-blue shrink-0" size={14} />
                        <p className="text-[8px] text-gray-500 font-black uppercase leading-tight">SOV Index live sync via Swarm Crawler.</p>
                    </div>
                </div>
            </div>
            
            <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-xl flex justify-between items-center opacity-40 grayscale group hover:grayscale-0 hover:opacity-100 transition-all">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-google-yellow/10 rounded-2xl border border-google-yellow/20">
                        <AlertCircle className="text-google-yellow" size={24} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-white uppercase tracking-tight">Gap Identified</h4>
                        <p className="text-[10px] text-gray-500 font-medium">Domain Authority (DA) gap detected vs "WaterRescue Pros".</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setStrategyMode('tactical'); runNeuralAnalysis(); }}
                    className="bg-dark-900 border border-dark-700 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
                >
                    Remediate
                </button>
            </div>
        </div>
    );
};

export default SeoLab;
