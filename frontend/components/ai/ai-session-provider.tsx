"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BYOK_API_KEY_HEADER,
  MAX_BYOK_API_KEY_LENGTH,
  isAiFeaturePath,
} from "@/lib/ai/http-contract";

type AiFetch = (path: string, init?: RequestInit) => Promise<Response>;

interface AiSessionContextValue {
  byokApiKey: string;
  setByokApiKey: (value: string) => void;
  clearByokApiKey: () => void;
  aiFetch: AiFetch;
}

const AiSessionContext = createContext<AiSessionContextValue | null>(null);

const BYOK_STORAGE_KEY = "istqb_byok_api_key";

export function AiSessionProvider({ children }: { children: ReactNode }) {
  const [byokApiKey, setByokApiKeyState] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.sessionStorage.getItem(BYOK_STORAGE_KEY) || "";
        if (saved) {
          setByokApiKeyState(saved);
        }
      } catch {}
    }
  }, []);

  const setByokApiKey = useCallback((value: string) => {
    const sanitized = value
      .replace(/[\r\n]/g, "")
      .slice(0, MAX_BYOK_API_KEY_LENGTH);
    setByokApiKeyState(sanitized);
    if (typeof window !== "undefined") {
      try {
        if (sanitized) {
          window.sessionStorage.setItem(BYOK_STORAGE_KEY, sanitized);
        } else {
          window.sessionStorage.removeItem(BYOK_STORAGE_KEY);
        }
      } catch {}
    }
  }, []);

  const clearByokApiKey = useCallback(() => {
    setByokApiKeyState("");
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(BYOK_STORAGE_KEY);
      } catch {}
    }
  }, []);

  const aiFetch = useCallback<AiFetch>(
    async (path, init) => {
      const url = new URL(path, window.location.origin);
      const isSameOrigin =
        url.origin === window.location.origin &&
        url.username.length === 0 &&
        url.password.length === 0;
      const method = (init?.method ?? "GET").toUpperCase();

      if (
        !isSameOrigin ||
        !isAiFeaturePath(url.pathname) ||
        url.search.length > 0 ||
        method !== "POST"
      ) {
        throw new Error("AI_ROUTE_NOT_ALLOWED");
      }

      const headers = new Headers(init?.headers);
      headers.delete(BYOK_API_KEY_HEADER);
      const key = byokApiKey.trim();
      if (key.length > 0) {
        headers.set(BYOK_API_KEY_HEADER, key);
      }

      return fetch(url.pathname, {
        ...init,
        credentials: "same-origin",
        headers,
        method,
      });
    },
    [byokApiKey],
  );

  const value = useMemo<AiSessionContextValue>(
    () => ({
      byokApiKey,
      setByokApiKey,
      clearByokApiKey,
      aiFetch,
    }),
    [aiFetch, byokApiKey, clearByokApiKey, setByokApiKey],
  );

  return (
    <AiSessionContext.Provider value={value}>
      {children}
    </AiSessionContext.Provider>
  );
}

export function useAiSession(): AiSessionContextValue {
  const context = useContext(AiSessionContext);
  if (!context) {
    throw new Error("useAiSession requiere AiSessionProvider");
  }
  return context;
}
