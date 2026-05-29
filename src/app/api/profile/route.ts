import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import { serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as FS from '@/lib/firestore-service'

/**
 * GET /api/profile
 * Fetches user profile from Firestore + activity stats.
 */
export async function GET(request: NextRequest) {
  try {
    const uid =
      request.headers.get('x-uid') ||
      new URL(request.url).searchParams.get('uid')

    if (!uid) {
      return NextResponse.json(
        { error: 'UID não fornecido. Envie o header x-uid ou o query param uid.' },
        { status: 400 }
      )
    }

    const userDocSnap = await getDoc(doc(db, 'usuarios', uid))

    if (!userDocSnap.exists()) {
      return NextResponse.json(
        { error: 'Usuário não encontrado no Firestore.' },
        { status: 404 }
      )
    }

    const userData = userDocSnap.data()
    const usuario = {
      uid: userData.uid ?? uid,
      nome: userData.nome ?? '',
      email: userData.email ?? '',
      telefone: userData.telefone ?? null,
      role: userData.role ?? 'usuario',
      fotoURL: userData.fotoURL ?? null,
      createdAt: userData.createdAt ?? null,
      updatedAt: userData.updatedAt ?? null,
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
      membroDesde: usuario.createdAt,
    }

    return NextResponse.json({ usuario, stats })
  } catch (error) {
    console.error('Erro ao buscar perfil do usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar perfil do usuário.' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/profile
 * Updates user profile fields.
 */
export async function PUT(request: NextRequest) {
  try {
    const uid =
      request.headers.get('x-uid') ||
      new URL(request.url).searchParams.get('uid')

    if (!uid) {
      return NextResponse.json(
        { error: 'UID não fornecido. Envie o header x-uid ou o query param uid.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { nome, telefone } = body as { nome?: string; telefone?: string }

    if (!nome && !telefone) {
      return NextResponse.json(
        { error: 'Forneça ao menos um campo para atualizar (nome ou telefone).' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    }
    if (nome !== undefined) updates.nome = nome
    if (telefone !== undefined) updates.telefone = telefone

    await updateDoc(doc(db, 'usuarios', uid), updates)

    const updatedSnap = await getDoc(doc(db, 'usuarios', uid))
    if (!updatedSnap.exists()) {
      return NextResponse.json(
        { error: 'Usuário não encontrado após atualização.' },
        { status: 404 }
      )
    }

    const userData = updatedSnap.data()
    const usuario = {
      uid: userData.uid ?? uid,
      nome: userData.nome ?? '',
      email: userData.email ?? '',
      telefone: userData.telefone ?? null,
      role: userData.role ?? 'usuario',
      fotoURL: userData.fotoURL ?? null,
      createdAt: userData.createdAt ?? null,
      updatedAt: userData.updatedAt ?? null,
    }

    return NextResponse.json({ usuario })
  } catch (error) {
    console.error('Erro ao atualizar perfil do usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar perfil do usuário.' },
      { status: 500 }
    )
  }
}
