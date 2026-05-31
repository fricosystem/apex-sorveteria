/**
 * Firestore Service Layer — APEX Sorveteria
 *
 * Provides typed CRUD helpers for all Firestore collections,
 * sequential number generation, and subcollection management.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  runTransaction,
  increment,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type FirestoreError,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createId } from '@paralleldrive/cuid2'

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Convert a Firestore Timestamp / Date / string / number to a JS Date */
export function toDate(raw: unknown): Date | null {
  if (!raw) return null
  if (raw instanceof Date) return raw
  if (typeof raw === 'number') return new Date(raw)
  if (typeof raw === 'string') return new Date(raw)
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate()
  }
  if (typeof raw === 'object' && raw !== null && 'seconds' in raw) {
    return new Date((raw as { seconds: number; nanoseconds?: number }).seconds * 1000)
  }
  return null
}

/** Convert a JS Date to a string YYYY-MM-DD */
export function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Generate a new CUID2 id */
export function generateId(): string {
  return createId()
}

/**
 * Convert a Firestore document snapshot to a plain object with:
 * - id field added
 * - Timestamps converted to ISO strings
 */
export function docToData<T = Record<string, unknown>>(
  snap: QueryDocumentSnapshot<DocumentData>
): T & { id: string } {
  const data = snap.data() as DocumentData
  const result: Record<string, unknown> = { id: snap.id }

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate().toISOString()
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'seconds' in value &&
      'nanoseconds' in value
    ) {
      result[key] = new Date(
        (value as { seconds: number }).seconds * 1000
      ).toISOString()
    } else {
      result[key] = value
    }
  }

  return result as T & { id: string }
}

// Re-export for use in API routes
export { serverTimestamp, Timestamp }

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC CRUD
// ═══════════════════════════════════════════════════════════════════════════

/** Get a single document by id */
export async function getDocument<T>(
  collectionName: string,
  id: string
): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return null
  return docToData<T>(snap)
}

/** Simple constraint object that API routes can pass instead of QueryConstraint */
export interface SimpleConstraint {
  field: string
  op: string
  value: unknown
}

type ConstraintInput = QueryConstraint | SimpleConstraint

function isSimpleConstraint(c: ConstraintInput): c is SimpleConstraint {
  return typeof c === 'object' && c !== null && 'field' in c && 'op' in c && 'value' in c
}

/** Convert mixed constraint inputs to proper QueryConstraint[] */
function resolveConstraints(constraints: ConstraintInput[]): QueryConstraint[] {
  return constraints.map((c) => {
    if (isSimpleConstraint(c)) {
      return where(c.field, c.op as import('firebase/firestore').WhereFilterOp, c.value)
    }
    return c
  })
}

/** List documents with optional filters */
export async function listDocuments<T>(
  collectionName: string,
  constraints: ConstraintInput[] = [],
  orderField: string | null = 'createdAt',
  orderDir: 'desc' | 'asc' = 'desc'
): Promise<(T & { id: string })[]> {
  const resolved = resolveConstraints(constraints)
  const queryConstraints: QueryConstraint[] = [...resolved]
  if (orderField) {
    queryConstraints.push(orderBy(orderField, orderDir))
  }
  const q = query(collection(db, collectionName), ...queryConstraints)
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToData<T>(d))
}

/**
 * Real-time listener for a collection.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 * Uses client-side filtering only (no Firestore orderBy) to avoid
 * composite-index requirements and missing-field exclusions.
 */
export function subscribeToCollection<T>(
  collectionName: string,
  onData: (docs: (T & { id: string })[]) => void,
  onError: (err: FirestoreError) => void
): () => void {
  const q = query(collection(db, collectionName))
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => docToData<T>(d))
    onData(docs)
  }, onError)
}

/** Count documents matching constraints */
export async function countDocuments(
  collectionName: string,
  constraints: ConstraintInput[] = []
): Promise<number> {
  const resolved = resolveConstraints(constraints)
  const q = query(collection(db, collectionName), ...resolved)
  const snap = await getDocs(q)
  return snap.size
}

/** Create a new document with auto-generated id */
export async function createDocument<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
): Promise<string> {
  const ref = await addDoc(collection(db, collectionName), data)
  return ref.id
}

