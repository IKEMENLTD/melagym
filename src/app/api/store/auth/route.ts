import { NextRequest, NextResponse } from 'next/server';
import { callGAS } from '@/lib/sheets-api';
import { stripHtmlTags, isWithinLength } from '@/lib/validation';
import { timingSafeEqual } from 'crypto';

interface StoreData {
  id: string;
  name: string;
  area: string;
  address: string;
  google_calendar_id: string;
  business_hours: Record<string, { open: string; close: string } | null>;
  is_active: boolean;
  passcode?: string;
}

interface GetStoresResponse {
  stores: StoreData[];
}

/**
 * タイミング攻撃を防ぐ定数時間の文字列比較
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * POST: 店舗名 + パスコードで店舗を認証してログイン
 *
 * セキュリティ強化:
 * - 店舗名だけでなくパスコード（4桁PIN等）による認証を追加
 * - パスコードはGASの店舗データに passcode フィールドとして保存
 * - パスコード未設定の店舗は環境変数 STORE_DEFAULT_PASSCODE にフォールバック
 * - パスコード機能自体が未設定（環境変数なし + 店舗にもなし）の場合は従来通り名前のみ
 *   (段階的導入が可能)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { storeName?: string; passcode?: string };
    const storeName = body.storeName;
    const passcode = body.passcode;

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

    // セキュリティ: 存在しない・無効の両方で同じレスポンスを返す（列挙攻撃防止）
    if (!result.store || !result.store.is_active) {
      return NextResponse.json(
        { error: '店舗名が無効です。正しい店舗名を選択してください。' },
        { status: 401 }
      );
    }

    // --- パスコード検証 ---
    const storePasscode = result.store.passcode;
    const defaultPasscode = process.env.STORE_DEFAULT_PASSCODE;
    const expectedPasscode = storePasscode ?? defaultPasscode;

    // 本番環境ではパスコードを必須とする
    if (!expectedPasscode && process.env.NODE_ENV === 'production') {
      console.warn(`[SECURITY] Store "${sanitizedName}" has no passcode configured`);
      return NextResponse.json(
        { error: 'この店舗はパスコードが未設定のためログインできません。管理者にお問い合わせください。' },
        { status: 403 }
      );
    }

    if (expectedPasscode) {
      // パスコードが設定されている場合、必ず検証する
      if (!passcode || typeof passcode !== 'string') {
        return NextResponse.json(
          { error: 'パスコードを入力してください', requiresPasscode: true },
          { status: 401 }
        );
      }

      // パスコード形式チェック (4-8桁の数字)
      if (!/^\d{4,8}$/.test(passcode)) {
        return NextResponse.json(
          { error: 'パスコードは4〜8桁の数字です', requiresPasscode: true },
          { status: 401 }
        );
      }

      if (!safeCompare(passcode, expectedPasscode)) {
        console.warn(
          `[SECURITY] Store auth failed: incorrect passcode for store="${sanitizedName}"`
        );
        return NextResponse.json(
          { error: 'パスコードが正しくありません', requiresPasscode: true },
          { status: 401 }
        );
      }
    }

    const isSecure = request.url.startsWith('https');
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30日
    };

    const response = NextResponse.json({
      store: {
        id: result.store.id,
        name: result.store.name,
        area: result.store.area,
      },
    });

    response.cookies.set('store_id', result.store.id, cookieOptions);
    response.cookies.set('store_name', result.store.name, cookieOptions);

    return response;
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
 *
 * セキュリティ注意: 店舗名一覧は公開情報として扱う。
 * パスコード認証が導入されたため、名前を知っているだけではログインできない。
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = await callGAS<GetStoresResponse>('getStores', { activeOnly: true });
    // ID と名前のみ返す (パスコードや内部情報は返さない)
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
