import React, { useState, useEffect } from 'react';
import {
    Home, Plus, FolderOpen, Bot, Clock, Activity,
    CheckCircle, AlertCircle, Pause, Play, Loader2,
    ChevronRight, Sparkles, Shield, Zap, Trash2,
    MoreVertical, RefreshCw, Search, FileText, Image,
    Globe, BarChart3, Wrench, Users, X
} from 'lucide-react';
import { Project, DirectorModel, NewProjectData, ProjectStatus, ProjectPhase } from '../types';
import NewProjectWizard from './NewProjectWizard';

// Agent task types that can be spawned
const agentTaskTypes = [
    { id: 'seo-research', label: 'SEO Research', icon: Search, description: 'Keyword research, competitor analysis, SERP tracking' },
    { id: 'content-gen', label: 'Content Generation', icon: FileText, description: 'Blog posts, landing pages, product descriptions' },
    { id: 'graphics', label: 'Graphics & Images', icon: Image, description: 'Hero images, icons, illustrations via AI' },
    { id: 'tech-audit', label: 'Technical SEO Audit', icon: Wrench, description: 'Core Web Vitals, crawlability, structured data' },
    { id: 'competitor', label: 'Competitor Research', icon: Users, description: 'Analyze competitor strategies, backlinks, content' },
    { id: 'local-seo', label: 'Local SEO', icon: Globe, description: 'GMB optimization, local citations, reviews' },
];

interface HomeLabProps {
    socket: any;
}

const statusConfig: Record<ProjectStatus, { color: string; bgColor: string; icon: React.ReactNode }> = {
    initialized: { color: 'text-gray-400', bgColor: 'bg-gray-500/10', icon: <Clock size={14} /> },
    planning: { color: 'text-google-blue', bgColor: 'bg-google-blue/10', icon: <Sparkles size={14} /> },
    active: { color: 'text-google-green', bgColor: 'bg-google-green/10', icon: <Activity size={14} /> },
    blocked: { color: 'text-google-red', bgColor: 'bg-google-red/10', icon: <AlertCircle size={14} /> },
    needs_approval: { color: 'text-google-yellow', bgColor: 'bg-google-yellow/10', icon: <Shield size={14} /> },
    paused: { color: 'text-gray-500', bgColor: 'bg-gray-500/10', icon: <Pause size={14} /> },
    complete: { color: 'text-google-green', bgColor: 'bg-google-green/10', icon: <CheckCircle size={14} /> },
    failed: { color: 'text-google-red', bgColor: 'bg-google-red/10', icon: <AlertCircle size={14} /> }
};

const phaseLabels: Record<ProjectPhase, string> = {
    bootstrap: 'Bootstrap',
    research: 'Research',
    planning: 'Planning',
    execution: 'Execution',
    review: 'Review',
    deployment: 'Deployment',
    maintenance: 'Maintenance'
};

