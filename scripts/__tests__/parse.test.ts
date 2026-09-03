// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractAnchors,
  firstParagraph,
  isAllDayEvent,
  isSiteHost,
  paragraphs,
  parseByline,
  parseDay,
  parseTime,
  signupStatusFromTerm,
} from "../lib/parse";
import { stripTags } from "../lib/sanitize";

// Inner HTML of the first paragraph of real events (2026-09-03 snapshot, cyfrowe-event).
const P_39549 =
  '17:00-19:00, Sony <a href="https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_39565 = "13:30, Cyfrowe.pl";
const P_34237 = "19:30";
const P_33705 = "09:30";
const P_46438 =
  '09:15-18:15, <a href="https://swiatlosila.pl/cyfrowe-prelegent/paulina-szmidtka/" target="_blank" rel="noreferrer noopener">Szmidtka Paulina</a> <a href="https://www.cyfrowe.pl/swiatlosila-jeden-na-jeden-mentor-paulina-szmidtka-modelka-adrianna-kusiak-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-jeden-na-jeden-mentor-paulina-szmidtka-modelka-adrianna-kusiak-p.html" target="_blank" rel="noreferrer noopener">Brak miejsc</a>';
const P_46498 =
  '09:30-11:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/michal-leja/" target="_blank" rel="noreferrer noopener">Leja Michał</a> / <a href="https://swiatlosila.pl/cyfrowe-prelegent/filip-kowalkowski/" target="_blank" rel="noreferrer noopener">Kowalkowski Filip</a>';
// Event 39613 is the one whose signup link text reads "Brak Miejsc" with a capital M.
const P_39613 =
  '16:00-18:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/mateusz-was/" target="_blank" rel="noreferrer noopener">Wąs Mateusz MUSTACHE LENS</a> <a href="https://www.cyfrowe.pl/swiatlosila-fotogra-fotospacer-z-mateuszem-wasem-mustache-lens-i-tamron-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-fotogra-fotospacer-z-mateuszem-wasem-mustache-lens-i-tamron-p.html" target="_blank" rel="noreferrer noopener">Brak Miejsc</a>';
const P_41152 =
  '09:30-16:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/jakub-kazmierczyk/" data-type="cyfrowe-prelegent" data-id="46589">Kaźmierczyk Jakub</a> <a href="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-wejdz-do-swiata-blysku-z-jakubem-kazmierczykiem-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-wejdz-do-swiata-blysku-z-jakubem-kazmierczykiem-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_41154 =
  '11:00-16:15, <a href="https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/" data-type="cyfrowe-event" data-id="41154">Blank Filip</a> <a href="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a>';
const P_39590 =
  '09:30-10:30, <a href="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" data-type="link" data-id="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/">Bartnik Karol</a>';
const P_46722 = "13:00-14:30, Sorger Fabian";

// Complete content.rendered of two real events.
const CONTENT_33705 = "\n<p>09:30</p>\n\n\n\n<p></p>\n";
const CONTENT_39549 = "\n<p>" + P_39549 + "</p>\n\n\n\n<p></p>\n\n\n\n<p></p>\n\n\n\n<p></p>\n";

describe("paragraphs", () => {
  it("returns the inner HTML of every <p> in order", () => {
    expect(paragraphs(CONTENT_33705)).toEqual(["09:30", ""]);
    expect(paragraphs(CONTENT_39549)).toEqual([P_39549, "", "", ""]);
  });

  it("removes WordPress block comments and tolerates attributes on <p>", () => {
    expect(paragraphs('<!-- wp:paragraph -->\n<p class="a">x</p>\n<!-- /wp:paragraph --><P style="b">y</P>')).toEqual(["x", "y"]);
  });

  it("returns an empty list without paragraphs", () => {
    expect(paragraphs("")).toEqual([]);
    expect(paragraphs("<div>no p</div>")).toEqual([]);
  });
});

describe("firstParagraph", () => {
  it("returns the first paragraph of a real event", () => {
    expect(firstParagraph(CONTENT_33705)).toBe("09:30");
    expect(firstParagraph(CONTENT_39549)).toBe(P_39549);
  });

  it("skips blank leading paragraphs", () => {
    expect(firstParagraph("<p></p>\n<p> </p>\n<p>&nbsp;</p>\n<p><br></p>\n<p>13:30, Cyfrowe.pl</p>")).toBe("13:30, Cyfrowe.pl");
  });

  it("returns an empty string when every paragraph is blank", () => {
    expect(firstParagraph("<p></p><p>&nbsp;</p>")).toBe("");
    expect(firstParagraph("")).toBe("");
  });
});

