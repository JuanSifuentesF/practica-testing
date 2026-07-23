// ============================================================
// types/index.ts — Barrel de exportaciones de tipos
// ============================================================

// Re-exportar TODOS los tipos de la base de datos
export type {
  // Union types (enums del negocio)
  StudyPlanStatus,
  SessionType,
  MethodUsed,
  ActionTaken,
  SessionStatus,
  AnswerOption,
  LevelK,
  TopicProgressStatus,

  // Tipos de JSON estructurado
  TopicEntry,
  TopicsJson,
  OptionsJson,

  // user_profiles
  UserProfileRow,
  UserProfileInsert,
  UserProfileUpdate,

  // documents
  DocumentRow,
  DocumentInsert,
  DocumentUpdate,

  // study_plans
  StudyPlanRow,
  StudyPlanInsert,
  StudyPlanUpdate,

  // sessions
  SessionRow,
  SessionInsert,
  SessionUpdate,

  // answers
  AnswerRow,
  AnswerInsert,
  AnswerUpdate,

  // topic_progress
  TopicProgressRow,
  TopicProgressInsert,
  TopicProgressUpdate,

  // Tipo maestro
  Database,

  // 🆕 PL-03: Tipos de DB del Practice Lab
  PracticeExerciseTypeDB,
  PracticeExerciseRow,
  PracticeExerciseInsert,
  PracticeExerciseUpdate,
  PracticeSubmissionRow,
  PracticeSubmissionInsert,
  PracticeSubmissionUpdate,

  // AI-02: Tipos de DB de AI Settings
  AiUsageModeDB,
  AiProviderDB,
  AiFeatureDB,
  AiUsageStatusDB,
  UserAiSettingsRowDB,
  UserAiSettingsInsertDB,
  UserAiSettingsUpdateDB,
  AiUsageEventRowDB,
  AiUsageEventInsertDB,
  AiUsageEventUpdateDB,
  ReserveAiQuotaRowDB,
  FinalizeManagedAiUsageRowDB,
  GetAiUsageSummaryRowDB,
} from "./database";

export type {
  AiUsageMode,
  AiProvider,
  AiFeature,
  AiUsageStatus,
  AiQuotaBlockReason,
  AiUsageSummary,
  AiRuntimeRequest,
  AiRuntimeResult,
  AiRuntimeDemo,
  AiRuntimeBlocked,
  AiRuntimeDuplicate,
  AiRuntimeUnavailable,
  AiRuntimeReady,
  ProviderUsage,
  UserAiSettingsRow,
  AiUsageEventRow,
} from "./ai";

// 🆕 SE-01: Re-exportar tipos de sesión enriquecidos
export type {
  SessionTopic,
  PlanContext,
  SessionWithContext,
  NoSessionResponse,
  NextSessionResponse,
  SessionByIdResponse,
} from "./sessions";

// 🆕 SE-02: Re-exportar tipos de contenido teórico
export type {
  KeyConcept,
  TheoryExample,
  TopicConnection,
  TheoryTopicContent,
  TheoryContent,
  TheoryResponse,
} from "./theory";

// 🆕 SE-06: Re-exportar tipos de evaluación
export type {
  UserAnswer,
  EvaluateRequest,
  EvaluateResponse,
  EvaluateWithAdaptationResponse,
  QuestionResult,
  FailedTopic,
  ErrorPattern,
} from "./evaluate";

// 🆕 SE-07: Re-exportar tipos de adaptación
export type { AdaptResponse } from "./adapt";

// 🆕 SE-04: Re-exportar tipos de quiz
export type { QuizQuestion, QuizContent, QuizResponse } from "./quiz";

// 🆕 DA-01/DA-03: Re-exportar tipos del dashboard de métricas
export type {
  SessionScore,
  TopicStatusCount,
  TopicHeatmapItem,
  TimeComparison,
  PracticeStats,
  DashboardMetrics,
  DashboardMetricsResponse,
  NoPlanResponse,
} from "./dashboard";

// 🆕 PL-03: Re-exportar tipos del QA Practice Lab
export type {
  // Union types
  PracticeExerciseType,
  BugSeverity,
  BugPriority,
  TestCaseType,

  // Estructuras JSONB
  ExerciseScenario,
  BugReportScenario,
  ExerciseSolution,
  TestCaseReferenceAnswer,
  BugReportReferenceAnswer,

  // Tipos de datos del usuario
  TestCaseRow,
  BugReportData,
  ApiChecklistItem,
  SubmissionContent,

  // Feedback de la IA
  CriterionResult,
  PracticeFeedback,

  // Tipos compuestos (ejercicio y submission enriquecidos)
  PracticeExercise,
  BugReportExercise,
  PracticeSubmission,

  // Request/Response de API Routes
  PracticeGenerateRequest,
  PracticeGenerateResponse,
  PracticeEvaluateRequest,
  PracticeEvaluateResponse,

  // Helpers UI
  ExerciseTypeInfo,
  TopicPracticeSummary,
} from "./practice";
