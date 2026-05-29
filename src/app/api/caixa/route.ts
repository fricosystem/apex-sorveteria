import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as FS from '@/lib/firestore-service'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CaixaRecord {
  valorInicial: number
  valorFinal?: number | null
  totalVendas?: number | null
  status: string
  observacoes?: string | null
  dataAbertura?: unknown
  dataFechamento?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

// ═══════════════════════════════════════════════════════════════════════════
// GET — List caixas or find open register
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    if (status === 'Aberto') {
      const snap = await getDocs(
        query(
          collection(db, FS.COLLECTIONS.CAIXA),
          where('status', '==', 'Aberto'),
          orderBy('dataAbertura', 'desc'),
          limit(1)
        )
      )

      if (snap.empty) {
        return NextResponse.json(null)
      }

      const caixa = FS.docToData<CaixaRecord>(snap.docs[0])
      return NextResponse.json(caixa)
    }

    const caixas = await FS.listDocuments<CaixaRecord>(
      FS.COLLECTIONS.CAIXA,
      [],
      'dataAbertura',
      'desc'
    )

    return NextResponse.json(caixas)
  } catch (error) {
    console.error('Erro ao listar caixa:', error)
    return NextResponse.json(
      { error: 'Erro ao listar caixa' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST — Open new caixa or close current one
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const acao = searchParams.get('acao')

    // ── Close current cash register ──────────────────────────────────
    if (acao === 'fechar') {
      const openSnap = await getDocs(
        query(
          collection(db, FS.COLLECTIONS.CAIXA),
          where('status', '==', 'Aberto'),
          orderBy('dataAbertura', 'desc'),
          limit(1)
        )
      )

      if (openSnap.empty) {
        return NextResponse.json(
          { error: 'Nenhum caixa aberto encontrado' },
          { status: 400 }
        )
      }

      const caixaDoc = openSnap.docs[0]
      const caixaData = caixaDoc.data()
      const caixaId = caixaDoc.id

      // Convert dataAbertura to a Date for the vendas query
      const dataAberturaRaw = caixaData.dataAbertura
      let dataAberturaDate: Date

      if (dataAberturaRaw instanceof Date) {
        dataAberturaDate = dataAberturaRaw
      } else if (typeof dataAberturaRaw === 'string') {
        dataAberturaDate = new Date(dataAberturaRaw)
      } else if (typeof dataAberturaRaw === 'number') {
        dataAberturaDate = new Date(dataAberturaRaw)
      } else if (
        typeof dataAberturaRaw === 'object' &&
        dataAberturaRaw !== null &&
        'toDate' in dataAberturaRaw
      ) {
        dataAberturaDate = (dataAberturaRaw as { toDate: () => Date }).toDate()
      } else if (
        typeof dataAberturaRaw === 'object' &&
        dataAberturaRaw !== null &&
        'seconds' in dataAberturaRaw
      ) {
        dataAberturaDate = new Date(
          (dataAberturaRaw as { seconds: number }).seconds * 1000
        )
      } else {
        dataAberturaDate = new Date(0)
      }

      // Fetch vendas in date range and sum totals
      const vendasSnap = await getDocs(
        query(
          collection(db, FS.COLLECTIONS.VENDAS),
          where('dataVenda', '>=', dataAberturaDate),
          where('dataVenda', '<=', new Date()),
          where('status', '==', 'Concluida')
        )
      )

      let totalVendas = 0
      vendasSnap.forEach((d) => {
        const total = d.data().total
        if (typeof total === 'number') {
          totalVendas += total
        }
      })

      const valorInicial = (caixaData.valorInicial as number) || 0
      const valorFinal = valorInicial + totalVendas

      await FS.updateDocument(FS.COLLECTIONS.CAIXA, caixaId, {
        dataFechamento: serverTimestamp(),
        valorFinal,
        totalVendas,
        status: 'Fechado',
        updatedAt: serverTimestamp(),
      })

      const updated = await FS.getDocument<CaixaRecord>(FS.COLLECTIONS.CAIXA, caixaId)
      return NextResponse.json(updated)
    }

    // ── Open a new cash register ─────────────────────────────────────
    const body = await request.json()
    const { valorInicial = 0, observacoes } = body

    // Check if there's already an open register
    const existingSnap = await getDocs(
      query(
        collection(db, FS.COLLECTIONS.CAIXA),
        where('status', '==', 'Aberto'),
        limit(1)
      )
    )

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: 'Já existe um caixa aberto' },
        { status: 400 }
      )
    }

    const id = FS.generateId()

    await FS.createDocumentWithId<Omit<CaixaRecord, 'id'>>(FS.COLLECTIONS.CAIXA, id, {
      valorInicial: parseFloat(valorInicial) || 0,
      valorFinal: null,
      totalVendas: null,
      status: 'Aberto',
      observacoes: observacoes || null,
      dataAbertura: serverTimestamp(),
      dataFechamento: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const created = await FS.getDocument<CaixaRecord>(FS.COLLECTIONS.CAIXA, id)
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Erro ao operar caixa:', error)
    return NextResponse.json(
      { error: 'Erro ao operar caixa' },
      { status: 500 }
    )
  }
}
