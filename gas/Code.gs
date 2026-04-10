/**
 * メラジム予約システム - GASバックエンド
 *
 * スプレッドシートをデータベースとして使用し、
 * ウェブアプリとしてデプロイしてNext.jsフロントエンドからHTTP経由でアクセスする。
 *
 * シート構成:
 *   stores, trainers, trainer_stores, customers, bookings, availability_cache
 */

// ---------- 定数 ----------
var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
var API_KEY = PropertiesService.getScriptProperties().getProperty('API_KEY');
var TIMEZONE = 'Asia/Tokyo';

// ---------- セキュリティ定数 ----------
var MAX_STRING_LENGTH = 1000;
var MAX_BIO_LENGTH = 3000;
var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- セキュリティヘルパー ----------

/**
 * タイミング攻撃を防ぐ定数時間文字列比較
 * 文字列長に関わらず全文字を比較し、処理時間が一定になる
 */
function constantTimeEquals_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  // 長さが異なっても全文字走査する（長さの違い自体は漏れるが、内容は漏れない）
  var length = Math.max(a.length, b.length);
  var result = a.length === b.length ? 0 : 1;
  for (var i = 0; i < length; i++) {
    var charA = i < a.length ? a.charCodeAt(i) : 0;
    var charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }
  return result === 0;
}

/**
 * スプレッドシート数式インジェクション対策
 * セルに書き込む文字列値の先頭が危険文字の場合、シングルクオートでエスケープする
 * =, +, -, @, タブ, 改行 で始まる値が対象
 */
function sanitizeForSheet_(value) {
  if (typeof value !== 'string') return value;
  if (value.length === 0) return value;
  var firstChar = value.charAt(0);
  // 先頭が危険文字の場合、シングルクオートでエスケープ
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' ||
      firstChar === '@' || firstChar === '\t' || firstChar === '\r' || firstChar === '\n') {
    return "'" + value;
  }
  // IMPORTRANGE/IMPORTXML/IMPORTDATA/IMAGEなどの関数名を先頭に含む場合も防御
  var upperValue = value.toUpperCase();
  if (upperValue.indexOf('IMPORT') === 0 || upperValue.indexOf('IMAGE') === 0 ||
      upperValue.indexOf('HYPERLINK') === 0) {
    return "'" + value;
  }
  return value;
}

/**
 * 文字列の長さを制限する
 */
function truncateString_(value, maxLength) {
  if (typeof value !== 'string') return value;
  if (value.length > maxLength) {
    return value.substring(0, maxLength);
  }
  return value;
}

/**
 * メールアドレスのフォーマット検証
 */
function isValidEmail_(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email);
}

/**
 * 書き込み操作をScriptLockで保護するラッパー
 * ロック取得に失敗した場合はエラーオブジェクトを返す
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: '他の処理が進行中です。しばらくしてからお試しください' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * パスワードをSHA-256+saltでハッシュ化
 */
function hashPassword_(password, salt) {
  if (!salt) salt = Utilities.getUuid();
  var raw = salt + ':' + password;
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = hash.map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return salt + ':' + hex;
}

/**
 * パスワード検証
 */
function verifyPassword_(password, storedHash) {
  if (!storedHash || !password) return false;
  var parts = storedHash.split(':');
  if (parts.length < 2) return false;
  var salt = parts[0];
  var expected = hashPassword_(password, salt);
  return constantTimeEquals_(expected, storedHash);
}

/**
 * IDの形式検証（UUID形式またはシンプルな英数字-_）
 */
function isValidId_(id) {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 100) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(id);
}

// ---------- エントリポイント ----------

function doPost(e) {
  try {
    // GASエディタからの直接実行対策（eが未定義の場合）
    if (!e || !e.postData) {
      return jsonResponse_({ error: 'POSTリクエストが必要です。GASエディタからは実行できません。' }, 400);
    }
    var payload = JSON.parse(e.postData.contents);

    // APIキー認証（タイミング攻撃対策: 定数時間比較）
    if (!constantTimeEquals_(payload.apiKey, API_KEY)) {
      return jsonResponse_({ error: '認証に失敗しました' }, 401);
    }

    var action = payload.action;
    var params = payload.params || {};

    // グローバルプロトタイプ汚染対策: paramsトップレベルの危険キーを除去
    delete params['__proto__'];
    delete params['constructor'];
    delete params['prototype'];

    var handlers = {
      'getStores': getStores_,
      'getTrainers': getTrainers_,
      'getTrainersFull': getTrainersFull_,
      'createBooking': createBooking_,
      'cancelBooking': cancelBooking_,
      'updateBookingStatus': updateBookingStatus_,
      'getBookings': getBookings_,
      'getStats': getStats_,
      'updateTrainer': updateTrainer_,
      'addTrainer': addTrainer_,
      'deleteTrainer': deleteTrainer_,
      'updateTrainerStores': updateTrainerStores_,
      'addStore': addStore_,
      'updateStore': updateStore_,
      'deleteStore': deleteStore_,
      'getCustomerByLineUid': getCustomerByLineUid_,
      'upsertCustomer': upsertCustomer_,
      'getBookingById': getBookingById_,
      'getBookingCountsForTrainers': getBookingCountsForTrainers_,
      'getTrainerStoresByStore': getTrainerStoresByStore_,
      'getAvailabilityCache': getAvailabilityCache_,
      'upsertAvailabilityCache': upsertAvailabilityCache_,
      'deleteAvailabilityCache': deleteAvailabilityCache_,
      'clearAllAvailabilityCache': clearAllAvailabilityCache_,
      'authenticateTrainer': authenticateTrainer_,
      'setTrainerPassword': setTrainerPassword_,
      'getTrainerByEmail': getTrainerByEmail_,
      'getTrainerBookings': getTrainerBookings_,
      'getStoreBookings': getStoreBookings_,
      'setStorePasscode': setStorePasscode_,
      'verifyStorePasscode': verifyStorePasscode_,
      'getStoreByName': getStoreByName_,
    };

    var handler = handlers[action];
    if (!handler) {
      // action名をエラーメッセージに含めない（情報漏洩防止）
      return jsonResponse_({ error: '不明なアクションが指定されました' }, 400);
    }

    var result = handler(params);
    return jsonResponse_(result, 200);
  } catch (err) {
    // 内部エラー情報をクライアントに返さない（情報漏洩防止）
    Logger.log('doPost error: ' + err.message + '\n' + err.stack);
    return jsonResponse_({ error: 'サーバーエラーが発生しました。しばらくしてからお試しください' }, 500);
  }
}

function doGet(e) {
  // クエリパラメータにpayloadがある場合はAPIリクエストとして処理
  if (e && e.parameter && e.parameter.payload) {
    var payload;
    try {
      payload = JSON.parse(e.parameter.payload);
    } catch (parseErr) {
      return jsonResponse_({ error: 'リクエストのJSON形式が不正です' }, 400);
    }
    try {

      // APIキー認証
      if (!constantTimeEquals_(payload.apiKey, API_KEY)) {
        return jsonResponse_({ error: '認証に失敗しました' }, 401);
      }

      var action = payload.action;
      var params = payload.params || {};

      // プロトタイプ汚染対策
      delete params['__proto__'];
      delete params['constructor'];
      delete params['prototype'];

      var handlers = {
        'getStores': getStores_,
        'getTrainers': getTrainers_,
        'getTrainersFull': getTrainersFull_,
        'createBooking': createBooking_,
        'cancelBooking': cancelBooking_,
        'getBookings': getBookings_,
        'getStats': getStats_,
        'updateTrainer': updateTrainer_,
        'addTrainer': addTrainer_,
        'deleteTrainer': deleteTrainer_,
        'updateTrainerStores': updateTrainerStores_,
        'addStore': addStore_,
        'updateStore': updateStore_,
        'deleteStore': deleteStore_,
        'getCustomerByLineUid': getCustomerByLineUid_,
        'upsertCustomer': upsertCustomer_,
        'getBookingById': getBookingById_,
        'getBookingCountsForTrainers': getBookingCountsForTrainers_,
        'getTrainerStoresByStore': getTrainerStoresByStore_,
        'getAvailabilityCache': getAvailabilityCache_,
        'upsertAvailabilityCache': upsertAvailabilityCache_,
        'deleteAvailabilityCache': deleteAvailabilityCache_,
      'clearAllAvailabilityCache': clearAllAvailabilityCache_,
        'authenticateTrainer': authenticateTrainer_,
      'setTrainerPassword': setTrainerPassword_,
      'getTrainerByEmail': getTrainerByEmail_,
        'getTrainerBookings': getTrainerBookings_,
        'getStoreBookings': getStoreBookings_,
        'setStorePasscode': setStorePasscode_,
      'verifyStorePasscode': verifyStorePasscode_,
      'getStoreByName': getStoreByName_,
      };

      var handler = handlers[action];
      if (!handler) {
        return jsonResponse_({ error: '不明なアクションが指定されました' }, 400);
      }

      var result = handler(params);
      return jsonResponse_(result, 200);
    } catch (err) {
      Logger.log('doGet API error: ' + err.message + '\n' + err.stack);
      return jsonResponse_({ error: 'サーバーエラーが発生しました' }, 500);
    }
  }

  // payloadなしの場合はヘルスチェック
  return jsonResponse_({ status: 'ok', message: 'メラジム GAS API is running' }, 200);
}

