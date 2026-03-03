// app.js

const App = {
    init: function () {
        this.bindEvents();
        this.loadSettings();
        if (Config.GAS_WEB_APP_URL) {
            this.syncData();
        } else {
            UI.toast('設定画面から Web App URL を登録してください', 'error');
            this.switchView('view-settings');
        }
    },

    bindEvents: function () {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-target');
                this.switchView(target);
            });
        });

        // Settings
        document.getElementById('btn-save-settings').addEventListener('click', () => {
            const url = document.getElementById('config-url').value;
            const token = document.getElementById('config-token').value;
            const user = document.getElementById('config-user').value;
            Config.save(url, token, user);
            UI.toast('設定を保存しました');
            this.syncData();
            this.switchView('view-list');
        });

        document.getElementById('btn-init-sheets').addEventListener('click', async () => {
            if (confirm('スプレッドシートの初期セットアップ（シート作成など）を行います。よろしいですか？')) {
                try {
                    await API.initSheets();
                    UI.toast('初期化が完了しました。');
                    this.syncData();
                } catch (e) {
                    UI.toast('初期化に失敗: ' + e.message, 'error');
                }
            }
        });

        // Sync button
        document.getElementById('btn-sync').addEventListener('click', () => this.syncData());

        // Filter Toggle
        document.getElementById('btn-filter').addEventListener('click', () => {
            const panel = document.getElementById('filter-panel');
            panel.classList.toggle('hidden');
        });

        // List Filtering
        const filterInputs = ['search-input', 'filter-category', 'filter-location', 'filter-threshold'];
        filterInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                if (id === 'search-input') State.filters.search = e.target.value;
                if (id === 'filter-category') State.filters.category = e.target.value;
                if (id === 'filter-location') State.filters.location = e.target.value;
                if (id === 'filter-threshold') State.filters.thresholdOnly = e.target.checked;
                UI.renderItems();
            });
        });

        // Form Photo
        const photoBox = document.getElementById('photo-preview-box');
        const photoInput = document.getElementById('form-photo');
        const photoPreview = document.getElementById('form-photo-preview');
        photoBox.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                photoPreview.src = url;
                photoPreview.classList.remove('hidden');
            }
        });

        // Form Submit
        document.getElementById('item-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitForm();
        });

        // Form Cancel
        document.getElementById('btn-cancel-form').addEventListener('click', () => {
            this.switchView('view-list');
        });

        // Consume Modal events
        document.getElementById('btn-consume-cancel').addEventListener('click', () => this.closeConsumeModal());
        document.getElementById('btn-consume-confirm').addEventListener('click', () => this.submitConsume());

        document.getElementById('btn-consume-minus').addEventListener('click', () => {
            const i = document.getElementById('consume-qty-input');
            if (i.value > 1) i.value = parseInt(i.value) - 1;
        });
        document.getElementById('btn-consume-plus').addEventListener('click', () => {
            const i = document.getElementById('consume-qty-input');
            const max = parseInt(document.getElementById('consume-current-qty').textContent);
            if (i.value < max) i.value = parseInt(i.value) + 1;
        });
    },

    loadSettings: function () {
        document.getElementById('config-url').value = Config.GAS_WEB_APP_URL;
        document.getElementById('config-token').value = Config.API_TOKEN;
        document.getElementById('config-user').value = Config.USER_NAME;
    },

    switchView: function (viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        document.querySelectorAll('.nav-item').forEach(v => v.classList.remove('active'));
        document.querySelector(`.nav-item[data-target="${viewId}"]`).classList.add('active');

        const titleEl = document.getElementById('header-title');
        if (viewId === 'view-list') titleEl.textContent = '在庫一覧';
        else if (viewId === 'view-form') {
            titleEl.textContent = '新規登録';
            this.resetForm();
        }
        else if (viewId === 'view-settings') titleEl.textContent = '設定';
    },

    syncData: async function () {
        if (!Config.GAS_WEB_APP_URL) return;
        try {
            const [items, master] = await Promise.all([
                API.getItems(),
                API.getMaster()
            ]);
            State.setItems(items);
            State.setMaster(master);

            this.updateMasterDropdowns();
            UI.renderItems();
            UI.toast('データを同期しました');
        } catch (error) {
            UI.toast('通信エラー: ' + error.message, 'error');
        }
    },

    updateMasterDropdowns: function () {
        UI.renderSelectOptions('filter-category', State.categories, 'すべてのカテゴリ');
        UI.renderSelectOptions('filter-location', State.locations, 'すべての場所');
        UI.renderSelectOptions('form-category', State.categories, '未指定');
        UI.renderSelectOptions('form-location', State.locations, '未指定');
    },

    resetForm: function () {
        document.getElementById('item-form').reset();
        document.getElementById('form-item-id').value = '';
        const img = document.getElementById('form-photo-preview');
        img.src = '';
        img.classList.add('hidden');
    },

    submitForm: async function () {
        try {
            const file = document.getElementById('form-photo').files[0];
            let base64 = await API.fileToBase64(file);
            base64 = await API.resizeImage(base64, 1024); // max width 1024 for compression

            const payload = {
                name: document.getElementById('form-name').value,
                category: document.getElementById('form-category').value,
                location: document.getElementById('form-location').value,
                qty: document.getElementById('form-qty').value,
                unit: document.getElementById('form-unit').value,
                threshold: document.getElementById('form-threshold').value,
                addIfSameName: document.getElementById('form-add-if-exists').checked,
                note: document.getElementById('form-note').value,
                photo_base64: base64
            };

            await API.createItem(payload);
            UI.toast('在庫を登録しました');
            this.switchView('view-list');
            await this.syncData();
        } catch (error) {
            UI.toast('登録エラー: ' + error.message, 'error');
        }
    },

    // Consume Modal Logic
    currentConsumeItemId: null,

    openConsumeModal: function (itemId) {
        const item = State.items.find(i => i.item_id === itemId);
        if (!item) return;

        this.currentConsumeItemId = itemId;
        document.getElementById('consume-item-name').textContent = item.name;
        document.getElementById('consume-current-qty').textContent = item.qty;
        document.getElementById('consume-unit').textContent = item.unit;
        document.getElementById('consume-qty-input').max = item.qty;
        document.getElementById('consume-qty-input').value = 1;
        document.getElementById('consume-note-input').value = '';

        document.getElementById('modal-consume').classList.remove('hidden');
    },

    closeConsumeModal: function () {
        document.getElementById('modal-consume').classList.add('hidden');
        this.currentConsumeItemId = null;
    },

    submitConsume: async function () {
        if (!this.currentConsumeItemId) return;
        const qty = document.getElementById('consume-qty-input').value;
        const note = document.getElementById('consume-note-input').value;

        try {
            await API.consumeItem(this.currentConsumeItemId, qty, note);
            UI.toast('消費を登録しました');
            this.closeConsumeModal();
            await this.syncData();
        } catch (error) {
            UI.toast('エラー: ' + error.message, 'error');
        }
    }
};

window.promptNewMaster = function (type) {
    const label = type === 'category' ? 'カテゴリ' : '場所';
    const val = prompt(`新しい${label}を入力してください\n※シートに反映させるには登録時に送信されます（現MVP仕様では手動でスプレッドシートのmasterにも記載してください）`);
    if (val) {
        const select = document.getElementById(`form-${type}`);
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.appendChild(opt);
        select.value = val;
    }
};

// Start
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
