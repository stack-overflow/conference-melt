import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import type { Session, TimedSession } from "../data/types";
import { hasStart } from "../data/types";
import { EMPTY_FILTERS } from "../domain/filters";
import { STORAGE_KEY, defaultSettings, useStore } from "../state/store";
import { SessionCard } from "../components/grid/SessionCard";
import { ContinuationStub } from "../components/grid/ContinuationStub";
import { ViewSwitcher } from "../components/shell/ViewSwitcher";
import { makeData, makeSession, makeSpeaker } from "./fixtures/build";

const talk = makeSession({
  id: "1:pt",
  eventId: 1,
  title: "Światło w studiu",
  start: 600,
  end: 660,
  speakerIds: [100, 101, 102, 103],
  signup: { status: "open", url: "https://www.cyfrowe.pl/zapisy", label: "Zapisy" },
});
const second = makeSession({ id: "2:pt", eventId: 2, title: "Druga", start: 630, end: 690 });
const third = makeSession({ id: "3:pt", eventId: 3, title: "Trzecia", start: 645, end: 675 });
const noTime = makeSession({ id: "4:pt", eventId: 4, title: "Bez godziny sesja", start: null, end: null });
const full = makeSession({
  id: "5:pt",
  eventId: 5,
  title: "Pełne",
  start: 720,
  end: 780,
  signup: { status: "full", url: null, label: "Brak miejsc" },
});
const earlier = makeSession({ id: "6:pt", eventId: 6, title: "Wcześniej", start: 540, end: 570 });
const soon = makeSession({ id: "7:pt", eventId: 7, title: "Zaraz", start: 640, end: 700 });
const point = makeSession({ id: "8:pt", eventId: 8, title: "Otwarcie", start: 570, end: null });

const speakers = [100, 101, 102, 103].map((id) => makeSpeaker({ id, slug: `osoba-${id}`, name: `Anna Nr${id}` }));
const appData = buildAppData(makeData([talk, second, third, noTime, full, earlier, soon, point], { speakers }));

function wrap(node: ReactNode) {
  return <DataProvider value={appData}>{node}</DataProvider>;
}

function timed(s: Session): TimedSession {
  if (!hasStart(s)) throw new Error("test session needs a start");
  return s;
}

function article(id: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`article[data-session-id="${id}"]`);
  if (!el) throw new Error(`missing card ${id}`);
  return el;
}

beforeEach(() => {
  // persistence starts clean for every test; the store's persist middleware writes through setState
  localStorage.clear();
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    settings: defaultSettings(1024),
    favourites: [],
    selectedSessionId: null,
    openSheet: null,
    sharedPlan: null,
    previewPlan: null,
    now: new Date(2026, 8, 4, 10, 30),
    toasts: [],
    copyText: null,
  });
});

