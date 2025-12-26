
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Film, Send, Loader2, Play, Download, Trash2, Sparkles, Monitor, Smartphone, Layout, Key, Info, ArrowUpCircle, Edit2, Upload } from 'lucide-react';

const CreativeStudio = () => {
    const [activeTool, setActiveTool] = useState<'image' | 'video' | 'edit'>('image');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [resolution, setResolution] = useState('720p');
    const [isGenerating, setIsGenerating] = useState(false);
    const [assets, setAssets] = useState<any[]>([]);
    const [videoProgress, setVideoProgress] = useState<string | null>(null);
    const [editTarget, setEditTarget] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const checkVeoKey = async () => {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    };

    const handleGenerateImage = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
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
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            setPrompt('');
        }
    };

    const handleEditImage = async () => {
        if (!prompt.trim() || !editTarget) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/creative/image/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, base64Image: editTarget })
            });
            const data = await res.json();
            if (data.imageUrl) {
                setAssets(prev => [{ id: Date.now(), type: 'image', url: data.imageUrl, prompt: `Edit: ${prompt}`, date: new Date().toISOString() }, ...prev]);
                setEditTarget(null);
                setActiveTool('image');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
            setPrompt('');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditTarget(reader.result as string);
                setActiveTool('edit');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateVideo = async (videoToExtend = null) => {
        if (!prompt.trim() && !videoToExtend) return;
        await checkVeoKey();
        setIsGenerating(true);
        setVideoProgress(videoToExtend ? "Extending neural sequence (+7s)..." : "Initiating neural render...");
        
        try {
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
            const { operationId } = await startRes.json();

            const poll = setInterval(async () => {
                setVideoProgress(videoToExtend ? "Extending timeline..." : "Synthesizing frames...");
                const statusRes = await fetch(`/api/creative/video/status/${operationId}`);
                const statusData = await statusRes.json();
                
                if (statusData.done) {
                    clearInterval(poll);
                    const videoUrl = `${statusData.downloadLink}&key=${process.env.API_KEY}`;
                    setAssets(prev => [{ 
                        id: Date.now(), 
                        type: 'video', 
                        url: videoUrl, 
                        prompt: prompt || "Extended sequence", 
                        date: new Date().toISOString(),
                        videoObject: statusData.videoObject 
                    }, ...prev]);
                    setIsGenerating(false);
                    setVideoProgress(null);
                    setPrompt('');
                }
            }, 5000);
        } catch (e) {
            console.error(e);
            setIsGenerating(false);
            setVideoProgress(null);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Creative Studio</h2>
                    <p className="text-sm text-gray-500 font-medium">Generate visual assets for missions and documentation.</p>
                </div>
                <div className="flex gap-2 p-1 bg-dark-800 rounded-2xl border border-dark-700">
                    <button 
                        onClick={() => setActiveTool('image')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'image' ? 'bg-google-blue text-white shadow-lg' : 'text-gray-500'}`}
                    >
                        <Camera size={14} /> Neural Image
                    </button>
                    <button 
                        onClick={() => setActiveTool('edit')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'edit' ? 'bg-google-yellow text-dark-900 shadow-lg' : 'text-gray-500'}`}
                    >
                        <Edit2 size={14} /> Image Edit
                    </button>
                    <button 
                        onClick={() => setActiveTool('video')}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTool === 'video' ? 'bg-google-red text-white shadow-lg' : 'text-gray-500'}`}
                    >
                        <Film size={14} /> Neural Video
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-6">
                        {activeTool === 'edit' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Edit Target</label>
                                {editTarget ? (
                                    <div className="relative group aspect-square rounded-3xl overflow-hidden border border-google-yellow/30 bg-black">
                                        <img src={editTarget} alt="Edit target" className="w-full h-full object-contain" />
                                        <button onClick={() => setEditTarget(null)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-google-red transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full aspect-square border-2 border-dashed border-dark-700 rounded-3xl flex flex-col items-center justify-center gap-4 text-gray-600 hover:border-google-yellow/50 hover:text-google-yellow transition-all"
                                    >
                                        <Upload size={32} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Select Source Asset</span>
                                    </button>
                                )}
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <Sparkles size={12} className="text-google-yellow" /> Semantic Prompt
                            </label>
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm h-48 resize-none shadow-inner"
                                placeholder={activeTool === 'edit' ? "Describe the changes..." : activeTool === 'image' ? "Describe the vision..." : "Describe the sequence..."}
                            />
                        </div>

                        {activeTool !== 'edit' && (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Aspect Ratio</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['1:1', '16:9', '9:16'].map(ratio => (
                                        <button 
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            className={`py-3 rounded-xl border text-[10px] font-black ${aspectRatio === ratio ? 'bg-google-blue border-google-blue text-white' : 'bg-dark-900 border-dark-700 text-gray-500'}`}
                                        >
                                            {ratio === '16:9' ? <Monitor size={14} className="mx-auto mb-1" /> : ratio === '9:16' ? <Smartphone size={14} className="mx-auto mb-1" /> : <Layout size={14} className="mx-auto mb-1" />}
                                            {ratio}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTool === 'video' && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Resolution</label>
                                <select 
                                    value={resolution}
                                    onChange={(e) => setResolution(e.target.value)}
                                    className="w-full bg-dark-900 border border-dark-700 p-4 rounded-xl text-xs font-black uppercase tracking-widest text-gray-300 outline-none"
                                >
                                    <option value="720p">720p Standard</option>
                                    <option value="1080p">1080p High-Def</option>
                                </select>
                                <div className="p-4 bg-google-red/5 rounded-2xl border border-google-red/10 flex gap-3">
                                    <Key className="text-google-red shrink-0" size={16} />
                                    <p className="text-[9px] text-google-red/70 font-bold uppercase leading-relaxed">
                                        Veo requires a paid API key. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline">Billing Doc</a>.
                                    </p>
                                </div>
                            </div>
                        )}

                        <button 
                            onClick={() => activeTool === 'edit' ? handleEditImage() : activeTool === 'image' ? handleGenerateImage() : handleGenerateVideo()}
                            disabled={isGenerating || !prompt.trim() || (activeTool === 'edit' && !editTarget)}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all ${isGenerating ? 'bg-dark-700 text-gray-500 cursor-not-allowed' : activeTool === 'image' ? 'bg-google-blue text-white hover:scale-[1.02]' : activeTool === 'edit' ? 'bg-google-yellow text-dark-900 hover:scale-[1.02]' : 'bg-google-red text-white hover:scale-[1.02]'}`}
                        >
                            {isGenerating ? (
                                <><Loader2 className="animate-spin" size={20} /> {videoProgress || 'Engaging Neural Core...'}</>
                            ) : (
                                <><Send size={20} /> Engage Neural Engine</>
                            )}
                        </button>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-8">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Generated Assets Gallery</h4>
                        {assets.length > 0 && <span className="text-[9px] bg-dark-800 px-3 py-1 rounded-full text-gray-500 font-black">{assets.length} items</span>}
                    </div>

                    {assets.length === 0 ? (
                        <div className="h-[600px] border-2 border-dashed border-dark-800 rounded-[3rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <Sparkles size={64} className="mb-6" />
                            <p className="text-sm font-black uppercase tracking-[0.3em]">Gallery Empty</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {assets.map(asset => (
                                <div key={asset.id} className="bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden group hover:border-google-blue/30 transition-all">
                                    <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                                        {asset.type === 'image' ? (
                                            <img src={asset.url} alt={asset.prompt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <video src={asset.url} controls className="w-full h-full object-cover" />
                                        )}
                                        <div className="absolute top-4 left-4 z-10">
                                            <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg ${asset.type === 'image' ? 'bg-google-blue text-white' : 'bg-google-red text-white'}`}>
                                                {asset.type}
                                            </span>
                                        </div>
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            {asset.type === 'image' && (
                                                <button 
                                                    onClick={() => {
                                                        setEditTarget(asset.url);
                                                        setActiveTool('edit');
                                                    }}
                                                    className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-google-yellow hover:text-dark-900 transition-colors flex flex-col items-center gap-1"
                                                >
                                                    <Edit2 size={24} />
                                                    <span className="text-[8px] font-black">EDIT</span>
                                                </button>
                                            )}
                                            {asset.type === 'video' && asset.videoObject && (
                                                <button 
                                                    onClick={() => {
                                                        const p = window.prompt("Describe the next sequence (+7s):");
                                                        if (p) {
                                                            setPrompt(p);
                                                            handleGenerateVideo(asset.videoObject);
                                                        }
                                                    }}
                                                    className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-google-yellow transition-colors flex flex-col items-center gap-1"
                                                >
                                                    <ArrowUpCircle size={24} />
                                                    <span className="text-[8px] font-black">EXTEND</span>
                                                </button>
                                            )}
                                            <a href={asset.url} download={`${asset.type}-${asset.id}`} className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-google-blue transition-colors">
                                                <Download size={24} />
                                            </a>
                                            <button className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-white hover:bg-google-red transition-colors">
                                                <Trash2 size={24} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-2">
                                        <p className="text-xs text-gray-400 font-medium line-clamp-2 italic">"{asset.prompt}"</p>
                                        <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 flex justify-between">
                                            <span>{new Date(asset.date).toLocaleDateString()}</span>
                                            <span>{asset.type === 'image' ? '2.5 Flash' : 'Veo 3.1'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreativeStudio;
