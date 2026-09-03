import { useEffect, useRef } from "react";
import styles from "./CopySheet.module.css";
import { Sheet } from "./Sheet";
import { useStore } from "../../state/store";
import { useTier } from "../../state/useMediaQuery";

function SelectedTextarea({ text }: { text: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [text]);
  return (
    <textarea ref={ref} className={styles.textarea} readOnly value={text} rows={12} aria-label="Tekst do skopiowania" />
  );
}

export function CopySheet() {
  const copyText = useStore((s) => s.copyText);
  const openSheet = useStore((s) => s.openSheet);
  const setSheet = useStore((s) => s.setSheet);
  const setCopyText = useStore((s) => s.setCopyText);
  const mobile = useTier() === "mobile";
  const open = openSheet === "copy" && copyText !== null;

  const close = (): void => {
    setSheet(null);
    setCopyText(null);
  };

  return (
    <Sheet open={open} side={mobile ? "bottom" : "right"} title="Skopiuj ręcznie" onClose={close}>
      <p className={styles.hint}>Schowek jest niedostępny w tej przeglądarce. Tekst poniżej jest zaznaczony, skopiuj go skrótem klawiszowym.</p>
      <SelectedTextarea text={copyText ?? ""} />
    </Sheet>
  );
}