describe("SessionCard", () => {
  it("is an article with a primary button that nests no other control and a sibling star", () => {
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const main = screen.getByRole("button", { name: "Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy" });
    expect(main.classList.contains("card__main")).toBe(true);
    expect(main.getAttribute("title")).toBe("Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy");
    expect(within(main).queryAllByRole("button")).toHaveLength(0);
    const card = article("1:pt");
    expect(main.parentElement).toBe(card);
    expect(card.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Do planu" }).closest("article")).toBe(card);
  });

  it("shows the location, at most three avatars and the Zapisy badge", () => {
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.getByText("Sala wykł. 1")).not.toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.getByText("Zapisy")).not.toBeNull();
  });

  it("shows Brak miejsc for a full session", () => {
    render(wrap(<SessionCard session={full} variant="grid" showLocation />));
    expect(screen.getByRole("button", { name: "Pełne, 12:00–13:00, Sala wykł. 1, Brak miejsc" })).not.toBeNull();
    expect(screen.getByText("Brak miejsc")).not.toBeNull();
  });

  it("adds no badge for the other signup statuses", () => {
    render(wrap(<SessionCard session={second} variant="grid" showLocation />));
    expect(screen.getByRole("button", { name: "Druga, 10:30–11:30, Sala wykł. 1" })).not.toBeNull();
    expect(screen.queryByText("Zapisy")).toBeNull();
    expect(screen.queryByText("Brak miejsc")).toBeNull();
  });

  it("hides the location under the location axis and the avatars when the setting is off", () => {
    useStore.setState({ settings: { ...defaultSettings(1024), showAvatars: false } });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation={false} />));
    expect(screen.queryByText("Sala wykł. 1")).toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    // the accessible name keeps the location even when it is not painted
    expect(screen.getByRole("button", { name: "Światło w studiu, 10:00–11:00, Sala wykł. 1, Zapisy" })).not.toBeNull();
  });

  it("row variant shows speaker names when avatars are off", () => {
    useStore.setState({ settings: { ...defaultSettings(1024), showAvatars: false } });
    const { rerender } = render(wrap(<SessionCard session={talk} variant="row" showLocation />));
    expect(screen.getByText("Anna Nr100, Anna Nr101, Anna Nr102, Anna Nr103")).not.toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(document.querySelector("img")).toBeNull();
    // the other variants keep showing no speakers while avatars are off
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.queryByText("Anna Nr100, Anna Nr101, Anna Nr102, Anna Nr103")).toBeNull();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("toggles the favourite through the store and flips aria-pressed", async () => {
    const user = userEvent.setup();
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const star = screen.getByRole("button", { name: "Do planu" });
    expect(star.getAttribute("aria-pressed")).toBe("false");
    expect(article("1:pt").getAttribute("data-in-plan")).toBeNull();
    await user.click(star);
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
    expect(article("1:pt").getAttribute("data-in-plan")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Do planu" }));
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("star toggle updates the Mój plan badge and persists across rehydrate", async () => {
    const user = userEvent.setup();
    render(
      wrap(
        <>
          <ViewSwitcher />
          <SessionCard session={talk} variant="grid" showLocation />
        </>,
      ),
    );
    const planButton = () => screen.getByRole("button", { name: /Mój plan/ });
    expect(within(planButton()).queryByText(/^\d+$/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Do planu" }));
    expect(within(planButton()).getByText("1")).not.toBeNull();
    // The persist middleware writes through every setState (the reset below included), so the
    // slice the click stored is captured first and put back before rehydrating, as in store.test.ts.
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).toContain('"1:pt"');
    act(() => useStore.setState({ favourites: [] }));
    expect(within(planButton()).queryByText("1")).toBeNull();
    localStorage.setItem(STORAGE_KEY, stored ?? "");
    await act(async () => {
      await useStore.persist.rehydrate();
    });
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    expect(within(planButton()).getByText("1")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Do planu" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the detail panel from the primary button", async () => {
    const user = userEvent.setup();
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    await user.click(screen.getByRole("button", { name: /^Światło w studiu/ }));
    expect(useStore.getState().selectedSessionId).toBe("1:pt");
    expect(useStore.getState().openSheet).toBe("detail");
  });

  it("shows the conflict badge with the number of overlapping plan sessions", () => {
    useStore.setState({ favourites: ["1:pt", "2:pt", "3:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    const badge = article("1:pt").querySelector("[data-conflicts]");
    expect(badge?.textContent).toBe("2");
    expect(badge?.getAttribute("data-conflicts")).toBe("2");
  });

  it("shows no conflict badge when the card itself is not in the plan", () => {
    useStore.setState({ favourites: ["2:pt", "3:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(article("1:pt").querySelector("[data-conflicts]")).toBeNull();
  });

  it("hides the star while a shared plan is previewed but still tints preview members", () => {
    useStore.setState({ previewPlan: ["1:pt"] });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(screen.queryByRole("button", { name: "Do planu" })).toBeNull();
    expect(article("1:pt").querySelectorAll("button")).toHaveLength(1);
    expect(article("1:pt").getAttribute("data-in-plan")).toBe("true");
  });

  it("marks live, soon, past and upcoming cards from the store clock", () => {
    render(
      wrap(
        <>
          <SessionCard session={talk} variant="grid" showLocation />
          <SessionCard session={soon} variant="grid" showLocation />
          <SessionCard session={earlier} variant="grid" showLocation />
          <SessionCard session={noTime} variant="grid" showLocation />
        </>,
      ),
    );
    expect(article("1:pt").getAttribute("data-live")).toBe("live");
    expect(within(article("1:pt")).getByText("Teraz")).not.toBeNull();
    expect(article("7:pt").getAttribute("data-live")).toBe("soon");
    expect(article("6:pt").getAttribute("data-live")).toBe("past");
    expect(article("4:pt").getAttribute("data-live")).toBe("upcoming");
    expect(within(article("6:pt")).queryByText("Teraz")).toBeNull();
  });

  it("treats every card as upcoming on another day", () => {
    useStore.setState({ now: new Date(2026, 8, 5, 10, 30) });
    render(wrap(<SessionCard session={talk} variant="grid" showLocation />));
    expect(article("1:pt").getAttribute("data-live")).toBe("upcoming");
    expect(screen.queryByText("Teraz")).toBeNull();
  });

  it("derives data-size from the inline height", () => {
    const { rerender } = render(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "36px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("xs");
    expect(article("1:pt").style.height).toBe("36px");
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "50px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("sm");
    rerender(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "120px" }} />));
    expect(article("1:pt").getAttribute("data-size")).toBe("md");
    rerender(wrap(<SessionCard session={talk} variant="row" showLocation />));
    expect(article("1:pt").getAttribute("data-size")).toBe("md");
  });

  it("marks point sessions and shows their single time", () => {
    render(wrap(<SessionCard session={point} variant="grid" showLocation />));
    expect(article("8:pt").getAttribute("data-point")).toBe("true");
    expect(screen.getByRole("button", { name: "Otwarcie, 09:30, Sala wykł. 1" })).not.toBeNull();
  });

  it("omits the time from a chip for a session without a start", () => {
    render(wrap(<SessionCard session={noTime} variant="chip" showLocation />));
    expect(screen.getByRole("button", { name: "Bez godziny sesja, Sala wykł. 1" })).not.toBeNull();
  });

  it("row variant gives the title the flexible-sizing class so it wins space over the location", () => {
    render(wrap(<SessionCard session={talk} variant="row" showLocation />));
    const card = article("1:pt");
    expect(card.classList.contains("row")).toBe(true);
    const title = card.querySelector(".title");
    expect(title).not.toBeNull();
    expect(title?.textContent).toBe("Światło w studiu");
    // The row-variant CSS scopes the title's flex: 1 1 auto (primary, wins space) and the
    // meta's flex: 0 1 auto; max-width: 38% (secondary, capped) to ".row .title"/".row .meta";
    // confirm both elements actually sit under the ".row" scope so those rules apply to them.
    expect(title?.closest(".row")).toBe(card);
    const meta = card.querySelector(".meta");
    expect(meta).not.toBeNull();
    expect(meta?.closest(".row")).toBe(card);
  });

  it("logs no console.error while rendering a card in the plan with conflicts", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      useStore.setState({ favourites: ["1:pt", "2:pt"] });
      render(wrap(<SessionCard session={talk} variant="grid" showLocation style={{ height: "120px" }} />));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("ContinuationStub", () => {
  it("is decorative, names the end time and opens the detail on click", () => {
    render(wrap(<ContinuationStub session={timed(talk)} />));
    const stub = document.querySelector<HTMLElement>('[data-stub][data-session-id="1:pt"]');
    expect(stub).not.toBeNull();
    expect(stub?.getAttribute("aria-hidden")).toBe("true");
    expect(stub?.textContent).toContain("Światło w studiu");
    expect(stub?.textContent).toContain("do 11:00");
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(stub as Element);
    expect(useStore.getState().selectedSessionId).toBe("1:pt");
    expect(useStore.getState().openSheet).toBe("detail");
  });

  it("uses the 20-minute visual end for a point session", () => {
    render(wrap(<ContinuationStub session={timed(point)} />));
    expect(document.querySelector("[data-stub]")?.textContent).toContain("do 09:50");
  });
});
