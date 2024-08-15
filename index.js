import http from 'http';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const hostname = '127.0.0.1';
const port = 80;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer((req, res) => {
    // Check if the request is for the root URL
    if (req.url === '/') {
        // Set the content type to HTML
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');

        // Read the HTML file and send it as the response
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.statusCode = 500;
                res.end('Error loading HTML file');
            } else {
                res.end(data);
            }
        });
    } else {
        // Respond with a 404 for any other routes
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404: Page Not Found');
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});