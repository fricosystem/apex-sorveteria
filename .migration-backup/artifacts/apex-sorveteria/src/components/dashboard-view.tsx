
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Receipt,
  Percent,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  subDays,
  endOfWeek,
  endOfMonth,
  endOfYear,
  parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDashboardData } from '@/lib/dashboard-service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PeriodType = 'dia' | 'semana' | 'mes' | 'ano' | 'customizado'

interface TotalVendas {
  quantidade: number
  valor: number
}

interface TotalCompras {
  quantidade: number
  valor: number
}

interface ProdutoMaisVendido {
  nome: string
  produtoId: string
  quantidadeVendida: number
}

interface ReceitaPorDia {
  data: string
  receita: number
  quantidade: number
}

interface LucroPorDia {
  data: string
  receita: number
  custo: number
  lucro: number
  quantidade: number
}

interface VendaRecente {
  id: string
  numero: number
  dataVenda: string
  total: number
  formaPagamento: string
  status: string
}

interface EstoqueBaixo {
  id: string
  nome: string
  estoque: number
  categoria: string
}

interface DashboardData {
  totalHoje: TotalVendas
  totalSemana: TotalVendas
  totalMes: TotalVendas
  totalCompras: TotalCompras
  lucroBruto: number
  produtosMaisVendidos: ProdutoMaisVendido[]
  receitaPorDia: ReceitaPorDia[]
  lucroPorDia: LucroPorDia[]
  vendasRecentes: VendaRecente[]
  totalProdutos: number
  estoqueBaixo: EstoqueBaixo[]
}

interface ChartDataPoint {
  label: string
  receita: number
  custo: number
  lucro: number
  quantidade: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatBRL(value: number): string {
  return brlFormatter.format(value)
}

function formatShortBRL(value: number): string {
  if (value >= 1000) {
    return `R$${(value / 1000).toFixed(1)}k`
  }
  return `R$${value.toFixed(0)}`
}

function formatChartDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    return format(date, 'dd/MM', { locale: ptBR })
  } catch {
    return dateStr
  }
}

function formatSaleDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr)
    return format(date, "dd/MM 'às' HH:mm", { locale: ptBR })
  } catch {
    return dateStr
  }
}

function formatInputDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function getDateRange(period: PeriodType): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'dia':
      return { start: startOfDay(now), end: endOfDay(now) }
    case 'semana':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) }
    case 'mes':
      return { start: startOfMonth(now), end: endOfDay(now) }
    case 'ano':
      return { start: startOfYear(now), end: endOfDay(now) }
    default:
      return { start: startOfMonth(now), end: endOfDay(now) }
  }
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Chart
// ---------------------------------------------------------------------------

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}

function ProfitChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const receitaEntry = payload.find((p) => p.dataKey === 'receita')
  const custoEntry = payload.find((p) => p.dataKey === 'custo')
  const lucroEntry = payload.find((p) => p.dataKey === 'lucro')

  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground text-xs">{label}</p>
      <div className="space-y-1">
        {receitaEntry !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />
              <span className="text-xs text-muted-foreground">Receita</span>
            </div>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {formatBRL(receitaEntry.value)}
            </span>
          </div>
        )}
        {custoEntry !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
              <span className="text-xs text-muted-foreground">Custo</span>
            </div>
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
              {formatBRL(custoEntry.value)}
            </span>
          </div>
        )}
        {lucroEntry !== undefined && (
          <div className="flex items-center justify-between gap-4 border-t pt-1 mt-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Lucro</span>
            </div>
            <span
              className={`text-xs font-bold ${lucroEntry.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {formatBRL(lucroEntry.value)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

function CustomLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 pt-1">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />
        <span className="text-[10px] sm:text-xs text-muted-foreground">Receita</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
        <span className="text-[10px] sm:text-xs text-muted-foreground">Custo</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] sm:text-xs text-muted-foreground">Lucro</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Period Chip Component
// ---------------------------------------------------------------------------

function PeriodChip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string
  active: boolean
  onClick: () => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap shrink-0 ${
        active
          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skeleton Sub-components
// ---------------------------------------------------------------------------

function KpiCardSkeleton() {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
        <Skeleton className="h-3 w-20 sm:w-28" />
        <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg" />
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
        <Skeleton className="mb-1 h-6 w-24 sm:h-7 sm:w-32" />
        <Skeleton className="h-3 w-16 sm:w-20" />
      </CardContent>
    </Card>
  )
}

function StatCardSkeleton() {
  return (
    <Card className="min-w-[140px] shrink-0">
      <CardContent className="p-3 sm:p-4 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-20" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// KPI Card Component
// ---------------------------------------------------------------------------

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  valueColor,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  valueColor?: string
}) {
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-4 pt-3 sm:pt-4">
        <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground truncate">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-1.5 sm:p-2 shrink-0 ${iconColor}`}>
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className={`text-lg sm:text-2xl font-bold tracking-tight ${valueColor || ''}`}>{value}</div>
        <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Quick Stat Card
// ---------------------------------------------------------------------------

function QuickStatCard({
  label,
  value,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}) {
  return (
    <Card className="min-w-[130px] sm:min-w-[150px] shrink-0 transition-shadow hover:shadow-md">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${iconColor}`} />
          <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <p className="text-sm sm:text-lg font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodType>('mes')
  const [customStart, setCustomStart] = useState(formatInputDate(startOfMonth(new Date())))
  const [customEnd, setCustomEnd] = useState(formatInputDate(new Date()))
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchDashboard = useCallback(async (selectedPeriod: PeriodType, startDate?: string, endDate?: string) => {
    setIsRefreshing(true)
    try {
      const dashboardData = await getDashboardData(selectedPeriod, startDate, endDate)
      setData(dashboardData as unknown as DashboardData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const dashboardData = await getDashboardData('mes')
        if (!cancelled) {
          setData(dashboardData as unknown as DashboardData)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handlePeriodChange = useCallback((newPeriod: PeriodType) => {
    setPeriod(newPeriod)
    if (newPeriod !== 'customizado') {
      const { start, end } = getDateRange(newPeriod)
      fetchDashboard(newPeriod, formatInputDate(start), formatInputDate(end))
    }
  }, [fetchDashboard])

  const handleApplyCustom = useCallback(() => {
    fetchDashboard('customizado', customStart, customEnd)
  }, [fetchDashboard, customStart, customEnd])

  const handleRefresh = useCallback(() => {
    if (period === 'customizado') {
      fetchDashboard('customizado', customStart, customEnd)
    } else {
      const { start, end } = getDateRange(period)
      fetchDashboard(period, formatInputDate(start), formatInputDate(end))
    }
  }, [fetchDashboard, period, customStart, customEnd])

  // Computed chart data - merge receitaPorDia and lucroPorDia
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!data) return []

    // Prefer lucroPorDia if available (has cost data), fallback to receitaPorDia
    if (data.lucroPorDia && data.lucroPorDia.length > 0) {
      return data.lucroPorDia.map((d) => ({
        label: formatChartDate(d.data),
        receita: d.receita,
        custo: d.custo,
        lucro: d.lucro,
        quantidade: d.quantidade,
      }))
    }

    return data.receitaPorDia.map((d) => ({
      label: formatChartDate(d.data),
      receita: d.receita,
      custo: 0,
      lucro: d.receita,
      quantidade: d.quantidade,
    }))
  }, [data])

  // Quick stats
  const quickStats = useMemo(() => {
    if (!data) return { margem: '0%', ticketMedio: 'R$ 0', produtosVendidos: '0' }

    const receita = data.totalMes?.valor ?? 0
    const custo = data.totalCompras?.valor ?? 0
    const lucro = data.lucroBruto ?? 0
    const margem = receita > 0 ? ((lucro / receita) * 100).toFixed(1) : '0.0'
    const vendas = data.totalMes?.quantidade ?? 0
    const ticketMedio = vendas > 0 ? receita / vendas : 0

    return {
      margem: `${margem}%`,
      ticketMedio: formatBRL(ticketMedio),
      produtosVendidos: String(vendas),
    }
  }, [data])

  // ---- Error state ----
  if (error && !data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da sorveteria</p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // ---- Loading state ----
  if (loading || !data) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Skeleton className="mb-1 h-7 w-32 sm:h-8 sm:w-40" />
            <Skeleton className="h-3 w-48 sm:h-4 sm:w-56" />
          </div>
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>

        {/* Period selector skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full shrink-0" />
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </div>

        {/* Chart skeleton */}
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Skeleton className="h-[200px] sm:h-[280px] lg:h-[300px] w-full" />
          </CardContent>
        </Card>

        {/* Quick stats skeleton */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        {/* Bottom section skeleton */}
        <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Loaded state ----
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ====== Header + Period Filters ====== */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral financeira da sorveteria</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="sr-only">Atualizar</span>
        </Button>
      </div>

      {/* Period Selector */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <PeriodChip
            label="Hoje"
            active={period === 'dia'}
            onClick={() => handlePeriodChange('dia')}
            icon={CalendarDays}
          />
          <PeriodChip
            label="Semana"
            active={period === 'semana'}
            onClick={() => handlePeriodChange('semana')}
            icon={CalendarDays}
          />
          <PeriodChip
            label="Mês"
            active={period === 'mes'}
            onClick={() => handlePeriodChange('mes')}
            icon={CalendarDays}
          />
          <PeriodChip
            label="Ano"
            active={period === 'ano'}
            onClick={() => handlePeriodChange('ano')}
            icon={CalendarDays}
          />
          <PeriodChip
            label="Personalizado"
            active={period === 'customizado'}
            onClick={() => setPeriod('customizado')}
            icon={CalendarDays}
          />
        </div>

        {/* Custom Date Range */}
        {period === 'customizado' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border bg-muted/30">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="dataInicio" className="text-xs text-muted-foreground">
                Data início
              </Label>
              <Input
                id="dataInicio"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="dataFim" className="text-xs text-muted-foreground">
                Data fim
              </Label>
              <Input
                id="dataFim"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleApplyCustom}
              disabled={!customStart || !customEnd || isRefreshing}
              size="sm"
              className="shrink-0 bg-rose-500 hover:bg-rose-600 text-white h-9"
            >
              {isRefreshing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUpRight className="h-3.5 w-3.5" />
              )}
              Aplicar
            </Button>
          </div>
        )}
      </div>

      {/* ====== KPI Cards ====== */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          title="Vendas no Período"
          value={formatBRL(data.totalMes?.valor ?? 0)}
          subtitle={`${data.totalMes?.quantidade ?? 0} vendas realizadas`}
          icon={DollarSign}
          iconColor="bg-rose-500"
        />
        <KpiCard
          title="Compras no Período"
          value={formatBRL(data.totalCompras?.valor ?? 0)}
          subtitle={`${data.totalCompras?.quantidade ?? 0} compras`}
          icon={ShoppingBag}
          iconColor="bg-orange-500"
        />
        <KpiCard
          title="Lucro Bruto"
          value={formatBRL(data.lucroBruto ?? 0)}
          subtitle={
            (data.lucroBruto ?? 0) >= 0
              ? 'Lucro positivo no período'
              : 'Prejuízo no período'
          }
          icon={(data.lucroBruto ?? 0) >= 0 ? TrendingUp : TrendingDown}
          iconColor={(data.lucroBruto ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
          valueColor={(data.lucroBruto ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
        />
        <KpiCard
          title="Total Produtos"
          value={String(data.totalProdutos ?? 0)}
          subtitle="produtos ativos"
          icon={Package}
          iconColor="bg-pink-500"
        />
      </div>

      {/* ====== Low Stock Alert ====== */}
      {data.estoqueBaixo && data.estoqueBaixo.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-sm sm:text-base">
            Estoque Baixo — {data.estoqueBaixo.length} produto(s)
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 flex flex-wrap gap-1.5 sm:gap-2">
              {data.estoqueBaixo.map((p) => (
                <Badge
                  key={p.id}
                  variant="outline"
                  className="text-[10px] sm:text-xs border-amber-400 text-amber-800 dark:border-amber-600 dark:text-amber-200"
                >
                  {p.nome}
                  <span className="ml-1 font-semibold">(estoque: {p.estoque})</span>
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ====== Profit/Loss Chart (MAIN) ====== */}
      <Card className="transition-shadow hover:shadow-md overflow-hidden">
        <CardHeader className="px-3 sm:px-6 pb-0">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-rose-500" />
            Receita x Custos x Lucro
          </CardTitle>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            Comparativo diário do período selecionado
          </p>
        </CardHeader>
        <CardContent className="px-2 sm:px-6 pt-2 sm:pt-4">
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] sm:h-[280px] lg:h-[300px] text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
              <p className="text-xs sm:text-sm">Nenhum dado disponível para o período</p>
              <p className="text-[10px] sm:text-xs mt-0.5 opacity-60">
                Selecione outro período ou aguarde novas vendas
              </p>
            </div>
          ) : (
            <div className="h-[200px] sm:h-[280px] lg:h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
                  <defs>
                    {/* Revenue gradient - rose */}
                    <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#fb7185" stopOpacity={0.7} />
                    </linearGradient>
                    {/* Cost gradient - orange */}
                    <linearGradient id="custoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#fb923c" stopOpacity={0.7} />
                    </linearGradient>
                    {/* Profit line area fill */}
                    <linearGradient id="lucroAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    dy={4}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatShortBRL}
                    width={52}
                  />
                  <Tooltip
                    content={<ProfitChartTooltip />}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  />
                  {/* Revenue bars */}
                  <Bar
                    dataKey="receita"
                    fill="url(#receitaGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    name="Receita"
                  />
                  {/* Cost bars */}
                  <Bar
                    dataKey="custo"
                    fill="url(#custoGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={32}
                    name="Custo"
                  />
                  {/* Profit line */}
                  <Line
                    type="monotone"
                    dataKey="lucro"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#10b981', strokeWidth: 0, fillOpacity: 0.9 }}
                    activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                    name="Lucro"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Legend */}
          {chartData.length > 0 && (
            <CustomLegend />
          )}
        </CardContent>
      </Card>

      {/* ====== Quick Stats Row ====== */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        <QuickStatCard
          label="Margem de Lucro"
          value={quickStats.margem}
          icon={Percent}
          iconColor={
            parseFloat(quickStats.margem) >= 0
              ? 'text-emerald-500'
              : 'text-red-500'
          }
        />
        <QuickStatCard
          label="Ticket Médio"
          value={quickStats.ticketMedio}
          icon={Receipt}
          iconColor="text-rose-500"
        />
        <QuickStatCard
          label="Produtos Vendidos"
          value={quickStats.produtosVendidos}
          icon={Hash}
          iconColor="text-orange-500"
        />
      </div>

      {/* ====== Bottom Section ====== */}
      <div className="grid gap-3 sm:gap-6 md:grid-cols-2">
        {/* Top 5 Products */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
              Mais Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-1 sm:space-y-2">
              {(!data.produtosMaisVendidos || data.produtosMaisVendidos.length === 0) ? (
                <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
                  Nenhuma venda registrada ainda.
                </p>
              ) : (
                data.produtosMaisVendidos.map((produto, idx) => {
                  const rankColors = [
                    'bg-amber-400 text-amber-900',
                    'bg-gray-300 text-gray-700 dark:bg-gray-600 dark:text-gray-200',
                    'bg-orange-300 text-orange-800',
                    'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
                    'bg-pink-50 text-pink-500 dark:bg-pink-950 dark:text-pink-400',
                  ]
                  return (
                    <div
                      key={produto.produtoId}
                      className="flex items-center justify-between rounded-lg px-2 sm:px-3 py-2 sm:py-2.5 transition-colors hover:bg-muted min-h-[2.75rem]"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold shrink-0 ${rankColors[idx] ?? rankColors[4]}`}>
                          {idx + 1}
                        </span>
                        <span className="text-xs sm:text-sm font-medium truncate">{produto.nome}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] sm:text-xs font-mono shrink-0 ml-2">
                        {produto.quantidadeVendida}x
                      </Badge>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-lg">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              Vendas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-2 sm:space-y-3">
              {(!data.vendasRecentes || data.vendasRecentes.length === 0) ? (
                <p className="text-xs sm:text-sm text-muted-foreground py-4 text-center">
                  Nenhuma venda registrada ainda.
                </p>
              ) : (
                data.vendasRecentes.map((venda) => (
                  <div
                    key={venda.id}
                    className="flex items-center justify-between rounded-lg border px-2.5 sm:px-3 py-2.5 sm:py-3 transition-colors hover:bg-muted min-h-[3.5rem]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-foreground">
                          #{venda.numero}
                        </span>
                        <Badge
                          variant={venda.status === 'Concluída' ? 'default' : 'secondary'}
                          className={
                            venda.status === 'Concluída'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[9px] sm:text-xs'
                              : 'text-[9px] sm:text-xs'
                          }
                        >
                          {venda.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] sm:text-xs text-muted-foreground">
                        {formatSaleDate(venda.dataVenda)} · {venda.formaPagamento}
                      </p>
                    </div>
                    <span className="ml-2 sm:ml-4 whitespace-nowrap text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 shrink-0">
                      {formatBRL(venda.total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
