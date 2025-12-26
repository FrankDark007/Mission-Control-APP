
import React, { useState, useEffect } from 'react';
import { Cpu, Brain, Zap, Sparkles, MessageSquare, Loader2, ShieldCheck, Activity, AlignLeft, RefreshCw } from 'lucide-react';
import { LocalAiService } from '../services/localAi';

const LocalAiLab = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [tone, setTone] = useState<'professional' | 'concise' | 'casual'>('professional');

  useEffect(() => {
    const check = async () => {
      const avail = await LocalAiService.isAvailable();
      setCapabilities({ available: avail });
    };
    check();
  }, []);

  const runLocalPrompt = async () => {
    setIsLoading(true);
    const res = await LocalAiService.promptLocal(prompt);
    setResponse(res);
    setIsLoading(false);
  };

  const runLocalSummary = async () => {
    setIsLoading(true);
    const res = await LocalAiService.summarize(prompt);
    setResponse(res);
    setIsLoading(false);
  };

  /**
   * Feature 3: Live Writer API Integration.
   */
  const runLocalRewrite = async () => {
    setIsLoading(true);
    const res = await LocalAiService.rewrite(prompt, tone);
    setResponse(res);
    setIsLoading(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Local Intelligence</h2>
          <p className="text-sm text-gray-500 font-medium">On-device inference using Chrome Gemini Nano & specialized text APIs.</p>
        </div>
        <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${capabilities?.available ? 'bg-google-green/10 border-google-green/30 text-google-green' : 'bg-google-red/10 border-google-red/30 text-google-red'}`}>
          <ShieldCheck size={18} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {capabilities?.available ? 'Built-in AI: Ready' : 'Built-in AI: Not Supported'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Zap size={12} className="text-google-yellow" /> Neural Payload
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full bg-dark-900 border border-dark-700 p-5 rounded-3xl focus:border-google-blue outline-none text-sm text-white h-48 resize-none shadow-inner"
                placeholder="Query the local model or paste text to transform..."
              />
            </div>

            <div className="space-y-3">
              <div className="text-[8px] font-black uppercase text-gray-600 px-1">Writer Configuration (Tone)</div>
              <div className="flex gap-2 p-1 bg-dark-900 rounded-xl border border-dark-700">
                {(['professional', 'concise', 'casual'] as const).map(t => (
                  <button 
                    key={t}
                    onClick={() => setTone(t)}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${tone === t ? 'bg-google-blue text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={runLocalPrompt}
                disabled={isLoading || !capabilities?.available}
                className="w-full py-4 bg-google-blue text-white rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Cpu size={16} />}
                Execute Gemini Nano
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={runLocalSummary}
                    disabled={isLoading || !capabilities?.available}
                    className="py-4 bg-dark-900 border border-dark-700 text-google-blue rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-dark-700 transition-all disabled:opacity-50"
                >
                    <AlignLeft size={14} /> Summarize
                </button>
                <button 
                    onClick={runLocalRewrite}
                    disabled={isLoading || !capabilities?.available}
                    className="py-4 bg-dark-900 border border-dark-700 text-google-green rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-dark-700 transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} /> Rewrite
                </button>
              </div>
            </div>
          </div>

          <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 flex flex-col items-center justify-center text-center gap-4 opacity-60">
            <Activity className="text-google-blue" size={32} />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Local Latency & Integrity Optimized</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="p-8 border-b border-dark-700 flex items-center gap-4 bg-dark-900/40">
                <div className="p-3 bg-google-blue/10 rounded-xl border border-google-blue/20">
                    <Brain className="text-google-blue" size={20} />
                </div>
                <h3 className="text-xl font-black text-white">Neural Output Stream</h3>
            </div>
            <div className="p-10 flex-1 overflow-y-auto font-mono text-xs leading-relaxed text-gray-300 whitespace-pre-wrap scrollbar-hide">
              {response || "Awaiting local command execution..."}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LocalAiLab;
