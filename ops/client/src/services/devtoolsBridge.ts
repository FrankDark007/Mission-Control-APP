// @ts-nocheck

/**
 * DevTools MCP Bridge
 * 
 * Integrates Model Context Protocol (MCP) with Chrome's internal inspection tools.
 * Allows AI agents to autonomously query DOM, monitor console errors, and inspect
 * network requests for real-time debugging capabilities.
 * 
 * Requirements:
 * - Chrome DevTools Protocol access (via extension or Puppeteer backend)
 * - MCP server endpoint for agent communication
 */

export interface DOMNode {
  nodeId: number;
  nodeName: string;
  nodeType: number;
  nodeValue?: string;
  children?: DOMNode[];
  attributes?: Record<string, string>;
}

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  text: string;
  timestamp: number;
  source?: string;
  lineNumber?: number;
}

export interface NetworkRequest {
  requestId: string;
  url: string;
  method: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  timing?: { requestTime: number; responseTime: number };
}

export class DevToolsBridge {
  private isConnected: boolean = false;
  private consoleBuffer: ConsoleMessage[] = [];
  private networkBuffer: NetworkRequest[] = [];
  private domSnapshot: DOMNode | null = null;
  private mcpEndpoint: string = '/api/mcp/devtools';

  /**
   * Initialize connection to DevTools Protocol
   * In browser context, this requires a Chrome extension with debugger permissions
   * In Node context, this uses Puppeteer's CDP session
   */
  async connect(): Promise<boolean> {
    try {
      // Check if running in extension context with chrome.debugger API
      if (typeof chrome !== 'undefined' && (chrome as any).debugger) {
        console.log('[DevTools Bridge] Chrome debugger API detected');
        this.isConnected = true;
        this.startConsoleCapture();
        this.startNetworkCapture();
        return true;
      }

      // Fallback: Connect via backend proxy
      const res = await fetch(`${this.mcpEndpoint}/connect`, { method: 'POST' });
      if (res.ok) {
        this.isConnected = true;
        console.log('[DevTools Bridge] Connected via MCP backend proxy');
        return true;
      }

      console.warn('[DevTools Bridge] No DevTools access available');
      return false;
    } catch (e) {
      console.error('[DevTools Bridge] Connection failed:', e);
      return false;
    }
  }

  /**
   * Query the current DOM tree
   */
  async queryDOM(selector?: string): Promise<DOMNode | null> {
    if (!this.isConnected) {
      console.warn('[DevTools Bridge] Not connected');
      return null;
    }

    try {
      const res = await fetch(`${this.mcpEndpoint}/dom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector })
      });
      const data = await res.json();
      this.domSnapshot = data.root;
      return this.domSnapshot;
    } catch (e) {
      // Fallback: Use document API directly
      if (typeof document !== 'undefined') {
        const el = selector ? document.querySelector(selector) : document.documentElement;
        return this.serializeElement(el);
      }
      return null;
    }
  }

  /**
   * Get captured console messages
   */
  getConsoleMessages(filter?: ConsoleMessage['type']): ConsoleMessage[] {
    if (filter) {
      return this.consoleBuffer.filter(m => m.type === filter);
    }
    return [...this.consoleBuffer];
  }

  /**
   * Get captured network requests
   */
  getNetworkRequests(filter?: { status?: number; method?: string }): NetworkRequest[] {
    let results = [...this.networkBuffer];
    if (filter?.status) {
      results = results.filter(r => r.status === filter.status);
    }
    if (filter?.method) {
      results = results.filter(r => r.method === filter.method);
    }
    return results;
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate(expression: string): Promise<any> {
    if (!this.isConnected) return null;

    try {
      const res = await fetch(`${this.mcpEndpoint}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expression })
      });
      return await res.json();
    } catch (e) {
      // Fallback: Direct eval (only in same-origin context)
      if (typeof window !== 'undefined') {
        return eval(expression);
      }
      return null;
    }
  }

  /**
   * Clear captured buffers
   */
  clearBuffers(): void {
    this.consoleBuffer = [];
    this.networkBuffer = [];
  }

  /**
   * Disconnect from DevTools
   */
  disconnect(): void {
    this.isConnected = false;
    this.clearBuffers();
    this.domSnapshot = null;
  }

  // --- Private Methods ---

  private startConsoleCapture(): void {
    if (typeof window === 'undefined') return;

    const originalConsole = { ...console };
    ['log', 'warn', 'error', 'info'].forEach(type => {
      (console as any)[type] = (...args: any[]) => {
        this.consoleBuffer.push({
          type: type as ConsoleMessage['type'],
          text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
          timestamp: Date.now()
        });
        (originalConsole as any)[type](...args);
      };
    });
  }

  private startNetworkCapture(): void {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const requestId = `req-${Date.now()}`;
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';

      const startTime = performance.now();
      try {
        const response = await originalFetch(input, init);
        this.networkBuffer.push({
          requestId,
          url,
          method,
          status: response.status,
          timing: { requestTime: startTime, responseTime: performance.now() }
        });
        return response;
      } catch (e) {
        this.networkBuffer.push({
          requestId,
          url,
          method,
          status: 0,
          timing: { requestTime: startTime, responseTime: performance.now() }
        });
        throw e;
      }
    };
  }

  private serializeElement(el: Element | null): DOMNode | null {
    if (!el) return null;
    
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes || [])) {
      attrs[attr.name] = attr.value;
    }

    return {
      nodeId: Math.random() * 10000 | 0,
      nodeName: el.nodeName,
      nodeType: el.nodeType,
      attributes: attrs,
      children: Array.from(el.children).map(c => this.serializeElement(c)).filter(Boolean) as DOMNode[]
    };
  }
}

export const devtoolsBridge = new DevToolsBridge();
