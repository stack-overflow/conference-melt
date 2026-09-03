import type { CSSProperties } from "react";
import styles from "./ContinuationStub.module.css";
import type { TimedSession } from "../../data/types";
import { useData } from "../../data/index";
import { hueFor } from "../../domain/colors";
import { formatTime, visualEnd } from "../../domain/time";
import { useStore } from "../../state/store";

export interface ContinuationStubProps {
  session: TimedSession;
}

/** Spec §7.2: a decorative one-liner with no tab stop; a pointer click still opens the detail panel. */
export function ContinuationStub({ session }: ContinuationStubProps) {
  const { index } = useData();
  const colorBy = useStore((s) => s.settings.colorBy);
  const selectSession = useStore((s) => s.selectSession);
  const hue = hueFor(session, colorBy, index);
  const style = { "--card-h": String(hue.hue), "--card-c": String(hue.chroma) } as CSSProperties;

  return (
    <div
      className={styles.stub}
      style={style}
      aria-hidden="true"
      data-stub=""
      data-session-id={session.id}
      onClick={() => selectSession(session.id)}
    >
      <span className={styles.title}>{session.title}</span>
      <span className={styles.until}>{`do ${formatTime(visualEnd(session))}`}</span>
    </div>
  );
}
