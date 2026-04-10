import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { stripHtmlTags, isWithinLength } from '@/lib/validation';

interface StoreData {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
}

interface GetStoresResponse {
  stores: StoreData[];
}

/**
 * POST: 店舗名で店舗を照合してログイン
 *
 * セキュリティ警告: 現在は店舗名のみで認証しており、パスワード検証がありません。
 * 店舗名を知っている第三者がアクセス可能です。
 * また、GET エンドポイントで店舗名一覧を公開しているため、
 * 実質的に誰でも任意の店舗としてログインできます。
 * 本番環境ではパスワード認証またはトークンベース認証の導入を強く推奨します。
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { storeName?: string };
    const storeName = body.storeName;

    if (!storeName || typeof storeName !== 'string') {
      return NextResponse.json(
        { error: '店舗名を指定してください' },
        { status: 400 }
      );
    }

    // 入力サニタイズ
    const sanitizedName = stripHtmlTags(storeName.trim());
    if (!isWithinLength(sanitizedName, 200)) {
      return NextResponse.json(
        { error: '店舗名が長すぎます' },
        { status: 400 }
      );
    }

    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: '店舗名を指定してください' },
        { status: 400 }
      );
    }

    // GASからstoreByNameで検索
    const result = await callGAS<{ store: StoreData | null }>('getStoreByName', {
      name: sanitizedName,
    });

    if (!result.store) {
      return NextResponse.json(
        { error: '該当する店舗が見つかりません' },
        { status: 404 }
      );
    }

    if (!result.store.is_active) {
      return NextResponse.json(
        { error: 'この店舗は現在無効です' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      store: {
        id: result.store.id,
        name: result.store.name,
        area: result.store.area,
      },
    });
  } catch (error) {
    // セキュリティ: 内部エラーの詳細をクライアントに返さない
    console.error('Store auth error:', error);
    return NextResponse.json(
      { error: '認証処理でエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * GET: アクティブな店舗一覧を取得（ログイン画面のプルダウン用）
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = await callGAS<GetStoresResponse>('getStores', { activeOnly: true });
    const storeNames = result.stores.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    return NextResponse.json({ stores: storeNames });
  } catch (error) {
    console.error('Failed to fetch stores:', error);
    return NextResponse.json(
      { error: '店舗一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
