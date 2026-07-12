// ============================================================
// types/database.ts — Tipos TypeScript del schema de Supabase
// ============================================================
// Estos tipos reflejan EXACTAMENTE las tablas creadas en DB-02.
// Cada tipo corresponde a una tabla de PostgreSQL, y cada
// propiedad corresponde a una columna.
//
// Convención de nombres:
//   - Row:    lo que recibes al hacer SELECT (lectura)
//   - Insert: lo que envías al hacer INSERT (crear)
//   - Update: lo que envías al hacer UPDATE (modificar)
//
// Los campos opcionales en Insert/Update usan "?" porque
// PostgreSQL les asigna un DEFAULT si no los envías.
// ============================================================

// ──────────────────────────────────────────────────────────────
// Tipos auxiliares (enums como union types)
// ──────────────────────────────────────────────────────────────

/** Estados válidos de un plan de estudio (CHECK constraint en DB) */
export type StudyPlanStatus = "active" | "completed" | "abandoned";

/** Tipos de sesión válidos (CHECK constraint en DB) */
export type SessionType = "morning" | "night" | "reinforcement" | "mock_exam";

/** Métodos de enseñanza válidos (CHECK constraint en DB) */
export type MethodUsed = "theory" | "examples" | "analogies";

/** Acciones del sistema adaptativo (CHECK constraint en DB) */
export type ActionTaken = "advance" | "reinforce" | "restructure";

/** Estados de sesión válidos (CHECK constraint en DB) */
export type SessionStatus = "pending" | "active" | "completed" | "skipped";

/** Opciones de respuesta válidas (CHECK constraint en DB) */
export type AnswerOption = "a" | "b" | "c" | "d";

/** Niveles K del ISTQB (CHECK constraint en DB) */
export type LevelK = "K1" | "K2" | "K3";

/** Estados de progreso de un tópico (CHECK constraint en DB) */
export type TopicProgressStatus =
  | "pending"
  | "in_progress"
  | "mastered"
  | "failed";

/** Tipos de ejercicio práctico (CHECK constraint en DB) */
export type PracticeExerciseTypeDB =
  | "test_cases"
  | "bug_report"
  | "api_testing"
  | "exploratory";

// ──────────────────────────────────────────────────────────────
// TABLA 1: user_profiles
// Extiende auth.users con datos de perfil del negocio.
// Relación 1:1 con auth.users (el id ES el auth.users.id).
// ──────────────────────────────────────────────────────────────

export interface UserProfileRow {
  id: string; // UUID — PK, referencia a auth.users(id)
  full_name: string | null;
  created_at: string; // TIMESTAMPTZ como ISO string
  [key: string]: unknown;
}

