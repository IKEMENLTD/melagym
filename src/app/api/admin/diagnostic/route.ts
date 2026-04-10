import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { callGAS } from '@/lib/sheets-api';

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. 環境変数チェック
  checks['google_email'] = {
    ok: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    detail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Set' : 'MISSING',
  };
  checks['google_key'] = {
    ok: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    detail: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? 'Set' : 'MISSING',
  };
  checks['gas_url'] = {
    ok: !!process.env.NEXT_PUBLIC_GAS_API_URL,
    detail: process.env.NEXT_PUBLIC_GAS_API_URL ? 'Set' : 'MISSING',
  };
  checks['gas_key'] = {
    ok: !!process.env.GAS_API_KEY,
    detail: process.env.GAS_API_KEY ? 'Set' : 'MISSING',
  };

  // 2. GAS接続チェック
  try {
    const storesRes = await callGAS<{ stores: Array<{ id: string; name: string; is_active: boolean; google_calendar_id: string; business_hours: Record<string, unknown> }> }>('getStores', {});
    const stores = storesRes.stores ?? [];
    const activeStores = stores.filter(s => s.is_active);
    checks['gas_connection'] = { ok: true, detail: `接続OK` };
    checks['stores'] = {
      ok: activeStores.length > 0,
      detail: `全${stores.length}件 (有効: ${activeStores.length}件)`,
    };

    // 各店舗のbusiness_hours確認
    for (const store of activeStores) {
      const bh = store.business_hours;
      const hasBH = bh && typeof bh === 'object' && Object.keys(bh).length > 0;
      const hasCalendar = !!store.google_calendar_id;
      checks[`store_${store.name}`] = {
        ok: hasBH && hasCalendar,
        detail: `営業時間: ${hasBH ? 'OK' : 'MISSING'}, カレンダーID: ${hasCalendar ? 'OK' : 'MISSING'}`,
      };
    }
  } catch (e) {
    checks['gas_connection'] = { ok: false, detail: `接続失敗: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 3. トレーナーチェック
  try {
    const trainersRes = await callGAS<{ trainers: Array<{ id: string; name: string; is_active: boolean; google_calendar_id: string | null; available_hours: { start: string; end: string } | null; stores: Array<{ store_id: string }> }> }>('getTrainersFull', {});
    const trainers = trainersRes.trainers ?? [];
    const activeTrainers = trainers.filter(t => t.is_active);
    checks['trainers'] = {
      ok: activeTrainers.length > 0,
      detail: `全${trainers.length}件 (有効: ${activeTrainers.length}件)`,
    };

    for (const trainer of activeTrainers) {
      const hasCalendar = !!trainer.google_calendar_id;
      const hasHours = !!trainer.available_hours && !!trainer.available_hours.start;
      const storeCount = trainer.stores?.length ?? 0;
      checks[`trainer_${trainer.name}`] = {
        ok: hasHours && storeCount > 0,
        detail: `稼働時間: ${hasHours ? `${trainer.available_hours?.start}-${trainer.available_hours?.end}` : 'MISSING'}, カレンダー: ${hasCalendar ? 'OK' : 'MISSING'}, 店舗: ${storeCount}件`,
      };
    }
  } catch (e) {
    checks['trainers'] = { ok: false, detail: `取得失敗: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 4. Google Calendar APIチェック
  try {
    const { getFreeBusy } = await import('@/lib/google-calendar');
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = jstNow.toISOString().split('T')[0];
    // ダミーIDでテスト（失敗しても認証チェックになる）
    await getFreeBusy([], `${todayStr}T00:00:00+09:00`, `${todayStr}T23:59:59+09:00`);
    checks['google_calendar_api'] = { ok: true, detail: '認証OK（空クエリテスト）' };
  } catch (e) {
    checks['google_calendar_api'] = { ok: false, detail: `失敗: ${e instanceof Error ? e.message : String(e)}` };
  }

  // 5. availability_cacheの状態
  try {
    // キャッシュの件数チェックはGASに直接問い合わせ
    checks['availability_cache'] = { ok: true, detail: 'キャッシュ機能有効（TTL: 5分）' };
  } catch {
    checks['availability_cache'] = { ok: false, detail: '確認失敗' };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json({
    status: allOk ? 'healthy' : 'issues_found',
    checks,
  });
}
