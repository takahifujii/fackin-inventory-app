export const API = {
    request: async function (action, method = 'POST', payload = {}, config) {
        if (!config.url) {
            throw new Error('設定からWeb App URLを登録してください');
        }

        // S2S(サーバー間通信)回避策: SafariIのITPブロックを防ぐため、
        // 自分のNode.jsサーバー(Render)の/apiエンドポイントを叩き、そこからGASに転送させる
        let url = import.meta.env.DEV && config.url ? config.url : '/api';

        // Header values cannot contain newlines or trailing spaces, else Safari throws "DOMException: The string did not match the expected pattern"
        const cleanUrl = config.url ? config.url.trim() : '';
        const cleanToken = config.token ? config.token.trim() : '';

        let options = {
            method: method,
            redirect: 'follow', // Node->GAS proxy returns a clean response, no redirect for the browser
            headers: {
                // S2S(サーバー間通信)回避策: Renderのプロキシに本来のGAS URLを伝える
                'X-GAS-URL': cleanUrl
            }
        };

        if (method === 'GET') {
            const params = new URLSearchParams({
                action: action,
                token: cleanToken
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
                token: cleanToken,
                payload: payload
            });
        }

        const response = await fetch(url, options);
        let data;
        let responseText = await response.text();

        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // Safari throws DOMException "The string did not match the expected pattern" when response.json() is called on HTML.
            // By parsing manually, we can catch the error and analyze the HTML response from Google.
            let errorPreview = responseText.substring(0, 100).replace(/<[^>]*>?/gm, ''); // strip HTML tags
            if (responseText.includes('Page Not Found') || responseText.includes('ページが見つかりません') || responseText.includes('file does not exist')) {
                throw new Error("🚨設定エラー: Google Apps ScriptのURLが間違っているか、ファイルが削除されています。設定画面を確認してください。");
            } else if (responseText.includes('Sign in') || responseText.includes('ログイン') || responseText.includes('accounts.google.com')) {
                throw new Error("🚨権限エラー: Google Apps Scriptのアクセスできるユーザーが「全員」に設定されていません。GASのデプロイ設定を見直してください。");
            } else if (response.status >= 500) {
                throw new Error(`🚨サーバーエラー(${response.status}): ${errorPreview}`);
            } else {
                throw new Error(`🚨予期せぬ応答(${response.status}): GAS URLが正しくないか、Google側でエラーが起きています。\n詳細: ${errorPreview}`);
            }
        }

        if (data && data.status === 'error') {
            throw new Error(data.data.error || '不明なエラー');
        }

        return data ? data.data : null;
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
