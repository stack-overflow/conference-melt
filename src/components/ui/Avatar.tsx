import { useState, type CSSProperties } from "react";
import styles from "./Avatar.module.css";

export interface AvatarProps {
  name: string;
  src: string | null;
  size?: number;
  hue?: number;
}

/** Internal, used only here and in tests. First letter of the first and last word, uppercased. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  const result = (first + last).toUpperCase();
  return result.length > 0 ? result : "?";
}

export function Avatar({ name, src, size = 28, hue }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== null && failedSrc !== src;
  const style = {
    width: size,
    height: size,
    fontSize: size,
    "--avatar-hue": hue === undefined ? "60" : String(hue),
    "--avatar-chroma": hue === undefined ? "0" : "0.08",
  } as CSSProperties;

  return (
    <span className={styles.avatar} role="img" aria-label={name} title={name} style={style}>
      {showImage ? (
        <img className={styles.img} src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} />
      ) : (
        <span className={styles.initials} aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
