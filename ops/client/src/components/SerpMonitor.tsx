/**
 * SERP Monitor - SEO Rankings & Competitor Tracking
 *
 * Shows:
 * - Keyword rankings over time
 * - Competitor rankings comparison
 * - SERP feature tracking (rich results)
 * - Position changes and trends
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Search, Globe, Star,
  Award, AlertTriangle, ArrowUp, ArrowDown, RefreshCw,
  Calendar, Filter, Download, ExternalLink, Crown, Target
} from 'lucide-react';

interface KeywordRanking {
  keyword: string;
  position: number;
  previousPosition: number;
  change: number;
  url: string;
  volume: number;
  difficulty: number;
  lastUpdated: string;
  features: string[];
}

interface CompetitorData {
  domain: string;
  name: string;
  overlapKeywords: number;
  avgPosition: number;
  visibility: number;
  trend: 'up' | 'down' | 'stable';
  topKeywords: { keyword: string; position: number }[];
  richResults: number;
}

interface SerpFeature {
  type: string;
  keyword: string;
  status: 'gained' | 'lost' | 'maintained';
  date: string;
  url?: string;
}

const SerpMonitor: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'rankings' | 'competitors' | 'features' | 'comparison'>('rankings');
  const [keywords, setKeywords] = useState<KeywordRanking[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [serpFeatures, setSerpFeatures] = useState<SerpFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState('flood.doctor');
  const [dateRange, setDateRange] = useState('7d');
  const [gscConnected, setGscConnected] = useState(false);
  const [ga4Connected, setGa4Connected] = useState(false);

  useEffect(() => {
    checkIntegrations();
    loadMockData();
  }, []);

  const checkIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations/status');
      const data = await res.json();
      setGscConnected(data.gsc || false);
      setGa4Connected(data.ga4 || false);
    } catch (e) {
      console.error('Failed to check integrations:', e);
    }
  };

  const loadMockData = () => {
    // Mock data for demonstration - will be replaced with real API calls
    setKeywords([
      {
        keyword: 'water damage restoration northern virginia',
        position: 3,
        previousPosition: 5,
        change: 2,
        url: 'https://flood.doctor/services/water-damage',
        volume: 2400,
        difficulty: 45,
        lastUpdated: new Date().toISOString(),
        features: ['local_pack', 'people_also_ask']
      },
      {
        keyword: 'flood damage repair alexandria va',
        position: 1,
        previousPosition: 1,
        change: 0,
        url: 'https://flood.doctor/locations/alexandria',
        volume: 880,
        difficulty: 32,
        lastUpdated: new Date().toISOString(),
        features: ['featured_snippet', 'local_pack']
      },
      {
        keyword: 'emergency water removal',
        position: 7,
        previousPosition: 4,
        change: -3,
        url: 'https://flood.doctor/emergency',
        volume: 5400,
        difficulty: 58,
        lastUpdated: new Date().toISOString(),
        features: []
      },
      {
        keyword: 'mold remediation fairfax',
        position: 2,
        previousPosition: 3,
        change: 1,
        url: 'https://flood.doctor/services/mold',
        volume: 1200,
        difficulty: 38,
        lastUpdated: new Date().toISOString(),
        features: ['local_pack']
      }
    ]);

    setCompetitors([
      {
        domain: 'servpro.com',
        name: 'SERVPRO',
        overlapKeywords: 156,
        avgPosition: 4.2,
        visibility: 78,
        trend: 'stable',
        topKeywords: [
          { keyword: 'water damage restoration', position: 2 },
          { keyword: 'fire damage cleanup', position: 1 }
        ],
        richResults: 12
      },
      {
        domain: 'servicemaster.com',
        name: 'ServiceMaster',
        overlapKeywords: 134,
        avgPosition: 5.8,
        visibility: 65,
        trend: 'down',
        topKeywords: [
          { keyword: 'water damage restoration', position: 4 },
          { keyword: 'flood cleanup', position: 3 }
        ],
        richResults: 8
      },
      {
        domain: 'puroclean.com',
        name: 'PuroClean',
        overlapKeywords: 98,
        avgPosition: 6.1,
        visibility: 52,
        trend: 'up',
        topKeywords: [
          { keyword: 'water damage repair', position: 3 },
          { keyword: 'mold removal', position: 5 }
        ],
        richResults: 5
      }
    ]);

    setSerpFeatures([
      { type: 'Featured Snippet', keyword: 'flood damage repair alexandria', status: 'gained', date: '2025-12-25', url: 'https://flood.doctor/locations/alexandria' },
      { type: 'Local Pack', keyword: 'water damage restoration near me', status: 'maintained', date: '2025-12-27' },
      { type: 'People Also Ask', keyword: 'how to dry out water damage', status: 'gained', date: '2025-12-26' },
      { type: 'Local Pack', keyword: 'emergency plumber', status: 'lost', date: '2025-12-24' }
    ]);
  };

  const refreshData = async () => {
    setLoading(true);
    // TODO: Call real APIs when connected
    await new Promise(r => setTimeout(r, 1000));
    loadMockData();
    setLoading(false);
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-400';
    if (change < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const getFeatureBadge = (feature: string) => {
    const badges: Record<string, { bg: string; label: string }> = {
      featured_snippet: { bg: 'bg-yellow-500/20 text-yellow-400', label: 'Featured Snippet' },
      local_pack: { bg: 'bg-blue-500/20 text-blue-400', label: 'Local Pack' },
      people_also_ask: { bg: 'bg-purple-500/20 text-purple-400', label: 'PAA' },
      knowledge_panel: { bg: 'bg-green-500/20 text-green-400', label: 'Knowledge' },
      image_pack: { bg: 'bg-pink-500/20 text-pink-400', label: 'Images' }
    };
    const badge = badges[feature] || { bg: 'bg-gray-500/20 text-gray-400', label: feature };
    return (
      <span key={feature} className={`text-[9px] px-1.5 py-0.5 rounded ${badge.bg}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-google-blue" />
            SERP Monitor
          </h2>
          <p className="text-xs text-gray-500 mt-1">Track keyword rankings and competitor movements</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Integration Status */}
          <div className="flex items-center gap-2 text-xs">
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${gscConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${gscConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              GSC
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${ga4Connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${ga4Connected ? 'bg-green-400' : 'bg-red-400'}`} />
              GA4
            </div>
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-dark-800 text-white text-xs px-3 py-1.5 rounded border border-dark-600"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          <button
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-google-blue/20 text-google-blue rounded text-xs hover:bg-google-blue/30 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* API Key Warning */}
      {(!gscConnected || !ga4Connected) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 font-medium text-sm">Connect Google APIs for Real Data</p>
            <p className="text-yellow-400/70 text-xs mt-1">
              Add your Google Search Console and GA4 API keys in <code className="bg-dark-700 px-1 rounded">.env</code> to enable live SERP tracking.
              Currently showing demo data.
            </p>
            <div className="mt-2 text-xs text-yellow-400/60">
              <code>GSC_API_KEY=your_key</code> • <code>GA4_API_KEY=your_key</code>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 p-1 rounded-lg w-fit">
        {[
          { id: 'rankings', label: 'Rankings', icon: TrendingUp },
          { id: 'competitors', label: 'Competitors', icon: Crown },
          { id: 'features', label: 'SERP Features', icon: Star },
          { id: 'comparison', label: 'Compare', icon: Target }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-google-blue text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden">
          <div className="p-4 border-b border-dark-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-google-blue" />
              <span className="text-white font-medium text-sm">{selectedDomain}</span>
              <span className="text-gray-500 text-xs">• {keywords.length} keywords tracked</span>
            </div>
            <button className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>

          <table className="w-full">
            <thead className="bg-dark-900/50">
              <tr className="text-xs text-gray-500">
                <th className="text-left py-3 px-4 font-medium">Keyword</th>
                <th className="text-center py-3 px-4 font-medium">Position</th>
                <th className="text-center py-3 px-4 font-medium">Change</th>
                <th className="text-center py-3 px-4 font-medium">Volume</th>
                <th className="text-center py-3 px-4 font-medium">KD</th>
                <th className="text-left py-3 px-4 font-medium">SERP Features</th>
                <th className="text-left py-3 px-4 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => (
                <tr key={i} className="border-t border-dark-700 hover:bg-dark-700/50">
                  <td className="py-3 px-4">
                    <span className="text-white text-sm">{kw.keyword}</span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm ${
                      kw.position <= 3 ? 'bg-green-500/20 text-green-400' :
                      kw.position <= 10 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {kw.position}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className={`flex items-center justify-center gap-1 ${getChangeColor(kw.change)}`}>
                      {getTrendIcon(kw.change)}
                      <span className="text-sm font-medium">
                        {kw.change > 0 ? `+${kw.change}` : kw.change === 0 ? '-' : kw.change}
                      </span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-4 text-gray-400 text-sm">
                    {kw.volume.toLocaleString()}
                  </td>
                  <td className="text-center py-3 px-4">
                    <span className={`text-sm ${
                      kw.difficulty < 30 ? 'text-green-400' :
                      kw.difficulty < 60 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {kw.difficulty}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {kw.features.length > 0 ? kw.features.map(f => getFeatureBadge(f)) : (
                        <span className="text-gray-600 text-xs">None</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <a href={kw.url} target="_blank" rel="noopener noreferrer" className="text-google-blue text-xs hover:underline flex items-center gap-1 truncate max-w-[200px]">
                      {new URL(kw.url).pathname}
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Competitors Tab */}
      {activeTab === 'competitors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map((comp, i) => (
            <div key={i} className="bg-dark-800 rounded-lg border border-dark-700 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Crown className={`w-4 h-4 ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`} />
                    <span className="text-white font-medium">{comp.name}</span>
                  </div>
                  <span className="text-gray-500 text-xs">{comp.domain}</span>
                </div>
                <div className={`flex items-center gap-1 text-xs ${
                  comp.trend === 'up' ? 'text-green-400' :
                  comp.trend === 'down' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {comp.trend === 'up' ? <ArrowUp className="w-3 h-3" /> :
                   comp.trend === 'down' ? <ArrowDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />}
                  {comp.trend}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-dark-900 rounded p-2">
                  <div className="text-xs text-gray-500">Avg Position</div>
                  <div className="text-lg font-bold text-white">{comp.avgPosition}</div>
                </div>
                <div className="bg-dark-900 rounded p-2">
                  <div className="text-xs text-gray-500">Visibility</div>
                  <div className="text-lg font-bold text-google-blue">{comp.visibility}%</div>
                </div>
                <div className="bg-dark-900 rounded p-2">
                  <div className="text-xs text-gray-500">Overlap KWs</div>
                  <div className="text-lg font-bold text-white">{comp.overlapKeywords}</div>
                </div>
                <div className="bg-dark-900 rounded p-2">
                  <div className="text-xs text-gray-500">Rich Results</div>
                  <div className="text-lg font-bold text-yellow-400">{comp.richResults}</div>
                </div>
              </div>

              <div className="border-t border-dark-700 pt-3">
                <div className="text-xs text-gray-500 mb-2">Top Keywords</div>
                {comp.topKeywords.map((kw, j) => (
                  <div key={j} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-300 truncate">{kw.keyword}</span>
                    <span className={`font-medium ${
                      kw.position <= 3 ? 'text-green-400' :
                      kw.position <= 10 ? 'text-yellow-400' :
                      'text-gray-400'
                    }`}>#{kw.position}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SERP Features Tab */}
      {activeTab === 'features' && (
        <div className="bg-dark-800 rounded-lg border border-dark-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-400" />
              SERP Feature Movements
            </h3>
            <div className="flex gap-2">
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded flex items-center gap-1">
                <ArrowUp className="w-3 h-3" /> Gained
              </span>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded flex items-center gap-1">
                <ArrowDown className="w-3 h-3" /> Lost
              </span>
              <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-1 rounded flex items-center gap-1">
                <Minus className="w-3 h-3" /> Maintained
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {serpFeatures.map((feature, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${
                feature.status === 'gained' ? 'bg-green-500/5 border-green-500/30' :
                feature.status === 'lost' ? 'bg-red-500/5 border-red-500/30' :
                'bg-dark-700 border-dark-600'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    feature.status === 'gained' ? 'bg-green-500/20' :
                    feature.status === 'lost' ? 'bg-red-500/20' :
                    'bg-gray-500/20'
                  }`}>
                    {feature.status === 'gained' ? <ArrowUp className="w-4 h-4 text-green-400" /> :
                     feature.status === 'lost' ? <ArrowDown className="w-4 h-4 text-red-400" /> :
                     <Minus className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">{feature.type}</div>
                    <div className="text-gray-500 text-xs">{feature.keyword}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(feature.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        <div className="bg-dark-800 rounded-lg border border-dark-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-google-blue" />
            <span className="text-white font-medium">Your Site vs Competitors</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-dark-700">
                  <th className="text-left py-3 px-4">Metric</th>
                  <th className="text-center py-3 px-4 text-google-blue">flood.doctor</th>
                  {competitors.slice(0, 3).map((c, i) => (
                    <th key={i} className="text-center py-3 px-4">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-dark-700">
                  <td className="py-3 px-4 text-gray-400">Avg Position</td>
                  <td className="text-center py-3 px-4 text-white font-bold">3.2</td>
                  {competitors.slice(0, 3).map((c, i) => (
                    <td key={i} className="text-center py-3 px-4 text-gray-300">{c.avgPosition}</td>
                  ))}
                </tr>
                <tr className="border-b border-dark-700">
                  <td className="py-3 px-4 text-gray-400">Visibility Score</td>
                  <td className="text-center py-3 px-4 text-google-blue font-bold">82%</td>
                  {competitors.slice(0, 3).map((c, i) => (
                    <td key={i} className="text-center py-3 px-4 text-gray-300">{c.visibility}%</td>
                  ))}
                </tr>
                <tr className="border-b border-dark-700">
                  <td className="py-3 px-4 text-gray-400">Rich Results</td>
                  <td className="text-center py-3 px-4 text-yellow-400 font-bold">15</td>
                  {competitors.slice(0, 3).map((c, i) => (
                    <td key={i} className="text-center py-3 px-4 text-gray-300">{c.richResults}</td>
                  ))}
                </tr>
                <tr className="border-b border-dark-700">
                  <td className="py-3 px-4 text-gray-400">Top 3 Keywords</td>
                  <td className="text-center py-3 px-4 text-green-400 font-bold">12</td>
                  {competitors.slice(0, 3).map((c, i) => (
                    <td key={i} className="text-center py-3 px-4 text-gray-300">{Math.floor(Math.random() * 10) + 3}</td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-4 text-gray-400">Top 10 Keywords</td>
                  <td className="text-center py-3 px-4 text-google-blue font-bold">45</td>
                  {competitors.slice(0, 3).map((c, i) => (
                    <td key={i} className="text-center py-3 px-4 text-gray-300">{Math.floor(Math.random() * 40) + 20}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SerpMonitor;
