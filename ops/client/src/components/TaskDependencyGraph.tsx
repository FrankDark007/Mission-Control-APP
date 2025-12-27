import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  GitBranch, CheckCircle2, Circle, Loader2, XCircle, Lock,
  ZoomIn, ZoomOut, Maximize2, RefreshCw, Filter, Eye, Layers
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'running' | 'complete' | 'failed' | 'blocked';
  taskType: 'work' | 'verification' | 'finalization';
  deps: string[];
  missionId: string;
}

interface GraphNode {
  id: string;
  task: Task;
  x: number;
  y: number;
  level: number;
  column: number;
}

interface GraphEdge {
  from: string;
  to: string;
  fromNode: GraphNode;
  toNode: GraphNode;
}

interface TaskDependencyGraphProps {
  missionId?: string;
  tasks?: Task[];
  onTaskClick?: (taskId: string) => void;
}

const TaskDependencyGraph: React.FC<TaskDependencyGraphProps> = ({
  missionId,
  tasks: propTasks,
  onTaskClick
}) => {
  const [tasks, setTasks] = useState<Task[]>(propTasks || []);
  const [loading, setLoading] = useState(!propTasks);
  const [zoom, setZoom] = useState(1);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(true);

  // Fetch tasks if not provided
  useEffect(() => {
    if (propTasks) {
      setTasks(propTasks);
      return;
    }

    if (missionId) {
      setLoading(true);
      fetch(`/api/missions/${missionId}/tasks`)
        .then(res => res.json())
        .then(data => {
          setTasks(data.tasks || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [missionId, propTasks]);

  // Build graph layout using topological sort
  const { nodes, edges, levels } = useMemo(() => {
    if (tasks.length === 0) {
      return { nodes: new Map<string, GraphNode>(), edges: [], levels: 0 };
    }

    // Build adjacency list
    const adjList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    const taskMap = new Map<string, Task>();

    tasks.forEach(task => {
      taskMap.set(task.id, task);
      adjList.set(task.id, []);
      inDegree.set(task.id, 0);
    });

    // Build edges (dependency → dependent)
    tasks.forEach(task => {
      (task.deps || []).forEach(depId => {
        if (taskMap.has(depId)) {
          adjList.get(depId)?.push(task.id);
          inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
        }
      });
    });

    // Topological sort with levels
    const queue: { id: string; level: number }[] = [];
    const levelMap = new Map<string, number>();
    const columnAtLevel = new Map<number, number>();

    // Start with tasks that have no dependencies
    tasks.forEach(task => {
      if ((inDegree.get(task.id) || 0) === 0) {
        queue.push({ id: task.id, level: 0 });
      }
    });

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      levelMap.set(id, level);

      const dependents = adjList.get(id) || [];
      dependents.forEach(depId => {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);
        if (newDegree === 0) {
          queue.push({ id: depId, level: level + 1 });
        }
      });
    }

    // Handle orphan tasks (no deps but also not processed - cycle detection fallback)
    tasks.forEach(task => {
      if (!levelMap.has(task.id)) {
        levelMap.set(task.id, 0);
      }
    });

    // Find max level
    let maxLevel = 0;
    levelMap.forEach(level => {
      maxLevel = Math.max(maxLevel, level);
    });

    // Assign columns within each level
    const tasksAtLevel = new Map<number, string[]>();
    levelMap.forEach((level, taskId) => {
      if (!tasksAtLevel.has(level)) {
        tasksAtLevel.set(level, []);
      }
      tasksAtLevel.get(level)?.push(taskId);
    });

    // Create nodes with positions
    const nodeWidth = 180;
    const nodeHeight = 80;
    const levelGap = 120;
    const columnGap = 200;
    const graphNodes = new Map<string, GraphNode>();

    tasksAtLevel.forEach((taskIds, level) => {
      const levelWidth = taskIds.length * columnGap;
      const startX = (800 - levelWidth) / 2 + columnGap / 2;

      taskIds.forEach((taskId, idx) => {
        const task = taskMap.get(taskId);
        if (task) {
          graphNodes.set(taskId, {
            id: taskId,
            task,
            x: startX + idx * columnGap,
            y: 60 + level * levelGap,
            level,
            column: idx
          });
        }
      });
    });

    // Create edges
    const graphEdges: GraphEdge[] = [];
    tasks.forEach(task => {
      (task.deps || []).forEach(depId => {
        const fromNode = graphNodes.get(depId);
        const toNode = graphNodes.get(task.id);
        if (fromNode && toNode) {
          graphEdges.push({
            from: depId,
            to: task.id,
            fromNode,
            toNode
          });
        }
      });
    });

    return { nodes: graphNodes, edges: graphEdges, levels: maxLevel + 1 };
  }, [tasks]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete': return <CheckCircle2 size={14} className="text-google-green" />;
      case 'running': return <Loader2 size={14} className="text-google-blue animate-spin" />;
      case 'failed': return <XCircle size={14} className="text-google-red" />;
      case 'blocked': return <Lock size={14} className="text-google-yellow" />;
      case 'ready': return <Circle size={14} className="text-google-blue" />;
      default: return <Circle size={14} className="text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'border-google-green bg-google-green/10';
      case 'running': return 'border-google-blue bg-google-blue/10 animate-pulse';
      case 'failed': return 'border-google-red bg-google-red/10';
      case 'blocked': return 'border-google-yellow bg-google-yellow/10';
      case 'ready': return 'border-google-blue/50 bg-dark-800';
      default: return 'border-dark-600 bg-dark-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'verification': return 'VERIFY';
      case 'finalization': return 'FINAL';
      default: return 'WORK';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'verification': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'finalization': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const graphHeight = Math.max(400, levels * 120 + 120);
  const graphWidth = 800;

  if (loading) {
    return (
      <div className="bg-dark-800 rounded-[2rem] border border-dark-700 p-12 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-google-blue" />
      </div>
    );
  }

  return (
    <div className="bg-dark-800 rounded-[2rem] border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-dark-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-dark-900 rounded-xl border border-dark-700">
            <GitBranch className="text-google-blue" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Task Dependency Graph</h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
              {tasks.length} Tasks • {edges.length} Dependencies • {levels} Levels
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`p-2 rounded-lg border transition-all ${showLabels ? 'bg-google-blue/10 border-google-blue/30 text-google-blue' : 'border-dark-600 text-gray-500 hover:text-white'}`}
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            className="p-2 rounded-lg border border-dark-600 text-gray-500 hover:text-white transition-all"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[10px] font-mono text-gray-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="p-2 rounded-lg border border-dark-600 text-gray-500 hover:text-white transition-all"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-2 rounded-lg border border-dark-600 text-gray-500 hover:text-white transition-all"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-b border-dark-700 flex items-center gap-6 bg-dark-900/50">
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Status:</span>
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
            <Circle size={10} className="text-gray-500" /> Pending
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
            <Circle size={10} className="text-google-blue" /> Ready
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
            <Loader2 size={10} className="text-google-blue" /> Running
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
            <CheckCircle2 size={10} className="text-google-green" /> Complete
          </div>
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
            <XCircle size={10} className="text-google-red" /> Failed
          </div>
        </div>
        <div className="h-4 w-px bg-dark-700" />
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Type:</span>
          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30">WORK</span>
          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">VERIFY</span>
          <span className="px-2 py-0.5 rounded text-[8px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">FINAL</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="overflow-auto" style={{ maxHeight: '500px' }}>
        <svg
          width={graphWidth * zoom}
          height={graphHeight * zoom}
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          className="bg-dark-900"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges (dependency lines) */}
          {edges.map((edge, idx) => {
            const isHighlighted = selectedTask === edge.from || selectedTask === edge.to;
            const fromComplete = edge.fromNode.task.status === 'complete';

            return (
              <g key={`edge-${idx}`}>
                {/* Arrow line */}
                <line
                  x1={edge.fromNode.x}
                  y1={edge.fromNode.y + 30}
                  x2={edge.toNode.x}
                  y2={edge.toNode.y - 30}
                  stroke={isHighlighted ? '#1a73e8' : fromComplete ? '#34a853' : '#374151'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={fromComplete ? '0' : '4 2'}
                  markerEnd="url(#arrowhead)"
                />
              </g>
            );
          })}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#374151" />
            </marker>
          </defs>

          {/* Nodes */}
          {Array.from(nodes.values()).map(node => {
            const isSelected = selectedTask === node.id;
            const task = node.task;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x - 80}, ${node.y - 30})`}
                onClick={() => {
                  setSelectedTask(isSelected ? null : node.id);
                  onTaskClick?.(node.id);
                }}
                className="cursor-pointer"
              >
                {/* Node background */}
                <rect
                  width="160"
                  height="60"
                  rx="12"
                  className={`${getStatusColor(task.status)} transition-all`}
                  stroke={isSelected ? '#1a73e8' : 'currentColor'}
                  strokeWidth={isSelected ? 2 : 1}
                  fill="currentColor"
                  style={{ fill: task.status === 'complete' ? 'rgba(52,168,83,0.1)' : 'rgba(31,41,55,0.8)' }}
                />

                {/* Status icon */}
                <foreignObject x="8" y="8" width="20" height="20">
                  {getStatusIcon(task.status)}
                </foreignObject>

                {/* Task title */}
                {showLabels && (
                  <text
                    x="80"
                    y="28"
                    textAnchor="middle"
                    className="fill-white text-[10px] font-bold"
                    style={{ fontSize: '10px' }}
                  >
                    {task.title.length > 18 ? task.title.slice(0, 18) + '...' : task.title}
                  </text>
                )}

                {/* Type badge */}
                <foreignObject x="8" y="38" width="60" height="18">
                  <div className={`px-2 py-0.5 rounded text-[7px] font-black ${getTypeBadgeColor(task.taskType)} inline-block`}>
                    {getTypeLabel(task.taskType)}
                  </div>
                </foreignObject>

                {/* Deps count */}
                {(task.deps?.length || 0) > 0 && (
                  <text
                    x="145"
                    y="50"
                    textAnchor="end"
                    className="fill-gray-500 text-[8px] font-mono"
                    style={{ fontSize: '8px' }}
                  >
                    {task.deps.length} dep{task.deps.length > 1 ? 's' : ''}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="p-20 text-center">
          <Layers size={48} className="mx-auto mb-4 text-gray-700" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No tasks to visualize</p>
        </div>
      )}

      {/* Selected task details */}
      {selectedTask && nodes.has(selectedTask) && (
        <div className="p-4 border-t border-dark-700 bg-dark-900/50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-white">{nodes.get(selectedTask)?.task.title}</h4>
              <p className="text-[10px] text-gray-500 font-mono">ID: {selectedTask}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-gray-600">Status</p>
                <p className="text-sm font-bold text-white capitalize">{nodes.get(selectedTask)?.task.status}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-gray-600">Dependencies</p>
                <p className="text-sm font-bold text-white">{nodes.get(selectedTask)?.task.deps?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskDependencyGraph;
