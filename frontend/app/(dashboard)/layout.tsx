import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { UserMenu } from "./_components/user-menu";
import { MainNav } from "./_components/main-nav";
import { MobileNav } from "./_components/mobile-nav";
import { AiSessionProvider } from "@/components/ai/ai-session-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AppOnboarding } from "@/components/onboarding/app-onboarding";
import { OnboardingHelpButton } from "@/components/onboarding/onboarding-help-button";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();

  const email = user.email ?? "";
  const displayName = profile?.full_name ?? email;

  return (
    <ThemeProvider>
      <AiSessionProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
          <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <div className="flex items-center space-x-6">
                <MobileNav />
                <Link href="/dashboard" className="flex items-center space-x-2">
                  <span className="inline-block font-bold text-xl tracking-tight">
                    ISTQB <span className="text-emerald-500">Agent</span>
                  </span>
                </Link>
                <MainNav />
              </div>

              <div className="flex items-center space-x-3">
                <ThemeToggle />
                <UserMenu email={email} name={displayName} />
              </div>
            </div>
          </header>

          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>

          {/* Tour Onboarding Guiado + Botón de Ayuda */}
          <AppOnboarding />
          <OnboardingHelpButton />
        </div>
      </AiSessionProvider>
    </ThemeProvider>
  );
}
