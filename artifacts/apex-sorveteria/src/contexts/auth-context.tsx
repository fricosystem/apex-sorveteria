
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface UsuarioData {
  uid: string
  nome: string
  email: string
  fotoURL?: string
  telefone?: string
  role: 'admin' | 'usuario'
  createdAt: unknown
  updatedAt: unknown
}

interface AuthContextType {
  user: User | null
  userData: UsuarioData | null
  loading: boolean
  ready: boolean // true only after onAuthStateChanged fires at least once
  login: (email: string, senha: string) => Promise<void>
  register: (nome: string, email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  refreshUserData: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UsuarioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const authCheckedRef = useRef(false)

  const fetchUserData = useCallback(async (uid: string) => {
    try {
      const docRef = doc(db, 'usuarios', uid)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const data = docSnap.data() as UsuarioData
        setUserData(data)
      }
    } catch {
      // silent — auth state will still work without extra profile data
    }
  }, [])

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (!authCheckedRef.current) {
        authCheckedRef.current = true
        setReady(true)
        setLoading(false)
        setUser(null)
      }
    }, 4000)

    let unsubscribe: (() => void) | null = null

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        authCheckedRef.current = true
        clearTimeout(safetyTimeout)

        setUser(firebaseUser)
        if (firebaseUser) {
          await fetchUserData(firebaseUser.uid)
        } else {
          setUserData(null)
        }
        setLoading(false)
        setReady(true)
      })
    } catch {
      authCheckedRef.current = true
      clearTimeout(safetyTimeout)
      setUser(null)
      setUserData(null)
      setLoading(false)
      setReady(true)
    }

    return () => {
      clearTimeout(safetyTimeout)
      if (unsubscribe) unsubscribe()
    }
  }, [fetchUserData])

  const login = useCallback(async (email: string, senha: string) => {
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha)
      setUser(cred.user)
      await fetchUserData(cred.user.uid)
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }, [fetchUserData])

  const register = useCallback(async (nome: string, email: string, senha: string) => {
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha)
      await updateProfile(cred.user, { displayName: nome })

      const usuarioData: Omit<UsuarioData, 'uid'> & { uid: string } = {
        uid: cred.user.uid,
        nome,
        email,
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      try {
        await setDoc(doc(db, 'usuarios', cred.user.uid), usuarioData)
      } catch {
        // profile data save failed — user can still log in
      }

      await fetchUserData(cred.user.uid)
    } catch (error) {
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch {
      // ignore logout errors
    }
    setUser(null)
    setUserData(null)
  }, [])

  const refreshUserData = useCallback(async () => {
    if (user) {
      await fetchUserData(user.uid)
    }
  }, [user, fetchUserData])

  return (
    <AuthContext.Provider
      value={{ user, userData, loading, ready, login, register, logout, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
