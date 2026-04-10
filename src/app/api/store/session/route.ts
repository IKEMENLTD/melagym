import { NextRequest, NextResponse } from 'next/server';
import { isValidId } from '@/lib/validation';

/**
 * GET: 店舗セッション確認
 * HttpOnly cookieからログイン状態を返す
 */
export async function GET(request: NextRequest) {
  const storeId = request.cookies.get('store_id')?.value;
  const authenticated = !!storeId && isValidId(storeId);
  return NextResponse.json({ authenticated });
}