/**
 * GASエディタから実行してシート接続をテストする関数
 */
function testConnection() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheets = ss.getSheets().map(function(s) { return s.getName(); });
  Logger.log('接続成功! シート一覧: ' + sheets.join(', '));
  Logger.log('API_KEY設定: ' + (API_KEY ? 'あり' : 'なし'));
  return sheets;
}

/**
 * 初期シートを自動作成する関数（初回セットアップ用）
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetConfigs = {
    'stores': ['id', 'name', 'area', 'address', 'google_calendar_id', 'business_hours_json', 'is_active', 'passcode_hash', 'created_at', 'updated_at'],
    'trainers': ['id', 'name', 'email', 'phone', 'photo_url', 'specialties_json', 'bio', 'is_first_visit_eligible', 'is_active', 'google_calendar_id', 'available_hours_json', 'password_hash', 'created_at', 'updated_at'],
    'trainer_stores': ['trainer_id', 'store_id', 'buffer_minutes'],
    'customers': ['id', 'line_uid', 'name', 'email', 'phone', 'age_group', 'is_first_visit_completed', 'favorite_trainer_id', 'created_at', 'updated_at'],
    'bookings': ['id', 'customer_id', 'trainer_id', 'store_id', 'scheduled_at', 'duration_minutes', 'booking_type', 'status', 'google_calendar_event_id', 'trainer_calendar_event_id', 'notes', 'cancelled_at', 'cancel_reason', 'created_at', 'updated_at'],
    'availability_cache': ['id', 'trainer_id', 'store_id', 'date', 'slots_json', 'fetched_at']
  };

  for (var name in sheetConfigs) {
    var existing = ss.getSheetByName(name);
    if (!existing) {
      var sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, sheetConfigs[name].length).setValues([sheetConfigs[name]]);
      sheet.getRange(1, 1, 1, sheetConfigs[name].length).setFontWeight('bold');
      Logger.log('シート作成: ' + name);
    } else {
      Logger.log('シート既存: ' + name);
    }
  }

  // デフォルトの「シート1」を削除
  var sheet1 = ss.getSheetByName('シート1');
  if (sheet1 && ss.getSheets().length > 1) {
    ss.deleteSheet(sheet1);
    Logger.log('「シート1」を削除しました');
  }

  Logger.log('セットアップ完了!');
}

// ---------- リクエストスコープキャッシュ ----------
// GASは1リクエスト=1実行のため、グローバル変数でリクエスト内キャッシュが可能
var rowCache_ = {};

/**
 * 指定シートのキャッシュを無効化（書き込み後に呼ぶ）
 */
function invalidateCache_(sheetName) {
  delete rowCache_[sheetName];
}

// ---------- ヘルパー ----------

function jsonResponse_(data, statusCode) {
  // GAS doPost は常に200を返すが、body内にstatusCodeを含める
  var output = ContentService.createTextOutput(
    JSON.stringify({ statusCode: statusCode, data: data })
  );
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function getSheet_(name) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(name);
}

/**
 * シートの全データをオブジェクト配列として取得
 */
function getAllRows_(sheetName) {
  // リクエストスコープキャッシュ: 同一リクエスト内で同じシートを何度も読まない
  if (rowCache_[sheetName]) return rowCache_[sheetName];

  var sheet = getSheet_(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  rowCache_[sheetName] = rows;
  return rows;
}

/**
 * シートの特定行を更新（idカラムで検索）
 */
function updateRowById_(sheetName, id, updates) {
  var sheet = getSheet_(sheetName);
  if (!sheet) return false;
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  if (idCol === -1) return false;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      for (var key in updates) {
        // プロトタイプ汚染対策: 自身のプロパティのみ処理
        if (!updates.hasOwnProperty(key)) continue;
        // 危険なプロパティ名を拒否
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        var col = headers.indexOf(key);
        if (col !== -1) {
          var value = updates[key];
          // JSONフィールドは文字列化して保存
          if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value);
          }
          // 数式インジェクション対策
          value = sanitizeForSheet_(value);
          sheet.getRange(i + 1, col + 1).setValue(value);
        }
      }
      invalidateCache_(sheetName);
      return true;
    }
  }
  return false;
}

/**
 * シートに行を追加
 */
function appendRow_(sheetName, rowObj) {
  var sheet = getSheet_(sheetName);
  if (!sheet) throw new Error('シートが見つかりません: ' + sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) throw new Error('シートにヘッダーがありません: ' + sheetName);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var val = rowObj[headers[i]];
    if (val === undefined || val === null) {
      row.push('');
    } else if (typeof val === 'object') {
      row.push(JSON.stringify(val));
    } else {
      // 数式インジェクション対策: 文字列値をサニタイズ
      row.push(sanitizeForSheet_(val));
    }
  }
  sheet.appendRow(row);
  invalidateCache_(sheetName);
}

/**
 * JSONフィールドをパース
 */
/**
 * スプレッドシートの値をbooleanに変換
 * TRUE/true/1/"TRUE"/"true"/"1"/boolean true → true、それ以外 → false
 */
