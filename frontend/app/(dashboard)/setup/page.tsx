// ============================================================
// app/(dashboard)/setup/page.tsx — Página de Setup del Plan
// ============================================================
// RUTA: /setup
//
// TIPO: Client Component — orquesta el estado de los componentes
//       hijos (PdfDropzone, FilePreview, StudyConfig).
//
// RESPONSABILIDADES:
//   1. Mantener el estado del archivo seleccionado (File | null)
//   2. Mantener la configuración del plan (días, horarios)
//   3. Coordinar el estado de loading durante el procesamiento
//   4. Enviar los datos a la API Route /api/upload (UP-02)
//   5. Llamar a /api/extract para obtener tópicos (UP-03)
//   6. 🆕 Llamar a /api/plan/generate para generar el plan (UP-04)
//   7. Mostrar progreso de cada etapa al usuario
//
// LAYOUT PADRE:
//   Esta página se renderiza DENTRO de app/(dashboard)/layout.tsx.
//   El header y la navegación ya están presentes. Este componente
//   solo define el contenido del área principal.
//
// PROTECCIÓN:
//   El middleware (FE-03) ya protege /setup. Si un usuario no
//   autenticado intenta acceder, será redirigido a /login.
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PdfDropzone } from "./_components/pdf-dropzone";
import { FilePreview } from "./_components/file-preview";
import {
  StudyConfig,
  DEFAULT_CONFIG,
  type StudyConfigData,
} from "./_components/study-config";
import { Separator } from "@/components/ui/separator";

// ─── Etapas del proceso ─────────────────────────────────────────
// 🆕 Agregamos "generating" como nueva etapa entre extracting y complete.
type ProcessStage =
  | "idle" // Sin actividad
  | "uploading" // Subiendo PDF a Storage
  | "extracting" // Enviando a FastAPI para extracción
  | "generating" // 🆕 Generando plan con OpenAI
  | "saving" // Guardando resultados en DB
  | "complete" // Proceso completado exitosamente
  | "error"; // Error en alguna etapa

// ─── Mensajes de progreso para cada etapa ────────────────────────
const STAGE_MESSAGES: Record<ProcessStage, string> = {
  idle: "",
  uploading: "Subiendo PDF al almacenamiento seguro...",
  extracting:
    "Analizando el syllabus con IA... Esto puede tomar 10-15 segundos.",
  generating:
    "Generando tu plan de estudio personalizado con IA... Esto puede tomar 10-20 segundos.",
  saving:
    "Guardando plan en la base de datos... Creando sesiones y progreso de tópicos.",
  complete: "¡Plan generado exitosamente! Redirigiendo...",
  error: "Ocurrió un error. Revisa el mensaje abajo.",
};

// ─── Tipo del resultado de la generación + persistencia ─────────
interface PlanResult {
  total_sessions: number;
  start_date: string;
  estimated_end_date: string;
  model_used: string;
  plan_id: string | null; // 🆕 null si solo se generó, string si se persistió
}

