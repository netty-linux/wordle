import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toString().trim().toLowerCase();
    const password = body.password?.toString();
    const name = body.name?.toString().trim() || null;

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'E-mail válido e senha com mínimo de 8 caracteres são obrigatórios.' },
        { status: 400 }
      );
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado.' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);

    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        password: hashed,
      })
      .returning({ id: users.id, email: users.email });

    return NextResponse.json({ id: created.id, email: created.email }, { status: 201 });
  } catch (error) {
    console.error('[register]', error);
    return NextResponse.json(
      { error: 'Erro interno ao criar conta.' },
      { status: 500 }
    );
  }
}
