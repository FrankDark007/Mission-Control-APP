
import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Search, Map as MapIcon, Sparkles, Loader2, Bot, User, Link as LinkIcon, Globe, MapPin, Brain, Eye, X, Image as ImageIcon } from 'lucide-react';
import { ChatMessage, GroundingChunk } from '../types';

const ChatLab = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [thinkingBudget, setThinkingBudget] = useState(0); 
    const [useSensory, setUseSensory] = useState(false);
    const [useLocation, setUseLocation] = useState(false);
    const [sensorySnapshot, setSensorySnapshot] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                () => console.warn("Geolocation denied.")
            );
        }
    }, []);

    const captureSensory = async () => {
        setIsCapturing(true);
        try {
            const res = await fetch('/api/sensory/snapshot', { method: 'POST' });
            const data = await res.json();
            if (data.image) setSensorySnapshot(data.image);
        } catch (e) {
            console.error("Sensory capture failed", e);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now(),
            image: sensorySnapshot || undefined
        };

        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        const currentBudget = thinkingBudget;
        const currentImage = sensorySnapshot;
        const currentLocation = useLocation ? location : null;

        setInput('');
        setSensorySnapshot(null);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput,
                    model: currentBudget > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
                    systemInstruction: "You are the Tactical Swarm Commander. Analyze visual sensory payload if present.",
                    latLng: currentLocation,
                    thinkingBudget: currentBudget,
                    image: currentImage
                })
            });
            const data = await res.json();

            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: data.text || "No response received.",
                timestamp: Date.now(),
                modelUsed: currentLocation ? 'gemini-2.5-flash' : (currentBudget > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview'),
                groundingChunks: data.groundingChunks || []
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                content: "Transmission Error: Swarm connection lost.",
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full space-y-4 md:space-y-6 animate-in fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 shrink-0">
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1 uppercase">Tactical Comms</h2>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Query the swarm with real-time web and sensory integration.</p>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-4 p-1 bg-dark-800 rounded-xl md:rounded-2xl border border-dark-700 items-center px-2 md:px-4 shadow-xl">
                    <button
                        onClick={() => useSensory ? setUseSensory(false) : (setUseSensory(true), captureSensory())}
                        disabled={isCapturing}
                        className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg md:rounded-xl transition-all ${useSensory ? 'bg-google-blue text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'}`}
                    >
                        {isCapturing ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} className={useSensory ? 'animate-pulse' : ''} />}
                        <span className="text-[10px] font-black uppercase hidden sm:inline">Sensory Eye</span>
                    </button>
                    <div className="w-px h-6 bg-dark-700 hidden sm:block" />
                    <button
                        onClick={() => setUseLocation(!useLocation)}
                        disabled={!location}
                        title={!location ? "Location access needed" : "Toggle Maps Grounding"}
                        className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg md:rounded-xl transition-all ${useLocation ? 'bg-google-green text-white shadow-lg' : 'text-gray-400 hover:text-gray-300'} ${!location ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <MapPin size={14} className={useLocation ? 'animate-bounce' : ''} />
                        <span className="text-[10px] font-black uppercase hidden sm:inline">Location</span>
                    </button>
                    <div className="w-px h-6 bg-dark-700 hidden sm:block" />
                    <div className="flex items-center gap-2 md:gap-3">
                        <Brain size={14} className={thinkingBudget > 0 ? 'text-google-yellow animate-pulse' : 'text-gray-500'} />
                        <span className="text-[10px] font-black uppercase text-gray-500 hidden md:inline">Reasoning</span>
                        <input
                            type="range"
                            min="0"
                            max="32768"
                            step="1024"
                            value={thinkingBudget}
                            onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                            className="w-16 md:w-24 accent-google-yellow h-1 bg-dark-700 rounded-full appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-google-yellow w-8 md:w-12 text-right">{thinkingBudget > 0 ? `${(thinkingBudget/1024).toFixed(0)}k` : 'OFF'}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-dark-800 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-6 md:space-y-8 lg:space-y-10 scrollbar-hide">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                            <MessageSquare className="text-gray-600 w-12 h-12 md:w-16 md:h-16" />
                            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">Awaiting Strategic Query</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 md:gap-6 lg:gap-8 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2`}>
                            <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl shrink-0 h-fit shadow-lg ${msg.role === 'ai' ? 'bg-google-blue/10 text-google-blue border border-google-blue/20' : 'bg-dark-700 text-gray-400 border border-dark-600'}`}>
                                {msg.role === 'ai' ? <Bot className="w-5 h-5 md:w-6 md:h-6" /> : <User className="w-5 h-5 md:w-6 md:h-6" />}
                            </div>
                            <div className={`max-w-[85%] md:max-w-[75%] space-y-3 md:space-y-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-dark-900 border border-dark-700 text-gray-200 shadow-inner' : 'bg-google-blue text-white shadow-xl shadow-google-blue/20'}`}>
                                    {msg.image && (
                                        <div className="mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
                                            <img src={msg.image} alt="Sensory Context" className="w-full h-auto max-h-64 object-contain opacity-90" />
                                            <div className="bg-dark-900/80 px-4 py-2 text-[8px] font-black uppercase text-gray-500 flex items-center gap-2">
                                                <ImageIcon size={10} /> Visual Sensory Payload Attached
                                            </div>
                                        </div>
                                    )}
                                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                                    
                                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                        <div className="mt-4 md:mt-6 lg:mt-8 pt-4 md:pt-6 lg:pt-8 border-t border-dark-700 space-y-3 md:space-y-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                                                <LinkIcon size={12} className="text-google-blue" /> Grounding Evidence
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {msg.groundingChunks.map((chunk, i) => {
                                                    const source = chunk.web || chunk.maps;
                                                    if (!source) return null;
                                                    return (
                                                        <a 
                                                            key={i}
                                                            href={source.uri} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 px-4 py-2 bg-dark-800 border border-dark-700 rounded-xl hover:border-google-blue hover:bg-google-blue/5 hover:text-google-blue transition-all text-[11px] font-bold max-w-[250px] shadow-sm"
                                                        >
                                                            {chunk.web ? <Globe size={14} className="text-google-blue" /> : <MapPin size={14} className="text-google-red" />}
                                                            <span className="truncate">{source.title || source.uri}</span>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 px-4 flex items-center gap-3">
                                    {msg.role === 'ai' && <span className="flex items-center gap-1.5 bg-dark-900 px-2 py-0.5 rounded border border-dark-700"><Sparkles size={10} className="text-google-blue" /> {msg.modelUsed}</span>}
                                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 md:gap-6 lg:gap-8 animate-pulse">
                            <div className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-google-blue/5 border border-google-blue/10 text-google-blue/30 shadow-inner"><Bot className="w-5 h-5 md:w-6 md:h-6" /></div>
                            <div className="bg-dark-900 border border-dark-700 rounded-2xl md:rounded-[2rem] lg:rounded-[2.5rem] p-4 md:p-6 lg:p-8 min-w-[150px] md:min-w-[200px] flex flex-col gap-4">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="animate-spin text-google-blue w-4 h-4 md:w-5 md:h-5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-google-blue">Synthesizing...</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                <div className="p-4 md:p-6 lg:p-10 border-t border-dark-700 bg-dark-900/50 flex flex-col gap-3 md:gap-4">
                    {sensorySnapshot && (
                        <div className="flex items-center gap-3 md:gap-4 bg-dark-800 p-3 md:p-4 rounded-xl md:rounded-2xl border border-google-blue/30 w-fit animate-in slide-in-from-bottom-2">
                             <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden border border-dark-700">
                                 <img src={sensorySnapshot} className="w-full h-full object-cover" />
                             </div>
                             <div className="text-[9px] font-black uppercase text-gray-500 hidden sm:block">Visual Context Primed</div>
                             <button onClick={() => setSensorySnapshot(null)} className="p-1.5 hover:bg-dark-700 rounded-lg text-google-red"><X size={14} /></button>
                        </div>
                    )}
                    <div className="relative flex items-center gap-2 md:gap-4 bg-dark-800 p-2 rounded-xl md:rounded-2xl lg:rounded-[2rem] border border-dark-700 focus-within:border-google-blue transition-all shadow-2xl">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={useSensory ? "Instruct swarm with visual analysis..." : useLocation ? "Query with geographic context..." : "Query architectural intelligence..."}
                            className="flex-1 bg-transparent border-none outline-none px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 text-sm text-gray-200"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="p-3 md:p-4 lg:p-5 bg-google-blue text-white rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <Send className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatLab;
