// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, watchSystemTheme } from "./theme";

type Listener = () => void;

/** Installs a controllable matchMedia: `(prefers-color-scheme: light)` matches while `light` is true. */
function installMatchMedia(initialLight: boolean) {
  const listeners = new Set<Listener>();
  const state = { light: initialLight };
  const mql = {
    get matches() {
      return state.light;
    },
    media: "(prefers-color-scheme: light)",
    onchange: null,
    addEventListener: (_type: string, cb: Listener) => {
      listeners.add(cb);
    },
    removeEventListener: (_type: string, cb: Listener) => {
      listeners.delete(cb);
    },
    addListener: (cb: Listener) => {
      listeners.add(cb);
    },
    removeListener: (cb: Listener) => {
      listeners.delete(cb);
    },
    dispatchEvent: () => true,
  };
  const matchMedia = vi.fn((query: string) => {
    if (query !== "(prefers-color-scheme: light)") {
      return { ...mql, media: query, matches: false } as unknown as MediaQueryList;
    }
    return mql as unknown as MediaQueryList;
  });
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    setLight(value: boolean) {
      state.light = value;
      for (const cb of listeners) cb();
    },
    listeners,
    matchMedia,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("applyTheme", () => {
  it("writes an explicit dark or light choice to data-theme", () => {
    installMatchMedia(true);
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system to light when the OS prefers light", () => {
    installMatchMedia(true);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system to dark when the OS does not prefer light", () => {
    installMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("resolves system to dark when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

describe("watchSystemTheme", () => {
  it("re-applies the system theme when the preference changes", () => {
    const mm = installMatchMedia(false);
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    const stop = watchSystemTheme(() => "system");
    mm.setLight(true);
    expect(document.documentElement.dataset.theme).toBe("light");
    stop();
  });

  it("ignores preference changes while an explicit theme is chosen", () => {
    const mm = installMatchMedia(false);
    applyTheme("dark");
    const stop = watchSystemTheme(() => "dark");
    mm.setLight(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    stop();
  });

  it("unsubscribes", () => {
    const mm = installMatchMedia(false);
    const stop = watchSystemTheme(() => "system");
    expect(mm.listeners.size).toBe(1);
    stop();
    expect(mm.listeners.size).toBe(0);
  });

  it("returns a no-op unsubscribe when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    const stop = watchSystemTheme(() => "system");
    expect(() => stop()).not.toThrow();
  });
});
