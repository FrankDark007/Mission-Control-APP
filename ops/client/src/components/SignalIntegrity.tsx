
import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Wifi, WifiOff, Radio, Zap, Clock, ArrowUpDown, Server, RefreshCw } from 'lucide-react';

interface PingResult {
    timestamp: number;
    latency: number;
}

interface ConnectionStats {
    connected: boolean;
    transport: string;
    latency: number;
    pingHistory: PingResult[];
    messagesIn: number;
    messagesOut: number;
    reconnects: number;
    lastEvent: string;
    uptime: number;
}

const SignalIntegrity: React.FC = () => {
    const [stats, setStats] = useState<ConnectionStats>({
        connected: false,
        transport: 'polling',
        latency: 0,
        pingHistory: [],
        messagesIn: 0,
        messagesOut: 0,
        reconnects: 0,
        lastEvent: 'Initializing...',
        uptime: 0
    });
    const [socket, setSocket] = useState<Socket | null>(null);
    const [waveformData, setWaveformData] = useState<number[]>(Array(64).fill(0));
    const startTimeRef = useRef<number>(Date.now());
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);

        const originalEmit = s.emit.bind(s);
        s.emit = (...args: any[]) => {
            setStats(prev => ({ ...prev, messagesOut: prev.messagesOut + 1 }));
            return originalEmit(...args);
        };

        s.onAny((event) => {
            setStats(prev => ({
                ...prev,
                messagesIn: prev.messagesIn + 1,
                lastEvent: event
            }));
        });

        s.on('connect', () => {
            setStats(prev => ({
                ...prev,
                connected: true,
                transport: s.io.engine.transport.name,
                lastEvent: 'Connected'
            }));
        });

        s.on('disconnect', () => {
            setStats(prev => ({ ...prev, connected: false, lastEvent: 'Disconnected' }));
        });

        s.on('reconnect', (attempt) => {
            setStats(prev => ({
                ...prev,
                reconnects: prev.reconnects + 1,
                lastEvent: `Reconnected (attempt ${attempt})`
            }));
        });

        s.io.engine.on('upgrade', (transport: any) => {
            setStats(prev => ({
                ...prev,
                transport: transport.name,
                lastEvent: `Upgraded to ${transport.name}`
            }));
        });

        // Ping interval for latency measurement
        const pingInterval = setInterval(() => {
            if (s.connected) {
                const start = Date.now();
                s.emit('ping', {}, () => {
                    const latency = Date.now() - start;
                    setStats(prev => ({
                        ...prev,
                        latency,
                        pingHistory: [...prev.pingHistory.slice(-59), { timestamp: Date.now(), latency }]
                    }));
                });
            }
        }, 1000);

        // Uptime counter
        const uptimeInterval = setInterval(() => {
            setStats(prev => ({ ...prev, uptime: Math.floor((Date.now() - startTimeRef.current) / 1000) }));
        }, 1000);

        // Waveform animation
        const waveInterval = setInterval(() => {
            setWaveformData(prev => {
                const newData = [...prev.slice(1)];
                const baseValue = stats.connected ? 0.3 : 0.05;
                const variance = stats.connected ? 0.4 : 0.1;
                newData.push(baseValue + Math.random() * variance);
                return newData;
            });
        }, 50);

        return () => {
            clearInterval(pingInterval);
            clearInterval(uptimeInterval);
            clearInterval(waveInterval);
            s.disconnect();
        };
    }, []);

    // Draw waveform
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 1;
        for (let i = 0; i < height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        // Draw waveform
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        if (stats.connected) {
            gradient.addColorStop(0, '#4285f4');
            gradient.addColorStop(0.5, '#34a853');
            gradient.addColorStop(1, '#4285f4');
        } else {
            gradient.addColorStop(0, '#ea4335');
            gradient.addColorStop(1, '#fbbc04');
        }

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sliceWidth = width / waveformData.length;
        let x = 0;

        for (let i = 0; i < waveformData.length; i++) {
            const v = waveformData[i];
            const y = (1 - v) * height * 0.5 + height * 0.25;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        ctx.stroke();

        // Glow effect
        ctx.shadowColor = stats.connected ? '#4285f4' : '#ea4335';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

    }, [waveformData, stats.connected]);

    const formatUptime = (seconds: number): string => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getLatencyColor = (latency: number): string => {
        if (latency < 50) return 'text-google-green';
        if (latency < 150) return 'text-google-yellow';
        return 'text-google-red';
    };

    const avgLatency = stats.pingHistory.length > 0
        ? Math.round(stats.pingHistory.reduce((a, b) => a + b.latency, 0) / stats.pingHistory.length)
        : 0;

    const maxLatency = stats.pingHistory.length > 0
        ? Math.max(...stats.pingHistory.map(p => p.latency))
        : 0;

    const minLatency = stats.pingHistory.length > 0
        ? Math.min(...stats.pingHistory.map(p => p.latency))
        : 0;

    return (
        <div className="space-y-6 md:space-y-8 lg:space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1">Signal Integrity</h2>
                    <p className="text-sm text-gray-500 font-medium">Real-time WebSocket connection monitoring and diagnostics.</p>
                </div>
                <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border ${stats.connected ? 'bg-google-green/10 border-google-green/30' : 'bg-google-red/10 border-google-red/30'}`}>
                    {stats.connected ? <Wifi className="text-google-green" size={18} /> : <WifiOff className="text-google-red" size={18} />}
                    <span className={`text-[10px] font-black uppercase tracking-widest ${stats.connected ? 'text-google-green' : 'text-google-red'}`}>
                        {stats.connected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
            </div>

            {/* Waveform Visualization */}
            <div className="bg-dark-800 rounded-[2rem] border border-dark-700 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="text-google-blue" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Signal Waveform</h3>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500">
                        <Radio size={12} className={stats.connected ? 'text-google-green animate-pulse' : 'text-google-red'} />
                        {stats.transport.toUpperCase()}
                    </div>
                </div>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={120}
                    className="w-full h-[120px] rounded-xl"
                />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {/* Latency */}
                <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap size={16} className="text-google-yellow" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Latency</span>
                    </div>
                    <div className={`text-3xl font-black ${getLatencyColor(stats.latency)}`}>
                        {stats.latency}<span className="text-sm ml-1">ms</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-gray-600">
                        Avg: {avgLatency}ms | Min: {minLatency}ms | Max: {maxLatency}ms
                    </div>
                </div>

                {/* Uptime */}
                <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={16} className="text-google-blue" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Uptime</span>
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                        {formatUptime(stats.uptime)}
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-gray-600">
                        Reconnects: {stats.reconnects}
                    </div>
                </div>

                {/* Messages In */}
                <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowUpDown size={16} className="text-google-green" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Messages</span>
                    </div>
                    <div className="text-3xl font-black text-google-green">
                        {stats.messagesIn}
                        <span className="text-google-blue ml-2">{stats.messagesOut}</span>
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-gray-600">
                        <span className="text-google-green">IN</span> / <span className="text-google-blue">OUT</span>
                    </div>
                </div>

                {/* Last Event */}
                <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <Server size={16} className="text-google-red" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Last Event</span>
                    </div>
                    <div className="text-lg font-black text-white truncate">
                        {stats.lastEvent}
                    </div>
                    <div className="mt-2 text-[9px] font-bold text-gray-600">
                        Transport: {stats.transport}
                    </div>
                </div>
            </div>

            {/* Latency History Graph */}
            <div className="bg-dark-800 rounded-[2rem] border border-dark-700 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <Activity className="text-google-green" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Latency History</h3>
                    <div className="flex-1" />
                    <span className="text-[10px] font-black uppercase text-gray-500">Last 60 samples</span>
                </div>
                <div className="h-[100px] flex items-end gap-[2px]">
                    {stats.pingHistory.map((ping, i) => {
                        const height = Math.min((ping.latency / 200) * 100, 100);
                        return (
                            <div
                                key={i}
                                className={`flex-1 rounded-t transition-all ${
                                    ping.latency < 50 ? 'bg-google-green' :
                                    ping.latency < 150 ? 'bg-google-yellow' : 'bg-google-red'
                                }`}
                                style={{ height: `${Math.max(height, 2)}%` }}
                                title={`${ping.latency}ms`}
                            />
                        );
                    })}
                    {/* Fill empty slots */}
                    {Array(60 - stats.pingHistory.length).fill(0).map((_, i) => (
                        <div key={`empty-${i}`} className="flex-1 h-[2%] bg-dark-700 rounded-t" />
                    ))}
                </div>
                <div className="flex justify-between mt-2 text-[8px] font-black uppercase text-gray-600">
                    <span>60s ago</span>
                    <span>Now</span>
                </div>
            </div>

            {/* Connection Details */}
            <div className="bg-dark-800 rounded-[2rem] border border-dark-700 p-6 md:p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <Server className="text-google-blue" size={20} />
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Connection Details</h3>
                    <div className="flex-1" />
                    <button
                        onClick={() => socket?.disconnect().connect()}
                        className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-xl transition-colors"
                    >
                        <RefreshCw size={14} className="text-gray-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400">Reconnect</span>
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-dark-900 rounded-xl">
                        <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Endpoint</div>
                        <div className="text-sm font-bold text-white truncate">{window.location.origin}</div>
                    </div>
                    <div className="p-4 bg-dark-900 rounded-xl">
                        <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Path</div>
                        <div className="text-sm font-bold text-white">/socket.io</div>
                    </div>
                    <div className="p-4 bg-dark-900 rounded-xl">
                        <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Transport</div>
                        <div className="text-sm font-bold text-white capitalize">{stats.transport}</div>
                    </div>
                    <div className="p-4 bg-dark-900 rounded-xl">
                        <div className="text-[9px] font-black uppercase text-gray-500 mb-1">Status</div>
                        <div className={`text-sm font-bold ${stats.connected ? 'text-google-green' : 'text-google-red'}`}>
                            {stats.connected ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignalIntegrity;
