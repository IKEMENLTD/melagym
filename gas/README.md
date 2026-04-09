# メラジム予約システム - GAS + スプレッドシート セットアップ手順

## 1. スプレッドシートの作成

Google スプレッドシートを新規作成し、以下のシートを追加してください。
各シートの1行目にヘッダーを入力します。

### stores シート
| id | name | area | address | google_calendar_id | business_hours_json | is_active | created_at | updated_at |

### trainers シート
| id | name | email | phone | photo_url | specialties_json | bio | is_first_visit_eligible | is_active | google_calendar_id | available_hours_json | created_at | updated_at |

### trainer_stores シート
| trainer_id | store_id | buffer_minutes |

### customers シート
| id | line_uid | name | email | phone | age_group | is_first_visit_completed | created_at | updated_at |

### bookings シート
| id | customer_id | trainer_id | store_id | scheduled_at | duration_minutes | booking_type | status | google_calendar_event_id | notes | cancelled_at | cancel_reason | created_at |

### availability_cache シート
| id | trainer_id | store_id | date | slots | fetched_at |

## 2. GASプロジェクトの作成

1. スプレッドシートのメニューから「拡張機能 > Apps Script」を開く
2. `Code.gs` の内容を貼り付ける
3. スクリプトプロパティを設定:
   - `SPREADSHEET_ID`: スプレッドシートのID（URLの `/d/` と `/edit` の間の文字列）
   - `API_KEY`: 任意のシークレットキー（フロントエンドの `GAS_API_KEY` と一致させる）

## 3. ウェブアプリとしてデプロイ

1. Apps Script エディタで「デプロイ > 新しいデプロイ」
2. 種類: 「ウェブアプリ」
3. 実行ユーザー: 「自分」
4. アクセスできるユーザー: 「全員」
5. デプロイしてURLをコピー

## 4. 環境変数の設定

Next.jsプロジェクトの `.env.local` に以下を設定:

```
NEXT_PUBLIC_GAS_API_URL=https://script.google.com/macros/s/xxxxx/exec
GAS_API_KEY=your-secret-key
```

## 5. business_hours_json の形式

```json
{
  "monday": { "open": "09:00", "close": "21:00" },
  "tuesday": { "open": "09:00", "close": "21:00" },
  "wednesday": null,
  "thursday": { "open": "09:00", "close": "21:00" },
  "friday": { "open": "09:00", "close": "21:00" },
  "saturday": { "open": "10:00", "close": "18:00" },
  "sunday": { "open": "10:00", "close": "18:00" }
}
```

null = 定休日

## 6. available_hours_json の形式

```json
{ "start": "09:00", "end": "21:00" }
```

## 7. specialties_json の形式

```json
["ダイエット", "筋力トレーニング", "ストレッチ"]
```
