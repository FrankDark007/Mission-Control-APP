import React, { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Plus, Trash2, RefreshCw, Loader2, CheckCircle2,
  AlertTriangle, XCircle, Play, Pause, ExternalLink, Image,
  Target, Crosshair, SplitSquareVertical, Layers, Clock, Zap
} from 'lucide-react';

interface Watch {
  id: string;
  projectId: string;
  name: string;
  referenceUrl: string;
  buildUrl: string;
  checkInterval: number;
  threshold: number;
  autoFix: boolean;
  status: 'active' | 'stopped' | 'checking' | 'error';
  createdAt: string;
  lastCheckAt: string | null;
  lastResult: ComparisonResult | null;
  checksCompleted: number;
  discrepanciesFound: number;
  fixTasksCreated: number;
  referenceScreenshot: string | null;
  buildScreenshot: string | null;
}

interface ComparisonResult {
  id: string;
  matchScore: number;
  status: 'match' | 'discrepancy' | 'error';
  discrepancies: Discrepancy[];
  timestamp: string;
}

interface Discrepancy {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  location: string;
  fixInstructions?: string;
}

interface SentinelStatus {
  totalWatches: number;
  activeWatches: number;
  totalComparisons: number;
  totalDiscrepancies: number;
  totalFixTasks: number;
}

