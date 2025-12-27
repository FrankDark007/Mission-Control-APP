
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Film, Send, Loader2, Play, Download, Trash2, Sparkles, Monitor, Smartphone, Layout, Key, Info, ArrowUpCircle, Edit2, Upload, AlertCircle } from 'lucide-react';

const CreativeStudio = () => {
    const [activeTool, setActiveTool] = useState<'image' | 'video' | 'edit'>('image');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [resolution, setResolution] = useState('720p');
    const [isGenerating, setIsGenerating] = useState(false);
    const [assets, setAssets] = useState<any[]>([]);
    const [videoProgress, setVideoProgress] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const checkVeoKey = async () => {
        if (!(window as any).aistudio) {
            throw new Error("AI Studio browser extension not detected. Video generation requires this extension.");
        }
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    };

    const handleGenerateImage = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        try {
            const res = await fetch('/api/creative/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, aspectRatio })
            });
            const data = await res.json();
            if (data.imageUrl) {
                setAssets(prev => [{ id: Date.now(), type: 'image', url: data.imageUrl, prompt, date: new Date().toISOString() }, ...prev]);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGenerating(false);
            setPrompt('');
        }
    };

    const handleGenerateVideo = async (videoToExtend = null) => {
        if (!prompt.trim() && !videoToExtend) return;
        setIsGenerating(true);
        setError(null);
        try {
            await checkVeoKey();
            setVideoProgress(videoToExtend ? "Extending neural sequence (+7s)..." : "Initiating neural render...");
            
            const startRes = await fetch('/api/creative/video/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt: prompt || "Something unexpected happens", 
                    aspectRatio, 
                    resolution: videoToExtend ? '720p' : resolution,
                    videoToExtend: videoToExtend 
                })
            });
            
            if (!startRes.ok) {
                const errData = await startRes.json();
                throw new Error(errData.error || "Video generation failed to initialize.");
            }

            const { operationId } = await startRes.json();

            const poll = setInterval(async () => {
                try {
                    const statusRes = await fetch(`/api/creative/video/status/${operationId}`);
                    const statusData = await statusRes.json();
                    
                    if (statusData.done) {
                        clearInterval(poll);
                        setAssets(prev => [{ 
                            id: Date.now(), 
                            type: 'video', 
                            url: statusData.downloadLink, 
                            prompt: prompt || "Extended sequence", 
                            date: new Date().toISOString(),
                            videoObject: statusData.videoObject 
                        }, ...prev]);
                        setIsGenerating(false);
                        setVideoProgress(null);
                        setPrompt('');
                    }
                } catch(e) {
                    clearInterval(poll);
                    setIsGenerating(false);
                    setVideoProgress(null);
                    setError("Operation polling failed.");
                }
            }, 10000);
        } catch (e: any) {
            console.error(e);
            setIsGenerating(false);
            setVideoProgress(null);
            setError(e.message);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Creative Studio</h2>
                    <p className="text-sm text-gray-500 font-medium">Generate visual assets for missions and documentation.</p>
                </div>
                <div className="flex gap-2 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                    <button onClick={() => setActiveTool('image')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTool === 'image' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400'}`}>
                        <Camera size={14} /> Image
                    </button>
                    <button onClick={() => setActiveTool('video')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTool === 'video' ? 'bg-google-red text-white shadow-lg' : 'text-gray-400'}`}>
                        <Film size={14} /> Video
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-google-red/10 border border-google-red/30 rounded-2xl flex items-center gap-4 text-google-red">
                    <AlertCircle size={20} />
                    <span className="text-xs font-black uppercase">{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 space-y-6 shadow-2xl">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-gray-500">Visual Prompt</label>
                        <textarea 
                            value={prompt} 
                            onChange={e => setPrompt(e.target.value)}
                            className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl outline-none text-sm h-48 resize-none"
                            placeholder="Describe your vision..."
                        />
                    </div>
                    <button 
                        onClick={() => activeTool === 'image' ? handleGenerateImage() : handleGenerateVideo()}
                        disabled={isGenerating || !prompt.trim()}
                        className={`w-full py-5 rounded-2xl font-black uppercase shadow-xl transition-all ${activeTool === 'image' ? 'bg-google-blue text-white' : 'bg-google-red text-white'}`}
                    >
                        {isGenerating ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Synthesize'}
                    </button>
                </div>
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {assets.map(asset => (
                        <div key={asset.id} className="bg-dark-800 rounded-[2.5rem] border border-dark-700 overflow-hidden shadow-2xl">
                             {asset.type === 'image' ? <img src={asset.url} className="aspect-video object-cover" /> : <video src={asset.url} controls className="aspect-video object-cover" />}
                             <div className="p-6">
                                <p className="text-xs text-gray-400 italic line-clamp-2">"{asset.prompt}"</p>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CreativeStudio;
