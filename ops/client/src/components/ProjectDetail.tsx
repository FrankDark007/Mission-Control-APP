/**
 * ProjectDetail Component
 * Full project view with phases, tasks, and artifacts tree
 */

import React, { useState, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import {
  ArrowLeft, RefreshCw, Play, Loader2, CheckCircle2, XCircle,
  Clock, AlertTriangle, FileText, X, Eye
} from 'lucide-react';
import { Artifact } from '../types';
import { useProjectTree } from '../services/useProjectTree';
import PhaseSection from './PhaseSection';

interface ProjectDetailProps {
  projectId: string;
  socket?: Socket | null;
  onBack?: () => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({
  projectId,
  socket,
  onBack
}) => {
  const { tree, loading, error, refetch, executeTask } = useProjectTree({
    projectId,
    socket
  });

  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [artifactContent, setArtifactContent] = useState<string | null>(null);
  const [loadingArtifact, setLoadingArtifact] = useState(false);

  // Calculate overall project stats
  const projectStats = useMemo(() => {
    if (!tree) return null;

    let totalTasks = 0;
    let completeTasks = 0;
    let runningTasks = 0;
    let failedTasks = 0;
    let readyTasks = 0;
    let totalArtifacts = 0;

    for (const phase of tree.phases) {
      totalTasks += phase.tasks.length;
      completeTasks += phase.tasks.filter(t => t.status === 'complete').length;
      runningTasks += phase.tasks.filter(t => t.status === 'running' || t.status === 'queued').length;
      failedTasks += phase.tasks.filter(t => t.status === 'failed').length;
      readyTasks += phase.tasks.filter(t => t.status === 'ready').length;
      totalArtifacts += phase.artifacts.length;
    }

    const progress = totalTasks > 0 ? Math.round((completeTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completeTasks,
      runningTasks,
      failedTasks,
      readyTasks,
      totalArtifacts,
      progress,
      totalPhases: tree.phases.length
    };
  }, [tree]);

  // Handle viewing artifact content
  const handleViewArtifact = async (artifact: Artifact) => {
    setSelectedArtifact(artifact);
    setArtifactContent(null);
    setLoadingArtifact(true);

    try {
      const response = await fetch(`/api/artifacts/${artifact.id}/content`);
      if (response.ok) {
        const data = await response.json();
        setArtifactContent(data.content);
      }
    } catch (err) {
      console.error('Failed to load artifact content:', err);
    } finally {
      setLoadingArtifact(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto text-google-blue animate-spin mb-4" />
          <p className="text-sm text-gray-500">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto text-google-red mb-4" />
          <p className="text-sm text-gray-400 mb-4">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-google-blue text-white text-xs font-bold uppercase rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText size={32} className="mx-auto text-gray-600 mb-4" />
          <p className="text-sm text-gray-500">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-400" />
          </button>
        )}

        {/* Project Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-white truncate">{tree.name}</h1>
          {tree.description && (
            <p className="text-sm text-gray-400 mt-1 line-clamp-2">{tree.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
              tree.status === 'active' ? 'bg-google-green/20 text-google-green' :
              tree.status === 'complete' ? 'bg-google-blue/20 text-google-blue' :
              tree.status === 'failed' ? 'bg-google-red/20 text-google-red' :
              'bg-gray-700 text-gray-400'
            }`}>
              {tree.status}
            </span>
            <span className="text-[10px] text-gray-500">
              Director: {tree.directorModel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={refetch}
          className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Stats Bar */}
      {projectStats && projectStats.totalTasks > 0 && (
        <div className="flex items-center gap-6 p-4 bg-dark-800 border border-dark-700 rounded-xl">
          {/* Progress Bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Progress</span>
              <span className="text-sm font-black text-white">{projectStats.progress}%</span>
            </div>
            <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-google-green transition-all"
                style={{ width: `${projectStats.progress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 border-l border-dark-700 pl-6">
            <div className="text-center">
              <p className="text-lg font-black text-white">{projectStats.totalPhases}</p>
              <p className="text-[9px] text-gray-500 uppercase">Phases</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-white">{projectStats.totalTasks}</p>
              <p className="text-[9px] text-gray-500 uppercase">Tasks</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-black text-google-green">{projectStats.completeTasks}</p>
              <p className="text-[9px] text-gray-500 uppercase">Complete</p>
            </div>
            {projectStats.runningTasks > 0 && (
              <div className="text-center">
                <p className="text-lg font-black text-google-yellow">{projectStats.runningTasks}</p>
                <p className="text-[9px] text-gray-500 uppercase">Running</p>
              </div>
            )}
            {projectStats.readyTasks > 0 && (
              <div className="text-center">
                <p className="text-lg font-black text-google-blue">{projectStats.readyTasks}</p>
                <p className="text-[9px] text-gray-500 uppercase">Ready</p>
              </div>
            )}
            {projectStats.failedTasks > 0 && (
              <div className="text-center">
                <p className="text-lg font-black text-google-red">{projectStats.failedTasks}</p>
                <p className="text-[9px] text-gray-500 uppercase">Failed</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-black text-gray-400">{projectStats.totalArtifacts}</p>
              <p className="text-[9px] text-gray-500 uppercase">Artifacts</p>
            </div>
          </div>
        </div>
      )}

      {/* Phases */}
      <div className="space-y-4">
        {tree.phases.length > 0 ? (
          tree.phases.map((phase, idx) => (
            <PhaseSection
              key={phase.index}
              phase={phase}
              defaultExpanded={idx === 0}
              onExecuteTask={executeTask}
              onViewArtifact={handleViewArtifact}
            />
          ))
        ) : (
          <div className="p-12 bg-dark-800 border border-dark-700 rounded-xl text-center">
            <Clock size={32} className="mx-auto text-gray-600 mb-4" />
            <h3 className="text-sm font-bold text-gray-400 mb-2">No Tasks Yet</h3>
            <p className="text-xs text-gray-500">
              Spawn the Director to generate a task plan for this project.
            </p>
          </div>
        )}
      </div>

      {/* Artifact Viewer Modal */}
      {selectedArtifact && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-google-blue" />
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedArtifact.label}</h3>
                  <p className="text-[10px] text-gray-500 uppercase">{selectedArtifact.type} - {selectedArtifact.contentType}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="p-2 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-4">
              {loadingArtifact ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 size={24} className="text-google-blue animate-spin" />
                </div>
              ) : selectedArtifact.previewHtml ? (
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedArtifact.previewHtml }}
                />
              ) : artifactContent ? (
                <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap bg-dark-900 p-4 rounded-lg overflow-auto">
                  {artifactContent}
                </pre>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Eye size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No preview available</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-dark-700 bg-dark-900">
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span>Created: {new Date(selectedArtifact.createdAt).toLocaleString()}</span>
                {selectedArtifact.fileSize && (
                  <span>{Math.round(selectedArtifact.fileSize / 1024)}KB</span>
                )}
              </div>
              <button
                onClick={() => setSelectedArtifact(null)}
                className="px-4 py-2 bg-dark-700 text-white text-xs font-bold uppercase rounded-lg hover:bg-dark-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