const SentinelLab: React.FC = () => {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [status, setStatus] = useState<SentinelStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);

  // Form state
  const [newWatch, setNewWatch] = useState({
    projectId: '',
    name: '',
    referenceUrl: '',
    buildUrl: 'http://localhost:4000',
    checkInterval: 60000,
    threshold: 5,
    autoFix: true
  });

  const fetchData = async () => {
    try {
      const [watchesRes, statusRes] = await Promise.all([
        fetch('/api/sentinel/watches'),
        fetch('/api/sentinel/status')
      ]);
      const watchesData = await watchesRes.json();
      const statusData = await statusRes.json();

      setWatches(watchesData.watches || []);
      setStatus(statusData.status || null);
    } catch (err) {
      console.error('Failed to fetch Sentinel data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const createWatch = async () => {
    try {
      const res = await fetch('/api/sentinel/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWatch)
      });
      const data = await res.json();
      if (data.success) {
        setWatches(prev => [...prev, data.watch]);
        setShowCreateModal(false);
        setNewWatch({
          projectId: '',
          name: '',
          referenceUrl: '',
          buildUrl: 'http://localhost:4000',
          checkInterval: 60000,
          threshold: 5,
          autoFix: true
        });
      }
    } catch (err) {
      console.error('Failed to create watch:', err);
    }
  };

  const triggerComparison = async (watchId: string) => {
    setComparing(watchId);
    try {
      await fetch(`/api/sentinel/watches/${watchId}/compare`, { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Failed to trigger comparison:', err);
    } finally {
      setComparing(null);
    }
  };

  const toggleWatch = async (watchId: string, currentStatus: string) => {
    const endpoint = currentStatus === 'active' ? 'stop' : 'resume';
    try {
      await fetch(`/api/sentinel/watches/${watchId}/${endpoint}`, { method: 'POST' });
      await fetchData();
    } catch (err) {
      console.error('Failed to toggle watch:', err);
    }
  };

  const deleteWatch = async (watchId: string) => {
    if (!confirm('Delete this watch?')) return;
    try {
      await fetch(`/api/sentinel/watches/${watchId}`, { method: 'DELETE' });
      setWatches(prev => prev.filter(w => w.id !== watchId));
      if (selectedWatch?.id === watchId) setSelectedWatch(null);
    } catch (err) {
      console.error('Failed to delete watch:', err);
    }
  };

  const getMatchColor = (score: number) => {
    if (score >= 95) return 'text-google-green';
    if (score >= 80) return 'text-google-yellow';
    return 'text-google-red';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-google-red/10 border-google-red/30 text-google-red';
      case 'medium': return 'bg-google-yellow/10 border-google-yellow/30 text-google-yellow';
      case 'low': return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
      default: return 'bg-dark-700 border-dark-600 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={48} className="animate-spin text-google-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase italic">
            Sentinel Agent
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Automated visual comparison and discrepancy detection system
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-google-blue text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-3"
        >
          <Plus size={18} />
          Create Watch
        </button>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total Watches', value: status.totalWatches, icon: Eye },
            { label: 'Active', value: status.activeWatches, icon: Zap, color: 'text-google-green' },
            { label: 'Comparisons', value: status.totalComparisons, icon: SplitSquareVertical },
            { label: 'Discrepancies', value: status.totalDiscrepancies, icon: AlertTriangle, color: 'text-google-yellow' },
            { label: 'Fix Tasks', value: status.totalFixTasks, icon: Target, color: 'text-google-blue' }
          ].map(stat => (
            <div key={stat.label} className="bg-dark-800 rounded-2xl p-5 border border-dark-700">
              <div className="flex items-center gap-3 mb-3">
                <stat.icon size={16} className={stat.color || 'text-gray-500'} />
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{stat.label}</span>
              </div>
              <div className={`text-3xl font-black ${stat.color || 'text-white'}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Watches Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {watches.length === 0 ? (
          <div className="col-span-2 p-20 border-2 border-dashed border-dark-700 rounded-[3rem] text-center">
            <Crosshair size={64} className="mx-auto mb-4 text-gray-700" />
            <p className="text-lg font-black uppercase tracking-widest text-gray-600">No Watches Active</p>
            <p className="text-sm text-gray-500 mt-2">Create a watch to start monitoring your builds</p>
          </div>
        ) : (
          watches.map(watch => (
            <div
              key={watch.id}
              onClick={() => setSelectedWatch(watch)}
              className={`bg-dark-800 rounded-[2rem] border transition-all cursor-pointer ${
                selectedWatch?.id === watch.id
                  ? 'border-google-blue shadow-lg shadow-google-blue/10'
                  : 'border-dark-700 hover:border-dark-600'
              }`}
            >
              {/* Watch Header */}
              <div className="p-6 border-b border-dark-700 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      watch.status === 'active' ? 'bg-google-green animate-pulse' :
                      watch.status === 'checking' ? 'bg-google-blue animate-pulse' :
                      watch.status === 'error' ? 'bg-google-red' : 'bg-gray-600'
                    }`} />
                    <h3 className="text-lg font-black text-white">{watch.name}</h3>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs">{watch.referenceUrl}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); triggerComparison(watch.id); }}
                    disabled={comparing === watch.id}
                    className="p-2 rounded-xl bg-dark-900 border border-dark-700 text-gray-400 hover:text-google-blue transition-all disabled:opacity-50"
                  >
                    {comparing === watch.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleWatch(watch.id, watch.status); }}
                    className="p-2 rounded-xl bg-dark-900 border border-dark-700 text-gray-400 hover:text-white transition-all"
                  >
                    {watch.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteWatch(watch.id); }}
                    className="p-2 rounded-xl bg-dark-900 border border-dark-700 text-gray-400 hover:text-google-red transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Match Score */}
              <div className="p-6">
                {watch.lastResult ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1">Match Score</p>
                      <div className={`text-4xl font-black ${getMatchColor(watch.lastResult.matchScore)}`}>
                        {watch.lastResult.matchScore}%
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1">Discrepancies</p>
                      <div className="text-2xl font-black text-white">{watch.lastResult.discrepancies.length}</div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-1">Last Check</p>
                      <div className="text-sm font-bold text-gray-400">
                        {watch.lastCheckAt ? new Date(watch.lastCheckAt).toLocaleTimeString() : 'Never'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 opacity-50">
                    <Clock size={32} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Awaiting First Comparison</p>
                  </div>
                )}
              </div>

              {/* Stats Footer */}
              <div className="px-6 py-4 bg-dark-900/50 border-t border-dark-700 flex justify-between text-[9px] font-black uppercase text-gray-500">
                <span>{watch.checksCompleted} checks</span>
                <span>{watch.discrepanciesFound} issues found</span>
                <span>{watch.fixTasksCreated} fix tasks</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Watch Details */}
      {selectedWatch?.lastResult && (
        <div className="bg-dark-800 rounded-[2rem] border border-dark-700 overflow-hidden">
          <div className="p-6 border-b border-dark-700 flex justify-between items-center">
            <h3 className="text-xl font-black text-white">Discrepancy Report: {selectedWatch.name}</h3>
            <div className="flex items-center gap-4">
              <a
                href={selectedWatch.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] font-black uppercase text-google-blue hover:underline"
              >
                Reference <ExternalLink size={12} />
              </a>
              <a
                href={selectedWatch.buildUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400 hover:underline"
              >
                Build <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Discrepancies List */}
          <div className="p-6 space-y-4">
            {selectedWatch.lastResult.discrepancies.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 size={48} className="mx-auto mb-4 text-google-green" />
                <p className="text-lg font-black text-google-green uppercase">Perfect Match!</p>
                <p className="text-sm text-gray-500 mt-2">No discrepancies detected</p>
              </div>
            ) : (
              selectedWatch.lastResult.discrepancies.map((disc, idx) => (
                <div key={idx} className="bg-dark-900 rounded-xl p-5 border border-dark-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${getSeverityColor(disc.severity)}`}>
                        {disc.severity}
                      </span>
                      <span className="text-[10px] font-black uppercase text-gray-500">{disc.type}</span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-600">{disc.location}</span>
                  </div>
                  <p className="text-sm text-gray-300 mb-3">{disc.description}</p>
                  {disc.fixInstructions && (
                    <div className="bg-dark-800 rounded-lg p-3 border border-dark-700">
                      <p className="text-[9px] font-black uppercase text-google-blue mb-1">Fix Instructions</p>
                      <p className="text-[11px] text-gray-400 font-mono">{disc.fixInstructions}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Watch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-10">
          <div className="bg-dark-800 rounded-[2rem] border border-dark-700 w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-xl font-black text-white">Create Sentinel Watch</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Watch Name</label>
                <input
                  type="text"
                  value={newWatch.name}
                  onChange={(e) => setNewWatch(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Homepage Hero Match"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-google-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Reference URL (Target to Match)</label>
                <input
                  type="url"
                  value={newWatch.referenceUrl}
                  onChange={(e) => setNewWatch(prev => ({ ...prev, referenceUrl: e.target.value }))}
                  placeholder="https://example.com/page-to-match"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-google-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Build URL (Your Page)</label>
                <input
                  type="url"
                  value={newWatch.buildUrl}
                  onChange={(e) => setNewWatch(prev => ({ ...prev, buildUrl: e.target.value }))}
                  placeholder="http://localhost:4000"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:border-google-blue focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Check Interval</label>
                  <select
                    value={newWatch.checkInterval}
                    onChange={(e) => setNewWatch(prev => ({ ...prev, checkInterval: parseInt(e.target.value) }))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:border-google-blue focus:outline-none"
                  >
                    <option value={30000}>30 seconds</option>
                    <option value={60000}>1 minute</option>
                    <option value={300000}>5 minutes</option>
                    <option value={600000}>10 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Match Threshold</label>
                  <select
                    value={newWatch.threshold}
                    onChange={(e) => setNewWatch(prev => ({ ...prev, threshold: parseInt(e.target.value) }))}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl px-4 py-3 text-white focus:border-google-blue focus:outline-none"
                  >
                    <option value={1}>99% (Strict)</option>
                    <option value={5}>95% (Standard)</option>
                    <option value={10}>90% (Relaxed)</option>
                    <option value={20}>80% (Loose)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoFix"
                  checked={newWatch.autoFix}
                  onChange={(e) => setNewWatch(prev => ({ ...prev, autoFix: e.target.checked }))}
                  className="w-5 h-5 rounded bg-dark-900 border-dark-700 text-google-blue focus:ring-google-blue"
                />
                <label htmlFor="autoFix" className="text-sm text-gray-400">
                  Automatically create fix tasks for Claude Code
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-dark-700 flex justify-end gap-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={createWatch}
                disabled={!newWatch.name || !newWatch.referenceUrl || !newWatch.buildUrl}
                className="bg-google-blue text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                Create Watch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SentinelLab;
