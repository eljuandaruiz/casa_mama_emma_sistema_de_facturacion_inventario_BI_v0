import { NextResponse } from 'next/server';
import { googleConfigurado, urlConsentimiento } from '@/lib/integraciones/google';

export const dynamic = 'force-dynamic';

/** GET /api/integraciones/google/iniciar — redirige al consentimiento OAuth. */
export async function GET() {
  if (!googleConfigurado()) {
    return NextResponse.json(
      { error: 'Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el entorno' },
      { status: 400 },
    );
  }
  return NextResponse.redirect(urlConsentimiento());
}