/** Create a document with a specific id (CUID2) */
export async function createDocumentWithId<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T
): Promise<void> {
  await setDoc(doc(db, collectionName, id), data)
}

/** Update a document by id */
export async function updateDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), data)
}

/** Delete a document by id */
export async function deleteDocument(
  collectionName: string,
  id: string
): Promise<void> {
  await deleteDoc(doc(db, collectionName, id))
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENTIAL NUMBER GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

export async function getNextNumber(
  collectionName: string
): Promise<number> {
  const counterRef = doc(db, 'counters', collectionName)

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef)
    const current = counterSnap.exists()
      ? (counterSnap.data().value as number) || 0
      : 0
    const next = current + 1
    tx.set(counterRef, { value: next })
    return next
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOLLECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export async function listSubDocuments<T>(
  parentCollection: string,
  parentId: string,
  subCollection: string,
  constraints: QueryConstraint[] = []
): Promise<(T & { id: string })[]> {
  const q = query(
    collection(db, parentCollection, parentId, subCollection),
    ...constraints
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => docToData<T>(d))
}

export async function addSubDocument<T extends Record<string, unknown>>(
  parentCollection: string,
  parentId: string,
  subCollection: string,
  data: T
): Promise<string> {
  const ref = await addDoc(
    collection(db, parentCollection, parentId, subCollection),
    data
  )
  return ref.id
}

export async function deleteSubCollection(
  parentCollection: string,
  parentId: string,
  subCollection: string
): Promise<void> {
  const snap = await getDocs(
    collection(db, parentCollection, parentId, subCollection)
  )
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

// ═══════════════════════════════════════════════════════════════════════════
// ATOMIC STOCK OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function incrementField(
  collectionName: string,
  id: string,
  field: string,
  value: number
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), {
    [field]: increment(value),
    updatedAt: serverTimestamp(),
  })
}

export async function decrementStock(
  items: { produtoId: string; quantidade: number }[]
): Promise<void> {
  const batch = writeBatch(db)
  for (const item of items) {
    const ref = doc(db, 'produtos', item.produtoId)
    batch.update(ref, {
      estoque: increment(-item.quantidade),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

export async function incrementStock(
  items: { produtoId: string; quantidade: number }[]
): Promise<void> {
  const batch = writeBatch(db)
  for (const item of items) {
    const ref = doc(db, 'produtos', item.produtoId)
    batch.update(ref, {
      estoque: increment(item.quantidade),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

// ═══════════════════════════════════════════════════════════════════════════
// AGGREGATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export interface AggregateResult {
  _count: number
  _sum: Record<string, number>
}

export async function aggregateField(
  collectionName: string,
  sumField: string,
  constraints: ConstraintInput[] = []
): Promise<{ count: number; sum: number }> {
  const resolved = resolveConstraints(constraints)
  const q = query(collection(db, collectionName), ...resolved)
  const snap = await getDocs(q)
  let count = 0
  let sum = 0
  snap.forEach((d) => {
    const val = d.data()[sumField]
    if (typeof val === 'number') {
      sum += val
      count++
    }
  })
  return { count, sum }
}

export async function groupByField(
  collectionName: string,
  groupField: string,
  sumField: string,
  constraints: ConstraintInput[] = [],
  maxResults = 5
): Promise<{ groupValue: string; sum: number }[]> {
  const resolved = resolveConstraints(constraints)
  const q = query(collection(db, collectionName), ...resolved)
  const snap = await getDocs(q)

  const groups: Record<string, number> = {}
  snap.forEach((d) => {
    const data = d.data()
    const key = String(data[groupField] || '')
    const val = typeof data[sumField] === 'number' ? (data[sumField] as number) : 0
    groups[key] = (groups[key] || 0) + val
  })

  return Object.entries(groups)
    .map(([groupValue, sum]) => ({ groupValue, sum }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, maxResults)
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLECTION NAMES
// ═══════════════════════════════════════════════════════════════════════════

export const COLLECTIONS = {
  USUARIOS: 'usuarios',
  PRODUTOS: 'produtos',
  VENDAS: 'vendas',
  COMPRAS: 'compras',
  CAIXA: 'caixa',
  CONFIG: 'config',
  LOGS: 'logs',
  CONTADORES: 'counters',
} as const
