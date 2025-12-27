import React, { useEffect } from 'react';
import {
    X, LayoutDashboard, BarChart3, Kanban, Hammer, Layout,
    Gauge, Brain, MessageSquare, BrainCircuit, Cpu, Cloud,
    BookOpen, ListTree, Swords, Radio, Sparkles, ShieldAlert,
    Bot, Gavel, GitBranch, Globe, Settings, Home, Crosshair, Activity
} from 'lucide-react';

interface MobileDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

// Navigation groups with their tabs
const navGroups = [
    {
        name: 'Core',
        tabs: [
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            { id: 'swarm', icon: Kanban, label: 'Swarm Board' },
        ]
    },
    {
        name: 'Build',
        tabs: [
            { id: 'builder', icon: Hammer, label: 'Builder' },
            { id: 'visual', icon: Layout, label: 'Visual Diff' },
            { id: 'sentinel', icon: Crosshair, label: 'Sentinel' },
            { id: 'lighthouse', icon: Gauge, label: 'Lighthouse' },
            { id: 'git', icon: GitBranch, label: 'Git Pulse' },
        ]
    },
    {
        name: 'AI',
        tabs: [
            { id: 'chat', icon: MessageSquare, label: 'Chat' },
            { id: 'models', icon: Settings, label: 'Models' },
            { id: 'localai', icon: Cpu, label: 'Local AI' },
            { id: 'sandbox', icon: BrainCircuit, label: 'Sandbox' },
            { id: 'strategy', icon: BookOpen, label: 'Strategy' },
        ]
    },
    {
        name: 'Monitoring',
        tabs: [
            { id: 'memory', icon: Brain, label: 'Memory' },
            { id: 'signal', icon: Activity, label: 'Signal' },
            { id: 'edge', icon: Cloud, label: 'Edge' },
        ]
    },
    {
        name: 'Security',
        tabs: [
            { id: 'security', icon: ShieldAlert, label: 'Security' },
            { id: 'intelligence', icon: Bot, label: 'Intelligence' },
            { id: 'qa', icon: Gavel, label: 'QA Critic' },
        ]
    },
    {
        name: 'Workflow',
        tabs: [
            { id: 'protocols', icon: ListTree, label: 'Protocols' },
            { id: 'consensus', icon: Swords, label: 'Consensus' },
            { id: 'briefing', icon: Radio, label: 'Briefing' },
            { id: 'creative', icon: Sparkles, label: 'Creative' },
            { id: 'seo', icon: Globe, label: 'SEO' },
        ]
    }
];

const MobileDrawer: React.FC<MobileDrawerProps> = ({ isOpen, onClose, activeTab, onTabChange }) => {
    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('drawer-open');
        } else {
            document.body.classList.remove('drawer-open');
        }
        return () => {
            document.body.classList.remove('drawer-open');
        };
    }, [isOpen]);

    const handleTabClick = (tabId: string) => {
        onTabChange(tabId);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-dark-800 border-r border-dark-700 shadow-2xl animate-in slide-in-from-left duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-dark-700">
                    <h1 className="text-xl font-black text-white italic">
                        Swarm<span className="text-google-blue">Ops</span>
                    </h1>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-dark-700 transition-colors"
                        aria-label="Close menu"
                    >
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Navigation Groups */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-6 pb-safe">
                    {navGroups.map((group) => (
                        <div key={group.name}>
                            <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 px-3 mb-2">
                                {group.name}
                            </h3>
                            <div className="space-y-1">
                                {group.tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabClick(tab.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-google-blue text-white shadow-lg shadow-google-blue/20'
                                                : 'hover:bg-dark-700 text-gray-400'
                                        }`}
                                    >
                                        <tab.icon size={18} />
                                        <span className="text-sm font-semibold">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>
        </div>
    );
};

export default MobileDrawer;
