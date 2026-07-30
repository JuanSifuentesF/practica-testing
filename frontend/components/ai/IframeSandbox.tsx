"use client";

import React, { useMemo } from "react";

interface IframeSandboxProps {
  readonly htmlContent: string;
  readonly title?: string;
  readonly className?: string;
}

export function IframeSandbox({
  htmlContent,
  title = "Previsualización Aislada",
  className = "h-96 w-full rounded-md border border-border bg-white",
}: IframeSandboxProps) {
  const srcDoc = useMemo(() => {
    const cspMeta = `
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; flex-src 'none'; navigate-to 'none';">
    `;
    return `<!DOCTYPE html><html><head>${cspMeta}</head><body>${htmlContent}</body></html>`;
  }, [htmlContent]);

  return (
    <div className="relative flex flex-col space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} (Sandbox Aislado)
      </span>
      <iframe
        title={title}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className={className}
        loading="lazy"
      />
    </div>
  );
}
