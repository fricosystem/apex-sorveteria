'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as FS from '@/lib/firestore-service'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  Trash2,
  Package,
  ShoppingCart,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatBRL(value: number): string {
  return fmt.format(value)
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ── Types ────────────────────────────────────────────────────────────────

interface Produto {
  id: string
  nome: string
  descricao: string | null
  preco: number
  custo: number
  categoria: string
  estoque: number
  ativo: boolean
  imagem: string | null
}

interface ItemCompra {
  id: string
  compraId: string
  produtoId: string
  nomeProduto: string
  quantidade: number
  custoUnitario: number
  subtotal: number
  createdAt: string
}

interface Compra {
  id: string
  numero: number
  dataCompra: string
  fornecedor: string
  observacoes: string | null
  totalCusto: number
  status: string
  createdAt: string
  updatedAt: string
  itens: ItemCompra[]
}

interface CompraItemForm {
  produtoId: string
  nomeProduto: string
  quantidade: number
  custoUnitario: number
  subtotal: number
}

// ── Component ────────────────────────────────────────────────────────────

export default function ComprasView() {
  // ── State: Purchases list ──────────────────────────────────────────────
  const [compras, setCompras] = useState<Compra[]>([])
  const [loadingCompras, setLoadingCompras] = useState(true)

  // ── State: Date filters ───────────────────────────────────────────────
  const today = new Date()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const [dataInicio, setDataInicio] = useState(toDateString(thirtyDaysAgo))
  const [dataFim, setDataFim] = useState(toDateString(today))

  // ── State: New Purchase Dialog ─────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(false)
  const [searchProduto, setSearchProduto] = useState('')
  const [itensForm, setItensForm] = useState<CompraItemForm[]>([])
  const [fornecedor, setFornecedor] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // ── State: Delete confirmation ─────────────────────────────────────────
  const [deletingCompra, setDeletingCompra] = useState<Compra | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── State: Expanded purchase card ─────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── Derived ────────────────────────────────────────────────────────────

  const filteredProdutos = useMemo(() => {
    if (!searchProduto.trim()) return produtos
    const q = searchProduto.toLowerCase().trim()
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q),
    )
  }, [produtos, searchProduto])

  const totalCompras = useMemo(
    () => compras.reduce((acc, c) => acc + c.totalCusto, 0),
    [compras],
  )

  const totalItensForm = useMemo(
    () => itensForm.reduce((acc, item) => acc + item.subtotal, 0),
    [itensForm],
  )

  // ── Data Fetching ─────────────────────────────────────────────────────

  const fetchCompras = useCallback(async () => {
    try {
      setLoadingCompras(true)
      
      const constraints: import('@/lib/firestore-service').SimpleConstraint[] = []

      if (dataInicio || dataFim) {
        const start = dataInicio ? new Date(dataInicio) : null
        const end = dataFim
          ? (() => {
              const d = new Date(dataFim)
              d.setHours(23, 59, 59, 999)
              return d
            })()
          : null

        if (start && end) {
          constraints.push({ field: 'dataCompra', op: '>=', value: start })
          constraints.push({ field: 'dataCompra', op: '<=', value: end })
        } else if (start) {
          constraints.push({ field: 'dataCompra', op: '>=', value: start })
        } else if (end) {
          constraints.push({ field: 'dataCompra', op: '<=', value: end })
        }
      }
      
      const data = await FS.listDocuments<Compra>(FS.COLLECTIONS.COMPRAS, constraints, 'dataCompra', 'desc')
      
      const comprasWithItens = await Promise.all(
        data.map(async (compra) => {
          const itens = await FS.listSubDocuments<ItemCompra>(FS.COLLECTIONS.COMPRAS, compra.id, 'itens')
          return { ...compra, itens }
        })
      )
      
      setCompras(comprasWithItens)
    } catch {
      toast.error('Erro ao carregar compras')
      setCompras([])
    } finally {
      setLoadingCompras(false)
    }
  }, [dataInicio, dataFim])

  const fetchProdutos = useCallback(async () => {
    try {
      setLoadingProdutos(true)
      const data = await FS.listDocuments<Produto>(FS.COLLECTIONS.PRODUTOS, [], 'createdAt', 'desc')
      setProdutos(data)
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProdutos(false)
    }
  }, [])

  useEffect(() => {
    fetchCompras()
  }, [fetchCompras])

  // ── Handlers: New Purchase Dialog ─────────────────────────────────────

  function openNewCompraDialog() {
    setItensForm([])
    setFornecedor('')
    setObservacoes('')
    setSearchProduto('')
    fetchProdutos()
    setDialogOpen(true)
  }

  function addProdutoToForm(produto: Produto) {
    // Check if already added
    const existing = itensForm.find((i) => i.produtoId === produto.id)
    if (existing) {
      toast.info(`${produto.nome} já está na lista`)
      return
    }

    setItensForm((prev) => [
      ...prev,
      {
        produtoId: produto.id,
        nomeProduto: produto.nome,
        quantidade: 1,
        custoUnitario: produto.custo || 0,
        subtotal: produto.custo || 0,
      },
    ])
    setSearchProduto('')
    toast.success(`${produto.nome} adicionado`)
  }

  function updateItemQuantidade(produtoId: string, quantidade: number) {
    setItensForm((prev) =>
      prev.map((item) => {
        if (item.produtoId !== produtoId) return item
        const qty = Math.max(1, quantidade)
        return {
          ...item,
          quantidade: qty,
          subtotal: qty * item.custoUnitario,
        }
      }),
    )
  }

  function updateItemCusto(produtoId: string, custoUnitario: number) {
    setItensForm((prev) =>
      prev.map((item) => {
        if (item.produtoId !== produtoId) return item
        const custo = Math.max(0, custoUnitario)
        return {
          ...item,
          custoUnitario: custo,
          subtotal: item.quantidade * custo,
        }
      }),
    )
  }

  function removeItemFromForm(produtoId: string) {
    setItensForm((prev) => prev.filter((i) => i.produtoId !== produtoId))
  }

  async function handleSubmitCompra() {
    if (itensForm.length === 0) {
      toast.error('Adicione pelo menos um produto')
      return
    }

    try {
      setSubmitting(true)

      for (const item of itensForm) {
        const produto = await FS.getDocument<Produto>(FS.COLLECTIONS.PRODUTOS, item.produtoId)
        if (!produto) throw new Error(`Produto não encontrado: ${item.nomeProduto}`)
      }

      const totalCusto = itensForm.reduce((acc, item) => acc + item.subtotal, 0)
      const nextNumero = await FS.getNextNumber('compras')
      const compraId = FS.generateId()

      await FS.createDocumentWithId(FS.COLLECTIONS.COMPRAS, compraId, {
        id: compraId,
        numero: nextNumero,
        fornecedor: fornecedor.trim(),
        status: 'Concluida',
        observacoes: observacoes.trim() || null,
        totalCusto,
        dataCompra: FS.serverTimestamp(),
      })

      for (const item of itensForm) {
        const itemId = FS.generateId()
        await FS.addSubDocument(FS.COLLECTIONS.COMPRAS, compraId, 'itens', {
          id: itemId,
          produtoId: item.produtoId,
          nomeProduto: item.nomeProduto,
          quantidade: item.quantidade,
          custoUnitario: item.custoUnitario,
          subtotal: item.subtotal,
          createdAt: FS.serverTimestamp(),
        })
      }

      await FS.incrementStock(itensForm.map(item => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade
      })))

      toast.success(`Compra #${nextNumero} registrada com sucesso!`)
      setDialogOpen(false)
      fetchCompras()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar compra')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Handlers: Delete ──────────────────────────────────────────────────

  async function handleDeleteCompra(compra: Compra) {
    try {
      setDeleting(true)
      await FS.deleteSubCollection(FS.COLLECTIONS.COMPRAS, compra.id, 'itens')
      await FS.deleteDocument(FS.COLLECTIONS.COMPRAS, compra.id)
      toast.success(`Compra #${compra.numero} excluída!`)
      setDeletingCompra(null)
      fetchCompras()
    } catch {
      toast.error('Erro ao excluir compra')
    } finally {
      setDeleting(false)
    }
  }

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // ── Skeleton helpers ──────────────────────────────────────────────────

  function StatsSkeleton() {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  function CompraCardSkeleton() {
    return (
      <Card>
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-24" />
        </CardContent>
      </Card>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-rose-100 rounded-lg p-1.5 sm:p-2 shrink-0">
            <ShoppingCart className="size-5 sm:size-6 text-rose-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
              Compras
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Registro de entradas de estoque
            </p>
          </div>
        </div>
        <Button
          onClick={openNewCompraDialog}
          size="sm"
          className="h-10 px-3 sm:h-auto sm:px-4 shrink-0"
        >
          <Plus className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Nova Compra</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* ── Date Filters ───────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end">
            <div className="flex items-center gap-2 shrink-0">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                Período:
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
              <div className="flex-1 min-w-0">
                <Label htmlFor="data-inicio" className="text-xs text-muted-foreground mb-1 block">
                  Data Início
                </Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label htmlFor="data-fim" className="text-xs text-muted-foreground mb-1 block">
                  Data Fim
                </Label>
                <Input
                  id="data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Stats Summary ───────────────────────────────────────────────── */}
      {loadingCompras ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-rose-100 rounded-md p-1.5">
                  <Package className="size-4 text-rose-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Total Compras
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-foreground">
                {compras.length}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                no período selecionado
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-amber-100 rounded-md p-1.5">
                  <CalendarDays className="size-4 text-amber-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Custo Total
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-rose-600">
                {formatBRL(totalCompras)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                em compras de estoque
              </p>
            </CardContent>
          </Card>

          <Card className="hidden lg:block hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-emerald-100 rounded-md p-1.5">
                  <ShoppingCart className="size-4 text-emerald-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Itens Comprados
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-foreground">
                {compras.reduce((acc, c) => acc + c.itens.length, 0)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                produtos distintos
              </p>
            </CardContent>
          </Card>

          <Card className="hidden lg:block hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-sky-100 rounded-md p-1.5">
                  <Package className="size-4 text-sky-600" />
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  Média por Compra
                </span>
              </div>
              <p className="text-lg sm:text-xl font-bold text-foreground">
                {compras.length > 0 ? formatBRL(totalCompras / compras.length) : formatBRL(0)}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                ticket médio de compra
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Purchase History ────────────────────────────────────────────── */}
      <div className="space-y-2 sm:space-y-3">
        <h2 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
          <Package className="size-4 text-muted-foreground" />
          Histórico de Compras
        </h2>

        {loadingCompras ? (
          <div className="flex flex-col gap-2 sm:gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <CompraCardSkeleton key={i} />
            ))}
          </div>
        ) : compras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center px-4">
            <div className="bg-muted rounded-full p-3 sm:p-4 mb-3 sm:mb-4">
              <ShoppingCart className="size-8 sm:size-10 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
              Nenhuma compra encontrada
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
              Não há compras no período selecionado. Tente alterar as datas ou
              registre uma nova compra.
            </p>
            <Button className="mt-4 h-11" onClick={openNewCompraDialog}>
              <Plus className="size-4 mr-2" />
              Nova Compra
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:gap-3 max-h-[calc(100dvh-28rem)] lg:max-h-[calc(100dvh-24rem)] overflow-y-auto pr-0.5">
            {compras.map((compra) => {
              const isExpanded = expandedId === compra.id
              return (
                <Card
                  key={compra.id}
                  className="overflow-hidden transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-3 sm:p-4">
                    {/* Row 1: Number + Date + Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="secondary"
                          className="bg-rose-100 text-rose-700 hover:bg-rose-100 shrink-0 text-xs font-semibold"
                        >
                          #{compra.numero}
                        </Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground truncate">
                          {formatDate(compra.dataCompra)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 active:scale-95"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">
                                Excluir compra #{compra.numero}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Tem certeza que deseja excluir esta compra? O
                                estoque dos produtos associados pode ser
                                afetado.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2 sm:gap-0">
                              <AlertDialogCancel className="flex-1 sm:flex-none h-11">
                                Cancelar
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteCompra(compra)}
                                disabled={deleting}
                                className="flex-1 sm:flex-none bg-destructive text-white hover:bg-destructive/90 h-11"
                              >
                                {deleting ? (
                                  <span className="flex items-center gap-2">
                                    <Loader2 className="size-4 animate-spin" />
                                    Excluindo...
                                  </span>
                                ) : (
                                  'Excluir'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 active:scale-95"
                          onClick={() => toggleExpanded(compra.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Row 2: Fornecedor */}
                    {compra.fornecedor && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 truncate">
                        <span className="font-medium">Fornecedor:</span>{' '}
                        {compra.fornecedor}
                      </p>
                    )}

                    {/* Row 3: Total */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {compra.itens.length}{' '}
                        {compra.itens.length === 1 ? 'item' : 'itens'}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-rose-600">
                        {formatBRL(compra.totalCusto)}
                      </span>
                    </div>

                    {/* Expanded: Items list */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          Itens da Compra
                        </p>
                        <div className="flex flex-col divide-y">
                          {compra.itens.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between py-2 gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-medium truncate">
                                  {item.nomeProduto}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">
                                  {item.quantidade} un. ×{' '}
                                  {formatBRL(item.custoUnitario)}
                                </p>
                              </div>
                              <span className="text-xs sm:text-sm font-semibold shrink-0">
                                {formatBRL(item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                        {compra.observacoes && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">
                              Observações
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {compra.observacoes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ── New Purchase Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[100vw] sm:max-w-md fixed bottom-0 left-0 right-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-y-0 sm:top-[50%] rounded-b-none sm:rounded-b-lg rounded-t-2xl sm:rounded-t-lg max-h-[90dvh] sm:max-h-[85vh] flex flex-col p-0 gap-0 border-b-0 sm:border-b [&>button]:top-3 [&>button]:right-3 z-[60] overflow-hidden">
          {/* Drag handle (mobile) */}
          <div className="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          <DialogHeader className="px-4 pb-2 pt-0 sm:pt-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingCart className="h-5 w-5 text-rose-600" />
              Nova Compra
              {itensForm.length > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {itensForm.length} {itensForm.length === 1 ? 'item' : 'itens'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
            <div className="px-4 pt-3 pb-2 flex flex-col gap-3">
              {/* Product Search */}
              <div className="space-y-1.5">
                <Label className="text-xs sm:text-sm font-medium">
                  Buscar Produto
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome ou categoria do produto..."
                    value={searchProduto}
                    onChange={(e) => setSearchProduto(e.target.value)}
                    className="pl-9 h-10 text-sm"
                  />
                </div>
              </div>

              {/* Product List */}
              {searchProduto.trim() && (
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  {loadingProdutos ? (
                    <div className="flex flex-col gap-1 p-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-md" />
                      ))}
                    </div>
                  ) : filteredProdutos.length === 0 ? (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 divide-y">
                      {filteredProdutos.slice(0, 10).map((produto) => {
                        const alreadyAdded = itensForm.some(
                          (i) => i.produtoId === produto.id,
                        )
                        return (
                          <button
                            key={produto.id}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => addProdutoToForm(produto)}
                            className="flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:bg-muted/80 min-h-[44px]"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-medium truncate">
                                {produto.nome}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {produto.categoria}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  Estoque: {produto.estoque} un.
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs sm:text-sm font-semibold text-rose-600">
                                {formatBRL(produto.custo || 0)}
                              </span>
                              {alreadyAdded ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5"
                                >
                                  Adicionado
                                </Badge>
                              ) : (
                                <Plus className="size-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Added Items */}
              {itensForm.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm font-medium">
                    Produtos Adicionados
                  </Label>
                  <div className="flex flex-col gap-2">
                    {itensForm.map((item) => (
                      <Card key={item.produtoId} className="overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-xs sm:text-sm font-medium truncate">
                              {item.nomeProduto}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                              onClick={() => removeItemFromForm(item.produtoId)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] sm:text-xs text-muted-foreground">
                                Quantidade
                              </Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                step={1}
                                value={item.quantidade}
                                onChange={(e) =>
                                  updateItemQuantidade(
                                    item.produtoId,
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                                className="h-9 text-xs sm:text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] sm:text-xs text-muted-foreground">
                                Custo Un. (R$)
                              </Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step={0.01}
                                value={item.custoUnitario || ''}
                                onChange={(e) =>
                                  updateItemCusto(
                                    item.produtoId,
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className="h-9 text-xs sm:text-sm"
                                placeholder="0,00"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end mt-1.5">
                            <span className="text-xs sm:text-sm font-bold text-rose-600">
                              Subtotal: {formatBRL(item.subtotal)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Fornecedor */}
              <div className="space-y-1.5">
                <Label htmlFor="fornecedor" className="text-xs sm:text-sm font-medium">
                  Fornecedor
                </Label>
                <Input
                  id="fornecedor"
                  placeholder="Nome do fornecedor (opcional)"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label htmlFor="obs-compra" className="text-xs sm:text-sm font-medium">
                  Observações
                </Label>
                <Textarea
                  id="obs-compra"
                  placeholder="Observações sobre a compra (opcional)"
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-card shrink-0 px-4 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {itensForm.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs sm:text-sm font-semibold">
                    Total da Compra
                  </span>
                  <span className="text-base sm:text-lg font-bold text-rose-600">
                    {formatBRL(totalItensForm)}
                  </span>
                </div>
                <Separator className="mb-3" />
              </>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitCompra}
                disabled={submitting || itensForm.length === 0}
                className="flex-1 h-11 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Registrando...
                  </span>
                ) : (
                  <>
                    <ShoppingCart className="size-4 mr-1.5" />
                    Registrar Compra
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