export default function SetupPage() {
  // ═══════════════════════════════════════════════════════════
  // ESTADO GLOBAL DE LA PÁGINA
  // ═══════════════════════════════════════════════════════════

  // ─── Archivo PDF seleccionado ───
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ─── Configuración del plan ───
  const [config, setConfig] = useState<StudyConfigData>(DEFAULT_CONFIG);

  // ─── Estado de carga ───
  const [isLoading, setIsLoading] = useState(false);

  // ─── Etapa actual del proceso ───
  const [stage, setStage] = useState<ProcessStage>("idle");

  // ─── Mensaje de error global ───
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Resultado de la extracción ───
  const [extractionResult, setExtractionResult] = useState<{
    total_topics: number;
    is_complete: boolean;
    warnings: string[];
  } | null>(null);

  // ─── 🆕 Resultado de la generación del plan ───
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════

  const router = useRouter();

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setSubmitError(null);
    setExtractionResult(null);
    setPlanResult(null);
    setStage("idle");
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setExtractionResult(null);
    setPlanResult(null);
    setStage("idle");
  };

  const handleConfigChange = (newConfig: StudyConfigData) => {
    setConfig(newConfig);
  };

  // ─── Handler principal: Upload + Extract + Generate Plan ────
  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setSubmitError(null);
    setExtractionResult(null);
    setPlanResult(null);

    try {
      // ─── ETAPA 1: Upload ────────────────────────────────────
      setStage("uploading");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("objective_days", config.objectiveDays.toString());
      formData.append("morning_time", config.morningTime);
      formData.append("night_time", config.nightTime);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || "Error al subir el archivo.");
      }

      console.log(
        `[Setup] ✅ Upload completado: ${uploadData.document_id} (${uploadData.file_name})`,
      );

      // ─── ETAPA 2: Extracción ────────────────────────────────
      setStage("extracting");

      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: uploadData.document_id,
        }),
      });

      const extractData = await extractResponse.json();

      if (!extractResponse.ok) {
        throw new Error(
          extractData.error || "Error al extraer los tópicos del PDF.",
        );
      }

      console.log(
        `[Setup] ✅ Extracción completada: ${extractData.total_topics} tópicos`,
      );

      setExtractionResult({
        total_topics: extractData.total_topics,
        is_complete: extractData.is_complete,
        warnings: extractData.warnings || [],
      });

      // ─── ETAPA 3: 🆕 Generación del Plan ───────────────────
      // Llamamos a /api/plan/generate con el document_id y la
      // configuración del usuario (días, horarios).
      setStage("generating");

      const planResponse = await fetch("/api/plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: uploadData.document_id,
          config: {
            objective_days: config.objectiveDays,
            morning_time: config.morningTime,
            night_time: config.nightTime,
            model_provider: config.modelProvider,
          },
        }),
      });

      const planData = await planResponse.json();

      if (!planResponse.ok) {
        throw new Error(
          planData.error || "Error al generar el plan de estudio.",
        );
      }

      console.log(
        `[Setup] ✅ Plan generado: ${planData.total_sessions} sesiones, ` +
          `${planData.start_date} → ${planData.estimated_end_date}, ` +
          `modelo: ${planData.model_used}`,
      );

      // ─── Guardar resultado del plan ─────────────────────────
      setPlanResult({
        total_sessions: planData.total_sessions,
        start_date: planData.start_date,
        estimated_end_date: planData.estimated_end_date,
        model_used: planData.model_used,
        plan_id: null, // Aún no persistido; se llena en etapa "saving"
      });

      // UP-04 aun no persiste el plan en Supabase. Lo guardamos de forma
      // temporal en la pestana actual para que /plan pueda mostrarlo.
      try {
        sessionStorage.setItem(
          `istqb-plan:${uploadData.document_id}`,
          JSON.stringify({
            ...planData,
            saved_at: new Date().toISOString(),
          }),
        );
      } catch (storageError) {
        console.warn(
          "[Setup] No se pudo guardar el plan temporal:",
          storageError,
        );
      }

      // ─── ETAPA 4: 🆕 Guardar plan en Supabase (UP-05) ──────
      setStage("saving");

      const saveResponse = await fetch("/api/plan/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: uploadData.document_id,
          plan: planData.plan,
          config: {
            objective_days: config.objectiveDays,
            morning_time: config.morningTime,
            night_time: config.nightTime,
          },
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(
          saveData.error || "Error al guardar el plan en la base de datos.",
        );
      }

      console.log(
        `[Setup] ✅ Plan persistido: plan_id=${saveData.plan_id}, ` +
          `${saveData.sessions_created} sesiones, ` +
          `${saveData.topics_created} tópicos`,
      );

      // ─── ETAPA 5: Completado ────────────────────────────────
      setStage("complete");

      // ─── Navegar a la vista del plan ────────────────────────
      // UP-05: ahora usamos plan_id en lugar de document_id.
      // El plan se carga desde Supabase, no desde sessionStorage.
      setTimeout(() => {
        router.push(`/plan?plan_id=${saveData.plan_id}`);
      }, 3000);
    } catch (error) {
      setStage("error");
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado. Por favor intenta de nuevo.",
      );
      // 🆕 Restaurar loading en error para permitir reintentar
      setIsLoading(false);
    }
  };

  // ─── Helper: calcular porcentaje de progreso ────────────────
  // 🆕 Actualizado para incluir la etapa "generating"
  const getProgressPercent = (): string => {
    switch (stage) {
      case "uploading":
        return "20%";
      case "extracting":
        return "45%";
      case "generating":
        return "75%";
      case "saving":
        return "90%";
      case "complete":
        return "100%";
      default:
        return "0%";
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* ─── Encabezado de la página ─── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Configurar Plan de Estudio
        </h1>
        <p className="text-slate-400">
          Sube el PDF del syllabus ISTQB y configura tus preferencias de
          estudio. El agente creará un plan personalizado para ti.
        </p>
      </div>

      {/* ─── Sección 1: Subir PDF ─── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-200">
            📄 Syllabus PDF
          </h2>
          <p className="text-sm text-slate-500">
            Sube el documento oficial del ISTQB Foundation Level v4.0
          </p>
        </div>

        <PdfDropzone
          onFileSelect={handleFileSelect}
          hasFile={selectedFile !== null}
          disabled={isLoading}
        />

        {selectedFile && (
          <FilePreview
            file={selectedFile}
            onRemove={handleFileRemove}
            disabled={isLoading}
          />
        )}
      </div>

      {/* ─── Separador visual ─── */}
      <Separator className="bg-slate-800" />

      {/* ─── Sección 2: Configuración del Plan ─── */}
      <StudyConfig
        config={config}
        onConfigChange={handleConfigChange}
        disabled={isLoading}
      />

      {/* ─── Progreso del proceso ─── */}
      {stage !== "idle" && stage !== "error" && (
        <div className="flex flex-col gap-3 rounded-lg bg-slate-800/50 border border-slate-700/50 p-5">
          {/* Indicador de progreso con animación */}
          <div className="flex items-center gap-3">
            {stage !== "complete" ? (
              // ─── Spinner animado ───
              <svg
                className="animate-spin h-5 w-5 text-emerald-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              // ─── Checkmark ───
              <svg
                className="h-5 w-5 text-emerald-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            <p className="text-sm text-slate-300 font-medium">
              {STAGE_MESSAGES[stage]}
            </p>
          </div>

          {/* 🆕 Barra de progreso visual — actualizada con getProgressPercent */}
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: getProgressPercent() }}
            />
          </div>

          {/* Resultado de extracción */}
          {extractionResult && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold text-sm">
                  📊 {extractionResult.total_topics} tópicos detectados
                </span>
                {extractionResult.is_complete ? (
                  <span className="text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    ✅ Extracción completa
                  </span>
                ) : (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    ⚠️ Extracción parcial
                  </span>
                )}
              </div>

              {/* Warnings si los hay */}
              {extractionResult.warnings.length > 0 && (
                <div className="text-xs text-amber-400/80 bg-amber-500/5 rounded p-2 border border-amber-500/10">
                  <p className="font-medium mb-1">Advertencias:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {extractionResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 🆕 Resultado de la generación del plan */}
          {planResult && (
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-semibold text-sm">
                  📅 Plan generado: {planResult.total_sessions} sesiones
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  📆 Inicio:{" "}
                  <span className="text-slate-300">
                    {new Date(
                      planResult.start_date + "T00:00:00",
                    ).toLocaleDateString("es-MX", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
                <p>
                  🎯 Fin estimado:{" "}
                  <span className="text-slate-300">
                    {new Date(
                      planResult.estimated_end_date + "T00:00:00",
                    ).toLocaleDateString("es-MX", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
                <p>
                  🤖 Modelo:{" "}
                  <span className="text-slate-500">
                    {planResult.model_used}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Error global del submit ─── */}
      {submitError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-red-400">{submitError}</p>
        </div>
      )}

      {/* ─── Botón de envío ─── */}
      <button
        onClick={handleSubmit}
        disabled={!selectedFile || isLoading}
        className="
          relative
          flex items-center justify-center
          h-12
          rounded-lg
          bg-emerald-600
          px-8
          text-base font-semibold text-white
          transition-all duration-200
          hover:bg-emerald-500
          active:scale-[0.98]
          disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
          disabled:active:scale-100
        "
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Procesando...
          </>
        ) : (
          <>🚀 Generar mi plan de estudio</>
        )}
      </button>

      {/* ─── Nota informativa ─── */}
      {!selectedFile && (
        <p className="text-center text-xs text-slate-600">
          Selecciona un PDF del syllabus ISTQB para habilitar el botón
        </p>
      )}
    </div>
  );
}
