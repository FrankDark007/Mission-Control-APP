
import React, { useState } from 'react';
import { Swords, Brain, Zap, Loader2, MessageSquare, Gavel } from 'lucide-react';

const ConsensusLab = () => {
    const [topic, setTopic] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [result, setResult] = useState<any>(null);

    const runDebate = async () => {
        if (!topic.trim()) return;
        setIsThinking(true);
        setResult(null);
        try {
            const res = await fetch('/api/consensus/debate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });
            const data = await res.json();
            setResult(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">Swarm Consensus</h2>
                    <p className="text-sm text-gray-500 font-medium">Resolve architectural conflicts via multi-agent technical debate.</p>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-dark-700">
                    <Swords className="text-google-blue" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Debate Matrix Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <MessageSquare size={12} className="text-google-yellow" /> Debate Subject
                            </label>
                            <textarea 
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm h-48 resize-none shadow-inner"
                                placeholder="Should we migrate the mission queue to Redis for horizontal scalability?"
                            />
                        </div>

                        <button 
                            onClick={runDebate}
                            disabled={isThinking || !topic.trim()}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all ${isThinking ? 'bg-dark-700 text-gray-500' : 'bg-google-blue text-white hover:scale-[1.02]'}`}
                        >
                            {isThinking ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
                            Engage Consensus
                        </button>

                        <div className="pt-6 border-t border-dark-700 space-y-4">
                            <h4 className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Participants</h4>
                            <div className="space-y-2">
                                {['The Pragmatist', 'The Visionary', 'The Skeptic'].map(p => (
                                    <div key={p} className="flex items-center gap-3 p-3 bg-dark-900 rounded-xl border border-dark-700">
                                        <div className={`w-2 h-2 rounded-full ${p.includes('Pragmatist') ? 'bg-google-green' : p.includes('Visionary') ? 'bg-google-blue' : 'bg-google-red'}`} />
                                        <span className="text-[10px] font-bold text-white">{p}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8 h-full">
                    {isThinking ? (
                        <div className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl h-full p-20 flex flex-col items-center justify-center text-center gap-6">
                            <div className="relative">
                                <Brain size={80} className="text-google-blue animate-pulse" />
                                <div className="absolute inset-0 animate-ping opacity-20"><Brain size={80} className="text-google-blue" /></div>
                            </div>
                            <h3 className="text-xl font-black text-white">Orchestrating Debate...</h3>
                        </div>
                    ) : result ? (
                        <div className="space-y-8 animate-in slide-in-from-right-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {result.debate.map((arg: any, i: number) => (
                                    <div key={i} className="bg-dark-800 p-6 rounded-3xl border border-dark-700 shadow-xl space-y-2">
                                        <span className="text-[9px] font-black uppercase text-gray-500">{arg.agent}</span>
                                        <p className="text-[10px] leading-relaxed text-gray-300 italic">"{arg.content}"</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-dark-800 rounded-[2.5rem] border border-google-yellow/30 shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-google-yellow/5">
                                    <div className="flex items-center gap-4">
                                        <Gavel className="text-google-yellow" size={24} />
                                        <h3 className="text-xl font-black text-white">Tactical Verdict</h3>
                                    </div>
                                    <span className="text-[10px] font-black text-google-yellow border border-google-yellow/30 px-3 py-1 rounded-full uppercase">Binding</span>
                                </div>
                                <div className="p-10 font-mono text-xs leading-relaxed text-gray-200 whitespace-pre-wrap">
                                    {result.verdict}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-dark-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <Swords size={64} className="mb-6" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Decision Matrix Awaiting Subject</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConsensusLab;
