import { NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import type { Store } from '@/types/database';

export async function GET() {
  try {
    const result = await callGAS<{ stores: Store[] }>('getStores', { activeOnly: true });

    // 公開用フィールドのみ返す
    const stores = result.stores.map((s) => ({
      id: s.id,
      name: s.name,
      area: s.area,
      address: s.address,
      business_hours: s.business_hours,
    }));

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Failed to fetch stores:', error);
    return NextResponse.json({ error: '店舗情報の取得に失敗しました' }, { status: 500 });
  }
}
