/**
 * GET /api/logs — List log entries with optional filtering
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { COLLECTIONS, docToData } from '@/lib/firestore-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const acao = searchParams.get('acao')
    const entidade = searchParams.get('entidade')
    const limitVal = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0)

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]

    if (acao) {
      constraints.push(where('acao', '==', acao))
    }
    if (entidade) {
      constraints.push(where('entidade', '==', entidade))
    }

    if (offset > 0) {
      constraints.push(limit(offset + limitVal))
    } else {
      constraints.push(limit(limitVal))
    }

    const snap = await getDocs(query(collection(db, COLLECTIONS.LOGS), ...constraints))

    let docs = snap.docs.map((d) => docToData(d))

    if (offset > 0) {
      docs = docs.slice(offset)
    }

    return NextResponse.json(docs)
  } catch (error) {
    console.error('Erro ao buscar logs:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
