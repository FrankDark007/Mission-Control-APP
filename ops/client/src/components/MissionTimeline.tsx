
import React, { useMemo, useState, useEffect } from 'react';
import { Clock, Zap, CheckCircle, AlertCircle, Bot, Layers, ArrowRight, Link, GitCommit, Brain, Package } from 'lucide-react';
import { QueueResponse, TaskDefinition } from '../types';

interface BridgeTask {
    id: string;
    projectId: string;
    title: string;
    instructions: string;
    priority: string;
    status: string;
    createdBy: string;
    createdByModel: string;
    createdAt: string;
    progress: number;
    artifacts: string[];
}

interface BridgeArtifact {
    id: string;
    projectId: string;
    type: string;
    name: string;
    description: string;
    createdBy: string;
    createdAt: string;
}

interface MissionTimelineProps {
    queue: QueueResponse;
}

const MissionTimeline: React.FC<MissionTimelineProps> = ({ queue }) => {
    const [hoveredTaskId, setHoveredTaskId] = useState<string | number | null>(null);
    const [bridgeTasks, setBridgeTasks] = useState<BridgeTask[]>([]);
    const [bridgeArtifacts, setBridgeArtifacts] = useState<BridgeArtifact[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'queue' | 'director' | 'artifacts'>('all');

    // Fetch Claude Code Bridge data
    useEffect(() => {
        const fetchBridgeData = async () => {
            try {
                const [tasksRes, artifactsRes] = await Promise.all([
                    fetch('/api/bridge/tasks'),
                    fetch('/api/bridge/artifacts')
                ]);
                const tasksData = await tasksRes.json();
                const artifactsData = await artifactsRes.json();
                setBridgeTasks(tasksData.tasks || []);
                setBridgeArtifacts(artifactsData.artifacts || []);
            } catch (e) {
                console.error('Failed to fetch bridge data:', e);
            }
        };

        fetchBridgeData();
        const interval = setInterval(fetchBridgeData, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, []);

    const queueTasks = useMemo(() => {
        const history = [...queue.history].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
        return [...queue.activeTasks, ...history].slice(0, 20).map(t => ({
            ...t,
            source: 'queue' as const
        }));
    }, [queue.activeTasks, queue.history]);

    const directorTasks = useMemo(() => {
        return bridgeTasks.map(t => ({
            id: t.id,
            name: t.title,
            type: 'director',
            status: t.status === 'pending' ? 'pending' : t.status === 'in_progress' ? 'processing' : t.status,
            created: t.createdAt,
            agentId: t.createdBy,
            progress: t.progress,
            source: 'director' as const,
            priority: t.priority,
            projectId: t.projectId
        }));
    }, [bridgeTasks]);

    const allItems = useMemo(() => {
        let items: any[] = [];

        if (activeTab === 'all' || activeTab === 'queue') {
            items = [...items, ...queueTasks];
        }
        if (activeTab === 'all' || activeTab === 'director') {
            items = [...items, ...directorTasks];
        }
        if (activeTab === 'artifacts') {
            items = bridgeArtifacts.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                status: 'artifact',
                created: a.createdAt,
                agentId: a.createdBy,
                source: 'artifact' as const,
                description: a.description
            }));
        }

        return items.sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()).slice(0, 30);
    }, [queueTasks, directorTasks, bridgeArtifacts, activeTab]);

    const getRelationship = (taskId: string | number) => {
        if (!hoveredTaskId) return 'none';
        if (taskId === hoveredTaskId) return 'current';
        return 'unrelated';
    };

    const getStatusColor = (status: string, source: string) => {
        if (source === 'artifact') return 'bg-purple-500/20 border-purple-500 text-purple-400';
        if (source === 'director') {
            if (status === 'pending') return 'bg-google-yellow/20 border-google-yellow text-google-yellow';
            if (status === 'processing' || status === 'in_progress') return 'bg-google-blue/20 border-google-blue text-google-blue';
            if (status === 'completed') return 'bg-google-green/10 border-google-green/30 text-google-green';
            return 'bg-google-red/10 border-google-red/30 text-google-red';
        }
        if (status === 'processing') return 'bg-google-blue/20 border-google-blue text-google-blue';
        if (status === 'completed') return 'bg-google-green/10 border-google-green/30 text-google-green';
        return 'bg-google-red/10 border-google-red/30 text-google-red';
    };

    const getStatusIcon = (status: string, source: string) => {
        if (source === 'artifact') return <Package size={16} className="md:w-[18px] md:h-[18px]" />;
        if (source === 'director') return <Brain size={16} className="md:w-[18px] md:h-[18px]" />;
        if (status === 'processing') return <Zap size={16} className="md:w-[18px] md:h-[18px] animate-pulse" />;
        if (status === 'completed') return <CheckCircle size={16} className="md:w-[18px] md:h-[18px]" />;
        return <AlertCircle size={16} className="md:w-[18px] md:h-[18px]" />;
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
                <div className="flex gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-dark-900 px-3 md:px-4 py-2 rounded-lg md:rounded-xl border border-dark-700">
                        <div className="w-2 h-2 rounded-full bg-google-green animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-gray-500">Sync Active</span>
                    </div>
                    <div className="flex items-center gap-1 bg-dark-900 px-2 py-1 rounded-lg border border-dark-700">
                        <span className="text-[9px] font-black text-google-blue">{directorTasks.length}</span>
                        <Brain size={10} className="text-google-blue" />
                    </div>
                    <div className="flex items-center gap-1 bg-dark-900 px-2 py-1 rounded-lg border border-dark-700">
                        <span className="text-[9px] font-black text-purple-400">{bridgeArtifacts.length}</span>
                        <Package size={10} className="text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Tab Filters */}
            <div className="flex gap-2 flex-wrap">
                {(['all', 'queue', 'director', 'artifacts'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                            activeTab === tab
                                ? 'bg-google-blue text-white'
                                : 'bg-dark-900 text-gray-500 hover:text-white border border-dark-700'
                        }`}
                    >
                        {tab === 'all' ? 'All Activity' :
                         tab === 'queue' ? 'Queue Tasks' :
                         tab === 'director' ? 'Director Tasks' : 'Artifacts'}
                    </button>
                ))}
            </div>

            <div className="space-y-4 relative z-10">
                {allItems.map((task, i) => {
                    const relation = getRelationship(task.id);
                    const isProcessing = task.status === 'processing' || task.status === 'in_progress';

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
                                  task.source === 'director' ? 'bg-google-blue/5 border-google-blue/20' :
                                  task.source === 'artifact' ? 'bg-purple-500/5 border-purple-500/20' :
                                  'bg-dark-900/40 border-dark-700 hover:border-dark-600'}
                            `}>
                                <div className="flex flex-col items-center shrink-0 pt-2 relative">
                                    <div className={`p-2.5 md:p-3 rounded-xl md:rounded-2xl border shadow-lg transition-all ${getStatusColor(task.status, task.source)}`}>
                                        {getStatusIcon(task.status, task.source)}
                                    </div>

                                    {i < allItems.length - 1 && (
                                        <div className="w-px flex-1 bg-dark-700 my-2 border-l border-dashed border-gray-700 opacity-30 group-hover:opacity-50 transition-opacity" />
                                    )}
                                </div>

                                <div className="flex-1 space-y-3 relative z-10">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                        <div className="flex-1">
                                            {task.source === 'director' && (
                                                <div className="text-[9px] font-black uppercase text-google-blue mb-1 flex items-center gap-1">
                                                    <Brain size={10} /> Director Task
                                                </div>
                                            )}
                                            {task.source === 'artifact' && (
                                                <div className="text-[9px] font-black uppercase text-purple-400 mb-1 flex items-center gap-1">
                                                    <Package size={10} /> Generated Artifact
                                                </div>
                                            )}

                                            <h4 className="text-sm font-bold text-white leading-tight">{task.name || 'Unnamed Task'}</h4>
                                            {task.description && (
                                                <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <span className="text-[9px] font-mono text-gray-500">#{typeof task.id === 'string' ? task.id.slice(-8) : task.id}</span>
                                                {task.agentId && (
                                                    <span className="flex items-center gap-1 text-[9px] font-black uppercase text-google-blue bg-google-blue/5 px-2 py-0.5 rounded">
                                                        <Bot size={10} /> {task.agentId}
                                                    </span>
                                                )}
                                                {task.projectId && (
                                                    <span className="text-[9px] font-mono text-gray-600 bg-dark-800 px-2 py-0.5 rounded">
                                                        {task.projectId}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <div className="text-[9px] font-black uppercase text-gray-600">Status</div>
                                            <div className={`text-[10px] font-black uppercase tracking-widest ${
                                                task.status === 'completed' ? 'text-google-green' :
                                                task.status === 'processing' || task.status === 'in_progress' ? 'text-google-blue' :
                                                task.status === 'pending' ? 'text-google-yellow' :
                                                task.status === 'artifact' ? 'text-purple-400' :
                                                'text-google-red'
                                            }`}>
                                                {task.status}
                                            </div>
                                            <div className="text-[9px] font-mono text-gray-600 mt-1">
                                                {new Date(task.created || 0).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                                        <div className={`px-2 py-1 rounded border text-[9px] font-black uppercase ${
                                            task.source === 'director' ? 'bg-google-blue/10 border-google-blue/30 text-google-blue' :
                                            task.source === 'artifact' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
                                            'bg-dark-800 border-dark-700 text-gray-500'
                                        }`}>
                                            {task.type || task.source}
                                        </div>
                                        {task.priority && task.priority !== 'normal' && (
                                            <div className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                                                task.priority === 'critical' ? 'bg-google-red/20 text-google-red' :
                                                task.priority === 'high' ? 'bg-google-yellow/20 text-google-yellow' :
                                                'bg-dark-800 text-gray-500'
                                            }`}>
                                                {task.priority}
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
                                                <rect width={`${task.progress || 40}%`} height="100%" fill="#1a73e8" rx="3">
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

                {allItems.length === 0 && (
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