function parseBool_(value) {
  if (value === true) return true;
  if (typeof value === 'string') {
    var lower = value.trim().toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
}

function parseJsonField_(value) {
  if (!value || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    Logger.log('parseJsonField_ failed for value: ' + String(value).substring(0, 100));
    return null;
  }
}

/**
 * storeの行をパース
 */
function parseStore_(row) {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address || '',
    google_calendar_id: row.google_calendar_id,
    business_hours: parseJsonField_(row.business_hours_json) || {
      monday: { open: '09:00', close: '23:00' },
      tuesday: { open: '09:00', close: '23:00' },
      wednesday: { open: '09:00', close: '23:00' },
      thursday: { open: '09:00', close: '23:00' },
      friday: { open: '09:00', close: '23:00' },
      saturday: { open: '09:00', close: '23:00' },
      sunday: { open: '09:00', close: '23:00' },
    },
    is_active: parseBool_(row.is_active),
    passcode_hash: row.passcode_hash || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
}

/**
 * trainerの行をパース
 */
function parseTrainer_(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
    photo_url: row.photo_url || null,
    specialties: parseJsonField_(row.specialties_json) || [],
    bio: row.bio || '',
    is_first_visit_eligible: parseBool_(row.is_first_visit_eligible),
    is_active: parseBool_(row.is_active),
    google_calendar_id: row.google_calendar_id || null,
    available_hours: parseJsonField_(row.available_hours_json) || { start: '09:00', end: '21:00' },
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
}

/**
 * bookingの行をパース
 */
function parseBooking_(row) {
  // scheduled_atはGASがDate型として読む場合があるためISO文字列に変換
  var scheduledAt = row.scheduled_at;
  if (scheduledAt instanceof Date) {
    scheduledAt = scheduledAt.toISOString();
  }
  var createdAt = row.created_at;
  if (createdAt instanceof Date) {
    createdAt = createdAt.toISOString();
  }
  var cancelledAt = row.cancelled_at;
  if (cancelledAt instanceof Date) {
    cancelledAt = cancelledAt.toISOString();
  }

  return {
    id: row.id,
    customer_id: row.customer_id,
    trainer_id: row.trainer_id,
    store_id: row.store_id,
    scheduled_at: scheduledAt || '',
    duration_minutes: Number(row.duration_minutes) || 60,
    booking_type: row.booking_type,
    status: row.status,
    google_calendar_event_id: row.google_calendar_event_id || null,
    trainer_calendar_event_id: row.trainer_calendar_event_id || null,
    notes: row.notes || null,
    cancelled_at: cancelledAt || null,
    cancel_reason: row.cancel_reason || null,
    created_at: createdAt || '',
    updated_at: row.updated_at || '',
  };
}

// ---------- アクションハンドラ ----------

/**
 * 店舗一覧取得
 */
function getStores_(params) {
  var rows = getAllRows_('stores');
  var stores = rows.map(parseStore_);

  if (params.activeOnly) {
    stores = stores.filter(function(s) { return s.is_active; });
  }

  // 名前順ソート
  stores.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return { stores: stores };
}

/**
 * トレーナー一覧取得（公開API用 - 店舗で絞り込み）
 */
function getTrainers_(params) {
  var storeId = params.storeId;
  var firstVisitOnly = params.firstVisitOnly === true || params.firstVisitOnly === 'true';

  // trainer_stores から該当店舗のトレーナーIDを取得
  var trainerStoreRows = getAllRows_('trainer_stores');
  var trainerIds = trainerStoreRows
    .filter(function(ts) { return ts.store_id === storeId; })
    .map(function(ts) { return ts.trainer_id; });

  if (trainerIds.length === 0) return { trainers: [] };

  var allTrainers = getAllRows_('trainers').map(parseTrainer_);
  var trainers = allTrainers.filter(function(t) {
    if (trainerIds.indexOf(t.id) === -1) return false;
    if (!t.is_active) return false;
    if (firstVisitOnly && !t.is_first_visit_eligible) return false;
    return true;
  });

  // 公開用フィールドのみ返す
  var result = trainers.map(function(t) {
    return {
      id: t.id,
      name: t.name,
      photo_url: t.photo_url,
      specialties: t.specialties,
      bio: t.bio,
      is_first_visit_eligible: t.is_first_visit_eligible,
    };
  });

  result.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return { trainers: result };
}

/**
 * トレーナー一覧取得（管理API用 - 全情報 + 紐づき店舗）
 */
function getTrainersFull_(params) {
  var allTrainers = getAllRows_('trainers').map(parseTrainer_);
  var trainerStoreRows = getAllRows_('trainer_stores');
  var allStores = getAllRows_('stores').map(parseStore_);

  var storeMap = {};
  allStores.forEach(function(s) { storeMap[s.id] = s.name; });

  var trainers = allTrainers.map(function(t) {
    var stores = trainerStoreRows
      .filter(function(ts) { return ts.trainer_id === t.id; })
      .map(function(ts) {
        return { store_id: ts.store_id, store_name: storeMap[ts.store_id] || '' };
      });
    t.stores = stores;
    return t;
  });

  trainers.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return { trainers: trainers };
}

/**
 * 予約作成（LockServiceでダブルブッキング防止）
 */
function createBooking_(params) {
  var lock = LockService.getScriptLock();
  try {
    // 10秒待ってロック取得（DoS対策: 長時間ロック待ちを防止）
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: 'この枠は他の方が予約手続き中です。しばらくしてからお試しください' };
  }

  try {
    var data = params;

    // 必須パラメータの検証
    if (!data.customer_id || !data.trainer_id || !data.store_id || !data.scheduled_at) {
      return { success: false, error: '必須項目が不足しています' };
    }

    // IDの形式チェック
    if (!isValidId_(String(data.customer_id)) || !isValidId_(String(data.trainer_id)) || !isValidId_(String(data.store_id))) {
      return { success: false, error: '不正なID形式です' };
    }

    // 参照整合性チェック: customer/trainer/storeの存在・有効性確認
    var allTrainers = getAllRows_('trainers');
    var trainer = null;
    for (var ti = 0; ti < allTrainers.length; ti++) {
      if (allTrainers[ti].id === data.trainer_id) {
        trainer = parseTrainer_(allTrainers[ti]);
        break;
      }
    }
    if (!trainer) {
      return { success: false, error: '指定されたトレーナーが見つかりません' };
    }
    if (!trainer.is_active) {
      return { success: false, error: 'このトレーナーは現在予約を受け付けていません' };
    }

    var allStores = getAllRows_('stores');
    var store = null;
    for (var si = 0; si < allStores.length; si++) {
      if (allStores[si].id === data.store_id) {
        store = parseStore_(allStores[si]);
        break;
      }
    }
    if (!store) {
      return { success: false, error: '指定された店舗が見つかりません' };
    }
    if (!store.is_active) {
      return { success: false, error: 'この店舗は現在予約を受け付けていません' };
    }

    var allCustomers = getAllRows_('customers');
    var customerExists = allCustomers.some(function(c) { return c.id === data.customer_id; });
    if (!customerExists) {
      return { success: false, error: '指定された顧客が見つかりません' };
    }

    // 過去日時チェック
    var scheduledDate = new Date(data.scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: '不正な日時形式です' };
    }
    var now = new Date();
    // 5分前までは許容（クライアントとのタイムラグ考慮）
    if (scheduledDate.getTime() < now.getTime() - 5 * 60 * 1000) {
      return { success: false, error: '過去の日時は予約できません' };
    }

    // バッファ時間の取得（trainer_storesから該当店舗のbuffer_minutes）
    var trainerStoreRows = getAllRows_('trainer_stores');
    var bufferMinutes = 0;
    for (var bi = 0; bi < trainerStoreRows.length; bi++) {
      if (trainerStoreRows[bi].trainer_id === data.trainer_id &&
          trainerStoreRows[bi].store_id === data.store_id) {
        bufferMinutes = Number(trainerStoreRows[bi].buffer_minutes) || 0;
        break;
      }
    }
    var DURATION_MINUTES = 60;
    var newStart = scheduledDate.getTime();
    var newEnd = newStart + DURATION_MINUTES * 60 * 1000;
    var bufferMs = bufferMinutes * 60 * 1000;

    // 同一トレーナーの時間帯重複チェック（バッファ込み、店舗をまたいだダブルブッキングも防止）
    var bookings = getAllRows_('bookings');
    var duplicate = bookings.some(function(b) {
      if (b.trainer_id !== data.trainer_id || b.status !== 'confirmed') return false;
      var existingAt = b.scheduled_at instanceof Date
        ? b.scheduled_at.getTime()
        : new Date(b.scheduled_at).getTime();
      if (isNaN(existingAt)) return false;
      var existingEnd = existingAt + (Number(b.duration_minutes) || DURATION_MINUTES) * 60 * 1000;
      // バッファを含めた重複判定: 新予約の開始-buffer ~ 終了+buffer が既存と重なるか
      return (newStart - bufferMs) < existingEnd && (newEnd + bufferMs) > existingAt;
    });

    if (duplicate) {
      return { success: false, error: 'この時間枠は既に予約済みです。別の時間をお選びください' };
    }

    var bookingId = Utilities.getUuid();
    var now = new Date().toISOString();

    var booking = {
      id: bookingId,
      customer_id: data.customer_id,
      trainer_id: data.trainer_id,
      store_id: data.store_id,
      scheduled_at: data.scheduled_at,
      duration_minutes: 60, // 固定値: クライアントからの改竄を防止
      booking_type: (data.booking_type === 'first_visit' || data.booking_type === 'regular') ? data.booking_type : 'regular',
      status: 'confirmed',
      google_calendar_event_id: data.google_calendar_event_id || '',
      trainer_calendar_event_id: data.trainer_calendar_event_id || '',
      notes: truncateString_(data.notes || '', MAX_STRING_LENGTH),
      cancelled_at: '',
      cancel_reason: '',
      created_at: now,
      updated_at: now,
    };

    appendRow_('bookings', booking);

    return { success: true, booking: parseBooking_(booking) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 予約ステータス更新（管理者用）
 * LockServiceで同時更新を防止
 */
function updateBookingStatus_(params) {
  var bookingId = params.id;
  var newStatus = params.status;

  // 入力検証
  if (!bookingId || !isValidId_(String(bookingId))) {
    return { success: false, error: '不正な予約IDです' };
  }
  var validStatuses = ['confirmed', 'completed', 'no_show', 'cancelled'];
  if (!newStatus || validStatuses.indexOf(newStatus) === -1) {
    return { success: false, error: '不正なステータスです' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: '他の処理が進行中です。しばらくしてからお試しください' };
  }

  try {
    // 予約の存在確認
    var bookings = getAllRows_('bookings');
    var booking = null;
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].id === bookingId) {
        booking = bookings[i];
        break;
      }
    }

    if (!booking) {
      return { success: false, error: '予約が見つかりません' };
    }

    var now = new Date().toISOString();
    var updates = {
      status: newStatus,
      updated_at: now,
    };

    // キャンセルの場合はキャンセル日時も記録
    if (newStatus === 'cancelled') {
      updates.cancelled_at = now;
    }

    var success = updateRowById_('bookings', bookingId, updates);
    return { success: success };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 予約キャンセル
 */
function cancelBooking_(params) {
  var bookingId = params.bookingId;
  var reason = params.reason || '';
  var isAdmin = params.isAdmin === true;
  var requesterId = params.customer_id || params.trainer_id || null;

  // IDの形式チェック
  if (!bookingId || !isValidId_(String(bookingId))) {
    return { success: false, error: '不正な予約IDです' };
  }

  // 認可チェック（ロック前に実施 — 不正リクエストでロックを占有させない）
  if (!isAdmin && !requesterId) {
    return { success: false, error: 'キャンセル権限の確認に必要な情報が不足しています' };
  }

  // キャンセル理由の文字列長制限
  reason = truncateString_(reason, MAX_STRING_LENGTH);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, error: '他の処理が進行中です。しばらくしてからお試しください' };
  }

  try {
    var bookings = getAllRows_('bookings');
    var booking = null;
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].id === bookingId) {
        booking = bookings[i];
        break;
      }
    }

    if (!booking) {
      return { success: false, error: '予約が見つかりません' };
    }

    // 当事者チェック（ロック内で最新データに対して実施）
    if (!isAdmin) {
      if (String(requesterId) !== String(booking.customer_id) &&
          String(requesterId) !== String(booking.trainer_id)) {
        return { success: false, error: 'この予約をキャンセルする権限がありません' };
      }
    }

    if (booking.status !== 'confirmed') {
      return { success: false, error: 'この予約はキャンセルできません' };
    }

    var now = new Date().toISOString();
    updateRowById_('bookings', bookingId, {
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: reason,
      updated_at: now,
    });

    // 更新後のデータを反映してからパース
    booking.status = 'cancelled';
    booking.cancelled_at = now;
    booking.cancel_reason = reason;
    booking.updated_at = now;

    // store情報を取得してカレンダーID返却
    var stores = getAllRows_('stores');
    var store = null;
    for (var j = 0; j < stores.length; j++) {
      if (stores[j].id === booking.store_id) {
        store = parseStore_(stores[j]);
        break;
      }
    }

    // trainer情報を取得してカレンダーID返却
    var trainers = getAllRows_('trainers');
    var trainerObj = null;
    for (var k = 0; k < trainers.length; k++) {
      if (trainers[k].id === booking.trainer_id) {
        trainerObj = parseTrainer_(trainers[k]);
        break;
      }
    }

    return {
      success: true,
      booking: parseBooking_(booking),
      store_google_calendar_id: store ? store.google_calendar_id : null,
      trainer_google_calendar_id: trainerObj ? trainerObj.google_calendar_id : null,
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 予約一覧取得（管理用・ページネーション付き）
 */
function getBookings_(params) {
  var limit = Math.min(Number(params.limit) || 50, 100);
  var page = Math.max(Number(params.page) || 1, 1);
  var offset = (page - 1) * limit;

  var allBookings = getAllRows_('bookings').map(parseBooking_);
  var allCustomers = getAllRows_('customers');
  var allTrainers = getAllRows_('trainers').map(parseTrainer_);
  var allStores = getAllRows_('stores').map(parseStore_);

  // 名前マップ作成
  var customerMap = {};
  allCustomers.forEach(function(c) { customerMap[c.id] = c.name; });
  var trainerMap = {};
  allTrainers.forEach(function(t) { trainerMap[t.id] = t.name; });
  var storeMap = {};
  allStores.forEach(function(s) { storeMap[s.id] = s.name; });

  // 日付降順ソート
  allBookings.sort(function(a, b) {
    return b.scheduled_at.localeCompare(a.scheduled_at);
  });

  var totalCount = allBookings.length;
  var paged = allBookings.slice(offset, offset + limit);

  var bookings = paged.map(function(b) {
    return {
      id: b.id,
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      status: b.status,
      booking_type: b.booking_type,
      customer_name: customerMap[b.customer_id] || '-',
      trainer_name: trainerMap[b.trainer_id] || '-',
      store_name: storeMap[b.store_id] || '-',
    };
  });

  return {
    bookings: bookings,
    pagination: {
      page: page,
      limit: limit,
      totalCount: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
}

/**
 * 統計取得
 */
function getStats_(params) {
  var allBookings = getAllRows_('bookings').map(parseBooking_);
  var allTrainers = getAllRows_('trainers').map(parseTrainer_);
  var allStores = getAllRows_('stores').map(parseStore_);

  var now = new Date();
  var todayStr = Utilities.formatDate(now, TIMEZONE, 'yyyy-MM-dd');

  // 今週の月曜日を計算
  var weekStart = new Date(now);
  var dayOfWeek = weekStart.getDay();
  var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // 今月
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  var todayBookings = 0;
  var weekBookings = 0;
  var monthBookings = 0;
  var monthCancelled = 0;

  allBookings.forEach(function(b) {
    var bookingDate = new Date(b.scheduled_at);
    var dateStr = Utilities.formatDate(bookingDate, TIMEZONE, 'yyyy-MM-dd');

    if (b.status === 'confirmed') {
      if (dateStr === todayStr) todayBookings++;
      if (bookingDate >= weekStart && bookingDate < weekEnd) weekBookings++;
      if (bookingDate >= monthStart && bookingDate <= monthEnd) monthBookings++;
    }

    if (b.status === 'cancelled') {
      var createdDate = new Date(b.created_at);
      if (createdDate >= monthStart) monthCancelled++;
    }
  });

  var activeTrainers = allTrainers.filter(function(t) { return t.is_active; }).length;
  var activeStores = allStores.filter(function(s) { return s.is_active; }).length;
  var totalMonth = monthBookings + monthCancelled;
  var cancelRate = totalMonth > 0 ? (monthCancelled / totalMonth) * 100 : 0;

  return {
    todayBookings: todayBookings,
    weekBookings: weekBookings,
    monthBookings: monthBookings,
    activeTrainers: activeTrainers,
    activeStores: activeStores,
    cancelRate: cancelRate,
  };
}

/**
 * トレーナー更新
 */
function updateTrainer_(params) {
  var id = params.id;
  if (!id || !isValidId_(String(id))) {
    return { success: false, error: '不正なトレーナーIDです' };
  }
  var updates = params.updates || {};

  // プロトタイプ汚染対策: 危険なプロパティを除去
  delete updates['__proto__'];
  delete updates['constructor'];
  delete updates['prototype'];

  // メールアドレス形式チェック（更新時）
  if (updates.email !== undefined && updates.email !== '' && !isValidEmail_(updates.email)) {
    return { success: false, error: 'メールアドレスの形式が不正です' };
  }

  // 文字列長制限
  if (updates.name) updates.name = truncateString_(updates.name, MAX_STRING_LENGTH);
  if (updates.bio) updates.bio = truncateString_(updates.bio, MAX_BIO_LENGTH);

  // JSONフィールドのマッピング
  if (updates.specialties !== undefined) {
    updates.specialties_json = updates.specialties;
    delete updates.specialties;
  }
  if (updates.available_hours !== undefined) {
    updates.available_hours_json = updates.available_hours;
    delete updates.available_hours;
  }
  updates.updated_at = new Date().toISOString();

  return withLock_(function() {
    var success = updateRowById_('trainers', id, updates);

    // トレーナー無効化時のカスケード処理
    if (updates.is_active === false || updates.is_active === 'false') {
      // 未来の確定予約を検出
      var now = new Date();
      var allBookings = getAllRows_('bookings');
      var futureBookings = allBookings.filter(function(b) {
        if (b.trainer_id !== id || b.status !== 'confirmed') return false;
        var bookingDate = b.scheduled_at instanceof Date
          ? b.scheduled_at
          : new Date(b.scheduled_at);
        return bookingDate.getTime() > now.getTime();
      });

      // 可用性キャッシュを削除（このトレーナーの全キャッシュ）
      var cacheSheet = getSheet_('availability_cache');
      if (cacheSheet) {
        var cacheData = cacheSheet.getDataRange().getValues();
        var cacheHeaders = cacheData[0];
        var cacheTrainerCol = cacheHeaders.indexOf('trainer_id');
        for (var ci = cacheData.length - 1; ci >= 1; ci--) {
          if (String(cacheData[ci][cacheTrainerCol]) === String(id)) {
            cacheSheet.deleteRow(ci + 1);
          }
        }
        invalidateCache_('availability_cache');
      }

      return {
        success: success,
        deactivated: true,
        futureBookingsCount: futureBookings.length,
        futureBookings: futureBookings.slice(0, 10).map(function(b) {
          return {
            id: b.id,
            scheduled_at: b.scheduled_at instanceof Date ? b.scheduled_at.toISOString() : String(b.scheduled_at),
            store_id: b.store_id,
          };
        }),
      };
    }

    // トレーナー有効化時: 店舗割当がなければ警告
    if (updates.is_active === true || updates.is_active === 'true') {
      var trainerStoreRows = getAllRows_('trainer_stores');
      var assignedStores = trainerStoreRows.filter(function(ts) {
        return ts.trainer_id === id;
      });
      if (assignedStores.length === 0) {
        return {
          success: success,
          warning: 'このトレーナーに店舗が割り当てられていません。予約画面に表示するには店舗を割り当ててください。',
        };
      }
    }

    return { success: success };
  });
}

/**
 * トレーナーをハードデリート（カスケード処理付き）
 * - 未来の確定予約がある場合は削除を拒否
 * - trainer_stores, availability_cacheから該当行を削除
 * - trainersシートから該当行を削除
 * - 過去・キャンセル済み予約は履歴として保持
 */
function deleteTrainer_(params) {
  var trainerId = params.id;

  if (!isValidId_(trainerId)) {
    return { success: false, error: 'トレーナーIDが無効です' };
  }

  return withLock_(function() {
    // トレーナーの存在確認
    var trainersSheet = getSheet_('trainers');
    var trainersData = trainersSheet.getDataRange().getValues();
    var trainersHeaders = trainersData[0];
    var trainerIdCol = trainersHeaders.indexOf('id');
    var trainerNameCol = trainersHeaders.indexOf('name');
    var trainerRowIndex = -1;
    var trainerName = '';

    for (var i = 1; i < trainersData.length; i++) {
      if (String(trainersData[i][trainerIdCol]) === String(trainerId)) {
        trainerRowIndex = i + 1; // シートの行番号（1始まり、ヘッダー分+1）
        trainerName = trainersData[i][trainerNameCol];
        break;
      }
    }

    if (trainerRowIndex === -1) {
      return { success: false, error: 'トレーナーが見つかりません' };
    }

    // 未来の確定予約チェック
    var now = new Date();
    var bookingsRows = getAllRows_('bookings');
    var futureConfirmedCount = 0;

    for (var b = 0; b < bookingsRows.length; b++) {
      var booking = bookingsRows[b];
      if (String(booking.trainer_id) !== String(trainerId)) continue;
      if (booking.status === 'cancelled') continue;

      var scheduledAt = new Date(booking.scheduled_at);
      if (scheduledAt > now) {
        futureConfirmedCount++;
      }
    }

    if (futureConfirmedCount > 0) {
      return {
        success: false,
        error: '未来の確定予約があるため削除できません。先に予約をキャンセルしてください。',
        futureBookingsCount: futureConfirmedCount,
      };
    }

    // カスケード削除: trainer_stores
    var tsSheet = getSheet_('trainer_stores');
    if (tsSheet) {
      var tsData = tsSheet.getDataRange().getValues();
      var tsTrainerIdCol = tsData[0].indexOf('trainer_id');
      // 下から削除して行番号のずれを防ぐ
      for (var ts = tsData.length - 1; ts >= 1; ts--) {
        if (String(tsData[ts][tsTrainerIdCol]) === String(trainerId)) {
          tsSheet.deleteRow(ts + 1);
        }
      }
      invalidateCache_('trainer_stores');
    }

    // カスケード削除: availability_cache
    var acSheet = getSheet_('availability_cache');
    if (acSheet) {
      var acData = acSheet.getDataRange().getValues();
      var acTrainerIdCol = acData[0].indexOf('trainer_id');
      // 下から削除して行番号のずれを防ぐ
      for (var ac = acData.length - 1; ac >= 1; ac--) {
        if (String(acData[ac][acTrainerIdCol]) === String(trainerId)) {
          acSheet.deleteRow(ac + 1);
        }
      }
      invalidateCache_('availability_cache');
    }

    // トレーナー行を削除
    trainersSheet.deleteRow(trainerRowIndex);
    invalidateCache_('trainers');

    return {
      success: true,
      deletedTrainer: { id: trainerId, name: trainerName },
    };
  });
}

/**
 * トレーナーの対応店舗を更新（全削除→再挿入）
 */
function updateTrainerStores_(params) {
  var trainerId = params.trainerId;
  var storeIds = params.storeIds || [];

  if (!trainerId) return { success: false, error: 'トレーナーIDは必須です' };

  return withLock_(function() {
    // 既存の紐付けを全削除
    var sheet = getSheet_('trainer_stores');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var trainerIdCol = headers.indexOf('trainer_id');
      // 下から削除（行番号がずれないように）
      for (var i = data.length - 1; i >= 1; i--) {
        if (String(data[i][trainerIdCol]) === String(trainerId)) {
          sheet.deleteRow(i + 1);
        }
      }
      invalidateCache_('trainer_stores');
    }

    // storeIdの存在検証
    var allStores = getAllRows_('stores');
    var storeIdSet = {};
    allStores.forEach(function(s) { storeIdSet[s.id] = true; });

    // 新しい紐付けを挿入
    for (var j = 0; j < storeIds.length; j++) {
      if (!storeIdSet[storeIds[j]]) {
        return { success: false, error: '存在しない店舗IDが含まれています: ' + storeIds[j] };
      }
      appendRow_('trainer_stores', {
        trainer_id: trainerId,
        store_id: storeIds[j],
        buffer_minutes: 30
      });
    }

    return { success: true };
  });
}

/**
 * トレーナー追加
 */
function addTrainer_(params) {
  // 必須パラメータ検証
  if (!params.name || typeof params.name !== 'string' || params.name.trim().length === 0) {
    return { success: false, error: 'トレーナー名は必須です' };
  }

  // メールアドレス形式チェック
  if (params.email && !isValidEmail_(params.email)) {
    return { success: false, error: 'メールアドレスの形式が不正です' };
  }

  // 文字列長制限
  var name = truncateString_(params.name, MAX_STRING_LENGTH);
  var bio = truncateString_(params.bio || '', MAX_BIO_LENGTH);

  return withLock_(function() {
    // メール重複チェック
    if (params.email) {
      var existingTrainers = getAllRows_('trainers');
      var dup = existingTrainers.some(function(t) { return t.email === params.email; });
      if (dup) {
        return { success: false, error: 'このメールアドレスは既に登録されています' };
      }
    }

    var id = Utilities.getUuid();
    var now = new Date().toISOString();

    var trainer = {
      id: id,
      name: name,
      email: params.email || '',
      phone: params.phone || '',
      photo_url: params.photo_url || '',
      specialties_json: JSON.stringify(params.specialties || []),
      bio: bio,
      is_first_visit_eligible: params.is_first_visit_eligible || false,
      is_active: params.is_active !== undefined ? params.is_active : true,
      google_calendar_id: params.google_calendar_id || '',
      available_hours_json: JSON.stringify(params.available_hours || { start: '09:00', end: '21:00' }),
      created_at: now,
      updated_at: now,
    };

    appendRow_('trainers', trainer);

    // 対応店舗の紐付け
    if (params.store_ids && params.store_ids.length > 0) {
      params.store_ids.forEach(function(storeId) {
        appendRow_('trainer_stores', {
          trainer_id: id,
          store_id: storeId,
          buffer_minutes: 30,
        });
      });
    }

    return { success: true, id: id };
  });
}

/**
 * 店舗追加
 */
function addStore_(params) {
  if (!params.name || !params.area) {
    return { success: false, error: '店舗名とエリアは必須です' };
  }

  return withLock_(function() {
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    var businessHours = params.business_hours || {
      monday:    { open: '09:00', close: '23:00' },
      tuesday:   { open: '09:00', close: '23:00' },
      wednesday: { open: '09:00', close: '23:00' },
      thursday:  { open: '09:00', close: '23:00' },
      friday:    { open: '09:00', close: '23:00' },
      saturday:  { open: '09:00', close: '23:00' },
      sunday:    { open: '09:00', close: '23:00' }
    };

    appendRow_('stores', {
      id: id,
      name: sanitizeForSheet_(String(params.name).substring(0, 100)),
      area: sanitizeForSheet_(String(params.area).substring(0, 100)),
      address: sanitizeForSheet_(String(params.address || '').substring(0, 200)),
      google_calendar_id: String(params.google_calendar_id || ''),
      business_hours_json: JSON.stringify(businessHours),
      is_active: true,
      created_at: now,
      updated_at: now
    });

    return { success: true, id: id };
  });
}

/**
 * 店舗更新
 */
function updateStore_(params) {
  var id = params.id;
  if (!id || !isValidId_(String(id))) {
    return { success: false, error: '不正な店舗IDです' };
  }
  var updates = params.updates || {};

  // プロトタイプ汚染対策: 危険なプロパティを除去
  delete updates['__proto__'];
  delete updates['constructor'];
  delete updates['prototype'];

  // JSONフィールドのマッピング
  if (updates.business_hours !== undefined) {
    updates.business_hours_json = updates.business_hours;
    delete updates.business_hours;
  }
  updates.updated_at = new Date().toISOString();

  return withLock_(function() {
    var success = updateRowById_('stores', id, updates);

    // 無効化時のカスケード処理: availability_cache削除 + 予約警告
    if (updates.is_active === false || updates.is_active === 'false') {
      // availability_cacheからそのstore_idの行を全削除
      var cacheSheet = getSheet_('availability_cache');
      if (cacheSheet) {
        var cacheData = cacheSheet.getDataRange().getValues();
        var cacheHeaders = cacheData[0];
        var cacheStoreIdCol = cacheHeaders.indexOf('store_id');
        for (var ci = cacheData.length - 1; ci >= 1; ci--) {
          if (String(cacheData[ci][cacheStoreIdCol]) === String(id)) {
            cacheSheet.deleteRow(ci + 1);
          }
        }
        invalidateCache_('availability_cache');
      }

      // 未来の確定予約数を警告として返す
      var now = new Date();
      var allBookings = getAllRows_('bookings');
      var futureCount = 0;
      for (var bi = 0; bi < allBookings.length; bi++) {
        if (String(allBookings[bi].store_id) !== String(id) || allBookings[bi].status !== 'confirmed') continue;
        var bookingDate = allBookings[bi].scheduled_at instanceof Date
          ? allBookings[bi].scheduled_at
          : new Date(allBookings[bi].scheduled_at);
        if (bookingDate.getTime() > now.getTime()) {
          futureCount++;
        }
      }

      if (futureCount > 0) {
        return {
          success: success,
          warning: 'この店舗には未来の確定予約が' + futureCount + '件あります。必要に応じて対応してください。',
        };
      }
    }

    return { success: success };
  });
}

/**
 * LINE UIDで顧客検索
 */
function getCustomerByLineUid_(params) {
  var lineUid = params.line_uid;
  var customers = getAllRows_('customers');
  for (var i = 0; i < customers.length; i++) {
    if (customers[i].line_uid === lineUid) {
      return { customer: customers[i] };
    }
  }
  return { customer: null };
}

/**
 * 顧客作成/更新
 */
function upsertCustomer_(params) {
  var customerId = params.id;
  var data = params.data;

  if (!data) {
    return { success: false, error: '顧客データが不足しています' };
  }

  // プロトタイプ汚染対策: 危険なプロパティを除去
  delete data['__proto__'];
  delete data['constructor'];
  delete data['prototype'];

  // メールアドレス形式チェック
  if (data.email && !isValidEmail_(data.email)) {
    return { success: false, error: 'メールアドレスの形式が不正です' };
  }

  // 文字列長制限
  if (data.name) data.name = truncateString_(data.name, MAX_STRING_LENGTH);
  if (data.email) data.email = truncateString_(data.email, MAX_STRING_LENGTH);
  if (data.phone) data.phone = truncateString_(data.phone, 20);

  return withLock_(function() {
    if (customerId) {
      // IDの形式チェック
      if (!isValidId_(String(customerId))) {
        return { success: false, error: '不正な顧客IDです' };
      }
      // 更新
      data.updated_at = new Date().toISOString();
      updateRowById_('customers', customerId, data);
      return { success: true, id: customerId };
    }

    // line_uid重複チェック
    if (data.line_uid) {
      var existing = getAllRows_('customers');
      var dup = existing.some(function(c) { return c.line_uid === data.line_uid; });
      if (dup) {
        // 既存顧客を更新
        var existingCustomer = existing.filter(function(c) { return c.line_uid === data.line_uid; })[0];
        data.updated_at = new Date().toISOString();
        updateRowById_('customers', existingCustomer.id, data);
        return { success: true, id: existingCustomer.id };
      }
    }

    // 新規作成
    var id = Utilities.getUuid();
    var now = new Date().toISOString();
    var customer = {
      id: id,
      line_uid: data.line_uid || '',
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      age_group: data.age_group || '',
      is_first_visit_completed: false,
      favorite_trainer_id: data.favorite_trainer_id || '',
      created_at: now,
      updated_at: now,
    };

    appendRow_('customers', customer);
    return { success: true, id: id };
  });
}

/**
 * 予約IDで予約取得（カレンダーID付き）
 */
function getBookingById_(params) {
  var bookingId = params.bookingId;
  var bookings = getAllRows_('bookings');
  var booking = null;
  for (var i = 0; i < bookings.length; i++) {
    if (bookings[i].id === bookingId) {
      booking = parseBooking_(bookings[i]);
      break;
    }
  }

  if (!booking) return { booking: null };

  // store情報も付与
  var stores = getAllRows_('stores');
  var store = null;
  for (var j = 0; j < stores.length; j++) {
    if (stores[j].id === booking.store_id) {
      store = parseStore_(stores[j]);
      break;
    }
  }

  return {
    booking: booking,
    store_google_calendar_id: store ? store.google_calendar_id : null,
  };
}

/**
 * トレーナー別予約件数取得（稼働率均等化用）
 */
function getBookingCountsForTrainers_(params) {
  var trainerIds = params.trainerIds;
  var startDate = params.startDate;
  var endDate = params.endDate;

  var bookings = getAllRows_('bookings').map(parseBooking_);
  var counts = {};
  trainerIds.forEach(function(id) { counts[id] = 0; });

  bookings.forEach(function(b) {
    if (trainerIds.indexOf(b.trainer_id) !== -1 &&
        b.status === 'confirmed' &&
        b.scheduled_at >= startDate &&
        b.scheduled_at < endDate) {
      counts[b.trainer_id] = (counts[b.trainer_id] || 0) + 1;
    }
  });

  return { counts: counts };
}

/**
 * 店舗に紐づくトレーナー情報取得（空き枠計算用）
 */
function getTrainerStoresByStore_(params) {
  var storeId = params.storeId;
  var trainerStoreRows = getAllRows_('trainer_stores');
  var allTrainers = getAllRows_('trainers').map(parseTrainer_);

  var trainerMap = {};
  allTrainers.forEach(function(t) { trainerMap[t.id] = t; });

  var results = trainerStoreRows
    .filter(function(ts) { return ts.store_id === storeId; })
    .map(function(ts) {
      return {
        trainer_id: ts.trainer_id,
        store_id: ts.store_id,
        buffer_minutes: Number(ts.buffer_minutes) || 0,
        trainer: trainerMap[ts.trainer_id] || null,
      };
    })
    .filter(function(ts) { return ts.trainer !== null; });

  return { trainerStores: results };
}

/**
 * 空き枠キャッシュ取得
 */
function getAvailabilityCache_(params) {
  var trainerId = params.trainer_id;
  var storeId = params.store_id;
  var date = params.date;

  var rows = getAllRows_('availability_cache');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].trainer_id === trainerId &&
        rows[i].store_id === storeId &&
        rows[i].date === date) {
      return {
        cache: {
          slots: parseJsonField_(rows[i].slots_json),
          fetched_at: rows[i].fetched_at,
        },
      };
    }
  }
  return { cache: null };
}