describe("parseTime on real first paragraphs", () => {
  it("parses 17:00-19:00 with a signup link (39549)", () => {
    expect(parseTime(stripTags(P_39549))).toEqual({ start: 1020, end: 1140, timeText: "17:00-19:00", endDiscarded: false });
  });

  it("parses the point events 13:30 (39565), 19:30 (34237) and 09:30 (33705)", () => {
    expect(parseTime(stripTags(P_39565))).toEqual({ start: 810, end: null, timeText: "13:30", endDiscarded: false });
    expect(parseTime(stripTags(P_34237))).toEqual({ start: 1170, end: null, timeText: "19:30", endDiscarded: false });
    expect(parseTime(stripTags(P_33705))).toEqual({ start: 570, end: null, timeText: "09:30", endDiscarded: false });
  });

  it("parses the long workshop 09:15-18:15 (46438) and 09:30-11:30 (46498)", () => {
    expect(parseTime(stripTags(P_46438))).toEqual({ start: 555, end: 1095, timeText: "09:15-18:15", endDiscarded: false });
    expect(parseTime(stripTags(P_46498))).toEqual({ start: 570, end: 690, timeText: "09:30-11:30", endDiscarded: false });
  });

  it("parses 16:00-18:00 of the Brak Miejsc event (39613)", () => {
    expect(parseTime(stripTags(P_39613))).toEqual({ start: 960, end: 1080, timeText: "16:00-18:00", endDiscarded: false });
  });
});

describe("parseTime variants", () => {
  it("accepts en dash, em dash, spaces around the dash and a dot separator", () => {
    expect(parseTime("09:30 – 10:30, Sony")).toEqual({ start: 570, end: 630, timeText: "09:30 – 10:30", endDiscarded: false });
    expect(parseTime("09:30—10:30")).toEqual({ start: 570, end: 630, timeText: "09:30—10:30", endDiscarded: false });
    expect(parseTime("9.30 - 10.45")).toEqual({ start: 570, end: 645, timeText: "9.30 - 10.45", endDiscarded: false });
  });

  it("discards an end that is not after the start and flags it", () => {
    expect(parseTime("10:00-10:00, x")).toEqual({ start: 600, end: null, timeText: "10:00-10:00", endDiscarded: true });
    expect(parseTime("10:00-09:30")).toEqual({ start: 600, end: null, timeText: "10:00-09:30", endDiscarded: true });
  });

  it("treats hours over 23 or minutes over 59 as unparseable", () => {
    const none = { start: null, end: null, timeText: "", endDiscarded: false };
    expect(parseTime("24:00-25:00")).toEqual(none);
    expect(parseTime("09:60")).toEqual(none);
    expect(parseTime("09:00-10:75")).toEqual(none);
  });

  it("gives null start, null end and an empty timeText without a leading time", () => {
    const none = { start: null, end: null, timeText: "", endDiscarded: false };
    expect(parseTime("Prelekcja o 10:00")).toEqual(none);
    expect(parseTime("")).toEqual(none);
    expect(parseTime("Sorger Fabian")).toEqual(none);
  });

  it("accepts midnight and 23:59", () => {
    expect(parseTime("00:00-23:59")).toEqual({ start: 0, end: 1439, timeText: "00:00-23:59", endDiscarded: false });
  });
});

