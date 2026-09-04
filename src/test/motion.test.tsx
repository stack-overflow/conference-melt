import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

const tierState = vi.hoisted(() => ({ tier: "wide" as "wide" | "medium" | "mobile" }));

vi.mock("../state/useMediaQuery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../state/useMediaQuery")>();
  return { ...actual, useTier: () => tierState.tier };
});

import { makeData, makeSession } from "./fixtures/build";
import { DataProvider, buildAppData } from "../data/index";
import { Grain } from "../components/shell/Grain";
import { ScheduleList } from "../components/list/ScheduleList";
import type { ListGroup } from "../state/derive";
import { useStore, defaultSettings } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { GridHarness } from "./gridHarness";

// 22 back-to-back half-hour sessions in one room: enough to cross the 240 ms stagger cap (20 × 12 ms).
const sessions = Array.from({ length: 22 }, (_, i) =>
  makeSession({
    id: `${i + 1}:pt`,
    eventId: i + 1,
    day: "pt",
    title: `Sesja ${i + 1}`,
    start: 540 + i * 30,
    end: 570 + i * 30,
    locationIds: [233],
  }),
);
const fixture = makeData(sessions);
const appData = buildAppData(fixture);

/** Every component under test reads the schedule through `useData()`, so the tree is always mounted inside the provider. */
function renderWithData(ui: ReactNode) {
  return render(<DataProvider value={appData}>{ui}</DataProvider>);
}

/** Inline animation-delay of every card, in DOM order. */
function delays(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>("article[data-session-id]")).map((a) => a.style.animationDelay);
}

beforeEach(() => {
  tierState.tier = "wide";
  useStore.setState({
    day: "pt",
    view: "list",
    filters: EMPTY_FILTERS,
    // the synthetic set is slot-distinguishable, so the timeline is forced for the grid case
    settings: { ...defaultSettings(1440), timeMode: "timeline" },
    favourites: [],
    previewPlan: null,
    sharedPlan: null,
    selectedSessionId: null,
    openSheet: null,
    toasts: [],
    copyText: null,
    // Thursday: not the fixture's day, so no now line and no first-render scroll
    now: new Date(2026, 8, 3, 10, 0),
  });
});

describe("Grain", () => {
  it("renders the feTurbulence overlay at tier wide, hidden from assistive tech", () => {
    const { container } = render(<Grain />);
    const svg = container.querySelector("svg[data-grain]");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("feTurbulence")).not.toBeNull();
  });

  it("renders at tier medium and nothing at tier mobile", () => {
    tierState.tier = "medium";
    const medium = render(<Grain />);
    expect(medium.container.querySelector("svg[data-grain]")).not.toBeNull();
    medium.unmount();
    tierState.tier = "mobile";
    const mobile = render(<Grain />);
    expect(mobile.container.innerHTML).toBe("");
  });
});

describe("entrance stagger", () => {
  it("delays grid cards 12 ms apart in DOM order and caps the delay at 240 ms", () => {
    renderWithData(<GridHarness />);
    const got = delays();
    expect(got).toHaveLength(22);
    expect(got.slice(0, 3)).toEqual(["0ms", "12ms", "24ms"]);
    expect(got[20]).toBe("240ms");
    expect(got[21]).toBe("240ms");
  });

  it("delays list rows the same way, counting across groups", () => {
    const groups: ListGroup[] = [
      { key: "540", label: "09:00", sessions: sessions.slice(0, 2), total: 2, parallel: 1 },
      { key: "600", label: "10:00", sessions: sessions.slice(2, 4), total: 2, parallel: 1 },
    ];
    renderWithData(<ScheduleList groups={groups} />);
    expect(delays()).toEqual(["0ms", "12ms", "24ms", "36ms"]);
  });
});
