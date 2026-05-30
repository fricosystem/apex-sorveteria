
import { useEffect, useState, useCallback } from 'react'

import { useAuth } from '@/contexts/auth-context'
import * as FS from '@/lib/firestore-service'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  UserCircle,
  ShieldCheck,
  Mail,
  Phone,
  Shield,
  Hash,
  Download,
  Key,
  Trash2,
  ShoppingBag,
  DollarSign,
  PackageSearch,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Copy,
  Check,
  Pencil,
  Loader2,
  Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileStats {
  totalVendas: number
  totalReceita: number
  totalCompras: number
  totalCusto: number
  lucroTotal: number
  ticketMedio: number
  produtosCadastrados: number
  caixasAbertos: number
  membroDesde: string
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

function formatMemberDate(raw: unknown): string {
  try {
    let date: Date
    if (!raw) return '—'
    if (typeof raw === 'string') {
      date = parseISO(raw)
    } else if (raw instanceof Date) {
      date = raw
    } else if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
      // Firestore Timestamp
      date = (raw as { toDate: () => Date }).toDate()
    } else if (typeof raw === 'number') {
      date = new Date(raw)
    } else {
      return '—'
    }
    if (isNaN(date.getTime())) return '—'
    return format(date, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

// ---------------------------------------------------------------------------
// Copy to clipboard helper
// ---------------------------------------------------------------------------

function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function copy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Não foi possível copiar o texto')
    }
  }

  return { copiedId, copy }
}

