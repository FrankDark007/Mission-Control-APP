import React from 'react';
import { Menu, X } from 'lucide-react';

interface MobileHeaderProps {
    onMenuClick: () => void;
    activeTab?: string;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ onMenuClick, activeTab }) => {
    return (
        <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-dark-800/95 backdrop-blur-lg border-b border-dark-700">
            <div className="flex items-center justify-between px-4 h-14">
                {/* Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="p-2 -ml-2 rounded-xl hover:bg-dark-700 transition-colors"
                    aria-label="Open menu"
                >
                    <Menu size={22} className="text-gray-400" />
                </button>

                {/* Logo */}
                <div className="absolute left-1/2 -translate-x-1/2">
                    <h1 className="text-lg font-black text-white italic">
                        Swarm<span className="text-google-blue">Ops</span>
                    </h1>
                </div>

                {/* Active Tab Indicator (optional) */}
                {activeTab && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {activeTab}
                    </span>
                )}
            </div>
        </header>
    );
};

export default MobileHeader;
