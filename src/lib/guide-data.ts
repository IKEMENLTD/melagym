import type { GuideStep } from '@/components/ui/help-guide';

// ======== 顧客向け ========

export const bookingGuide: GuideStep[] = [
  { title: '店舗を選ぶ', description: '通いたい店舗をタップして選択してください。お近くの店舗を選びましょう。' },
  { title: 'トレーナーを選ぶ', description: '担当トレーナーを選びます。迷ったら「おまかせ」を選択すると、空き状況に合わせて最適なトレーナーをご案内します。' },
  { title: '日時を選ぶ', description: 'カレンダーから希望の日付をタップし、空いている時間帯（オレンジ色）を選択してください。灰色の枠は予約済みです。' },
  { title: '情報を入力（初回のみ）', description: '初回体験の方はお名前と電話番号を入力してください。2回目以降の方はこのステップはスキップされます。' },
  { title: '予約完了', description: '予約が確定すると完了画面が表示されます。当日は選択した店舗にお越しください。' },
];

// ======== 管理者向け ========

export const adminDashboardGuide: GuideStep[] = [
  { title: 'ダッシュボード', description: '本日・今週・今月の予約数、稼働中のトレーナー数・店舗数、キャンセル率を一覧できます。' },
  { title: '直近の予約', description: '最新の予約が一覧表示されます。ステータス（確定/キャンセル等）も確認できます。' },
  { title: 'サイドメニュー', description: '左のメニューから「トレーナー」「店舗」「予約一覧」の各管理ページに移動できます。' },
];

export const adminTrainersGuide: GuideStep[] = [
  { title: 'トレーナー一覧', description: '登録済みトレーナーの一覧です。名前、専門分野、対応店舗、カレンダー連携状態を確認できます。' },
  { title: 'トレーナー追加', description: '右上の「+ トレーナー追加」ボタンから新しいトレーナーを登録できます。名前とメールアドレスは必須です。' },
  { title: '初回対応トグル', description: '「初回対応」列のトグルをONにすると、初回体験予約ページにそのトレーナーが表示されます。' },
  { title: '稼働トグル', description: '「稼働」列のトグルをOFFにすると、そのトレーナーは予約ページに表示されなくなります。トレーナーが自己登録した場合、ここで承認（ONに切替）してください。' },
];

export const adminStoresGuide: GuideStep[] = [
  { title: '店舗一覧', description: '登録済み店舗がカード形式で表示されます。各カードには店舗名、エリア、カレンダー連携状態が表示されます。' },
  { title: '店舗編集', description: '「編集」ボタンから店舗名、エリア、住所、GoogleカレンダーIDを変更できます。' },
  { title: '稼働/停止切替', description: '「停止する」ボタンで店舗を一時的に非公開にできます。再度「稼働する」で復活します。' },
  { title: 'GoogleカレンダーID', description: 'GoogleカレンダーのID（例: xxx@group.calendar.google.com）を設定すると、その店舗の空き状況が自動で反映されます。' },
];

export const adminBookingsGuide: GuideStep[] = [
  { title: '予約一覧', description: '全ての予約が新しい順に表示されます。右上に全件数が表示されます。' },
  { title: '検索とフィルター', description: '上部の検索バーで顧客名・トレーナー名・店舗名で絞り込めます。「確定」「キャンセル」ボタンでステータスフィルターも可能です。' },
  { title: 'キャンセル操作', description: '確定済みの予約の「キャンセル」リンクをクリックすると、予約をキャンセルできます。Googleカレンダーの予定も自動で削除されます。' },
  { title: 'ページ切替', description: 'テーブル下部のページネーションで次のページに移動できます。' },
];

// ======== トレーナー向け ========

export const trainerDashboardGuide: GuideStep[] = [
  { title: 'マイページ', description: '今日と明日の予約が一覧表示されます。顧客名、店舗名、時間を確認できます。' },
  { title: 'Googleカレンダー連携', description: 'カレンダー連携状態が表示されます。管理者がGoogleカレンダーIDを設定すると「連携済み」になり、あなたの空き時間が自動で予約システムに反映されます。' },
  { title: 'メニュー', description: '「スケジュール」で週間の予約一覧、「プロフィール」で自分の情報を編集できます。' },
];

export const trainerScheduleGuide: GuideStep[] = [
  { title: '週間スケジュール', description: '今週の予約が曜日ごとに表示されます。各予約には時間、店舗名、顧客名が表示されます。' },
  { title: '週の切替', description: '上部の矢印ボタンで前の週・次の週に移動できます。' },
  { title: '今日のハイライト', description: '今日の日付はオレンジ色の枠で強調表示されます。' },
];

export const trainerProfileGuide: GuideStep[] = [
  { title: 'プロフィール編集', description: 'お客様に表示される自分のプロフィールを編集できます。' },
  { title: '専門分野', description: 'カンマ区切りで複数入力できます（例: ダイエット, 筋力トレーニング）。お客様がトレーナーを選ぶ際の参考になります。' },
  { title: '対応可能時間帯', description: '予約を受けられる時間帯を設定してください。この範囲外の時間は予約ページに表示されません。' },
  { title: '保存', description: '変更後は「保存する」ボタンを押してください。保存が成功すると通知が表示されます。' },
];

export const trainerRegisterGuide: GuideStep[] = [
  { title: 'トレーナー新規登録', description: 'お名前、メールアドレス、電話番号を入力して登録してください。' },
  { title: '承認制', description: '登録後すぐにはログインできません。管理者が承認するとログイン可能になります。' },
  { title: 'ログイン', description: '承認後は登録したメールアドレスでログインできます。' },
];

// ======== 店舗向け ========

export const storeDashboardGuide: GuideStep[] = [
  { title: '店舗ダッシュボード', description: '今日と今週の予約件数、Googleカレンダーの連携状態、対応トレーナーの一覧を確認できます。' },
  { title: 'カレンダー連携', description: 'GoogleカレンダーIDが設定されていると「連携済み」と表示されます。レンタル利用で埋まっている枠は自動的に除外されます。' },
  { title: 'メニュー', description: '「カレンダー設定」で営業時間の変更、「予約一覧」でこの店舗の予約を確認できます。' },
];

export const storeCalendarGuide: GuideStep[] = [
  { title: 'カレンダー設定', description: 'GoogleカレンダーIDの確認と、営業時間の設定ができます。' },
  { title: '営業時間の編集', description: '各曜日のOpenとCloseの時間を設定してください。定休日にチェックを入れるとその曜日は予約不可になります。' },
  { title: '保存', description: '変更後は「保存する」ボタンを押してください。変更は即座に予約ページに反映されます。' },
];

export const storeBookingsGuide: GuideStep[] = [
  { title: '予約一覧', description: 'この店舗の予約のみが表示されます。' },
  { title: '日付フィルター', description: '日付を選択すると、その日の予約だけに絞り込めます。' },
  { title: 'ステータス確認', description: '各予約のステータス（確定/キャンセル/完了/無断欠席）が色付きバッジで表示されます。' },
];
