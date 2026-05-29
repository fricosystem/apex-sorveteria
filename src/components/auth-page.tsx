'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import Image from 'next/image'

// ── Component ────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { login, register, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPassword, setShowPassword] = useState(false)

  // Form fields
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Animated entrance
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  function validate(): boolean {
    const errs: Record<string, string> = {}

    if (mode === 'register' && !nome.trim()) {
      errs.nome = 'Nome é obrigatório'
    }

    if (!email.trim()) {
      errs.email = 'E-mail é obrigatório'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'E-mail inválido'
    }

    if (!senha) {
      errs.senha = 'Senha é obrigatória'
    } else if (senha.length < 6) {
      errs.senha = 'Mínimo 6 caracteres'
    }

    if (mode === 'register' && senha !== confirmarSenha) {
      errs.confirmarSenha = 'As senhas não coincidem'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || submitting) return

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, senha)
        toast.success('Bem-vindo de volta! 🍒')
      } else {
        await register(nome.trim(), email, senha)
        toast.success('Conta criada com sucesso! 🎉')
        switchMode()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado'
      if (message.includes('invalid-credential') || message.includes('wrong-password')) {
        toast.error('E-mail ou senha incorretos')
      } else if (message.includes('email-already-in-use')) {
        toast.error('Este e-mail já está cadastrado')
        setErrors((prev) => ({ ...prev, email: 'E-mail já cadastrado' }))
      } else if (message.includes('weak-password')) {
        toast.error('Senha muito fraca (mínimo 6 caracteres)')
        setErrors((prev) => ({ ...prev, senha: 'Senha muito fraca' }))
      } else if (message.includes('invalid-email')) {
        toast.error('E-mail inválido')
        setErrors((prev) => ({ ...prev, email: 'Formato de e-mail inválido' }))
      } else if (message.includes('too-many-requests')) {
        toast.error('Muitas tentativas. Aguarde um momento.')
      } else {
        toast.error('Erro ao autenticar. Tente novamente.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'))
    setErrors({})
    setConfirmarSenha('')
    setNome('')
    setShowPassword(false)
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto overflow-x-hidden bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-rose-200/40 blur-3xl dark:bg-rose-900/20" />
        <div className="absolute top-1/3 -left-32 h-64 w-64 rounded-full bg-orange-200/40 blur-3xl dark:bg-orange-900/20" />
        <div className="absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-900/15" />
        <div className="absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-100/20 blur-3xl dark:bg-pink-900/10" />
      </div>

      {/* Main container */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center px-4 pt-6 pb-8 sm:pt-8 sm:pb-10 mx-auto my-auto">
        {/* Logo + Brand */}
        <div
          className={`flex flex-col items-center gap-3 mb-6 sm:gap-4 sm:mb-8 transition-all duration-700 ${
            mounted ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
          }`}
        >
          <div className="relative">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl sm:rounded-3xl bg-black shadow-xl shadow-rose-500/25 overflow-hidden">
              <Image
                src="/apex-logo.png"
                alt="APEX Logo"
                width={48}
                height={48}
                className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
                unoptimized
              />
            </div>
            <div className="absolute -top-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-amber-400 shadow-md">
              <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              APEX Sorveteria
            </h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Sistema de Gestão Financeira
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div
          className={`w-full max-w-sm transition-all duration-700 delay-150 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
        >
          <div className="w-full rounded-2xl sm:rounded-3xl border border-white/60 bg-white/80 p-5 sm:p-6 md:p-8 shadow-2xl shadow-rose-900/5 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-800/80 dark:shadow-black/30">
            {/* Mode toggle header */}
            <div className="mb-5 sm:mb-6">
              <div className="flex rounded-2xl bg-gray-100 p-1 dark:bg-gray-700/60">
                <button
                  type="button"
                  onClick={() => { if (mode !== 'login') switchMode() }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 ${
                    mode === 'login'
                      ? 'bg-white text-rose-600 shadow-sm dark:bg-gray-600 dark:text-rose-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => { if (mode !== 'register') switchMode() }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-300 ${
                    mode === 'register'
                      ? 'bg-white text-rose-600 shadow-sm dark:bg-gray-600 dark:text-rose-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Criar Conta
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4">
              {/* Name (register only) */}
              {mode === 'register' && (
                <div
                  className={`flex flex-col gap-1.5 transition-all duration-300 ${
                    mode === 'register' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                  }`}
                >
                  <Label htmlFor="nome" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="nome"
                      type="text"
                      placeholder="Seu nome"
                      value={nome}
                      onChange={(e) => { setNome(e.target.value); setErrors((p) => ({ ...p, nome: '' })) }}
                      className={`pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 transition-colors focus:bg-white dark:focus:bg-gray-600 ${
                        errors.nome ? 'border-rose-400 focus:border-rose-500' : ''
                      }`}
                      autoComplete="name"
                    />
                  </div>
                  {errors.nome && (
                    <p className="text-xs text-rose-500 animate-in fade-in slide-in-from-top-1">{errors.nome}</p>
                  )}
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })) }}
                    className={`pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 transition-colors focus:bg-white dark:focus:bg-gray-600 ${
                      errors.email ? 'border-rose-400 focus:border-rose-500' : ''
                    }`}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-rose-500 animate-in fade-in slide-in-from-top-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="senha" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); setErrors((p) => ({ ...p, senha: '' })) }}
                    className={`pl-10 pr-10 h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 transition-colors focus:bg-white dark:focus:bg-gray-600 ${
                      errors.senha ? 'border-rose-400 focus:border-rose-500' : ''
                    }`}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.senha && (
                  <p className="text-xs text-rose-500 animate-in fade-in slide-in-from-top-1">{errors.senha}</p>
                )}
              </div>

              {/* Confirm password (register only) */}
              {mode === 'register' && (
                <div
                  className={`flex flex-col gap-1.5 transition-all duration-300 ${
                    mode === 'register' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                  }`}
                >
                  <Label htmlFor="confirmar" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirmar senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="confirmar"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmarSenha}
                      onChange={(e) => { setConfirmarSenha(e.target.value); setErrors((p) => ({ ...p, confirmarSenha: '' })) }}
                      className={`pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 transition-colors focus:bg-white dark:focus:bg-gray-600 ${
                        errors.confirmarSenha ? 'border-rose-400 focus:border-rose-500' : ''
                      }`}
                      autoComplete="new-password"
                    />
                  </div>
                  {errors.confirmarSenha && (
                    <p className="text-xs text-rose-500 animate-in fade-in slide-in-from-top-1">{errors.confirmarSenha}</p>
                  )}
                </div>
              )}

              {/* Forgot password (login only) */}
              {mode === 'login' && (
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 transition-colors"
                    onClick={() => toast.info('Funcionalidade em breve!')}
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {/* Submit button */}
              <Button
                type="submit"
                disabled={submitting || loading}
                className="relative h-12 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white font-semibold text-sm shadow-lg shadow-rose-600/25 hover:shadow-xl hover:shadow-rose-600/30 hover:from-rose-700 hover:to-rose-600 active:scale-[0.98] transition-all duration-200 overflow-hidden"
              >
                {submitting || loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'login' ? 'Entrar' : 'Criar Conta'}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="mt-5 sm:mt-6 flex items-center gap-3">
              <Separator className="flex-1 bg-gray-200 dark:bg-gray-600" />
              <span className="text-xs text-gray-400 dark:text-gray-500">seguro com</span>
              <Separator className="flex-1 bg-gray-200 dark:bg-gray-600" />
            </div>

            {/* Features badges */}
            <div className="mt-4 sm:mt-5 flex items-center justify-center">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Desenvolvido por APEX HUB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`mt-6 sm:mt-8 pb-safe text-center transition-all duration-700 delay-300 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
            © {new Date().getFullYear()} APEX Sorveteria. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
