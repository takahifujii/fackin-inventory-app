// api.js

const API = {

    request: async function (action, method = 'POST', payload = {}) {
        if (!Config.GAS_WEB_APP_URL) {
            throw new Error('設定からWeb App URLを登録してください');
        }

        try {
            UI.showLoader();
            let url = Config.GAS_WEB_APP_URL;
            let options = {
                method: method,
                redirect: 'follow'
            };

            if (method === 'GET') {
                const params = new URLSearchParams({
                    action: action,
                    token: Config.API_TOKEN
                });
                // If getting specific resource
                if (payload.id) params.append('id', payload.id);
                if (payload.item_id) params.append('item_id', payload.item_id);
                url += '?' + params.toString();
            } else {
                options.headers = {
                    'Content-Type': 'text/plain;charset=utf-8' // GAS accepts this better to avoid OPTIONS preflight issues sometimes
                };
                options.body = JSON.stringify({
                    action: action,
                    token: Config.API_TOKEN,
                    payload: payload
                });
            }

            const response = await fetch(url, options);
            const data = await response.json();

            if (data.status === 'error') {
                throw new Error(data.data.error || '不明なエラー');
            }

            return data.data;

        } catch (error) {
            console.error('API Error:', error);
            throw error;
        } finally {
            UI.hideLoader();
        }
    },

    initSheets: () => API.request('init', 'POST'),

    getItems: () => API.request('getItems', 'GET'),

    getMaster: () => API.request('getMaster', 'GET'),

    createItem: (itemData) => {
        itemData.user = Config.USER_NAME;
        return API.request('createItem', 'POST', itemData);
    },

    consumeItem: (itemId, consumeQty, note) => {
        return API.request('consumeItem', 'POST', {
            item_id: itemId,
            consume_qty: consumeQty,
            note: note,
            user: Config.USER_NAME
        });
    },

    archiveItem: (itemId) => {
        return API.request('archiveItem', 'POST', {
            item_id: itemId,
            user: Config.USER_NAME
        });
    },

    // Utils
    fileToBase64: (file) => {
        return new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    resizeImage: (base64Str, maxWidth = 800) => {
        return new Promise((resolve) => {
            if (!base64Str) return resolve(null);
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.7
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        });
    }
};
