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

    const VERCEL_BODY_LIMIT = 4_500_000;
    if (buffer.length > VERCEL_BODY_LIMIT) {
      console.error('[canvas] POST rejeitado: payload grande demais', {
        canvasId: id,
        incomingBytes: buffer.length,
      });
      return NextResponse.json(
        {
          error: 'Payload Too Large',
          incomingBytes: buffer.length,
          limit: VERCEL_BODY_LIMIT,
        },
        { status: 413 }
      );
    }

    const result = await applyCanvasUpdate(session.user.id, id, buffer);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro ao salvar o canvas:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
