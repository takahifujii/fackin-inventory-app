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
            return res.status(400).json({
                status: 'error',
                data: { error: '設定でWeb App URLを登録してください。(Missing X-GAS-URL)' }
            });
        }

        // Construct original options
        const fetchOptions = {
            method: req.method,
            redirect: 'manual', // Prevent header bleed
            headers: {}
        };

        let targetUrl = gasUrl;

        if (req.method === 'GET') {
            const query = new URLSearchParams(req.query).toString();
            if (query) {
                targetUrl += '?' + query;
            }
        } else if (req.method === 'POST') {
            let bodyToSend = req.body;
            if (typeof bodyToSend === 'object') {
                bodyToSend = JSON.stringify(bodyToSend);
            }
            fetchOptions.body = bodyToSend;
            fetchOptions.headers['Content-Type'] = 'text/plain;charset=utf-8';
        }

        console.log(`[Proxy] Forwarding ${req.method} request to GAS...`);
        let response = await fetch(targetUrl, fetchOptions);

        // GAS returns 302 redirect to a script.googleusercontent.com URL with the final payload
        if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
            const redirectUrl = response.headers.get('location');
            console.log(`[Proxy] Following redirect cleanly to: ${redirectUrl.substring(0, 50)}...`);

            // Make a pure GET request with no headers to avoid 404
            response = await fetch(redirectUrl, { method: 'GET' });
        }

        const textData = await response.text();

        let jsonData;
        try {
            jsonData = JSON.parse(textData);
        } catch (e) {
            return res.status(response.status).send(textData);
        }

        /*
         * Normalize image fields for backward compatibility.
         * Older versions of the GAS backend return a comma-separated `photo_urls` string.
         * The frontend expects `photo_meta` array with file_id and absolute URL.
         * If `photo_meta` is missing but `photo_urls` exists, build `photo_meta` on the fly.
         * Use x-forwarded-proto (or default to https) and host to create absolute URLs,
         * so that image links are always HTTPS and avoid mixed-content blocking.
         */
        try {
            if (jsonData && jsonData.status === 'success' && Array.isArray(jsonData.data)) {
                // Determine protocol from header or fallback to https
                const proto =
                    req.headers['x-forwarded-proto'] ||
                    req.protocol ||
                    'https';
                // Determine host from x-forwarded-host or host header
                const host =
                    req.headers['x-forwarded-host'] ||
                    req.headers.host;
                jsonData.data = jsonData.data.map(item => {
                    if (!item.photo_meta && item.photo_urls) {
                        const urls = item.photo_urls
                            .split(',')
                            .map(u => u.trim())
                            .filter(Boolean);
                        const photos = [];
                        for (const u of urls) {
                            // Extract the Drive file ID
                            const match = /id=([^&]+)/.exec(u);
                            const fileId = match ? match[1] : null;
                            if (fileId) {
                                const imageUrl = `${proto}://${host}/api/image/${fileId}`;
                                photos.push({
                                    file_id: fileId,
                                    url: imageUrl,
                                    name: ''
                                });
                            }
                        }
                        if (photos.length) {
                            item.photo_meta = photos;
                        }
                    }
                    return item;
                });
            }
        } catch (e) {
            console.error('[Proxy] Failed to normalize photo metadata:', e);
        }

        res.status(response.status).json(jsonData);

    } catch (error) {
        console.error('[Proxy Error]:', error);
        res.status(500).json({
            status: 'error',
            data: { error: error.message }
        });
    }
});

// Reverse Proxy for Google Drive Images (Bypasses CORP/CORS)
app.get('/api/image/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId) return res.status(400).send('Missing file ID');

        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        // Node 18 fetch natively follows redirects
        const response = await fetch(driveUrl);

        if (!response.ok) {
            console.error(`[Image Proxy] Failed to fetch image ${fileId}: Status ${response.status}`);
            return res.status(response.status).send('Failed to fetch image');
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        res.status(200).send(buffer);

    } catch (error) {
        console.error(`[Image Proxy Error] ${req.params.id}:`, error);
        res.status(500).send('Internal Server Error while proxying image');
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
