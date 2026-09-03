// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Speaker } from "../../src/data/types";
import type { Anchor } from "../lib/parse";
import { buildSpeakerLookup, resolveSpeaker } from "../lib/speakers";

function speaker(id: number, slug: string, name: string): Speaker {
  return {
    id,
    slug,
    name,
    photo: null,
    photoThumb: null,
    bioHtml: "",
    url: `https://swiatlosila.pl/cyfrowe-prelegent/${slug}/`,
    brands: [],
  };
}

// Real ids, slugs and names from the 2026-09-03 snapshot (speakers-embed-p*.json).
const SPEAKERS: Speaker[] = [
  speaker(134, "emil-bilinski-x", "Emil Biliński"),
  speaker(128, "karol-bartnik-2", "Karol Bartnik"),
  speaker(293, "filip-blank", "Filip Blank"),
  speaker(46702, "tomasz-zieniu-zienkiewicz-2", "Tomasz ZIENIU Zienkiewicz"),
  speaker(46570, "danaj-katarzyna-budziszyna", "Katarzyna Danaj BUDZISZYNA"),
  speaker(339, "michal-leja", "Michał Leja"),
  speaker(329, "klikfilm-kuba", "KLIK FILM – Jakub Urban"),
  speaker(496, "klik-film-oskar-rak", "KLIK FILM – Oskar Rak"),
];

function anchor(fields: {
  href: string;
  text: string;
  dataType?: string | null;
  dataId?: string | null;
}): Anchor {
  return {
    href: fields.href,
    text: fields.text,
    dataType: fields.dataType ?? null,
    dataId: fields.dataId ?? null,
    host: new URL(fields.href).host,
  };
}

const lookup = buildSpeakerLookup(SPEAKERS);

describe("buildSpeakerLookup", () => {
  it("indexes speakers by slug, by id and by name tokens", () => {
    expect(lookup.bySlug.get("filip-blank")?.id).toBe(293);
    expect(lookup.byId.get(134)?.name).toBe("Emil Biliński");
    const leja = lookup.byTokens.find((entry) => entry.speaker.id === 339);
    expect(leja?.tokens).toEqual(new Set(["michal", "leja"]));
  });
});

describe("resolveSpeaker", () => {
  it("resolves the stale jimmy-salatka slug to 134 Emil Biliński by name", () => {
    // event 46502: <a href="https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/" data-type="cyfrowe-prelegent" data-id="134">Biliński Emil</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/",
        text: "Biliński Emil",
        dataType: "cyfrowe-prelegent",
        dataId: "134",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(134);
    expect(result?.speaker.name).toBe("Emil Biliński");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 39590 anchor (data-type link, URL in data-id) to 128 Karol Bartnik by name", () => {
    // event 39590: <a href="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" data-type="link" data-id="https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/" target="_blank" rel="noreferrer noopener">Bartnik Karol</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
        text: "Bartnik Karol",
        dataType: "link",
        dataId: "https://swiatlosila.pl/cyfrowe-prelegent/zenon-wujtaszek/",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(128);
    expect(result?.speaker.name).toBe("Karol Bartnik");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 41154 self-link 'Blank Filip' to 293 Filip Blank by name", () => {
    // event 41154: <a href="https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/" data-type="cyfrowe-event" data-id="41154">Blank Filip</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-event/warsztaty-masterclass-fotografia-motoryzacyjna-z-filipem-blankiem/",
        text: "Blank Filip",
        dataType: "cyfrowe-event",
        dataId: "41154",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(293);
    expect(result?.speaker.name).toBe("Filip Blank");
    expect(result?.tier).toBe("name");
  });

  it("resolves the event 46769 anchor by slug and ignores its wrong data-id 46570", () => {
    // event 46769: <a href="https://swiatlosila.pl/cyfrowe-prelegent/tomasz-zieniu-zienkiewicz-2/" data-type="cyfrowe-prelegent" data-id="46570" target="_blank" rel="noreferrer noopener">Tomasz ZIENIU Zienkiewicz</a>
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/tomasz-zieniu-zienkiewicz-2/",
        text: "Tomasz ZIENIU Zienkiewicz",
        dataType: "cyfrowe-prelegent",
        dataId: "46570",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(46702);
    expect(result?.speaker.id).not.toBe(46570);
    expect(result?.tier).toBe("slug");
  });

  it("matches 'Leja Michal' to 'Michał Leja' when the slug is stale", () => {
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/leja-michal-stary/",
        text: "Leja Michal",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(339);
    expect(result?.speaker.name).toBe("Michał Leja");
    expect(result?.tier).toBe("name");
  });

  it("falls back to a numeric data-id when the slug is stale and the text is ambiguous", () => {
    // "KLIK FILM" is contained in two speaker names (329 and 496), so the name tier fails.
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
        text: "KLIK FILM",
        dataType: "cyfrowe-prelegent",
        dataId: "496",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(496);
    expect(result?.speaker.name).toBe("KLIK FILM – Oskar Rak");
    expect(result?.tier).toBe("data-id");
  });

  it("stays unresolved when the text is ambiguous and there is no usable data-id", () => {
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
          text: "KLIK FILM",
        }),
        lookup,
      ),
    ).toBeNull();
    // A data-id that is not numeric or not typed cyfrowe-prelegent is not consulted either.
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/klik-film/",
          text: "KLIK FILM",
          dataType: "link",
          dataId: "496",
        }),
        lookup,
      ),
    ).toBeNull();
  });

  it("never applies the containment rule to a single-token anchor", () => {
    expect(
      resolveSpeaker(
        anchor({
          href: "https://swiatlosila.pl/cyfrowe-prelegent/nieznany/",
          text: "Bartnik",
        }),
        lookup,
      ),
    ).toBeNull();
  });

  it("decodes entities in the anchor text before tokenizing", () => {
    const result = resolveSpeaker(
      anchor({
        href: "https://swiatlosila.pl/cyfrowe-prelegent/nieznany/",
        text: "Bili&#x144;ski Emil",
      }),
      lookup,
    );
    expect(result?.speaker.id).toBe(134);
    expect(result?.tier).toBe("name");
  });
});
