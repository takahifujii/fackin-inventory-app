// ==========================================
// Configurations
// ==========================================
// 簡易トークンによるアクセス制御（必要に応じて変更してください）
const API_TOKEN = "fackin_inventory_secret_token";
// 画像を保存するGoogleドライブのフォルダ名
const IMAGE_FOLDER_NAME = "InventoryApp_Images";

// 【重要】スプレッドシートのURLからIDをコピーして貼り付けてください。
// 例: https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXX/edit の XXXXXXXXXXXXXXXXX の部分
// ※スプレッドシートから「拡張機能 > Apps Script」で開いた場合は空欄 "" のままでOKです。
const SPREADSHEET_ID = "19sE_E5Osly9qNntKouQEGhNLcfN6re19woh7AataE2M";

// ==========================================
// HTTP Handlers (Web App Interfaces)
// ==========================================
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    if (postData.token !== API_TOKEN) {
      return createJsonResponse({ error: "Unauthorized" }, 401);
    }

    const action = postData.action;
    let result;

    switch (action) {
      case "init":
        result = initializeSheets();
        break;
      case "createItem":
        result = createItem(postData.payload);
        break;
      case "updateItem":
        result = updateItem(postData.payload);
        break;
      case "consumeItem":
        result = consumeItem(postData.payload);
        break;
      case "archiveItem":
        result = archiveItem(postData.payload);
        break;
      default:
        return createJsonResponse({ error: "Unknown action" }, 400);
    }

    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function doGet(e) {
  try {
    const token = e.parameter.token;
    if (token !== API_TOKEN) {
      return createJsonResponse({ error: "Unauthorized" }, 401);
    }

    const action = e.parameter.action;
    let result;

    switch (action) {
      case "getItems":
        result = getItems();
        break;
      case "getItem":
        result = getItem(e.parameter.id);
        break;
      case "getLogs":
        result = getLogs(e.parameter.item_id); // Optional item_id filter
        break;
      case "getMaster":
        result = getMasterData();
        break;
      default:
        return createJsonResponse({ error: "Unknown action" }, 400);
    }
    
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

// OPTIONS method handling for CORS preflight (Apps Script handles this automatically for Web Apps)

function createJsonResponse(data, statusCode = 200) {
  const output = JSON.stringify({
    status: statusCode === 200 ? "success" : "error",
    data: data
  });
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// Core Operations
// ==========================================

function getItems() {
  const sheet = getSheetOrCreate("items");
  const data = getSheetDataAsObjects(sheet);
  // 削除済み・アーカイブ済みは除外して返す
  return data.filter(item => item.status !== "archived");
}

function getItem(id) {
  const items = getItems();
  return items.find(item => item.item_id === id) || null;
}

function createItem(payload) {
  const { name, category, location, qty, unit, threshold, photo_base64, addIfSameName } = payload;
  
  const sheet = getSheetOrCreate("items");
  const data = getSheetDataAsObjects(sheet);
  
  // 同名チェック・加算ロジック
  if (addIfSameName) {
    const existing = data.find(item => item.name === name && item.status !== "archived");
    if (existing) {
      return addQuantityToExistingItem(existing, qty, photo_base64, payload.user, payload.note);
    }
  }

  // 新規作成
  let photoUrl = "";
  if (photo_base64) {
    photoUrl = saveImageToDrive(photo_base64, `item_${Date.now()}.jpg`);
  }

  const newItem = {
    item_id: Utilities.getUuid(),
    name: name,
    category: category || "",
    location: location || "",
    qty: parseInt(qty, 10) || 0,
    unit: unit || "個",
    threshold: threshold ? parseInt(threshold, 10) : "",
    status: "active",
    photo_urls: photoUrl, // 複数対応の場合はJSON配列文字列にするがMVPは単一カンマ区切りなどを想定
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  appendRowToObjectSheet(sheet, itemsColumns, newItem);

  writeLog({
    item_id: newItem.item_id,
    action: "create",
    delta_qty: newItem.qty,
    note: payload.note || "新規登録",
    photo_url: photoUrl,
    user: payload.user || "Unknown"
  });

  return newItem;
}

function addQuantityToExistingItem(existing, addQty, photo_base64, user, note) {
  const sheet = getSheetOrCreate("items");
  const newQty = parseInt(existing.qty, 10) + parseInt(addQty, 10);
  
  let newPhotoUrl = existing.photo_urls;
  let addedPhotoUrl = "";
  if (photo_base64) {
    addedPhotoUrl = saveImageToDrive(photo_base64, `item_add_${Date.now()}.jpg`);
    if (newPhotoUrl) {
      newPhotoUrl += "," + addedPhotoUrl; // 簡易的にカンマ区切りで追加
    } else {
      newPhotoUrl = addedPhotoUrl;
    }
  }

  updateRowInSheet(sheet, "item_id", existing.item_id, {
    qty: newQty,
    status: newQty > 0 ? "active" : "out",
    photo_urls: newPhotoUrl,
    updated_at: new Date().toISOString()
  });

  writeLog({
    item_id: existing.item_id,
    action: "add",
    delta_qty: parseInt(addQty, 10),
    note: note || "追加登録による加算",
    photo_url: addedPhotoUrl,
    user: user || "Unknown"
  });

  return getItem(existing.item_id); // 返却用に最新取得
}

function updateItem(payload) {
  const { item_id, name, category, location, unit, threshold, photo_base64, user, note } = payload;
  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);
  
  if (!existing) throw new Error("Item not found");

  let newPhotoUrl = existing.photo_urls;
  let addedPhotoUrl = "";
  if (photo_base64) {
    addedPhotoUrl = saveImageToDrive(photo_base64, `item_edit_${Date.now()}.jpg`);
    if (newPhotoUrl) {
      newPhotoUrl += "," + addedPhotoUrl;
    } else {
      newPhotoUrl = addedPhotoUrl;
    }
  }

  updateRowInSheet(sheet, "item_id", item_id, {
    name: name !== undefined ? name : existing.name,
    category: category !== undefined ? category : existing.category,
    location: location !== undefined ? location : existing.location,
    unit: unit !== undefined ? unit : existing.unit,
    threshold: threshold !== undefined ? threshold : existing.threshold,
    photo_urls: newPhotoUrl,
    updated_at: new Date().toISOString()
  });

  writeLog({
    item_id: item_id,
    action: "edit",
    delta_qty: 0,
    note: note || "アイテム情報更新",
    photo_url: addedPhotoUrl,
    user: user || "Unknown"
  });

  return getItem(item_id);
}

function consumeItem(payload) {
  const { item_id, consume_qty, user, note } = payload;
  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);
  
  if (!existing) throw new Error("Item not found");
  
  const currentQty = parseInt(existing.qty, 10);
  const reduceQty = parseInt(consume_qty, 10);
  
  let newQty = currentQty - reduceQty;
  if (newQty < 0) newQty = 0;

  updateRowInSheet(sheet, "item_id", item_id, {
    qty: newQty,
    status: newQty === 0 ? "out" : existing.status,
    updated_at: new Date().toISOString()
  });

  writeLog({
    item_id: item_id,
    action: "consume",
    delta_qty: -reduceQty,
    note: note || "使用・消費",
    photo_url: "",
    user: user || "Unknown"
  });

  return getItem(item_id);
}

function archiveItem(payload) {
  const { item_id, user, note } = payload;
  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);
  
  if (!existing) throw new Error("Item not found");

  updateRowInSheet(sheet, "item_id", item_id, {
    status: "archived",
    updated_at: new Date().toISOString()
  });

  writeLog({
    item_id: item_id,
    action: "archive",
    delta_qty: 0,
    note: note || "アーカイブ（削除）",
    photo_url: "",
    user: user || "Unknown"
  });

  return { archived_id: item_id };
}

function getLogs(item_id) {
  const sheet = getSheetOrCreate("logs");
  const data = getSheetDataAsObjects(sheet);
  if (item_id) {
    return data.filter(log => log.item_id === item_id);
  }
  return data;
}

function writeLog(logData) {
  const sheet = getSheetOrCreate("logs");
  const newLog = {
    log_id: Utilities.getUuid(),
    item_id: logData.item_id,
    action: logData.action,
    delta_qty: logData.delta_qty,
    note: logData.note || "",
    photo_url: logData.photo_url || "",
    user: logData.user || "Unknown",
    timestamp: new Date().toISOString()
  };
  appendRowToObjectSheet(sheet, logsColumns, newLog);
}

function getMasterData() {
  const sheet = getSheetOrCreate("master");
  const data = getSheetDataAsObjects(sheet);
  
  return {
    categories: data.filter(d => d.type === 'category').map(d => d.value),
    locations: data.filter(d => d.type === 'location').map(d => d.value)
  };
}

// ==========================================
// Drive & Image Handling
// ==========================================

function saveImageToDrive(base64Data, filename) {
  // フォーマット: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
  const parts = base64Data.split(',');
  const encodedContent = parts.length > 1 ? parts[1] : parts[0];
  
  let mimeType = MimeType.JPEG;
  if(parts.length > 1) {
    if(parts[0].includes('image/png')) mimeType = MimeType.PNG;
  }

  const decoded = Utilities.base64Decode(encodedContent);
  const blob = Utilities.newBlob(decoded, mimeType, filename);
  
  // フォルダを取得または作成
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(IMAGE_FOLDER_NAME);
    // フォルダ全体の共有設定を「リンクを知っている全員が閲覧可」に変更 (Web経由で画像表示するため)
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  const file = folder.createFile(blob);
  
  // スマホから直接表示できるURL(WebContentLink or Thumbnail)を返すのがPWAには適している
  // 代替手段として https://drive.google.com/uc?id=[FILE_ID] が汎用的に使える
  return `https://drive.google.com/uc?id=${file.getId()}`;
}

// ==========================================
// Sheet Utilities
// ==========================================

const itemsColumns = ["item_id", "name", "category", "location", "qty", "unit", "threshold", "status", "photo_urls", "created_at", "updated_at"];
const logsColumns = ["log_id", "item_id", "action", "delta_qty", "note", "photo_url", "user", "timestamp"];
const masterColumns = ["type", "value"];

function initializeSheets() {
  getSheetOrCreate("items", itemsColumns);
  getSheetOrCreate("logs", logsColumns);
  const masterSheet = getSheetOrCreate("master", masterColumns);
  
  // Masterシートが空なら初期データを入れる
  if (masterSheet.getLastRow() <= 1) {
    const initData = [
      ["category", "給湯器"],
      ["category", "配管部材"],
      ["category", "電材"],
      ["category", "木材"],
      ["category", "工具"],
      ["category", "消耗品"],
      ["location", "倉庫A"],
      ["location", "車両1"],
      ["location", "現場置き場"],
      ["location", "事務所"]
    ];
    masterSheet.getRange(2, 1, initData.length, 2).setValues(initData);
  }
  return { success: true, message: "Sheets initialized." };
}

function getSheetOrCreate(sheetName, passedHeaders = null) {
  let headers = passedHeaders;
  if (!headers) {
    if (sheetName === "items") headers = itemsColumns;
    else if (sheetName === "logs") headers = logsColumns;
    else if (sheetName === "master") headers = masterColumns;
  }

  let ss;
  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error("スプレッドシートが見つかりません。Code.gsの7行目にある SPREADSHEET_ID にスプレッドシートのIDを入力してください。");
  }

  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers) {
      sheet.appendRow(headers);
      // Header style
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }
  } else if (headers && sheet.getLastRow() > 0) {
    // 既存のシートの見出し行が存在するかチェックして、無い場合は挿入
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (firstRow[0] !== headers[0]) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }
  } else if (headers && sheet.getLastRow() === 0) {
    // 既存のシートが完全に空の場合
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f3f3");
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function appendRowToObjectSheet(sheet, headers, obj) {
  const rowData = headers.map(header => obj[header] || "");
  sheet.appendRow(rowData);
}

function updateRowInSheet(sheet, keyColumnName, keyValue, updateObj) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return false;
  
  const headers = data[0];
  const keyIndex = headers.indexOf(keyColumnName);
  
  if (keyIndex === -1) return false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][keyIndex] === keyValue) {
      // Find row headers in updateObj and set values
      for (const [key, value] of Object.entries(updateObj)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          // getRange(row, col) - row is 1-indexed, i is 0-indexed for array, so row is i+1
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      }
      return true;
    }
  }
  return false;
}
