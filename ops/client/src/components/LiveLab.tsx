
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Radio, Terminal, Volume2, Sparkles, Loader2, Brain, Activity, MessageSquare } from 'lucide-react';

// Manual Base64 Implementation as per guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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

const LiveLab = () => {
  const [isActive, setIsActive] = useState(false);
  const [inputTranscription, setInputTranscription] = useState('');
  const [outputTranscription, setOutputTranscription] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    sourcesRef.current.forEach((s) => s.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setIsConnecting(false);
  };

  const startSession = async () => {
    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are the Swarm Commander. You assist the human operator in managing a multi-agent AI swarm. Be tactical, efficient, and provide real-time guidance based on audio input.',
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              setInputTranscription((prev) => prev + message.serverContent!.inputTranscription!.text);
            }
            if (message.serverContent?.outputTranscription) {
              setOutputTranscription((prev) => prev + message.serverContent!.outputTranscription!.text);
            }
            if (message.serverContent?.turnComplete) {
              setHistory((prev) => [
                ...prev,
                { role: 'user', text: inputTranscription },
                { role: 'ai', text: outputTranscription },
              ]);
              setInputTranscription('');
              setOutputTranscription('');
            }

            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach((s) => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => stopSession(),
          onerror: (e) => {
            console.error('Live API Error:', e);
            stopSession();
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start Live session:', err);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20 h-full flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">Tactical Comms</h2>
          <p className="text-sm text-gray-500 font-medium">Real-time voice-driven swarm orchestration and tactical guidance.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all ${isActive ? 'bg-google-red/10 border-google-red/30 text-google-red shadow-[0_0_15px_rgba(234,67,53,0.2)]' : 'bg-dark-800 border-dark-700 text-gray-500'}`}>
            <Activity className={isActive ? 'animate-pulse' : ''} size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">{isActive ? 'Frequency Locked' : 'Offline'}</span>
          </div>
          <button
            onClick={isActive ? stopSession : startSession}
            disabled={isConnecting}
            className={`px-10 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center gap-3 transition-all hover:scale-105 active:scale-95 ${isActive ? 'bg-dark-700 text-gray-300 hover:bg-google-red hover:text-white' : 'bg-google-blue text-white'}`}
          >
            {isConnecting ? <Loader2 className="animate-spin" size={20} /> : isActive ? <MicOff size={20} /> : <Mic size={20} />}
            {isActive ? 'Disconnect' : 'Connect Link'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 flex-1 min-h-0">
        {/* Visualizer & Real-time Transcripts */}
        <div className="lg:col-span-1 space-y-8 flex flex-col">
          <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col items-center justify-center gap-8 relative overflow-hidden group">
            <div className={`absolute inset-0 bg-gradient-to-t from-google-blue/5 to-transparent transition-opacity duration-1000 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            
            <div className="relative w-48 h-48 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-4 border-google-blue/20 transition-all duration-1000 ${isActive ? 'scale-110 opacity-50' : 'scale-100 opacity-20'}`} />
              <div className={`absolute inset-0 rounded-full border-2 border-google-blue/30 animate-ping transition-all ${isActive ? 'block' : 'hidden'}`} />
              <div className={`w-32 h-32 rounded-full bg-dark-900 border-4 flex items-center justify-center transition-all ${isActive ? 'border-google-blue shadow-[0_0_40px_rgba(26,115,232,0.4)]' : 'border-dark-700 shadow-inner'}`}>
                <Radio className={isActive ? 'text-google-blue animate-bounce' : 'text-gray-700'} size={48} />
              </div>
            </div>

            <div className="text-center space-y-2 relative z-10">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Signal Integrity</h3>
              <div className="flex gap-1 justify-center">
                {[...Array(8)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-1 h-4 rounded-full transition-all duration-200 ${isActive ? 'bg-google-blue' : 'bg-dark-700'}`}
                    style={{ 
                      height: isActive ? `${10 + Math.random() * 20}px` : '4px',
                      opacity: 0.3 + (i * 0.1)
                    }} 
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-dark-800 p-8 rounded-[2.5rem] border border-dark-700 shadow-2xl flex-1 flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <Terminal className="text-google-green" size={20} />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500">Live Telemetry</h3>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto scrollbar-hide">
              <div className="space-y-2">
                <div className="text-[8px] font-black uppercase text-google-blue">Input Stream</div>
                <p className="text-xs text-white font-medium italic min-h-[1.5em]">{inputTranscription || 'Awaiting voice input...'}</p>
              </div>
              <div className="space-y-2">
                <div className="text-[8px] font-black uppercase text-google-green">Output Stream</div>
                <p className="text-xs text-white font-medium italic min-h-[1.5em]">{outputTranscription || 'Awaiting commander response...'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tactical History */}
        <div className="lg:col-span-2 bg-dark-800 rounded-[2.5rem] border border-dark-700 shadow-2xl flex flex-col overflow-hidden relative">
          <div className="p-8 border-b border-dark-700 flex justify-between items-center bg-dark-900/40">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-google-blue/10 rounded-xl border border-google-blue/20">
                <MessageSquare className="text-google-blue" size={20} />
              </div>
              <h3 className="text-xl font-black text-white">Comms Log</h3>
            </div>
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Tactical Archive</span>
          </div>

          <div className="p-10 flex-1 overflow-y-auto space-y-8 scrollbar-hide">
            {history.length === 0 && !isActive && (
              <div className="h-full flex flex-col items-center justify-center opacity-10 text-center gap-8">
                <Brain size={80} className="text-gray-500" />
                <div className="space-y-2">
                  <p className="text-sm font-black uppercase tracking-[0.3em]">Comms Matrix Idle</p>
                  <p className="text-[10px] uppercase font-bold text-gray-600 tracking-widest">Establish Link to begin tactical coordination.</p>
                </div>
              </div>
            )}
            
            {history.map((entry, idx) => (
              <div key={idx} className={`flex gap-6 ${entry.role === 'user' ? 'flex-row-reverse' : ''} animate-in slide-in-from-bottom-2`}>
                <div className={`p-4 rounded-2xl shrink-0 h-fit ${entry.role === 'ai' ? 'bg-google-blue/10 text-google-blue border border-google-blue/20' : 'bg-dark-700 text-gray-400 border border-dark-600'}`}>
                  {entry.role === 'ai' ? <Radio size={24} /> : <Activity size={24} />}
                </div>
                <div className={`max-w-[80%] space-y-2 ${entry.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`p-6 rounded-[2rem] text-sm leading-relaxed ${entry.role === 'ai' ? 'bg-dark-900 border border-dark-700 text-gray-200 shadow-inner' : 'bg-google-blue text-white shadow-xl shadow-google-blue/10'}`}>
                    {entry.text}
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-gray-600 px-4">
                    {entry.role === 'user' ? 'Operator' : 'Commander'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-8 border-t border-dark-700 bg-dark-900/50 flex items-center justify-between">
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-google-green animate-pulse' : 'bg-dark-700'}`} />
                <span className="text-[8px] font-black uppercase text-gray-500">Vocal Link</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-google-blue' : 'bg-dark-700'}`} />
                <span className="text-[8px] font-black uppercase text-gray-500">Neural Sync</span>
              </div>
            </div>
            <div className="text-[8px] font-black uppercase text-gray-700 tracking-widest flex items-center gap-2">
              <Sparkles size={10} /> Powered by Gemini Native Audio
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveLab;
