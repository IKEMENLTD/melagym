import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('store_id', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('store_name', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
