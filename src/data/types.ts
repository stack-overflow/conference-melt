export type SignupStatus = "open" | "full" | "included" | "free" | "soon" | "unknown";
export type Level = "0" | "I" | "II" | "III" | "I+II" | null;

export interface Term {
  id: number;
  slug: string;
  name: string;
  count: number;
}

export interface Day {
  id: string;
  termId: number;
  date: string;
  label: string;
  short: string;
  labelLong: string;
}

export interface Location extends Term {
  venue: string;
  level: Level;
  room: string | null;
  short: string;
  order: number;
}

export interface Speaker {
  id: number;
  slug: string;
  name: string;
  photo: string | null;
  photoThumb: string | null;
  bioHtml: string;
  url: string;
  brands: string[];
}

export interface Signup {
  status: SignupStatus;
  url: string | null;
  label: string;
}

export interface Session {
  id: string;
  eventId: number;
  day: string;
  title: string;
  start: number | null;
  end: number | null;
  allDay: boolean;
  timeText: string;
  speakerIds: number[];
  byline: string | null;
  typeIds: number[];
  themeIds: number[];
  brandIds: number[];
  locationIds: number[];
  signup: Signup;
  descriptionHtml: string;
  url: string;
}

export interface ScheduleMeta {
  source: string;
  fetchedAt: string;
  year: number;
  version: 1;
  eventCount: number;
  sessionCount: number;
  speakerCount: number;
}

export interface ScheduleData {
  meta: ScheduleMeta;
  days: Day[];
  locations: Location[];
  types: Term[];
  themes: Term[];
  brands: Term[];
  signupStatuses: Term[];
  speakers: Speaker[];
  sessions: Session[];
}

/** A session whose start is known. Layout code only ever handles these. */
export type TimedSession = Session & { start: number };

export function hasStart(s: Session): s is TimedSession {
  return s.start !== null;
}
