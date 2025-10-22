#!/usr/bin/env node

/**
 * SGX Enclave Entry Point for Shield Validator
 *
 * This script runs inside the SGX enclave and provides a simple
 * HTTP server that validates transactions.
 */

const http = require('http');
const { Shield } = require('../dist/index.js');

const shield = new Shield();
const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      environment: 'SGX',
      supportedYields: shield.getSupportedYieldIds()
    }));
    return;
  }

  // Validation endpoint
  if (req.method === 'POST' && req.url === '/validate') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const request = JSON.parse(body);
        const result = shield.validate(request);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          isValid: false,
          reason: 'Invalid request',
          error: error.message
        }));
      }
    });

    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Shield SGX validator listening on port ${PORT}`);
  console.log(`Supported yield IDs: ${shield.getSupportedYieldIds().join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
