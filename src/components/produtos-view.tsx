'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  IceCream,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Produto {
  id: string
  nome: string
  descricao: string | null
  preco: number
  custo: number | null
  categoria: string | null
  estoque: number
  imagem: string | null
  ativo: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIAS = [
  'Todas',
  'Potes',
  'Picolés',
  'Massas',
  'Açaí',
  'Bebidas',
  'Complementos',
] as const

const CATEGORIAS_SEM_TODAS = CATEGORIAS.filter((c) => c !== 'Todas') as string[]

const CATEGORY_COLORS: Record<string, string> = {
  Potes: 'bg-rose-100 text-rose-700 border-rose-200',
  'Picolés': 'bg-sky-100 text-sky-700 border-sky-200',
  Massas: 'bg-amber-100 text-amber-700 border-amber-200',
  'Açaí': 'bg-purple-100 text-purple-700 border-purple-200',
  Bebidas: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Complementos: 'bg-orange-100 text-orange-700 border-orange-200',
}

const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const produtoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  descricao: z.string().nullable().optional(),
  preco: z.coerce.number().min(0.01, 'Preço deve ser maior que zero'),
  custo: z.coerce.number().min(0).nullable().optional(),
  categoria: z.string().nullable().optional(),
  estoque: z.coerce.number().int().min(0, 'Estoque não pode ser negativo'),
  imagem: z.string().nullable().optional(),
})