/**
 * 空き枠キャッシュ保存/更新
 */
function upsertAvailabilityCache_(params) {
  var trainerId = params.trainer_id;
  var storeId = params.store_id;
  var date = params.date;
  var slots = params.slots;
  var fetchedAt = params.fetched_at;

  return withLock_(function() {
    var sheet = getSheet_('availability_cache');
    if (!sheet) throw new Error('availability_cacheシートが見つかりません');

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var trainerIdCol = headers.indexOf('trainer_id');
    var storeIdCol = headers.indexOf('store_id');
    var dateCol = headers.indexOf('date');

    // 既存行を検索（重複がある場合は最初の1行を更新、残りを削除）
    var matchedRows = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][trainerIdCol] === trainerId &&
          data[i][storeIdCol] === storeId &&
          data[i][dateCol] === date) {
        matchedRows.push(i);
      }
    }

    if (matchedRows.length > 0) {
      // 最初の行を更新
      var firstRow = matchedRows[0];
      var slotsCol = headers.indexOf('slots_json');
      var fetchedAtCol = headers.indexOf('fetched_at');
      sheet.getRange(firstRow + 1, slotsCol + 1).setValue(JSON.stringify(slots));
      sheet.getRange(firstRow + 1, fetchedAtCol + 1).setValue(fetchedAt);

      // 重複行を下から削除
      for (var d = matchedRows.length - 1; d >= 1; d--) {
        sheet.deleteRow(matchedRows[d] + 1);
      }

      invalidateCache_('availability_cache');
      return { success: true };
    }

    // 新規追加
    appendRow_('availability_cache', {
      id: Utilities.getUuid(),
      trainer_id: trainerId,
      store_id: storeId,
      date: date,
      slots_json: JSON.stringify(slots),
      fetched_at: fetchedAt,
    });

    return { success: true };
  });
}

