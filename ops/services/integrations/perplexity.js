/**
 * Perplexity API Integration
 * Real-time web search with citations
 */

export class PerplexityIntegration {
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        this.baseUrl = 'https://api.perplexity.ai';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Search the web via Perplexity
     * @param {string} query - Search query
     * @param {string} focus - Focus area: web, academic, news, reddit
     * @returns {Promise<Object>} Search results with citations
     */
    async search(query, focus = 'web') {
        if (!this.isConfigured()) {
            throw new Error('Perplexity API key not configured. Set PERPLEXITY_API_KEY in .env');
        }

        const modelMap = {
            web: 'llama-3.1-sonar-large-128k-online',
            academic: 'llama-3.1-sonar-large-128k-online',
            news: 'llama-3.1-sonar-large-128k-online',
            reddit: 'llama-3.1-sonar-large-128k-online'
        };

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelMap[focus] || modelMap.web,
                    messages: [
                        {
                            role: 'system',
                            content: this._getSystemPrompt(focus)
                        },
                        {
                            role: 'user',
                            content: query
                        }
                    ],
                    max_tokens: 4096,
                    temperature: 0.2,
                    return_citations: true,
                    search_recency_filter: focus === 'news' ? 'day' : 'month'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `Perplexity API error: ${response.status}`);
            }

            const data = await response.json();
            return this._formatResponse(data);
        } catch (error) {
            console.error('[Perplexity] Search error:', error.message);
            throw error;
        }
    }

    /**
     * Deep research on a topic with multiple queries
     * @param {string} topic - Research topic
     * @param {string[]} angles - Different angles to research
     * @returns {Promise<Object>} Compiled research results
     */
    async research(topic, angles = []) {
        const queries = angles.length > 0 
            ? angles.map(angle => `${topic} ${angle}`)
            : [topic, `${topic} recent developments`, `${topic} best practices`];

        const results = await Promise.all(
            queries.map(q => this.search(q, 'web').catch(e => ({ error: e.message, query: q })))
        );

        return {
            topic,
            timestamp: new Date().toISOString(),
            findings: results.filter(r => !r.error),
            errors: results.filter(r => r.error)
        };
    }

    /**
     * Competitor analysis search
     * @param {string} competitor - Competitor name/domain
     * @param {string} market - Market/industry
     * @returns {Promise<Object>} Competitor intelligence
     */
    async analyzeCompetitor(competitor, market) {
        const queries = [
            `${competitor} ${market} services pricing`,
            `${competitor} customer reviews reputation`,
            `${competitor} recent news announcements`
        ];

        const results = await Promise.all(
            queries.map(q => this.search(q, 'web').catch(e => ({ error: e.message })))
        );

        return {
            competitor,
            market,
            timestamp: new Date().toISOString(),
            services: results[0],
            reputation: results[1],
            news: results[2]
        };
    }

    _getSystemPrompt(focus) {
        const prompts = {
            web: 'You are a research assistant. Provide accurate, well-cited information. Focus on facts and actionable insights.',
            academic: 'You are an academic research assistant. Prioritize peer-reviewed sources and scholarly content.',
            news: 'You are a news analyst. Focus on recent developments, breaking news, and current events.',
            reddit: 'You are a community insights analyst. Summarize discussions, opinions, and user experiences.'
        };
        return prompts[focus] || prompts.web;
    }

    _formatResponse(data) {
        const choice = data.choices?.[0];
        const message = choice?.message || {};

        return {
            answer: message.content || '',
            citations: data.citations || [],
            model: data.model,
            usage: {
                promptTokens: data.usage?.prompt_tokens,
                completionTokens: data.usage?.completion_tokens,
                totalTokens: data.usage?.total_tokens
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Health check for Perplexity integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'perplexity',
            configured: this.isConfigured(),
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            status.message = 'PERPLEXITY_API_KEY not set';
            return status;
        }

        try {
            const start = Date.now();
            // Lightweight test query
            await this.search('test health check', 'web');
            status.latency = Date.now() - start;
            status.status = 'healthy';
        } catch (error) {
            status.status = 'unhealthy';
            status.error = error.message;
        }

        return status;
    }
}
