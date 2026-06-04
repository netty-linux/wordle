import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  applyCanvasUpdate,
  getCanvasState,
  isCanvasStorageError,
} from '@/lib/canvas/repository';
import { canvasBlobPath } from '@/lib/canvas/blob';
import { canvasLog, canvasLogError } from '@/lib/canvas/debug';

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
  const startedAt = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      canvasLogError('GET unauthorized', { reason: 'missing userId' });
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
        canvasLogError('GET storage error', { userId, canvasId }, error);
        return storageUnavailable(error.message);
      }
      throw error;
    }

    if (!state || state.length === 0) {
      canvasLog('GET not_found', {
        userId,
        canvasId,
        blobPath: canvasBlobPath(userId, canvasId),
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: 'Canvas não encontrado' },
        { status: 404 }
      );
    }

    canvasLog('GET ok', {
      userId,
      canvasId,
      bytes: state.length,
      blobPath: canvasBlobPath(userId, canvasId),
      durationMs: Date.now() - startedAt,
    });

    return new NextResponse(new Uint8Array(state), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    canvasLogError('GET error', { durationMs: Date.now() - startedAt }, error);
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
  const startedAt = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      canvasLogError('POST unauthorized', { reason: 'missing userId' });
      return unauthorized();
    }

    const { id: rawId } = await params;
    const canvasId = parseCanvasId(rawId);

    if (!canvasId) {
      return badRequest('ID do canvas inválido');
    }

    const arrayBuffer = await request.arrayBuffer();
    const incomingBytes = arrayBuffer.byteLength;

    if (incomingBytes === 0) {
      return badRequest('Buffer vazio enviado');
    }

    if (incomingBytes > MAX_BODY_BYTES) {
      canvasLogError('POST payload too large', {
        userId,
        canvasId,
        incomingBytes,
        limit: MAX_BODY_BYTES,
      });
      return NextResponse.json(
        {
          error: 'Payload Too Large',
          incomingBytes,
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
        canvasLogError(
          'POST storage error',
          { userId, canvasId, incomingBytes },
          error
        );
        return storageUnavailable(error.message);
      }
      throw error;
    }

    canvasLog('POST ok', {
      userId,
      canvasId,
      incomingBytes: result.incomingBytes,
      mergedBytes: result.mergedBytes,
      blobUrl: result.blobUrl,
      blobPath: result.blobPath,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      success: true,
      persisted: result.persisted,
      storage: result.storage,
      blobUrl: result.blobUrl,
      blobPath: result.blobPath,
      incomingBytes: result.incomingBytes,
      mergedBytes: result.mergedBytes,
    });
  } catch (error) {
    canvasLogError('POST error', { durationMs: Date.now() - startedAt }, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
