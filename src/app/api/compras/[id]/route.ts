import { NextRequest, NextResponse } from 'next/server'
import * as FS from '@/lib/firestore-service'

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/compras/[id]
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const compra = await FS.getDocument<{
      numero: number
      fornecedor: string
      status: string
      observacoes: string | null
      totalCusto: number
      dataCompra: string
    }>(FS.COLLECTIONS.COMPRAS, id)

    if (!compra) {
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      )
    }

    const itens = await FS.listSubDocuments<{
      produtoId: string
      nomeProduto: string
      quantidade: number
      custoUnitario: number
      subtotal: number
      createdAt: string
    }>(FS.COLLECTIONS.COMPRAS, id, 'itens')

    return NextResponse.json({ ...compra, itens })
  } catch (error) {
    console.error('Erro ao buscar compra:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar compra' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/compras/[id]
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const compra = await FS.getDocument(FS.COLLECTIONS.COMPRAS, id)

    if (!compra) {
      return NextResponse.json(
        { error: 'Compra não encontrada' },
        { status: 404 }
      )
    }

    await FS.deleteSubCollection(FS.COLLECTIONS.COMPRAS, id, 'itens')
    await FS.deleteDocument(FS.COLLECTIONS.COMPRAS, id)

    return NextResponse.json({ message: 'Compra excluída com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir compra:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir compra' },
      { status: 500 }
    )
  }
}
