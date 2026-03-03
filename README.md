# FACKIN 在庫管理 App

スマホでアプリのように使える在庫管理アプリケーションです。
バックエンドに Google Sheets (Apps Script) を使用し、フロントエンドは Vanilla JS PWA として構築されています（ビルド不要）。

## 特徴
- 📱 **PWA対応**: スマホの「ホーム画面に追加」でネイティブアプリのように利用可能
- 📊 **スプレッドシート連携**: 在庫データや履歴はすべてGoogleスプレッドシートに保存
- 📸 **写真アップロード**: スマホのカメラで撮影した写真をGoogleドライブに自動保存・リサイズ
- ⚡️ **シンプル＆高速**: スマホから簡単に在庫の登録・消費・棚卸しが可能

## システム構成
- **Frontend**: Vanilla JS, HTML, CSS (ビルド不要でどの静的サーバでも動作可能)
- **Backend**: Google Apps Script (`backend/Code.gs`)
- **Database**: Google Sheets (`items`, `logs`, `master` シート)

---

## セットアップ手順

### 1. バックエンド (Google Sheets + Apps Script)

1. 新しいGoogleスプレッドシートを作成します。
2. メニューから「拡張機能」>「Apps Script」を開きます。
3. デフォルトのコードを削除し、本リポジトリの `backend/Code.gs` の内容を貼り付けて保存します。
4. （初回のみ）左側のファイル一覧から「デプロイ」>「新しいデプロイ」を選択します。
5. デプロイタイプの選択（歯車アイコン）で「ウェブアプリ」を選びます。
6. 設定を以下のようにします：
   - 次のユーザーとして実行: 「自分」
   - アクセスできるユーザー: 「全員」
7. 「デプロイ」をクリックします。「アクセスを承認」が求められたら、自分のGoogleアカウントを選択し、「詳細」>「安全ではないページへ移動」から許可します（Driveへの自動フォルダ作成などの権限が含まれます）。
8. 発行された**ウェブアプリのURL**をコピーします。

※ カスタマイズ:
フロントエンドからの通信を保護するトークン（デフォルト `fackin_inventory_secret_token`）を変更したい場合は `Code.gs` の一行目を変更してください。

### 2. フロントエンドの公開 (GitHub Pages 自動デプロイ)

本リポジトリには GitHub Actions の設定 (`.github/workflows/deploy.yml`) が含まれているため、GitHub にプッシュするだけで自動的に公開されます。

1. ご自身の GitHub アカウントに空の **Public** リポジトリを作成します。
2. ターミナルから以下のコマンドでリモートリポジトリに追加し、Pushします。
   ```bash
   git remote add origin https://github.com/ユーザー名/リポジトリ名.git
   git branch -M main
   git push -u origin main
   ```
3. GitHub上のリポジトリ画面から **Settings > Pages** を開きます。
4. **Build and deployment** の Source を `GitHub Actions` に変更します。
5. （数分後に自動でActionsが走り、デプロイが完了します）
6. ターミナルまたはSettings>Pages画面に表示されたURL (例: `https://[ユーザー名].github.io/[リポジトリ名]`) をコピーします。

※ローカル環境（PC上）で動作確認したい場合は、以下を実行しブラウザで `http://localhost:8000` にアクセスします。
```bash
cd frontend
python3 -m http.server 8000
```

### 3. アプリの初期化と連携

1. ホスティングしたURL（またはlocalhost）にスマホのブラウザでアクセスします。
2. 画面下部の「設定」タブが開いているはずです。
3. 手順1で取得した **Apps Script Web App URL** を入力し、設定を保存します。
4. 同じ設定画面にある **「シートを初期化する」** という赤いボタンを押します。
   → これにより、スプレッドシート側に `items`, `logs`, `master` シートが自動生成され、準備が完了します。
5. ブラウザのメニュー（Safariの共有ボタンや、Chromeのメニュー）から **「ホーム画面に追加」** を選択します。
6. ホーム画面に作成されたアプリのアイコンから起動し、在庫管理を開始してください！

---

## データ項目について

スプレッドシート上の `items` シートには以下のカラムが作成されます。
- `item_id`: 内部ID
- `name`: 品目名
- `category`: カテゴリ
- `location`: 保管場所
- `qty`: 数量
- `unit`: 単位（個、m、等）
- `threshold`: 要発注ライン
- `status`: active または out または archived
- `photo_urls`: アップロードされたDrive画像のURL
- `created_at` / `updated_at`: 日時

`logs` シートにはすべての増減ログが記録されます。
