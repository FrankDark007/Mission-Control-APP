/**
 * Mission Control Integrations
 * Central export for all external service integrations
 */

import { PerplexityIntegration } from './perplexity.js';
import { GSCIntegration } from './gsc.js';
import { GA4Integration } from './ga4.js';
import { AhrefsIntegration } from './ahrefs.js';
import { RefractIntegration } from './refract.js';
import { SERPIntegration } from './serp.js';

export class Integrations {
    constructor() {
        this.perplexity = new PerplexityIntegration();
        this.gsc = new GSCIntegration();
        this.ga4 = new GA4Integration();
        this.ahrefs = new AhrefsIntegration();
        this.refract = new RefractIntegration();
        this.serp = new SERPIntegration();
        
        this._initialized = false;
    }

    /**
     * Initialize all integrations that require OAuth or async setup
     */
    async initialize() {
        const results = {
            perplexity: this.perplexity.isConfigured(),
            ahrefs: this.ahrefs.isConfigured(),
            refract: this.refract.isConfigured(),
            serp: this.serp.isConfigured(),
            gsc: false,
            ga4: false
        };

        // Initialize OAuth-based integrations
        try {
            results.gsc = await this.gsc.initialize();
        } catch (error) {
            console.warn('[Integrations] GSC init failed:', error.message);
        }

        try {
            results.ga4 = await this.ga4.initialize();
        } catch (error) {
            console.warn('[Integrations] GA4 init failed:', error.message);
        }

        this._initialized = true;
        return results;
    }

    /**
     * Get status of all integrations
     */
    getStatus() {
        return {
            initialized: this._initialized,
            services: {
                perplexity: {
                    configured: this.perplexity.isConfigured(),
                    requiresOAuth: false
                },
                gsc: {
                    configured: this.gsc.isConfigured(),
                    requiresOAuth: true,
                    authenticated: !!this.gsc.webmasters
                },
                ga4: {
                    configured: this.ga4.isConfigured(),
                    requiresOAuth: true,
                    authenticated: !!this.ga4.analyticsDataClient
                },
                ahrefs: {
                    configured: this.ahrefs.isConfigured(),
                    requiresOAuth: false,
                    note: this.ahrefs.isConfigured() ? null : 'Using mock data'
                },
                refract: {
                    configured: this.refract.isConfigured(),
                    requiresOAuth: false,
                    note: this.refract.isConfigured() ? null : 'Using built-in SVG generation'
                },
                serp: {
                    configured: this.serp.isConfigured(),
                    requiresOAuth: false,
                    mode: this.serp.apiProvider
                }
            }
        };
    }

    /**
     * Get OAuth URLs for services that need authorization
     */
    getOAuthUrls() {
        const urls = {};
        
        if (this.gsc.isConfigured() && !this.gsc.webmasters) {
            urls.gsc = this.gsc.getAuthUrl();
        }
        
        if (this.ga4.isConfigured() && !this.ga4.analyticsDataClient) {
            urls.ga4 = this.ga4.getAuthUrl();
        }
        
        return urls;
    }

    /**
     * Handle OAuth callback
     */
    async handleOAuthCallback(service, code) {
        switch (service) {
            case 'gsc':
                return this.gsc.handleCallback(code);
            case 'ga4':
                return this.ga4.handleCallback(code);
            default:
                throw new Error(`Unknown OAuth service: ${service}`);
        }
    }

    /**
     * Run health checks on all integrations
     * @returns {Promise<Object>} Aggregated health status
     */
    async healthCheck() {
        const checks = await Promise.allSettled([
            this.perplexity.healthCheck(),
            this.gsc.healthCheck(),
            this.ga4.healthCheck(),
            this.ahrefs.healthCheck(),
            this.refract.healthCheck(),
            this.serp.healthCheck()
        ]);

        const services = {};
        const serviceNames = ['perplexity', 'gsc', 'ga4', 'ahrefs', 'refract', 'serp'];

        checks.forEach((result, index) => {
            const name = serviceNames[index];
            if (result.status === 'fulfilled') {
                services[name] = result.value;
            } else {
                services[name] = {
                    service: name,
                    status: 'error',
                    error: result.reason?.message || 'Health check failed',
                    checkedAt: new Date().toISOString()
                };
            }
        });

        // Calculate overall health
        const statuses = Object.values(services).map(s => s.status);
        const healthyCount = statuses.filter(s => s === 'healthy').length;
        const configuredCount = statuses.filter(s => s !== 'not_configured').length;
        const unhealthyCount = statuses.filter(s => s === 'unhealthy' || s === 'error').length;

        let overall = 'healthy';
        if (unhealthyCount > 0) {
            overall = unhealthyCount === configuredCount ? 'unhealthy' : 'degraded';
        } else if (configuredCount === 0) {
            overall = 'not_configured';
        }

        return {
            overall,
            summary: {
                healthy: healthyCount,
                configured: configuredCount,
                total: serviceNames.length
            },
            services,
            checkedAt: new Date().toISOString()
        };
    }
}

// Export individual integrations for direct access
export { PerplexityIntegration } from './perplexity.js';
export { GSCIntegration } from './gsc.js';
export { GA4Integration } from './ga4.js';
export { AhrefsIntegration } from './ahrefs.js';
export { RefractIntegration } from './refract.js';
export { SERPIntegration } from './serp.js';
