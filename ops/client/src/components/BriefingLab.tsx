
import React, { useState } from 'react';
import { Volume2, Play, Pause, Loader2, Users, Radio, Sparkles, MessageSquare, ChevronRight } from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// Audio Helpers
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

const BriefingLab = () => {
    const [topic, setTopic] = useState('');
    const [script, setScript] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const generateBriefing = async () => {
        if (!topic.trim()) return;
        setIsGenerating(true);
        try {
            const res = await fetch('/api/briefing/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });
            const data = await res.json();
            setScript(data.script);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const playAudio = async () => {
        if (!script) return;
        setIsPlaying(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `TTS the following conversation:\n${script}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        multiSpeakerVoiceConfig: {
                            speakerVoiceConfigs: [
                                { speaker: 'Zephyr', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                                { speaker: 'Puck', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
                            ]
                        }
                    }
                }
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                source.onended = () => setIsPlaying(false);
                source.start();
            }
        } catch (e) {
            console.error(e);
            setIsPlaying(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Comms Briefing</h2>
                    <p className="text-sm text-gray-500 font-medium">Synthesize tactical mission summaries via multi-speaker audio.</p>
                </div>
                <div className="flex items-center gap-3 bg-dark-800 px-6 py-3 rounded-2xl border border-dark-700">
                    <Radio className="text-google-red animate-pulse" size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Neural Frequency Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                    <div className="bg-dark-800 p-10 rounded-[2.5rem] border border-dark-700 shadow-2xl space-y-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                                <MessageSquare size={12} className="text-google-blue" /> Briefing Objective
                            </label>
                            <div className="relative">
                                <input 
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="e.g. Current Swarm health and Git deployment status"
                                    className="w-full bg-dark-900 border border-dark-700 p-6 rounded-3xl focus:border-google-blue outline-none text-sm text-white shadow-inner"
                                />
                                <button 
                                    onClick={generateBriefing}
                                    disabled={isGenerating || !topic.trim()}
                                    className="absolute right-3 top-3 p-3 bg-google-blue text-white rounded-2xl shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-google-blue" />
                                    <span className="text-[10px] font-black uppercase text-gray-400">Speaker A</span>
                                </div>
                                <div className="text-sm font-bold text-white">Zephyr</div>
                                <div className="text-[9px] text-gray-600 font-black uppercase">Strategic Overlord</div>
                            </div>
                            <div className="p-6 bg-dark-900 rounded-3xl border border-dark-700 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-google-green" />
                                    <span className="text-[10px] font-black uppercase text-gray-400">Speaker B</span>
                                </div>
                                <div className="text-sm font-bold text-white">Puck</div>
                                <div className="text-[9px] text-gray-600 font-black uppercase">Technical Lead</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {script ? (
                        <div className="bg-dark-800 rounded-[2.5rem] border border-google-blue/30 shadow-2xl overflow-hidden flex flex-col h-full animate-in slide-in-from-right-4">
                            <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-google-blue/5">
                                <div className="flex items-center gap-4">
                                    <Users className="text-google-blue" size={24} />
                                    <h3 className="text-xl font-black text-white">Synthesized Script</h3>
                                </div>
                                <button 
                                    onClick={playAudio}
                                    disabled={isPlaying}
                                    className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center gap-3 transition-all ${isPlaying ? 'bg-dark-700 text-gray-500' : 'bg-google-blue text-white shadow-xl hover:scale-105'}`}
                                >
                                    {isPlaying ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                                    {isPlaying ? 'Streaming...' : 'Broadcast Briefing'}
                                </button>
                            </div>
                            <div className="p-10 flex-1 space-y-6 font-mono text-xs leading-relaxed overflow-y-auto max-h-[400px]">
                                {script.split('\n').map((line, i) => {
                                    const [speaker, ...text] = line.split(':');
                                    if (!text.length) return null;
                                    return (
                                        <div key={i} className="flex gap-4 group">
                                            <span className={`shrink-0 font-black uppercase tracking-tighter w-20 ${speaker.includes('Zephyr') ? 'text-google-blue' : 'text-google-green'}`}>{speaker}:</span>
                                            <span className="text-gray-300 group-hover:text-white transition-colors">{text.join(':').trim()}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="p-8 border-t border-dark-700 bg-dark-900/50 flex items-center gap-4">
                                <div className="flex-1 h-1 bg-dark-700 rounded-full overflow-hidden">
                                    <div className={`h-full bg-google-blue transition-all duration-300 ${isPlaying ? 'w-full' : 'w-0'}`} />
                                </div>
                                <Volume2 size={16} className={isPlaying ? 'text-google-blue animate-bounce' : 'text-gray-600'} />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-dark-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center p-20 opacity-20">
                            <Users size={64} className="mb-6" />
                            <p className="text-xs font-black uppercase tracking-[0.3em]">Briefing Matrix Ready</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BriefingLab;
