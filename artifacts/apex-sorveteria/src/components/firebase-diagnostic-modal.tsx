
import { useState } from 'react'
import { Copy, CheckCircle2, ExternalLink, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import * as FS from '@/lib/firestore-service'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Constants ────────────────────────────────────────────────────────────────

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permite leitura e escrita apenas para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`

type TestStatus = 'idle' | 'testing' | 'ok' | 'error'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorCode?: string | null
  errorMessage?: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FirebaseDiagnosticModal({ open, onOpenChange, errorCode, errorMessage }: Props) {
  const [copied, setCopied] = useState(false)
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testError, setTestError] = useState<string | null>(null)
  const [testDocCount, setTestDocCount] = useState<number | null>(null)

  async function copyRules() {
    try {
      await navigator.clipboard.writeText(FIRESTORE_RULES)
      setCopied(true)
      toast.success('Regras copiadas!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.')
    }
  }

  async function runTest() {
    setTestStatus('testing')
    setTestError(null)
    setTestDocCount(null)
    try {
      const q = query(collection(db, FS.COLLECTIONS.PRODUTOS), limit(10))
      const snap = await getDocs(q)
      setTestDocCount(snap.size)
      setTestStatus('ok')
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string }
      setTestError(`${e.code ?? 'unknown'}: ${e.message ?? String(err)}`)
      setTestStatus('error')
    }
  }

  const isPermissionDenied =
    errorCode?.includes('permission-denied') || testError?.includes('permission-denied')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader>
          <DialogTitle>Diagnóstico do Firestore</DialogTitle>
          <DialogDescription>
            Verifique a conexão com o banco de dados e aplique as regras de segurança corretas.
          </DialogDescription>
        </DialogHeader>

        {/* ── Erro atual ── */}
        {(errorCode || errorMessage) && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
            <p className="text-xs font-medium text-destructive mb-0.5">Último erro detectado</p>
            <p className="text-xs font-mono text-destructive/80 break-all">
              {errorCode}{errorMessage ? `: ${errorMessage}` : ''}
            </p>
          </div>
        )}

        {/* ── Teste ao vivo ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Testar conexão agora</p>
            <Button
              size="sm"
              variant="outline"
              onClick={runTest}
              disabled={testStatus === 'testing'}
            >
              {testStatus === 'testing' ? (
                <span className="animate-pulse">Testando…</span>
              ) : (
                'Executar teste'
              )}
            </Button>
          </div>

          {testStatus === 'ok' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800 dark:bg-emerald-950">
              <Wifi className="size-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Conexão OK
                </p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400">
                  {testDocCount} documento(s) encontrado(s) na coleção &quot;produtos&quot;.
                  {testDocCount === 0 && ' Coleção vazia ou nome incorreto.'}
                </p>
              </div>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5">
              <WifiOff className="size-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Erro na conexão</p>
                <p className="text-xs text-destructive/80 break-all font-mono">{testError}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Causa mais comum ── */}
        {isPermissionDenied && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>permission-denied</strong> significa que as Regras de Segurança do Firestore
              estão bloqueando a leitura. Aplique as regras abaixo para resolver.
            </p>
          </div>
        )}

        {/* ── Regras recomendadas ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Regras de segurança recomendadas</p>
              <p className="text-xs text-muted-foreground">Apenas usuários autenticados têm acesso</p>
            </div>
            <Button size="sm" variant="outline" onClick={copyRules} className="shrink-0">
              {copied ? (
                <>
                  <CheckCircle2 className="size-4 mr-1.5 text-emerald-600" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="size-4 mr-1.5" />
                  Copiar
                </>
              )}
            </Button>
          </div>
          <pre className="rounded-lg bg-muted px-4 py-3 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
            {FIRESTORE_RULES}
          </pre>
        </div>

        {/* ── Passo a passo ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Como aplicar as regras</p>
          <ol className="space-y-1.5 text-sm text-muted-foreground">
            {[
              <>Acesse o <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 font-medium">Firebase Console</a></>,
              <>Selecione o projeto com o ID: <Badge variant="secondary" className="font-mono text-xs">{import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '(não configurado)'}</Badge></>,
              <>Clique em <strong>Firestore Database</strong> no menu lateral</>,
              <>Abra a aba <strong>Rules</strong> (Regras)</>,
              <>Cole as regras acima e clique em <strong>Publish</strong></>,
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex justify-end">
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm" className="gap-1.5">
              Abrir Firebase Console
              <ExternalLink className="size-3.5" />
            </Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
