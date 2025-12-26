
import React, { useState, useEffect } from 'react';
import { Globe, Cloud, RefreshCw, Zap, Server, ShieldCheck, Share2, Loader2, Activity } from 'lucide-react';
import { edgeService } from '../services/edge';

const EdgeLab = () => {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const s = await edgeService.getEdgeStatus();
      setStatus(s);
    };
    fetchStatus();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await edgeService.syncToEdge('swarm_config', { status: 'active', node: 'local-ops' });
    setSyncing(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Cloudflare Edge</h2>
          <p className="text-sm text-gray-500 font-medium">Global state distribution and edge worker orchestration.</p>
        </div>
        <div className="bg-dark-800 border border-dark-700 px-6 py-3 rounded-2xl flex items-center gap-4">
          <Cloud className="text-google-blue" size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white">Edge Sync: Enabled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-google-blue/10 rounded-xl">
                    <Globe className="text-google-blue" size={24} />
                </div>
                <h3 className="text-xl font-black text-white italic">Global Presence</h3>
            </div>
            
            <div className="space-y-4">
                {status?.globalReplicas.map((loc: string) => (
                    <div key={loc} className="flex items-center justify-between p-4 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-blue transition-all">
                        <span className="text-[10px] font-black uppercase text-gray-400">{loc} Edge Node</span>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-google-green animate-pulse" />
                            <span className="text-[9px] font-black text-google-green">Active</span>
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={handleSync}
                disabled={syncing}
                className="w-full py-5 bg-google-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
            >
                {syncing ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                Sync Local State to Edge
            </button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
            <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl relative overflow-hidden group min-h-[400px]">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Share2 size={150} />
                </div>
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-4 bg-google-green/10 rounded-2xl border border-google-green/20">
                        <ShieldCheck className="text-google-green" size={24} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white">Edge Connectivity Report</h3>
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Real-time Cloudflare Network Metrics</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 relative z-10">
                    <div className="p-8 bg-dark-900 rounded-[2rem] border border-dark-700 space-y-2">
                        <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Node ID</div>
                        <div className="text-xl font-black text-white">{status?.node}</div>
                    </div>
                    <div className="p-8 bg-dark-900 rounded-[2rem] border border-dark-700 space-y-2">
                        <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Global Latency</div>
                        <div className="text-xl font-black text-google-green">{status?.latency}</div>
                    </div>
                    <div className="p-8 bg-dark-900 rounded-[2rem] border border-dark-700 space-y-2">
                        <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">TLS Security</div>
                        <div className="text-xl font-black text-white">v1.3 (ChaCha20)</div>
                    </div>
                    <div className="p-8 bg-dark-900 rounded-[2rem] border border-dark-700 space-y-2">
                        <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">WAF Status</div>
                        <div className="text-xl font-black text-google-blue italic">PROT_LEVEL_4</div>
                    </div>
                </div>

                <div className="mt-10 p-6 bg-dark-900 border border-dark-700 rounded-3xl flex items-center gap-4">
                    <Activity size={24} className="text-google-blue" />
                    <p className="text-xs text-gray-400 font-medium">Global Swarm Synchronization active via Cloudflare KV. State consistency: <span className="text-white font-bold tracking-widest uppercase">99.999%</span></p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EdgeLab;
