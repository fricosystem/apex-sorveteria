import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as FS from '@/lib/firestore-service'
import { toDate, docToData } from '@/lib/firestore-service'

// ═══════════════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfYear(date: Date): Date {
  const d = new Date(date)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface VendaRow {
  id: string
  total: number
  dataVenda: Date | null
  dataStr: string
}

interface CompraRow {
  id: string
  totalCusto: number
  dataCompra: Date | null
  dataStr: string
}

// ═══════════════════════════════════════════════════════════════════════════
// getDashboardData
// ═══════════════════════════════════════════════════════════════════════════

export async function getDashboardData(
  periodo: string,
  customDataInicio?: string,
  customDataFim?: string
) {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const weekStart = startOfWeek(now)
  const monthStart = startOfMonth(now)

  const useCustomRange = !!(customDataInicio || customDataFim)

  const dayStart = useCustomRange && customDataInicio
    ? startOfDay(new Date(customDataInicio))
    : todayStart
  const dayEnd = useCustomRange && customDataFim
    ? endOfDay(new Date(customDataFim))
    : todayEnd
  const weekStartRange = useCustomRange && customDataInicio
    ? startOfDay(new Date(customDataInicio))
    : weekStart
  const weekEndRange = useCustomRange && customDataFim
    ? endOfDay(new Date(customDataFim))
    : todayEnd
  const monthStartRange = useCustomRange && customDataInicio
    ? startOfDay(new Date(customDataInicio))
    : monthStart
  const monthEndRange = useCustomRange && customDataFim
    ? endOfDay(new Date(customDataFim))
    : todayEnd

  let rangeStart: Date
  let rangeEnd: Date

  if (useCustomRange && customDataInicio && customDataFim) {
    rangeStart = startOfDay(new Date(customDataInicio))
    rangeEnd = endOfDay(new Date(customDataFim))
  } else {
    switch (periodo) {
      case 'ano':
        rangeStart = startOfYear(now)
        rangeEnd = todayEnd
        break
      case 'mes':
        rangeStart = startOfMonth(now)
        rangeEnd = todayEnd
        break
      case 'semana':
        rangeStart = startOfWeek(now)
        rangeEnd = todayEnd
        break
      case 'dia':
      default:
        rangeStart = todayStart
        rangeEnd = todayEnd
        break
    }
  }

  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const allStarts = [dayStart, weekStartRange, monthStartRange, rangeStart, sevenDaysAgo]
  const allEnds = [dayEnd, weekEndRange, monthEndRange, rangeEnd, todayEnd]

  const maxStart = new Date(Math.min(...allStarts.map(d => d.getTime())))
  const maxEnd = new Date(Math.max(...allEnds.map(d => d.getTime())))

  const [vendasSnap, comprasSnap, vendasRecentesSnap, produtosSnap] =
    await Promise.all([
      getDocs(
        query(
          collection(db, 'vendas'),
          where('dataVenda', '>=', maxStart),
          where('dataVenda', '<=', maxEnd)
        )
      ),
      getDocs(
        query(
          collection(db, 'compras'),
          where('dataCompra', '>=', maxStart),
          where('dataCompra', '<=', maxEnd)
        )
      ),
      getDocs(
        query(
          collection(db, 'vendas'),
          orderBy('dataVenda', 'desc'),
          limit(5)
        )
      ),
      getDocs(
        query(
          collection(db, 'produtos'),
          where('ativo', '==', true)
        )
      ),
    ])

  const vendasData: VendaRow[] = vendasSnap.docs
    .filter(d => d.data().status === 'Concluida')
    .map(d => {
    const data = d.data()
    const dv = toDate(data.dataVenda)
    return {
      id: d.id,
      total: typeof data.total === 'number' ? data.total : 0,
      dataVenda: dv,
      dataStr: dv ? dv.toISOString().split('T')[0] : '',
    }
  })

  function aggVendas(start: Date, end: Date) {
    let quantidade = 0
    let valor = 0
    for (const v of vendasData) {
      if (!v.dataVenda) continue
      if (v.dataVenda >= start && v.dataVenda <= end) {
        quantidade++
        valor += v.total
      }
    }
    return { quantidade, valor }
  }

  const totalHoje = aggVendas(dayStart, dayEnd)
  const totalSemana = aggVendas(weekStartRange, weekEndRange)
  const totalMes = aggVendas(monthStartRange, monthEndRange)

  const comprasData: CompraRow[] = comprasSnap.docs
    .filter(d => d.data().status === 'Concluida')
    .map(d => {
    const data = d.data()
    const dc = toDate(data.dataCompra)
    return {
      id: d.id,
      totalCusto: typeof data.totalCusto === 'number' ? data.totalCusto : 0,
      dataCompra: dc,
      dataStr: dc ? dc.toISOString().split('T')[0] : '',
    }
  })

  function aggCompras(start: Date, end: Date) {
    let quantidade = 0
    let valor = 0
    for (const c of comprasData) {
      if (!c.dataCompra) continue
      if (c.dataCompra >= start && c.dataCompra <= end) {
        quantidade++
        valor += c.totalCusto
      }
    }
    return { quantidade, valor }
  }

  const totalCompras = aggCompras(monthStartRange, monthEndRange)
  const lucroBruto = totalMes.valor - totalCompras.valor

  const vendasByDay = new Map<string, { receita: number; quantidade: number }>()
  for (const v of vendasData) {
    if (!v.dataVenda) continue
    if (v.dataVenda < rangeStart || v.dataVenda > rangeEnd) continue
    const key = v.dataStr
    const existing = vendasByDay.get(key) || { receita: 0, quantidade: 0 }
    existing.receita += v.total
    existing.quantidade += 1
    vendasByDay.set(key, existing)
  }

  const comprasByDay = new Map<string, number>()
  for (const c of comprasData) {
    if (!c.dataCompra) continue
    if (c.dataCompra < rangeStart || c.dataCompra > rangeEnd) continue
    const key = c.dataStr
    comprasByDay.set(key, (comprasByDay.get(key) || 0) + c.totalCusto)
  }

  const lucroPorDia: {
    data: string
    receita: number
    custo: number
    lucro: number
    quantidade: number
  }[] = []

  const cursor = new Date(rangeStart)
  while (cursor <= rangeEnd) {
    const key = cursor.toISOString().split('T')[0]
    const vData = vendasByDay.get(key) || { receita: 0, quantidade: 0 }
    const custo = comprasByDay.get(key) || 0
    lucroPorDia.push({
      data: key,
      receita: vData.receita,
      custo,
      lucro: vData.receita - custo,
      quantidade: vData.quantidade,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const receitaPorDia: {
    data: string
    receita: number
    quantidade: number
  }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const vData = vendasByDay.get(key) || { receita: 0, quantidade: 0 }
    receitaPorDia.push({
      data: key,
      receita: vData.receita,
      quantidade: vData.quantidade,
    })
  }

  const monthVendas = vendasData.filter(v => {
    if (!v.dataVenda) return false
    return v.dataVenda >= monthStartRange && v.dataVenda <= monthEndRange
  })

  const itensByProduto = new Map<string, { nome: string; quantidade: number }>()
  await Promise.all(
    monthVendas.map(async venda => {
      try {
        const itensSnap = await getDocs(
          collection(db, 'vendas', venda.id, 'itens')
        )
        itensSnap.docs.forEach(d => {
          const data = d.data()
          const produtoId = String(data.produtoId || '')
          const nome = String(data.nomeProduto || '')
          const quantidade =
            typeof data.quantidade === 'number' ? data.quantidade : 0
          const existing = itensByProduto.get(produtoId) || {
            nome,
            quantidade: 0,
          }
          existing.quantidade += quantidade
          itensByProduto.set(produtoId, existing)
        })
      } catch {
        // Skip
      }
    })
  )

  const produtosMaisVendidos = Array.from(itensByProduto.entries())
    .map(([produtoId, data]) => ({
      nome: data.nome,
      produtoId,
      quantidadeVendida: data.quantidade,
    }))
    .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
    .slice(0, 5)

  const vendasRecentes = await Promise.all(
    vendasRecentesSnap.docs.map(async snap => {
      const venda = docToData(snap)
      const itens = await FS.listSubDocuments(
        FS.COLLECTIONS.VENDAS,
        snap.id,
        'itens'
      )
      return { ...venda, itens }
    })
  )

  const totalProdutos = produtosSnap.size

  const estoqueBaixo = produtosSnap.docs
    .map(d => docToData(d))
    .filter(
      (p: Record<string, unknown>) =>
        typeof p.estoque === 'number' && (p.estoque as number) < 5
    )
    .sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((a.estoque as number) ?? 0) - ((b.estoque as number) ?? 0)
    )

  return {
    totalHoje,
    totalSemana,
    totalMes,
    totalCompras,
    lucroBruto,
    lucroPorDia,
    produtosMaisVendidos,
    receitaPorDia,
    vendasRecentes,
    totalProdutos,
    estoqueBaixo,
  }
}
