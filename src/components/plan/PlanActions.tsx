import { Copy, Download, Printer, Share2 } from "lucide-react";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { buildIcs } from "../../domain/ics";
import { buildShareUrl } from "../../domain/share";
import { planAsText } from "../../domain/text";
import { copyText } from "../../state/clipboard";
import { useStore } from "../../state/store";
import styles from "./PlanActions.module.css";

export interface PlanActionsProps {
  plan: Session[];
  preview: boolean;
}

const ICS_FILENAME = "swiatlosila-2026-plan.ics";
const COPY_TOAST = "Skopiowano plan jako tekst";
const SHARE_TOAST = "Skopiowano link do planu";
const SHARE_TOAST_FILE =
  "Skopiowano. Link zadziała tylko u osób z tym samym plikiem. Opublikuj aplikację w sieci, aby udostępniać plan";

/** Spec §7.5: a Blob, a temporary anchor with `download`, click, revoke. */
function downloadIcs(ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = ICS_FILENAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function PlanActions({ plan, preview }: PlanActionsProps) {
  const { data, index } = useData();
  const day = useStore((s) => s.day);
  const favourites = useStore((s) => s.favourites);
  const pushToast = useStore((s) => s.pushToast);
  const setCopyText = useStore((s) => s.setCopyText);
  const setSheet = useStore((s) => s.setSheet);

  /** Clipboard first; when it is missing or refuses, the "Skopiuj ręcznie" sheet takes over (spec §7.5). */
  const copyOrFallback = async (text: string, toast: string): Promise<void> => {
    if (await copyText(text)) {
      pushToast(toast);
      return;
    }
    setCopyText(text);
    setSheet("copy");
  };

  const onCopy = (): void => {
    void copyOrFallback(planAsText(plan, data, index), COPY_TOAST);
  };

  // The share link carries the whole saved plan (every day), never the preview.
  const onShare = (): void => {
    const { href, protocol } = window.location;
    void copyOrFallback(buildShareUrl(href, day, favourites), protocol === "file:" ? SHARE_TOAST_FILE : SHARE_TOAST);
  };

  const onIcs = (): void => downloadIcs(buildIcs(plan, data, index));
  const onPrint = (): void => window.print();

  return (
    <div className={styles.actions} role="group" aria-label="Akcje planu">
      <button type="button" className={styles.action} onClick={onCopy}>
        <Copy size={16} aria-hidden="true" />
        Kopiuj jako tekst
      </button>
      {!preview && (
        <button type="button" className={styles.action} onClick={onShare}>
          <Share2 size={16} aria-hidden="true" />
          Udostępnij
        </button>
      )}
      <button type="button" className={styles.action} onClick={onIcs}>
        <Download size={16} aria-hidden="true" />
        Pobierz .ics
      </button>
      <button type="button" className={styles.action} onClick={onPrint}>
        <Printer size={16} aria-hidden="true" />
        Drukuj
      </button>
    </div>
  );
}
