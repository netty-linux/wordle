import { NextRequest, NextResponse } from 'next/server';
import { getCanvasStorage } from '../../../../lib/canvas-storage';

export const runtime = 'nodejs';

/**
 * GET /api/canvas/[id]
 * Recupera o estado binário do Yjs para o canvas especificado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse('ID do canvas não informado', { status: 400 });
    }

    const state = await getCanvasStorage().get(id);

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

/**
 * POST /api/canvas/[id]
 * Salva ou atualiza o estado binário do Yjs para o canvas especificado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse('ID do canvas não informado', { status: 400 });
    }

    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return new NextResponse('Buffer vazio enviado', { status: 400 });
    }

    const storage = getCanvasStorage();
    await storage.set(id, buffer);

    return NextResponse.json({
      success: true,
      persisted: storage.mode !== 'memory',
    });
  } catch (error) {
    console.error('Erro ao salvar o canvas:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
