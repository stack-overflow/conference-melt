import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import type { ListGroup } from "../state/derive";
import { ScheduleList, LIVE_GROUP_ID } from "../components/list/ScheduleList";
import { makeData, makeSession } from "./fixtures/build";

const s1 = makeSession({ id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 570, end: 645, locationIds: [233] });
const s2 = makeSession({ id: "2:pt", eventId: 2, title: "Krajobraz nocą", start: 570, end: 645, locationIds: [281] });
const s3 = makeSession({ id: "3:pt", eventId: 3, title: "Analog dziś", start: 600, end: 660, locationIds: [233] });
const s4 = makeSession({ id: "4:pt", eventId: 4, title: "Ogłoszenie wyników konkursu", start: 810, end: null, locationIds: [233] });
const data = makeData([s1, s2, s3, s4]);

const morning: ListGroup = { key: "570", label: "09:30", sessions: [s1, s2, s3], total: 3, parallel: 3 };
const afternoon: ListGroup = { key: "780", label: "13:00–14:00", sessions: [s4], total: 1, parallel: 1 };

function renderList(groups: ListGroup[]) {
  return render(
    <DataProvider value={buildAppData(data)}>
      <ScheduleList groups={groups} />
    </DataProvider>,
  );
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "list",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("ScheduleList", () => {
  it("renders one section per group with its label and event count", () => {
    renderList([morning, afternoon]);
    expect(screen.getByRole("heading", { name: "09:30" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "13:00–14:00" })).toBeTruthy();
    expect(screen.getByText("3 wydarzeń")).toBeTruthy();
    expect(screen.getByText("1 wydarzeń")).toBeTruthy();
  });

  it("shows M równolegle only when M is at least 2 and differs from N", () => {
    renderList([
      { key: "a", label: "A", sessions: [s1, s2, s3], total: 3, parallel: 2 },
      { key: "b", label: "B", sessions: [s1, s2, s3], total: 3, parallel: 3 },
      { key: "c", label: "C", sessions: [s1, s3], total: 2, parallel: 1 },
    ]);
    expect(screen.getByText("2 równolegle")).toBeTruthy();
    expect(screen.queryByText("3 równolegle")).toBeNull();
    expect(screen.queryByText("1 równolegle")).toBeNull();
  });

  it("renders a row card for every session of a group", () => {
    renderList([morning]);
    const section = screen.getByRole("region", { name: "09:30" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByRole("button", { name: /Światło w portrecie/ })).toBeTruthy();
    expect(within(section).getByRole("button", { name: /Krajobraz nocą/ })).toBeTruthy();
    expect(within(section).getByRole("button", { name: /Analog dziś/ })).toBeTruthy();
  });

  it("puts the list-live id and data-live-group on the first group holding a live session when the day is today", () => {
    useStore.setState({ now: new Date(2026, 8, 4, 10, 0) });
    renderList([morning, afternoon]);
    const live = document.getElementById(LIVE_GROUP_ID);
    expect(live).not.toBeNull();
    expect(within(live as HTMLElement).getByRole("heading", { name: "09:30" })).toBeTruthy();
    expect(screen.getAllByRole("region").filter((el) => el.id === LIVE_GROUP_ID)).toHaveLength(1);
    // The LiveChip scrolls to the data attribute, so it must sit on the same section as the id.
    expect(live?.getAttribute("data-live-group")).toBe("");
    expect(document.querySelectorAll("[data-live-group]")).toHaveLength(1);
    expect(document.querySelector("[data-live-group]")).toBe(live);
  });

  it("uses a soon session when nothing is live, keeping the first qualifying group in order", () => {
    useStore.setState({ now: new Date(2026, 8, 4, 9, 50) });
    const early: ListGroup = { key: "500", label: "08:20", sessions: [makeSession({ id: "9:pt", eventId: 9, title: "Wcześnie", start: 500, end: 540 })], total: 1, parallel: 1 };
    const soon: ListGroup = { key: "600", label: "10:00", sessions: [s3], total: 1, parallel: 1 };
    renderList([early, soon, afternoon]);
    const live = document.getElementById(LIVE_GROUP_ID);
    expect(live).not.toBeNull();
    expect(within(live as HTMLElement).getByRole("heading", { name: "10:00" })).toBeTruthy();
    expect(document.querySelector("[data-live-group]")).toBe(live);
  });

  it("adds neither the list-live id nor data-live-group when the selected day is not today", () => {
    useStore.setState({ now: new Date(2026, 8, 3, 10, 0) });
    renderList([morning, afternoon]);
    expect(document.getElementById(LIVE_GROUP_ID)).toBeNull();
    expect(document.querySelector("[data-live-group]")).toBeNull();
  });

  it("renders nothing for an empty group list", () => {
    const { container } = renderList([]);
    expect(container.innerHTML).toBe("");
  });
});
