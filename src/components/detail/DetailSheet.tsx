import { useEffect, useRef, useState } from "react";
import type { Location, Signup } from "../../data/types";
import { useData } from "../../data/index";
import { MOBILE_BREAKPOINT, usePlanSet, useStore } from "../../state/store";
import { durationLabel, formatRange } from "../../domain/time";
import { locationsOf, speakersOf } from "../../domain/lookup";
import { Sheet } from "../ui/Sheet";
import { Chip } from "../ui/Chip";
import { SpeakerBlock } from "./SpeakerBlock";
import { SameTimeList } from "./SameTimeList";
import styles from "./DetailSheet.module.css";

const TITLE_ID = "detail-title";

const LEVEL_LABELS: Record<string, string> = {
  "0": "Poziom 0",
  I: "Poziom I",
  "I+II": "Poziom I i II",
  II: "Poziom II",
  III: "Poziom III",
};

function locationLine(l: Location): string {
  const parts = [l.venue];
  if (l.level !== null) parts.push(LEVEL_LABELS[l.level]);
  if (l.room !== null) parts.push(l.room);
  return parts.join(" · ");
}

/** "right" at 700 px and up, "bottom" below; follows window resizes. */
function useSheetSide(): "right" | "bottom" {
  const [wide, setWide] = useState(() => window.innerWidth >= MOBILE_BREAKPOINT);
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= MOBILE_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return wide ? "right" : "bottom";
}

function SignupControl({ signup }: { signup: Signup }) {
  if (signup.status === "full") {
    return (
      <button type="button" className={styles.signup} disabled>
        {signup.label}
      </button>
    );
  }
  if (signup.url !== null) {
    return (
      <a className={styles.signup} href={signup.url} target="_blank" rel="noopener noreferrer">
        {signup.label}
      </a>
    );
  }
  return <span className={styles.signupInfo}>{signup.label}</span>;
}

export function DetailSheet() {
  const { index } = useData();
  const selectedId = useStore((s) => s.selectedSessionId);
  const openSheet = useStore((s) => s.openSheet);
  const preview = useStore((s) => s.previewPlan !== null);
  const setSheet = useStore((s) => s.setSheet);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const planSet = usePlanSet();
  const side = useSheetSide();

  const session = selectedId === null ? null : (index.sessionById.get(selectedId) ?? null);
  const open = openSheet === "detail" && session !== null;

  // Focus restore: capture the opener synchronously when the store flips to "detail",
  // before React renders the dialog and the Sheet moves focus inside it.
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(
    () =>
      useStore.subscribe((state, prev) => {
        if (state.openSheet === "detail" && prev.openSheet !== "detail") {
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }
      }),
    [],
  );
  useEffect(() => {
    if (open || openerRef.current === null) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener.isConnected) opener.focus();
  }, [open]);

  if (session === null) return null;

  const day = index.dayById.get(session.day);
  const types = session.typeIds.flatMap((id) => index.typeById.get(id) ?? []);
  const themes = session.themeIds.flatMap((id) => index.themeById.get(id) ?? []);
  const brands = session.brandIds.flatMap((id) => index.brandById.get(id) ?? []);
  const locations = locationsOf(session, index);
  const speakers = speakersOf(session, index);
  const inPlan = planSet.has(session.id);
  const timeLabel = session.start === null ? "Bez godziny" : formatRange(session.start, session.end);
  const duration = session.start === null ? null : durationLabel(session.start, session.end);

  return (
    <Sheet open={open} side={side} title="Szczegóły wydarzenia" onClose={() => setSheet(null)} labelledBy={TITLE_ID}>
      <article className={styles.detail}>
        {types.length > 0 ? (
          <ul className={styles.chips} aria-label="Typ">
            {types.map((t) => (
              <li key={t.id}>
                <Chip tone="accent">{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <h2 id={TITLE_ID} className={styles.title}>
          {session.title}
        </h2>
        <p className={styles.when}>
          {day ? <span className={styles.day}>{day.labelLong}</span> : null}
          <span className={styles.time}>{timeLabel}</span>
          {duration !== null ? <span className={styles.duration}>{duration}</span> : null}
        </p>
        {locations.length > 0 ? (
          <ul className={styles.locations}>
            {locations.map((l) => (
              <li key={l.id}>{locationLine(l)}</li>
            ))}
          </ul>
        ) : null}
        {themes.length > 0 ? (
          <ul className={styles.chips} aria-label="Tematyka">
            {themes.map((t) => (
              <li key={t.id}>
                <Chip>{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {brands.length > 0 ? (
          <ul className={styles.chips} aria-label="Marka">
            {brands.map((t) => (
              <li key={t.id}>
                <Chip>{t.name}</Chip>
              </li>
            ))}
          </ul>
        ) : null}
        {speakers.length > 0 ? (
          <div className={styles.speakers}>
            {speakers.map((sp) => (
              <SpeakerBlock key={sp.id} speaker={sp} />
            ))}
          </div>
        ) : session.byline !== null ? (
          <p className={styles.byline}>{session.byline}</p>
        ) : null}
        <div className={styles.actions}>
          <SignupControl signup={session.signup} />
          {preview ? null : (
            <button
              type="button"
              className={inPlan ? styles.planRemove : styles.planAdd}
              onClick={() => toggleFavourite(session.id)}
            >
              {inPlan ? "Usuń z planu" : "Dodaj do planu"}
            </button>
          )}
        </div>
        <SameTimeList session={session} />
        <a className={styles.source} href={session.url} target="_blank" rel="noopener noreferrer">
          Zobacz na stronie festiwalu
        </a>
      </article>
    </Sheet>
  );
}
