import React from 'react';
import { Home, LayoutDashboard, Kanban, MessageSquare, Hammer } from 'lucide-react';

interface BottomNavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dash' },
    { id: 'swarm', icon: Kanban, label: 'Swarm' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'builder', icon: Hammer, label: 'Build' },
];

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-800/95 backdrop-blur-lg border-t border-dark-700 safe-bottom">
            <div className="flex items-center justify-around h-16 px-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex flex-col items-center justify-center flex-1 py-2 transition-all ${
                                isActive ? 'text-google-blue' : 'text-gray-500'
                            }`}
                        >
                            <div className={`p-1.5 rounded-xl transition-all ${
                                isActive ? 'bg-google-blue/10' : ''
                            }`}>
                                <tab.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`text-[10px] mt-1 font-semibold ${
                                isActive ? 'font-bold' : ''
                            }`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default BottomNav;