describe("extractAnchors", () => {
  it("reads the signup anchor of 39549 with its host", () => {
    expect(extractAnchors(P_39549)).toEqual([
      {
        href: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
        text: "Zapisz się",
        dataType: "link",
        dataId: "https://www.cyfrowe.pl/swiatlosila-fotogra-before-fotospacer-colour-hunting-z-sony-p.html",
        host: "www.cyfrowe.pl",
      },
    ]);
  });

  it("reads two speaker anchors without data attributes (46498)", () => {
    expect(extractAnchors(P_46498)).toEqual([
      { href: "https://swiatlosila.pl/cyfrowe-prelegent/michal-leja/", text: "Leja Michał", dataType: null, dataId: null, host: "swiatlosila.pl" },
      { href: "https://swiatlosila.pl/cyfrowe-prelegent/filip-kowalkowski/", text: "Kowalkowski Filip", dataType: null, dataId: null, host: "swiatlosila.pl" },
    ]);
  });

  it("reads a speaker anchor followed by a signup anchor (39613) in document order", () => {
    const anchors = extractAnchors(P_39613);
    expect(anchors.map((a) => a.text)).toEqual(["Wąs Mateusz MUSTACHE LENS", "Brak Miejsc"]);
    expect(anchors.map((a) => a.host)).toEqual(["swiatlosila.pl", "www.cyfrowe.pl"]);
  });

  it("reads data-type and a numeric data-id (41152)", () => {
    const [speaker] = extractAnchors(P_41152);
    expect(speaker).toEqual({
      href: "https://swiatlosila.pl/cyfrowe-prelegent/jakub-kazmierczyk/",
      text: "Kaźmierczyk Jakub",
      dataType: "cyfrowe-prelegent",
      dataId: "46589",
      host: "swiatlosila.pl",
    });
  });

  it("reads the event-page anchor of 41154 and the URL data-id of 39590 verbatim", () => {
    const [eventAnchor] = extractAnchors(P_41154);
    expect(eventAnchor).toEqual({
      href: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/",
      text: "Blank Filip",
      dataType: "cyfrowe-event",
      dataId: "41154",
      host: "swiatlosila.pl",
    });
    expect(extractAnchors(P_39590)).toEqual([
      {
        href: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        text: "Bartnik Karol",
        dataType: "link",
        dataId: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        host: "swiatlosila.pl",
      },
    ]);
  });

  it("strips tags and decodes entities inside the anchor text", () => {
    expect(extractAnchors('<a href="https://swiatlosila.pl/x/">Wąs <strong>Mateusz</strong>&nbsp;&#8211; M</a>')[0]?.text).toBe("Wąs Mateusz – M");
  });

  it("gives an empty href and host to an anchor without href or with a relative one", () => {
    expect(extractAnchors('<a name="top">x</a><a href="/relative/">y</a>')).toEqual([
      { href: "", text: "x", dataType: null, dataId: null, host: "" },
      { href: "/relative/", text: "y", dataType: null, dataId: null, host: "" },
    ]);
  });

  it("returns an empty list without anchors", () => {
    expect(extractAnchors(P_39565)).toEqual([]);
    expect(extractAnchors(P_46722)).toEqual([]);
  });
});

describe("isSiteHost", () => {
  it("accepts swiatlosila.pl with or without www, in any case", () => {
    expect(isSiteHost("swiatlosila.pl")).toBe(true);
    expect(isSiteHost("www.swiatlosila.pl")).toBe(true);
    expect(isSiteHost("SWIATLOSILA.PL")).toBe(true);
  });

  it("rejects cyfrowe.pl, an empty host and look-alike hosts", () => {
    expect(isSiteHost("www.cyfrowe.pl")).toBe(false);
    expect(isSiteHost("")).toBe(false);
    expect(isSiteHost("swiatlosila.pl.evil.com")).toBe(false);
  });
});

describe("parseByline (spec §4.2 examples)", () => {
  it("keeps the brand name Sony after removing the time and the signup text (39549)", () => {
    expect(parseByline(stripTags(P_39549), "17:00-19:00", ["Zapisz się"])).toBe("Sony");
  });

  it("is null when only a speaker and a signup link remain (39613)", () => {
    expect(parseByline(stripTags(P_39613), "16:00-18:00", ["Brak Miejsc", "Wąs Mateusz MUSTACHE LENS"])).toBeNull();
  });

  it("keeps Cyfrowe.pl after a point time (39565)", () => {
    expect(parseByline(stripTags(P_39565), "13:30", [])).toBe("Cyfrowe.pl");
  });

  it("is null when two speakers separated by a slash are removed (46498)", () => {
    expect(parseByline(stripTags(P_46498), "09:30-11:30", ["Leja Michał", "Kowalkowski Filip"])).toBeNull();
  });

  it("keeps a plain surname-first name (46722)", () => {
    expect(parseByline(stripTags(P_46722), "13:00-14:30", [])).toBe("Sorger Fabian");
  });

  it("keeps the text of an unresolved anchor and drops the separators around it", () => {
    expect(parseByline("09:30-10:30, Nowak Jan / Kowalski Adam", "09:30-10:30", ["Kowalski Adam"])).toBe("Nowak Jan");
    expect(parseByline("09:30-10:30, Kowalski Adam / Nowak Jan", "09:30-10:30", ["Kowalski Adam"])).toBe("Nowak Jan");
  });

  it("collapses internal whitespace and works without a time", () => {
    expect(parseByline("10:00-11:00,   Sony   Polska ", "10:00-11:00", [])).toBe("Sony Polska");
    expect(parseByline("Sorger Fabian", "", [])).toBe("Sorger Fabian");
    expect(parseByline("", "", [])).toBeNull();
  });
});

