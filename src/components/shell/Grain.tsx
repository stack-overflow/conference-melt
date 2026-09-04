import { useTier } from "../../state/useMediaQuery";
import styles from "./Grain.module.css";

/** Spec §8: fixed full-page feTurbulence grain at 4 % opacity (`--grain-opacity`), skipped under 700 px for performance. */
export function Grain() {
  const tier = useTier();
  if (tier === "mobile") return null;
  return (
    <svg className={styles.grain} data-grain="" aria-hidden="true" focusable="false">
      <filter id="app-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#app-grain)" />
    </svg>
  );
}
