import type { CSSProperties } from "react";
import { TriangleAlert } from "lucide-react";
import styles from "./SessionCard.module.css";
import type { Session } from "../../data/types";
import { useData } from "../../data/index";
import { hueFor } from "../../domain/colors";
import { locationLabel, speakersOf } from "../../domain/lookup";
import { liveState, nowFor } from "../../domain/now";
import { conflictCount } from "../../domain/overlaps";
import { planSessions } from "../../domain/plan";
import { formatRange, isPoint } from "../../domain/time";
import { usePlanSet, useStore } from "../../state/store";
import { Avatar } from "../ui/Avatar";
import { Star } from "../ui/Star";
import { cx } from "../ui/cx";

export interface SessionCardProps {
  session: Session;
  compact?: boolean;
  showLocation: boolean;
  style?: CSSProperties;
  variant: "grid" | "row" | "chip";
}

type CardSize = "xs" | "sm" | "md";

const MAX_AVATARS = 3;
/** Spec §7.2: under 56 px the card shows title and time only, under 40 px the title alone. */
const SMALL_PX = 56;
const TINY_PX = 40;

function sizeOf(style: CSSProperties | undefined): CardSize {
  const height = style?.height;
  const px = typeof height === "number" ? height : typeof height === "string" ? Number.parseFloat(height) : Number.NaN;
  if (!Number.isFinite(px)) return "md";
  if (px < TINY_PX) return "xs";
  if (px < SMALL_PX) return "sm";
  return "md";
}

function signupBadge(session: Session): { text: string; tone: "open" | "full" } | null {
  if (session.signup.status === "open") return { text: "Zapisy", tone: "open" };
  if (session.signup.status === "full") return { text: "Brak miejsc", tone: "full" };
  return null;
}

export function SessionCard({ session, compact = false, showLocation, style, variant }: SessionCardProps) {
  const { index } = useData();
  const colorBy = useStore((s) => s.settings.colorBy);
  const showAvatars = useStore((s) => s.settings.showAvatars);
  const now = useStore((s) => s.now);
  const previewing = useStore((s) => s.previewPlan !== null);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const selectSession = useStore((s) => s.selectSession);
  const planSet = usePlanSet();

  const hue = hueFor(session, colorBy, index);
  const day = index.dayById.get(session.day);
  const state = liveState(session, day ? nowFor(day, now) : null);
  const inPlan = planSet.has(session.id);
  // `overlaps` is false across days, so the day's own sessions are all that can conflict.
  const conflicts = inPlan
    ? conflictCount(session, planSessions(planSet, index.sessionsByDay.get(session.day) ?? []))
    : 0;
  const time = session.start === null ? null : formatRange(session.start, session.end);
  const location = locationLabel(session, index);
  const badge = signupBadge(session);
  const speakers = speakersOf(session, index);
  const avatars = showAvatars ? speakers.slice(0, MAX_AVATARS) : [];
  // Spec §7.4: a list row falls back to the names while avatars are off; the other variants then show no speakers.
  const speakerNames = variant === "row" && !showAvatars ? speakers.map((speaker) => speaker.name).join(", ") : "";
  const label = [session.title, time, location, badge?.text, conflicts > 0 ? `nakłada się z ${conflicts} w planie` : null]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ");
  const paintLocation = showLocation && location.length > 0;
  const hasMeta = paintLocation || avatars.length > 0 || speakerNames.length > 0 || badge !== null || conflicts > 0;

  const cardStyle = { ...style, "--card-h": String(hue.hue), "--card-c": String(hue.chroma) } as CSSProperties;

  return (
    <article
      className={cx(styles.card, styles[variant], compact && styles.compact)}
      style={cardStyle}
      data-session-id={session.id}
      data-size={sizeOf(style)}
      data-live={state}
      data-in-plan={inPlan ? "true" : undefined}
      data-point={isPoint(session) ? "true" : undefined}
    >
      <button
        type="button"
        className={cx("card__main", styles.main)}
        aria-label={label}
        title={label}
        onClick={() => selectSession(session.id)}
      >
        <span className={styles.title}>{session.title}</span>
        {time !== null && (
          <span className={styles.time}>
            {time}
            {state === "live" && <span className={styles.livePill}>Teraz</span>}
          </span>
        )}
        {hasMeta && (
          <span className={styles.meta}>
            {paintLocation && <span className={styles.location}>{location}</span>}
            {avatars.length > 0 && (
              <span className={styles.avatars}>
                {avatars.map((speaker) => (
                  <Avatar
                    key={speaker.id}
                    name={speaker.name}
                    src={speaker.photoThumb}
                    size={22}
                    hue={hue.chroma > 0 ? hue.hue : undefined}
                  />
                ))}
              </span>
            )}
            {speakerNames.length > 0 && <span className={styles.speakerNames}>{speakerNames}</span>}
            {badge && <span className={cx(styles.badge, styles[badge.tone])}>{badge.text}</span>}
            {conflicts > 0 && (
              <span className={styles.conflict} data-conflicts={conflicts} title={`Nakłada się z ${conflicts} w planie`}>
                <TriangleAlert size={11} aria-hidden="true" />
                {conflicts}
              </span>
            )}
          </span>
        )}
      </button>
      {!previewing && (
        <span className={styles.starSlot}>
          <Star pressed={inPlan} onToggle={() => toggleFavourite(session.id)} />
        </span>
      )}
    </article>
  );
}
