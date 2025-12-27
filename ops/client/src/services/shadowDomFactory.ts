
/**
 * Web Components (Shadow DOM) Factory
 * 
 * Creates isolated UI "sandboxes" for agents to safely expand the dashboard.
 * Shadow DOM ensures custom widgets or charts injected by agents are 
 * styling-encapsulated and cannot break the main Mission Control layout.
 * 
 * Use Cases:
 * - Agent-generated visualizations
 * - Dynamic plugin widgets
 * - Isolated third-party integrations
 * - Safe CSS experimentation
 */

export interface SandboxConfig {
  tagName: string;
  styles?: string;
  template?: string;
  shadowMode?: 'open' | 'closed';
  observedAttributes?: string[];
}

export interface SandboxInstance {
  element: HTMLElement;
  shadowRoot: ShadowRoot;
  update: (content: string | HTMLElement) => void;
  setStyle: (css: string) => void;
  destroy: () => void;
}

// Registry of custom elements to prevent duplicate definitions
const registeredElements = new Set<string>();

/**
 * Create a sandboxed Web Component with Shadow DOM isolation
 */
export function createSandbox(config: SandboxConfig): typeof HTMLElement {
  const { tagName, styles = '', template = '', shadowMode = 'open', observedAttributes = [] } = config;

  // Validate tag name
  if (!tagName.includes('-')) {
    throw new Error('Custom element tag names must contain a hyphen (e.g., "agent-widget")');
  }

  // Check if already registered
  if (registeredElements.has(tagName)) {
    console.warn(`[ShadowDOM] Element "${tagName}" already registered`);
    return customElements.get(tagName) as typeof HTMLElement;
  }

  class SandboxElement extends HTMLElement {
    private _shadowRoot: ShadowRoot;
    private _styleElement: HTMLStyleElement;
    private _contentContainer: HTMLDivElement;

    static get observedAttributes() {
      return observedAttributes;
    }

    constructor() {
      super();
      
      // Create Shadow DOM
      this._shadowRoot = this.attachShadow({ mode: shadowMode });
      
      // Create style container
      this._styleElement = document.createElement('style');
      this._styleElement.textContent = this.getDefaultStyles() + styles;
      
      // Create content container
      this._contentContainer = document.createElement('div');
      this._contentContainer.className = 'sandbox-content';
      this._contentContainer.innerHTML = template;
      
      // Assemble Shadow DOM
      this._shadowRoot.appendChild(this._styleElement);
      this._shadowRoot.appendChild(this._contentContainer);
    }

    connectedCallback() {
      this.dispatchEvent(new CustomEvent('sandbox-connected', { 
        bubbles: true, 
        composed: true 
      }));
    }

    disconnectedCallback() {
      this.dispatchEvent(new CustomEvent('sandbox-disconnected', { 
        bubbles: true, 
        composed: true 
      }));
    }

    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
      this.dispatchEvent(new CustomEvent('sandbox-attribute-changed', {
        bubbles: true,
        composed: true,
        detail: { name, oldValue, newValue }
      }));
    }

    /**
     * Update the content inside the sandbox
     */
    setContent(content: string | HTMLElement) {
      if (typeof content === 'string') {
        this._contentContainer.innerHTML = content;
      } else {
        this._contentContainer.innerHTML = '';
        this._contentContainer.appendChild(content);
      }
    }

    /**
     * Add or replace styles
     */
    setStyles(css: string) {
      this._styleElement.textContent = this.getDefaultStyles() + css;
    }

    /**
     * Append additional styles
     */
    addStyles(css: string) {
      this._styleElement.textContent += css;
    }

    /**
     * Query elements within the shadow DOM
     */
    query<T extends Element = Element>(selector: string): T | null {
      return this._shadowRoot.querySelector<T>(selector);
    }

    /**
     * Query all elements within the shadow DOM
     */
    queryAll<T extends Element = Element>(selector: string): NodeListOf<T> {
      return this._shadowRoot.querySelectorAll<T>(selector);
    }

    /**
     * Get the shadow root (if mode is 'open')
     */
    getShadowRoot(): ShadowRoot {
      return this._shadowRoot;
    }

    private getDefaultStyles(): string {
      return `
        :host {
          display: block;
          contain: content;
        }
        .sandbox-content {
          width: 100%;
          height: 100%;
        }
      `;
    }
  }

  // Register the custom element
  customElements.define(tagName, SandboxElement);
  registeredElements.add(tagName);

  return SandboxElement;
}

