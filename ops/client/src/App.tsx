
import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    Shield, Zap, LayoutDashboard, MessageSquare, Settings,
    Swords, Loader2, BrainCircuit, Gavel, BarChart3,
    GitBranch, BookOpen, Bot, Hammer, Cpu, ListTree,
    Cloud, Layout, Brain, Gauge, ShieldAlert, Kanban, Globe,
    Radio, Sparkles, Activity, Home, Crosshair, Search,
    ChevronDown, ChevronRight, Users
} from 'lucide-react';
import { AgentConfig, QueueResponse, HealingProposal, AutoPilotConfig, AiModelId } from './types';

// Mobile Navigation Components
import MobileHeader from './components/ui/MobileHeader';
import MobileDrawer from './components/ui/MobileDrawer';
import BottomNav from './components/ui/BottomNav';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-20 text-center text-google-red font-black uppercase">Critical Terminal Failure. Reloading recommended.</div>;
    return this.props.children;
  }
}

import RecoveryModule from './components/RecoveryModule';
import SeoLab from './components/SeoLab';
import GitPulse from './components/GitPulse';
import ModelsLab from './components/ModelsLab';
import ChatLab from './components/ChatLab';
import CreativeStudio from './components/CreativeStudio';
import BriefingLab from './components/BriefingLab';
import SwarmTopology from './components/SwarmTopology';
import SecurityLab from './components/SecurityLab';
import ConsensusLab from './components/ConsensusLab';
import SwarmBoard from './components/SwarmBoard';
import QACriticLab from './components/QACriticLab';
import AnalyticsLab from './components/AnalyticsLab';
import SandboxLab from './components/SandboxLab';
import PromptLab from './components/PromptLab';
import BuilderLab from './components/BuilderLab';
import ProtocolLab from './components/ProtocolLab';
import LocalAiLab from './components/LocalAiLab';
import EdgeLab from './components/EdgeLab';
import VisualDiff from './components/VisualDiff';
import MissionTimeline from './components/MissionTimeline';
import MemoryLab from './components/MemoryLab';
import LighthouseLab from './components/LighthouseLab';
import IntelligenceLab from './components/IntelligenceLab';
import HomeLab from './components/HomeLab';
import SentinelLab from './components/SentinelLab';
import TaskDependencyGraph from './components/TaskDependencyGraph';
import SignalIntegrity from './components/SignalIntegrity';
import SerpMonitor from './components/SerpMonitor';
import TaskInbox from './components/TaskInbox';
import ProjectsLab from './components/ProjectsLab';

// Task type for inbox
interface InboxTask {
    id: string;
    projectId: string;
    title: string;
    instructions: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    status: 'pending' | 'acknowledged' | 'in_progress' | 'completed' | 'failed';
    createdBy: string;
    createdByModel: string;
    createdAt: string;
    context?: {
        artifactIds?: string[];
        acceptanceCriteria?: string[];
        phase?: string;
    };
}

