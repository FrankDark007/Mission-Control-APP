
import React, { useState } from 'react';
import { ShieldAlert, Terminal, Check, X, Info, Zap, Edit3 } from 'lucide-react';
import { HealingProposal } from '../types';

interface RecoveryModuleProps {
    proposal: HealingProposal;
    onClose: () => void;
    onApply: (command: string) => void;
}

const RecoveryModule: React.FC<RecoveryModuleProps> = ({ proposal, onClose, onApply }) => {
    const [command, setCommand] = useState(proposal.fixCommand);
    const [isEditing, setIsEditing] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    const handleApply = async () => {
        setIsApplying(true);
        try {
            await onApply(command);
        } finally {
            setIsApplying(false);
        }
    };

    return (
        <div className="bg-dark-800 border border-google-red/30 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-w-xl w-full">
            <div className="p-8 border-b border-dark-700 flex justify-between items-start bg-google-red/5">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-google-red/20 rounded-2xl border border-google-red/40">
                        <ShieldAlert className="text-google-red" size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Neural Healing</h2>
                        <p className="text-sm text-google-red/70 font-bold uppercase tracking-widest mt-1">
                            Deviation in {proposal.agentId}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-dark-700 rounded-xl transition-colors">
                    <X size={24} className="text-gray-500" />
                </button>
            </div>

            <div className="p-10 space-y-8">
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Info size={12} className="text-google-blue" /> AI Diagnosis
                    </div>
                    <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 text-gray-300 text-sm leading-relaxed italic">
                        "{proposal.diagnosis || "Critical logic mismatch detected in runtime stream."}"
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            <Terminal size={12} className="text-google-yellow" /> Proposed Fix Command
                        </div>
                        <button 
                            onClick={() => setIsEditing(!isEditing)}
                            className="text-[9px] font-black uppercase text-google-blue hover:text-white transition-colors flex items-center gap-1"
                        >
                            <Edit3 size={10} /> {isEditing ? 'Lock Command' : 'Edit Command'}
                        </button>
                    </div>
                    {isEditing ? (
                        <textarea 
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            className="w-full bg-black font-mono text-sm text-google-yellow p-6 rounded-3xl border border-google-yellow/50 outline-none focus:ring-2 ring-google-yellow/20 min-h-[100px]"
                        />
                    ) : (
                        <div className="p-6 bg-black font-mono text-sm text-google-yellow rounded-3xl border border-dark-700 flex justify-between items-center group overflow-hidden">
                            <code className="truncate">{command}</code>
                            <Zap size={14} className="text-google-yellow/30 shrink-0 ml-4" />
                        </div>
                    )}
                </div>

                <div className="flex gap-4 pt-4">
                    <button 
                        onClick={handleApply}
                        disabled={isApplying}
                        className="flex-1 py-5 bg-google-green text-dark-900 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(52,168,83,0.3)] disabled:opacity-50"
                    >
                        {isApplying ? <Zap className="animate-spin" size={20} /> : <Check size={20} />}
                        Authorize Repair
                    </button>
                    <button 
                        onClick={onClose}
                        className="px-10 py-5 bg-dark-700 text-gray-300 rounded-2xl font-black uppercase tracking-widest hover:bg-dark-600 transition-all border border-dark-600"
                    >
                        Dismiss
                    </button>
                </div>
            </div>

            <div className="px-10 py-5 bg-dark-900/50 border-t border-dark-700">
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
                    <Zap size={10} className="text-google-yellow" /> Mission State: Degraded. Awaiting Neural Alignment.
                </p>
            </div>
        </div>
    );
};

export default RecoveryModule;
