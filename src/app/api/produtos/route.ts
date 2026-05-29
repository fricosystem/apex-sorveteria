import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import * as FS from '@/lib/firestore-service'

const COLLECTION = FS.COLLECTIONS.PRODUTOS

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const search = searchParams.get('search')

    const constraints: Array<{ field: string; op: string; value: unknown }> = [
      { field: 'ativo', op: '==', value: true }
    ]

    if (categoria) {
      constraints.push({ field: 'categoria', op: '==', value: categoria })
    }

    let produtos = await FS.listDocuments(COLLECTION, constraints, 'createdAt', 'desc')

    if (search) {
      const lowerSearch = search.toLowerCase()
      produtos = produtos.filter((p) =>
        String(p.nome).toLowerCase().includes(lowerSearch)
      )
    }

    return NextResponse.json(produtos)
  } catch (error) {
    console.error('Erro ao listar produtos:', error)
    return NextResponse.json(
      { error: 'Erro ao listar produtos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { nome, descricao, preco, custo, categoria, estoque, imagem } = body

    if (!nome || preco === undefined) {
      return NextResponse.json(
        { error: 'Nome e preço são obrigatórios' },
        { status: 400 }
      )
    }

    const id = FS.generateId()

    await FS.createDocumentWithId(COLLECTION, id, {
      nome,
      descricao: descricao || null,
      preco: Number(preco),
      custo: custo !== undefined ? Number(custo) : 0,
      categoria: categoria || 'Sorvete',
      estoque: estoque !== undefined ? Number(estoque) : 0,
      ativo: true,
      imagem: imagem || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    const produto = await FS.getDocument(COLLECTION, id)

    return NextResponse.json(produto, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produto:', error)
    return NextResponse.json(
      { error: 'Erro ao criar produto' },
      { status: 500 }
    )
  }
}
