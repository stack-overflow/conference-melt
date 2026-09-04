# ŚwiatłoSiła 2026 · harmonogram

Interaktywna przeglądarka programu festiwalu [ŚwiatłoSiła 2026](https://swiatlosila.pl/harmonogram-2026/): siatka z wykrywaniem slotów czasowych, lista, osobisty plan z wykrywaniem konfliktów, filtry, wyszukiwarka i tryb ciemny/jasny. Wszystko działa w przeglądarce, bez serwera, kont i statystyk. Dane to migawka pobrana skryptem, nie synchronizacja na żywo.

## Skrypty npm

| polecenie | co robi |
|---|---|
| `npm run dev` | serwer deweloperski Vite z przeładowaniem na żywo |
| `npm run build` | buduje jeden samowystarczalny plik `dist/index.html` |
| `npm run preview` | serwuje zbudowany plik lokalnie |
| `npm test` | uruchamia wszystkie testy Vitest raz |
| `npm run test:watch` | testy w trybie ciągłym |
| `npm run typecheck` | sprawdza typy TypeScript (aplikacja i skrypty) |
| `npm run tokens` | sprawdza, czy każde `var(--nazwa)` w CSS jest zdefiniowane w `src/styles/tokens.css` |
| `npm run fetch` | pobiera aktualny program z API festiwalu do `src/data/schedule.json` |
| `npm run size` | sprawdza, czy `dist/index.html` mieści się w 1,5 MB |
| `npm run check` | typecheck, tokens, testy, build i rozmiar, jedno po drugim |

Wymagany Node 20 lub nowszy.

## Odświeżanie danych

```sh
npm run fetch
```

Skrypt pobiera wydarzenia, taksonomie i prelegentów z WordPress REST API strony festiwalu, normalizuje je (godziny z treści, prelegenci z linków, sale, statusy zapisów, strefy całodniowe) i zapisuje `src/data/schedule.json` w stałej kolejności, więc kolejne uruchomienia dają małe diffy. Na końcu wypisuje podsumowanie: liczbę wydarzeń na dzień i ostrzeżenia (wydarzenia bez godziny, nierozpoznani prelegenci, sale spoza mapy skrótów itd.). Przy błędzie sieci nic nie jest zapisywane.

```sh
npm run fetch -- --fixtures
```

Dodatkowo zapisuje fixture'y testowe `src/test/fixtures/slot-sets.json` i `src/test/fixtures/fri-lectures.json`. Testy wykrywania slotów są przypięte do tych plików; jeśli po odświeżeniu zmienią się liczby w tabeli kalibracyjnej w specyfikacji (`docs/superpowers/specs/2026-09-03-schedule-viewer-design.md`, sekcja 5.2), zaktualizuj tabelę w tym samym commicie.

Po `npm run fetch` uruchom `npm run check`, a potem `npm run build`, żeby nowy program trafił do `dist/index.html`.

## Otwieranie z dysku

`dist/index.html` jest jednym plikiem: skrypty, style i dane są w nim osadzone. Wystarczy otworzyć go w Chrome, Safari lub Firefoksie z dysku (`file://`). Zdjęcia prelegentów są ładowane ze strony festiwalu, więc bez internetu pokazują się inicjały.

Ulubione, ustawienia widoku i ostatni widok zapisują się w `localStorage` przeglądarki pod kluczem `swiatlosila-2026:v1`. Dzień i widok są też w adresie (`#d=pt&v=grid`), więc zakładki działają.

## Podgląd innej godziny

Dodaj `?now=` do adresu, np.:

```
dist/index.html?now=2026-09-04T10:30
```

Aplikacja zachowa się tak, jakby był piątek 4 września, 10:30 czasu lokalnego: pokaże chip „Teraz”, linię bieżącej godziny, karty „trwa”, „wkrótce” i wyszarzone minione. Zegar od tej chwili idzie dalej. Wartość bez strefy czasowej jest lokalna; sama data (`?now=2026-09-05`) oznacza północ lokalną. Niepoprawna wartość jest ignorowana.

## Udostępnianie planu

„Udostępnij” w widoku Mój plan kopiuje link `#d=<dzień>&v=plan&plan=<kod>` z całym planem. Link działa tylko wtedy, gdy odbiorca otworzy tę samą aplikację pod tym samym adresem. Z pliku otwartego z dysku powstaje adres `file://…`, który zadziała wyłącznie u osób z tym samym plikiem w tej samej ścieżce. Aby dzielić się planem, opublikuj `dist/index.html` na dowolnym hostingu statycznym pod adresem http(s), na przykład GitHub Pages, Netlify albo zwykły katalog na serwerze WWW. Nie jest potrzebne nic poza jednym plikiem.

---

## English

A client-side schedule viewer for the ŚwiatłoSiła 2026 photography festival: a grid with automatic time-slot detection (a slot table when the visible sessions share regular start times, a proportional timeline otherwise), a list view, a personal plan with conflict detection, facets, search and dark/light themes. No server, no accounts, no analytics; the data is a snapshot.

- `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:watch`, `npm run typecheck`, `npm run tokens`, `npm run size`, `npm run check` (all of the above in sequence). Node 20+.
- `npm run fetch` refreshes `src/data/schedule.json` from the festival's WordPress REST API and prints per-day counts and warnings; `npm run fetch -- --fixtures` also regenerates the committed test fixtures.
- `dist/index.html` is a single self-contained file that opens straight from disk. Favourites and settings persist in `localStorage`; day and view live in the URL hash.
- Append `?now=2026-09-04T10:30` to preview the live states at a chosen local time.
- Share links encode the whole plan in the hash and need the app to be hosted on an http(s) URL; a `file://` link only works for people with the same file at the same path.
