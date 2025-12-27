/**
 * Ahrefs API Integration
 * Backlinks, keywords, and competitor analysis
 * Note: Ahrefs API requires paid plan for full access
 */

export class AhrefsIntegration {
    constructor() {
        this.apiKey = process.env.AHREFS_API_KEY;
        this.baseUrl = 'https://api.ahrefs.com/v3';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Query Ahrefs API
     */
    async query(params) {
        const { target, mode = 'overview', limit = 100 } = params;

        if (!this.isConfigured()) {
            // Return mock data for free tier / unconfigured
            return this._getMockData(target, mode);
        }

        switch (mode) {
            case 'overview':
                return this.getDomainOverview(target);
            case 'backlinks':
                return this.getBacklinks(target, limit);
            case 'keywords':
                return this.getOrganicKeywords(target, limit);
            case 'competitors':
                return this.getCompetitors(target, limit);
            default:
                throw new Error(`Unknown mode: ${mode}`);
        }
    }

    /**
     * Get domain overview metrics
     */
    async getDomainOverview(target) {
        try {
            const response = await this._request('/site-explorer/overview', {
                target,
                mode: 'domain'
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Overview error:', error.message);
            return this._getMockData(target, 'overview');
        }
    }

    /**
     * Get backlinks for a domain
     */
    async getBacklinks(target, limit = 100) {
        try {
            const response = await this._request('/site-explorer/backlinks', {
                target,
                mode: 'domain',
                limit
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Backlinks error:', error.message);
            return this._getMockData(target, 'backlinks');
        }
    }

    /**
     * Get organic keywords
     */
    async getOrganicKeywords(target, limit = 100) {
        try {
            const response = await this._request('/site-explorer/organic-keywords', {
                target,
                mode: 'domain',
                limit,
                country: 'us'
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Keywords error:', error.message);
            return this._getMockData(target, 'keywords');
        }
    }

    /**
     * Get organic competitors
     */
    async getCompetitors(target, limit = 20) {
        try {
            const response = await this._request('/site-explorer/competitors', {
                target,
                mode: 'domain',
                limit,
                country: 'us'
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Competitors error:', error.message);
            return this._getMockData(target, 'competitors');
        }
    }

    /**
     * Get referring domains
     */
    async getReferringDomains(target, limit = 100) {
        try {
            const response = await this._request('/site-explorer/refdomains', {
                target,
                mode: 'domain',
                limit
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Referring domains error:', error.message);
            return { domains: [], total: 0, note: 'API unavailable' };
        }
    }

    /**
     * Keyword research
     */
    async keywordResearch(keyword, country = 'us') {
        try {
            const response = await this._request('/keywords-explorer/overview', {
                keyword,
                country
            });
            return response;
        } catch (error) {
            console.error('[Ahrefs] Keyword research error:', error.message);
            return this._getMockKeywordData(keyword);
        }
    }

    async _request(endpoint, params) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Ahrefs API error: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Mock data for free tier / development
     */
    _getMockData(target, mode) {
        const domain = target.replace(/^https?:\/\//, '').split('/')[0];
        
        const mockData = {
            overview: {
                domain,
                domainRating: 45,
                organicTraffic: 12500,
                organicKeywords: 850,
                backlinks: 15200,
                referringDomains: 420,
                note: 'Mock data - configure AHREFS_API_KEY for real data'
            },
            backlinks: {
                backlinks: [
                    { url: `https://example1.com/link-to-${domain}`, anchor: domain, dr: 55, traffic: 1200 },
                    { url: `https://example2.com/resources`, anchor: 'water damage experts', dr: 42, traffic: 800 },
                    { url: `https://localdir.com/${domain}`, anchor: 'restoration company', dr: 38, traffic: 450 }
                ],
                total: 15200,
                note: 'Mock data - configure AHREFS_API_KEY for real data'
            },
            keywords: {
                keywords: [
                    { keyword: 'water damage restoration', position: 8, volume: 12000, difficulty: 45 },
                    { keyword: `water damage ${domain.split('.')[0]}`, position: 3, volume: 320, difficulty: 12 },
                    { keyword: 'mold remediation near me', position: 15, volume: 8500, difficulty: 52 }
                ],
                total: 850,
                note: 'Mock data - configure AHREFS_API_KEY for real data'
            },
            competitors: {
                competitors: [
                    { domain: 'servpro.com', commonKeywords: 245, organicTraffic: 185000 },
                    { domain: 'servicemaster.com', commonKeywords: 198, organicTraffic: 142000 },
                    { domain: 'belfor.com', commonKeywords: 156, organicTraffic: 89000 }
                ],
                note: 'Mock data - configure AHREFS_API_KEY for real data'
            }
        };

        return mockData[mode] || mockData.overview;
    }

    _getMockKeywordData(keyword) {
        return {
            keyword,
            searchVolume: 5400,
            keywordDifficulty: 42,
            cpc: 12.50,
            parentTopic: keyword.split(' ')[0],
            note: 'Mock data - configure AHREFS_API_KEY for real data'
        };
    }

    /**
     * Health check for Ahrefs integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'ahrefs',
            configured: this.isConfigured(),
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            status.message = 'AHREFS_API_KEY not set';
            status.fallback = 'Using mock data';
            return status;
        }

        try {
            const start = Date.now();
            // Quick API validation with minimal request
            const response = await fetch(`${this.baseUrl}/subscription-info`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Accept': 'application/json'
                }
            });
            status.latency = Date.now() - start;

            if (response.ok) {
                status.status = 'healthy';
            } else if (response.status === 401) {
                status.status = 'unhealthy';
                status.error = 'Invalid API key';
            } else {
                status.status = 'degraded';
                status.warning = `API returned ${response.status}`;
            }
        } catch (error) {
            status.status = 'unhealthy';
            status.error = error.message;
        }

        return status;
    }
}
