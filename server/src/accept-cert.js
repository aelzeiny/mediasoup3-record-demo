/**
 * This script opens a browser to visit the WebSocket server's URL
 * to allow the user to accept the self-signed certificate.
 */
const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Get the SSL certificate paths
const sslDir = path.join(__dirname, '..', 'ssl');
const certPath = path.join(sslDir, 'server.crt');
const keyPath = path.join(sslDir, 'server.key');

// Create a simple HTTPS server that uses the same cert as the WebSocket server
const options = {
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath)
};

const server = https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end(`
    <html>
      <head>
        <title>WebSocket Certificate Trust</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .info { background: #f0f0f0; padding: 15px; border-radius: 5px; }
          .success { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>WebSocket Certificate Setup</h1>
        <div class="info">
          <p>This page is served using the same self-signed certificate that the WebSocket server uses.</p>
          <p>By accessing this page successfully (with https), your browser has trusted this certificate.</p>
          <p>Now you should be able to make WebSocket connections to the server.</p>
          <p class="success">Certificate has been trusted. You can close this page and try your application.</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Certificate trust server running at https://localhost:${PORT}`);
  console.log('Opening browser to accept the self-signed certificate...');
  
  // Open the browser to this page (platform-specific)
  let command;
  switch (process.platform) {
    case 'darwin':  // MacOS
      command = `open https://localhost:${PORT}`;
      break;
    case 'win32':   // Windows
      command = `start https://localhost:${PORT}`;
      break;
    default:        // Linux and others
      command = `xdg-open https://localhost:${PORT}`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.error('Failed to open browser automatically:', error);
      console.log(`Please manually open https://localhost:${PORT} in your browser.`);
    }
  });
});