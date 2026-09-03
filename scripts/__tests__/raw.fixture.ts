import type { RawData, WpEvent, WpSpeaker, WpTerm } from "../lib/api";

const SITE = "https://swiatlosila.pl";
const UPLOADS = `${SITE}/wp-content/uploads/2024/08`;

function term(id: number, slug: string, name: string, count: number, taxonomy: string): WpTerm {
  return { id, slug, name, count, taxonomy };
}

/** A fresh, mutable RawData on every call; tests may edit the result freely. */
export function makeRaw(): RawData {
  const events: WpEvent[] = [
    {
      id: 1001,
      slug: "swiatlo-wstep",
      link: `${SITE}/cyfrowe-event/swiatlo-wstep/`,
      title: { rendered: "Światło &#8211; wstęp" },
      content: {
        rendered:
          "<!-- wp:paragraph -->\n" +
          '<p>10:45-12:00, <a href="https://swiatlosila.pl/cyfrowe-prelegent/jimmy-salatka/" data-type="cyfrowe-prelegent" data-id="134">Biliński Emil</a> ' +
          '<a href="https://www.cyfrowe.pl/swiatlosila-wstep-p.html" data-type="link" data-id="https://www.cyfrowe.pl/swiatlosila-wstep-p.html" target="_blank" rel="noreferrer noopener">Zapisz się</a></p>\n' +
          "<!-- /wp:paragraph -->\n" +
          "<!-- wp:paragraph -->\n" +
          "<p>Opis <strong>prelekcji</strong>.</p>\n" +
          "<!-- /wp:paragraph -->",
      },
      "cyfrowe-event-type": [184],
      "cyfrowe-event-theme": [500],
      "cyfrowe-event-brand": [600],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [53],
      "cyfrowe-event-zapisy": [56],
    },
    {
      id: 1002,
      slug: "rejestracja",
      link: `${SITE}/cyfrowe-event/rejestracja/`,
      title: { rendered: "Rejestracja" },
      content: { rendered: "<p></p>\n<p>09:00-18:00</p>" },
      "cyfrowe-event-type": [242],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [318],
      "cyfrowe-event-day": [18, 53],
      "cyfrowe-event-zapisy": [],
    },
    {
      id: 1003,
      slug: "otwarcie",
      link: `${SITE}/cyfrowe-event/otwarcie/`,
      title: { rendered: "Otwarcie festiwalu" },
      content: { rendered: "<p>09:30, Cyfrowe.pl</p>" },
      "cyfrowe-event-type": [242, 300],
      "cyfrowe-event-theme": [],
      "cyfrowe-event-brand": [],
      "cyfrowe-event-location": [233],
      "cyfrowe-event-day": [276],
      "cyfrowe-event-zapisy": [194],
    },
  ];

  const speakers: WpSpeaker[] = [
    {
      id: 134,
      slug: "emil-bilinski-x",
      link: `${SITE}/cyfrowe-prelegent/emil-bilinski-x/`,
      title: { rendered: "Emil Biliński" },
      content: { rendered: "<p>Bio.</p><p>&#8212;&#8212;&#8212;&#8211;</p><p>Talk.</p>" },
      featured_media: 292,
      "cyfrowe-prelegent-type": [24, 40],
      _embedded: {
        "wp:featuredmedia": [
          {
            source_url: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`,
            media_details: {
              sizes: {
                medium: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto-300x300.jpg`, width: 300, height: 300 },
                thumbnail: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto-150x150.jpg`, width: 150, height: 150 },
                full: { source_url: `${UPLOADS}/600_Bilinski_Emil_profoto.jpg`, width: 600, height: 600 },
              },
            },
          },
        ],
      },
    },
    {
      id: 128,
      slug: "karol-bartnik-2",
      link: `${SITE}/cyfrowe-prelegent/karol-bartnik-2/`,
      title: { rendered: "Karol Bartnik" },
      content: { rendered: "<p>Bio Karola.</p>" },
      featured_media: 0,
      "cyfrowe-prelegent-type": [24],
    },
  ];

  const terms: RawData["terms"] = {
    "cyfrowe-event-type": [
      term(184, "prelekcja", "Prelekcja", 1, "cyfrowe-event-type"),
      term(242, "ogolne", "Ogólne", 2, "cyfrowe-event-type"),
      term(300, "cwiczenia", "Ćwiczenia", 1, "cyfrowe-event-type"),
      term(301, "fotogra", "Fotogra", 0, "cyfrowe-event-type"),
    ],
    "cyfrowe-event-theme": [term(500, "krajobraz", "Krajobraz", 1, "cyfrowe-event-theme")],
    "cyfrowe-event-brand": [term(600, "sony", "Sony", 1, "cyfrowe-event-brand")],
    "cyfrowe-event-location": [
      term(233, "so-salsa-sala-1", "So Salsa - poziom II - Sala wykładowa nr 1", 2, "cyfrowe-event-location"),
      term(318, "rejestracja", "Rejestracja", 1, "cyfrowe-event-location"),
      term(291, "wkrotce", "Wkrótce", 0, "cyfrowe-event-location"),
    ],
    "cyfrowe-event-day": [
      term(276, "czwartek", "⏱️ Czwartek (3 września)", 1, "cyfrowe-event-day"),
      term(18, "sobota", "⏱️ Sobota (5 września)", 1, "cyfrowe-event-day"),
      term(53, "piatek", "⏱️ Piątek (4 września)", 2, "cyfrowe-event-day"),
      term(19, "sobota-7", "⏱️ Sobota (7 września)", 0, "cyfrowe-event-day"),
    ],
    "cyfrowe-event-zapisy": [
      term(56, "zapisy", "Zapisy", 1, "cyfrowe-event-zapisy"),
      term(194, "w-ramach-festiwalu", "W ramach festiwalu", 1, "cyfrowe-event-zapisy"),
      term(327, "brak-miejsc", "Brak miejsc", 0, "cyfrowe-event-zapisy"),
    ],
    "cyfrowe-prelegent-type": [
      term(24, "prelegent", "Prelegent", 2, "cyfrowe-prelegent-type"),
      term(40, "sony", "Sony", 1, "cyfrowe-prelegent-type"),
    ],
  };

  return { events, speakers, terms };
}
