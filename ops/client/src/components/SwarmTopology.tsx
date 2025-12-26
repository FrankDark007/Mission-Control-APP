
import React from 'react';
import { Bot, Workflow, ChevronRight, Zap, Shield, Cpu } from 'lucide-react';

interface SwarmTopologyProps {
    agents: Record<string, any>;
    status: Record<string, string>;
    subAgents: Record<string, any>;
}

const SwarmTopology: React.FC<SwarmTopologyProps> = ({ agents, status, subAgents }) => {
    return (
        <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-google-blue via-google-red to-google-yellow opacity-30" />
            
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 bg-dark-900 rounded-xl border border-dark-700">
                    <Workflow className="text-google-blue" size={20} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Swarm Topology</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Live Agent Hierarchy Mapping</p>
                </div>
            </div>

            <div className="flex flex-col gap-12 relative">
                {/* Connector Line for Main Node */}
                <div className="absolute left-10 top-16 bottom-16 w-px bg-dark-700 border-dashed border-l" />

                <div className="flex items-center gap-6 z-10">
                    <div className="w-20 h-20 bg-google-blue rounded-[2rem] shadow-[0_0_30px_rgba(26,115,232,0.3)] flex items-center justify-center border-4 border-white/10 shrink-0">
                        <Shield className="text-white" size={32} />
                    </div>
                    <div>
                        <div className="text-lg font-black text-white">Mission Core</div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-google-blue">Orchestration Layer</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 pl-24">
                    {Object.entries(agents).map(([id, config]) => (
                        <div key={id} className="relative flex items-center gap-6 group">
                            {/* Connector Horizontal */}
                            <div className="absolute -left-14 w-14 h-px bg-dark-700 border-dashed border-t" />
                            
                            <div className={`p-4 rounded-2xl border-2 transition-all group-hover:scale-110 ${status[id] === 'running' ? 'bg-dark-900 border-google-green text-google-green shadow-[0_0_15px_rgba(52,168,83,0.2)]' : 'bg-dark-900 border-dark-700 text-gray-600'}`}>
                                <Bot size={24} />
                            </div>
                            <div>
                                <div className="text-sm font-black text-white">{config.name}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-gray-500">{config.role || 'Primary Agent'}</div>
                            </div>

                            {/* Show Sub-threads belonging to this agent */}
                            {Object.entries(subAgents).filter(([subId, sub]) => sub.parentId === id).map(([subId, sub]) => (
                                <div key={subId} className="absolute top-12 left-4 flex flex-col items-center gap-2 animate-in slide-in-from-top-2">
                                    <div className="w-px h-6 bg-dark-700" />
                                    <div className="p-2 bg-google-blue/10 border border-google-blue/30 rounded-lg">
                                        <Zap className="text-google-blue" size={12} />
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-tighter text-google-blue whitespace-nowrap">{sub.taskName}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                    
                    {/* Placeholder for Dynamic Expansion */}
                    <div className="relative flex items-center gap-6 opacity-20 group">
                         <div className="absolute -left-14 w-14 h-px bg-dark-700 border-dashed border-t" />
                         <div className="p-4 rounded-2xl border-2 border-dashed border-dark-700 text-gray-700">
                             <Cpu size={24} />
                         </div>
                         <div className="text-[9px] font-black uppercase tracking-widest text-gray-700">Awaiting Sprout</div>
                    </div>
                </div>
            </div>

            <div className="mt-16 pt-8 border-t border-dark-700 flex justify-between items-center">
                <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-google-green shadow-[0_0_8px_rgba(52,168,83,0.8)]" />
                        <span className="text-[8px] font-black uppercase text-gray-500">Active Link</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-dark-700" />
                        <span className="text-[8px] font-black uppercase text-gray-500">Idle State</span>
                    </div>
                </div>
                <div className="text-[8px] font-black uppercase text-gray-700 tracking-widest">Topology v1.4 • Swarm Sync 100%</div>
            </div>
        </div>
    );
};

export default SwarmTopology;