/**
 * トレーナー認証（メール + パスワード）
 * パスワード未設定のトレーナーは従来通りメールのみで認証（段階的移行）
 */
function authenticateTrainer_(params) {
  var email = params.email;
  var password = params.password;

  if (!email || !isValidEmail_(email)) {
    return { success: false, error: 'メールアドレスが不正です' };
  }

  var allRows = getAllRows_('trainers');
  var trainerRow = null;
  for (var i = 0; i < allRows.length; i++) {
    if (allRows[i].email === email) {
      trainerRow = allRows[i];
      break;
    }
  }

  // セキュリティ: 存在しないメールでも同じレスポンスを返す
  if (!trainerRow) {
    return { success: false, error: 'メールアドレスまたはパスワードが無効です' };
  }

  var trainer = parseTrainer_(trainerRow);

  if (!trainer.is_active) {
    return { success: false, error: 'メールアドレスまたはパスワードが無効です' };
  }

  // パスワードが設定されている場合は検証必須
  var storedHash = trainerRow.password_hash;
  if (storedHash && String(storedHash).trim() !== '') {
    if (!password || !verifyPassword_(password, String(storedHash))) {
      return { success: false, error: 'メールアドレスまたはパスワードが無効です' };
    }
  }
  // パスワード未設定の場合は従来通りメールのみで通す（段階的移行）

  return {
    success: true,
    trainer: {
      id: trainer.id,
      name: trainer.name,
      email: trainer.email,
    },
    requiresPasswordSetup: !storedHash || String(storedHash).trim() === '',
  };
}

