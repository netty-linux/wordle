import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { canvasDocuments } from '../../../../lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/canvas/[id]
 * Recupera o estado binário do Yjs para o canvas especificado.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return new NextResponse('ID do canvas não informado', { status: 400 });
    }

    const docs = await db
      .select()
      .from(canvasDocuments)
      .where(eq(canvasDocuments.id, id))
      .limit(1);

    if (docs.length === 0) {
      return new NextResponse('Canvas não encontrado', { status: 404 });
    }

    const doc = docs[0];

    // O SQLite retorna o BLOB como um Buffer do Node.js.
    // Retornamos como application/octet-stream para o cliente ler como ArrayBuffer.
    return new NextResponse(new Uint8Array(doc.yjsState), {
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

    // Lê o corpo binário da requisição
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return new NextResponse('Buffer vazio enviado', { status: 400 });
    }

    // Upsert do estado binário no SQLite via Drizzle ORM
    await db
      .insert(canvasDocuments)
      .values({
        id,
        yjsState: buffer,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: canvasDocuments.id,
        set: {
          yjsState: buffer,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao salvar o canvas:', error);
    return new NextResponse('Erro interno do servidor', { status: 500 });
  }
}
