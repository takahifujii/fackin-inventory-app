import React, { useState, useEffect, useRef } from 'react';
import { API } from './api';
import { getLargeCategories, getMediumCategories, getSmallCategories } from './config/categories';

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '1234';
const AUTH_KEY = 'fackin_auth_ok';

function PinAuth({ onAuth }) {
    const [input, setInput] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    const press = (digit) => {
        if (input.length >= CORRECT_PIN.length) return;
        const next = input + digit;
        setInput(next);
        setError(false);

        if (next.length === CORRECT_PIN.length) {
            setTimeout(() => {
                if (next === CORRECT_PIN) {
                    localStorage.setItem(AUTH_KEY, 'true');
                    onAuth();
                } else {
                    setShake(true);
                    setError(true);
                    setTimeout(() => {
                        setInput('');
                        setShake(false);
                    }, 700);
                }
            }, 100);
        }
    };

    const del = () => setInput(prev => prev.slice(0, -1));

    const dots = Array.from({ length: CORRECT_PIN.length }, (_, i) => (
        <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < input.length ? 'var(--accent)' : 'transparent',
            border: '2px solid var(--accent)',
            transition: 'background 0.15s'
        }} />
    ));

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

    return (
        <div style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', padding: '2rem'
        }}>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
                <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>FACKIN在庫</h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>PINコードを入力してください</p>
            </div>

            <div style={{
                display: 'flex', gap: '1rem', marginBottom: '2rem',
                animation: shake ? 'shake 0.4s ease' : 'none'
            }}>
                {dots}
            </div>

            {error && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>PINが違います</p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: '0.75rem' }}>
                {keys.map((k, i) => k === '' ? <div key={i} /> : (
                    <button key={i} onClick={() => k === '⌫' ? del() : press(k)}
                        style={{
                            height: 72, borderRadius: 16,
                            background: k === '⌫' ? 'var(--bg-secondary)' : 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            fontSize: k === '⌫' ? '1.2rem' : '1.5rem',
                            fontWeight: 600, cursor: 'pointer',
                            transition: 'transform 0.1s, background 0.1s'
                        }}
                    >{k}</button>
                ))}
            </div>

            <style>{`@keyframes shake {
                0%,100%{transform:translateX(0)}
                20%{transform:translateX(-8px)}
                40%{transform:translateX(8px)}
                60%{transform:translateX(-6px)}
                80%{transform:translateX(6px)}
            }`}</style>
        </div>
    );
}

function Root() {
    const [authed, setAuthed] = useState(localStorage.getItem(AUTH_KEY) === 'true');
    if (!authed) return <PinAuth onAuth={() => setAuthed(true)} />;
    return <App />;
}