/**
 * トレーナーパスワード設定/変更
 */
function setTrainerPassword_(params) {
  var trainerId = params.trainer_id;
  var newPassword = params.new_password;

  if (!trainerId || !isValidId_(String(trainerId))) {
    return { success: false, error: '不正なトレーナーIDです' };
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return { success: false, error: 'パスワードは8文字以上で設定してください' };
  }
  if (newPassword.length > 128) {
    return { success: false, error: 'パスワードが長すぎます' };
  }

  return withLock_(function() {
    var hash = hashPassword_(newPassword);
    var success = updateRowById_('trainers', trainerId, {
      password_hash: hash,
      updated_at: new Date().toISOString(),
    });
    return { success: success };
  });
}

/**
 * メールアドレスでトレーナーを検索
 */
function getTrainerByEmail_(params) {
  var email = params.email;
  if (!email) return { trainer: null };

  var allTrainers = getAllRows_('trainers').map(parseTrainer_);
  var trainer = null;
  for (var i = 0; i < allTrainers.length; i++) {
    if (allTrainers[i].email === email) {
      trainer = allTrainers[i];
      break;
    }
  }

  return { trainer: trainer };
}

/**
 * トレーナーIDで予約一覧を取得（顧客名・店舗名付き）
 */
function getTrainerBookings_(params) {
  var trainerId = params.trainer_id;
  if (!trainerId) return { bookings: [] };
  if (!isValidId_(String(trainerId))) return { bookings: [] };

  var allBookings = getAllRows_('bookings').map(parseBooking_);
  var allCustomers = getAllRows_('customers');
  var allStores = getAllRows_('stores').map(parseStore_);

  var customerMap = {};
  allCustomers.forEach(function(c) { customerMap[c.id] = c.name; });
  var storeMap = {};
  allStores.forEach(function(s) { storeMap[s.id] = s.name; });

  var trainerBookings = allBookings.filter(function(b) {
    return b.trainer_id === trainerId && b.status === 'confirmed';
  });

  // 日付昇順ソート
  trainerBookings.sort(function(a, b) {
    return a.scheduled_at.localeCompare(b.scheduled_at);
  });

  var bookings = trainerBookings.map(function(b) {
    return {
      id: b.id,
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      status: b.status,
      booking_type: b.booking_type,
      customer_name: customerMap[b.customer_id] || '-',
      store_name: storeMap[b.store_id] || '-',
      notes: b.notes || '',
    };
  });

  return { bookings: bookings };
}