export interface UserProfileInsert {
  id: string; // Obligatorio: debe coincidir con auth.users(id)
  full_name?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface UserProfileUpdate {
  full_name?: string | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 2: documents
// Metadatos de PDFs subidos. El archivo físico está en Storage.
// ──────────────────────────────────────────────────────────────

/** Estructura esperada de topics_json (JSONB en PostgreSQL) */
export interface TopicEntry {
  text: string;
  level_k: LevelK;
  name?: string;
}

/** topics_json es un diccionario { "FL-1.1.1": TopicEntry, ... } */
export type TopicsJson = Record<string, TopicEntry>;

export interface DocumentRow {
  id: string; // UUID — PK, gen_random_uuid()
  user_id: string; // UUID — FK a auth.users(id)
  file_name: string;
  file_url: string;
  extracted_text: string | null;
  topics_json: TopicsJson | null; // JSONB
  created_at: string;
  [key: string]: unknown;
}

export interface DocumentInsert {
  id?: string; // Opcional: PostgreSQL lo genera
  user_id: string;
  file_name: string;
  file_url: string;
  extracted_text?: string | null;
  topics_json?: TopicsJson | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface DocumentUpdate {
  file_name?: string;
  file_url?: string;
  extracted_text?: string | null;
  topics_json?: TopicsJson | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 3: study_plans
// Plan de estudio adaptativo generado por la IA.
// ──────────────────────────────────────────────────────────────

export interface StudyPlanRow {
  id: string;
  user_id: string;
  document_id: string; // FK a documents(id)
  objective_days: number; // CHECK: 1-30
  start_date: string; // DATE como ISO string
  estimated_end_date: string;
  actual_end_date: string | null;
  plan_json: Record<string, unknown>; // JSONB — estructura del plan
  status: StudyPlanStatus;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface StudyPlanInsert {
  id?: string;
  user_id: string;
  document_id: string;
  objective_days?: number;
  start_date: string;
  estimated_end_date: string;
  actual_end_date?: string | null;
  plan_json: Record<string, unknown>;
  status?: StudyPlanStatus;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface StudyPlanUpdate {
  objective_days?: number;
  estimated_end_date?: string;
  actual_end_date?: string | null;
  plan_json?: Record<string, unknown>;
  status?: StudyPlanStatus;
  updated_at?: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 4: sessions
// Sesiones individuales: mañana, noche, refuerzo o simulacro.
// ──────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string;
  study_plan_id: string; // FK a study_plans(id)
  user_id: string;
  topic_codes: string[]; // TEXT[] — Array nativo de PostgreSQL
  session_type: SessionType;
  day_number: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number; // CHECK: > 0
  score_percent: number | null; // CHECK: 0-100 o NULL
  attempt_number: number;
  method_used: MethodUsed;
  action_taken: ActionTaken | null; // NULL si no evaluada aún
  status: SessionStatus;
  theory_content: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface SessionInsert {
  id?: string;
  study_plan_id: string;
  user_id: string;
  topic_codes: string[];
  session_type: SessionType;
  day_number: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_minutes?: number;
  score_percent?: number | null;
  attempt_number?: number;
  method_used?: MethodUsed;
  action_taken?: ActionTaken | null;
  status?: SessionStatus;
  theory_content?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface SessionUpdate {
  topic_codes?: string[];
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  duration_minutes?: number;
  score_percent?: number | null;
  attempt_number?: number;
  method_used?: MethodUsed;
  action_taken?: ActionTaken | null;
  status?: SessionStatus;
  theory_content?: string | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 5: answers
// Respuestas individuales del quiz.
// ──────────────────────────────────────────────────────────────

/** Estructura del JSONB options_json: { a: "texto", b: "texto", ... } */
export type OptionsJson = Record<AnswerOption, string>;

export interface AnswerRow {
  id: string;
  session_id: string; // FK a sessions(id)
  user_id: string;
  question_text: string;
  options_json: OptionsJson; // JSONB
  correct_answer: AnswerOption;
  user_answer: AnswerOption;
  is_correct: boolean;
  topic_code: string;
  level_k: LevelK | null;
  explanation: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface AnswerInsert {
  id?: string;
  session_id: string;
  user_id: string;
  question_text: string;
  options_json: OptionsJson;
  correct_answer: AnswerOption;
  user_answer: AnswerOption;
  is_correct: boolean;
  topic_code: string;
  level_k?: LevelK | null;
  explanation?: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface AnswerUpdate {
  explanation?: string | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 6: topic_progress
// Progreso individual por tópico ISTQB dentro de un plan.
// UNIQUE(user_id, study_plan_id, topic_code)
// ──────────────────────────────────────────────────────────────

export interface TopicProgressRow {
  id: string;
  user_id: string;
  study_plan_id: string; // FK a study_plans(id)
  topic_code: string; // Ej. "FL-1.1.1"
  topic_name: string | null;
  level_k: LevelK | null;
  attempts: number;
  best_score: number; // CHECK: 0-100
  last_score: number; // CHECK: 0-100
  status: TopicProgressStatus;
  mastered_at: string | null;
  updated_at: string;
  [key: string]: unknown;
}

export interface TopicProgressInsert {
  id?: string;
  user_id: string;
  study_plan_id: string;
  topic_code: string;
  topic_name?: string | null;
  level_k?: LevelK | null;
  attempts?: number;
  best_score?: number;
  last_score?: number;
  status?: TopicProgressStatus;
  mastered_at?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TopicProgressUpdate {
  topic_name?: string | null;
  level_k?: LevelK | null;
  attempts?: number;
  best_score?: number;
  last_score?: number;
  status?: TopicProgressStatus;
  mastered_at?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 7: practice_exercises
// Ejercicios prácticos generados por IA para el QA Practice Lab.
// Vinculados a tópicos ISTQB por topic_code y a documentos por document_id.
// ──────────────────────────────────────────────────────────────

export interface PracticeExerciseRow {
  id: string; // UUID — PK
  user_id: string; // UUID — FK a auth.users(id)
  document_id: string; // UUID — FK a documents(id)
  study_plan_id: string | null; // UUID — FK opcional a study_plans(id)
  topic_code: string; // Ej. "FL-4.2.1"
  level_k: LevelK; // K1, K2, K3
  exercise_type: PracticeExerciseTypeDB; // test_cases, bug_report, etc.
  attempt_number: number; // CHECK: >= 1
  scenario_json: Record<string, unknown>; // JSONB — escenario generado por IA
  solution_json: Record<string, unknown> | null; // JSONB — solución de referencia
  created_at: string; // TIMESTAMPTZ como ISO string
  [key: string]: unknown;
}

export interface PracticeExerciseInsert {
  id?: string; // Opcional: PostgreSQL lo genera
  user_id: string;
  document_id: string;
  study_plan_id?: string | null;
  topic_code: string;
  level_k: LevelK;
  exercise_type: PracticeExerciseTypeDB;
  attempt_number?: number; // Default: 1
  scenario_json: Record<string, unknown>;
  solution_json?: Record<string, unknown> | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface PracticeExerciseUpdate {
  solution_json?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// TABLA 8: practice_submissions
// Respuestas del usuario a ejercicios prácticos.
// FK compuesta (exercise_id, user_id) → practice_exercises(id, user_id).
// ──────────────────────────────────────────────────────────────

export interface PracticeSubmissionRow {
  id: string; // UUID — PK
  user_id: string; // UUID — FK a auth.users(id)
  exercise_id: string; // UUID — FK compuesta
  submission_json: Record<string, unknown>; // JSONB — respuesta del usuario
  score_percent: number | null; // CHECK: 0-100 o NULL
  feedback_json: Record<string, unknown> | null; // JSONB — feedback de la IA
  submitted_at: string; // TIMESTAMPTZ como ISO string
  [key: string]: unknown;
}

export interface PracticeSubmissionInsert {
  id?: string;
  user_id: string;
  exercise_id: string;
  submission_json: Record<string, unknown>;
  score_percent?: number | null;
  feedback_json?: Record<string, unknown> | null;
  submitted_at?: string;
  [key: string]: unknown;
}

export interface PracticeSubmissionUpdate {
  score_percent?: number | null;
  feedback_json?: Record<string, unknown> | null;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────
// Tipo maestro Database — compatible con supabase-js generics
// ──────────────────────────────────────────────────────────────
// Este tipo sigue la convención del generador oficial de Supabase.
// Se pasa como generic a createClient<Database>() para obtener
// autocompletado y validación de tipos en todas las queries.
// ──────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfileRow;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [];
      };
      study_plans: {
        Row: StudyPlanRow;
        Insert: StudyPlanInsert;
        Update: StudyPlanUpdate;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
      answers: {
        Row: AnswerRow;
        Insert: AnswerInsert;
        Update: AnswerUpdate;
        Relationships: [];
      };
      topic_progress: {
        Row: TopicProgressRow;
        Insert: TopicProgressInsert;
        Update: TopicProgressUpdate;
        Relationships: [];
      };
      // 🆕 PL-03: Tablas del Practice Lab
      practice_exercises: {
        Row: PracticeExerciseRow;
        Insert: PracticeExerciseInsert;
        Update: PracticeExerciseUpdate;
        Relationships: [];
      };
      practice_submissions: {
        Row: PracticeSubmissionRow;
        Insert: PracticeSubmissionInsert;
        Update: PracticeSubmissionUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