type ProdutoFormData = z.infer<typeof produtoSchema>

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProdutosView() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('Todas')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      preco: 0,
      custo: 0,
      categoria: '',
      estoque: 0,
      imagem: '',
    },
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form

  const selectedCategoria = watch('categoria')

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchProdutos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoriaFilter && categoriaFilter !== 'Todas') {
        params.set('categoria', categoriaFilter)
      }
      if (search) {
        params.set('search', search)
      }

      const res = await fetch(`/api/produtos?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao buscar produtos')
      const data = await res.json()
      setProdutos(Array.isArray(data) ? data : data.produtos ?? [])
    } catch {
      toast.error('Erro ao carregar produtos')
      setProdutos([])
    } finally {
      setLoading(false)
    }
  }, [categoriaFilter, search])

  useEffect(() => {
    fetchProdutos()
  }, [fetchProdutos])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openCreateDialog() {
    setEditingProduto(null)
    reset({ nome: '', descricao: '', preco: 0, custo: 0, categoria: '', estoque: 0, imagem: '' })
    setDialogOpen(true)
  }

  function openEditDialog(produto: Produto) {
    setEditingProduto(produto)
    reset({
      nome: produto.nome,
      descricao: produto.descricao ?? '',
      preco: produto.preco,
      custo: produto.custo ?? 0,
      categoria: produto.categoria ?? '',
      estoque: produto.estoque,
      imagem: produto.imagem ?? '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(data: ProdutoFormData) {
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        descricao: data.descricao || null,
        custo: data.custo ?? null,
        categoria: data.categoria || null,
        imagem: data.imagem || null,
      }

      const isEditing = !!editingProduto
      const url = isEditing
        ? `/api/produtos/${editingProduto.id}`
        : '/api/produtos'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Erro ao salvar produto')
      }

      toast.success(isEditing ? 'Produto atualizado!' : 'Produto criado!')
      setDialogOpen(false)
      fetchProdutos()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir produto')
      toast.success('Produto excluído!')
      fetchProdutos()
    } catch {
      toast.error('Erro ao excluir produto')
    }
  }

  // ─── Skeleton ──────────────────────────────────────────────────────────────

  function ProductCardSkeleton() {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3 sm:p-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <div className="flex gap-2 pt-2 mt-auto">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  function EmptyState() {
    return (
      <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center px-4">
        <div className="bg-muted rounded-full p-3 sm:p-4 mb-3 sm:mb-4">
          <IceCream className="size-8 sm:size-10 text-muted-foreground" />
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
          Nenhum produto encontrado
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm">
          {search || categoriaFilter !== 'Todas'
            ? 'Tente alterar os filtros de busca ou categoria.'
            : 'Comece adicionando seu primeiro produto.'}
        </p>
        {!search && categoriaFilter === 'Todas' && (
          <Button className="mt-4 h-11" onClick={openCreateDialog}>
            <Plus className="size-4 mr-2" />
            Novo Produto
          </Button>
        )}
      </div>
    )
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="bg-rose-100 rounded-lg p-1.5 sm:p-2 shrink-0">
            <IceCream className="size-5 sm:size-6 text-rose-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
              Produtos
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              Gerencie o catálogo da sorveteria
            </p>
          </div>
        </div>
        <Button onClick={openCreateDialog} size="sm" className="h-10 px-3 sm:h-auto sm:px-4 shrink-0">
          <Plus className="size-4 sm:mr-2" />
          <span className="hidden sm:inline">Novo Produto</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Category filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIAS.map((cat) => (
          <Button
            key={cat}
            variant={categoriaFilter === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoriaFilter(cat)}
            className="whitespace-nowrap shrink-0 text-xs sm:text-sm h-9 px-3 rounded-full"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {produtos.map((produto) => (
            <Card key={produto.id} className="overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-2.5">
                {/* Title + Category */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm sm:text-base font-semibold leading-tight line-clamp-2">
                    {produto.nome}
                  </h3>
                  {produto.categoria && (
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] sm:text-xs px-1.5 py-0 ${CATEGORY_COLORS[produto.categoria] || ''}`}
                    >
                      {produto.categoria}
                    </Badge>
                  )}
                </div>

                {/* Price */}
                <p className="text-lg sm:text-xl font-bold text-rose-600">
                  {formatBRL(produto.preco)}
                </p>

                {/* Cost + Stock */}
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <div className="flex items-center gap-3">
                    {produto.custo !== null && produto.custo > 0 && (
                      <span className="text-muted-foreground">
                        Custo: {formatBRL(produto.custo)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="size-3.5 text-muted-foreground" />
                    {produto.estoque < 5 && (
                      <Badge
                        variant="destructive"
                        className="text-[9px] sm:text-[10px] px-1 py-0 h-4"
                      >
                        <AlertTriangle className="size-2.5 mr-0.5" />
                        Baixo
                      </Badge>
                    )}
                    <span className={produto.estoque < 5 ? 'font-semibold text-destructive' : 'font-medium'}>
                      {produto.estoque} un.
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 text-xs sm:text-sm rounded-lg"
                    onClick={() => openEditDialog(produto)}
                  >
                    <Edit className="size-3.5 mr-1.5" />
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 h-10 text-xs sm:text-sm rounded-lg">
                        <Trash2 className="size-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[95vw] sm:max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-base sm:text-lg">Excluir produto</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm">
                          Tem certeza que deseja excluir{' '}
                          <span className="font-semibold text-foreground">
                            {produto.nome}
                          </span>
                          ?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2 sm:gap-0">
                        <AlertDialogCancel className="flex-1 sm:flex-none h-11">
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(produto.id)}
                          className="flex-1 sm:flex-none bg-destructive text-white hover:bg-destructive/90 h-11"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Product Dialog (Create / Edit) - Mobile bottom sheet */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[100vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {editingProduto ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:gap-4">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-sm">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                placeholder="Nome do produto"
                {...register('nome')}
                aria-invalid={!!errors.nome}
                className="h-11"
              />
              {errors.nome && (
                <p className="text-xs text-destructive">{errors.nome.message}</p>
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-sm">Descrição</Label>
              <Textarea
                id="descricao"
                placeholder="Descrição do produto (opcional)"
                rows={2}
                className="text-sm"
                {...register('descricao')}
              />
            </div>

            {/* Preço e Custo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="preco" className="text-sm">
                  Preço (R$) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="preco"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="h-11"
                  {...register('preco')}
                  aria-invalid={!!errors.preco}
                />
                {errors.preco && (
                  <p className="text-xs text-destructive">{errors.preco.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custo" className="text-sm">Custo (R$)</Label>
                <Input
                  id="custo"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="h-11"
                  {...register('custo')}
                />
              </div>
            </div>

            {/* Categoria e Estoque */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Categoria</Label>
                <Select
                  value={selectedCategoria || ''}
                  onValueChange={(val) =>
                    setValue('categoria', val === '' ? '' : val)
                  }
                >
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_SEM_TODAS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estoque" className="text-sm">Estoque</Label>
                <Input
                  id="estoque"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="0"
                  placeholder="0"
                  className="h-11"
                  {...register('estoque')}
                  aria-invalid={!!errors.estoque}
                />
                {errors.estoque && (
                  <p className="text-xs text-destructive">{errors.estoque.message}</p>
                )}
              </div>
            </div>

            {/* Imagem */}
            <div className="space-y-1.5">
              <Label htmlFor="imagem" className="text-sm">URL da Imagem</Label>
              <Input
                id="imagem"
                placeholder="https://exemplo.com/imagem.jpg"
                className="h-11 text-sm"
                {...register('imagem')}
              />
            </div>

            {/* Dialog Footer */}
            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 h-11">
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
