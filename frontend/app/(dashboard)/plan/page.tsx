import { PlanPreview } from "./_components/plan-preview";
import { createClient } from "@/lib/supabase/server";

type PlanPageProps = {
  searchParams: Promise<{
    plan_id?: string | string[];
    document_id?: string | string[]; // Mantener para backward compat
  }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const params = await searchParams;

  // 🆕 UP-05: Priorizar plan_id sobre document_id
  const rawPlanId = params.plan_id;
  let planId: string | null = Array.isArray(rawPlanId)
    ? rawPlanId[0]
    : rawPlanId || null;

  // Backward compat: si solo llega document_id (planes viejos de UP-04)
  const rawDocumentId = params.document_id;
  const documentId = Array.isArray(rawDocumentId)
    ? rawDocumentId[0]
    : rawDocumentId || null;

  // ── Auto-detección de plan activo ──────────────────────────
  // Cuando el usuario navega a /plan sin query params (ej. desde
  // el nav "Mi Plan"), buscamos su plan activo en Supabase.
  if (!planId && !documentId) {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: activePlan } = await supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activePlan) {
        planId = activePlan.id;
      }
    }
  }

  return <PlanPreview planId={planId} documentId={documentId} />;
}
