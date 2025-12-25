import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Terminal, 
  GitBranch, 
  FileText, 
  Play, 
  Square, 
  Cpu, 
  RefreshCw,
  UploadCloud,
  LayoutDashboard,
  Bot,
  Send,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ListVideo,
  Paperclip,
  ImageIcon,
  MapPin,
  Search,
  BrainCircuit,
  Link,
  Wrench,
  XCircle,
  CheckCircle2,
  Shield,
  Workflow,
  Lock,
  Clock,
  CornerDownRight,
  Settings,
  Save,
  RotateCcw,
  BarChart3,
  Database,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Hammer,
  Eye,
  Smartphone,
  Monitor,
  AlertTriangle,
  Zap,
  TestTube
} from 'lucide-react';
import io, { Socket } from 'socket.io-client';
import type { LogMessage, SwarmStatus, ChatMessage, AiModelId, AutoPilotConfig, QueueResponse, HealingProposal, TaskDefinition, AuditScore, GitCommit, SeoPageMetric, KeywordRank, VisualAuditResult } from './types';

// --- Components defined within App.tsx for simplicity ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ElementType, 
  label: string, 
  active?: boolean, 
  onClick: () => void 
}) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
      active 
        ? 'bg-google-blue/10 text-google-blue border-r-2 border-google-blue' 
        : 'text-gray-400 hover:bg-dark-700 hover:text-white'
    }`}
  >
    <Icon size={18} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    running: 'bg-google-green/20 text-google-green border-google-green/30',
    stopped: 'bg-gray-700/50 text-gray-400 border-gray-600',
    error: 'bg-google-red/20 text-google-red border-google-red/30',
    waiting_approval: 'bg-google-yellow/20 text-google-yellow border-google-yellow/30'
  };
  const label = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const colorClass = colors[status as keyof typeof colors] || colors.stopped;

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colorClass} flex items-center gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'running' ? 'animate-pulse bg-current' : 'bg-current'}`}></span>
      {label}
    </span>
  );
};

const CircleProgress = ({ score, label, color }: { score: number, label: string, color: string }) => {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score * circumference);
    
    return (
        <div className="flex flex-col items-center">
            <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={radius} stroke="#3c4043" strokeWidth="6" fill="transparent" />
                    <circle 
                        cx="40" cy="40" r={radius} 
                        stroke={color} strokeWidth="6" 
                        fill="transparent" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                    {Math.round(score * 100)}
                </div>
            </div>
            <span className="text-xs text-gray-400 mt-2 font-medium">{label}</span>
        </div>
    );
};

