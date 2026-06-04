import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  applyCanvasUpdate,
  getCanvasState,
  isCanvasStorageError,
} from '@/lib/canvas/repository';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4_500_000;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function storageUnavailable(message: string) {
  return NextResponse.json({ error: message }, { status: 503 });
}

function parseCanvasId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const id = raw.trim();
  if (!id || id.length > 128) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;
  return id;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return unauthorized();
    }

    const { id: rawId } = await params;
    const canvasId = parseCanvasId(rawId);
    if (!canvasId) {
      return badRequest('ID do canvas inválido');
    }

    let state: Buffer | null;
    try {
      state = await getCanvasState(userId, canvasId);
    } catch (error) {
      if (isCanvasStorageError(error)) {
        return storageUnavailable(error.message);
      }
      throw error;
    }

    if (!state || state.length === 0) {
      return NextResponse.json(
        { error: 'Canvas não encontrado' },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(state), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('[canvas GET]', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return unauthorized();
    }

    const { id: rawId } = await params;
    const canvasId = parseCanvasId(rawId);
    if (!canvasId) {
      return badRequest('ID do canvas inválido');
    }

    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      return badRequest('Buffer vazio enviado');
    }

    if (arrayBuffer.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        {
          error: 'Payload Too Large',
          incomingBytes: arrayBuffer.byteLength,
          limit: MAX_BODY_BYTES,
        },
        { status: 413 }
      );
    }

    const incoming = Buffer.from(arrayBuffer);

    let result;
    try {
      result = await applyCanvasUpdate(userId, canvasId, incoming);
    } catch (error) {
      if (isCanvasStorageError(error)) {
        return storageUnavailable(error.message);
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      persisted: result.persisted,
      storage: result.storage,
      blobUrl: result.blobUrl,
      incomingBytes: result.incomingBytes,
      mergedBytes: result.mergedBytes,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[canvas POST]', detail, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
