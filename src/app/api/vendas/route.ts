import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as FS from '@/lib/firestore-service'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ItemVendaInput {
  produtoId: string
  nomeProduto: string
  quantidade: number
  precoUnitario: number
  subtotal: number
}

interface VendaWithItens {
  id: string
  numero: number
  subtotal: number
  desconto: number
  total: number
  formaPagamento: string
  status: string
  observacoes: string | null
  dataVenda: string
  caixaId: string | null
  itens: ItemVenda[]
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

interface Produto {
  id: string
  nome: string
  ativo: boolean
  estoque: number
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/vendas — List vendas with optional date filtering
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio')
    const dataFim = searchParams.get('dataFim')

    const constraints: Array<{ field: string; op: string; value: unknown }> = []

    if (dataInicio || dataFim) {
      if (dataInicio) {
        const startDate = new Date(dataInicio)
        startDate.setHours(0, 0, 0, 0)
        constraints.push({ field: 'dataVenda', op: '>=', value: startDate })
      }

      if (dataFim) {
        const endDate = new Date(dataFim)
        endDate.setHours(23, 59, 59, 999)
        constraints.push({ field: 'dataVenda', op: '<=', value: endDate })
      }
    }

    const vendas = await FS.listDocuments<VendaWithItens>(
      FS.COLLECTIONS.VENDAS,
      constraints,
      'dataVenda',
      'desc'
    )

    // Fetch itens subcollection for each venda
    const vendasWithItens = await Promise.all(
      vendas.map(async (venda) => {
        const itens = await FS.listSubDocuments<ItemVenda>(
          FS.COLLECTIONS.VENDAS,
          venda.id,
          'itens'
        )
        return { ...venda, itens }
      })
    )

    return NextResponse.json(vendasWithItens)
  } catch (error) {
    console.error('Erro ao listar vendas:', error)
    return NextResponse.json(
      { error: 'Erro ao listar vendas' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/vendas — Create a new venda
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      itens,
      desconto = 0,
      formaPagamento = 'Dinheiro',
      status = 'Concluida',
      observacoes,
    } = body as {
      itens?: ItemVendaInput[]
      desconto?: number
      formaPagamento?: string
      status?: string
      observacoes?: string
    }

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { error: 'A venda deve conter pelo menos um item' },
        { status: 400 }
      )
    }

    for (const item of itens) {
      const produto = await FS.getDocument<Produto>(
        FS.COLLECTIONS.PRODUTOS,
        item.produtoId
      )

      if (!produto) {
        return NextResponse.json(
          { error: `Produto não encontrado: ${item.produtoId}` },
          { status: 404 }
        )
      }

      if (!produto.ativo) {
        return NextResponse.json(
          { error: `Produto inativo: ${produto.nome}` },
          { status: 400 }
        )
      }

      if (produto.estoque < item.quantidade) {
        return NextResponse.json(
          {
            error: `Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque}, Solicitado: ${item.quantidade}`,
          },
          { status: 400 }
        )
      }
    }

    const subtotal = itens.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnitario,
      0
    )
    const descontoValue = parseFloat(String(desconto)) || 0
    const total = subtotal - descontoValue

    // Buscar caixa aberto
    let caixaId: string | null = null
    try {
      const openCaixaSnap = await getDocs(
        query(
          collection(db, FS.COLLECTIONS.CAIXA),
          where('status', '==', 'Aberto'),
          orderBy('dataAbertura', 'desc'),
          limit(1)
        )
      )
      if (!openCaixaSnap.empty) {
        caixaId = openCaixaSnap.docs[0].id
      }
    } catch (err) {
      console.warn('Erro ao buscar caixa aberto:', err)
    }

    const numero = await FS.getNextNumber(FS.COLLECTIONS.VENDAS)

    const vendaId = FS.generateId()
    await FS.createDocumentWithId(FS.COLLECTIONS.VENDAS, vendaId, {
      id: vendaId,
      numero,
      subtotal,
      desconto: descontoValue,
      total,
      formaPagamento,
      status,
      observacoes: observacoes || null,
      caixaId,
      dataVenda: serverTimestamp(),
    })

    const createdItens: ItemVenda[] = []
    for (const item of itens) {
      const itemId = FS.generateId()
      await FS.addSubDocument(FS.COLLECTIONS.VENDAS, vendaId, 'itens', {
        id: itemId,
        produtoId: item.produtoId,
        nomeProduto: item.nomeProduto,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
        createdAt: serverTimestamp(),
      })
      createdItens.push({
        id: itemId,
        produtoId: item.produtoId,
        nomeProduto: item.nomeProduto,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
        createdAt: new Date().toISOString(),
      })
    }

    await FS.decrementStock(itens)

    const vendaResponse: VendaWithItens = {
      id: vendaId,
      numero,
      subtotal,
      desconto: descontoValue,
      total,
      formaPagamento,
      status,
      observacoes: observacoes || null,
      caixaId,
      dataVenda: new Date().toISOString(),
      itens: createdItens,
    }

    return NextResponse.json(vendaResponse, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar venda:', error)
    return NextResponse.json(
      { error: 'Erro ao criar venda' },
      { status: 500 }
    )
  }
}
