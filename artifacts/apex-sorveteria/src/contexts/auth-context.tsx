
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
  const [ready, setReady] = useState(false) // Firebase auth state has been checked
  const authCheckedRef = useRef(false)

  const fetchUserData = useCallback(async (uid: string) => {
    try {
      console.log('[Auth] Fetching user data for uid:', uid)
      const docRef = doc(db, 'usuarios', uid)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        const data = docSnap.data() as UsuarioData
        console.log('[Auth] User data found:', data)
        setUserData(data)
      } else {
        console.log('[Auth] No user data found in Firestore')
      }
    } catch (error) {
      console.error('[Auth] Error fetching user data:', error)
    }
  }, [])

  useEffect(() => {
    console.log('[Auth] Initializing AuthProvider')
    // Safety timeout: if Firebase doesn't respond in 4s, show login page
    const safetyTimeout = setTimeout(() => {
      if (!authCheckedRef.current) {
        console.warn('[Auth] Safety timeout triggered - showing login page')
        authCheckedRef.current = true
        setReady(true)
        setLoading(false)
        setUser(null)
      }
    }, 4000)

    let unsubscribe: (() => void) | null = null

    try {
      console.log('[Auth] Setting up onAuthStateChanged listener')
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        console.log('[Auth] onAuthStateChanged fired, user:', firebaseUser)
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
    } catch (err) {
      console.error('[Auth] Firebase auth initialization error:', err)
      // If Firebase fails to initialize, show login page
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
    console.log('[Auth] Login attempt for email:', email)
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, senha)
      console.log('[Auth] Login successful for user:', cred.user.uid)
      // Atualizar o estado do usuario imediatamente apos login bem-sucedido
      setUser(cred.user)
      await fetchUserData(cred.user.uid)
      console.log('[Auth] User state updated after login')
    } catch (error) {
      console.error('[Auth] Login error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [fetchUserData])

  const register = useCallback(async (nome: string, email: string, senha: string) => {
    console.log('[Auth] Register attempt for email:', email)
    setLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, senha)
      console.log('[Auth] User created:', cred.user.uid)
      await updateProfile(cred.user, { displayName: nome })

      // Persist user data in Firestore "usuarios" collection
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
        console.log('[Auth] User data saved to Firestore')
      } catch (error) {
        console.error('[Auth] Error saving user data to Firestore:', error)
      }

      // Fetch user data to complete registration
      await fetchUserData(cred.user.uid)
    } catch (error) {
      console.error('[Auth] Registration error:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    console.log('[Auth] Logout attempt')
    try {
      await signOut(auth)
      console.log('[Auth] Logout successful')
    } catch (error) {
      console.error('[Auth] Logout error:', error)
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
