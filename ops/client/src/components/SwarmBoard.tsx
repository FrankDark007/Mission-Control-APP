
import React, { useState } from 'react';
import { Layers, Plus, Zap, Clock, CheckCircle, ArrowRight, Bot, GitBranch, Cpu, Loader2, Sparkles, Trash2, History } from 'lucide-react';
import { QueueResponse, TaskDefinition } from '../types';

interface SwarmBoardProps {
    queue: QueueResponse;
    onAddTask: (task: any) => void;
    onSproutAgent: (data: any) => void;
}

const SwarmBoard: React.FC<SwarmBoardProps> = ({ queue, onAddTask, onSproutAgent }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTask, setNewTask] = useState({ name: '', type: 'feature' });
    const [sproutData, setSproutData] = useState({ parentId: 'design', taskName: '', branchName: '' });

    const handleSprout = () => {
        if (!sproutData.taskName || !sproutData.branchName) return;
        onSproutAgent(sproutData);
        setSproutData({ parentId: 'design', taskName: '', branchName: '' });
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Mission Board</h2>
                    <p className="text-sm text-gray-500 font-medium">Orchestrate multi-agent workflows and autonomous worktrees.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => setIsAdding(!isAdding)}
                        className="bg-google-blue text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all hover:scale-105"
                    >
                        <Plus size={18} /> Initiate Mission
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sprout Control */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-google-blue/10 rounded-lg"><Cpu className="text-google-blue" size={16} /></div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Agent Sprouter</h3>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 px-1">Host Agent</label>
                                <select 
                                    value={sproutData.parentId}
                                    onChange={e => setSproutData({...sproutData, parentId: e.target.value})}
                                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-xs text-white outline-none focus:border-google-blue"
                                >
                                    <option value="design">Design Core</option>
                                    <option value="seo">SEO Optimizer</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 px-1">Sub-Task Name</label>
                                <input 
                                    value={sproutData.taskName}
                                    onChange={e => setSproutData({...sproutData, taskName: e.target.value})}
                                    placeholder="UI Polish Sub-mission"
                                    className="w-full bg-dark-900 border border-dark-700 p-3 rounded-xl text-xs text-white outline-none focus:border-google-blue"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-gray-600 px-1">Isolated Branch</label>
                                <div className="relative">
                                    <GitBranch className="absolute left-3 top-3 text-gray-600" size={12} />
                                    <input 
                                        value={sproutData.branchName}
                                        onChange={e => setSproutData({...sproutData, branchName: e.target.value})}
                                        placeholder="feat/ui-polish"
                                        className="w-full bg-dark-900 border border-dark-700 pl-8 pr-3 py-3 rounded-xl text-xs text-white outline-none focus:border-google-blue"
                                    />
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={handleSprout}
                            className="w-full py-4 bg-google-blue text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                        >
                            <Sparkles size={14} /> Sprout Sub-Agent
                        </button>
                    </div>

                    <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 text-center opacity-50">
                        <History size={32} className="mx-auto mb-4 text-gray-700" />
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600">History: {queue.history.length} Tasks</p>
                    </div>
                </div>

                {/* Mission Columns */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Column: Queue */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Awaiting Analysis</h3>
                            <span className="bg-dark-800 px-3 py-1 rounded-full text-[9px] font-black text-gray-500 border border-dark-700">{queue.queue.length}</span>
                        </div>
                        <div className="space-y-4">
                            {queue.queue.map(task => (
                                <div key={task.id} className="bg-dark-800 p-5 rounded-3xl border border-dark-700 shadow-xl group hover:border-google-blue/30 transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-[8px] font-black px-2 py-0.5 bg-dark-900 rounded border border-dark-700 text-gray-500 uppercase">{task.type}</div>
                                        <div className="text-[8px] font-mono text-gray-700">#{task.id}</div>
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-2">{task.name}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-600 font-medium">
                                        <Clock size={10} /> Pending Start
                                    </div>
                                </div>
                            ))}
                            {queue.queue.length === 0 && (
                                <div className="py-12 border-2 border-dashed border-dark-800 rounded-3xl text-center opacity-20">
                                    <Layers size={32} className="mx-auto mb-2" />
                                    <p className="text-[8px] font-black uppercase">Queue Dry</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column: Active */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-google-blue">Engaging Sequence</h3>
                            <span className="bg-google-blue/10 px-3 py-1 rounded-full text-[9px] font-black text-google-blue border border-google-blue/20">{queue.activeTasks.length}</span>
                        </div>
                        <div className="space-y-4">
                            {queue.activeTasks.map(task => (
                                <div key={task.id} className="bg-dark-800 p-5 rounded-3xl border-2 border-google-blue shadow-[0_0_20px_rgba(26,115,232,0.1)] relative overflow-hidden animate-pulse">
                                    <div className="absolute top-0 right-0 p-3">
                                        <Loader2 size={12} className="animate-spin text-google-blue" />
                                    </div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-[8px] font-black px-2 py-0.5 bg-google-blue/20 rounded border border-google-blue/30 text-google-blue uppercase">{task.type}</div>
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-4">{task.name}</h4>
                                    <div className="w-full bg-dark-900 h-1.5 rounded-full overflow-hidden">
                                        <div className="h-full bg-google-blue w-2/3 animate-shimmer" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column: Success */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-google-green">Mission Success</h3>
                            <span className="bg-google-green/10 px-3 py-1 rounded-full text-[9px] font-black text-google-green border border-google-green/20">{queue.history.filter(t => t.status === 'completed').length}</span>
                        </div>
                        <div className="space-y-4">
                            {queue.history.filter(t => t.status === 'completed').slice(-5).map(task => (
                                <div key={task.id} className="bg-dark-800 p-5 rounded-3xl border border-dark-700 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[8px] font-black px-2 py-0.5 bg-google-green/10 rounded border border-google-green/30 text-google-green uppercase">Resolved</div>
                                        <CheckCircle size={14} className="text-google-green" />
                                    </div>
                                    <h4 className="text-sm font-bold text-white mb-1">{task.name}</h4>
                                    <p className="text-[9px] text-gray-500 font-mono">Completed at {new Date(task.endTime || '').toLocaleTimeString()}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SwarmBoard;
