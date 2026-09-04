import { useState } from "react";
import type { Speaker } from "../../data/types";
import { Avatar } from "../ui/Avatar";
import styles from "./SpeakerBlock.module.css";

interface Props {
  speaker: Speaker;
}

export function SpeakerBlock({ speaker }: Props) {
  const [bioOpen, setBioOpen] = useState(false);
  const hasBio = speaker.bioHtml.trim() !== "";

  return (
    <div className={styles.block}>
      <div className={styles.head}>
        {/* Spec §7.6: the detail panel shows the large photo; the thumb is only the fallback here. */}
        <Avatar name={speaker.name} src={speaker.photo ?? speaker.photoThumb} size={56} />
        <div className={styles.text}>
          <div className={styles.name}>{speaker.name}</div>
          {speaker.brands.length > 0 ? <div className={styles.brands}>{speaker.brands.join(" · ")}</div> : null}
          {hasBio ? (
            <button type="button" className={styles.bioToggle} aria-expanded={bioOpen} onClick={() => setBioOpen((v) => !v)}>
              {bioOpen ? "Ukryj bio" : "Pokaż bio"}
            </button>
          ) : null}
        </div>
      </div>
      {hasBio && bioOpen ? (
        // bioHtml is the fetch script's allowlist-sanitized output (spec §4.3).
        <div className={styles.bio} dangerouslySetInnerHTML={{ __html: speaker.bioHtml }} />
      ) : null}
    </div>
  );
}
