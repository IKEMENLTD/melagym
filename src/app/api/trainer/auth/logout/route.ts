import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('trainer_id', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('trainer_email', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