/**
 * 空き枠キャッシュ削除
 */
function deleteAvailabilityCache_(params) {
  var trainerId = params.trainer_id;
  var storeId = params.store_id;
  var date = params.date;

  return withLock_(function() {
    var sheet = getSheet_('availability_cache');
    if (!sheet) return { success: true };

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var trainerIdCol = headers.indexOf('trainer_id');
    var storeIdCol = headers.indexOf('store_id');
    var dateCol = headers.indexOf('date');

    // 下から削除（行番号のずれ防止）
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][trainerIdCol] === trainerId &&
          data[i][storeIdCol] === storeId &&
          data[i][dateCol] === date) {
        sheet.deleteRow(i + 1);
      }
    }
    invalidateCache_('availability_cache');

    return { success: true };
  });
}

/**
 * 全キャッシュクリア（管理者用・デバッグ用）
 */
function clearAllAvailabilityCache_(params) {
  return withLock_(function() {
    var sheet = getSheet_('availability_cache');
    if (!sheet) return { success: true, deleted: 0 };
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, deleted: 0 };
    var count = lastRow - 1;
    sheet.deleteRows(2, count);
    invalidateCache_('availability_cache');
    return { success: true, deleted: count };
  });
}

// ---------- 店舗管理画面用アクション ----------

/**
 * 店舗パスコード設定（管理者用）
 * パスコードをSHA-256+saltでハッシュ化して保存
 */
