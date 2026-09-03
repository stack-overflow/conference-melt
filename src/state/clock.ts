import { createClock, type Clock } from "../domain/now";

/** App-wide clock: honours a `?now=` override through createClock and keeps ticking from that base. */
export const clock: Clock = createClock(window.location.search);
