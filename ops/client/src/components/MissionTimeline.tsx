
import React, { useMemo, useState } from 'react';
import { Clock, Zap, CheckCircle, AlertCircle, Bot, Layers, ArrowRight, Link, GitCommit } from 'lucide-react';
import { QueueResponse, TaskDefinition } from '../types';

interface MissionTimelineProps {
    queue: QueueResponse;
}

const MissionTimeline: React.FC<MissionTimelineProps> = ({ queue }) => {
    const [hoveredTaskId, setHoveredTaskId] = useState<number | null>(null);

    const allTasks = useMemo(() => {
        const history = [...queue.history].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
        return [...queue.activeTasks, ...history].slice(0, 20);
    }, [queue.activeTasks, queue.history]);

    const getRelationship = (taskId: number) => {
        if (!hoveredTaskId) return 'none';
        if (taskId === hoveredTaskId) return 'current';

        const hoveredTask = allTasks.find(t => t.id === hoveredTaskId);
        const currentTask = allTasks.find(t => t.id === taskId);

        if (hoveredTask?.dependencies?.includes(taskId)) return 'dependency';
        if (currentTask?.dependencies?.includes(hoveredTaskId)) return 'dependent';

        return 'unrelated';
    };

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

            <div className="space-y-4 relative z-10">
                {allTasks.map((task, i) => {
                    const relation = getRelationship(task.id);
                    const isProcessing = task.status === 'processing';

                    return (
                        <div
                            key={task.id}
                            onMouseEnter={() => setHoveredTaskId(task.id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                            className={`group relative transition-all duration-300 ${
                                hoveredTaskId && relation === 'unrelated' ? 'opacity-30 blur-[1px] scale-95' : 'opacity-100 scale-100'
                            }`}
                        >
                            <div className={`
                                flex gap-4 md:gap-6 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border transition-all relative overflow-hidden
                                ${relation === 'current' ? 'bg-dark-800 border-white/20 shadow-2xl scale-[1.02]' :
                                  relation === 'dependency' ? 'bg-google-yellow/5 border-google-yellow/50 shadow-[0_0_15px_rgba(251,188,4,0.1)]' :
                                  relation === 'dependent' ? 'bg-google-blue/5 border-google-blue/50 shadow-[0_0_15px_rgba(26,115,232,0.1)]' :
                                  'bg-dark-900/40 border-dark-700 hover:border-dark-600'}
                            `}>
                                <div className="flex flex-col items-center shrink-0 pt-2 relative">
                                    {relation === 'dependency' && (
                                        <div className="absolute -left-8 md:-left-10 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-dark-900 border border-google-yellow rounded-full text-google-yellow shadow-xl z-20 animate-in slide-in-from-right-2">
                                            <ArrowRight size={12} className="-rotate-90" />
                                        </div>
                                    )}
                                    {relation === 'dependent' && (
                                        <div className="absolute -left-8 md:-left-10 top-1/2 -translate-y-1/2 p-1.5 md:p-2 bg-dark-900 border border-google-blue rounded-full text-google-blue shadow-xl z-20 animate-in slide-in-from-right-2">
                                            <ArrowRight size={12} className="rotate-90" />
                                        </div>
                                    )}

                                    <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl border shadow-lg transition-all ${
                                        task.status === 'processing' ? 'bg-google-blue/20 border-google-blue text-google-blue' :
                                        task.status === 'completed' ? 'bg-google-green/10 border-google-green/30 text-google-green' :
                                        'bg-google-red/10 border-google-red/30 text-google-red'
                                    }`}>
                                        {task.status === 'processing' ? <Zap size={16} className="md:w-[18px] md:h-[18px] animate-pulse" /> :
                                         task.status === 'completed' ? <CheckCircle size={16} className="md:w-[18px] md:h-[18px]" /> :
                                         <AlertCircle size={16} className="md:w-[18px] md:h-[18px]" />}
                                    </div>

                                    {i < allTasks.length - 1 && (
                                        <div className="w-px flex-1 bg-dark-700 my-2 border-l border-dashed border-gray-700 opacity-30 group-hover:opacity-50 transition-opacity" />
                                    )}
                                </div>

                                <div className="flex-1 space-y-3 relative z-10">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                        <div>
                                            {relation === 'dependency' && (
                                                <div className="text-[9px] font-black uppercase text-google-yellow mb-1 animate-pulse flex items-center gap-1">
                                                    <Link size={10} /> Prerequisite for Selection
                                                </div>
                                            )}
                                            {relation === 'dependent' && (
                                                <div className="text-[9px] font-black uppercase text-google-blue mb-1 animate-pulse flex items-center gap-1">
                                                    <Link size={10} /> Dependent on Selection
                                                </div>
                                            )}

                                            <h4 className="text-sm font-bold text-white leading-tight">{task.name}</h4>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] font-mono text-gray-500">#{task.id}</span>
                                                {task.agentId && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black uppercase text-google-blue bg-google-blue/5 px-2 py-0.5 rounded">
                                                        <Bot size={10} /> {task.agentId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <div className="text-[9px] font-black uppercase text-gray-600">Status</div>
                                            <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                task.status === 'completed' ? 'text-google-green' :
                                                task.status === 'processing' ? 'text-google-blue' : 'text-google-red'
                                            }`}>
                                                {task.status}
                                            </div>
                                            <div className="text-[9px] font-mono text-gray-600 mt-1">
                                                {new Date(task.created || 0).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                                        <div className="px-2 py-1 bg-dark-800 rounded border border-dark-700 text-[9px] font-black uppercase text-gray-500">
                                            {task.type}
                                        </div>
                                        {task.dependencies && task.dependencies.length > 0 && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[8px] font-black uppercase text-gray-600 flex items-center gap-1">
                                                    <GitCommit size={8} /> Refs:
                                                </span>
                                                {task.dependencies.map(dep => (
                                                    <span
                                                        key={dep}
                                                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                                            hoveredTaskId === dep
                                                                ? 'bg-google-yellow/20 text-google-yellow border-google-yellow/50'
                                                                : 'bg-dark-800 text-gray-500 border-dark-700'
                                                        }`}
                                                    >
                                                        #{dep}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {task.error && (
                                        <div className="p-3 bg-google-red/10 border border-google-red/20 rounded-xl flex items-center gap-3">
                                            <AlertCircle size={14} className="text-google-red shrink-0" />
                                            <p className="text-[10px] font-bold text-google-red uppercase tracking-tight">{task.error}</p>
                                        </div>
                                    )}

                                    {isProcessing && (
                                        <div className="pt-2">
                                            <div className="text-[8px] font-black uppercase text-google-blue mb-1 flex justify-between">
                                                <span>Processing Velocity</span>
                                                <span className="animate-pulse">Active Thread</span>
                                            </div>
                                            <svg width="100%" height="6" className="rounded-full bg-dark-800 overflow-hidden">
                                                <rect width="100%" height="100%" fill="#1f2937" />
                                                <rect width="40%" height="100%" fill="#1a73e8" rx="3">
                                                    <animate attributeName="x" from="-40%" to="100%" dur="0.8s" repeatCount="indefinite" />
                                                    <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite" />
                                                </rect>
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

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
