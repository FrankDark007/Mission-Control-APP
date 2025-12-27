#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = spawn('node', [join(__dirname, 'server.js')], {
  env: { ...process.env, NODE_ENV: 'production', MCP_STDIO: 'true' },
  stdio: ['pipe', 'pipe', 'ignore']
});

process.stdin.pipe(server.stdin);
server.stdout.pipe(process.stdout);
process.on('exit', () => server.kill());