// ---------------------------------------------------------------------------
// Stat Card Component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  valueColor,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  valueColor?: string
}) {
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 shrink-0 ${iconBg}`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p
              className={`text-lg font-bold tracking-tight leading-tight ${valueColor || ''}`}
            >
              {value}
            </p>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              {label}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Skeleton Loader
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="mb-1 h-7 w-40 sm:h-8 sm:w-48" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Profile Card skeleton */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <Skeleton className="h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] rounded-full" />
            <div className="space-y-2 w-full max-w-xs">
              <Skeleton className="h-6 w-40 mx-auto" />
              <Skeleton className="h-4 w-52 mx-auto" />
              <Skeleton className="h-5 w-24 mx-auto" />
              <Skeleton className="h-3 w-32 mx-auto" />
              <Skeleton className="h-9 w-36 mx-auto mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account section skeleton */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProfileView() {
  const { user, userData, refreshUserData } = useAuth()
  const { copiedId, copy } = useCopyToClipboard()

  // Stats state
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [saving, setSaving] = useState(false)

  // Derived values
  const displayName = userData?.nome || user?.displayName || 'Usuário'
  const displayEmail = userData?.email || user?.email || ''
  const displayRole = userData?.role || 'usuario'
  const displayPhone = userData?.telefone || ''
  const userId = user?.uid || ''
  const memberSinceRaw = userData?.createdAt || user?.metadata?.creationTime

  // ---------------------------------------------------------------------------
  // Fetch stats
  // ---------------------------------------------------------------------------

  const fetchStats = useCallback(async () => {
    if (!user?.uid) return
    try {
      setStatsLoading(true)

      const [vendasSnap, comprasSnap, produtosSnap] = await Promise.all([
        getDocs(collection(db, FS.COLLECTIONS.VENDAS)),
        getDocs(collection(db, FS.COLLECTIONS.COMPRAS)),
        getDocs(collection(db, FS.COLLECTIONS.PRODUTOS)),
      ])

      let totalVendas = 0
      let totalReceita = 0
      vendasSnap.forEach((d) => {
        totalVendas++
        const total = typeof d.data().total === 'number' ? d.data().total : 0
        totalReceita += total
      })

      let totalCompras = 0
      let totalCusto = 0
      comprasSnap.forEach((d) => {
        totalCompras++
        const custo = typeof d.data().totalCusto === 'number' ? d.data().totalCusto : 0
        totalCusto += custo
      })

      const produtosCadastrados = produtosSnap.docs.filter(
        (d) => d.data().ativo === true
      ).length

      setStats({
        totalVendas,
        totalReceita,
        totalCompras,
        totalCusto,
        lucroTotal: totalReceita - totalCusto,
        ticketMedio: totalVendas > 0 ? totalReceita / totalVendas : 0,
        produtosCadastrados,
        caixasAbertos: 0,
        membroDesde: '',
      })
    } catch {
      // Stats are non-critical; silently fail
    } finally {
      setStatsLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // ---------------------------------------------------------------------------
  // Edit profile handlers
  // ---------------------------------------------------------------------------

  function openEditDialog() {
    setEditNome(userData?.nome || user?.displayName || '')
    setEditTelefone(userData?.telefone || '')
    setEditOpen(true)
  }

  async function handleSaveProfile() {
    const trimmedNome = editNome.trim()
    if (!trimmedNome) {
      toast.error('Nome é obrigatório')
      return
    }

    if (!user?.uid) {
      toast.error('Usuário não autenticado')
      return
    }

    setSaving(true)
    try {
      const updates: Record<string, unknown> = {
        nome: trimmedNome,
        updatedAt: FS.serverTimestamp(),
      }
      if (editTelefone.trim()) {
        updates.telefone = editTelefone.trim()
      }

      await updateDoc(doc(db, FS.COLLECTIONS.USUARIOS, user.uid), updates)

      toast.success('Perfil atualizado com sucesso!')
      setEditOpen(false)
      await refreshUserData()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Erro ao atualizar perfil'
      )
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Account action handlers
  // ---------------------------------------------------------------------------

  function handleExportData() {
    toast.info('Funcionalidade em breve!')
  }

  function handleChangePassword() {
    toast.info('Funcionalidade em breve!')
  }

  function handleDeleteAccount() {
    toast.info('Funcionalidade em breve!')
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ====== Header ====== */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-400 shadow-md shadow-rose-500/20">
          <UserCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Meu Perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Informações da sua conta
          </p>
        </div>
      </div>

      {/* ====== Profile Card ====== */}
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col items-center text-center gap-4">
            {/* Avatar with gradient border */}
            <div className="relative">
              <div className="rounded-full p-[3px] bg-gradient-to-br from-rose-500 to-orange-400 shadow-lg shadow-rose-500/20">
                <div className="rounded-full bg-background p-[2px]">
                  <img
                    src="/avatar-sorveteiro.png"
                    alt="Avatar do usuário"
                    className="h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] rounded-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Name + Email */}
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                {displayName}
              </h2>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {displayEmail}
              </p>
            </div>

            {/* Role badge */}
            {displayRole === 'admin' && (
              <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 gap-1.5 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Administrador
              </Badge>
            )}

            {/* Member since */}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Membro desde {formatMemberDate(memberSinceRaw)}
            </p>

            {/* Edit button */}
            <Button
              variant="outline"
              size="sm"
              onClick={openEditDialog}
              className="mt-1 gap-1.5 text-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar Perfil
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ====== Activity Stats Grid ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <StatCard
              label="Total Vendas"
              value={String(stats.totalVendas)}
              icon={ShoppingBag}
              iconBg="bg-rose-500"
            />
            <StatCard
              label="Receita Total"
              value={formatBRL(stats.totalReceita)}
              icon={DollarSign}
              iconBg="bg-emerald-500"
            />
            <StatCard
              label="Total Compras"
              value={String(stats.totalCompras)}
              icon={PackageSearch}
              iconBg="bg-orange-500"
            />
            <StatCard
              label="Custo Total"
              value={formatBRL(stats.totalCusto)}
              icon={TrendingDown}
              iconBg="bg-amber-500"
            />
            <StatCard
              label="Lucro Total"
              value={formatBRL(stats.lucroTotal)}
              icon={stats.lucroTotal >= 0 ? TrendingUp : TrendingDown}
              iconBg={
                stats.lucroTotal >= 0
                  ? 'bg-emerald-500'
                  : 'bg-red-500'
              }
              valueColor={
                stats.lucroTotal >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              }
            />
            <StatCard
              label="Ticket Médio"
              value={formatBRL(stats.ticketMedio)}
              icon={BarChart3}
              iconBg="bg-sky-500"
            />
          </>
        ) : null}
      </div>

      {/* ====== Account Section ====== */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Shield className="h-4 w-4 text-rose-500" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">Email</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm truncate max-w-[180px] sm:max-w-[220px]">
                  {displayEmail}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copy(displayEmail, 'email')}
                >
                  {copiedId === 'email' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Telefone */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">Telefone</span>
              </div>
              <span className="text-sm">
                {displayPhone ? (
                  displayPhone
                ) : (
                  <span className="text-muted-foreground italic text-xs">
                    Não informado
                  </span>
                )}
              </span>
            </div>

            <Separator />

            {/* Função */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">Função</span>
              </div>
              <Badge
                variant="outline"
                className={
                  displayRole === 'admin'
                    ? 'border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300 text-xs'
                    : 'text-xs'
                }
              >
                {displayRole === 'admin' ? 'Administrador' : 'Usuário'}
              </Badge>
            </div>

            <Separator />

            {/* User ID */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <Hash className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium">ID do Usuário</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-mono truncate max-w-[140px] sm:max-w-[180px] text-muted-foreground">
                  {userId}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copy(userId, 'uid')}
                >
                  {copiedId === 'uid' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Pencil className="h-4 w-4 text-rose-500" />
              Ações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm h-11"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4 text-muted-foreground" />
              Exportar Dados
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm h-11"
              onClick={handleChangePassword}
            >
              <Key className="h-4 w-4 text-muted-foreground" />
              Alterar Senha
            </Button>
            <Separator />
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm h-11 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-destructive/20"
              onClick={handleDeleteAccount}
            >
              <Trash2 className="h-4 w-4" />
              Excluir Conta
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ====== Edit Profile Dialog ====== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-rose-500" />
              Editar Perfil
            </DialogTitle>
            <DialogDescription>
              Atualize suas informações pessoais abaixo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-2">
              <Label htmlFor="edit-nome" className="text-sm font-medium">
                Nome
              </Label>
              <Input
                id="edit-nome"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                placeholder="Seu nome completo"
                autoFocus
              />
            </div>

            {/* Telefone */}
            <div className="space-y-2">
              <Label
                htmlFor="edit-telefone"
                className="text-sm font-medium text-muted-foreground"
              >
                Telefone <span className="text-xs">(opcional)</span>
              </Label>
              <Input
                id="edit-telefone"
                value={editTelefone}
                onChange={(e) => setEditTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label
                htmlFor="edit-email"
                className="text-sm font-medium text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="edit-email"
                value={displayEmail}
                disabled
                className="bg-muted opacity-70 cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                O email não pode ser alterado por aqui.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
              className="text-sm"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={saving || !editNome.trim()}
              className="bg-rose-500 hover:bg-rose-600 text-white text-sm gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
