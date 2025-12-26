
import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, Loader2, Info, X, Zap, Server, Globe, Search, ShieldCheck, AlertTriangle } from 'lucide-react';

const DeploymentStepper = ({ onClose }: { onClose: () => void }) => {
    const [activeStage, setActiveStage] = useState(0);
    const [status, setStatus] = useState<'idle' | 'deploying' | 'completed' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    
    const stages = [
        { name: 'Sitemap Discovery', icon: Globe, desc: 'Crawling local architecture for route mapping' },
        { name: 'Neural Audit', icon: Search, desc: 'Lighthouse scoring and accessibility check' },
        { name: 'Visual Delta', icon: ShieldCheck, desc: 'Pixel-diffing against committed baselines' },
        { name: 'Swarm Sync', icon: Zap, desc: 'Consolidating worktrees and pushing to remote' }
    ];

    const startDeployment = async () => {
        setStatus('deploying');
        setActiveStage(0);
        
        try {
            const res = await fetch('/api/deploy', { method: 'POST' });
            if (!res.ok) throw new Error('Deployment sequence failed at verification stage.');
            const data = await res.json();
            
            // Artificial delay to let the UI breathe and show the stages if the API is too fast
            // In a real high-throughput system, we'd use WebSockets for fine-grained stage updates
            for (let i = 0; i < stages.length; i++) {
                setActiveStage(i);
                await new Promise(r => setTimeout(r, 800));
            }
            
            setStatus('completed');
        } catch (e: any) {
            setStatus('error');
            setErrorMessage(e.message);
        }
    };

    useEffect(() => {
        startDeployment();
    }, []);

    return (
        <div className="bg-dark-800 w-full max-w-2xl rounded-[3rem] border border-google-green/30 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-10 border-b border-dark-700 bg-google-green/5 flex justify-between items-center">
                <div className="flex items-center gap-5">
                    <div className={`p-4 rounded-2xl ${status === 'error' ? 'bg-google-red/20' : 'bg-google-green/20'}`}>
                        <UploadCloud className={status === 'error' ? 'text-google-red' : 'text-google-green'} size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter">Consolidating Swarm</h2>
                        <p className={`text-xs font-black uppercase tracking-widest mt-1 ${status === 'error' ? 'text-google-red' : 'text-google-green'}`}>
                            {status === 'error' ? 'Mission Aborted' : 'Multi-Stage Strategic Deployment'}
                        </p>
                    </div>
                </div>
                {(status === 'completed' || status === 'error') && (
                    <button onClick={onClose} className="p-3 hover:bg-dark-700 rounded-2xl transition-all">
                        <X className="text-gray-500" />
                    </button>
                )}
            </div>

            <div className="p-12 space-y-12">
                <div className="space-y-8">
                    {stages.map((stage, idx) => {
                        const isCompleted = idx < activeStage || (status === 'completed' && idx === stages.length - 1);
                        const isActive = idx === activeStage && status === 'deploying';
                        const isPending = idx > activeStage && status !== 'completed';

                        return (
                            <div key={idx} className={`flex items-start gap-6 transition-all duration-500 ${isPending ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                                <div className="relative flex flex-col items-center">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${isCompleted ? 'bg-google-green border-google-green text-dark-900 shadow-[0_0_15px_rgba(52,168,83,0.3)]' : isActive ? 'border-google-green text-google-green animate-pulse' : 'border-dark-700 text-gray-500'}`}>
                                        {isCompleted ? <CheckCircle size={24} /> : <stage.icon size={24} />}
                                    </div>
                                    {idx < stages.length - 1 && <div className={`w-0.5 h-12 my-2 ${idx < activeStage ? 'bg-google-green' : 'bg-dark-700'}`} />}
                                </div>
                                <div className="flex-1 pt-1">
                                    <h3 className={`text-lg font-bold ${isActive ? 'text-white' : idx <= activeStage ? 'text-gray-300' : 'text-gray-600'}`}>{stage.name}</h3>
                                    <p className="text-xs text-gray-600 font-medium mt-1">{stage.desc}</p>
                                </div>
                                {isActive && (
                                    <Loader2 className="animate-spin text-google-green mt-2" size={20} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {status === 'completed' && (
                    <div className="bg-google-green/10 border border-google-green/50 p-6 rounded-3xl flex items-center gap-5 animate-in slide-in-from-bottom-4">
                        <Server className="text-google-green" size={28} />
                        <div>
                            <p className="text-sm font-black text-white uppercase">Mission Successful</p>
                            <p className="text-xs text-google-green/70 mt-1">Remote repository synchronized with latest Swarm State.</p>
                        </div>
                        <button onClick={onClose} className="ml-auto bg-google-green text-dark-900 px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all">Finalize</button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="bg-google-red/10 border border-google-red/50 p-6 rounded-3xl flex items-center gap-5 animate-in shake">
                        <AlertTriangle className="text-google-red" size={28} />
                        <div>
                            <p className="text-sm font-black text-white uppercase">Deployment Halted</p>
                            <p className="text-xs text-google-red/70 mt-1">{errorMessage}</p>
                        </div>
                        <button onClick={startDeployment} className="ml-auto bg-google-red text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all">Retry</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeploymentStepper;
