/**
 * POST /api/logs/create — Create a new log entry (internal use)
 */

import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import { generateId, createDocumentWithId, COLLECTIONS } from '@/lib/firestore-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      )
    }

    const { acao, entidade, entidadeId, dadosAnteriores, dadosNovos } = body

    if (!acao || typeof acao !== 'string') {
      return NextResponse.json(
        { error: 'Campo "acao" é obrigatório' },
        { status: 400 }
      )
    }

    if (!entidade || typeof entidade !== 'string') {
      return NextResponse.json(
        { error: 'Campo "entidade" é obrigatório' },
        { status: 400 }
      )
    }

    if (!entidadeId || typeof entidadeId !== 'string') {
      return NextResponse.json(
        { error: 'Campo "entidadeId" é obrigatório' },
        { status: 400 }
      )
    }

    const uid = request.headers.get('x-uid') || undefined

    const id = generateId()

    await createDocumentWithId(COLLECTIONS.LOGS, id, {
      acao,
      entidade,
      entidadeId,
      uid,
      dadosAnteriores: dadosAnteriores ?? null,
      dadosNovos: dadosNovos ?? null,
      createdAt: serverTimestamp(),
    })

    return NextResponse.json(
      { id, message: 'Log registrado com sucesso' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao criar log:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
