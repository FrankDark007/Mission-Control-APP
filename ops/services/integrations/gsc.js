/**
 * Google Search Console Integration
 * OAuth2 authentication + Search Analytics API
 */

import { google } from 'googleapis';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TOKEN_PATH = join(__dirname, '../../.tokens/gsc-token.json');

export class GSCIntegration {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/oauth/callback';
        this.oauth2Client = null;
        this.webmasters = null;
    }

    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    async initialize() {
        if (!this.isConfigured()) {
            console.warn('[GSC] Missing OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
            return false;
        }

        this.oauth2Client = new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );

        // Try to load existing token
        try {
            if (existsSync(TOKEN_PATH)) {
                const token = JSON.parse(await readFile(TOKEN_PATH, 'utf8'));
                this.oauth2Client.setCredentials(token);
                this.webmasters = google.webmasters({ version: 'v3', auth: this.oauth2Client });
                return true;
            }
        } catch (error) {
            console.warn('[GSC] Could not load token:', error.message);
        }

        return false;
    }

    /**
     * Generate OAuth URL for user authorization
     */
    getAuthUrl() {
        if (!this.oauth2Client) {
            throw new Error('GSC integration not initialized');
        }

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/webmasters.readonly',
                'https://www.googleapis.com/auth/webmasters'
            ],
            prompt: 'consent'
        });
    }

    /**
     * Handle OAuth callback and store token
     */
    async handleCallback(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        
        // Ensure token directory exists
        const tokenDir = dirname(TOKEN_PATH);
        if (!existsSync(tokenDir)) {
            await mkdir(tokenDir, { recursive: true });
        }
        
        await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        this.webmasters = google.webmasters({ version: 'v3', auth: this.oauth2Client });
        
        return { success: true, message: 'GSC authorization complete' };
    }

    /**
     * List all verified sites
     */
    async listSites() {
        if (!this.webmasters) {
            throw new Error('GSC not authenticated. Complete OAuth flow first.');
        }

        const response = await this.webmasters.sites.list();
        return response.data.siteEntry || [];
    }

    /**
     * Query Search Analytics data
     * @param {Object} params - Query parameters
     */
    async query(params) {
        if (!this.webmasters) {
            throw new Error('GSC not authenticated. Complete OAuth flow first.');
        }

        const {
            siteUrl,
            startDate = this._getDefaultStartDate(),
            endDate = this._getDefaultEndDate(),
            dimensions = ['query', 'page'],
            rowLimit = 1000,
            filters = []
        } = params;

        try {
            const response = await this.webmasters.searchanalytics.query({
                siteUrl,
                requestBody: {
                    startDate,
                    endDate,
                    dimensions,
                    rowLimit,
                    dimensionFilterGroups: filters.length > 0 ? [{ filters }] : undefined
                }
            });

            return {
                siteUrl,
                dateRange: { startDate, endDate },
                rows: response.data.rows || [],
                responseAggregationType: response.data.responseAggregationType
            };
        } catch (error) {
            console.error('[GSC] Query error:', error.message);
            throw error;
        }
    }

    /**
     * Get top performing queries
     */
    async getTopQueries(siteUrl, limit = 100) {
        return this.query({
            siteUrl,
            dimensions: ['query'],
            rowLimit: limit
        });
    }

    /**
     * Get top performing pages
     */
    async getTopPages(siteUrl, limit = 100) {
        return this.query({
            siteUrl,
            dimensions: ['page'],
            rowLimit: limit
        });
    }

    /**
     * Get query performance by device
     */
    async getDeviceBreakdown(siteUrl) {
        return this.query({
            siteUrl,
            dimensions: ['device']
        });
    }

    /**
     * Get query performance by country
     */
    async getCountryBreakdown(siteUrl) {
        return this.query({
            siteUrl,
            dimensions: ['country']
        });
    }

    /**
     * Get queries for a specific page
     */
    async getPageQueries(siteUrl, pageUrl, limit = 100) {
        return this.query({
            siteUrl,
            dimensions: ['query'],
            filters: [{
                dimension: 'page',
                operator: 'equals',
                expression: pageUrl
            }],
            rowLimit: limit
        });
    }

    /**
     * Compare two date ranges
     */
    async compareRanges(siteUrl, range1, range2) {
        const [data1, data2] = await Promise.all([
            this.query({ siteUrl, startDate: range1.start, endDate: range1.end, dimensions: ['query'] }),
            this.query({ siteUrl, startDate: range2.start, endDate: range2.end, dimensions: ['query'] })
        ]);

        // Build comparison map
        const map1 = new Map(data1.rows.map(r => [r.keys[0], r]));
        const map2 = new Map(data2.rows.map(r => [r.keys[0], r]));
        
        const allQueries = new Set([...map1.keys(), ...map2.keys()]);
        const comparison = [];

        for (const query of allQueries) {
            const r1 = map1.get(query);
            const r2 = map2.get(query);
            comparison.push({
                query,
                range1: r1 ? { clicks: r1.clicks, impressions: r1.impressions, position: r1.position } : null,
                range2: r2 ? { clicks: r2.clicks, impressions: r2.impressions, position: r2.position } : null,
                clicksDelta: (r2?.clicks || 0) - (r1?.clicks || 0),
                positionDelta: (r1?.position || 0) - (r2?.position || 0)
            });
        }

        return comparison.sort((a, b) => b.clicksDelta - a.clicksDelta);
    }

    _getDefaultStartDate() {
        const date = new Date();
        date.setDate(date.getDate() - 28);
        return date.toISOString().split('T')[0];
    }

    _getDefaultEndDate() {
        const date = new Date();
        date.setDate(date.getDate() - 3); // GSC has 3-day delay
        return date.toISOString().split('T')[0];
    }

    /**
     * Health check for GSC integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'gsc',
            configured: this.isConfigured(),
            authenticated: !!this.webmasters,
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            status.message = 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set';
            return status;
        }

        if (!this.webmasters) {
            status.status = 'not_authenticated';
            status.message = 'OAuth flow not completed';
            return status;
        }

        try {
            const start = Date.now();
            // Quick API check - list sites
            await this.listSites();
            status.latency = Date.now() - start;
            status.status = 'healthy';
        } catch (error) {
            status.status = 'unhealthy';
            status.error = error.message;
        }

        return status;
    }
}
