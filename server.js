// Simple Node.js proxy server to handle CORS for Azure DevOps API
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

// MIME types for serving static files
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Handle ADO API proxy requests
    if (req.url.startsWith('/api/ado/')) {
        handleAdoProxy(req, res);
        return;
    }

    // Serve static files
    serveStaticFile(req, res);
});

function handleAdoProxy(req, res) {
    // Extract the actual ADO URL from the request
    const adoUrl = req.url.replace('/api/ado/', '');
    
    // Get authorization header from request
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authorization header required' }));
        return;
    }

    // Make request to Azure DevOps
    const options = {
        method: req.method,
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    https.get(adoUrl, options, (adoRes) => {
        let data = '';

        adoRes.on('data', (chunk) => {
            data += chunk;
        });

        adoRes.on('end', () => {
            // Add CORS headers
            res.writeHead(adoRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            });
            res.end(data);
        });
    }).on('error', (error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    });
}

function serveStaticFile(req, res) {
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

server.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║  ADO Project Manager Server Running                        ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);
    console.log(`  🌐 Server: http://localhost:${PORT}`);
    console.log(`  📁 Serving files from: ${__dirname}`);
    console.log(`  🔄 Proxying ADO API requests\n`);
    console.log(`  Press Ctrl+C to stop the server\n`);
});
