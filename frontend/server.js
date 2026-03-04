import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Parse text/plain or JSON bodies with a larger limit for image uploads
app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Proxy endpoint for API requests
app.all('/api', async (req, res) => {
    try {
        let gasUrl = '';
        const b64Url = req.header('x-gas-url-b64');
        if (b64Url) {
            gasUrl = Buffer.from(b64Url, 'base64').toString('utf8');
        } else {
            gasUrl = process.env.VITE_APP_SCRIPT_URL?.trim();
        }

        if (!gasUrl) {
            return res.status(400).json({ status: 'error', data: { error: '設定でWeb App URLを登録してください。(Missing X-GAS-URL)' } });
        }

        // Construct original options
        const fetchOptions = {
            method: req.method,
            redirect: 'follow', // Server-to-server follow redirect is fine
            headers: {}
        };

        let targetUrl = gasUrl;

        if (req.method === 'GET') {
            // Forward GET params
            const query = new URLSearchParams(req.query).toString();
            if (query) {
                targetUrl += '?' + query;
            }
        } else if (req.method === 'POST') {
            // Forward POST payload. It comes in as parsed text or object from express middlewares.
            // But we can just forward it as JSON string like the original client did to GAS.
            let bodyToSend = req.body;
            if (typeof bodyToSend === 'object') {
                bodyToSend = JSON.stringify(bodyToSend);
            }

            fetchOptions.body = bodyToSend;
            fetchOptions.headers['Content-Type'] = 'text/plain;charset=utf-8'; // For GAS simple request format
        }

        console.log(`[Proxy] Forwarding ${req.method} request to GAS...`);
        const response = await fetch(targetUrl, fetchOptions);

        // GAS typically returns JSON in our setup
        const textData = await response.text();

        let jsonData;
        try {
            jsonData = JSON.parse(textData);
        } catch (e) {
            // If it's not JSON, return whatever it is
            return res.status(response.status).send(textData);
        }

        res.status(response.status).json(jsonData);

    } catch (error) {
        console.error('[Proxy Error]:', error);
        res.status(500).json({ status: 'error', data: { error: error.message } });
    }
});

// Serve static React files from dist/ (created by Vite)
app.use(express.static(path.join(__dirname, 'dist')));

// Render index.html for all other routes to support React Router (if used)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
