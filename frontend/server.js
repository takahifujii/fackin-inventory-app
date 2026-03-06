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
         * Handles messy cases: photo_meta may be stringified JSON or objects,
         * photo_urls may be JSON array or comma-separated string, and
         * file_id may have extra quotes or spaces.
         */
        try {
            if (jsonData && jsonData.status === 'success' && Array.isArray(jsonData.data)) {
                // Determine protocol and host, preferring proxy headers when available; default to https
                const proto =
                    req.headers['x-forwarded-proto'] ||
                    req.protocol ||
                    'https';
                const host =
                    req.headers['x-forwarded-host'] ||
                    req.headers.host;

                /**
                 * Normalize a raw file ID by stripping quotes, whitespace,
                 * and other spurious characters. Returns an empty string if nothing remains.
                 *
                 * @param {any} rawId
                 * @returns {string}
                 */
                const normalizeFileId = (rawId) => {
                    return String(rawId || '')
                        .replace(/"/g, '')
                        .replace(/\s+/g, '')
                        .trim();
                };

                jsonData.data = jsonData.data.map(item => {
                    let photos = [];

                    /**
                     * Given a raw ID or object, normalize it and push onto photos array.
                     * Ensures URL uses the current host and protocol.
                     */
                    const pushPhoto = (rawId, name = '') => {
                        const fid = normalizeFileId(rawId);
                        if (!fid) return;
                        photos.push({
                            file_id: fid,
                            url: `${proto}://${host}/api/image/${fid}`,
                            name: name || ''
                        });
                    };

                    // 1) Handle photo_meta when it exists
                    if (item.photo_meta) {
                        let metaArr = item.photo_meta;
                        // If metaArr is a string (e.g. JSON encoded), attempt to parse
                        if (typeof metaArr === 'string') {
                            try {
                                const parsed = JSON.parse(metaArr);
                                metaArr = parsed;
                            } catch (e) {
                                // leave as-is if not JSON; we'll handle other cases below
                            }
                        }
                        // If not an array, wrap into an array for uniform processing
                        if (!Array.isArray(metaArr)) {
                            metaArr = [metaArr];
                        }

                        for (let pm of metaArr) {
                            // If pm is a string, attempt to parse JSON; otherwise treat as ID or URL
                            if (typeof pm === 'string') {
                                let obj = null;
                                try {
                                    obj = JSON.parse(pm);
                                } catch {
                                    obj = null;
                                }
                                if (obj && typeof obj === 'object') {
                                    pm = obj;
                                } else {
                                    // string might be raw file id or drive URL
                                    if (pm.startsWith('http')) {
                                        const match = /id=([^&]+)/.exec(pm);
                                        pushPhoto(match ? match[1] : pm);
                                        continue;
                                    } else {
                                        pushPhoto(pm);
                                        continue;
                                    }
                                }
                            }
                            if (pm && typeof pm === 'object') {
                                let raw = pm.file_id || pm.id || pm.fileId;
                                if (!raw && pm.url) {
                                    const match = /id=([^&]+)/.exec(pm.url);
                                    raw = match ? match[1] : pm.url;
                                }
                                const nm = pm.name || '';
                                pushPhoto(raw, nm);
                            }
                        }
                    }

                    // 2) If no photos yet and legacy photo_urls string exists
                    if (photos.length === 0 && item.photo_urls) {
                        let urlEntries = [];
                        // Attempt to parse as JSON if string starts with '['
                        if (typeof item.photo_urls === 'string' && item.photo_urls.trim().startsWith('[')) {
                            try {
                                const parsed = JSON.parse(item.photo_urls);
                                if (Array.isArray(parsed)) {
                                    urlEntries = parsed
                                        .map((o) => {
                                            if (typeof o === 'string') return o;
                                            if (o && typeof o === 'object') {
                                                return o.url || '';
                                            }
                                            return '';
                                        })
                                        .filter(Boolean);
                                }
                            } catch (e) {
                                urlEntries = [];
                            }
                        }

                        // If still empty, treat as comma-separated
                        if (urlEntries.length === 0) {
                            urlEntries = item.photo_urls
                                .split(',')
                                .map(u => u.trim())
                                .filter(Boolean);
                        }

                        for (const u of urlEntries) {
                            let fid = '';
                            // If entry is full URL, extract id= parameter
                            if (u.startsWith('http')) {
                                const match = /id=([^&]+)/.exec(u);
                                fid = match ? match[1] : u;
                            } else {
                                fid = u;
                            }
                            pushPhoto(fid);
                        }
                    }

                    // Final assignment
                    if (photos.length > 0) {
                        item.photo_meta = photos;
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
