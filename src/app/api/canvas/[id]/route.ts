import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { applyCanvasUpdate, getCanvasState } from '@/lib/canvas/repository';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return new NextResponse('ID do canvas não informado', { status: 400 });
    }

    const state = await getCanvasState(session.user.id, id);
    if (!state) {
      return new NextResponse('Canvas não encontrado', { status: 404 });
    }

    return new NextResponse(new Uint8Array(state), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Erro ao buscar o canvas:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return new NextResponse('ID do canvas não informado', { status: 400 });
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return new NextResponse('Buffer vazio enviado', { status: 400 });
    }

    const mode = request.headers.get('x-canvas-update') ?? 'incremental';

    // #region agent log
    fetch('http://127.0.0.1:7401/ingest/bc08e07d-0b22-492d-a8b7-6f08426e0ffc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'd65edf',
      },
      body: JSON.stringify({
        sessionId: 'd65edf',
        hypothesisId: 'A',
        location: 'route.ts:POST',
        message: 'canvas POST received',
        data: { canvasId: id, incomingBytes: buffer.length, mode },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const result = await applyCanvasUpdate(session.user.id, id, buffer);

    return NextResponse.json({ success: true, ...result, mode });
  } catch (error) {
    console.error('Erro ao salvar o canvas:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
