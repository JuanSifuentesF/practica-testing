export interface ExportableSessionArtifact {
  readonly title: string;
  readonly topicCode: string;
  readonly levelK: string;
  readonly contentMarkdown: string;
  readonly generatedAt: string;
}

export function sanitizeArtifactForExport(
  rawArtifact: Record<string, unknown>
): ExportableSessionArtifact {
  const title = typeof rawArtifact.title === "string" ? rawArtifact.title : "Sesión de Estudio";
  const topicCode = typeof rawArtifact.topicCode === "string" ? rawArtifact.topicCode : "FL-1.1.1";
  const levelK = typeof rawArtifact.levelK === "string" ? rawArtifact.levelK : "K2";
  const rawContent = typeof rawArtifact.contentMarkdown === "string" ? rawArtifact.contentMarkdown : "";

  const sanitizedContent = rawContent
    .replace(/(?:sk-|AIzaSy)[A-Za-z0-9_-]{20,}/g, "[CLAVE_REDACTADA]")
    .replace(/<system_prompt>[\s\S]*?<\/system_prompt>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");

  return {
    title: title.trim(),
    topicCode: topicCode.trim(),
    levelK: levelK.trim(),
    contentMarkdown: sanitizedContent.trim(),
    generatedAt: new Date().toISOString(),
  };
}
