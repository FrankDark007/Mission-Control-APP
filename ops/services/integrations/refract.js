/**
 * Refract AI Integration
 * SVG and animation generation
 */

export class RefractIntegration {
    constructor() {
        this.apiKey = process.env.REFRACT_API_KEY;
        this.baseUrl = process.env.REFRACT_API_URL || 'https://api.refract.dev';
    }

    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Generate SVG graphic or animation
     */
    async generate(params) {
        const { description, style = 'icon', colors = [], animated = false } = params;

        if (!this.isConfigured()) {
            // Return generated SVG using built-in generation
            return this._generateBuiltIn(params);
        }

        try {
            const response = await fetch(`${this.baseUrl}/v1/generate/svg`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: this._buildPrompt(description, style, animated),
                    style,
                    colors: colors.length > 0 ? colors : this._getDefaultColors(),
                    animated,
                    format: 'svg'
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || `Refract API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                svg: data.svg,
                metadata: data.metadata,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[Refract] Generation error:', error.message);
            return this._generateBuiltIn(params);
        }
    }

    /**
     * Generate animated infographic
     */
    async generateInfographic(params) {
        const { title, data, style = 'bar' } = params;
        
        return this.generate({
            description: `Infographic: ${title}. Data visualization as ${style} chart. Data points: ${JSON.stringify(data)}`,
            style: 'infographic',
            animated: true
        });
    }

    /**
     * Generate icon set
     */
    async generateIconSet(params) {
        const { icons, style = 'outline', size = 24 } = params;
        
        const results = await Promise.all(
            icons.map(icon => this.generate({
                description: `${icon} icon, ${style} style, ${size}px`,
                style: 'icon',
                animated: false
            }))
        );

        return {
            icons: results.map((r, i) => ({ name: icons[i], svg: r.svg })),
            style,
            size
        };
    }

    _buildPrompt(description, style, animated) {
        const styleGuides = {
            icon: 'Clean, minimal icon. Single color paths. Stroke-based design.',
            illustration: 'Detailed vector illustration. Multiple colors. Gradient fills allowed.',
            animation: 'Animated SVG with CSS keyframes. Smooth transitions. Loop-ready.',
            infographic: 'Data visualization. Clean typography. Chart elements with labels.'
        };

        return `${description}. ${styleGuides[style] || styleGuides.icon}${animated ? ' Include CSS animation.' : ''}`;
    }

    _getDefaultColors() {
        // Flood Doctor brand colors
        return ['#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE'];
    }

    /**
     * Built-in SVG generation for when Refract API is unavailable
     */
    _generateBuiltIn(params) {
        const { description, style = 'icon', colors = [], animated = false } = params;
        const brandColors = colors.length > 0 ? colors : this._getDefaultColors();
        
        // Generate based on style
        let svg;
        switch (style) {
            case 'icon':
                svg = this._generateIcon(description, brandColors, animated);
                break;
            case 'illustration':
                svg = this._generateIllustration(description, brandColors, animated);
                break;
            case 'animation':
                svg = this._generateAnimation(description, brandColors);
                break;
            default:
                svg = this._generateIcon(description, brandColors, animated);
        }

        return {
            svg,
            metadata: {
                generator: 'built-in',
                style,
                animated,
                description
            },
            timestamp: new Date().toISOString()
        };
    }

    _generateIcon(description, colors, animated) {
        const primary = colors[0] || '#1E3A8A';
        const animationCSS = animated ? `
            <style>
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                .animated { animation: pulse 2s ease-in-out infinite; }
            </style>` : '';

        // Water-related icon for restoration company
        if (description.toLowerCase().includes('water') || description.toLowerCase().includes('drop')) {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${animationCSS}
                <path class="${animated ? 'animated' : ''}" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>`;
        }

        // Home/house icon
        if (description.toLowerCase().includes('home') || description.toLowerCase().includes('house')) {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${animationCSS}
                <path class="${animated ? 'animated' : ''}" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>`;
        }

        // Shield/protection icon
        if (description.toLowerCase().includes('protect') || description.toLowerCase().includes('shield')) {
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                ${animationCSS}
                <path class="${animated ? 'animated' : ''}" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>`;
        }

        // Default checkmark/success icon
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${primary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${animationCSS}
            <circle class="${animated ? 'animated' : ''}" cx="12" cy="12" r="10"/>
            <polyline points="9 12 11 14 15 10"/>
        </svg>`;
    }

    _generateIllustration(description, colors, animated) {
        const [primary, secondary, tertiary] = colors;
        const animationCSS = animated ? `
            <style>
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                .float { animation: float 3s ease-in-out infinite; }
            </style>` : '';

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150">
            ${animationCSS}
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${primary};stop-opacity:1"/>
                    <stop offset="100%" style="stop-color:${secondary || primary};stop-opacity:1"/>
                </linearGradient>
            </defs>
            <rect x="20" y="60" width="160" height="80" rx="10" fill="url(#grad1)" opacity="0.2"/>
            <circle class="${animated ? 'float' : ''}" cx="100" cy="50" r="30" fill="${primary}"/>
            <text x="100" y="110" text-anchor="middle" font-family="system-ui" font-size="12" fill="${primary}">
                ${description.slice(0, 30)}
            </text>
        </svg>`;
    }

    _generateAnimation(description, colors) {
        const [primary, secondary] = colors;

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <style>
                @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { r: 8; } 50% { r: 12; } }
                .spinner { animation: rotate 2s linear infinite; transform-origin: 50% 50%; }
                .dot { animation: pulse 1s ease-in-out infinite; }
            </style>
            <g class="spinner">
                <circle cx="50" cy="20" r="8" fill="${primary}" class="dot"/>
                <circle cx="80" cy="50" r="8" fill="${secondary || primary}" class="dot" style="animation-delay: 0.2s"/>
                <circle cx="50" cy="80" r="8" fill="${primary}" class="dot" style="animation-delay: 0.4s"/>
                <circle cx="20" cy="50" r="8" fill="${secondary || primary}" class="dot" style="animation-delay: 0.6s"/>
            </g>
        </svg>`;
    }

    /**
     * Health check for Refract integration
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        const status = {
            service: 'refract',
            configured: this.isConfigured(),
            status: 'unknown',
            latency: null,
            checkedAt: new Date().toISOString()
        };

        if (!this.isConfigured()) {
            status.status = 'not_configured';
            status.message = 'REFRACT_API_KEY not set';
            status.fallback = 'Using built-in SVG generation';
            return status;
        }

        try {
            const start = Date.now();
            // Quick API health check
            const response = await fetch(`${this.baseUrl}/v1/health`, {
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
            status.fallback = 'Using built-in SVG generation';
        }

        return status;
    }
}
