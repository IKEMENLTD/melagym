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
  if (firstChar === '=' || firstChar === '+' || firstChar === '-' ||
      firstChar === '@' || firstChar === '\t' || firstChar === '\r' || firstChar === '\n') {
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
      'getBookings': getBookings_,
      'getStats': getStats_,
      'updateTrainer': updateTrainer_,
      'addTrainer': addTrainer_,
      'updateTrainerStores': updateTrainerStores_,
      'addStore': addStore_,
      'updateStore': updateStore_,
      'getCustomerByLineUid': getCustomerByLineUid_,
      'upsertCustomer': upsertCustomer_,
      'getBookingById': getBookingById_,
      'getBookingCountsForTrainers': getBookingCountsForTrainers_,
      'getTrainerStoresByStore': getTrainerStoresByStore_,
      'getAvailabilityCache': getAvailabilityCache_,
      'upsertAvailabilityCache': upsertAvailabilityCache_,
      'deleteAvailabilityCache': deleteAvailabilityCache_,
      'getTrainerByEmail': getTrainerByEmail_,
      'getTrainerBookings': getTrainerBookings_,
      'getStoreBookings': getStoreBookings_,
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
    try {
      var payload = JSON.parse(e.parameter.payload);

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
        'updateTrainerStores': updateTrainerStores_,
        'addStore': addStore_,
        'updateStore': updateStore_,
        'getCustomerByLineUid': getCustomerByLineUid_,
        'upsertCustomer': upsertCustomer_,
        'getBookingById': getBookingById_,
        'getBookingCountsForTrainers': getBookingCountsForTrainers_,
        'getTrainerStoresByStore': getTrainerStoresByStore_,
        'getAvailabilityCache': getAvailabilityCache_,
        'upsertAvailabilityCache': upsertAvailabilityCache_,
        'deleteAvailabilityCache': deleteAvailabilityCache_,
        'getTrainerByEmail': getTrainerByEmail_,
        'getTrainerBookings': getTrainerBookings_,
        'getStoreBookings': getStoreBookings_,
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
    'stores': ['id', 'name', 'area', 'address', 'google_calendar_id', 'business_hours_json', 'is_active', 'created_at', 'updated_at'],
    'trainers': ['id', 'name', 'email', 'phone', 'photo_url', 'specialties_json', 'bio', 'is_first_visit_eligible', 'is_active', 'google_calendar_id', 'available_hours_json', 'created_at', 'updated_at'],
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
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
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
}

/**
 * JSONフィールドをパース
 */
function parseJsonField_(value) {
  if (!value || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
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
    business_hours: parseJsonField_(row.business_hours_json) || {},
    is_active: row.is_active === true || row.is_active === 'TRUE' || row.is_active === 'true',
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
    is_first_visit_eligible: row.is_first_visit_eligible === true || row.is_first_visit_eligible === 'TRUE' || row.is_first_visit_eligible === 'true',
    is_active: row.is_active === true || row.is_active === 'TRUE' || row.is_active === 'true',
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

    // 同一トレーナー・同一時刻の重複チェック（店舗をまたいだダブルブッキングも防止）
    var bookings = getAllRows_('bookings');
    var scheduledAtStr = String(data.scheduled_at);
    var duplicate = bookings.some(function(b) {
      // GASがDate型として読む場合に備えて文字列に変換して比較
      var existingAt = b.scheduled_at instanceof Date
        ? b.scheduled_at.toISOString()
        : String(b.scheduled_at);
      return b.trainer_id === data.trainer_id &&
             existingAt === scheduledAtStr &&
             b.status === 'confirmed';
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
 * 予約キャンセル
 */
function cancelBooking_(params) {
  var bookingId = params.bookingId;
  var reason = params.reason || '';
  var requesterId = params.customer_id || params.trainer_id || null;

  // IDの形式チェック
  if (!bookingId || !isValidId_(String(bookingId))) {
    return { success: false, error: '不正な予約IDです' };
  }

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

  // 認可チェック: リクエスト元が予約の当事者（顧客またはトレーナー）であることを確認
  // requesterId が提供されている場合のみチェック（管理APIからの呼び出しは除外）
  if (requesterId &&
      String(requesterId) !== String(booking.customer_id) &&
      String(requesterId) !== String(booking.trainer_id)) {
    return { success: false, error: 'この予約をキャンセルする権限がありません' };
  }

  if (booking.status !== 'confirmed') {
    return { success: false, error: 'この予約はキャンセルできません' };
  }

  // キャンセル理由の文字列長制限
  reason = truncateString_(reason, MAX_STRING_LENGTH);

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
  var todayStr = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd');

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
    var dateStr = Utilities.formatDate(bookingDate, 'Asia/Tokyo', 'yyyy-MM-dd');

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

  var success = updateRowById_('trainers', id, updates);
  return { success: success };
}

/**
 * トレーナーの対応店舗を更新（全削除→再挿入）
 */
function updateTrainerStores_(params) {
  var trainerId = params.trainerId;
  var storeIds = params.storeIds || [];

  if (!trainerId) return { success: false, error: 'trainerId is required' };

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
  }

  // 新しい紐付けを挿入
  for (var j = 0; j < storeIds.length; j++) {
    appendRow_('trainer_stores', {
      trainer_id: trainerId,
      store_id: storeIds[j],
      buffer_minutes: 30
    });
  }

  return { success: true };
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
}

/**
 * 店舗追加
 */
function addStore_(params) {
  if (!params.name || !params.area) {
    return { error: '店舗名とエリアは必須です' };
  }

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

  var success = updateRowById_('stores', id, updates);
  return { success: success };
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

  var sheet = getSheet_('availability_cache');
  if (!sheet) throw new Error('availability_cacheシートが見つかりません');

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var trainerIdCol = headers.indexOf('trainer_id');
  var storeIdCol = headers.indexOf('store_id');
  var dateCol = headers.indexOf('date');

  // 既存行を検索
  for (var i = 1; i < data.length; i++) {
    if (data[i][trainerIdCol] === trainerId &&
        data[i][storeIdCol] === storeId &&
        data[i][dateCol] === date) {
      // 更新
      var slotsCol = headers.indexOf('slots_json');
      var fetchedAtCol = headers.indexOf('fetched_at');
      sheet.getRange(i + 1, slotsCol + 1).setValue(JSON.stringify(slots));
      sheet.getRange(i + 1, fetchedAtCol + 1).setValue(fetchedAt);
      return { success: true };
    }
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

  return { success: true };
}

// ---------- 店舗管理画面用アクション ----------

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
