import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * GET /api/profile/stats
 * Returns activity stats only (no user data).
 */
export async function GET(request: NextRequest) {
  try {
    const uid =
      request.headers.get('x-uid') ||
      new URL(request.url).searchParams.get('uid')

    let membroDesde: unknown = null
    if (uid) {
      try {
        const userDocSnap = await getDoc(doc(db, 'usuarios', uid))
        if (userDocSnap.exists()) {
          membroDesde = userDocSnap.data().createdAt ?? null
        }
      } catch {
        // proceed with null
      }
    }

    const [vendasSnap, comprasSnap, produtosSnap, caixasSnap] = await Promise.all([
      getDocs(collection(db, 'vendas')),
      getDocs(collection(db, 'compras')),
      getDocs(query(collection(db, 'produtos'), where('ativo', '==', true))),
      getDocs(collection(db, 'caixa')),
    ])

    let totalVendas = 0
    let totalReceita = 0
    vendasSnap.forEach(d => {
      const data = d.data()
      totalVendas++
      const total = typeof data.total === 'number' ? data.total : 0
      totalReceita += total
    })

    let totalCompras = 0
    let totalCusto = 0
    comprasSnap.forEach(d => {
      const data = d.data()
      totalCompras++
      const custo = typeof data.totalCusto === 'number' ? data.totalCusto : 0
      totalCusto += custo
    })

    const lucroTotal = totalReceita - totalCusto
    const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0

    const stats = {
      totalVendas,
      totalReceita,
      totalCompras,
      totalCusto,
      lucroTotal,
      ticketMedio,
      produtosCadastrados: produtosSnap.size,
      caixasAbertos: caixasSnap.size,
      membroDesde,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Erro ao buscar estatísticas do perfil:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar estatísticas do perfil.' },
      { status: 500 }
    )
  }
}
