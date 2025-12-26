import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Zap, CheckCircle2, XCircle, Clock, Activity, Users, Box, Layers, Brain, Sparkles, Loader2, RefreshCw } from 'lucide-react';

const AnalyticsLab = () => {
    const [data, setData] = useState<any>(null);
    const [briefing, setBriefing] = useState<string | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/analytics/swarm');
            const json = await res.json();
            setData(json);
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

    if (isLoading || !data) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                <Activity size={64} className="animate-spin text-google-blue" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Calibrating Analytics Matrix</p>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Swarm Analytics</h2>
                    <p className="text-sm text-gray-500 font-medium">Real-time performance evaluation and strategic briefing.</p>
                </div>
                <div className="flex gap-4 bg-dark-800 p-2 rounded-2xl border border-dark-700">
                    <div className="px-4 py-2 text-center">
                        <div className="text-[8px] font-black uppercase text-gray-500">Success Rate</div>
                        <div className="text-sm font-black text-google-green">{data.summary.successRate}%</div>
                    </div>
                    <div className="w-px h-8 bg-dark-700 self-center" />
                    <div className="px-4 py-2 text-center">
                        <div className="text-[8px] font-black uppercase text-gray-500">Total Missions</div>
                        <div className="text-sm font-black text-white">{data.summary.total}</div>
                    </div>
                </div>
            </div>

            {/* Daily Executive Briefing */}
            <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-google-blue/30 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Brain size={120} />
                </div>
                <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-google-blue/10 rounded-2xl border border-google-blue/20">
                            <Sparkles className="text-google-blue" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">Swarm Commander's Briefing</h3>
                            <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Neural Operational Intelligence</p>
                        </div>
                    </div>
                    <button 
                        onClick={fetchBriefing}
                        disabled={isBriefingLoading}
                        className="bg-dark-900 border border-dark-700 p-3 rounded-xl hover:text-google-blue transition-colors disabled:opacity-50"
                    >
                        {isBriefingLoading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    </button>
                </div>

                <div className="bg-dark-900/50 p-8 rounded-3xl border border-dark-700 min-h-[120px] relative">
                    {isBriefingLoading ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <Loader2 className="animate-spin text-google-blue" size={28} />
                            <p className="text-[10px] font-black uppercase text-gray-600 animate-pulse">Aggregating Swarm Telemetry...</p>
                        </div>
                    ) : briefing ? (
                        <p className="text-gray-300 leading-relaxed font-medium text-sm italic">
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {[
                    { label: 'Completed Missions', val: data.summary.success, icon: CheckCircle2, color: 'text-google-green' },
                    { label: 'Failed Missions', val: data.summary.failed, icon: XCircle, color: 'text-google-red' },
                    { label: 'Avg Cycle Time', val: '42s', icon: Clock, color: 'text-google-blue' },
                    { label: 'Neural Throughput', val: '1.2M', icon: Zap, color: 'text-google-yellow' },
                ].map((stat, i) => (
                    <div key={i} className="bg-dark-800 p-6 rounded-[2rem] border border-dark-700 shadow-xl flex items-center gap-6">
                        <div className={`p-4 rounded-2xl bg-dark-900 border border-dark-700 ${stat.color}`}>
                            <stat.icon size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase text-gray-500 mb-1">{stat.label}</div>
                            <div className="text-2xl font-black text-white">{stat.val}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Workload Distribution */}
                <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
                    <div className="flex items-center gap-4">
                        <Users className="text-google-blue" size={24} />
                        <h3 className="text-xl font-black text-white">Agent Load Distribution</h3>
                    </div>
                    <div className="space-y-6">
                        {data.agentWorkload.map((agent: any, i: number) => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase">
                                    <span className="text-gray-400">{agent.name}</span>
                                    <span className="text-white">{Math.round(agent.value)}%</span>
                                </div>
                                <div className="h-3 bg-dark-900 rounded-full overflow-hidden border border-dark-700">
                                    <div 
                                        className="h-full bg-google-blue transition-all duration-1000 ease-out" 
                                        style={{ width: `${agent.value}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mission Duration Trends (SVG Chart) */}
                <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
                    <div className="flex items-center gap-4">
                        <BarChart3 className="text-google-yellow" size={24} />
                        <h3 className="text-xl font-black text-white">Neural Processing Latency</h3>
                    </div>
                    <div className="h-64 w-full relative">
                        <svg className="w-full h-full overflow-visible">
                            {data.trends.map((point: any, i: number) => {
                                const x = (i / (data.trends.length - 1)) * 100;
                                const y = 100 - (point.duration / 100) * 100;
                                return (
                                    <React.Fragment key={i}>
                                        <rect 
                                            x={`${x}%`} 
                                            y={`${Math.max(0, y)}%`} 
                                            width="10" 
                                            height={`${100 - y}%`} 
                                            className={`${point.status === 'completed' ? 'fill-google-blue/40' : 'fill-google-red/40'} hover:fill-google-blue transition-all`}
                                            transform="translate(-5, 0)"
                                        />
                                    </React.Fragment>
                                );
                            })}
                        </svg>
                        <div className="absolute bottom-0 left-0 w-full h-px bg-dark-700" />
                        <div className="absolute left-0 top-0 h-full w-px bg-dark-700" />
                    </div>
                    <div className="flex justify-between text-[8px] font-black uppercase text-gray-600 px-2">
                        <span>Past 20 Missions</span>
                        <span>Current Cycle</span>
                    </div>
                </div>
            </div>

            {/* Mission Log Analytics */}
            <div className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
                    <div className="flex items-center gap-4">
                        <Layers className="text-google-green" size={24} />
                        <h3 className="text-xl font-black text-white">Strategic History Analytics</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-dark-900 border-b border-dark-700">
                                <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Mission ID</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Agent Scope</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Result</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Duration</th>
                                <th className="px-8 py-5 text-[9px] font-black uppercase text-gray-500 tracking-widest">Sync Stamp</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs">
                            {data.trends.slice(-10).reverse().map((mission: any, i: number) => (
                                <tr key={i} className="border-b border-dark-700/50 hover:bg-dark-700/20 transition-all">
                                    <td className="px-8 py-5 font-mono text-gray-400">#{mission.id}</td>
                                    <td className="px-8 py-5 font-bold text-white">Autonomous Patch</td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${mission.status === 'completed' ? 'bg-google-green/10 text-google-green' : 'bg-google-red/10 text-google-red'}`}>
                                            {mission.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 text-gray-400">{Math.round(mission.duration)}s</td>
                                    <td className="px-8 py-5 text-gray-600 font-mono text-[10px]">{new Date().toLocaleTimeString()}</td>
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
