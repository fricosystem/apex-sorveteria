import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UsuarioData {
  uid: string;
  nome: string;
  email: string;
  fotoURL?: string;
  telefone?: string;
  role: "admin" | "usuario";
  createdAt: unknown;
  updatedAt: unknown;
}

interface AuthContextType {
  user: User | null;
  userData: UsuarioData | null;
  loading: boolean;
  ready: boolean;
  login: (email: string, senha: string) => Promise<void>;
  register: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UsuarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const authCheckedRef = useRef(false);

  const fetchUserData = useCallback(async (uid: string) => {
    try {
      const docRef = doc(db, "usuarios", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data() as UsuarioData);
      }
    } catch (error) {
      console.error("[Auth] Error fetching user data:", error);
    }
  }, []);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      if (!authCheckedRef.current) {
        authCheckedRef.current = true;
        setReady(true);
        setLoading(false);
        setUser(null);
      }
    }, 5000);

    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        authCheckedRef.current = true;
        clearTimeout(safetyTimeout);
        setUser(firebaseUser);
        if (firebaseUser) {
          await fetchUserData(firebaseUser.uid);
        } else {
          setUserData(null);
        }
        setLoading(false);
        setReady(true);
      });
    } catch (err) {
      authCheckedRef.current = true;
      clearTimeout(safetyTimeout);
      setUser(null);
      setUserData(null);
      setLoading(false);
      setReady(true);
    }

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserData]);

  const login = useCallback(
    async (email: string, senha: string) => {
      setLoading(true);
      try {
        const cred = await signInWithEmailAndPassword(auth, email, senha);
        setUser(cred.user);
        await fetchUserData(cred.user.uid);
      } finally {
        setLoading(false);
      }
    },
    [fetchUserData]
  );

  const register = useCallback(
    async (nome: string, email: string, senha: string) => {
      setLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        await updateProfile(cred.user, { displayName: nome });
        const usuarioData = {
          uid: cred.user.uid,
          nome,
          email,
          role: "admin" as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "usuarios", cred.user.uid), usuarioData);
        await fetchUserData(cred.user.uid);
      } finally {
        setLoading(false);
      }
    },
    [fetchUserData]
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setUserData(null);
  }, []);

  const refreshUserData = useCallback(async () => {
    if (user) await fetchUserData(user.uid);
  }, [user, fetchUserData]);

  return (
    <AuthContext.Provider
      value={{ user, userData, loading, ready, login, register, logout, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