function setStorePasscode_(params) {
  var storeId = params.store_id;
  var passcode = params.passcode;

  if (!storeId || !isValidId_(String(storeId))) {
    return { success: false, error: '不正な店舗IDです' };
  }
  if (!passcode || typeof passcode !== 'string' || !/^\d{4,8}$/.test(passcode)) {
    return { success: false, error: 'パスコードは4〜8桁の数字で設定してください' };
  }

  return withLock_(function() {
    var hash = hashPassword_(passcode);
    var success = updateRowById_('stores', storeId, {
      passcode_hash: hash,
      updated_at: new Date().toISOString(),
    });
    return { success: success };
  });
}

/**
 * 店舗パスコード検証
 */
function verifyStorePasscode_(params) {
  var storeName = params.name;
  var passcode = params.passcode;

  if (!storeName) return { success: false, error: '店舗名が必要です' };

  var rows = getAllRows_('stores');
  var store = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === storeName) {
      store = parseStore_(rows[i]);
      break;
    }
  }

  if (!store || !store.is_active) {
    return { success: false, error: '店舗名が無効です' };
  }

  // パスコードハッシュが設定されている場合は検証
  if (store.passcode_hash && String(store.passcode_hash).trim() !== '') {
    if (!passcode || !verifyPassword_(passcode, store.passcode_hash)) {
      return { success: false, error: 'パスコードが正しくありません' };
    }
  }

  return {
    success: true,
    store: {
      id: store.id,
      name: store.name,
      area: store.area,
    },
  };
}

/**
 * 店舗削除（カスケード処理付き）
 * - 未来の確定予約がある場合は削除を拒否
 * - trainer_stores, availability_cache から該当行を削除
 */
function deleteStore_(params) {
  var storeId = params.id;
  if (!storeId || !isValidId_(String(storeId))) {
    return { success: false, error: '不正な店舗IDです' };
  }

  return withLock_(function() {
    // 1. 店舗存在確認
    var stores = getAllRows_('stores');
    var storeExists = false;
    for (var i = 0; i < stores.length; i++) {
      if (String(stores[i].id) === String(storeId)) {
        storeExists = true;
        break;
      }
    }
    if (!storeExists) {
      return { success: false, error: '指定された店舗が見つかりません' };
    }

    // 2. 未来の確定予約チェック
    var now = new Date();
    var allBookings = getAllRows_('bookings');
    var futureBookings = allBookings.filter(function(b) {
      if (String(b.store_id) !== String(storeId) || b.status !== 'confirmed') return false;
      var bookingDate = b.scheduled_at instanceof Date
        ? b.scheduled_at
        : new Date(b.scheduled_at);
      return bookingDate.getTime() > now.getTime();
    });
    if (futureBookings.length > 0) {
      return {
        success: false,
        error: '未来の確定予約が' + futureBookings.length + '件あるため削除できません。先に予約をキャンセルしてください。',
      };
    }

    // 3. trainer_stores から該当store_idの行を削除
    var tsSheet = getSheet_('trainer_stores');
    if (tsSheet) {
      var tsData = tsSheet.getDataRange().getValues();
      var tsHeaders = tsData[0];
      var tsStoreIdCol = tsHeaders.indexOf('store_id');
      for (var ti = tsData.length - 1; ti >= 1; ti--) {
        if (String(tsData[ti][tsStoreIdCol]) === String(storeId)) {
          tsSheet.deleteRow(ti + 1);
        }
      }
      invalidateCache_('trainer_stores');
    }

    // 4. availability_cache から該当store_idの行を削除
    var cacheSheet = getSheet_('availability_cache');
    if (cacheSheet) {
      var cacheData = cacheSheet.getDataRange().getValues();
      var cacheHeaders = cacheData[0];
      var cacheStoreIdCol = cacheHeaders.indexOf('store_id');
      for (var ci = cacheData.length - 1; ci >= 1; ci--) {
        if (String(cacheData[ci][cacheStoreIdCol]) === String(storeId)) {
          cacheSheet.deleteRow(ci + 1);
        }
      }
      invalidateCache_('availability_cache');
    }

    // 5. stores シートから行を削除
    var storeSheet = getSheet_('stores');
    if (storeSheet) {
      var storeData = storeSheet.getDataRange().getValues();
      var storeHeaders = storeData[0];
      var storeIdCol = storeHeaders.indexOf('id');
      for (var si = storeData.length - 1; si >= 1; si--) {
        if (String(storeData[si][storeIdCol]) === String(storeId)) {
          storeSheet.deleteRow(si + 1);
          break;
        }
      }
      invalidateCache_('stores');
    }

    return { success: true };
  });
}

/**
 * 店舗名で店舗を検索
 */
function getStoreByName_(params) {
  var name = params.name;
  if (!name) return { store: null };

  var rows = getAllRows_('stores');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === name) {
      return { store: parseStore_(rows[i]) };
    }
  }
  return { store: null };
}

/**
 * store_idで予約一覧を取得（トレーナー名・顧客名付き）
 */
function getStoreBookings_(params) {
  var storeId = params.storeId;
  if (!storeId) return { bookings: [] };
  if (!isValidId_(String(storeId))) return { bookings: [] };

  var allBookings = getAllRows_('bookings').map(parseBooking_);
  var allCustomers = getAllRows_('customers');
  var allTrainers = getAllRows_('trainers').map(parseTrainer_);

  // 名前マップ作成
  var customerMap = {};
  allCustomers.forEach(function(c) { customerMap[c.id] = c.name; });
  var trainerMap = {};
  allTrainers.forEach(function(t) { trainerMap[t.id] = t.name; });

  // この店舗の予約のみフィルタ
  var storeBookings = allBookings.filter(function(b) {
    return b.store_id === storeId;
  });

  // 日付フィルタ
  if (params.date) {
    storeBookings = storeBookings.filter(function(b) {
      return b.scheduled_at && b.scheduled_at.indexOf(params.date) === 0;
    });
  }

  // ステータスフィルタ
  if (params.status) {
    storeBookings = storeBookings.filter(function(b) {
      return b.status === params.status;
    });
  }

  // 日付降順ソート
  storeBookings.sort(function(a, b) {
    return b.scheduled_at.localeCompare(a.scheduled_at);
  });

  var bookings = storeBookings.map(function(b) {
    return {
      id: b.id,
      customer_name: customerMap[b.customer_id] || '-',
      trainer_name: trainerMap[b.trainer_id] || '-',
      scheduled_at: b.scheduled_at,
      duration_minutes: b.duration_minutes,
      booking_type: b.booking_type,
      status: b.status,
      notes: b.notes,
      created_at: b.created_at,
    };
  });

  return { bookings: bookings };
}