function App() {
    const [currentView, setCurrentView] = useState('view-list');
    const [loading, setLoading] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [toastType, setToastType] = useState('success');

    const [config, setConfig] = useState({
        url: import.meta.env.VITE_APP_SCRIPT_URL || '',
        token: import.meta.env.VITE_API_TOKEN || 'fackin_inventory_secret_token',
        user: localStorage.getItem('config_user') || 'ゲスト'
    });

    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);

    // Data Sync
    useEffect(() => {
        if (config.url) {
            syncData();
        } else {
            showToast('通信先が設定されていません (VITE_APP_SCRIPT_URL)', 'error');
        }
    }, [config.url]);

    const showToast = (message, type = 'success') => {
        setToastMessage(message);
        setToastType(type);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const syncData = async () => {
        if (!config.url) return;
        setLoading(true);
        try {
            const [_items, _master] = await Promise.all([
                API.getItems(config),
                API.getMaster(config)
            ]);
            const syncTime = Date.now();
            setItems((_items || []).map(item => ({ ...item, _syncTime: syncTime })));
            setCategories(_master?.categories || []);
            setLocations(_master?.locations || []);
            showToast('データを同期しました');
        } catch (e) {
            showToast('通信エラー: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const saveConfig = (newUser) => {
        const c = { ...config, user: newUser };
        setConfig(c);
        localStorage.setItem('config_user', newUser);
        showToast('名前を保存しました');
        setCurrentView('view-list');
    };

    // Consume Modal State
    const [consumeItem, setConsumeItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);

    let headerTitle = "FACKIN在庫";
    if (currentView === 'view-list') headerTitle = "在庫一覧";
    if (currentView === 'view-form') headerTitle = editingItem ? "在庫編集" : "新規登録";
    if (currentView === 'view-settings') headerTitle = "アカウント";

    return (
        <div className="app-container">
            {/* Loader */}
            {loading && (
                <div className="loader-overlay">
                    <div className="spinner"></div>
                </div>
            )}

            {/* Toast */}
            <div className="toast-container">
                {toastMessage && (
                    <div className={`toast toast-${toastType}`}>
                        <i className={toastType === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'}></i>
                        <span>{toastMessage}</span>
                    </div>
                )}
            </div>

            <header className="app-header">
                <h1 id="header-title">{headerTitle}</h1>
                <button className="icon-btn" onClick={syncData}>
                    <i className="ri-refresh-line"></i>
                </button>
            </header>

            <main className="app-content">
                {currentView === 'view-list' && (
                    <InventoryList
                        items={items}
                        categories={categories}
                        locations={locations}
                        onConsume={(item) => setConsumeItem(item)}
                        onEdit={(item) => {
                            setEditingItem(item);
                            setCurrentView('view-form');
                        }}
                    />
                )}

                {currentView === 'view-form' && (
                    <ItemForm
                        categories={categories}
                        locations={locations}
                        config={config}
                        editItem={editingItem}
                        onCancel={() => {
                            setEditingItem(null);
                            setCurrentView('view-list');
                        }}
                        onSuccess={() => {
                            setEditingItem(null);
                            setCurrentView('view-list');
                            syncData();
                        }}
                        showToast={showToast}
                        setLoading={setLoading}
                    />
                )}

                {currentView === 'view-settings' && (
                    <AccountSettings
                        config={config}
                        onSave={saveConfig}
                    />
                )}
            </main>

            {consumeItem && (
                <ConsumeModal
                    item={consumeItem}
                    onClose={() => setConsumeItem(null)}
                    config={config}
                    setLoading={setLoading}
                    showToast={showToast}
                    onSuccess={() => {
                        setConsumeItem(null);
                        syncData();
                    }}
                />
            )}

            <nav className="bottom-nav">
                <button className={`nav-item ${currentView === 'view-list' ? 'active' : ''}`} onClick={() => setCurrentView('view-list')}>
                    <i className="ri-list-check-2"></i>
                    <span>在庫一覧</span>
                </button>
                <button className={`nav-item nav-fab ${currentView === 'view-form' ? 'active' : ''}`} onClick={() => {
                    setEditingItem(null);
                    setCurrentView('view-form');
                }}>
                    <div className="fab">
                        <i className="ri-add-line"></i>
                    </div>
                </button>
                <button className={`nav-item ${currentView === 'view-settings' ? 'active' : ''}`} onClick={() => setCurrentView('view-settings')}>
                    <i className="ri-user-settings-line"></i>
                    <span>アカウント</span>
                </button>
            </nav>
        </div>
    );
}

// ----------------------------------------------------
// Components
// ----------------------------------------------------

function InventoryList({ items, categories, locations, onConsume, onEdit }) {
    const [search, setSearch] = useState('');
    const [categoryL, setCategoryL] = useState('');
    const [categoryM, setCategoryM] = useState('');
    const [categoryS, setCategoryS] = useState('');
    const [location, setLocation] = useState('');
    const [thresholdOnly, setThresholdOnly] = useState(false);
    const [showFilter, setShowFilter] = useState(false);

    const largeCats = getLargeCategories();
    const mediumCats = getMediumCategories(categoryL);
    const smallCats = getSmallCategories(categoryL, categoryM);

    const filteredItems = items.filter(item => {
        if (item.status === 'archived') return false;
        if (thresholdOnly && (!item.threshold || Number(item.qty) > Number(item.threshold))) return false;
        if (categoryL && item.category_l !== categoryL) return false;
        if (categoryM && item.category_m !== categoryM) return false;
        if (categoryS && item.category_s !== categoryS) return false;
        if (location && item.location !== location) return false;

        if (search) {
            const q = search.toLowerCase();
            const n = (item.name || '').toLowerCase();
            const cl = (item.category_l || '').toLowerCase();
            const cm = (item.category_m || '').toLowerCase();
            const cs = (item.category_s || '').toLowerCase();
            const loc = (item.location || '').toLowerCase();
            if (!n.includes(q) && !cl.includes(q) && !cm.includes(q) && !cs.includes(q) && !loc.includes(q)) return false;
        }
        return true;
    });

    return (
        <div className="view active">
            <div className="search-bar">
                <i className="ri-search-line"></i>
                <input
                    type="text"
                    placeholder="品目、カテゴリ、場所を検索"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button className="icon-btn" onClick={() => setShowFilter(!showFilter)}>
                    <i className="ri-filter-3-line"></i>
                </button>
            </div>

            {showFilter && (
                <div className="filter-panel">
                    <select value={categoryL} onChange={e => { setCategoryL(e.target.value); setCategoryM(''); setCategoryS(''); }}>
                        <option value="">すべての大分類</option>
                        {largeCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    {categoryL && (
                        <select value={categoryM} onChange={e => { setCategoryM(e.target.value); setCategoryS(''); }}>
                            <option value="">すべての中分類</option>
                            {mediumCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                    {categoryM && (
                        <select value={categoryS} onChange={e => setCategoryS(e.target.value)}>
                            <option value="">すべての小分類</option>
                            {smallCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    )}
                    <select value={location} onChange={e => setLocation(e.target.value)}>
                        <option value="">すべての場所</option>
                        {locations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={thresholdOnly} onChange={e => setThresholdOnly(e.target.checked)} />
                        要発注のみ
                    </label>
                </div>
            )}

            <div className="inventory-list">
                {filteredItems.length === 0 ? (
                    <div className="empty-state">
                        <i className="ri-inbox-archive-line"></i>
                        <p>データがありません。<br />同期するか新しく登録してください。</p>
                    </div>
                ) : (
                    filteredItems.map(item => {
                        const isOut = Number(item.qty) <= 0;
                        const isWarning = item.threshold && Number(item.qty) <= Number(item.threshold);
                        const getDriveDisplayUrl = (url) => {
                            if (!url) return null;
                            const t = item._syncTime || Date.now();
                            const match = url.match(/id=([a-zA-Z0-9_-]+)/);
                            const apiUrlPrefix = import.meta.env.DEV ? 'http://localhost:3000' : 'https://fackin-inventory-app-api.onrender.com';
                            if (match) {
                                return `${apiUrlPrefix}/api/image/${match[1]}?t=${t}`;
                            }
                            return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
                        };

                        let firstImgRaw = null;
                        if (item.photos && item.photos.length > 0 && item.photos[0] && item.photos[0].url) {
                            firstImgRaw = item.photos[0].url;
                        } else if (item.photo_urls) {
                            firstImgRaw = item.photo_urls.split(',')[0];
                        }

                        const firstImg = getDriveDisplayUrl(firstImgRaw);

                        return (
                            <div key={item.item_id} className={`item-card ${isOut ? 'is-out' : ''}`}>
                                <div className="item-thumbnail">
                                    {firstImg ? <img src={firstImg} loading="lazy" alt="thumb" /> : <i className="ri-image-line"></i>}
                                </div>
                                <div className="item-info">
                                    <div className="item-name">{item.name}</div>
                                    <div className="item-meta">
                                        {item.category_l && <span className="badge badge-primary">{item.category_l}</span>}
                                        {item.category_m && <span className="badge badge-primary">{item.category_m}</span>}
                                        {item.category_s && <span className="badge badge-primary">{item.category_s}</span>}
                                        {/* Legacy fallback */}
                                        {!item.category_l && item.category && <span className="badge badge-primary">{item.category}</span>}
                                        {item.location && <span className="badge badge-primary">{item.location}</span>}
                                        {isOut && <span className="badge badge-danger">在庫なし</span>}
                                        {!isOut && isWarning && <span className="badge badge-warning">要発注</span>}
                                    </div>
                                    <div className="item-qty">
                                        <span className={`qty-number ${isOut ? 'empty' : ''}`}>{item.qty} {item.unit}</span>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button
                                                className="btn-secondary btn-consume"
                                                onClick={() => onEdit(item)}
                                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                                            >編集</button>
                                            <button className="btn-primary btn-consume" disabled={isOut} onClick={() => onConsume(item)}>消費</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

function ItemForm({ categories, locations, config, onCancel, onSuccess, showToast, setLoading, editItem }) {
    const [photoPreview, setPhotoPreview] = useState(editItem?.photo_urls ? editItem.photo_urls.split(',')[0] : null);
    const [photoFile, setPhotoFile] = useState(null);
    const [customLocs, setCustomLocs] = useState([]);

    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        name: editItem?.name || '',
        category_l: editItem?.category_l || '',
        category_m: editItem?.category_m || '',
        category_s: editItem?.category_s || '',
        location: editItem?.location || '',
        qty: 1,
        unit: editItem?.unit || '個',
        threshold: editItem?.threshold || '',
        addIfSameName: true,
        note: editItem?.note || ''
    });

    const allLocs = Array.from(new Set([...locations, ...customLocs]));

    const largeCats = getLargeCategories();
    const mediumCats = getMediumCategories(formData.category_l);
    const smallCats = getSmallCategories(formData.category_l, formData.category_m);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        const key = id.replace('form-', '');

        let updates = {
            [key === 'add-if-exists' ? 'addIfSameName' : key]: type === 'checkbox' ? checked : value
        };

        // Reset child categories if parent changes
        if (key === 'category_l') {
            updates.category_m = '';
            updates.category_s = '';
        } else if (key === 'category_m') {
            updates.category_s = '';
        }

        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handlePhotoSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const submit = async (e) => {
        e.preventDefault();

        if (!formData.location) {
            showToast('保管場所を選択してください', 'error');
            return;
        }

        setLoading(true);
        try {
            let base64 = null;
            if (photoFile) {
                base64 = await API.fileToBase64(photoFile);
                base64 = await API.resizeImage(base64, 800);
            }

            if (editItem) {
                await API.updateItem({
                    ...formData,
                    item_id: editItem.item_id,
                    photo_base64: base64
                }, config);
                showToast('在庫情報を更新しました');
            } else {
                await API.createItem({
                    ...formData,
                    photo_base64: base64
                }, config);
                showToast('在庫を登録しました');
            }

            onSuccess();
        } catch (e) {
            showToast((editItem ? '更新エラー: ' : '登録エラー: ') + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const addMaster = (type) => {
        const label = type === 'location' ? '場所' : 'マスター';
        const val = prompt(`新しい${label}を入力してください`);
        if (val) {
            if (type === 'location') {
                setCustomLocs(prev => [...prev, val]);
                setFormData(prev => ({ ...prev, location: val }));
            }
        }
    };

    return (
        <div className="view active form-container">
            <form onSubmit={submit} autoComplete="off">
                <div className="form-group photo-upload-group">
                    <label>写真<span className="optional">(任意)</span></label>
                    <div className="photo-preview-box" onClick={() => fileInputRef.current?.click()}>
                        <i className="ri-camera-lens-line"></i>
                        <span>タップして撮影/選択</span>
                        {photoPreview && <img src={photoPreview} alt="Preview" />}
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handlePhotoSelect} accept="image/*" capture="environment" className="hidden" />
                </div>

                <div className="form-group">
                    <label htmlFor="form-name">品目名<span className="required">*</span></label>
                    <input type="text" id="form-name" required value={formData.name} onChange={handleChange} placeholder="例：塩ビパイプ VP-20" />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>カテゴリ</label>
                        <select id="form-category_l" value={formData.category_l} onChange={handleChange} style={{ marginBottom: '0.5rem' }}>
                            <option value="">大分類を選択</option>
                            {largeCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <select id="form-category_m" value={formData.category_m} onChange={handleChange} style={{ marginBottom: '0.5rem' }} disabled={!formData.category_l}>
                            <option value="">中分類を選択</option>
                            {mediumCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <select id="form-category_s" value={formData.category_s} onChange={handleChange} disabled={!formData.category_m}>
                            <option value="">小分類を選択</option>
                            {smallCats.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="form-location">保管場所<span className="required">*</span></label>
                        <div className="input-with-action">
                            <select id="form-location" value={formData.location} onChange={handleChange} required>
                                <option value="">未指定</option>
                                {allLocs.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <button type="button" className="btn-text-small" onClick={() => addMaster('location')}>+ 追加</button>
                        </div>
                    </div>
                </div>

                <div className="form-row">
                    {!editItem && (
                        <div className="form-group">
                            <label htmlFor="form-qty">数量<span className="required">*</span></label>
                            <input type="number" id="form-qty" required min="1" value={formData.qty} onChange={handleChange} />
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="form-unit">単位</label>
                        <input type="text" id="form-unit" value={formData.unit} onChange={handleChange} placeholder="例：個, m, 箱" />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="form-threshold">要発注ライン</label>
                    <input type="number" id="form-threshold" min="0" value={formData.threshold} onChange={handleChange} placeholder="例：5" />
                </div>

                {!editItem && (
                    <div className="form-group">
                        <label className="checkbox-label">
                            <input type="checkbox" id="form-add-if-exists" checked={formData.addIfSameName} onChange={handleChange} />
                            同名があれば「加算」する
                        </label>
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="form-note">メモ</label>
                    <input type="text" id="form-note" value={formData.note} onChange={handleChange} placeholder="仕入先、現場名など" />
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={onCancel}>キャンセル</button>
                    <button type="submit" className="btn-primary">{editItem ? '更新する' : '登録する'}</button>
                </div>
            </form>
        </div>
    );
}

function AccountSettings({ config, onSave }) {
    const [user, setUser] = useState(config.user);

    const handleSave = () => {
        if (!user.trim()) {
            alert('名前を入力してください');
            return;
        }
        onSave(user);
    };

    return (
        <div className="view active">
            <div className="settings-card">
                <h3>アカウント設定</h3>
                <p className="login-desc">在庫の登録や消費をした際に記録されるあなたの名前を設定してください。</p>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label>あなたの名前</label>
                    <input type="text" value={user} onChange={e => setUser(e.target.value)} placeholder="例：山田太郎" />
                </div>
                <button className="btn-primary btn-block" onClick={handleSave}>名前を保存</button>
            </div>
        </div>
    );
}

function ConsumeModal({ item, onClose, config, setLoading, showToast, onSuccess }) {
    const [qty, setQty] = useState(1);
    const [note, setNote] = useState('');

    const submit = async () => {
        setLoading(true);
        try {
            await API.consumeItem(item.item_id, qty, note, config);
            showToast('消費を登録しました');
            onSuccess();
        } catch (e) {
            showToast('エラー: ' + e.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>消費・使用登録</h3>
                <p className="modal-subtitle">{item.name}</p>
                <div className="form-group">
                    <label>現在の在庫: <strong>{item.qty}</strong> <span>{item.unit}</span></label>
                </div>
                <div className="form-group">
                    <label>使用する数</label>
                    <div className="input-stepper">
                        <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}><i className="ri-subtract-line"></i></button>
                        <input type="number" readOnly value={qty} />
                        <button type="button" onClick={() => setQty(Math.min(item.qty, qty + 1))}><i className="ri-add-line"></i></button>
                    </div>
                </div>
                <div className="form-group">
                    <label>メモ(現場名など)</label>
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="任意" />
                </div>
                <div className="modal-actions">
                    <button className="btn-text" onClick={onClose}>キャンセル</button>
                    <button className="btn-primary" onClick={submit}>消費する</button>
                </div>
            </div>
        </div>
    );
}

export { Root };
export default App;
