import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import { setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getDocument, COLLECTIONS } from '@/lib/firestore-service'

const CONFIG_ID = 'empresa'

const DEFAULT_CONFIG = {
  nomeEmpresa: 'APEX Sorveteria',
  cnpj: null,
  endereco: null,
  telefone: null,
  email: null,
  logoURL: null,
  moeda: 'BRL',
  fusoHorario: 'America/Sao_Paulo',
} as const

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const config = await getDocument<Record<string, unknown>>(
      COLLECTIONS.CONFIG,
      CONFIG_ID
    )

    if (!config) {
      return NextResponse.json({ ...DEFAULT_CONFIG, id: CONFIG_ID })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Erro ao buscar config:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// ─── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido' },
        { status: 400 }
      )
    }

    const allowedFields = [
      'nomeEmpresa',
      'cnpj',
      'endereco',
      'telefone',
      'email',
      'logoURL',
      'moeda',
      'fusoHorario',
    ] as const

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    await setDoc(
      doc(db, COLLECTIONS.CONFIG, CONFIG_ID),
      updateData,
      { merge: true }
    )

    const updated = await getDocument<Record<string, unknown>>(
      COLLECTIONS.CONFIG,
      CONFIG_ID
    )

    if (!updated) {
      return NextResponse.json(
        { error: 'Erro ao recuperar config atualizado' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro ao atualizar config:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
