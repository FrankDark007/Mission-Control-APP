
import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Lock, RefreshCw, Terminal, Search, AlertTriangle, Loader2 } from 'lucide-react';

interface Vulnerability {
    id: number;
    level: string;
    type: string;
    desc: string;
}

const SecurityLab = () => {
    const [isScanning, setIsScanning] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [threatLevel, setThreatLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('LOW');
    const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);

    const runNeuralAudit = async () => {
        setIsScanning(true);
        setReport(null);
        setVulnerabilities([]);
        try {
            const res = await fetch('/api/audit/security', { method: 'POST' });
            const data = await res.json();
            setReport(data.report);
            
            // Parse vulnerabilities from checks array
            if (data.checks && data.checks.length > 0) {
                const vulns = data.checks.map((check: any, i: number) => ({
                    id: i + 1,
                    level: check.level || 'warn',
                    type: check.type || 'Unknown',
                    desc: check.desc || check.description || 'No details available'
                }));
                setVulnerabilities(vulns);
            }
            
            // Determine threat level from report content
            const reportLower = (data.report || '').toLowerCase();
            if (reportLower.includes('critical')) {
                setThreatLevel('CRITICAL');
            } else if (reportLower.includes('high')) {
                setThreatLevel('HIGH');
            } else if (reportLower.includes('medium') || reportLower.includes('vulnerability')) {
                setThreatLevel('MEDIUM');
            } else {
                setThreatLevel('LOW');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsScanning(false);
        }
    };

    const getThreatColor = (level: string) => {
        switch (level.toLowerCase()) {
            case 'critical': return 'google-red';
            case 'high': return 'google-red';
            case 'medium': case 'warn': return 'google-yellow';
            default: return 'google-green';
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">Security Intelligence</h2>
                    <p className="text-sm text-gray-500 font-medium">Neural perimeter monitoring, trust boundary auditing, and autonomous patching.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={runNeuralAudit}
                        disabled={isScanning}
                        className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${isScanning ? 'bg-dark-800 text-gray-500' : 'bg-google-red text-white'}`}
                    >
                        {isScanning ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                        Neural Deep Scan
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Vulnerability Feed */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8 flex flex-col h-full">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Live Threat Registry</h3>
                            {isScanning && <span className="bg-google-red/10 text-google-red border border-google-red/20 px-3 py-1 rounded-full text-[8px] font-black uppercase animate-pulse">Scanning Active</span>}
                        </div>
                        
                        <div className="space-y-4 flex-1">
                            {vulnerabilities.length > 0 ? vulnerabilities.map(vuln => (
                                <div key={vuln.id} className="p-6 bg-dark-900 rounded-3xl border border-dark-700 hover:border-google-red/30 transition-all group relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 w-20 h-20 bg-${getThreatColor(vuln.level)}/5 blur-2xl -mr-10 -mt-10`} />
                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`p-3 rounded-xl shadow-lg bg-${getThreatColor(vuln.level)}/20 text-${getThreatColor(vuln.level)}`}>
                                            <ShieldAlert size={20} />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] font-black uppercase text-gray-600 mb-1 tracking-widest">Risk Index</div>
                                            <div className={`text-[10px] font-black uppercase text-${getThreatColor(vuln.level)}`}>{vuln.level}</div>
                                        </div>
                                    </div>
                                    <h4 className="text-sm font-black text-white mb-2 relative z-10">{vuln.type}</h4>
                                    <p className="text-[11px] text-gray-500 leading-relaxed font-medium relative z-10 italic">"{vuln.desc}"</p>
                                </div>
                            )) : (
                                <div className="p-10 text-center opacity-30">
                                    <ShieldCheck size={48} className="mx-auto mb-4 text-google-green" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Run scan to detect threats</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${threatLevel === 'LOW' ? 'bg-google-green' : threatLevel === 'MEDIUM' ? 'bg-google-yellow animate-pulse' : 'bg-google-red animate-ping'}`} />
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Global Threat Level: <span className={threatLevel === 'LOW' ? 'text-google-green' : threatLevel === 'MEDIUM' ? 'text-google-yellow' : 'text-google-red'}>{threatLevel}</span></div>
                        </div>
                    </div>
                </div>

                {/* Audit Report Area */}
                <div className="lg:col-span-2 flex flex-col h-full">
                    <div className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col flex-1 overflow-hidden relative">
                        <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-google-blue/10 rounded-xl border border-google-blue/20">
                                    <Terminal className="text-google-blue" size={20} />
                                </div>
                                <h3 className="text-xl font-black text-white">Neural Scan Output</h3>
                            </div>
                            {report && <span className="text-[9px] font-black uppercase text-google-green bg-google-green/10 border border-google-green/30 px-4 py-1.5 rounded-full flex items-center gap-2"><ShieldCheck size={12} /> Scan Complete</span>}
                        </div>
                        
                        <div className="p-10 flex-1 min-h-[500px] overflow-y-auto font-mono text-xs leading-relaxed scrollbar-hide">
                            {isScanning ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-40 text-center gap-8">
                                    <div className="relative">
                                        <RefreshCw size={64} className="animate-spin text-google-blue" />
                                        <ShieldAlert size={24} className="absolute inset-0 m-auto text-google-blue" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-black uppercase tracking-[0.3em] text-white">Neural Analysis In Progress</p>
                                        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-widest animate-pulse">Deconstructing model trust boundaries...</p>
                                    </div>
                                </div>
                            ) : report ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="bg-dark-900 p-10 rounded-3xl border border-dark-700 text-gray-300 whitespace-pre-wrap font-mono leading-relaxed text-[11px] shadow-inner border-l-4 border-l-google-blue">
                                        {report}
                                    </div>
                                    <div className="mt-8 flex gap-4">
                                        <button className="bg-google-blue text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">Download Audit Log</button>
                                        <button className="text-gray-500 hover:text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Archive Report</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-10 text-center gap-8">
                                    <Lock size={80} className="text-gray-500" />
                                    <div className="space-y-2">
                                        <p className="text-sm font-black uppercase tracking-[0.3em]">Neural Firewall Locked</p>
                                        <p className="text-[10px] uppercase font-bold text-gray-600 tracking-widest">Execute Deep Scan to retrieve tactical intelligence.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-8 border-t border-dark-700 bg-dark-900/50 grid grid-cols-2 gap-8 shrink-0">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-google-green/10 flex items-center justify-center text-google-green border border-google-green/20 shadow-lg">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Neural Firewall</div>
                                    <div className="text-sm font-black text-white">ACTIVE SECURE</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 rounded-2xl bg-google-yellow/10 flex items-center justify-center text-google-yellow border border-google-yellow/20 shadow-lg">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <div className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Vulnerabilities Found</div>
                                    <div className="text-sm font-black text-white">{vulnerabilities.length} DETECTED</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityLab;