/**
 * Create and mount a sandbox instance to the DOM
 */
export function mountSandbox(
  tagName: string,
  container: HTMLElement,
  config?: Partial<SandboxConfig>
): SandboxInstance {
  // Ensure element is registered
  if (!registeredElements.has(tagName)) {
    createSandbox({ tagName, ...config });
  }

  // Create instance
  const element = document.createElement(tagName) as any;
  container.appendChild(element);

  return {
    element,
    shadowRoot: element.getShadowRoot(),
    update: (content) => element.setContent(content),
    setStyle: (css) => element.setStyles(css),
    destroy: () => {
      element.remove();
    }
  };
}

/**
 * Pre-built sandbox templates for common use cases
 */
export const SandboxTemplates = {
  /**
   * Chart container with loading state
   */
  chart: (title: string = 'Chart') => ({
    tagName: 'agent-chart',
    template: `
      <div class="chart-wrapper">
        <h3 class="chart-title">${title}</h3>
        <div class="chart-container">
          <slot></slot>
        </div>
      </div>
    `,
    styles: `
      .chart-wrapper {
        padding: 1rem;
        background: #1a1a1a;
        border-radius: 1rem;
        border: 1px solid #333;
      }
      .chart-title {
        font-size: 0.75rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #666;
        margin: 0 0 1rem 0;
      }
      .chart-container {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `
  }),

  /**
   * Code preview with syntax highlighting placeholder
   */
  code: (language: string = 'javascript') => ({
    tagName: 'agent-code',
    template: `
      <div class="code-wrapper">
        <div class="code-header">
          <span class="code-lang">${language}</span>
          <button class="code-copy">Copy</button>
        </div>
        <pre class="code-content"><code><slot></slot></code></pre>
      </div>
    `,
    styles: `
      .code-wrapper {
        background: #0d0d0d;
        border-radius: 0.75rem;
        overflow: hidden;
        font-family: 'JetBrains Mono', monospace;
      }
      .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 1rem;
        background: #1a1a1a;
        border-bottom: 1px solid #333;
      }
      .code-lang {
        font-size: 0.625rem;
        font-weight: 800;
        text-transform: uppercase;
        color: #4a9eff;
      }
      .code-copy {
        font-size: 0.625rem;
        padding: 0.25rem 0.5rem;
        background: #333;
        border: none;
        border-radius: 0.25rem;
        color: #999;
        cursor: pointer;
      }
      .code-copy:hover {
        background: #444;
        color: #fff;
      }
      .code-content {
        margin: 0;
        padding: 1rem;
        overflow-x: auto;
        font-size: 0.875rem;
        line-height: 1.5;
        color: #e0e0e0;
      }
    `
  }),

  /**
   * Alert/notification widget
   */
  alert: (type: 'info' | 'warn' | 'error' | 'success' = 'info') => {
    const colors = {
      info: { bg: '#1a365d', border: '#3182ce', text: '#90cdf4' },
      warn: { bg: '#744210', border: '#d69e2e', text: '#faf089' },
      error: { bg: '#742a2a', border: '#e53e3e', text: '#feb2b2' },
      success: { bg: '#22543d', border: '#38a169', text: '#9ae6b4' }
    };
    const c = colors[type];

    return {
      tagName: `agent-alert-${type}`,
      template: `<div class="alert"><slot></slot></div>`,
      styles: `
        .alert {
          padding: 1rem;
          background: ${c.bg};
          border-left: 4px solid ${c.border};
          color: ${c.text};
          font-size: 0.875rem;
          border-radius: 0 0.5rem 0.5rem 0;
        }
      `
    };
  },

  /**
   * Generic container for agent-injected content
   */
  container: (id: string) => ({
    tagName: `agent-container-${id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    template: `<div class="container"><slot></slot></div>`,
    styles: `
      .container {
        padding: 1rem;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 1rem;
      }
    `
  })
};

/**
 * Register all pre-built templates
 */
export function registerBuiltinSandboxes(): void {
  // Register alert types
  ['info', 'warn', 'error', 'success'].forEach(type => {
    const config = SandboxTemplates.alert(type as any);
    if (!registeredElements.has(config.tagName)) {
      createSandbox(config);
    }
  });

  console.log('[ShadowDOM] Built-in sandboxes registered');
}
