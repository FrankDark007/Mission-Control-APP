/**
 * Google Analytics 4 Integration
 * OAuth2 authentication + GA4 Data API
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TOKEN_PATH = join(__dirname, '../../.tokens/ga4-token.json');

export class GA4Integration {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/oauth/callback';
        this.oauth2Client = null;
        this.analyticsDataClient = null;
    }

    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    async initialize() {
        if (!this.isConfigured()) {
            console.warn('[GA4] Missing OAuth credentials. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
            return false;
        }

        this.oauth2Client = new google.auth.OAuth2(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );

        try {
            if (existsSync(TOKEN_PATH)) {
                const token = JSON.parse(await readFile(TOKEN_PATH, 'utf8'));
                this.oauth2Client.setCredentials(token);
                this.analyticsDataClient = new BetaAnalyticsDataClient({
                    authClient: this.oauth2Client
                });
                return true;
            }
        } catch (error) {
            console.warn('[GA4] Could not load token:', error.message);
        }

        return false;
    }

    /**
     * Generate OAuth URL for user authorization
     */
    getAuthUrl() {
        if (!this.oauth2Client) {
            throw new Error('GA4 integration not initialized');
        }

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/analytics.readonly'
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
        
        const tokenDir = dirname(TOKEN_PATH);
        if (!existsSync(tokenDir)) {
            await mkdir(tokenDir, { recursive: true });
        }
        
        await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        this.analyticsDataClient = new BetaAnalyticsDataClient({
            authClient: this.oauth2Client
        });
        
        return { success: true, message: 'GA4 authorization complete' };
    }

    /**
     * Run a custom report
     */
    async query(params) {
        if (!this.analyticsDataClient) {
            throw new Error('GA4 not authenticated. Complete OAuth flow first.');
        }

        const {
            propertyId,
            startDate = '7daysAgo',
            endDate = 'today',
            metrics = ['sessions', 'activeUsers', 'screenPageViews'],
            dimensions = [],
            limit = 1000,
            orderBys = []
        } = params;

        try {
            const [response] = await this.analyticsDataClient.runReport({
                property: `properties/${propertyId}`,
                dateRanges: [{ startDate, endDate }],
                metrics: metrics.map(m => ({ name: m })),
                dimensions: dimensions.map(d => ({ name: d })),
                limit,
                orderBys: orderBys.length > 0 ? orderBys : undefined
            });

            return this._formatResponse(response, metrics, dimensions);
        } catch (error) {
            console.error('[GA4] Query error:', error.message);
            throw error;
        }
    }

    /**
     * Get traffic overview
     */
    async getOverview(propertyId, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: [
                'sessions',
                'activeUsers',
                'newUsers',
                'screenPageViews',
                'averageSessionDuration',
                'bounceRate',
                'engagementRate'
            ]
        });
    }

    /**
     * Get traffic by source/medium
     */
    async getTrafficSources(propertyId, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['sessions', 'activeUsers', 'conversions'],
            dimensions: ['sessionSourceMedium'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        });
    }

    /**
     * Get top pages
     */
    async getTopPages(propertyId, limit = 50, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['screenPageViews', 'activeUsers', 'averageSessionDuration'],
            dimensions: ['pagePath', 'pageTitle'],
            limit,
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }]
        });
    }

    /**
     * Get geographic breakdown
     */
    async getGeography(propertyId, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['sessions', 'activeUsers'],
            dimensions: ['country', 'city'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        });
    }

    /**
     * Get device breakdown
     */
    async getDevices(propertyId, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['sessions', 'activeUsers', 'engagementRate'],
            dimensions: ['deviceCategory']
        });
    }

    /**
     * Get landing pages performance
     */
    async getLandingPages(propertyId, limit = 50, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['sessions', 'activeUsers', 'bounceRate', 'averageSessionDuration'],
            dimensions: ['landingPage'],
            limit,
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
        });
    }

    /**
     * Get conversions by event
     */
    async getConversions(propertyId, startDate = '30daysAgo', endDate = 'today') {
        return this.query({
            propertyId,
            startDate,
            endDate,
            metrics: ['eventCount', 'conversions'],
            dimensions: ['eventName'],
            orderBys: [{ metric: { metricName: 'conversions' }, desc: true }]
        });
    }

    /**
     * Compare two date ranges
     */
    async compareRanges(propertyId, range1, range2, metrics) {
        const [data1, data2] = await Promise.all([
            this.query({ propertyId, startDate: range1.start, endDate: range1.end, metrics }),
            this.query({ propertyId, startDate: range2.start, endDate: range2.end, metrics })
        ]);

        const comparison = {};
        for (const metric of metrics) {
            const v1 = data1.totals?.[metric] || 0;
            const v2 = data2.totals?.[metric] || 0;
            const delta = v2 - v1;
            const pctChange = v1 > 0 ? ((delta / v1) * 100).toFixed(2) : 0;
            comparison[metric] = { range1: v1, range2: v2, delta, pctChange: `${pctChange}%` };
        }

        return {
            range1: { start: range1.start, end: range1.end },
            range2: { start: range2.start, end: range2.end },
            comparison
        };
    }

    _formatResponse(response, metrics, dimensions) {
        const rows = (response.rows || []).map(row => {
            const obj = {};
            dimensions.forEach((dim, i) => {
                obj[dim] = row.dimensionValues[i]?.value;
            });
            metrics.forEach((metric, i) => {
                obj[metric] = parseFloat(row.metricValues[i]?.value) || 0;
            });
            return obj;
        });

        // Calculate totals
        const totals = {};
        if (response.totals?.[0]) {
            metrics.forEach((metric, i) => {
                totals[metric] = parseFloat(response.totals[0].metricValues[i]?.value) || 0;
            });
        }

        return {
            rows,
            totals,
            rowCount: response.rowCount || rows.length,
            metadata: response.metadata
        };
    }

    /**
     * Health check for GA4 integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'ga4',
            configured: this.isConfigured(),
            authenticated: !!this.analyticsDataClient,
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            status.message = 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set';
            return status;
        }

        if (!this.analyticsDataClient) {
            status.status = 'not_authenticated';
            status.message = 'OAuth flow not completed';
            return status;
        }

        // GA4 requires a property ID to query, so we can only verify client is initialized
        status.status = 'healthy';
        status.note = 'Client initialized, requires property ID for full validation';

        return status;
    }
}
