/**
 * ProjectsLab Component
 * Main projects hub - shows project list or project detail based on selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  FolderKanban, Plus, Loader2, Clock, CheckCircle2, XCircle,
  Play, ChevronRight, Bot, RefreshCw, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import ProjectDetail from './ProjectDetail';

interface ProjectsLabProps {
  socket?: Socket | null;
}

const statusConfig: Record<ProjectStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  initialized: { color: 'text-gray-400', bg: 'bg-gray-800', icon: <Clock size={12} /> },
  planning: { color: 'text-google-yellow', bg: 'bg-google-yellow/20', icon: <Loader2 size={12} className="animate-spin" /> },
  active: { color: 'text-google-blue', bg: 'bg-google-blue/20', icon: <Play size={12} /> },
  blocked: { color: 'text-orange-400', bg: 'bg-orange-400/20', icon: <AlertTriangle size={12} /> },
  needs_approval: { color: 'text-google-yellow', bg: 'bg-google-yellow/20', icon: <AlertTriangle size={12} /> },
  paused: { color: 'text-gray-500', bg: 'bg-gray-700', icon: <Clock size={12} /> },
  complete: { color: 'text-google-green', bg: 'bg-google-green/20', icon: <CheckCircle2 size={12} /> },
  failed: { color: 'text-google-red', bg: 'bg-google-red/20', icon: <XCircle size={12} /> }
};

const ProjectsLab: React.FC<ProjectsLabProps> = ({ socket }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [spawning, setSpawning] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/projects');
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleProjectUpdate = (data: { project: Project }) => {
      setProjects(prev => prev.map(p =>
        p.id === data.project.id ? data.project : p
      ));
    };

    const handleProjectCreated = (data: { project: Project }) => {
      setProjects(prev => [data.project, ...prev]);
    };

    socket.on('project-update', handleProjectUpdate);
    socket.on('project:updated', handleProjectUpdate);
    socket.on('project:created', handleProjectCreated);

    return () => {
      socket.off('project-update', handleProjectUpdate);
      socket.off('project:updated', handleProjectUpdate);
      socket.off('project:created', handleProjectCreated);
    };
  }, [socket]);

  const handleSpawnDirector = async (projectId: string) => {
    setSpawning(projectId);
    try {
      const response = await fetch(`/api/projects/${projectId}/spawn-director`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to spawn director');
      }

      // Refresh projects list
      await fetchProjects();
    } catch (err) {
      console.error('Failed to spawn director:', err);
    } finally {
      setSpawning(null);
    }
  };

  // Show project detail if a project is selected
  if (selectedProjectId) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <ProjectDetail
          projectId={selectedProjectId}
          socket={socket}
          onBack={() => setSelectedProjectId(null)}
        />
      </div>
    );
  }

  // Projects list view
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter mb-1">
            Projects
          </h2>
          <p className="text-xs md:text-sm text-gray-500 font-medium">
            View and manage your autonomous projects with full task visibility.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchProjects}
            className="p-3 bg-dark-800 border border-dark-700 rounded-xl hover:bg-dark-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className="text-gray-400" />
          </button>
          <a
            href="#briefing"
            onClick={(e) => {
              e.preventDefault();
              // Navigate to briefing tab to create new project
              window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'briefing' }));
            }}
            className="bg-google-blue text-white px-4 md:px-6 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg flex items-center gap-2 hover:bg-google-blue/80 transition-all"
          >
            <Plus size={14} /> New Project
          </a>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 size={32} className="mx-auto text-google-blue animate-spin mb-4" />
            <p className="text-sm text-gray-500">Loading projects...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle size={32} className="mx-auto text-google-red mb-4" />
            <p className="text-sm text-gray-400 mb-4">{error}</p>
            <button
              onClick={fetchProjects}
              className="px-4 py-2 bg-google-blue text-white text-xs font-bold uppercase rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && projects.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <FolderKanban size={48} className="mx-auto text-gray-700 mb-4" />
            <h3 className="text-lg font-bold text-gray-400 mb-2">No Projects Yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Create your first project in the Briefing Lab
            </p>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {projects.map(project => {
            const config = statusConfig[project.status] || statusConfig.initialized;
            const isSpawning = spawning === project.id;

            return (
              <div
                key={project.id}
                className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden hover:border-google-blue/30 transition-all group"
              >
                {/* Card Header */}
                <div
                  className="p-5 cursor-pointer"
                  onClick={() => setSelectedProjectId(project.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg} ${config.color}`}>
                      {config.icon}
                      <span className="text-[9px] font-bold uppercase tracking-wider">
                        {project.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Arrow */}
                    <ChevronRight
                      size={18}
                      className="text-gray-600 group-hover:text-google-blue transition-colors"
                    />
                  </div>

                  {/* Project Name */}
                  <h3 className="text-lg font-bold text-white mb-2 truncate group-hover:text-google-blue transition-colors">
                    {project.name}
                  </h3>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {project.description}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Bot size={10} />
                      {project.directorModel}
                    </span>
                    <span>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="px-5 py-3 border-t border-dark-700 bg-dark-900/50 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedProjectId(project.id)}
                    className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    View Details
                  </button>

                  {/* Spawn Director Button (only show if no tasks yet) */}
                  {project.status === 'initialized' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpawnDirector(project.id);
                      }}
                      disabled={isSpawning}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        isSpawning
                          ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                          : 'bg-google-blue text-white hover:bg-google-blue/80'
                      }`}
                    >
                      {isSpawning ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Planning...
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          Spawn Director
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProjectsLab;