const App = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [activeTab, setActiveTab] = useState<string>('home');
    const [agentRegistry, setAgentRegistry] = useState<Record<string, AgentConfig>>({});
    const [agentStatus, setAgentStatus] = useState<Record<string, string>>({});
    const [autopilotConfig, setAutopilotConfig] = useState<AutoPilotConfig>({ enabled: false, standardsMode: true, model: 'gemini-3-pro' as AiModelId });
    const [toasts, setToasts] = useState<any[]>([]);
    const [activeDeviation, setActiveDeviation] = useState<HealingProposal | null>(null);
    const [queueStatus, setQueueStatus] = useState<QueueResponse>({ processing: false, activeTasks: [], queue: [], history: [] });

    // Mobile navigation state
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Task inbox state
    const [inboxTasks, setInboxTasks] = useState<InboxTask[]>([]);
    const [selectedTask, setSelectedTask] = useState<InboxTask | null>(null);

    // Collapsible nav groups state
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        mission: true,
        strategy: true,
        build: false,
        research: false,
        qa: false,
        system: false
    });

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // Navigation structure with grouped items
    const navGroups = [
        {
            id: 'mission',
            label: 'Mission Control',
            items: [
                { id: 'home', icon: Home, label: 'Home' },
                { id: 'projects', icon: Kanban, label: 'Projects' },
                { id: 'swarm', icon: Kanban, label: 'Mission Board' },
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            ]
        },
        {
            id: 'strategy',
            label: 'Strategy Lab',
            items: [
                { id: 'chat', icon: MessageSquare, label: 'Director Chat' },
                { id: 'consensus', icon: Users, label: 'War Room' },
                { id: 'briefing', icon: Radio, label: 'Briefing' },
                { id: 'strategy', icon: BookOpen, label: 'Prompts' },
            ]
        },
        {
            id: 'build',
            label: 'Build Lab',
            items: [
                { id: 'builder', icon: Hammer, label: 'Builder' },
                { id: 'creative', icon: Sparkles, label: 'Creative' },
                { id: 'visual', icon: Layout, label: 'Visual Diff' },
                { id: 'protocols', icon: ListTree, label: 'Protocols' },
            ]
        },
        {
            id: 'research',
            label: 'Research Lab',
            items: [
                { id: 'intelligence', icon: Bot, label: 'Intelligence' },
                { id: 'seo', icon: Globe, label: 'SEO Tools' },
                { id: 'serp', icon: Search, label: 'SERP Monitor' },
            ]
        },
        {
            id: 'qa',
            label: 'QA Suite',
            items: [
                { id: 'sentinel', icon: Crosshair, label: 'Sentinel' },
                { id: 'lighthouse', icon: Gauge, label: 'Lighthouse' },
                { id: 'qa', icon: Gavel, label: 'QA Critic' },
                { id: 'security', icon: ShieldAlert, label: 'Security' },
            ]
        },
        {
            id: 'system',
            label: 'System',
            items: [
                { id: 'models', icon: Settings, label: 'Models' },
                { id: 'memory', icon: Brain, label: 'Memory' },
                { id: 'sandbox', icon: BrainCircuit, label: 'Sandbox' },
                { id: 'localai', icon: Cpu, label: 'Local AI' },
                { id: 'edge', icon: Cloud, label: 'Edge' },
                { id: 'signal', icon: Activity, label: 'Signal' },
                { id: 'git', icon: GitBranch, label: 'Git Pulse' },
            ]
        }
    ];

    const addToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    useEffect(() => {
        const s = io(window.location.origin, { path: '/socket.io' });
        setSocket(s);
        s.on('agent-registry', (data) => setAgentRegistry(data));
        s.on('status', (data) => setAgentStatus(data));
        s.on('queue-status', (data) => setQueueStatus(data));
        s.on('autopilot-state', (data) => setAutopilotConfig(data));
        s.on('agent-deviation', (d) => { setActiveDeviation(d); addToast("Neural Healing Required", "error"); });

        // Task inbox socket listeners
        s.on('director-task-created', (task: InboxTask) => {
            addToast(`New task: ${task.title}`, 'info');
            setInboxTasks(prev => [task, ...prev]);
        });

        s.on('claude-task-created', (task: InboxTask) => {
            setInboxTasks(prev => {
                if (prev.some(t => t.id === task.id)) return prev;
                return [task, ...prev];
            });
        });

        s.on('claude-task-completed', (data: { taskId: string }) => {
            addToast('Task completed', 'success');
            setInboxTasks(prev => prev.map(t =>
                t.id === data.taskId ? { ...t, status: 'completed' as const } : t
            ));
        });

        s.on('claude-task-acknowledged', (data: { taskId: string }) => {
            setInboxTasks(prev => prev.map(t =>
                t.id === data.taskId ? { ...t, status: 'acknowledged' as const } : t
            ));
        });

        s.on('inbox-cleared', (data: { deletedCount: number }) => {
            addToast(`Cleared ${data.deletedCount} tasks`, 'success');
            setInboxTasks([]);
        });

        // Fetch initial inbox tasks
        fetch('/api/claude/inbox')
            .then(res => res.json())
            .then(data => {
                if (data.tasks) {
                    setInboxTasks(data.tasks);
                }
            })
            .catch(err => console.error('Failed to fetch inbox:', err));

        // Listen for custom navigation events from components
        const handleNavEvent = (e: CustomEvent) => {
            if (e.detail && typeof e.detail === 'string') {
                setActiveTab(e.detail);
            }
        };
        window.addEventListener('navigate-tab', handleNavEvent as EventListener);

        return () => {
            s.disconnect();
            window.removeEventListener('navigate-tab', handleNavEvent as EventListener);
        };
    }, []);

    const renderTab = () => {
        switch(activeTab) {
            case 'home': return <HomeLab socket={socket} />;
            case 'projects': return <ProjectsLab socket={socket} />;
            case 'dashboard': return (
                <div className="space-y-6 md:space-y-8 lg:space-y-12 pb-10 md:pb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-10">
                        <SwarmTopology agents={agentRegistry} status={agentStatus} subAgents={queueStatus.activeTasks} />
                        <MissionTimeline queue={queueStatus} />
                    </div>
                </div>
            );
            case 'analytics': return <AnalyticsLab />;
            case 'swarm': return <SwarmBoard queue={queueStatus} onAddTask={(t) => socket?.emit('swarm-mission', t)} onSproutAgent={(d) => socket?.emit('agent-sprout', d)} />;
            case 'builder': return <BuilderLab />;
            case 'visual': return <VisualDiff />;
            case 'sentinel': return <SentinelLab />;
            case 'lighthouse': return <LighthouseLab />;
            case 'memory': return <MemoryLab />;
            case 'signal': return <SignalIntegrity />;
            case 'chat': return <ChatLab />;
            case 'sandbox': return <SandboxLab />;
            case 'localai': return <LocalAiLab />;
            case 'edge': return <EdgeLab />;
            case 'strategy': return <PromptLab />;
            case 'protocols': return <ProtocolLab />;
            case 'consensus': return <ConsensusLab />;
            case 'briefing': return <BriefingLab />;
            case 'creative': return <CreativeStudio />;
            case 'security': return <SecurityLab />;
            case 'intelligence': return <IntelligenceLab />;
            case 'qa': return <QACriticLab />;
            case 'git': return <GitPulse />;
            case 'seo': return <SeoLab />;
            case 'serp': return <SerpMonitor />;
            case 'models': return <ModelsLab />;
            default: return <div className="p-20 opacity-20 text-center uppercase font-black">Segment Not Found</div>;
        }
    };

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-dark-900 text-gray-200 font-sans overflow-hidden">
                {/* Mobile Header - visible only on mobile */}
                <MobileHeader
                    onMenuClick={() => setDrawerOpen(true)}
                    activeTab={activeTab}
                />

                {/* Mobile Drawer - slide-out navigation */}
                <MobileDrawer
                    isOpen={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="flex min-h-screen">
                    {/* Desktop Sidebar - hidden on mobile */}
                    <div className="hidden md:flex w-64 bg-dark-800 border-r border-dark-700 flex-col shadow-2xl z-20 fixed left-0 top-0 bottom-0">
                        <div className="p-6 lg:p-8 border-b border-dark-700 text-center">
                            <h1 className="text-xl lg:text-2xl font-black text-white italic">Swarm<span className="text-google-blue">Ops</span></h1>
                        </div>
                        <nav className="flex-1 p-3 lg:p-4 space-y-2 overflow-y-auto scrollbar-hide">
                            {navGroups.map(group => (
                                <div key={group.id} className="mb-2">
                                    {/* Group Header */}
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        <span>{group.label}</span>
                                        {expandedGroups[group.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                    </button>

                                    {/* Group Items */}
                                    {expandedGroups[group.id] && (
                                        <div className="space-y-0.5 mt-1">
                                            {group.items.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setActiveTab(item.id)}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                                                        activeTab === item.id
                                                            ? 'bg-google-blue text-white shadow-lg shadow-google-blue/20'
                                                            : 'hover:bg-dark-700 text-gray-400'
                                                    }`}
                                                >
                                                    <item.icon size={16} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* Content Area - responsive padding and margins */}
                    <div className="flex-1 md:ml-64 overflow-y-auto bg-dark-900 pt-14 md:pt-0 pb-20 md:pb-10 relative scrollbar-hide">
                        <div className="p-4 md:p-6 lg:p-10">
                            {renderTab()}
                        </div>
                        {activeDeviation && (
                            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-10">
                                <RecoveryModule proposal={activeDeviation} onClose={() => setActiveDeviation(null)} onApply={(c) => fetch('/api/heal/apply', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({agentId: activeDeviation.agentId, command: c}) }).then(() => setActiveDeviation(null))} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Nav - visible only on mobile */}
                <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Task Inbox - floating panel */}
                <TaskInbox
                    tasks={inboxTasks}
                    onExecute={(task) => {
                        // Navigate to builder with task instructions
                        setSelectedTask(task);
                        setActiveTab('builder');
                        // Mark as acknowledged
                        fetch(`/api/claude/tasks/${task.id}/acknowledge`, { method: 'POST' })
                            .catch(err => console.error('Failed to acknowledge task:', err));
                    }}
                    onDismiss={(taskId) => {
                        setInboxTasks(prev => prev.filter(t => t.id !== taskId));
                    }}
                    onViewDetails={(task) => {
                        setSelectedTask(task);
                        addToast(`Task: ${task.title}`, 'info');
                    }}
                    onClearAll={() => {
                        fetch('/api/claude/inbox', { method: 'DELETE' })
                            .then(res => res.json())
                            .then(data => {
                                if (data.success) {
                                    setInboxTasks([]);
                                    addToast(`Cleared ${data.deletedCount} tasks`, 'success');
                                }
                            })
                            .catch(err => console.error('Failed to clear inbox:', err));
                    }}
                />

                {/* Toast Notifications - adjusted for mobile */}
                <div className="fixed bottom-20 md:bottom-10 right-4 md:right-10 flex flex-col gap-3 pointer-events-none z-50">
                    {toasts.map(t => (
                        <div key={t.id} className="pointer-events-auto px-4 md:px-6 py-3 md:py-4 rounded-xl md:rounded-2xl bg-dark-800 border border-dark-700 text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest animate-in slide-in-from-right-4">{t.message}</div>
                    ))}
                </div>
            </div>
        </ErrorBoundary>
    );
};

export default App;
