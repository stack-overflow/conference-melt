import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataProvider, buildAppData } from "../data/index";
import { useStore } from "../state/store";
import { EMPTY_FILTERS } from "../domain/filters";
import { DetailSheet } from "../components/detail/DetailSheet";
import { makeData, makeLocation, makeSession, makeSpeaker } from "./fixtures/build";

const locations = [
  makeLocation({ id: 308, slug: "stoiska-wystawcow-poziom-i-plenum", name: "Stoiska wystawców - poziom I (PLENUM)", count: 1, venue: "Stoiska wystawców", level: "I", room: "PLENUM", short: "Stoiska · Plenum", order: 0 }),
  makeLocation({ id: 233, slug: "so-salsa-poziom-ii-sala-wykladowa-nr-1", name: "So Salsa - poziom II - Sala wykładowa nr 1", count: 3, venue: "So Salsa", level: "II", room: "Sala wykładowa nr 1", short: "Sala wykł. 1", order: 1 }),
  makeLocation({ id: 281, slug: "sosalsa-poziom-ii-sala-wykladowa-nr-2", name: "SoSalsa - poziom II - Sala wykładowa nr 2", count: 2, venue: "SoSalsa", level: "II", room: "Sala wykładowa nr 2", short: "Sala wykł. 2", order: 2 }),
  makeLocation({ id: 318, slug: "rejestracja", name: "Rejestracja", count: 1, venue: "Rejestracja", level: null, room: null, short: "Rejestracja", order: 3 }),
];

const speaker = makeSpeaker({
  id: 293,
  slug: "filip-blank",
  name: "Filip Blank",
  photo: "https://swiatlosila.pl/wp-content/uploads/2024/08/600_Blank_Filip_canon.jpg",
  photoThumb: "https://swiatlosila.pl/wp-content/uploads/2024/08/600_Blank_Filip_canon-300x300.jpg",
  bioHtml: "<p>Fotograf, podróżnik, mąż i ojciec dwójki dzieci.</p>",
  url: "https://swiatlosila.pl/cyfrowe-prelegent/filip-blank/",
  brands: ["Canon"],
});

const included = { status: "included" as const, url: null, label: "W ramach festiwalu" };

