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
            redirect: 'manual', // Do not follow automatically to prevent header bleed bugs in Node native fetch
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

            // IMPORTANT: Make a pure GET request with NO headers to prevent Google 404 rejections
            response = await fetch(redirectUrl, {
                method: 'GET'
            });
        }

        const textData = await response.text();

        let jsonData;
        try {
            jsonData = JSON.parse(textData);
        } catch (e) {
            // If it's not JSON, return whatever it is
            return res.status(response.status).send(textData);
        }

        /*
         * Normalize image fields for backward compatibility.
         *
         * Older versions of the GAS backend return a comma-separated
         * `photo_urls` string. The newer frontend expects a `photo_meta`
         * array, where each element contains a Google Drive `file_id`
         * and a proxied URL (`/api/image/<file_id>`). If `photo_meta` is
         * missing but `photo_urls` is present, extract the file IDs from
         * each URL and build a `photo_meta` array on the fly. This allows
         * the frontend to display images without requiring changes to the
         * GAS backend or the data schema.
         */
        try {
            if (jsonData && jsonData.status === 'success' && Array.isArray(jsonData.data)) {
                jsonData.data = jsonData.data.map(item => {
                    if (!item.photo_meta && item.photo_urls) {
                        const urls = item.photo_urls.split(',').map(u => u.trim()).filter(Boolean);
                        const photos = [];
                        for (const u of urls) {
                            // Extract the Drive file ID from patterns like
                            // https://drive.google.com/uc?id=FILE_ID or
                            // https://drive.google.com/uc?export=view&id=FILE_ID
                            const match = /id=([^&]+)/.exec(u);
                            const fileId = match ? match[1] : null;
                            if (fileId) {
                                photos.push({
                                    file_id: fileId,
                                    url: `/api/image/${fileId}`,
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
        res.status(500).json({ status: 'error', data: { error: error.message } });
    }
});

// Reverse Proxy for Google Drive Images (Bypasses Browser CORP/CORS restrictions entirely)
app.get('/api/image/:id', async (req, res) => {
    try {
        const fileId = req.params.id;
        if (!fileId) return res.status(400).send('Missing file ID');

        const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        // Node 18 fetch natively follows redirects up to 20 times by default
        const response = await fetch(driveUrl);

        if (!response.ok) {
            console.error(`[Image Proxy] Failed to fetch image ${fileId}: Status ${response.status}`);
            return res.status(response.status).send('Failed to fetch image');
        }

        // Forward content-type and cache instructions
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache aggressively for 1 year
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // Explicitly authorize usage

        // Convert web stream to buffer and send
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
