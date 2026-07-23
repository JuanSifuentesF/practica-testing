import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_CHECKLIST_STORAGE_KEY,
  clearApiChecklistProgress,
  createInitialApiChecklistProgress,
  readApiChecklistProgress,
  saveApiChecklistProgress,
} from "@/app/(dashboard)/practice/api-testing/_components/checklist-storage";

function useStorage(overrides: Partial<Storage>) {
  vi.stubGlobal("window", {
    localStorage: {
      length: 0,
      clear: vi.fn(),
      getItem: vi.fn(() => null),
      key: vi.fn(() => null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
      ...overrides,
    },
  });
}

describe("API checklist storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the checklist usable when reading storage is blocked", () => {
    useStorage({
      getItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
    });

    expect(readApiChecklistProgress()).toEqual({ kind: "unavailable" });
  });

  it("returns false instead of throwing when write or removal is blocked", () => {
    useStorage({
      setItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
      removeItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
    });

    expect(saveApiChecklistProgress(createInitialApiChecklistProgress())).toBe(
      false,
    );
    expect(clearApiChecklistProgress()).toBe(false);
  });

  it("reads and clears the versioned value", () => {
    const progress = createInitialApiChecklistProgress();
    const removeItem = vi.fn();
    useStorage({
      getItem: vi.fn(() =>
        JSON.stringify({
          version: 1,
          endpointId: "extract-pdf-full",
          progress,
        }),
      ),
      removeItem,
    });

    expect(readApiChecklistProgress()).toEqual({ kind: "valid", progress });
    expect(clearApiChecklistProgress()).toBe(true);
    expect(removeItem).toHaveBeenCalledWith(API_CHECKLIST_STORAGE_KEY);
  });
});