describe("signupStatusFromTerm", () => {
  it("maps every cyfrowe-event-zapisy term name", () => {
    expect(signupStatusFromTerm("Zapisy")).toBe("open");
    expect(signupStatusFromTerm("Brak miejsc")).toBe("full");
    expect(signupStatusFromTerm("W ramach festiwalu")).toBe("included");
    expect(signupStatusFromTerm("WSTĘP WOLNY")).toBe("free");
    expect(signupStatusFromTerm("Zapisy wkrótce")).toBe("soon");
  });

  it("is unknown without a term or with an unexpected name", () => {
    expect(signupStatusFromTerm(undefined)).toBe("unknown");
    expect(signupStatusFromTerm("Inne")).toBe("unknown");
  });
});

describe("parseDay", () => {
  it("parses the three day terms in use", () => {
    expect(parseDay("⏱️ Czwartek (3 września)", 2026)).toEqual({ id: "czw", label: "Czwartek", short: "Czw", labelLong: "Czwartek, 3 września", date: "2026-09-03" });
    expect(parseDay("⏱️ Piątek (4 września)", 2026)).toEqual({ id: "pt", label: "Piątek", short: "Pt", labelLong: "Piątek, 4 września", date: "2026-09-04" });
    expect(parseDay("⏱️ Sobota (5 września)", 2026)).toEqual({ id: "sob", label: "Sobota", short: "Sob", labelLong: "Sobota, 5 września", date: "2026-09-05" });
  });

  it("parses the unused terms and two-digit days", () => {
    expect(parseDay("⏱️ Sobota (13 września)", 2026)?.date).toBe("2026-09-13");
    expect(parseDay("⏱️ Sobota (7 września)", 2026)?.date).toBe("2026-09-07");
  });

  it("maps every weekday to its id and short code", () => {
    expect(parseDay("Niedziela (6 września)", 2026)).toEqual({ id: "nd", label: "Niedziela", short: "Nd", labelLong: "Niedziela, 6 września", date: "2026-09-06" });
    expect(parseDay("Poniedziałek (7 września)", 2026)).toEqual({ id: "pon", label: "Poniedziałek", short: "Pon", labelLong: "Poniedziałek, 7 września", date: "2026-09-07" });
    expect(parseDay("Wtorek (8 września)", 2026)).toEqual({ id: "wt", label: "Wtorek", short: "Wt", labelLong: "Wtorek, 8 września", date: "2026-09-08" });
    expect(parseDay("Środa (9 września)", 2026)).toEqual({ id: "sr", label: "Środa", short: "Śr", labelLong: "Środa, 9 września", date: "2026-09-09" });
  });

  it("maps other genitive month names and takes the year from the argument", () => {
    expect(parseDay("Piątek (30 października)", 2027)?.date).toBe("2027-10-30");
    expect(parseDay("Sobota (1 lutego)", 2026)?.date).toBe("2026-02-01");
  });

  it("returns null without a weekday, without a date or with an unknown month", () => {
    expect(parseDay("Sesja specjalna", 2026)).toBeNull();
    expect(parseDay("Piątek", 2026)).toBeNull();
    expect(parseDay("Piątek (4 wrzesnia)", 2026)).toBeNull();
  });
});

describe("isAllDayEvent", () => {
  it("marks a 09:00-18:00 Ogólne session", () => {
    expect(isAllDayEvent(540, 1080, ["ogolne"])).toBe(true);
  });

  it("does not mark a 09:30-16:00 or an exactly 300-minute Warsztaty session", () => {
    expect(isAllDayEvent(570, 960, ["warsztaty"])).toBe(false);
    expect(isAllDayEvent(570, 870, ["warsztaty"])).toBe(false);
  });

  it("does not mark a 09:30 Ogólne point session or a session without a time", () => {
    expect(isAllDayEvent(570, null, ["ogolne"])).toBe(false);
    expect(isAllDayEvent(null, null, ["ogolne"])).toBe(false);
  });

  it("marks a 09:30-18:00 session typed Ogólne and STREFA TELEOBIEKTYWÓW, in any order", () => {
    expect(isAllDayEvent(570, 1080, ["strefa-teleobiektywow", "ogolne"])).toBe(true);
    expect(isAllDayEvent(570, 1080, ["ogolne", "strefa-teleobiektywow"])).toBe(true);
  });

  it("uses 300 minutes as the inclusive threshold", () => {
    expect(isAllDayEvent(540, 840, ["ogolne"])).toBe(true);
    expect(isAllDayEvent(540, 839, ["ogolne"])).toBe(false);
  });
});
