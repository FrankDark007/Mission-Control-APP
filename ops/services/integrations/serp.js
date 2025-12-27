/**
 * SERP Checker Integration
 * Live Google ranking checks via scraping or API
 */

import puppeteer from 'puppeteer';

export class SERPIntegration {
    constructor() {
        this.apiKey = process.env.SERP_API_KEY; // Optional: SerpAPI, ValueSERP, etc.
        this.apiProvider = process.env.SERP_API_PROVIDER || 'scrape';
    }

    isConfigured() {
        return this.apiProvider === 'scrape' || !!this.apiKey;
    }

    /**
     * Check rankings for a keyword + location
     */
    async check(keyword, location, targetDomain = null) {
        if (this.apiKey && this.apiProvider !== 'scrape') {
            return this._checkViaAPI(keyword, location, targetDomain);
        }

        return this._checkViaScrape(keyword, location, targetDomain);
    }

    /**
     * Check via SERP API (ValueSERP, SerpAPI, etc.)
     */
    async _checkViaAPI(keyword, location, targetDomain) {
        const endpoints = {
            valueserp: 'https://api.valueserp.com/search',
            serpapi: 'https://serpapi.com/search'
        };

        const endpoint = endpoints[this.apiProvider] || endpoints.valueserp;
        
        try {
            const params = new URLSearchParams({
                api_key: this.apiKey,
                q: keyword,
                location,
                gl: 'us',
                hl: 'en',
                num: 100
            });

            const response = await fetch(`${endpoint}?${params}`);
            if (!response.ok) {
                throw new Error(`SERP API error: ${response.status}`);
            }

            const data = await response.json();
            return this._formatAPIResponse(data, keyword, location, targetDomain);
        } catch (error) {
            console.error('[SERP] API error:', error.message);
            // Fallback to scraping
            return this._checkViaScrape(keyword, location, targetDomain);
        }
    }

    /**
     * Check via Puppeteer scraping
     */
    async _checkViaScrape(keyword, location, targetDomain) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });

            const page = await browser.newPage();
            
            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Build Google search URL with location
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gl=us&hl=en&num=100&uule=${this._encodeLocation(location)}`;
            
            await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            
            // Wait for results
            await page.waitForSelector('#search', { timeout: 10000 }).catch(() => {});
            
            // Extract organic results
            const results = await page.evaluate(() => {
                const items = [];
                const elements = document.querySelectorAll('#search .g');
                
                elements.forEach((el, index) => {
                    const linkEl = el.querySelector('a');
                    const titleEl = el.querySelector('h3');
                    const snippetEl = el.querySelector('.VwiC3b');
                    
                    if (linkEl && titleEl) {
                        const url = linkEl.href;
                        if (url && !url.includes('google.com')) {
                            items.push({
                                position: index + 1,
                                url,
                                title: titleEl.textContent,
                                snippet: snippetEl?.textContent || '',
                                domain: new URL(url).hostname.replace('www.', '')
                            });
                        }
                    }
                });
                
                return items;
            });

            await browser.close();
            
            return this._formatScrapeResponse(results, keyword, location, targetDomain);
        } catch (error) {
            if (browser) await browser.close();
            console.error('[SERP] Scrape error:', error.message);
            
            // Return mock data on failure
            return {
                keyword,
                location,
                timestamp: new Date().toISOString(),
                error: error.message,
                results: [],
                targetPosition: null,
                note: 'Scrape failed. Consider using a SERP API for reliable results.'
            };
        }
    }

    /**
     * Bulk check multiple keywords
     */
    async checkBulk(keywords, location, targetDomain) {
        const results = [];
        
        for (const keyword of keywords) {
            const result = await this.check(keyword, location, targetDomain);
            results.push(result);
            
            // Rate limiting between requests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return {
            location,
            targetDomain,
            timestamp: new Date().toISOString(),
            keywords: results
        };
    }

    /**
     * Track rankings over time
     */
    async trackRankings(keyword, location, targetDomain, historical = []) {
        const current = await this.check(keyword, location, targetDomain);
        
        const entry = {
            date: new Date().toISOString().split('T')[0],
            position: current.targetPosition,
            url: current.targetUrl
        };
        
        const history = [...historical, entry].slice(-30); // Keep 30 days
        
        return {
            keyword,
            location,
            targetDomain,
            current: current.targetPosition,
            history,
            trend: this._calculateTrend(history)
        };
    }

    _formatAPIResponse(data, keyword, location, targetDomain) {
        const organicResults = data.organic_results || [];
        
        const results = organicResults.map((r, i) => ({
            position: r.position || i + 1,
            url: r.link,
            title: r.title,
            snippet: r.snippet,
            domain: r.domain || new URL(r.link).hostname.replace('www.', '')
        }));

        let targetPosition = null;
        let targetUrl = null;

        if (targetDomain) {
            const targetResult = results.find(r => r.domain.includes(targetDomain.replace('www.', '')));
            if (targetResult) {
                targetPosition = targetResult.position;
                targetUrl = targetResult.url;
            }
        }

        return {
            keyword,
            location,
            timestamp: new Date().toISOString(),
            results: results.slice(0, 20), // Return top 20
            totalResults: results.length,
            targetDomain,
            targetPosition,
            targetUrl,
            source: 'api'
        };
    }

    _formatScrapeResponse(results, keyword, location, targetDomain) {
        let targetPosition = null;
        let targetUrl = null;

        if (targetDomain) {
            const targetResult = results.find(r => r.domain.includes(targetDomain.replace('www.', '')));
            if (targetResult) {
                targetPosition = targetResult.position;
                targetUrl = targetResult.url;
            }
        }

        return {
            keyword,
            location,
            timestamp: new Date().toISOString(),
            results: results.slice(0, 20),
            totalResults: results.length,
            targetDomain,
            targetPosition,
            targetUrl,
            source: 'scrape'
        };
    }

    _encodeLocation(location) {
        // UULE encoding for Google local search
        // This is a simplified version; production should use proper UULE encoding
        const encoded = Buffer.from(`w+CAIQICI${location}`).toString('base64');
        return encoded;
    }

    _calculateTrend(history) {
        if (history.length < 2) return 'stable';

        const recent = history.slice(-7);
        const positions = recent.map(h => h.position).filter(p => p !== null);

        if (positions.length < 2) return 'unknown';

        const first = positions[0];
        const last = positions[positions.length - 1];
        const diff = first - last;

        if (diff > 3) return 'improving';
        if (diff < -3) return 'declining';
        return 'stable';
    }

    /**
     * Health check for SERP integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'serp',
            configured: this.isConfigured(),
            provider: this.apiProvider,
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            return status;
        }

        try {
            const start = Date.now();
            // Quick test check
            const result = await this.check('water damage restoration', 'Washington DC');
            status.latency = Date.now() - start;
            status.status = result.error ? 'degraded' : 'healthy';
            status.source = result.source;
            if (result.error) {
                status.warning = result.error;
            }
        } catch (error) {
            status.status = 'unhealthy';
            status.error = error.message;
        }

        return status;
    }
}