const SeoKpiCard = ({ label, value, delta, subLabel }: { label: string, value: string, delta: number, subLabel?: string }) => (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
        <h4 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">{label}</h4>
        <div className="flex items-end gap-3 mb-1">
            <span className="text-3xl font-bold text-white">{value}</span>
            <div className={`flex items-center text-sm font-bold px-1.5 py-0.5 rounded ${delta > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(delta)}%
            </div>
        </div>
        {subLabel && <p className="text-gray-500 text-xs">{subLabel}</p>}
    </div>
);

// --- Main App Component ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'qa' | 'ai' | 'manage' | 'seo'>('dashboard');
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatus>({ design: 'stopped', seo: 'stopped' });
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [qaContent, setQaContent] = useState<string>('Loading QA Report...');
  const [socket, setSocket] = useState<Socket | null>(null);
  
  // Auto Pilot State
  const [autoPilot, setAutoPilot] = useState<AutoPilotConfig>({ enabled: false, standardsMode: false, model: 'gemini-3-pro' });
  
  // Queue State
  const [queueStatus, setQueueStatus] = useState<QueueResponse>({ processing: false, activeTasks: [], queue: [] });

  // Self-Healing State
  const [healingProposal, setHealingProposal] = useState<HealingProposal | null>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState<AiModelId>('gemini-3-pro');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  // Manage Tab State
  const [auditScores, setAuditScores] = useState<AuditScore | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [gitLog, setGitLog] = useState<GitCommit[]>([]);
  const [facts, setFacts] = useState<string>('{\n  "project_name": "Flood Doctor",\n  "rules": []\n}');
  
  // QA Tab State
  const [visualAudit, setVisualAudit] = useState<VisualAuditResult | null>(null);
  const [isVisualAuditing, setIsVisualAuditing] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- MOCK SEO DATA ---
  const MOCK_SEO_DATA = {
      kpi: { 
          traffic: 12500, trafficDelta: 12, 
          rank: 4.2, rankDelta: -0.3, // -0.3 rank is GOOD (closer to 1) but conventionally negative delta in rank is green? Let's assume lower is better.
          ctr: 3.8, ctrDelta: 0.5 
      },
      pages: [
          { url: '/water-damage-restoration', clicks: 450, impressions: 12000, position: 3.2, ctr: 3.75, lastUpdated: '2023-10-25' },
          { url: '/mold-remediation', clicks: 320, impressions: 8500, position: 5.1, ctr: 3.76, lastUpdated: '2023-10-24' },
          { url: '/emergency-services', clicks: 800, impressions: 45000, position: 8.5, ctr: 1.77, lastUpdated: '2023-10-26' }, // Underperforming
          { url: '/blog/signs-of-water-damage', clicks: 150, impressions: 2000, position: 2.1, ctr: 7.5, lastUpdated: '2023-10-20' },
          { url: '/contact-us', clicks: 120, impressions: 1500, position: 1.0, ctr: 8.0, lastUpdated: '2023-10-01' },
      ],
      keywords: [
          { keyword: 'flood cleanup near me', position: 3, delta: 1, url: '/water-damage-restoration' },
          { keyword: 'emergency water removal', position: 5, delta: -1, url: '/emergency-services' },
          { keyword: 'black mold removal cost', position: 2, delta: 0, url: '/mold-remediation' },
          { keyword: 'water damage repair', position: 7, delta: 2, url: '/water-damage-restoration' },
          { keyword: '24/7 flood service', position: 4, delta: 0, url: '/emergency-services' },
      ]
  };

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('status', (status: SwarmStatus) => {
      setSwarmStatus(status);
    });

    newSocket.on('log', (message: LogMessage) => {
      setLogs((prev) => [...prev.slice(-999), message]); // Keep last 1000 logs
    });
    
    newSocket.on('autopilot-config', (config: AutoPilotConfig) => {
        setAutoPilot(config);
    });

    newSocket.on('healing-proposal', (proposal: HealingProposal) => {
        setHealingProposal(proposal);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // TELEMETRY & BLACK BOX RECORDER
  useEffect(() => {
      const handleError = (event: ErrorEvent) => {
          fetch('http://localhost:3001/api/telemetry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  error: event.message,
                  stack: event.error?.stack || 'No Stack Trace'
              })
          }).catch(e => console.error("Telemetry failed", e));
      };

      const handleRejection = (event: PromiseRejectionEvent) => {
          fetch('http://localhost:3001/api/telemetry', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  error: `Unhandled Rejection: ${event.reason}`,
                  stack: 'No Stack Trace'
              })
          }).catch(e => console.error("Telemetry failed", e));
      };

      window.addEventListener('error', handleError);
      window.addEventListener('unhandledrejection', handleRejection);

      return () => {
          window.removeEventListener('error', handleError);
          window.removeEventListener('unhandledrejection', handleRejection);
      };
  }, []);

  // Poll Queue Status
  useEffect(() => {
      const fetchQueue = async () => {
          try {
              const res = await fetch('http://localhost:3001/api/queue/status');
              const data = await res.json();
              setQueueStatus(data);
          } catch (e) {
              console.error("Queue poll failed", e);
          }
      };

      const interval = setInterval(fetchQueue, 1000);
      return () => clearInterval(interval);
  }, []);

  // Fetch Manage Data
  useEffect(() => {
      if (activeTab === 'manage') {
          // Fetch Git Log
          fetch('http://localhost:3001/api/git/log')
              .then(res => res.json())
              .then(data => setGitLog(data))
              .catch(console.error);
      }
  }, [activeTab]);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'dashboard') {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab]);

  // Auto-scroll Chat
  useEffect(() => {
    if (activeTab === 'ai') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, activeTab]);

  // Fetch QA Content
  useEffect(() => {
    if (activeTab === 'qa') {
      fetch('http://localhost:3001/api/qa')
        .then(res => res.json())
        .then(data => setQaContent(data.content))
        .catch(err => setQaContent('Failed to load QA report.'));
    }
  }, [activeTab]);

  // Handlers
  const handleStart = async (agentId: string) => {
    await fetch(`http://localhost:3001/api/start/${agentId}`, { method: 'POST' });
  };

  const handleStop = async (agentId: string) => {
    await fetch(`http://localhost:3001/api/stop/${agentId}`, { method: 'POST' });
  };

  const handleGitMerge = async () => {
    await fetch('http://localhost:3001/api/git/merge', { method: 'POST' });
  };

  const handleDeploy = async () => {
    await fetch('http://localhost:3001/api/deploy', { method: 'POST' });
  };
  
  const handleApproveFix = async () => {
      if (!healingProposal) return;
      await fetch('http://localhost:3001/api/heal/approve', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(healingProposal)
      });
      setHealingProposal(null);
  };

  const handleIgnoreFix = () => {
      setHealingProposal(null);
  };

  const toggleAutoPilot = async () => {
      const newConfig = { ...autoPilot, enabled: !autoPilot.enabled };
      await fetch('http://localhost:3001/api/autopilot', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(newConfig)
      });
  };

  const toggleStandardsMode = async () => {
      const newConfig = { ...autoPilot, standardsMode: !autoPilot.standardsMode };
      await fetch('http://localhost:3001/api/autopilot', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(newConfig)
      });
  };

  const updateProxyModel = async (model: AiModelId) => {
      const newConfig = { ...autoPilot, model };
      await fetch('http://localhost:3001/api/autopilot', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(newConfig)
      });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!chatInput.trim() && !attachedImage) || isAiLoading) return;

    const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: chatInput,
        image: attachedImage || undefined,
        timestamp: Date.now()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setAttachedImage(null);
    setIsAiLoading(true);

    try {
        const res = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: userMsg.content, 
                model: selectedModel,
                image: userMsg.image 
            })
        });
        const data = await res.json();
        
        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            content: data.response || "Error getting response",
            modelUsed: selectedModel,
            timestamp: Date.now()
        };
        setChatHistory(prev => [...prev, aiMsg]);
    } catch (err) {
        console.error(err);
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            content: "Error communicating with AI swarm.",
            timestamp: Date.now()
        };
        setChatHistory(prev => [...prev, errorMsg]);
    } finally {
        setIsAiLoading(false);
    }
  };

  // SEO Tab Handlers
  const handleSeoFix = (pageUrl: string) => {
    setActiveTab('ai');
    setChatInput(`@SEO_Agent This page ${pageUrl} is underperforming. Analyze the content against competitors and rewrite the H1 and Meta Description to improve CTR.`);
  };

  // Manage Tab Handlers
  const runAudit = async () => {
      setIsAuditing(true);
      try {
          const res = await fetch('http://localhost:3001/api/audit/lighthouse');
          const data = await res.json();
          setAuditScores(data);
      } catch (e) {
          console.error("Audit failed", e);
      } finally {
          setIsAuditing(false);
      }
  };

  const runVisualAudit = async () => {
      setIsVisualAuditing(true);
      try {
          const res = await fetch('http://localhost:3001/api/qa/visual', { method: 'POST' });
          const data = await res.json();
          setVisualAudit(data);
      } catch (e) {
          console.error("Visual Audit failed", e);
      } finally {
          setIsVisualAuditing(false);
      }
  };

  const runLintDesign = async () => {
      await fetch('http://localhost:3001/api/tasks/lint_design', { method: 'POST' });
  };

  const runGenTests = async () => {
      await fetch('http://localhost:3001/api/tasks/gen_tests', { method: 'POST' });
  };

  const revertCommit = async (hash: string) => {
      if (!confirm(`Are you sure you want to hard reset to ${hash}? This is destructive.`)) return;
      try {
          await fetch('http://localhost:3001/api/git/reset', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hash })
          });
          // Refresh log
          const res = await fetch('http://localhost:3001/api/git/log');
          const data = await res.json();
          setGitLog(data);
      } catch (e) {
          console.error("Reset failed", e);
      }
  };

  const saveFacts = async () => {
      try {
          const factsObj = JSON.parse(facts);
          await fetch('http://localhost:3001/api/facts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(factsObj)
          });
          alert("Knowledge Base Updated");
      } catch (e) {
          alert("Invalid JSON");
      }
  };

  const clearLogs = () => setLogs([]);

  // Render Log Lines
  const renderLogs = () => (
    <div className="bg-dark-900 rounded-lg border border-dark-700 h-[600px] overflow-hidden flex flex-col font-mono text-xs">
      <div className="bg-dark-800 px-4 py-2 border-b border-dark-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
             <span className="text-gray-400">Live Terminal Output</span>
             {autoPilot.enabled && (
                 <span className="text-google-green flex items-center gap-1 text-[10px] bg-google-green/10 px-2 py-0.5 rounded border border-google-green/20">
                     <ShieldCheck size={10} /> Auto-Pilot Active
                 </span>
             )}
             {autoPilot.standardsMode && (
                 <span className="text-google-blue flex items-center gap-1 text-[10px] bg-google-blue/10 px-2 py-0.5 rounded border border-google-blue/20">
                     <Shield size={10} /> Standards Mode
                 </span>
             )}
        </div>
        <button onClick={clearLogs} className="text-gray-500 hover:text-white">Clear</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {logs.length === 0 && <div className="text-gray-600 italic">No logs generated yet...</div>}
        {logs.map((log, i) => (
          <div key={i} className="break-words flex items-start">
            <span className="text-gray-600 mr-2 shrink-0">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
            <span className={`font-bold mr-2 uppercase w-20 shrink-0 inline-block ${
              log.agentId === 'design' ? 'text-purple-400' : 
              log.agentId === 'seo' ? 'text-blue-400' : 
              log.agentId === 'system' ? 'text-green-400' : 
              log.type === 'ai-proxy' ? 'text-google-yellow' : 'text-gray-400'
            }`}>
              {log.agentId || 'SYSTEM'}
            </span>
            <span className={`whitespace-pre-wrap ${
                log.type === 'stderr' ? 'text-red-400' : 
                log.type === 'ai-proxy' ? 'text-google-yellow font-medium' :
                'text-gray-300'
            }`}>
              {log.message.replace(/\[\d+m/g, '')} 
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );

  // Render Dependency Graph
  const renderTaskTree = () => {
    const allTasks = [...queueStatus.activeTasks, ...queueStatus.queue];
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const childrenMap = new Map<number, TaskDefinition[]>();
    const roots: TaskDefinition[] = [];

    // Build Graph
    allTasks.forEach(task => {
        let hasVisibleParent = false;
        if (task.dependencies) {
            task.dependencies.forEach(depId => {
                if (taskMap.has(depId)) {
                    hasVisibleParent = true;
                    if (!childrenMap.has(depId)) childrenMap.set(depId, []);
                    childrenMap.get(depId)!.push(task);
                }
            });
        }
        if (!hasVisibleParent) {
            roots.push(task);
        }
    });

    // Sort roots: Active first, then by ID
    roots.sort((a, b) => {
        if (a.status === 'processing' && b.status !== 'processing') return -1;
        if (a.status !== 'processing' && b.status === 'processing') return 1;
        return a.id - b.id;
    });

    const renderNode = (task: TaskDefinition, depth: number, isLastChild: boolean) => {
        const isRunning = task.status === 'processing';
        const children = childrenMap.get(task.id) || [];
        
        return (
            <div key={task.id} className="relative">
                <div className={`flex items-center gap-2 p-2 rounded mb-1 border transition-colors ${
                    isRunning 
                      ? 'bg-google-blue/10 border-google-blue/30' 
                      : 'bg-dark-700 border-dark-600 hover:border-gray-500'
                }`} style={{ marginLeft: `${depth * 20}px` }}>
                    
                    {/* Tree Connector */}
                    {depth > 0 && (
                        <span className="absolute -left-3 top-[-10px] w-3 h-[24px] border-l border-b border-dark-600 rounded-bl-sm pointer-events-none" 
                              style={{ marginLeft: `${depth * 20}px` }}></span>
                    )}

                    {/* Status Icon */}
                    <div className="shrink-0 relative z-10">
                        {isRunning ? (
                            <Loader2 size={14} className="text-google-blue animate-spin" />
                        ) : (
                            // Determine status: Ready if root, Blocked if depth > 0 (parent visible)
                            depth > 0 
                                ? <Lock size={12} className="text-gray-500" /> 
                                : <Clock size={14} className="text-google-yellow" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                            <span className={`text-xs font-medium truncate ${isRunning ? 'text-google-blue' : 'text-gray-300'}`}>
                                {task.name || task.type}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">#{task.id}</span>
                        </div>
                        {task.lastLog && (
                            <div className="text-[10px] text-gray-500 truncate font-mono mt-0.5">
                                {task.lastLog}
                            </div>
                        )}
                        {!isRunning && task.status === 'pending' && depth > 0 && (
                            <div className="text-[9px] text-red-400 font-mono mt-0.5 flex items-center gap-1">
                                <span>Waiting for parent...</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {children.map((child, i) => renderNode(child, depth + 1, i === children.length - 1))}
            </div>
        );
    };

    return (
        <div className="space-y-1 mt-2 pb-2">
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2 border-b border-dark-700 pb-1">
                <span>Task Execution Graph</span>
                <span className="bg-dark-700 px-1.5 rounded">{allTasks.length} Tasks</span>
            </div>
            {roots.length === 0 && <div className="text-gray-500 text-xs text-center py-4">System Idle</div>}
            {roots.map((root, i) => renderNode(root, 0, i === roots.length - 1))}
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-dark-900 text-gray-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-800 border-r border-dark-700 flex flex-col">
        <div className="p-6 border-b border-dark-700">
          <div className="flex items-center gap-2 text-google-blue mb-1">
            <Activity className="animate-pulse" size={24} />
            <h1 className="text-lg font-bold tracking-tight text-white">Flood Doctor</h1>
          </div>
          <p className="text-xs text-gray-500 font-mono">MISSION CONTROL v1.0</p>
        </div>

        <nav className="flex-1 p-4">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Swarm Overview" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          <SidebarItem 
            icon={Bot} 
            label="AI Command Center" 
            active={activeTab === 'ai'} 
            onClick={() => setActiveTab('ai')} 
          />
          <SidebarItem 
            icon={LineChart} 
            label="SEO Center" 
            active={activeTab === 'seo'} 
            onClick={() => setActiveTab('seo')} 
          />
          <SidebarItem 
            icon={Terminal} 
            label="Unified Logs" 
            active={activeTab === 'logs'} 
            onClick={() => setActiveTab('logs')} 
          />
          <SidebarItem 
            icon={Eye} 
            label="QA & Visual" 
            active={activeTab === 'qa'} 
            onClick={() => setActiveTab('qa')} 
          />
          <SidebarItem 
            icon={Settings} 
            label="Project Manage" 
            active={activeTab === 'manage'} 
            onClick={() => setActiveTab('manage')} 
          />
        </nav>

        <div className="p-4 border-t border-dark-700">
            {/* Auto Pilot Control */}
            <div className={`p-3 rounded-lg mb-2 border transition-colors ${
                autoPilot.enabled ? 'bg-google-blue/10 border-google-blue/30' : 'bg-dark-700 border-transparent'
            }`}>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                        {autoPilot.enabled ? <ShieldCheck size={12} className="text-google-blue"/> : <ShieldAlert size={12} className="text-gray-500"/>}
                        AUTO-PILOT
                    </span>
                    <button 
                        onClick={toggleAutoPilot}
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${autoPilot.enabled ? 'bg-google-blue' : 'bg-gray-600'}`}
                    >
                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${autoPilot.enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                </div>
                {autoPilot.enabled && (
                    <select 
                        className="w-full text-[10px] bg-dark-900 border border-dark-600 rounded px-1 py-1 text-gray-300"
                        value={autoPilot.model}
                        onChange={(e) => updateProxyModel(e.target.value as AiModelId)}
                    >
                        <option value="gemini-3-pro">Gemini 3 Pro (Proxy)</option>
                        <option value="claude-sim">Claude (Proxy)</option>
                        <option value="perplexity-sim">ChatGPT (Proxy)</option>
                    </select>
                )}
            </div>
            
            {/* Standards Mode Toggle */}
             <div className={`p-3 rounded-lg mb-4 border transition-colors ${
                autoPilot.standardsMode ? 'bg-google-green/10 border-google-green/30' : 'bg-dark-700 border-transparent'
            }`}>
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                        <Shield size={12} className={autoPilot.standardsMode ? "text-google-green" : "text-gray-500"}/>
                        ENFORCE STANDARDS
                    </span>
                    <button 
                        onClick={toggleStandardsMode}
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors ${autoPilot.standardsMode ? 'bg-google-green' : 'bg-gray-600'}`}
                    >
                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${autoPilot.standardsMode ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                </div>
            </div>

          <div className="text-xs text-gray-500 mb-2 font-mono uppercase">System Status</div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-300">Socket</span>
            <span className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-google-green' : 'bg-google-red'}`}></span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-dark-900">
        <header className="h-16 border-b border-dark-700 bg-dark-900/50 backdrop-blur sticky top-0 z-10 flex items-center px-8 justify-between">
          <h2 className="text-xl font-semibold text-white">
            {activeTab === 'dashboard' && 'Operations Dashboard'}
            {activeTab === 'ai' && 'AI Command Center'}
            {activeTab === 'seo' && 'SEO Center'}
            {activeTab === 'logs' && 'System Logs'}
            {activeTab === 'qa' && 'Quality Assurance & Visual'}
            {activeTab === 'manage' && 'Project Management'}
          </h2>
          <div className="flex items-center space-x-4">
             {/* Queue Indicator */}
             <div className="flex flex-col group relative">
                 <div className="flex items-center gap-3 bg-dark-800 border border-dark-600 px-3 py-1.5 rounded-lg min-w-[200px] transition-all cursor-default hover:bg-dark-700">
                    <div className={`rounded-full p-1.5 shrink-0 ${queueStatus.processing ? 'bg-google-yellow/20 text-google-yellow animate-spin' : 'bg-dark-700 text-gray-500'}`}>
                        {queueStatus.processing ? <Loader2 size={14} /> : <Workflow size={14} />}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                {queueStatus.processing ? 'System Active' : 'Queue Idle'}
                            </span>
                            {queueStatus.queue.length > 0 && !queueStatus.processing && (
                                <span className="text-[10px] bg-dark-700 px-1.5 rounded text-white">{queueStatus.queue.length}</span>
                            )}
                        </div>
                        
                        {queueStatus.processing ? (
                             <span className="text-xs text-white font-medium">
                                 {queueStatus.activeTasks.length} Task(s) Running
                             </span>
                        ) : (
                             <span className="text-xs text-gray-500 font-medium">
                                {queueStatus.queue.length > 0 ? `${queueStatus.queue.length} Pending Tasks` : 'No active tasks'}
                             </span>
                        )}
                    </div>
                 </div>

                 {/* Dropdown for Tasks (Hover) */}
                 {(queueStatus.queue.length > 0 || queueStatus.activeTasks.length > 0) && (
                     <div className="absolute top-full right-0 mt-2 w-96 bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-4 z-50 hidden group-hover:block">
                        {renderTaskTree()}
                     </div>
                 )}
             </div>

             <div className="h-6 w-px bg-dark-700 mx-2"></div>

             <button 
                onClick={handleGitMerge} 
                className="flex items-center gap-2 bg-dark-700 hover:bg-dark-600 text-white px-3 py-1.5 rounded-md text-sm transition-colors border border-dark-600"
             >
                <GitBranch size={14} /> Merge & Sync
             </button>
             <button 
                onClick={handleDeploy} 
                className="flex items-center gap-2 bg-google-blue hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm transition-colors font-medium"
             >
                <UploadCloud size={14} /> Deploy
             </button>
             
             {/* BUILDER MODE INDICATOR */}
             {selectedModel === 'builder-mode' && (
                 <div className="ml-2 bg-purple-900/50 border border-purple-500/50 text-purple-200 px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2 animate-pulse">
                     <Hammer size={14} /> BUILDER ACTIVE
                 </div>
             )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 overflow-y-auto pb-20">
              
              {/* Healing Proposal Card */}
              {healingProposal && (
                  <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 shadow-2xl relative animate-in fade-in slide-in-from-top-4">
                      <div className="absolute top-0 right-0 p-4 opacity-20">
                          <Wrench size={80} className="text-red-500" />
                      </div>
                      <div className="relative z-10">
                          <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                              <ShieldAlert className="text-red-500" /> 
                              System Healing Required
                          </h3>
                          <p className="text-sm text-gray-300 mb-4 font-medium">
                              Agent <span className="text-red-300 font-bold">{healingProposal.agentId}</span> has failed. 
                              Gemini has analyzed the logs.
                          </p>
                          
                          <div className="bg-dark-900/50 rounded-lg p-4 mb-4 border border-red-500/30">
                              <div className="flex items-start gap-4 mb-3">
                                  <div className="w-20 shrink-0 text-xs text-gray-500 uppercase font-bold tracking-wider">Diagnosis</div>
                                  <div className="text-sm text-white">{healingProposal.diagnosis}</div>
                              </div>
                              <div className="flex items-start gap-4 mb-3">
                                  <div className="w-20 shrink-0 text-xs text-gray-500 uppercase font-bold tracking-wider">Explanation</div>
                                  <div className="text-sm text-gray-400">{healingProposal.explanation}</div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="w-20 shrink-0 text-xs text-gray-500 uppercase font-bold tracking-wider">Proposed Fix</div>
                                  <code className="text-xs bg-dark-900 px-2 py-1 rounded text-green-400 font-mono border border-green-900">
                                      $ {healingProposal.fixCommand}
                                  </code>
                              </div>
                          </div>

                          <div className="flex gap-3">
                              <button 
                                  onClick={handleApproveFix}
                                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                              >
                                  <CheckCircle2 size={16} /> Approve & Run Fix
                              </button>
                              <button 
                                  onClick={handleIgnoreFix}
                                  className="bg-dark-700 hover:bg-dark-600 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                              >
                                  <XCircle size={16} /> Ignore
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* Agent Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Design Agent */}
                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Cpu size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          Design Agent
                          <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-dark-700 rounded">~/design-build</span>
                          {autoPilot.standardsMode && (
                             <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-900/40 text-green-400 border border-green-700/50 gap-1">
                                 <Shield size={10} /> Verified Standards
                             </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">Responsible for UI/UX, Component Generation</p>
                      </div>
                      <StatusBadge status={swarmStatus.design} />
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      {swarmStatus.design !== 'running' ? (
                        <button 
                          onClick={() => handleStart('design')}
                          className="flex-1 bg-google-blue hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Play size={16} fill="currentColor" /> Start Agent {autoPilot.enabled ? '(Auto-Pilot)' : ''}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStop('design')}
                          className="flex-1 bg-dark-700 hover:bg-red-900/30 hover:text-red-500 hover:border-red-500/50 border border-dark-600 text-gray-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                        >
                          <Square size={16} fill="currentColor" /> Stop Agent
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SEO Agent */}
                <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                    <RefreshCw size={120} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          SEO Agent
                          <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-dark-700 rounded">~/seo-content</span>
                          {autoPilot.standardsMode && (
                             <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-900/40 text-green-400 border border-green-700/50 gap-1">
                                 <Shield size={10} /> Verified Standards
                             </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">Responsible for Content Strategy, Keywords</p>
                      </div>
                      <StatusBadge status={swarmStatus.seo} />
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      {swarmStatus.seo !== 'running' ? (
                        <button 
                          onClick={() => handleStart('seo')}
                          className="flex-1 bg-google-blue hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                          <Play size={16} fill="currentColor" /> Start Agent {autoPilot.enabled ? '(Auto-Pilot)' : ''}
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleStop('seo')}
                          className="flex-1 bg-dark-700 hover:bg-red-900/30 hover:text-red-500 hover:border-red-500/50 border border-dark-600 text-gray-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                        >
                          <Square size={16} fill="currentColor" /> Stop Agent
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Logs Preview */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Recent Activity</h3>
                {renderLogs()}
              </div>
            </div>
          )}

          {/* AI COMMAND CENTER VIEW */}
          {activeTab === 'ai' && (
             <div className="flex flex-col h-full bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
                {/* Chat Header / Toolbar */}
                <div className="bg-dark-900 border-b border-dark-700 p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-google-blue/20 p-2 rounded-lg text-google-blue">
                             <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Ops Support Swarm</h3>
                            <p className="text-xs text-gray-400">Powered by Gemini 3 Pro</p>
                        </div>
                    </div>
                    
                    <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as AiModelId)}
                        className="bg-dark-800 border border-dark-600 text-white text-sm rounded-lg focus:ring-google-blue focus:border-google-blue block p-2.5"
                    >
                        <optgroup label="Core Models">
                            <option value="gemini-3-pro">Gemini 3 Pro (Standard)</option>
                            <option value="deep-reasoning">Gemini Deep Reasoning (Thinking Mode)</option>
                            <option value="builder-mode">Builder Mode (Atomic & Safe)</option>
                        </optgroup>
                        <optgroup label="QA & Grounding">
                            <option value="qa-critic">QA Critic & Fact Checker</option>
                            <option value="search-grounding">Gemini Live Search</option>
                            <option value="maps-grounding">Gemini Maps</option>
                        </optgroup>
                        <optgroup label="Consensus & Sims">
                            <option value="swarm-consensus">Swarm Consensus (Multi-Agent)</option>
                            <option value="claude-sim">Claude 3.5 Sonnet (Simulated)</option>
                            <option value="perplexity-sim">Perplexity (Simulated)</option>
                            <option value="recraft-sim">Recraft (Simulated)</option>
                        </optgroup>
                    </select>
                </div>

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {chatHistory.length === 0 && (
                        <div className="text-center text-gray-500 mt-20">
                            <Bot size={48} className="mx-auto mb-4 opacity-50" />
                            <h4 className="text-lg font-medium text-gray-300">How can I help you, Doctor?</h4>
                            <p className="text-sm max-w-md mx-auto mt-2">I can help orchestrate your agents, analyze logs, analyze images, or synthesize advice from multiple AI personas.</p>
                            <div className="flex gap-2 justify-center mt-4">
                                <span className="text-xs px-2 py-1 bg-dark-700 rounded text-gray-400 flex items-center gap-1"><BrainCircuit size={10}/> Deep Thinking</span>
                                <span className="text-xs px-2 py-1 bg-dark-700 rounded text-gray-400 flex items-center gap-1"><Search size={10}/> Live Search</span>
                                <span className="text-xs px-2 py-1 bg-dark-700 rounded text-gray-400 flex items-center gap-1"><MapPin size={10}/> Maps</span>
                                <span className="text-xs px-2 py-1 bg-dark-700 rounded text-gray-400 flex items-center gap-1"><ImageIcon size={10}/> Vision</span>
                            </div>
                        </div>
                    )}
                    
                    {chatHistory.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-4 ${
                                msg.role === 'user' 
                                    ? 'bg-google-blue text-white' 
                                    : 'bg-dark-700 text-gray-200 border border-dark-600'
                            }`}>
                                {msg.role === 'ai' && (
                                    <div className="flex items-center gap-2 mb-2 text-xs opacity-70 border-b border-gray-600 pb-1">
                                        <Bot size={12} />
                                        <span>{msg.modelUsed === 'swarm-consensus' ? 'Swarm Consensus' : msg.modelUsed?.toUpperCase() || 'GEMINI'}</span>
                                    </div>
                                )}
                                {msg.image && (
                                    <div className="mb-3">
                                        <img src={msg.image} alt="Uploaded" className="max-w-full max-h-64 rounded-lg border border-white/10" />
                                    </div>
                                )}
                                <div className="prose prose-invert prose-sm whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isAiLoading && (
                        <div className="flex justify-start">
                            <div className="bg-dark-700 text-gray-400 p-4 rounded-lg border border-dark-600 flex items-center gap-2">
                                <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-google-blue rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSendMessage} className="p-4 bg-dark-900 border-t border-dark-700">
                    {attachedImage && (
                        <div className="mb-2 flex items-center gap-2 bg-dark-800 p-2 rounded-lg w-fit border border-dark-600">
                             <img src={attachedImage} className="w-10 h-10 object-cover rounded" alt="Preview"/>
                             <button type="button" onClick={() => setAttachedImage(null)} className="text-gray-400 hover:text-white text-xs">Remove</button>
                        </div>
                    )}
                    <div className="flex items-end gap-2">
                        <button 
                             type="button" 
                             onClick={() => fileInputRef.current?.click()}
                             className="text-gray-400 hover:text-white transition-colors p-3 bg-dark-800 border border-dark-600 rounded-lg h-[50px] flex items-center justify-center"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            className="hidden" 
                            accept="image/*"
                        />
                        
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Ask the swarm..."
                                className="w-full bg-dark-800 border border-dark-600 text-white rounded-lg pl-4 pr-12 py-3 focus:ring-2 focus:ring-google-blue focus:border-transparent outline-none"
                            />
                            <button 
                                type="submit" 
                                disabled={(!chatInput.trim() && !attachedImage) || isAiLoading}
                                className="absolute right-2 top-2 p-1.5 bg-google-blue text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </form>
             </div>
          )}

          {/* SEO TAB */}
          {activeTab === 'seo' && (
             <div className="space-y-6 pb-20">
                 {/* Auto Scan Indicator */}
                 <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 flex justify-between items-center shadow-md">
                     <div className="flex items-center gap-3">
                         <div className="bg-purple-500/10 p-2 rounded-lg text-purple-400">
                             <Clock size={20} />
                         </div>
                         <div>
                             <h4 className="text-sm font-bold text-white">Automated Newsroom Scan</h4>
                             <p className="text-xs text-gray-500">Scheduled Weekly Analysis</p>
                         </div>
                     </div>
                     <span className="text-xs font-mono text-gray-400 bg-dark-700 px-3 py-1 rounded border border-dark-600">
                         Next Auto-Scan: Monday 9:00 AM
                     </span>
                 </div>

                 {/* KPI Cards */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <SeoKpiCard 
                         label="Total Traffic (MoM)" 
                         value={MOCK_SEO_DATA.kpi.traffic.toLocaleString()} 
                         delta={MOCK_SEO_DATA.kpi.trafficDelta} 
                         subLabel="Unique Visitors"
                     />
                     <SeoKpiCard 
                         label="Avg. Position" 
                         value={MOCK_SEO_DATA.kpi.rank.toFixed(1)} 
                         delta={-MOCK_SEO_DATA.kpi.rankDelta} 
                         subLabel="All Keywords"
                     />
                     <SeoKpiCard 
                         label="Click-Through Rate" 
                         value={MOCK_SEO_DATA.kpi.ctr.toFixed(1) + '%'} 
                         delta={MOCK_SEO_DATA.kpi.ctrDelta} 
                         subLabel="Organic Search"
                     />
                 </div>

                 {/* Pages Table */}
                 <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                     <div className="flex items-center gap-2 text-white font-bold mb-4">
                         <FileText className="text-google-blue" size={20} />
                         <h3>Page Performance</h3>
                     </div>
                     <div className="overflow-x-auto">
                         <table className="w-full text-sm text-left text-gray-400">
                             <thead className="text-xs text-gray-500 uppercase bg-dark-900 border-b border-dark-700">
                                 <tr>
                                     <th className="px-4 py-3">Page URL</th>
                                     <th className="px-4 py-3 text-right">Clicks</th>
                                     <th className="px-4 py-3 text-right">Impressions</th>
                                     <th className="px-4 py-3 text-right">CTR</th>
                                     <th className="px-4 py-3 text-right">Pos</th>
                                     <th className="px-4 py-3 text-center">Actions</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {MOCK_SEO_DATA.pages.map((page, idx) => (
                                     <tr key={idx} className="border-b border-dark-700 hover:bg-dark-700/50">
                                         <td className="px-4 py-3 font-mono text-xs text-white truncate max-w-[200px]" title={page.url}>
                                             {page.url}
                                         </td>
                                         <td className="px-4 py-3 text-right">{page.clicks}</td>
                                         <td className="px-4 py-3 text-right">{page.impressions.toLocaleString()}</td>
                                         <td className={`px-4 py-3 text-right font-medium ${page.ctr < 2 ? 'text-red-400' : 'text-green-400'}`}>
                                             {page.ctr}%
                                         </td>
                                         <td className="px-4 py-3 text-right">{page.position}</td>
                                         <td className="px-4 py-3 text-center">
                                             <button 
                                                 onClick={() => handleSeoFix(page.url)}
                                                 className="text-xs bg-google-blue/10 text-google-blue hover:bg-google-blue/20 px-2 py-1 rounded border border-google-blue/30 flex items-center gap-1 mx-auto transition-colors"
                                             >
                                                 <Sparkles size={10} /> Fix
                                             </button>
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>

                 {/* Keywords Table */}
                 <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                     <div className="flex items-center gap-2 text-white font-bold mb-4">
                         <Search className="text-google-yellow" size={20} />
                         <h3>Keyword Rankings</h3>
                     </div>
                     <div className="overflow-x-auto">
                         <table className="w-full text-sm text-left text-gray-400">
                             <thead className="text-xs text-gray-500 uppercase bg-dark-900 border-b border-dark-700">
                                 <tr>
                                     <th className="px-4 py-3">Keyword</th>
                                     <th className="px-4 py-3 text-right">Position</th>
                                     <th className="px-4 py-3 text-right">Change</th>
                                     <th className="px-4 py-3 text-right">Target URL</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {MOCK_SEO_DATA.keywords.map((kw, idx) => (
                                     <tr key={idx} className="border-b border-dark-700 hover:bg-dark-700/50">
                                         <td className="px-4 py-3 font-medium text-white">{kw.keyword}</td>
                                         <td className="px-4 py-3 text-right font-bold">{kw.position}</td>
                                         <td className={`px-4 py-3 text-right ${kw.delta > 0 ? 'text-green-400' : kw.delta < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                             {kw.delta > 0 ? '▲' : kw.delta < 0 ? '▼' : '-'} {Math.abs(kw.delta)}
                                         </td>
                                         <td className="px-4 py-3 text-right font-mono text-xs text-gray-500 truncate max-w-[150px]">
                                             {kw.url}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                 </div>
             </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="h-full">
               {renderLogs()}
            </div>
          )}

          {/* QA TAB */}
          {activeTab === 'qa' && (
            <div className="space-y-6 h-full pb-20">
                {/* Visual Sentinel Card */}
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-2 text-white font-bold">
                            <Eye className="text-google-blue" size={20} />
                            <h3>Visual Sentinel (Regression Testing)</h3>
                        </div>
                        <button 
                            onClick={runVisualAudit}
                            disabled={isVisualAuditing}
                            className="bg-dark-700 hover:bg-dark-600 text-xs px-3 py-1.5 rounded-lg border border-dark-600 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isVisualAuditing ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
                            Run Visual Audit
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Desktop Preview */}
                        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700 flex flex-col items-center">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 uppercase tracking-wide">
                                <Monitor size={14} /> Desktop (1920px)
                            </div>
                            <div className="w-full aspect-video bg-dark-800 rounded border border-dark-600 flex items-center justify-center overflow-hidden relative">
                                {visualAudit?.desktop ? (
                                    <img src={`http://localhost:3001${visualAudit.desktop}?t=${Date.now()}`} alt="Desktop Screenshot" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity cursor-pointer" />
                                ) : (
                                    <div className="text-gray-600 text-xs italic">No baseline available</div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Preview */}
                        <div className="bg-dark-900 rounded-lg p-3 border border-dark-700 flex flex-col items-center">
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 uppercase tracking-wide">
                                <Smartphone size={14} /> Mobile (375px)
                            </div>
                            <div className="h-full aspect-[9/16] max-h-[250px] bg-dark-800 rounded border border-dark-600 flex items-center justify-center overflow-hidden relative">
                                {visualAudit?.mobile ? (
                                    <img src={`http://localhost:3001${visualAudit.mobile}?t=${Date.now()}`} alt="Mobile Screenshot" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity cursor-pointer" />
                                ) : (
                                    <div className="text-gray-600 text-xs italic">No baseline available</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Standard QA Report */}
                <div className="bg-dark-800 rounded-lg border border-dark-700 p-8 flex-1 overflow-y-auto min-h-[400px]">
                  <h4 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-4 border-b border-dark-700 pb-2">Markdown Issue Log</h4>
                  <div className="prose prose-invert prose-blue max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300">
                      {qaContent}
                    </pre>
                  </div>
                </div>
            </div>
          )}

          {/* MANAGE TAB */}
          {activeTab === 'manage' && (
              <div className="grid grid-cols-2 gap-6 pb-20">
                  {/* Proactive Ops Widget (New) */}
                  <div className="col-span-2 bg-gradient-to-r from-dark-800 to-dark-800/50 border border-dark-700 rounded-xl p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5">
                          <Zap size={100} />
                      </div>
                      <div className="relative z-10 flex items-center justify-between">
                          <div>
                              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                  <Zap className="text-yellow-400" size={20} />
                                  Proactive Ops
                              </h3>
                              <p className="text-sm text-gray-400">Trigger on-demand agents to enforce standards and generate tests.</p>
                          </div>
                          <div className="flex gap-4">
                              <button 
                                  onClick={runLintDesign}
                                  className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg border border-dark-600 flex items-center gap-2 transition-colors shadow-sm"
                              >
                                  <AlertTriangle size={16} className="text-orange-400" />
                                  Design Enforcer
                              </button>
                              <button 
                                  onClick={runGenTests}
                                  className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg border border-dark-600 flex items-center gap-2 transition-colors shadow-sm"
                              >
                                  <TestTube size={16} className="text-purple-400" />
                                  Chaos Generator
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Lighthouse Audit Widget */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                      <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-2 text-white font-bold">
                              <BarChart3 className="text-google-blue" size={20} />
                              <h3>Lighthouse Audit</h3>
                          </div>
                          <button 
                              onClick={runAudit}
                              disabled={isAuditing}
                              className="bg-dark-700 hover:bg-dark-600 text-xs px-3 py-1.5 rounded-lg border border-dark-600 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
                          >
                              {isAuditing ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
                              Run Audit
                          </button>
                      </div>
                      
                      {auditScores ? (
                          <div className="grid grid-cols-4 gap-4">
                              <CircleProgress score={auditScores.performance} label="Performance" color="#34a853" />
                              <CircleProgress score={auditScores.accessibility} label="Accessibility" color="#fbbc04" />
                              <CircleProgress score={auditScores.bestPractices} label="Best Practices" color="#ea4335" />
                              <CircleProgress score={auditScores.seo} label="SEO" color="#1a73e8" />
                          </div>
                      ) : (
                          <div className="h-32 flex items-center justify-center text-gray-500 text-sm italic">
                              {isAuditing ? "Running Audit (this may take a minute)..." : "No audit run recently."}
                          </div>
                      )}
                  </div>

                  {/* Knowledge Base Widget */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2 text-white font-bold">
                              <Database className="text-google-yellow" size={20} />
                              <h3>Knowledge Base (Facts)</h3>
                          </div>
                          <button 
                              onClick={saveFacts}
                              className="bg-google-blue hover:bg-blue-600 text-xs px-3 py-1.5 rounded-lg text-white flex items-center gap-2 transition-colors"
                          >
                              <Save size={12} /> Save Facts
                          </button>
                      </div>
                      <textarea
                          className="flex-1 w-full bg-dark-900 border border-dark-600 rounded-lg p-3 text-xs font-mono text-gray-300 focus:border-google-blue outline-none resize-none"
                          value={facts}
                          onChange={(e) => setFacts(e.target.value)}
                          spellCheck={false}
                      />
                  </div>

                  {/* Git History Widget */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                      <div className="flex items-center gap-2 text-white font-bold mb-4">
                          <GitBranch className="text-white" size={20} />
                          <h3>Git History</h3>
                      </div>
                      <div className="space-y-3">
                          {gitLog.length === 0 && <div className="text-gray-500 text-xs italic">No history available</div>}
                          {gitLog.map((commit) => (
                              <div key={commit.hash} className="flex justify-between items-center bg-dark-900 p-3 rounded-lg border border-dark-600">
                                  <div className="min-w-0 flex-1 mr-4">
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="text-google-blue font-mono text-xs font-bold">{commit.hash}</span>
                                          <span className="text-gray-500 text-[10px]">{commit.date}</span>
                                      </div>
                                      <div className="text-gray-300 text-xs truncate">{commit.message}</div>
                                  </div>
                                  <button 
                                      onClick={() => revertCommit(commit.hash)}
                                      className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded transition-colors"
                                      title="Reset to this commit"
                                  >
                                      <RotateCcw size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* Deployment Pipeline Widget */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 shadow-xl">
                      <div className="flex items-center gap-2 text-white font-bold mb-6">
                          <Workflow className="text-purple-400" size={20} />
                          <h3>Deployment Pipeline</h3>
                      </div>
                      
                      <div className="relative pt-4">
                           {/* Connecting Line */}
                          <div className="absolute top-8 left-10 right-10 h-0.5 bg-dark-600 z-0"></div>
                          
                          <div className="flex justify-between relative z-10">
                              {/* Step 1: Build */}
                              <div className="flex flex-col items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                      queueStatus.activeTasks.some(t => t.type === 'build') 
                                        ? 'bg-dark-900 border-google-blue text-google-blue animate-pulse'
                                        : queueStatus.queue.some(t => t.type === 'build')
                                            ? 'bg-dark-800 border-google-yellow text-google-yellow'
                                            : 'bg-dark-700 border-gray-600 text-gray-500'
                                  }`}>
                                      <Cpu size={14} />
                                  </div>
                                  <span className="text-xs font-medium text-gray-300">Build</span>
                              </div>

                              {/* Step 2: Test (Mocked for now as implied step) */}
                              <div className="flex flex-col items-center gap-2">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 bg-dark-700 border-gray-600 text-gray-500">
                                      <ShieldCheck size={14} />
                                  </div>
                                  <span className="text-xs font-medium text-gray-500">Test</span>
                              </div>

                              {/* Step 3: Deploy */}
                              <div className="flex flex-col items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                                      queueStatus.activeTasks.some(t => t.type === 'deploy') 
                                        ? 'bg-dark-900 border-google-blue text-google-blue animate-pulse'
                                        : queueStatus.queue.some(t => t.type === 'deploy')
                                            ? 'bg-dark-800 border-google-yellow text-google-yellow'
                                            : 'bg-dark-700 border-gray-600 text-gray-500'
                                  }`}>
                                      <UploadCloud size={14} />
                                  </div>
                                  <span className="text-xs font-medium text-gray-300">Deploy</span>
                              </div>
                          </div>

                          <div className="mt-8 bg-dark-900 rounded-lg p-4 border border-dark-600">
                              <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-2">Current Pipeline Status</h4>
                              {queueStatus.activeTasks.some(t => ['build', 'deploy'].includes(t.type)) ? (
                                  <div className="text-xs text-google-blue flex items-center gap-2">
                                      <Loader2 size={12} className="animate-spin" />
                                      Pipeline Active: {queueStatus.activeTasks.find(t => ['build', 'deploy'].includes(t.type))?.name}
                                  </div>
                              ) : (
                                  <div className="text-xs text-gray-500">Pipeline Idle</div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;