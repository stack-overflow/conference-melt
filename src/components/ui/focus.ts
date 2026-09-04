import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Internal, used only by Sheet and Popover. Tabbable descendants of `root` in DOM order.
 * A closed `<details>` hides everything but its own `<summary>`, so its contents are dropped:
 * focusing them is a no-op and would park the trap on an invisible element.
 */
export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("hidden") &&
      el.getAttribute("aria-hidden") !== "true" &&
      (el.tagName === "SUMMARY" || el.closest("details:not([open])") === null),
  );
}

/**
 * Internal, used only by Sheet and Popover.
 * While `open`: remembers the element focused before opening, focuses the panel unless a child
 * already took focus (CopySheet's textarea does), closes on Escape and, when `trap` is true, keeps
 * Tab / Shift+Tab cycling inside the panel. When `open` turns false (or the component unmounts) it
 * restores focus to the remembered element.
 */
export function useDialogFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  trap: boolean,
): void {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
  }, [open, panelRef]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !trap) return;
      const panel = panelRef.current;
      if (!panel) return;
      e.preventDefault();
      const items = focusables(panel);
      if (items.length === 0) {
        panel.focus();
        return;
      }
      const last = items.length - 1;
      const current = items.findIndex((el) => el === document.activeElement);
      const next = e.shiftKey
        ? current <= 0
          ? last
          : current - 1
        : current === -1 || current === last
          ? 0
          : current + 1;
      items[next]?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, trap, panelRef]);
}
