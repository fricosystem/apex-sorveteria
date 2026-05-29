import { NextRequest, NextResponse } from 'next/server'
import { serverTimestamp } from 'firebase/firestore'
import * as FS from '@/lib/firestore-service'

const COLLECTION = FS.COLLECTIONS.PRODUTOS

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const produto = await FS.getDocument(COLLECTION, id)

    if (!produto) {
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(produto)
  } catch (error) {
    console.error('Erro ao buscar produto:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar produto' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const produtoExistente = await FS.getDocument(COLLECTION, id)

    if (!produtoExistente) {
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    const { nome, descricao, preco, custo, categoria, estoque, ativo, imagem } = body

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }

    if (nome !== undefined) updateData.nome = nome
    if (descricao !== undefined) updateData.descricao = descricao || null
    if (preco !== undefined) updateData.preco = Number(preco)
    if (custo !== undefined) updateData.custo = Number(custo)
    if (categoria !== undefined) updateData.categoria = categoria
    if (estoque !== undefined) updateData.estoque = Number(estoque)
    if (ativo !== undefined) updateData.ativo = ativo
    if (imagem !== undefined) updateData.imagem = imagem || null

    await FS.updateDocument(COLLECTION, id, updateData)

    const produto = await FS.getDocument(COLLECTION, id)

    return NextResponse.json(produto)
  } catch (error) {
    console.error('Erro ao atualizar produto:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar produto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const produtoExistente = await FS.getDocument(COLLECTION, id)

    if (!produtoExistente) {
      return NextResponse.json(
        { error: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    // Soft delete
    await FS.updateDocument(COLLECTION, id, {
      ativo: false,
      updatedAt: serverTimestamp(),
    })

    const produto = await FS.getDocument(COLLECTION, id)

    return NextResponse.json(produto)
  } catch (error) {
    console.error('Erro ao desativar produto:', error)
    return NextResponse.json(
      { error: 'Erro ao desativar produto' },
      { status: 500 }
    )
  }
}
