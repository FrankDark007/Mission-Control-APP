
import React, { useMemo } from 'react';
import { Clock, Zap, CheckCircle, AlertCircle, Bot, Layers, ArrowRight } from 'lucide-react';
import { QueueResponse, TaskDefinition } from '../types';

interface MissionTimelineProps {
    queue: QueueResponse;
}

const MissionTimeline: React.FC<MissionTimelineProps> = ({ queue }) => {
    const allTasks = useMemo(() => {
        const history = [...queue.history].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
        return [...queue.activeTasks, ...history].slice(0, 15);
    }, [queue.activeTasks, queue.history]);

    return (
        <div className="bg-dark-800 p-4 md:p-6 lg:p-10 rounded-2xl md:rounded-[2rem] lg:rounded-[3rem] border border-dark-700 shadow-2xl space-y-6 md:space-y-8 lg:space-y-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 pointer-events-none">
                <Clock className="w-16 h-16 md:w-24 md:h-24 lg:w-[120px] lg:h-[120px]" />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative z-10">
                <div className="flex items-center gap-3 md:gap-4 lg:gap-5">
                    <div className="p-3 md:p-4 bg-google-blue/10 rounded-xl md:rounded-2xl border border-google-blue/20 shadow-lg">
                        <Clock className="text-google-blue w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">Temporal Flow</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Real-time Mission Sequencing Archive</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 bg-dark-900 px-3 md:px-4 py-2 rounded-lg md:rounded-xl border border-dark-700">
                        <div className="w-2 h-2 rounded-full bg-google-green animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-gray-500">Sync Active</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4 md:space-y-6 relative z-10">
                {allTasks.map((task, i) => (
                    <div key={task.id} className={`flex gap-3 md:gap-6 lg:gap-8 group animate-in slide-in-from-left-4 duration-500`} style={{ animationDelay: `${i * 100}ms` }}>
                        <div className="flex flex-col items-center shrink-0">
                            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl border shadow-lg transition-all group-hover:scale-110 ${task.status === 'processing' ? 'bg-google-blue/20 border-google-blue text-google-blue animate-pulse' : task.status === 'completed' ? 'bg-google-green/10 border-google-green/30 text-google-green' : 'bg-google-red/10 border-google-red/30 text-google-red'}`}>
                                {task.status === 'processing' ? <Zap className="w-4 h-4 md:w-5 md:h-5" /> : task.status === 'completed' ? <CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> : <AlertCircle className="w-4 h-4 md:w-5 md:h-5" />}
                            </div>
                            {i < allTasks.length - 1 && <div className="w-0.5 flex-1 bg-dark-700 my-2 md:my-4 border-dashed border-l" />}
                        </div>

                        <div className="flex-1 bg-dark-900/40 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-2xl lg:rounded-[2rem] border border-dark-700 group-hover:border-google-blue/30 transition-all shadow-inner relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-dark-800 border-l border-b border-dark-700 px-4 py-1.5 rounded-bl-xl text-[8px] font-black uppercase text-gray-600 tracking-tighter">
                                ID: #{task.id}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-4 md:mb-6">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-google-blue mb-1 flex items-center gap-2">
                                        <Bot size={10} /> {task.agentId || 'Global Orchestrator'} Node
                                    </div>
                                    <h4 className="text-base md:text-lg font-bold text-white leading-tight">{task.name}</h4>
                                </div>
                                <div className="text-left sm:text-right">
                                    <div className="text-[9px] font-black uppercase text-gray-600">Established</div>
                                    <div className="text-[11px] font-mono text-white mt-0.5">{new Date(task.created || 0).toLocaleTimeString()}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                                <div className="space-y-1">
                                    <div className="text-[8px] font-black uppercase text-gray-600">Mission Type</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter bg-dark-800 px-2 py-0.5 rounded w-fit border border-dark-700">{task.type}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="text-[8px] font-black uppercase text-gray-600">Cycle State</div>
                                    <div className={`text-[10px] font-black uppercase tracking-widest ${task.status === 'completed' ? 'text-google-green' : 'text-google-blue'}`}>{task.status}</div>
                                </div>
                                {task.startTime && (
                                    <div className="space-y-1">
                                        <div className="text-[8px] font-black uppercase text-gray-600">Exec Start</div>
                                        <div className="text-[10px] font-mono text-gray-400">{new Date(task.startTime).toLocaleTimeString()}</div>
                                    </div>
                                )}
                                {task.endTime && (
                                    <div className="space-y-1">
                                        <div className="text-[8px] font-black uppercase text-gray-600">Verification</div>
                                        <div className="text-[10px] font-mono text-google-green">{new Date(task.endTime).toLocaleTimeString()}</div>
                                    </div>
                                )}
                            </div>

                            {task.error && (
                                <div className="mt-4 md:mt-6 p-3 md:p-4 bg-google-red/10 border border-google-red/20 rounded-lg md:rounded-xl flex items-center gap-3">
                                    <AlertCircle size={14} className="text-google-red shrink-0" />
                                    <p className="text-[10px] font-bold text-google-red uppercase tracking-tight">{task.error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {allTasks.length === 0 && (
                    <div className="py-12 md:py-20 flex flex-col items-center justify-center text-center opacity-10 space-y-4">
                        <Layers className="w-12 h-12 md:w-16 md:h-16" />
                        <p className="text-xs md:text-sm font-black uppercase tracking-widest">Temporal Log Empty</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MissionTimeline;
