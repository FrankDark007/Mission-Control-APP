
import React, { useState, useEffect } from 'react';
// Added CheckCircle to imports to fix "Cannot find name 'CheckCircle'" error
import { GitBranch, GitCommit, Clock, FileCode, ArrowRight, User, Hash, CheckCircle } from 'lucide-react';
import { GitCommit as GitCommitType } from '../types';

const GitPulse = () => {
    const [log, setLog] = useState<GitCommitType[]>([]);
    const [status, setStatus] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchGit = () => {
            fetch('/api/git/log')
                .then(res => res.json())
                .then(data => {
                    setLog(data.logs);
                    setStatus(data.status);
                })
                .finally(() => setIsLoading(false));
        };
        fetchGit();
        const interval = setInterval(fetchGit, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">Git Pulse</h2>
                    <p className="text-sm text-gray-500 font-medium">Repository health and mission commit stream.</p>
                </div>
                {status && (
                    <div className="flex items-center gap-4 bg-dark-800 px-6 py-2.5 rounded-2xl border border-dark-700">
                        <div className="flex items-center gap-2">
                            <GitBranch size={16} className="text-google-blue" />
                            <span className="text-xs font-bold text-white">{status.current}</span>
                        </div>
                        <div className="w-px h-4 bg-dark-600" />
                        <span className={`text-[10px] font-black uppercase ${status.files.length > 0 ? 'text-google-yellow' : 'text-google-green'}`}>
                            {status.files.length > 0 ? `${status.files.length} Dirty Files` : 'Working Tree Clean'}
                        </span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Commit Log */}
                <div className="lg:col-span-2 bg-dark-800 rounded-[2rem] border border-dark-700 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-dark-700 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <GitCommit className="text-google-blue" size={24} />
                            <h3 className="text-xl font-bold text-white">Commit History</h3>
                        </div>
                    </div>
                    <div className="p-0 max-h-[600px] overflow-y-auto scrollbar-hide">
                        {log.map((commit, i) => (
                            <div key={commit.hash} className={`p-6 border-b border-dark-700/50 hover:bg-dark-700/20 transition-all group flex gap-6 items-start ${i === 0 ? 'bg-google-blue/5' : ''}`}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-google-blue shadow-[0_0_10px_rgba(26,115,232,0.8)]' : 'bg-dark-600'} group-hover:scale-125 transition-transform`} />
                                    {i < log.length - 1 && <div className="w-0.5 h-full bg-dark-700 mt-2" />}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-sm font-bold text-white leading-tight group-hover:text-google-blue transition-colors">
                                            {commit.message}
                                        </div>
                                        <div className="text-[10px] font-mono text-gray-600 flex items-center gap-1 shrink-0">
                                            <Hash size={10} /> {commit.hash.substring(0, 7)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                        <span className="flex items-center gap-1.5"><User size={12} /> {commit.author_name || 'System'}</span>
                                        <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(commit.date).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* File Status */}
                <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <FileCode className="text-google-yellow" size={24} />
                        <h3 className="text-xl font-bold text-white">Dirty Registry</h3>
                    </div>
                    <div className="space-y-3">
                        {status?.files.length > 0 ? (
                            status.files.map((file: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-dark-900 rounded-xl border border-dark-700 text-xs font-mono">
                                    <span className="text-gray-400 truncate max-w-[180px]">{file.path}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                        file.index === 'M' ? 'bg-google-blue/10 text-google-blue' : 'bg-google-green/10 text-google-green'
                                    }`}>
                                        {file.index}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 opacity-20 flex flex-col items-center">
                                <CheckCircle size={48} className="mb-4 text-google-green" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Repository Synced</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GitPulse;