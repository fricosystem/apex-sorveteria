/**
 * Log Helper — APEX Sorveteria
 *
 * Non-blocking utility to record action logs into Firestore.
 * Intended to be called from other API routes internally.
 * Errors are silently swallowed so logging never blocks business logic.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function logAction(params: {
  acao: string       // e.g. 'venda_criada', 'produto_atualizado'
  entidade: string   // e.g. 'vendas', 'produtos'
  entidadeId: string
  uid?: string
  dadosAnteriores?: Record<string, unknown> | null
  dadosNovos?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await addDoc(collection(db, 'logs'), {
      ...params,
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Erro ao registrar log:', error)
    // Never throw — logging should be non-blocking
  }
}