const HomeLab: React.FC<HomeLabProps> = ({ socket }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [directorModels, setDirectorModels] = useState<DirectorModel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showWizard, setShowWizard] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [isSpawning, setIsSpawning] = useState<string | null>(null);
    const [showAgentPanel, setShowAgentPanel] = useState<string | null>(null);
    const [queueStatus, setQueueStatus] = useState<any>({ activeTasks: [], queue: [], history: [] });
    const [spawningTask, setSpawningTask] = useState<string | null>(null);

    // Fetch projects
    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            setProjects(data.projects || []);
        } catch (e) {
            console.error('Failed to fetch projects:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch director models
    const fetchDirectorModels = async () => {
        try {
            const res = await fetch('/api/projects/director-models');
            const data = await res.json();
            setDirectorModels(data.models || []);
        } catch (e) {
            console.error('Failed to fetch director models:', e);
        }
    };

    useEffect(() => {
        fetchProjects();
        fetchDirectorModels();

        // Listen for real-time updates
        if (socket) {
            socket.on('projects-update', (data: Project[]) => {
                setProjects(data);
            });
            socket.on('queue-status', (data: any) => {
                setQueueStatus(data);
            });
        }

        return () => {
            if (socket) {
                socket.off('projects-update');
                socket.off('queue-status');
            }
        };
    }, [socket]);

    // Spawn a task agent
    const handleSpawnTask = async (projectId: string, taskType: string, taskLabel: string) => {
        setSpawningTask(taskType);
        try {
            const project = projects.find(p => p.id === projectId);
            if (!project) return;

            // Create mission via socket
            if (socket) {
                socket.emit('swarm-mission', {
                    task: `[${project.name}] ${taskLabel}`,
                    projectId: projectId,
                    taskType: taskType,
                    model: project.directorModel,
                    priority: 'normal'
                });
            }

            setShowAgentPanel(null);
        } catch (e) {
            console.error('Failed to spawn task:', e);
        } finally {
            setSpawningTask(null);
        }
    };

    // Create new project
    const handleCreateProject = async (data: NewProjectData) => {
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                setShowWizard(false);
                fetchProjects();
            }
            return result;
        } catch (e) {
            console.error('Failed to create project:', e);
            return { success: false, error: 'Failed to create project' };
        }
    };

    // Spawn director agent
    const handleSpawnDirector = async (projectId: string) => {
        setIsSpawning(projectId);
        try {
            const res = await fetch(`/api/projects/${projectId}/spawn-director`, {
                method: 'POST'
            });
            const result = await res.json();
            if (result.success) {
                fetchProjects();
            }
        } catch (e) {
            console.error('Failed to spawn director:', e);
        } finally {
            setIsSpawning(null);
        }
    };

    // Delete project
    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
            fetchProjects();
        } catch (e) {
            console.error('Failed to delete project:', e);
        }
    };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    };

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4">
                <Loader2 size={64} className="animate-spin text-google-blue" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">Loading Projects</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 lg:space-y-10 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1">
                        Mission Control
                    </h2>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">
                        Project orchestration and agent management hub
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchProjects}
                        className="p-3 bg-dark-800 border border-dark-700 rounded-xl hover:border-google-blue transition-all"
                    >
                        <RefreshCw size={18} className="text-gray-400" />
                    </button>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 bg-google-blue text-white rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl shadow-google-blue/20 hover:scale-105 transition-all"
                    >
                        <Plus size={18} />
                        <span className="hidden sm:inline">New Project</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            {projects.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: projects.length, color: 'text-white' },
                        { label: 'Active', value: projects.filter(p => p.status === 'active').length, color: 'text-google-green' },
                        { label: 'Planning', value: projects.filter(p => p.status === 'planning').length, color: 'text-google-blue' },
                        { label: 'Blocked', value: projects.filter(p => p.status === 'blocked' || p.status === 'needs_approval').length, color: 'text-google-yellow' }
                    ].map((stat, i) => (
                        <div key={i} className="bg-dark-800 p-4 md:p-6 rounded-2xl border border-dark-700">
                            <div className="text-[10px] font-black uppercase text-gray-500 mb-1">{stat.label}</div>
                            <div className={`text-2xl md:text-3xl font-black ${stat.color}`}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Projects List */}
            {projects.length === 0 ? (
                <div className="bg-dark-800 p-8 md:p-16 rounded-2xl md:rounded-[2.5rem] border border-dark-700 text-center">
                    <div className="max-w-md mx-auto space-y-6">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-google-blue/10 rounded-full flex items-center justify-center mx-auto">
                            <FolderOpen className="text-google-blue w-10 h-10 md:w-12 md:h-12" />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-white mb-2">No Projects Yet</h3>
                            <p className="text-sm text-gray-500">
                                Create your first project to get started. Choose an AI agent to direct the work
                                and provide instructions for what you want to build.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowWizard(true)}
                            className="inline-flex items-center gap-3 px-8 py-4 bg-google-blue text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-google-blue/20 hover:scale-105 transition-all"
                        >
                            <Plus size={20} />
                            Start New Project
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                    {projects.map((project) => {
                        const statusCfg = statusConfig[project.status];
                        return (
                            <div
                                key={project.id}
                                className="bg-dark-800 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-dark-700 hover:border-google-blue/30 transition-all group"
                            >
                                {/* Project Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg md:text-xl font-black text-white">
                                                {project.name}
                                            </h3>
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${statusCfg.bgColor} ${statusCfg.color}`}>
                                                {statusCfg.icon}
                                                {project.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {project.description && (
                                            <p className="text-xs text-gray-500 line-clamp-2">
                                                {project.description}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteProject(project.id)}
                                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-dark-700 rounded-lg transition-all text-gray-500 hover:text-google-red"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Project Meta */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                                    <div className="bg-dark-900/50 p-3 rounded-xl">
                                        <div className="text-[9px] font-black uppercase text-gray-600 mb-1">Phase</div>
                                        <div className="text-xs font-bold text-white">
                                            {phaseLabels[project.phase]}
                                        </div>
                                    </div>
                                    <div className="bg-dark-900/50 p-3 rounded-xl">
                                        <div className="text-[9px] font-black uppercase text-gray-600 mb-1">Director</div>
                                        <div className="text-xs font-bold text-google-blue truncate">
                                            {project.directorModel}
                                        </div>
                                    </div>
                                    <div className="bg-dark-900/50 p-3 rounded-xl col-span-2 md:col-span-1">
                                        <div className="text-[9px] font-black uppercase text-gray-600 mb-1">Last Activity</div>
                                        <div className="text-xs font-bold text-gray-400">
                                            {formatRelativeTime(project.lastActivityAt || project.updatedAt)}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-4 border-t border-dark-700">
                                    <div className="text-[10px] font-mono text-gray-600">
                                        {project.id}
                                    </div>
                                    <div className="flex gap-2">
                                        {project.status === 'initialized' && (
                                            <button
                                                onClick={() => handleSpawnDirector(project.id)}
                                                disabled={isSpawning === project.id}
                                                className="flex items-center gap-2 px-4 py-2 bg-google-blue text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all disabled:opacity-50"
                                            >
                                                {isSpawning === project.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Zap size={14} />
                                                )}
                                                Spawn Director
                                            </button>
                                        )}
                                        {(project.status === 'active' || project.status === 'planning') && (
                                            <button
                                                onClick={() => setShowAgentPanel(project.id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-google-green text-white rounded-xl text-[10px] font-black uppercase hover:scale-105 transition-all shadow-lg shadow-google-green/20"
                                            >
                                                <Bot size={14} />
                                                Spawn Agents
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedProject(project)}
                                            className="flex items-center gap-2 px-4 py-2 bg-dark-900 border border-dark-700 text-gray-400 rounded-xl text-[10px] font-black uppercase hover:text-white hover:border-google-blue transition-all"
                                        >
                                            View Details
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* New Project Wizard Modal */}
            {showWizard && (
                <NewProjectWizard
                    models={directorModels}
                    onClose={() => setShowWizard(false)}
                    onCreate={handleCreateProject}
                />
            )}

            {/* Project Detail Modal */}
            {selectedProject && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800 rounded-2xl md:rounded-[2rem] border border-dark-700 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="p-6 md:p-8 border-b border-dark-700">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-2xl font-black text-white mb-1">
                                        {selectedProject.name}
                                    </h3>
                                    <p className="text-sm text-gray-500">{selectedProject.id}</p>
                                </div>
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="p-2 hover:bg-dark-700 rounded-lg text-gray-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Instructions</h4>
                                <p className="text-sm text-gray-300 whitespace-pre-wrap bg-dark-900 p-4 rounded-xl border border-dark-700">
                                    {selectedProject.instructions}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Status</h4>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase ${statusConfig[selectedProject.status].bgColor} ${statusConfig[selectedProject.status].color}`}>
                                        {statusConfig[selectedProject.status].icon}
                                        {selectedProject.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Phase</h4>
                                    <p className="text-sm text-white font-bold">{phaseLabels[selectedProject.phase]}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Director Model</h4>
                                    <p className="text-sm text-google-blue font-bold">{selectedProject.directorModel}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-2">Created</h4>
                                    <p className="text-sm text-gray-400">{new Date(selectedProject.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Quick Actions in Modal */}
                            {(selectedProject.status === 'active' || selectedProject.status === 'planning') && (
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-gray-500 mb-3">Quick Actions</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {agentTaskTypes.map(task => (
                                            <button
                                                key={task.id}
                                                onClick={() => handleSpawnTask(selectedProject.id, task.id, task.label)}
                                                disabled={spawningTask === task.id}
                                                className="flex items-center gap-2 p-3 bg-dark-900 border border-dark-700 rounded-xl hover:border-google-blue transition-all text-left group"
                                            >
                                                <task.icon size={16} className="text-gray-500 group-hover:text-google-blue" />
                                                <span className="text-xs font-bold text-gray-400 group-hover:text-white">{task.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Agent Spawning Panel */}
            {showAgentPanel && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800 rounded-2xl md:rounded-[2rem] border border-dark-700 w-full max-w-xl">
                        <div className="p-6 border-b border-dark-700 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black text-white">Spawn Agent Tasks</h3>
                                <p className="text-xs text-gray-500">Select a task type to spawn an AI agent</p>
                            </div>
                            <button
                                onClick={() => setShowAgentPanel(null)}
                                className="p-2 hover:bg-dark-700 rounded-lg text-gray-400"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            {agentTaskTypes.map(task => (
                                <button
                                    key={task.id}
                                    onClick={() => handleSpawnTask(showAgentPanel, task.id, task.label)}
                                    disabled={spawningTask === task.id}
                                    className="w-full flex items-center gap-4 p-4 bg-dark-900 border border-dark-700 rounded-xl hover:border-google-blue transition-all text-left group disabled:opacity-50"
                                >
                                    <div className="p-3 bg-dark-800 rounded-xl group-hover:bg-google-blue/10">
                                        <task.icon size={20} className="text-gray-400 group-hover:text-google-blue" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-sm">{task.label}</div>
                                        <div className="text-xs text-gray-500">{task.description}</div>
                                    </div>
                                    {spawningTask === task.id ? (
                                        <Loader2 size={18} className="animate-spin text-google-blue" />
                                    ) : (
                                        <ChevronRight size={18} className="text-gray-600 group-hover:text-google-blue" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Active Tasks Bar */}
            {(queueStatus.activeTasks?.length > 0 || queueStatus.queue?.length > 0) && (
                <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-dark-800 border border-dark-700 rounded-2xl p-4 shadow-2xl z-40">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-2 h-2 bg-google-green rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-gray-400">
                            {queueStatus.activeTasks?.length || 0} Active · {queueStatus.queue?.length || 0} Queued
                        </span>
                    </div>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {queueStatus.activeTasks?.slice(0, 3).map((task: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 bg-dark-900 p-2 rounded-lg">
                                <Loader2 size={14} className="animate-spin text-google-blue" />
                                <span className="text-xs text-gray-300 truncate">{task.task || task.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeLab;
