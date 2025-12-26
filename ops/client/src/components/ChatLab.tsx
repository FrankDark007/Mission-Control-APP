
import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Search, Map as MapIcon, Sparkles, Loader2, Bot, User, Link as LinkIcon, Globe, MapPin, Brain } from 'lucide-react';
import { ChatMessage, GroundingChunk } from '../types';

const ChatLab = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [thinkingBudget, setThinkingBudget] = useState(0); // 0 = Disabled
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

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        const currentInput = input;
        const currentBudget = thinkingBudget;
        setInput('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: currentInput,
                    // Use full model name 'gemini-3-pro-preview' as per guidelines
                    model: currentBudget > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
                    systemInstruction: "You are the Tactical Swarm Commander. Use the tools provided (Search, Maps) to provide accurate real-time data. If thinking is enabled, provide a detailed strategy.",
                    latLng: location,
                    thinkingBudget: currentBudget
                })
            });
            const data = await res.json();
            
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: data.content,
                timestamp: Date.now(),
                // Use full model name 'gemini-3-pro-preview' as per guidelines
                modelUsed: currentBudget > 0 ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
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
        <div className="flex flex-col h-full space-y-6 animate-in fade-in">
            <div className="flex justify-between items-end shrink-0">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Tactical Chat</h2>
                    <p className="text-sm text-gray-500 font-medium">Query the swarm with real-time web and maps integration.</p>
                </div>
                <div className="flex gap-4 p-1 bg-dark-800 rounded-2xl border border-dark-700 items-center px-4">
                    <div className="flex items-center gap-3">
                        <Brain size={14} className={thinkingBudget > 0 ? 'text-google-yellow animate-pulse' : 'text-gray-500'} />
                        <span className="text-[10px] font-black uppercase text-gray-500">Deep Reasoning</span>
                        <input 
                            type="range" 
                            min="0" 
                            max="32768" 
                            step="1024"
                            value={thinkingBudget} 
                            onChange={(e) => setThinkingBudget(parseInt(e.target.value))}
                            className="w-24 accent-google-yellow h-1 bg-dark-700 rounded-full appearance-none cursor-pointer"
                        />
                        <span className="text-[10px] font-mono text-google-yellow w-12 text-right">{thinkingBudget > 0 ? `${(thinkingBudget/1024).toFixed(0)}k` : 'OFF'}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                            <MessageSquare size={64} />
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Awaiting Strategic Query</p>
                        </div>
                    )}
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2`}>
                            <div className={`p-4 rounded-2xl shrink-0 h-fit ${msg.role === 'ai' ? 'bg-google-blue/10 text-google-blue border border-google-blue/20' : 'bg-dark-700 text-gray-400 border border-dark-600'}`}>
                                {msg.role === 'ai' ? <Bot size={24} /> : <User size={24} />}
                            </div>
                            <div className={`max-w-[75%] space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`p-6 rounded-[2rem] text-sm leading-relaxed ${msg.role === 'ai' ? 'bg-dark-900 border border-dark-700 text-gray-200 shadow-inner' : 'bg-google-blue text-white shadow-xl shadow-google-blue/10'}`}>
                                    {msg.content}
                                    
                                    {/* Grounding Sources */}
                                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-dark-700 space-y-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                                <LinkIcon size={12} /> External Intelligence Sources
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
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg hover:border-google-blue hover:text-google-blue transition-all text-[11px] font-medium max-w-[200px]"
                                                        >
                                                            {chunk.web ? <Globe size={12} /> : <MapPin size={12} />}
                                                            <span className="truncate">{source.title || source.uri}</span>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-gray-600 px-2 flex items-center gap-3">
                                    {msg.role === 'ai' && <span className="flex items-center gap-1"><Sparkles size={8} /> {msg.modelUsed}</span>}
                                    <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-6 animate-pulse">
                            <div className="p-4 rounded-2xl bg-google-blue/5 border border-google-blue/10 text-google-blue/30"><Bot size={24} /></div>
                            <div className="bg-dark-900 border border-dark-700 rounded-[2rem] p-6 w-32 flex items-center justify-center">
                                <Loader2 className="animate-spin text-google-blue" size={20} />
                            </div>
                        </div>
                    )}
                    <div ref={scrollRef} />
                </div>

                <div className="p-8 border-t border-dark-700 bg-dark-900/50">
                    <div className="relative flex items-center gap-4 bg-dark-800 p-2 rounded-3xl border border-dark-700 focus-within:border-google-blue transition-all shadow-inner">
                        <input 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Instruct the swarm or query intelligence..."
                            className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-sm text-gray-200"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="p-4 bg-google-blue text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChatLab;
