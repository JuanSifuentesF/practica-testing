"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAiSession } from "@/components/ai/ai-session-provider";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const routes = [
  { href: "/dashboard", label: "Dashboard", emoji: "📊" },
  { href: "/plan", label: "Mi Plan", emoji: "📋" },
  { href: "/session", label: "Sesión Actual", emoji: "📖" },
  { href: "/practice", label: "Práctica", emoji: "🔬" },
  { href: "/settings/ai", label: "IA", emoji: "🤖" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileNav() {
  const pathname = usePathname();
  const { byokApiKey } = useAiSession();

  return (
    <div className="md:hidden">
      <Sheet key={pathname}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>

        <SheetContent
          side="left"
          className="flex w-[280px] flex-col border-border bg-background p-6 text-foreground"
        >
          <SheetTitle className="mb-2 text-lg font-bold text-foreground">
            ISTQB <span className="text-emerald-400 light:text-emerald-700">Agent</span>
          </SheetTitle>

          <div className="mb-4 border-b border-border" />

          <nav className="flex flex-col space-y-1">
            {routes.map((route) => {
              const isActive = isActivePath(pathname, route.href);
              const isAiRoute = route.href === "/settings/ai";

              return (
                <SheetClose asChild key={route.href}>
                  <Link
                    href={route.href}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "flex items-center gap-3 rounded-xl bg-emerald-950/50 px-3 py-3 text-sm font-semibold text-emerald-400 transition-colors light:bg-emerald-50 light:text-emerald-800"
                        : "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground light:hover:bg-emerald-50"
                    }
                  >
                    <span className="text-lg" aria-hidden="true">
                      {route.emoji}
                    </span>

                    <span className="flex items-center gap-2">
                      {route.label}
                      {isAiRoute &&
                        (byokApiKey !== "" ? (
                          <span
                            className="size-2 rounded-full bg-emerald-400 light:bg-emerald-600"
                            title="API Key de IA lista"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 light:text-amber-700">
                            <span className="size-2 rounded-full bg-amber-400 animate-pulse light:bg-amber-500" />
                            🔑 Requerida
                          </span>
                        ))}
                    </span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-border pt-4">
            <p className="text-center text-xs text-muted-foreground">
              ISTQB Study Agent v1.0
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
