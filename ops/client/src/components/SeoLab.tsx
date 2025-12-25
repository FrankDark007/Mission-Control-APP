
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart, Globe, Target, Search, MousePointer2, Percent } from 'lucide-react';
import { KeywordRank, SeoPageMetric } from '../types';

const SeoLab = () => {
    const [keywords, setKeywords] = useState<KeywordRank[]>([]);
    const [pages, setPages] = useState<SeoPageMetric[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/seo/metrics')
            .then(res => res.json())
            .then(data => {
                setKeywords(data.keywords);
                setPages(data.pages);
            })
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-1">SEO Lab</h2>
                    <p className="text-sm text-gray-500 font-medium">Search visibility and keyword performance metrics.</p>
                </div>
                <div className="flex gap-4">
                    <button className="bg-dark-800 border border-dark-700 text-gray-400 px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest hover:text-white transition-all shadow-lg flex items-center gap-2">
                        <Search size={16} /> Crawl Sitemap
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Keyword Rankings */}
                <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <Target className="text-google-yellow" size={24} />
                        <h3 className="text-xl font-bold text-white tracking-tight">Keyword Pulse</h3>
                    </div>
                    <div className="space-y-4">
                        {keywords.map((k, idx) => (
                            <div key={idx} className="flex justify-between items-center p-5 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-yellow/30 transition-all">
                                <div>
                                    <div className="text-sm font-bold text-white mb-1">{k.keyword}</div>
                                    <div className="text-[10px] text-gray-500 font-mono">{k.url}</div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-black text-gray-500 mb-1">Position</div>
                                        <div className="text-lg font-black text-white">#{k.position}</div>
                                    </div>
                                    <div className={`p-2 rounded-xl flex items-center gap-1 text-[10px] font-black ${k.delta >= 0 ? 'bg-google-green/10 text-google-green' : 'bg-google-red/10 text-google-red'}`}>
                                        {k.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                        {Math.abs(k.delta)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Page Performance */}
                <div className="bg-dark-800 p-8 rounded-[2rem] border border-dark-700 shadow-2xl">
                    <div className="flex items-center gap-4 mb-8">
                        <Globe className="text-google-blue" size={24} />
                        <h3 className="text-xl font-bold text-white tracking-tight">Search Metrics</h3>
                    </div>
                    <div className="space-y-4">
                        {pages.map((p, idx) => (
                            <div key={idx} className="p-6 bg-dark-900 rounded-2xl border border-dark-700 group hover:border-google-blue/30 transition-all">
                                <div className="text-sm font-bold text-white mb-4 flex items-center justify-between">
                                    {p.url}
                                    <BarChart size={16} className="text-gray-600" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase font-black text-gray-500 mb-1">Clicks</div>
                                        <div className="text-md font-black text-white">{p.clicks}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase font-black text-gray-500 mb-1">Impressions</div>
                                        <div className="text-md font-black text-white">{p.impressions > 1000 ? (p.impressions/1000).toFixed(1) + 'k' : p.impressions}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[9px] uppercase font-black text-gray-500 mb-1">CTR</div>
                                        <div className="text-md font-black text-google-green">{p.ctr}%</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SeoLab;
