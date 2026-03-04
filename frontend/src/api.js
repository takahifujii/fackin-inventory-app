export const API = {
    request: async function (action, method = 'POST', payload = {}, config) {
        if (!config.url) {
            throw new Error('設定からWeb App URLを登録してください');
        }

        // S2S(サーバー間通信)回避策: SafariIのITPブロックを防ぐため、
        // 自分のNode.jsサーバー(Render)の/apiエンドポイントを叩き、そこからGASに転送させる
        let url = import.meta.env.DEV && config.url ? config.url : '/api';

        let options = {
            method: method,
            redirect: 'follow', // Node->GAS proxy returns a clean response, no redirect for the browser
            headers: {
                // S2S(サーバー間通信)回避策: Renderのプロキシに本来のGAS URLを伝える
                'X-GAS-URL': config.url
            }
        };

        if (method === 'GET') {
            const params = new URLSearchParams({
                action: action,
                token: config.token
            });
            if (payload?.id) params.append('id', payload.id);
            if (payload?.item_id) params.append('item_id', payload.item_id);
            url += '?' + params.toString();
        } else {
            // Safari/iOSでのCORSエラー(Fetch API Load failed)を防ぐため、
            // 明示的に text/plain を指定してシンプルリクエストとして処理させる
            options.headers['Content-Type'] = 'text/plain;charset=utf-8';
            options.body = JSON.stringify({
                action: action,
                token: config.token,
                payload: payload
            });
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (data.status === 'error') {
            throw new Error(data.data.error || '不明なエラー');
        }

        return data.data;
    },

    initSheets: (config) => API.request('init', 'POST', {}, config),

    getItems: (config) => API.request('getItems', 'GET', {}, config),

    getMaster: (config) => API.request('getMaster', 'GET', {}, config),

    createItem: (itemData, config) => {
        itemData.user = config.user;
        return API.request('createItem', 'POST', itemData, config);
    },

    consumeItem: (itemId, consumeQty, note, config) => {
        return API.request('consumeItem', 'POST', {
            item_id: itemId,
            consume_qty: consumeQty,
            note: note,
            user: config.user
        }, config);
    },

    archiveItem: (itemId, config) => {
        return API.request('archiveItem', 'POST', {
            item_id: itemId,
            user: config.user
        }, config);
    },

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
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        });
    }
};
