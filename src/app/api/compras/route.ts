import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import * as FS from '@/lib/firestore-service'

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/compras — List compras with optional date filtering
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const constraints: Array<{ field: string; op: string; value: unknown }> = []

    if (dataInicio || dataFim) {
      const start = dataInicio ? new Date(dataInicio) : null
      const end = dataFim
        ? (() => {
            const d = new Date(dataFim)
            d.setHours(23, 59, 59, 999)
            return d
          })()
        : null

      if (start && end) {
        constraints.push({ field: 'dataCompra', op: '>=', value: start })
        constraints.push({ field: 'dataCompra', op: '<=', value: end })
      } else if (start) {
        constraints.push({ field: 'dataCompra', op: '>=', value: start })
      } else if (end) {
        constraints.push({ field: 'dataCompra', op: '<=', value: end })
      }
    }

    const compras = await FS.listDocuments<{
      numero: number
      fornecedor: string
      status: string
      observacoes: string | null
      totalCusto: number
      dataCompra: string
    }>(FS.COLLECTIONS.COMPRAS, constraints, 'dataCompra', 'desc')

    const comprasWithItens = await Promise.all(
      compras.map(async (compra) => {
        const itens = await FS.listSubDocuments<{
          produtoId: string
          nomeProduto: string
          quantidade: number
          custoUnitario: number
          subtotal: number
          createdAt: string
        }>(FS.COLLECTIONS.COMPRAS, compra.id, 'itens')

        return { ...compra, itens }
      })
    )

    return NextResponse.json(comprasWithItens)
  } catch (error) {
    console.error('Erro ao listar compras:', error)
    return NextResponse.json(
      { error: 'Erro ao listar compras' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/compras — Create a new compra with items and increment stock
// ═══════════════════════════════════════════════════════════════════════════

interface CompraItemInput {
  produtoId: string
  nomeProduto: string
  quantidade: number
  custoUnitario: number
  subtotal: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      itens,
      fornecedor = '',
      status = 'Concluida',
      observacoes,
    } = body as {
      itens?: CompraItemInput[]
      fornecedor?: string
      status?: string
      observacoes?: string
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'A compra deve conter pelo menos um item' },
        { status: 400 }
      )
    }

    for (const item of itens) {
      const produto = await FS.getDocument(
        FS.COLLECTIONS.PRODUTOS,
        item.produtoId
      )

      if (!produto) {
        return NextResponse.json(
          { error: `Produto não encontrado: ${item.produtoId}` },
          { status: 404 }
        )
      }
    }

    const totalCusto = itens.reduce(
      (acc: number, item: CompraItemInput) => acc + item.subtotal,
      0
    )

    const nextNumero = await FS.getNextNumber('compras')
    const compraId = FS.generateId()

    await FS.createDocumentWithId(FS.COLLECTIONS.COMPRAS, compraId, {
      id: compraId,
      numero: nextNumero,
      fornecedor,
      status,
      observacoes: observacoes || null,
      totalCusto,
      dataCompra: serverTimestamp(),
    })

    for (const item of itens) {
      const itemId = FS.generateId()
      await FS.addSubDocument(FS.COLLECTIONS.COMPRAS, compraId, 'itens', {
        id: itemId,
        produtoId: item.produtoId,
        nomeProduto: item.nomeProduto,
        quantidade: item.quantidade,
        custoUnitario: item.custoUnitario,
        subtotal: item.subtotal,
        createdAt: serverTimestamp(),
      })
    }

    await FS.incrementStock(
      itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      }))
    )

    const compra = await FS.getDocument<{
      numero: number
      fornecedor: string
      status: string
      observacoes: string | null
      totalCusto: number
      dataCompra: string
    }>(FS.COLLECTIONS.COMPRAS, compraId)

    const compraItens = await FS.listSubDocuments<{
      produtoId: string
      nomeProduto: string
      quantidade: number
      custoUnitario: number
      subtotal: number
      createdAt: string
    }>(FS.COLLECTIONS.COMPRAS, compraId, 'itens')

    return NextResponse.json({ ...compra, itens: compraItens }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar compra:', error)
    return NextResponse.json(
      { error: 'Erro ao criar compra' },
      { status: 500 }
    )
  }
}
