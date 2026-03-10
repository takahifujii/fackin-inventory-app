// ==========================================
// Configurations
// ==========================================

// 簡易トークンによるアクセス制御
const API_TOKEN = "fackin_inventory_secret_token";

// 画像を保存するGoogleドライブのフォルダ名
const IMAGE_FOLDER_NAME = "InventoryApp_Images";

// スプレッドシートID
// ※Apps Script を対象スプレッドシートから開いている場合は "" でも可
const SPREADSHEET_ID = "19sE_E5Osly9qNntKouQEGhNLcfN6re19woh7AataE2M";

// ==========================================
// Column Definitions
// ==========================================

const itemsColumns = [
  "item_id",
  "name",
  "category_l",
  "category_m",
  "category_s",
  "location",
  "qty",
  "unit",
  "threshold",
  "status",
  "photo_urls",
  "created_at",
  "updated_at"
];

const logsColumns = [
  "log_id",
  "item_id",
  "action",
  "delta_qty",
  "note",
  "photo_url",
  "user",
  "timestamp"
];

const masterColumns = ["type", "value"];

// ==========================================
// HTTP Handlers (Web App Interfaces)
// ==========================================

function doPost(e) {
  try {
    Logger.log("doPost raw: " + (e && e.postData ? e.postData.contents : "no postData"));
    Logger.log("doPost params: " + JSON.stringify((e && e.parameter) || {}));

    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    let postData = null;

    // JSON優先、ダメならフォーム形式も拾う
    try {
      postData = JSON.parse(raw);
    } catch (_) {
      postData = (e && e.parameter) || {};
      if (typeof postData.payload === "string") {
        try {
          postData.payload = JSON.parse(postData.payload);
        } catch (_) {}
      }
    }

    if (!postData || postData.token !== API_TOKEN) {
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
    Logger.log("doPost error: " + error.toString());
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function doGet(e) {
  try {
    const token = e && e.parameter ? e.parameter.token : null;
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
        result = getLogs(e.parameter.item_id);
        break;
      case "getMaster":
        result = getMasterData();
        break;
      default:
        return createJsonResponse({ error: "Unknown action" }, 400);
    }

    return createJsonResponse(result);
  } catch (error) {
    Logger.log("doGet error: " + error.toString());
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function createJsonResponse(data, statusCode) {
  statusCode = statusCode || 200;
  const output = JSON.stringify({
    status: statusCode === 200 ? "success" : "error",
    data: data
  });

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// Helper Utilities
// ==========================================

function toInt(value, defaultValue) {
  defaultValue = defaultValue === undefined ? 0 : defaultValue;
  const n = parseInt(value, 10);
  return isNaN(n) ? defaultValue : n;
}

function nowIso() {
  return new Date().toISOString();
}

// ==========================================
// Core Operations
// ==========================================

function getItems() {
  const sheet = getSheetOrCreate("items");
  const data = getSheetDataAsObjects(sheet);
  return data.filter(item => item.status !== "archived");
}

function getItem(id) {
  if (!id) return null;
  const items = getItems();
  return items.find(item => item.item_id === id) || null;
}

function createItem(payload) {
  payload = payload || {};

  const {
    name,
    category_l,
    category_m,
    category_s,
    location,
    qty,
    unit,
    threshold,
    photo_base64,
    addIfSameName
  } = payload;

  if (!name) throw new Error("name is required");

  const sheet = getSheetOrCreate("items");
  const data = getSheetDataAsObjects(sheet);

  // 同名チェック・加算ロジック
  if (addIfSameName) {
    const existing = data.find(item => item.name === name && item.status !== "archived");
    if (existing) {
      return addQuantityToExistingItem(
        existing,
        qty,
        photo_base64,
        payload.user,
        payload.note
      );
    }
  }

  let photoUrl = "";
  if (photo_base64) {
    photoUrl = saveImageToDrive(photo_base64, "item_" + Date.now() + ".jpg");
  }

  const newItem = {
    item_id: Utilities.getUuid(),
    name: name,
    category_l: category_l || "",
    category_m: category_m || "",
    category_s: category_s || "",
    location: location || "",
    qty: toInt(qty),
    unit: unit || "個",
    threshold:
      threshold === "" || threshold === undefined || threshold === null
        ? ""
        : toInt(threshold),
    status: "active",
    photo_urls: photoUrl,
    created_at: nowIso(),
    updated_at: nowIso()
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
  const newQty = toInt(existing.qty) + toInt(addQty);

  let newPhotoUrl = existing.photo_urls || "";
  let addedPhotoUrl = "";

  if (photo_base64) {
    addedPhotoUrl = saveImageToDrive(photo_base64, "item_add_" + Date.now() + ".jpg");
    if (newPhotoUrl) {
      newPhotoUrl += "," + addedPhotoUrl;
    } else {
      newPhotoUrl = addedPhotoUrl;
    }
  }

  updateRowInSheet(sheet, "item_id", existing.item_id, {
    qty: newQty,
    status: newQty > 0 ? "active" : "out",
    photo_urls: newPhotoUrl,
    updated_at: nowIso()
  });

  writeLog({
    item_id: existing.item_id,
    action: "add",
    delta_qty: toInt(addQty),
    note: note || "追加登録による加算",
    photo_url: addedPhotoUrl,
    user: user || "Unknown"
  });

  return getItem(existing.item_id);
}

function updateItem(payload) {
  payload = payload || {};

  const {
    item_id,
    name,
    category_l,
    category_m,
    category_s,
    location,
    unit,
    threshold,
    photo_base64,
    user,
    note
  } = payload;

  if (!item_id) throw new Error("item_id is required");

  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);

  if (!existing) throw new Error("Item not found");

  let newPhotoUrl = existing.photo_urls || "";
  let addedPhotoUrl = "";

  if (photo_base64) {
    addedPhotoUrl = saveImageToDrive(photo_base64, "item_edit_" + Date.now() + ".jpg");
    if (newPhotoUrl) {
      newPhotoUrl += "," + addedPhotoUrl;
    } else {
      newPhotoUrl = addedPhotoUrl;
    }
  }

  updateRowInSheet(sheet, "item_id", item_id, {
    name: name !== undefined ? name : existing.name,
    category_l: category_l !== undefined ? category_l : (existing.category_l || ""),
    category_m: category_m !== undefined ? category_m : (existing.category_m || ""),
    category_s: category_s !== undefined ? category_s : (existing.category_s || ""),
    location: location !== undefined ? location : existing.location,
    unit: unit !== undefined ? unit : existing.unit,
    threshold:
      threshold !== undefined
        ? (threshold === "" ? "" : toInt(threshold))
        : existing.threshold,
    photo_urls: newPhotoUrl,
    updated_at: nowIso()
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
  payload = payload || {};

  const { item_id, consume_qty, user, note } = payload;

  if (!item_id) throw new Error("item_id is required");
  if (toInt(consume_qty) <= 0) throw new Error("consume_qty must be greater than 0");

  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);

  if (!existing) throw new Error("Item not found");

  const currentQty = toInt(existing.qty);
  const reduceQty = toInt(consume_qty);

  let newQty = currentQty - reduceQty;
  if (newQty < 0) newQty = 0;

  updateRowInSheet(sheet, "item_id", item_id, {
    qty: newQty,
    status: newQty === 0 ? "out" : existing.status,
    updated_at: nowIso()
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
  payload = payload || {};

  const { item_id, user, note } = payload;

  if (!item_id) throw new Error("item_id is required");

  const sheet = getSheetOrCreate("items");
  const existing = getItem(item_id);

  if (!existing) throw new Error("Item not found");

  updateRowInSheet(sheet, "item_id", item_id, {
    status: "archived",
    updated_at: nowIso()
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
    item_id: logData.item_id || "",
    action: logData.action || "",
    delta_qty: toInt(logData.delta_qty),
    note: logData.note || "",
    photo_url: logData.photo_url || "",
    user: logData.user || "Unknown",
    timestamp: nowIso()
  };

  appendRowToObjectSheet(sheet, logsColumns, newLog);
}

function getMasterData() {
  const sheet = getSheetOrCreate("master");
  const data = getSheetDataAsObjects(sheet);

  return {
    categories: data.filter(d => d.type === "category").map(d => d.value),
    locations: data.filter(d => d.type === "location").map(d => d.value)
  };
}

// ==========================================
// Drive & Image Handling
// ==========================================

function saveImageToDrive(base64Data, filename) {
  if (!base64Data) return "";

  const parts = base64Data.split(",");
  let encodedContent = parts.length > 1 ? parts[1] : parts[0];

  // iOSやフォーム経由で + がスペース化されることがある
  encodedContent = encodedContent.replace(/\s/g, "+");

  let mimeType = MimeType.JPEG;
  if (parts.length > 1 && parts[0].includes("image/png")) {
    mimeType = MimeType.PNG;
  }

  const decoded = Utilities.base64Decode(encodedContent);
  const blob = Utilities.newBlob(decoded, mimeType, filename);

  const folder = getOrCreateImageFolder();
  const file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("File permission error: " + e.toString());
  }

  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function getOrCreateImageFolder() {
  const folders = DriveApp.getFoldersByName(IMAGE_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  const folder = DriveApp.createFolder(IMAGE_FOLDER_NAME);

  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("Folder permission error: " + e.toString());
  }

  return folder;
}

// ==========================================
// Sheet Initialization
// ==========================================

function initializeSheets() {
  getSheetOrCreate("items", itemsColumns);
  getSheetOrCreate("logs", logsColumns);
  const masterSheet = getSheetOrCreate("master", masterColumns);

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

  return {
    success: true,
    message: "Sheets initialized."
  };
}

// ==========================================
// Spreadsheet Utilities
// ==========================================

function getSpreadsheet() {
  let ss;

  if (SPREADSHEET_ID) {
    ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }

  if (!ss) {
    throw new Error(
      "スプレッドシートが見つかりません。SPREADSHEET_ID を確認してください。"
    );
  }

  return ss;
}

function getSheetOrCreate(sheetName, passedHeaders) {
  let headers = passedHeaders || null;

  if (!headers) {
    if (sheetName === "items") headers = itemsColumns;
    else if (sheetName === "logs") headers = logsColumns;
    else if (sheetName === "master") headers = masterColumns;
  }

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers) {
      initializeHeaderRow(sheet, headers);
    }
    return sheet;
  }

  if (headers && sheet.getLastRow() === 0) {
    initializeHeaderRow(sheet, headers);
    return sheet;
  }

  if (headers && sheet.getLastRow() > 0) {
    const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (firstRow[0] !== headers[0]) {
      sheet.insertRowBefore(1);
      initializeHeaderRow(sheet, headers);
    }
  }

  return sheet;
}

function initializeHeaderRow(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground("#f3f3f3");
  sheet.setFrozenRows(1);
}

function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function appendRowToObjectSheet(sheet, headers, obj) {
  const rowData = headers.map(header => (obj[header] ?? ""));
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
      for (const [key, value] of Object.entries(updateObj)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      }
      return true;
    }
  }

  return false;
}
