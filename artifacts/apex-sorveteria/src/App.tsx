import { useEffect, useState, useCallback } from "react";
import { useStore, ActiveView } from "@/lib/store";
import { useAuth } from "@/contexts/auth-context";
import AuthPage from "@/components/auth-page";
import DashboardView from "@/components/dashboard-view";
import ProdutosView from "@/components/produtos-view";
import ComprasView from "@/components/compras-view";
import CaixaView from "@/components/caixa-view";
import ProfileView from "@/components/profile-view";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  IceCream,
  ShoppingCart,
  PackageSearch,
  Menu,
  X,
  RefreshCw,
  LogOut,
  UserCircle,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

const navItems: { key: ActiveView; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "produtos", label: "Produtos", icon: IceCream },
  { key: "compras", label: "Compras", icon: PackageSearch },
  { key: "caixa", label: "Caixa / PDV", icon: ShoppingCart },
  { key: "perfil", label: "Perfil", icon: UserCircle },
];

function AppContent() {
  const { user, userData, loading: authLoading, ready: authReady, logout } = useAuth();
  const { activeView, setActiveView, sidebarOpen, setSidebarOpen } = useStore();
  const [mounted, setMounted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!authReady || !mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black shadow-xl shadow-rose-500/25 overflow-hidden">
            <img
              src="/apex-logo.png"
              alt="APEX Logo"
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-200 border-t-rose-600" />
          <p className="text-xs text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const currentNav = navItems.find((n) => n.key === activeView) || navItems[0];
  const displayName = userData?.nome || user.displayName || user.email?.split("@")[0] || "Usuário";

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r bg-card transition-transform duration-300 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-3 border-b px-3 sm:px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black overflow-hidden">
            <img
              src="/apex-logo.png"
              alt="APEX Logo"
              className="h-6 w-6 object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight truncate">APEX Sorveteria</p>
            <p className="text-[11px] text-muted-foreground">Gestao Financeira e Estoque</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.key;
              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  className={cn(
                    "justify-start gap-2.5 h-10 text-sm",
                    isActive && "bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium"
                  )}
                  onClick={() => {
                    setActiveView(item.key);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-rose-600" : "text-muted-foreground")} />
                  {item.label}
                </Button>
              );
            })}
          </div>
        </nav>

        {/* Footer - Profile avatar button + Logout */}
        <div className="border-t p-3">
          <button
            onClick={() => {
              setActiveView("perfil");
              setSidebarOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg p-2 transition-colors",
              activeView === "perfil"
                ? "bg-rose-50"
                : "hover:bg-muted"
            )}
          >
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full overflow-hidden ring-2 ring-rose-200 dark:ring-rose-800">
                <img
                  src="/avatar-sorveteiro.png"
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                <span className="sr-only">Online</span>
              </div>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold leading-tight truncate text-rose-900 dark:text-rose-200">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </button>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 mt-2 text-xs text-muted-foreground hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4 bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 md:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="!h-4 hidden md:block" />
          <div className="flex items-center gap-2 min-w-0">
            <currentNav.icon className="h-4 w-4 text-rose-500 shrink-0" />
            <h1 className="text-sm font-semibold truncate">{currentNav.label}</h1>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 md:p-6">
            {activeView === "dashboard" && <DashboardView />}
            {activeView === "produtos" && <ProdutosView />}
            {activeView === "compras" && <ComprasView />}
            {activeView === "caixa" && <CaixaView />}
            {activeView === "perfil" && <ProfileView />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster />
    </>
  );
}
