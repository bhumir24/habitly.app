import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Sparkles, BarChart3, Settings, Zap, Menu, X, LogOut, Crown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { href: "/coach", label: "AI Coach", icon: Sparkles, testId: "nav-ai-coach" },
  { href: "/insights", label: "Insights", icon: BarChart3, testId: "nav-insights" },
  { href: "/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-64 transition-transform duration-300 lg:translate-x-0 lg:static lg:flex",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "hsl(232 28% 12%)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[64px] border-b" style={{ borderColor: "hsl(232 20% 18%)" }}>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, hsl(245 70% 62%) 0%, hsl(262 65% 68%) 100%)" }}
          >
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-[17px] font-semibold text-white tracking-tight">Habitly</span>
          {user?.tier === "premium" && (
            <span
              className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "linear-gradient(135deg, hsl(38 90% 55%), hsl(25 90% 60%))", color: "white" }}
            >
              <Crown className="w-2.5 h-2.5" />
              PRO
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-3" style={{ color: "hsl(220 15% 45%)" }}>
            Menu
          </p>
          {navItems.map(({ href, label, icon: Icon, testId }) => {
            const active = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                data-testid={testId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 group",
                  active
                    ? "text-white"
                    : "hover:text-white"
                )}
                style={
                  active
                    ? { background: "linear-gradient(135deg, hsl(245 70% 58%) 0%, hsl(262 60% 65%) 100%)", boxShadow: "0 4px 12px rgba(99,89,235,0.35)" }
                    : { color: "hsl(220 15% 55%)" }
                }
              >
                <Icon
                  className={cn("w-4 h-4 flex-shrink-0 transition-colors", active ? "text-white" : "group-hover:text-white")}
                  style={active ? {} : { color: "hsl(220 15% 55%)" }}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade + User */}
        <div className="px-3 pb-4 space-y-2 border-t" style={{ borderColor: "hsl(232 20% 18%)", paddingTop: "1rem" }}>
          {user?.tier === "free" && (
            <Link
              href="/pricing"
              data-testid="upgrade-cta"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, hsl(38 90% 55%) 0%, hsl(25 90% 62%) 100%)",
                color: "white",
                boxShadow: "0 4px 12px rgba(230,150,50,0.3)",
              }}
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade to Premium
            </Link>
          )}

          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: "hsl(232 20% 16%)" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 60% 68%))" }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate text-white">{user?.name}</p>
              <p className="text-[11px] truncate" style={{ color: "hsl(220 15% 50%)" }}>{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              data-testid="button-logout"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" style={{ color: "hsl(220 15% 50%)" }} />
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="sticky top-0 z-30 flex items-center h-14 px-4 backdrop-blur-md border-b border-border lg:hidden"
          style={{ background: "rgba(255,255,255,0.85)" }}
        >
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="ml-3 flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(245 70% 62%), hsl(262 65% 68%))" }}
            >
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-semibold text-base">Habitly</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
