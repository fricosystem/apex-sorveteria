import { NextRequest, NextResponse } from 'next/server'
import * as FS from '@/lib/firestore-service'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Venda {
  id: string
  numero: number
  subtotal: number
  desconto: number
  total: number
  formaPagamento: string
  status: string
  observacoes: string | null
  dataVenda: string
}

interface ItemVenda {
  id: string
  produtoId: string
  nomeProduto: string
  quantidade: number
  precoUnitario: number
  subtotal: number
  createdAt: string
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/vendas/[id] — Fetch a single venda with its itens
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const venda = await FS.getDocument<Venda>(FS.COLLECTIONS.VENDAS, id)

    if (!venda) {
      return NextResponse.json(
        { error: 'Venda não encontrada' },
        { status: 404 }
      )
    }

    const itens = await FS.listSubDocuments<ItemVenda>(
      FS.COLLECTIONS.VENDAS,
      id,
      'itens'
    )

    return NextResponse.json({ ...venda, itens })
  } catch (error) {
    console.error('Erro ao buscar venda:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar venda' },
      { status: 500 }
    )
  }
}
