
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useStore, CartItem } from '@/lib/store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as FS from '@/lib/firestore-service'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Search,
  Store,
  CircleDollarSign,
} from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatPrice(value: number): string {
  return fmt.format(value)
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
  createdAt: string
  updatedAt: string
}

interface Caixa {
  id: string
  dataAbertura: string
  dataFechamento: string | null
  valorInicial: number
  valorFinal: number | null
  totalVendas: number
  status: string
  observacoes: string | null
}

const CATEGORIAS = [
  'Todas',
  'Potes',
  'Picolés',
  'Massas',
  'Açaí',
  'Bebidas',
  'Complementos',
]

const PAYMENT_OPTIONS = [
  { value: 'Dinheiro', label: 'Dinheiro', icon: Banknote },
  { value: 'Pix', label: 'Pix', icon: QrCode },
  { value: 'Cartão Crédito', label: 'Crédito', icon: CreditCard },
  { value: 'Cartão Débito', label: 'Débito', icon: CreditCard },
] as const

// ── Component ────────────────────────────────────────────────────────────

export default function CaixaView() {
  // Store
  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    discount,
    setDiscount,
    paymentMethod,
    setPaymentMethod,
    cartTotal,
    cartItemsCount,
  } = useStore()

  // Local state
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoria, setSelectedCategoria] = useState('Todas')

  const [caixa, setCaixa] = useState<Caixa | null>(null)
  const [loadingCaixa, setLoadingCaixa] = useState(true)
  const [finalizandoVenda, setFinalizandoVenda] = useState(false)

  const [openDialog, setOpenDialog] = useState(false)
  const [dialogType, setDialogType] = useState<'abrir-caixa' | 'fechar-caixa'>('abrir-caixa')
  const [valorInicial, setValorInicial] = useState('')
  const [submittingCaixa, setSubmittingCaixa] = useState(false)

  // Mobile cart sheet
  const [cartSheetOpen, setCartSheetOpen] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────

  const filteredProdutos = useMemo(() => {
    let result = produtos

    if (selectedCategoria !== 'Todas') {
      result = result.filter((p) => p.categoria === selectedCategoria)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((p) => p.nome.toLowerCase().includes(q))
    }

    return result
  }, [produtos, selectedCategoria, searchQuery])

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.subtotal, 0),
    [cart],
  )

  const total = cartTotal()
  const itemCount = cartItemsCount()

  const isCaixaOpen = caixa !== null && caixa.status === 'Aberto'

  // ── Data Fetching ────────────────────────────────────────────────────

  const fetchProdutos = useCallback(async () => {
    try {
      setLoadingProdutos(true)
      const constraints: import('@/lib/firestore-service').SimpleConstraint[] = [
        { field: 'ativo', op: '==', value: true }
      ]
      if (selectedCategoria !== 'Todas') {
        constraints.push({ field: 'categoria', op: '==', value: selectedCategoria })
      }
      
      let data = await FS.listDocuments<Produto>(FS.COLLECTIONS.PRODUTOS, constraints, 'createdAt', 'desc')
      
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        data = data.filter((p) => String(p.nome).toLowerCase().includes(q))
      }
      
      setProdutos(data)
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoadingProdutos(false)
    }
  }, [selectedCategoria, searchQuery])

  const fetchCaixa = useCallback(async () => {
    try {
      setLoadingCaixa(true)
      const data = await FS.listDocuments<Caixa>(
        FS.COLLECTIONS.CAIXA,
        [{ field: 'status', op: '==', value: 'Aberto' }],
        'dataAbertura',
        'desc'
      )
      setCaixa(data.length > 0 ? data[0] : null)
    } catch {
      setCaixa(null)
    } finally {
      setLoadingCaixa(false)
    }
  }, [])

  useEffect(() => {
    fetchProdutos()
  }, [fetchProdutos])

  useEffect(() => {
    fetchCaixa()
  }, [fetchCaixa])

  // ── Handlers ─────────────────────────────────────────────────────────

  function handleAddToCart(produto: Produto) {
    addToCart({
      id: produto.id,
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: 1,
      subtotal: produto.preco,
    })
    toast.success(`${produto.nome} adicionado`)
  }

  async function handleFinalizarVenda() {
    if (cart.length === 0) {
      toast.error('Adicione itens ao carrinho antes de finalizar')
      return
    }

    if (!isCaixaOpen || !caixa) {
      toast.error('Abra o caixa antes de finalizar uma venda')
      return
    }

    try {
      setFinalizandoVenda(true)

      const itens = cart.map((item) => ({
        produtoId: item.produtoId,
        nomeProduto: item.nome,
        quantidade: item.quantidade,
        precoUnitario: item.preco,
        subtotal: item.subtotal,
      }))

      for (const item of itens) {
        const produto = await FS.getDocument<Produto>(FS.COLLECTIONS.PRODUTOS, item.produtoId)
        if (!produto) throw new Error(`Produto não encontrado: ${item.nomeProduto}`)
        if (!produto.ativo) throw new Error(`Produto inativo: ${produto.nome}`)
        if (produto.estoque < item.quantidade) throw new Error(`Estoque insuficiente para ${produto.nome}`)
      }

      const subtotalVenda = itens.reduce((acc, item) => acc + item.quantidade * item.precoUnitario, 0)
      const descontoValue = parseFloat(String(discount)) || 0
      const totalVenda = subtotalVenda - descontoValue

      const numero = await FS.getNextNumber(FS.COLLECTIONS.VENDAS)
      const vendaId = FS.generateId()
      
      await FS.createDocumentWithId(FS.COLLECTIONS.VENDAS, vendaId, {
        id: vendaId,
        numero,
        subtotal: subtotalVenda,
        desconto: descontoValue,
        total: totalVenda,
        formaPagamento: paymentMethod,
        status: 'Concluida',
        observacoes: null,
        caixaId: caixa.id,
        dataVenda: FS.serverTimestamp(),
      })

      for (const item of itens) {
        const itemId = FS.generateId()
        await FS.addSubDocument(FS.COLLECTIONS.VENDAS, vendaId, 'itens', {
          id: itemId,
          produtoId: item.produtoId,
          nomeProduto: item.nomeProduto,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          subtotal: item.subtotal,
          createdAt: FS.serverTimestamp(),
        })
      }

      await FS.decrementStock(itens)

      toast.success(`Venda #${numero} realizada!`)
      clearCart()
      setDiscount(0)
      setCartSheetOpen(false)
      fetchCaixa()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao finalizar venda')
    } finally {
      setFinalizandoVenda(false)
    }
  }

  function handleOpenCaixaDialog() {
    setDialogType('abrir-caixa')
    setValorInicial('')
    setOpenDialog(true)
  }

  function handleCloseCaixaDialog() {
    setDialogType('fechar-caixa')
    setOpenDialog(true)
  }

  async function handleSubmitCaixa() {
    try {
      setSubmittingCaixa(true)

      if (dialogType === 'abrir-caixa') {
        const existing = await FS.listDocuments<Caixa>(
          FS.COLLECTIONS.CAIXA,
          [{ field: 'status', op: '==', value: 'Aberto' }],
          'dataAbertura',
          'desc'
        )

        if (existing.length > 0) {
          throw new Error('Já existe um caixa aberto')
        }

        const id = FS.generateId()
        await FS.createDocumentWithId(FS.COLLECTIONS.CAIXA, id, {
          valorInicial: parseFloat(valorInicial) || 0,
          valorFinal: null,
          totalVendas: null,
          status: 'Aberto',
          observacoes: null,
          dataAbertura: FS.serverTimestamp(),
          dataFechamento: null,
          createdAt: FS.serverTimestamp(),
          updatedAt: FS.serverTimestamp(),
        })

        toast.success('Caixa aberto com sucesso!')
      } else {
        if (!caixa) throw new Error('Nenhum caixa aberto encontrado')

        const dataAberturaDate = new Date(caixa.dataAbertura)
        const constraints = [
          { field: 'dataVenda', op: '>=', value: dataAberturaDate },
          { field: 'dataVenda', op: '<=', value: new Date() },
          { field: 'status', op: '==', value: 'Concluida' }
        ] as import('@/lib/firestore-service').SimpleConstraint[]
        
        const vendasSnap = await FS.listDocuments<{ total: number }>(FS.COLLECTIONS.VENDAS, constraints)
        
        let totalVendas = 0
        vendasSnap.forEach((v) => {
          if (typeof v.total === 'number') totalVendas += v.total
        })

        const vInicial = (caixa.valorInicial as number) || 0
        const vFinal = vInicial + totalVendas

        await FS.updateDocument(FS.COLLECTIONS.CAIXA, caixa.id, {
          dataFechamento: FS.serverTimestamp(),
          valorFinal: vFinal,
          totalVendas,
          status: 'Fechado',
          updatedAt: FS.serverTimestamp(),
        })

        toast.success('Caixa fechado com sucesso!')
      }

      setOpenDialog(false)
      fetchCaixa()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na operação do caixa')
    } finally {
      setSubmittingCaixa(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 h-full lg:max-h-[calc(100dvh-6.5rem)]">
      {/* ── Left Side: Product Selection ─────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3 lg:overflow-hidden">
        {/* Search + Cash Register Status */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11"
            />
          </div>

          {loadingCaixa ? (
            <Skeleton className="h-11 w-28 rounded-lg shrink-0" />
          ) : isCaixaOpen ? (
            <Button
              variant="outline"
              size="sm"
              className="h-11 px-3 shrink-0 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
              onClick={handleCloseCaixaDialog}
            >
              <Store className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Caixa Aberto</span>
              <span className="sm:hidden">Aberto</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-11 px-3 shrink-0 text-muted-foreground"
              onClick={handleOpenCaixaDialog}
            >
              <Store className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Abrir Caixa</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          )}
        </div>

        {/* Category Tabs - horizontal scroll */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIAS.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategoria === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategoria(cat)}
              className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-9 sm:h-8 px-3 sm:px-3 rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Product Grid - responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 flex-1 overflow-y-auto pb-20 lg:pb-2 pr-0.5 scrollbar-thin">
          {loadingProdutos ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-full mt-auto rounded-lg" />
                </CardContent>
              </Card>
            ))
          ) : filteredProdutos.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-8 sm:py-12 text-muted-foreground">
              <Search className="h-8 w-8 sm:h-10 sm:w-10 mb-2 sm:mb-3 opacity-40" />
              <p className="text-xs sm:text-sm">Nenhum produto encontrado</p>
            </div>
          ) : (
            filteredProdutos.map((produto) => (
              <Card
                key={produto.id}
                className="group overflow-hidden hover:shadow-md transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <CardContent className="p-2.5 sm:p-3 flex flex-col gap-0.5 sm:gap-1 h-full">
                  <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                    <h3 className="font-medium text-[11px] sm:text-sm leading-tight line-clamp-2">
                      {produto.nome}
                    </h3>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] font-normal px-1.5 py-0">
                        {produto.categoria}
                      </Badge>
                      {produto.estoque > 0 && produto.estoque <= 5 && (
                        <span className="text-[9px] sm:text-[10px] text-amber-600 font-medium">
                          {produto.estoque} un.
                        </span>
                      )}
                    </div>
                    <p className="text-sm sm:text-base font-bold text-rose-600 mt-1">
                      {formatPrice(produto.preco)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="mt-1.5 sm:mt-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white w-full h-9 sm:h-8 text-xs sm:text-sm rounded-lg"
                    onClick={() => handleAddToCart(produto)}
                    disabled={produto.estoque <= 0}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-3.5 sm:w-3.5 mr-0.5" />
                    Adicionar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* ── Right Side: Desktop Cart Panel (hidden on mobile/tablet) ── */}
      <aside className="hidden lg:flex lg:flex-col w-[340px] xl:w-[400px] shrink-0 overflow-hidden">
        <Card className="flex flex-col flex-1 overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShoppingCart className="h-5 w-5" />
              Carrinho
              {itemCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-sm">
                  {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>

          <Separator />

          <CardContent className="flex flex-col gap-0 overflow-hidden flex-1 p-0">
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-4 sm:px-6">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 sm:py-8 px-4 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 mb-2 sm:mb-3 opacity-30" />
                    <p className="text-xs sm:text-sm text-center">Carrinho vazio</p>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y py-1">
                    {cart.map((item) => (
                      <CartItemRow
                        key={item.produtoId}
                        item={item}
                        onUpdateQuantity={(qty) =>
                          updateCartQuantity(item.produtoId, qty)
                        }
                        onRemove={() => {
                          removeFromCart(item.produtoId)
                          toast.info(`${item.nome} removido`)
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 sm:gap-3 pt-3 sm:pt-4 px-4 sm:px-6 pb-4 sm:pb-6 border-t">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="discount-desktop" className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    Desconto
                  </Label>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="discount-desktop"
                      type="number"
                      min={0}
                      step={0.5}
                      value={discount || ''}
                      onChange={(e) =>
                        setDiscount(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0,00"
                      className="pl-8 sm:pl-10 h-9 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm sm:text-base">Total</span>
                  <span className="font-bold text-lg sm:text-xl text-rose-600">
                    {formatPrice(total)}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <Label className="text-xs sm:text-sm font-medium">Forma de Pagamento</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(val) =>
                      setPaymentMethod(val as typeof paymentMethod)
                    }
                    className="grid grid-cols-2 gap-1.5 sm:gap-2"
                  >
                    {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <Label
                        key={value}
                        htmlFor={`payment-desktop-${value}`}
                        className="flex items-center gap-1.5 sm:gap-2 cursor-pointer rounded-lg border px-2 sm:px-3 py-2 sm:py-2.5 transition-colors has-[input:checked]:border-rose-500 has-[input:checked]:bg-rose-50 hover:bg-muted/50"
                      >
                        <RadioGroupItem
                          value={value}
                          id={`payment-desktop-${value}`}
                          className="sr-only"
                        />
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{label}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm sm:text-base h-12"
                  onClick={handleFinalizarVenda}
                  disabled={cart.length === 0 || finalizandoVenda}
                >
                  {finalizandoVenda ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Finalizando...
                    </span>
                  ) : (
                    <>
                      <CircleDollarSign className="h-5 w-5 mr-2" />
                      Finalizar Venda
                    </>
                  )}
                </Button>

                <Separator />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5" />
                      Caixa
                    </span>
                    {loadingCaixa ? (
                      <Skeleton className="h-4 w-20" />
                    ) : isCaixaOpen && caixa ? (
                      <span className="text-xs text-emerald-600 font-medium">
                        Aberto às{' '}
                        {format(new Date(caixa.dataAbertura), 'HH:mm', {
                          locale: ptBR,
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fechado</span>
                    )}
                  </div>

                  {loadingCaixa ? (
                    <Skeleton className="h-9 w-full" />
                  ) : isCaixaOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-rose-600 border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                      onClick={handleCloseCaixaDialog}
                    >
                      <Store className="h-4 w-4 mr-2" />
                      Fechar Caixa
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={handleOpenCaixaDialog}
                    >
                      <CircleDollarSign className="h-4 w-4 mr-2" />
                      Abrir Caixa
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* ── Mobile: Floating Cart FAB + Bottom Sheet ────────────────── */}
      <div className="lg:hidden">
        {/* Floating Action Button */}
        {itemCount > 0 && (
          <button
            onClick={() => setCartSheetOpen(true)}
            className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between bg-rose-600 active:bg-rose-800 text-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(244,63,94,0.3)] transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-600 text-[11px] font-bold">
                  {itemCount}
                </span>
              </div>
              <span className="font-semibold text-sm">Ver Carrinho</span>
            </div>
            <span className="font-bold text-base">{formatPrice(total)}</span>
          </button>
        )}

        {/* Bottom Sheet Dialog for mobile cart */}
        <Dialog open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
          <DialogContent className="max-w-[100vw] sm:max-w-md fixed bottom-0 left-0 right-0 translate-x-0 sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] translate-y-0 sm:top-[50%] rounded-b-none sm:rounded-b-lg rounded-t-2xl sm:rounded-t-lg max-h-[90dvh] sm:max-h-[85vh] flex flex-col p-0 gap-0 border-b-0 sm:border-b [&>button]:top-3 [&>button]:right-3 z-[60] overflow-hidden">
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <DialogHeader className="px-4 pb-2 pt-0 sm:pt-2 shrink-0 border-b">
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-5 w-5" />
                Carrinho
                {itemCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Cart Items - scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-muted-foreground">
                  <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm text-center">Carrinho vazio</p>
                  <p className="text-xs text-center mt-1">
                    Selecione produtos para adicionar
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y">
                  {cart.map((item) => (
                    <MobileCartItemRow
                      key={item.produtoId}
                      item={item}
                      onUpdateQuantity={(qty) =>
                        updateCartQuantity(item.produtoId, qty)
                      }
                      onRemove={() => {
                        removeFromCart(item.produtoId)
                        toast.info(`${item.nome} removido`)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Sticky Summary Footer */}
            {cart.length > 0 && (
              <div className="border-t bg-card shrink-0 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] overflow-y-auto max-h-[50dvh]">
                {/* Subtotal & Discount */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Desconto R$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={discount || ''}
                    onChange={(e) =>
                      setDiscount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="0,00"
                    className="h-9 text-sm"
                  />
                </div>

                <Separator className="mb-2" />

                {/* Total */}
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold text-sm">Total</span>
                  <span className="font-bold text-lg text-rose-600">
                    {formatPrice(total)}
                  </span>
                </div>

                {/* Payment Method - 2x2 grid */}
                <div className="flex flex-col gap-1.5 mb-3">
                  <Label className="text-xs font-medium">Forma de Pagamento</Label>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(val) =>
                      setPaymentMethod(val as typeof paymentMethod)
                    }
                    className="grid grid-cols-2 gap-1.5"
                  >
                    {PAYMENT_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <Label
                        key={value}
                        htmlFor={`payment-mobile-${value}`}
                        className="flex items-center justify-center gap-1.5 cursor-pointer rounded-lg border-2 px-2 py-2 transition-colors has-[input:checked]:border-rose-500 has-[input:checked]:bg-rose-50 hover:bg-muted/50"
                      >
                        <RadioGroupItem
                          value={value}
                          id={`payment-mobile-${value}`}
                          className="sr-only"
                        />
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium">{label}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                {/* Finalize Button */}
                <Button
                  size="lg"
                  className="w-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-sm h-12 rounded-xl"
                  onClick={handleFinalizarVenda}
                  disabled={cart.length === 0 || finalizandoVenda}
                >
                  {finalizandoVenda ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Finalizando...
                    </span>
                  ) : (
                    <>
                      <CircleDollarSign className="h-4 w-4 mr-1.5" />
                      Finalizar Venda — {formatPrice(total)}
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Dialog: Open / Close Caixa ───────────────────────────────── */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {dialogType === 'abrir-caixa' ? (
                <>
                  <CircleDollarSign className="h-5 w-5 text-emerald-600" />
                  Abrir Caixa
                </>
              ) : (
                <>
                  <Store className="h-5 w-5 text-rose-600" />
                  Fechar Caixa
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {dialogType === 'abrir-caixa' ? (
            <div className="flex flex-col gap-4 py-1 sm:py-2">
              <p className="text-sm text-muted-foreground">
                Informe o valor inicial disponível no caixa para iniciar o
                expediente.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={valorInicial}
                  onChange={(e) => setValorInicial(e.target.value)}
                  placeholder="0,00"
                  className="pl-10 text-lg h-12"
                  autoFocus
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-1 sm:py-2">
              <p className="text-sm text-muted-foreground">
                Deseja realmente fechar o caixa? O sistema calculará o saldo
                automaticamente.
              </p>
              {caixa && (
                <div className="bg-muted/50 rounded-xl p-4 flex flex-col gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Abertura</span>
                    <span className="text-sm font-medium">
                      {format(new Date(caixa.dataAbertura), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor Inicial</span>
                    <span className="font-semibold">
                      {formatPrice(caixa.valorInicial)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setOpenDialog(false)}
              disabled={submittingCaixa}
              className="flex-1 h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitCaixa}
              disabled={submittingCaixa || (dialogType === 'abrir-caixa' && valorInicial === '')}
              className={`flex-1 h-11 ${
                dialogType === 'abrir-caixa'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {submittingCaixa ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processando...
                </span>
              ) : dialogType === 'abrir-caixa' ? (
                'Abrir Caixa'
              ) : (
                'Fechar Caixa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Mobile Cart Item Row (larger touch targets) ───────────────────────

function MobileCartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem
  onUpdateQuantity: (qty: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[4.5rem]">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">
          {item.nome}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatPrice(item.preco)} × {item.quantidade}
        </p>
        <p className="text-sm font-bold text-rose-600 mt-0.5">
          {formatPrice(item.subtotal)}
        </p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl active:scale-95"
          onClick={() => onUpdateQuantity(item.quantidade - 1)}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">
          {item.quantidade}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-xl active:scale-95"
          onClick={() => onUpdateQuantity(item.quantidade + 1)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 active:scale-95 shrink-0"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ── Desktop Cart Item Row ──────────────────────────────────────────────

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartItem
  onUpdateQuantity: (qty: number) => void
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 sm:py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium leading-tight truncate">
          {item.nome}
        </p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
          {formatPrice(item.preco)} un.
        </p>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.quantidade - 1)}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 sm:w-8 text-center text-xs sm:text-sm font-medium">
          {item.quantidade}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onUpdateQuantity(item.quantidade + 1)}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-col items-end gap-0.5 sm:gap-1 shrink-0">
        <span className="text-xs sm:text-sm font-semibold">
          {formatPrice(item.subtotal)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
          onClick={onRemove}
        >
          <Trash2 className="h-3 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>
    </div>
  )
}
