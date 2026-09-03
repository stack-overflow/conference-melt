import { useCallback, useSyncExternalStore } from "react";

export type Tier = "wide" | "medium" | "mobile";

export const MOBILE_QUERY = "(max-width: 699.98px)";
export const WIDE_QUERY = "(min-width: 1100px)";
export const COARSE_QUERY = "(pointer: coarse)";
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  const list = window.matchMedia(query);
  return list ?? null;
}

/** `true` only when matchMedia exists and reports a match (false in jsdom). */
export function matchesMedia(query: string): boolean {
  return mediaList(query)?.matches === true;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query);
      if (!list || typeof list.addEventListener !== "function") return () => undefined;
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => matchesMedia(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Spec §7.10: wide ≥ 1100 px, mobile < 700 px, medium in between. jsdom resolves to "medium". */
export function useTier(): Tier {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  if (mobile) return "mobile";
  if (wide) return "wide";
  return "medium";
}

export function prefersReducedMotion(): boolean {
  return matchesMedia(REDUCED_MOTION_QUERY);
}