/** The selected session, 10:00–11:00 on Friday. */
const selected = makeSession({
  id: "1:pt", eventId: 1, title: "Światło w portrecie", start: 600, end: 660,
  typeIds: [184], locationIds: [233], themeIds: [267], brandIds: [11], speakerIds: [293], byline: null,
  signup: { status: "open", url: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html", label: "Zapisy" },
  url: "https://swiatlosila.pl/cyfrowe-event/swiatlo-w-portrecie/",
});
// Spec §10 fixture: three overlapping, one touching the end, one all-day zone.
const before = makeSession({ id: "2:pt", eventId: 2, title: "Poranny krajobraz", start: 570, end: 615, locationIds: [281], speakerIds: [], signup: included });
const same = makeSession({ id: "3:pt", eventId: 3, title: "Analog dziś", start: 600, end: 660, locationIds: [281], speakerIds: [], signup: included });
const after = makeSession({ id: "4:pt", eventId: 4, title: "Film w aparacie", start: 630, end: 690, locationIds: [308], speakerIds: [], signup: included });
const touching = makeSession({ id: "5:pt", eventId: 5, title: "Druk w domu", start: 660, end: 720, locationIds: [233], speakerIds: [], signup: included });
const zone = makeSession({ id: "6:pt", eventId: 6, title: "Rejestracja", start: 540, end: 1080, allDay: true, typeIds: [242], locationIds: [318], speakerIds: [], signup: included });
// Saturday cases: a point session with a byline and a full workshop that ends at 13:00, before the 13:30 point session, so neither lists the other under "W tym samym czasie".
const point = makeSession({ id: "7:sob", eventId: 7, day: "sob", title: "Ogłoszenie wyników konkursu", start: 810, end: null, typeIds: [242], locationIds: [233], speakerIds: [], byline: "Cyfrowe.pl", signup: included });
const full = makeSession({
  id: "8:sob", eventId: 8, day: "sob", title: "Warsztaty Masterclass – Moda na błysk", start: 570, end: 780, typeIds: [5], locationIds: [233], speakerIds: [], byline: null,
  signup: { status: "full", url: "https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-moda-na-blysk-katarzyna-budziszyna-danaj-p.html", label: "Brak miejsc" },
});

const data = makeData([selected, before, same, after, touching, zone, point, full], {
  locations,
  themes: [{ id: 267, slug: "portret", name: "Portret", count: 1 }],
  brands: [{ id: 11, slug: "sony", name: "Sony", count: 1 }],
  speakers: [speaker],
});

function renderDetail(id: string) {
  useStore.setState({ selectedSessionId: id, openSheet: "detail" });
  return render(
    <DataProvider value={buildAppData(data)}>
      <DetailSheet />
    </DataProvider>,
  );
}

beforeEach(() => {
  useStore.setState({
    day: "pt",
    view: "grid",
    filters: { ...EMPTY_FILTERS },
    favourites: [],
    previewPlan: null,
    selectedSessionId: null,
    openSheet: null,
    now: new Date(2026, 8, 3, 10, 0),
    toasts: [],
  });
});

describe("DetailSheet", () => {
  it("shows the type chip, title, day, time and duration", () => {
    renderDetail("1:pt");
    expect(screen.getByText("Prelekcja")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Światło w portrecie" })).toBeTruthy();
    expect(screen.getByText("Piątek, 4 września")).toBeTruthy();
    // "10:00–11:00" also appears on the same-time row of 3:pt, so more than one match is expected.
    expect(screen.getAllByText("10:00–11:00").length).toBeGreaterThan(0);
    expect(screen.getByText("1 h")).toBeTruthy();
  });

  it("shows venue, level and room, theme and brand chips", () => {
    renderDetail("1:pt");
    expect(screen.getByText("So Salsa · Poziom II · Sala wykładowa nr 1")).toBeTruthy();
    expect(screen.getByText("Portret")).toBeTruthy();
    expect(screen.getByText("Sony")).toBeTruthy();
  });

  it("renders the speaker with name, brands and a bio disclosure", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    expect(screen.getByText("Filip Blank")).toBeTruthy();
    expect(screen.getByText("Canon")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Pokaż bio" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Fotograf, podróżnik/)).toBeNull();
    await user.click(toggle);
    expect(screen.getByText(/Fotograf, podróżnik/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ukryj bio" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("shows the byline when no speaker resolved, and a single time without duration for a point session", () => {
    renderDetail("7:sob");
    expect(screen.getByText("Cyfrowe.pl")).toBeTruthy();
    expect(screen.getByText("13:30")).toBeTruthy();
    expect(screen.queryByText(/^\d+ (h|min)/)).toBeNull();
    expect(screen.queryByText(/–/)).toBeNull();
  });

  it("renders the signup as an external link when open and a disabled button when full", () => {
    const open = renderDetail("1:pt");
    const link = screen.getByRole("link", { name: "Zapisy" });
    expect(link.getAttribute("href")).toBe("https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    open.unmount();
    renderDetail("8:sob");
    const button = screen.getByRole("button", { name: "Brak miejsc" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole("link", { name: "Brak miejsc" })).toBeNull();
  });

  it("adds to and removes from the plan with the labelled button", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    await user.click(screen.getByRole("button", { name: "Dodaj do planu" }));
    expect(useStore.getState().favourites).toEqual(["1:pt"]);
    await user.click(screen.getByRole("button", { name: "Usuń z planu" }));
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("lists exactly the three overlapping same-day sessions, whether or not they pass the filters", () => {
    useStore.setState({ filters: { ...EMPTY_FILTERS, locations: [233] } });
    renderDetail("1:pt");
    const list = screen.getByRole("list", { name: "W tym samym czasie" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const names = within(list).getAllByRole("button", { name: /,/ }).map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual([
      "Poranny krajobraz, 09:30–10:15, Sala wykł. 2",
      "Analog dziś, 10:00–11:00, Sala wykł. 2",
      "Film w aparacie, 10:30–11:30, Stoiska · Plenum",
    ]);
    expect(within(list).queryByText(/Druk w domu/)).toBeNull();
    expect(within(list).queryByText(/Rejestracja/)).toBeNull();
    expect(within(list).getAllByRole("button", { name: "Do planu" })).toHaveLength(3);
  });

  it("switches the panel to a same-time session when its row is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("1:pt");
    await user.click(screen.getByRole("button", { name: /^Analog dziś,/ }));
    expect(useStore.getState().selectedSessionId).toBe("3:pt");
    expect(screen.getByRole("heading", { name: "Analog dziś" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "W tym samym czasie" })).getByRole("button", { name: /^Światło w portrecie,/ })).toBeTruthy();
  });

  it("renders no same-time section for the touching session's only neighbour being the zone", () => {
    renderDetail("7:sob");
    expect(screen.queryByRole("list", { name: "W tym samym czasie" })).toBeNull();
  });

  it("hides the plan button and every same-time star during a preview and leaves favourites untouched", () => {
    useStore.setState({ previewPlan: ["3:pt"] });
    renderDetail("1:pt");
    expect(screen.queryByRole("button", { name: "Dodaj do planu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Usuń z planu" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Do planu" })).toHaveLength(0);
    expect(within(screen.getByRole("list", { name: "W tym samym czasie" })).getAllByRole("listitem")).toHaveLength(3);
    expect(useStore.getState().favourites).toEqual([]);
  });

  it("links to the festival page", () => {
    renderDetail("1:pt");
    const link = screen.getByRole("link", { name: "Zobacz na stronie festiwalu" });
    expect(link.getAttribute("href")).toBe("https://swiatlosila.pl/cyfrowe-event/swiatlo-w-portrecie/");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("restores focus to the control that opened it when the sheet closes", () => {
    render(
      <DataProvider value={buildAppData(data)}>
        <button type="button">Otwieracz</button>
        <DetailSheet />
      </DataProvider>,
    );
    const opener = screen.getByRole("button", { name: "Otwieracz" });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    act(() => {
      useStore.getState().selectSession("1:pt");
      useStore.getState().setSheet("detail");
    });
    expect(screen.getByRole("heading", { name: "Światło w portrecie" })).toBeTruthy();
    act(() => {
      useStore.getState().setSheet(null);
    });
    expect(document.activeElement).toBe(opener);
  });
});
