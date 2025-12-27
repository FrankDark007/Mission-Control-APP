
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Zap, CheckCircle2, XCircle, Clock, Activity, Users, Box, Layers, Brain, Sparkles, Loader2, RefreshCw, AlertTriangle, Monitor } from 'lucide-react';
import { telemetry } from '../services/telemetry';

const AnalyticsLab = () => {
    const [data, setData] = useState<any>(null);
    const [briefing, setBriefing] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [browserMetrics, setBrowserMetrics] = useState<any[]>([]);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/analytics/swarm');
            const json = await res.json();
            setData(json);
            // Feature 11: Real Telemetry Sync
            setBrowserMetrics(telemetry.getMetrics().slice(-10));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchBriefing = async () => {
        setIsBriefingLoading(true);
        try {
            const res = await fetch('/api/analytics/briefing');
            const json = await res.json();
            setBriefing(json.briefing);
        } catch (e) {
            console.error(e);
        } finally {
            setIsBriefingLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
        fetchBriefing();
        const interval = setInterval(fetchAnalytics, 10000);
        return () => clearInterval(interval);
    }, []);

    const performanceHealth = useMemo(() => {
        const longTasks = browserMetrics.filter(m => m.type === 'longtask').length;
        if (longTasks > 5) return 'Degraded';
        if (longTasks > 2) return 'Stable';
        return 'Optimal';
    }, [browserMetrics]);

    if (isLoading || !data) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                <Activity size={64} className="animate-spin text-google-blue" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Calibrating Analytics Matrix</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 lg:space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Swarm Intelligence Analytics</h2>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Real-time performance evaluation and strategic briefing.</p>
                </div>
                <div className="flex gap-4 bg-dark-800 p-2 rounded-xl md:rounded-2xl border border-dark-700">
                    <div className="px-3 md:px-4 py-2 text-center">
                        <div className="text-[8px] font-black uppercase text-gray-500">Mission Success</div>
                        <div className="text-sm font-black text-google-green">{data.summary.successRate}%</div>
                    </div>
                    <div className="w-px h-8 bg-dark-700 self-center" />
                    <div className="px-3 md:px-4 py-2 text-center">
                        <div className="text-[8px] font-black uppercase text-gray-500">UX Health</div>
                        <div className={`text-sm font-black ${performanceHealth === 'Optimal' ? 'text-google-green' : 'text-google-yellow'}`}>{performanceHealth}</div>
                    </div>
                </div>
            </div>

            {/* Daily Executive Briefing */}
            <div className="bg-dark-800 p-4 md:p-6 lg:p-10 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-google-blue/30 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Brain className="w-16 h-16 md:w-24 md:h-24 lg:w-[120px] lg:h-[120px]" />
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6 md:mb-8">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-3 md:p-4 bg-google-blue/10 rounded-xl md:rounded-2xl border border-google-blue/20">
                            <Sparkles className="text-google-blue w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg md:text-xl font-black text-white">Commander's Neural Briefing</h3>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Autonomous Summary of Global Swarm State</p>
                        </div>
                    </div>
                    <button
                        onClick={fetchBriefing}
                        disabled={isBriefingLoading}
                        className="bg-dark-900 border border-dark-700 p-2.5 md:p-3 rounded-lg md:rounded-xl hover:text-google-blue transition-colors disabled:opacity-50 shadow-inner"
                    >
                        {isBriefingLoading ? <Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
                    </button>
                </div>

                <div className="bg-dark-900/50 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-2xl lg:rounded-3xl border border-dark-700 min-h-[100px] md:min-h-[120px] relative">
                    {isBriefingLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <Loader2 className="animate-spin text-google-blue" size={28} />
                            <p className="text-[10px] font-black uppercase text-gray-600 animate-pulse">Aggregating Swarm Telemetry...</p>
                        </div>
                    ) : briefing ? (
                        <p className="text-gray-300 leading-relaxed font-medium text-sm italic border-l-4 border-google-blue pl-6 py-2">
                            "{briefing}"
                        </p>
                    ) : (
                        <div className="flex flex-col items-center justify-center opacity-20 text-center gap-4 py-8">
                            <Brain size={48} />
                            <p className="text-[10px] font-black uppercase tracking-widest">No Briefing Available</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-10">
                {/* Workload Distribution */}
                <div className="bg-dark-800 p-4 md:p-6 lg:p-10 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-4 md:space-y-6 lg:space-y-8 flex flex-col">
                    <div className="flex items-center gap-3 md:gap-4">
                        <Users className="text-google-blue w-5 h-5 md:w-6 md:h-6" />
                        <h3 className="text-lg md:text-xl font-black text-white italic">Agent Load distribution</h3>
                    </div>
                    <div className="space-y-4 md:space-y-6 lg:space-y-8 flex-1 justify-center">
                        {data.agentWorkload.map((agent: any, i: number) => (
                            <div key={i} className="space-y-3">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-gray-500">{agent.name}</span>
                                    <span className="text-white">{Math.round(agent.value)}% Engagement</span>
                                </div>
                                <div className="h-4 bg-dark-900 rounded-full overflow-hidden border border-dark-700 shadow-inner">
                                    <div 
                                        className="h-full bg-google-blue transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(26,115,232,0.4)]" 
                                        style={{ width: `${agent.value}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* UX Sensory Telemetry */}
                <div className="bg-dark-800 p-4 md:p-6 lg:p-10 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-4 md:space-y-6 lg:space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-3 md:gap-4">
                            <Monitor className="text-google-yellow w-5 h-5 md:w-6 md:h-6" />
                            <h3 className="text-lg md:text-xl font-black text-white italic">Browser sensory telemetry</h3>
                        </div>
                        <div className="px-3 py-1 bg-google-yellow/10 rounded-full text-[8px] font-black text-google-yellow uppercase">Real-time</div>
                    </div>
                    <div className="space-y-3 md:space-y-4 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                        {browserMetrics.length > 0 ? browserMetrics.reverse().map((m, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-blue/30 transition-all">
                                <div className={`p-2 rounded-lg ${m.type === 'longtask' ? 'bg-google-red/10 text-google-red' : 'bg-google-blue/10 text-google-blue'}`}>
                                    {m.type === 'longtask' ? <AlertTriangle size={14} /> : <Zap size={14} />}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <div className="text-[10px] font-black text-white uppercase truncate">{m.name}</div>
                                    <div className="text-[9px] text-gray-500 font-mono mt-0.5">{m.duration.toFixed(2)}ms latency</div>
                                </div>
                                <div className="text-[8px] font-black uppercase text-gray-700 group-hover:text-google-blue transition-colors">TYPE: {m.type}</div>
                            </div>
                        )) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                <Activity size={40} className="mb-4" />
                                <p className="text-[9px] font-black uppercase tracking-widest">Listening for browser events...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Strategic Mission Registry */}
            <div className="bg-dark-800 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden">
                <div className="p-4 md:p-6 lg:p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
                    <div className="flex items-center gap-3 md:gap-4">
                        <Layers className="text-google-green w-5 h-5 md:w-6 md:h-6" />
                        <h3 className="text-lg md:text-xl font-black text-white italic">Strategic execution registry</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-dark-900 border-b border-dark-700">
                                <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Mission ID</th>
                                <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Agent Scope</th>
                                <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Result</th>
                                <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Cycle Time</th>
                                <th className="px-4 md:px-8 py-4 md:py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Sync Stamp</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs font-medium">
                            {data.trends.slice(-15).reverse().map((mission: any, i: number) => (
                                <tr key={i} className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-all group">
                                    <td className="px-4 md:px-8 py-4 md:py-5 font-mono text-gray-400 group-hover:text-google-blue transition-colors">#{mission.id}</td>
                                    <td className="px-4 md:px-8 py-4 md:py-5 font-bold text-white uppercase tracking-tighter">Autonomous {mission.status === 'failed' ? 'Intervention' : 'Patch'}</td>
                                    <td className="px-4 md:px-8 py-4 md:py-5">
                                        <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${mission.status === 'completed' ? 'bg-google-green/10 text-google-green border border-google-green/20' : 'bg-google-red/10 text-google-red border border-google-red/20'}`}>
                                            {mission.status}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-8 py-4 md:py-5 text-gray-400 italic">~{Math.round(mission.duration || 5)}s</td>
                                    <td className="px-4 md:px-8 py-4 md:py-5 text-gray-600 font-mono text-[10px]">{new Date().toLocaleTimeString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsLab;
