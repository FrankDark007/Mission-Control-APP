#!/usr/bin/env node
import { createInterface } from 'readline';
import http from 'http';

const rl = createInterface({ input: process.stdin });
const API_BASE = 'http://localhost:3001';

const tools = [
  { name: 'ping', description: 'Test Mission Control connection', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_status', description: 'Get Mission Control server status and integration health', inputSchema: { type: 'object', properties: {} } },
  { name: 'call_gemini', description: 'Call Gemini AI for text generation', inputSchema: { type: 'object', properties: { prompt: { type: 'string', description: 'The prompt to send to Gemini' }, model: { type: 'string', description: 'Model to use (default: gemini-pro)' } }, required: ['prompt'] } },
  { name: 'call_perplexity', description: 'Search the web using Perplexity AI', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
  { name: 'check_serp', description: 'Check Google search rankings for a keyword', inputSchema: { type: 'object', properties: { keyword: { type: 'string', description: 'Keyword to check' }, domain: { type: 'string', description: 'Domain to find in results' }, location: { type: 'string', description: 'Location for local results' } }, required: ['keyword'] } },
  { name: 'get_gsc_data', description: 'Get Google Search Console data', inputSchema: { type: 'object', properties: { siteUrl: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, dimensions: { type: 'array', items: { type: 'string' } } }, required: ['siteUrl'] } },
  { name: 'get_analytics', description: 'Get Google Analytics 4 data', inputSchema: { type: 'object', properties: { propertyId: { type: 'string' }, metrics: { type: 'array', items: { type: 'string' } }, dimensions: { type: 'array', items: { type: 'string' } }, startDate: { type: 'string' }, endDate: { type: 'string' } }, required: ['propertyId'] } },
  { name: 'get_ahrefs_data', description: 'Get Ahrefs SEO data for a domain', inputSchema: { type: 'object', properties: { target: { type: 'string', description: 'Domain to analyze' }, mode: { type: 'string', description: 'Analysis mode: overview, backlinks, keywords' } }, required: ['target'] } },
  { name: 'generate_location_page', description: 'Generate SEO-optimized location service page content', inputSchema: { type: 'object', properties: { city: { type: 'string' }, state: { type: 'string' }, service: { type: 'string', description: 'Service type (e.g., water-damage-restoration)' } }, required: ['city', 'state'] } },
  { name: 'generate_blog_post', description: 'Generate SEO blog post content', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } }, wordCount: { type: 'number' } }, required: ['topic'] } },
  { name: 'generate_svg', description: 'Generate SVG graphics using Refract', inputSchema: { type: 'object', properties: { prompt: { type: 'string', description: 'Description of the SVG to generate' }, style: { type: 'string', description: 'Style: icon, illustration, animation' } }, required: ['prompt'] } },
  { name: 'spawn_agent', description: 'Spawn a Claude Code agent for autonomous tasks', inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Task description for the agent' }, workdir: { type: 'string', description: 'Working directory' }, autopilot: { type: 'boolean', description: 'Enable auto-pilot mode' } }, required: ['task'] } },
  { name: 'get_agent_status', description: 'Get status of a running agent', inputSchema: { type: 'object', properties: { agentId: { type: 'string' } }, required: ['agentId'] } },
  { name: 'list_agents', description: 'List all active agents', inputSchema: { type: 'object', properties: {} } }
];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function apiCall(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port || 3001,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function handleTool(name, args) {
  try {
    switch (name) {
      case 'ping':
        const health = await apiCall('/api/health');
        return `Mission Control is running! ${JSON.stringify(health)}`;
      
      case 'get_status':
        const status = await apiCall('/api/integrations/status');
        return JSON.stringify(status, null, 2);
      
      case 'call_gemini':
        const geminiRes = await apiCall('/api/ai/generate', 'POST', { prompt: args.prompt, model: args.model || 'gemini-pro' });
        return geminiRes.response || JSON.stringify(geminiRes);
      
      case 'call_perplexity':
        const perplexityRes = await apiCall('/api/integrations/perplexity/search', 'POST', { query: args.query });
        return perplexityRes.answer || JSON.stringify(perplexityRes);
      
      case 'check_serp':
        const serpRes = await apiCall('/api/integrations/serp/check', 'POST', { keyword: args.keyword, domain: args.domain, location: args.location });
        return JSON.stringify(serpRes, null, 2);
      
      case 'get_gsc_data':
        const gscRes = await apiCall('/api/integrations/gsc/query', 'POST', args);
        return JSON.stringify(gscRes, null, 2);
      
      case 'get_analytics':
        const gaRes = await apiCall('/api/integrations/ga4/query', 'POST', args);
        return JSON.stringify(gaRes, null, 2);
      
      case 'get_ahrefs_data':
        const ahrefsRes = await apiCall('/api/integrations/ahrefs/overview', 'POST', { target: args.target, mode: args.mode || 'overview' });
        return JSON.stringify(ahrefsRes, null, 2);
      
      case 'generate_location_page':
        const locRes = await apiCall('/api/content/location-page', 'POST', args);
        return locRes.content || JSON.stringify(locRes);
      
      case 'generate_blog_post':
        const blogRes = await apiCall('/api/content/blog-post', 'POST', args);
        return blogRes.content || JSON.stringify(blogRes);
      
      case 'generate_svg':
        const svgRes = await apiCall('/api/integrations/refract/generate', 'POST', { prompt: args.prompt, style: args.style || 'icon' });
        return svgRes.svg || JSON.stringify(svgRes);
      
      case 'spawn_agent':
        const agentRes = await apiCall('/api/agents/spawn', 'POST', args);
        return JSON.stringify(agentRes, null, 2);
      
      case 'get_agent_status':
        const agentStatus = await apiCall(`/api/agents/${args.agentId}/status`);
        return JSON.stringify(agentStatus, null, 2);
      
      case 'list_agents':
        const agents = await apiCall('/api/agents');
        return JSON.stringify(agents, null, 2);
      
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e) {
    return `Error: ${e.message}. Make sure Mission Control server is running on port 3001.`;
  }
}

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);
    const { id, method, params } = msg;

    switch (method) {
      case 'initialize':
        send({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mission-control', version: '6.0.0' } } });
        break;

      case 'notifications/initialized':
        break;

      case 'tools/list':
        send({ jsonrpc: '2.0', id, result: { tools } });
        break;

      case 'tools/call':
        const result = await handleTool(params.name, params.arguments || {});
        send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result }] } });
        break;

      case 'resources/list':
        send({ jsonrpc: '2.0', id, result: { resources: [] } });
        break;

      case 'prompts/list':
        send({ jsonrpc: '2.0', id, result: { prompts: [] } });
        break;

      default:
        if (id) send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (e) {}
});
