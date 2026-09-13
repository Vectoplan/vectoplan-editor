# Geschosse, WorldEdit und CAD – 6. September 2026

## Messgrundlage

Die drei F8-Aufnahmen des Nutzers wurden vor einem Neustart des Editors als
JSON unter `vectoplan-server/tmp/editor-f8-perf_<id>.json` gesichert. Die
Auswertung steht dort in `editor-f8-analysis-20260906.json`; das zugehörige
Skript heißt `analyze-f8-20260906.mjs`.

| Aufnahme | Eingang (CEST) | Mittlere FPS | Frame p95 / Maximum | Geladene Chunks, Anfang → Ende | Mittlere Draw Calls |
| --- | --- | --- | --- | --- | --- |
| `144db56999804677` | 09:07:06 | 15,17 | 200 / 280,1 ms | 685 → 787 | 973 |
| `a6f381ae2aa74262` | 09:07:29 | 21,20 | 93,4 / 426,6 ms | 918 → 987 | 1.213 |
| `eec18e0c2876419b` | 09:09:02 | 6,88 | 493,4 / 893,6 ms | 1.269 → 1.297 | 2.541 |

Im zweiten Test war das Geschosswerkzeug aktiv, im ersten und letzten meldete
der Recorder kein aktives WorldEdit-Werkzeug. Der letzte Test wurde laut
Nutzer nach Linienbrush aufgenommen. Die Szenen waren unterschiedlich weit
geladen; die drei FPS-Werte sind deshalb kein kontrollierter Vorher/Nachher-
Vergleich.

Die Eingabehandler selbst benötigten im p95 nur 0,1–0,3 ms. Im letzten Test
verzögerte sich die Verarbeitung/Darstellung einzelner Eingaben dagegen bis
896 ms. Die gemessenen GPU-Zeiten lagen dort im Mittel bei 83,5 ms; 15 lange
Browser-Tasks belegten zusammen 4.212 ms. Nur etwa 81 ms dieser Tasks fallen
in die bisher instrumentierten Frame-CPU-Abschnitte. Diese Aufnahmen belegen
starke Unterbrechungen, aber nicht allein deren vollständige Ursache.

Die Anzahl der GPU-Geometrien stieg im letzten Test von 4.849 auf 6.302.
Da der alte Recorder keinen verbleibenden Entwurf bzw. Generierungsstatus
erfasste, lässt sich daraus kein bestimmtes Vorschau-Speicherleck ableiten.
Neue F8-Aufnahmen enthalten zusätzlich diese WorldEdit-Zustände.

## Änderungen am Editor

- Chunk-Listen behalten eine unveränderliche, sortierte Momentaufnahme, bis
  sich ihre Mitgliedschaft tatsächlich ändert. Inhaltsrevisionen und wiederholt
  gesetzte Sichtbarkeit erzeugen keine neuen vollständigen Listen.
- Das Beenden einer Linienbrush-Mausinteraktion baut die Vorschau nur nach
  einer tatsächlichen Punkt-/Verschiebegeste neu auf. Ein bloßer Klick auf eine
  Einstellung oder das Verlassen des Werkzeugs löst keinen solchen Neubau aus.
- Ein sauber beendeter Entwurf beendet auch die Überwachung der Ersatzgeometrie.
  Während einer laufenden Generierung bleibt dieselbe Vorschau bestehen; die
  Suche nach der fertigen Geometrie erfolgt begrenzt statt in jedem Frame.
- Unveränderte Geschossgeometrie wird auch für gewöhnliche Linienbrush-Gebäude
  wiederverwendet.
- Die aufwendigen Inventar-Diagnosewerte werden je Store und unverändertem
  Inventory-/Library-Teilbaum wiederverwendet. Mit dem tatsächlich geladenen
  Inventar sinken gewöhnliche Chunk-Commits im isolierten Vergleich von
  5,300 auf 0,0082 ms pro Aufruf. Lebenszyklus, Auswahl, Flags und Zeitstempel
  werden weiterhin aktuell ausgewertet. Drei Regressionstests prüfen auch die
  Invalidierung nach geänderten Bibliotheksdaten.
- Der Standard beträgt 3,0 m pro Geschoss. Gleichmäßige alte 2,645-m-Profile
  werden beim Bearbeiten umgestellt; individuell verschobene Geschossgrenzen
  und importierte LoD2-Traufhöhen bleiben erhalten. Decken bleiben eigene
  Bauelemente.

## Bisherige Prüfungen

- Isolierter Vergleich mit 1.300 Chunks und 600 Listenabfragen: rund
  376,7 → 2,0 ms; gleiche sortierte Schlüssel, alte Momentaufnahmen bleiben
  unverändert. Das ist eine Messung dieses Teilpfades, keine FPS-Prognose.
- 16 Chunk-Streaming-/Registry-Tests bestanden: Sichtbarkeit, Eviction,
  Fehlerzustände, Revisionen und Abbruch laufender Ladevorgänge.
- Browserprüfung mit echtem WebGL/Worker: sechs Szenarien bestanden,
  einschließlich Revisionsrennen, Nachbarflächen, Konstruktionselementen,
  Worker-Fortschritt ohne Idle-Callbacks und Zusammenfassung mehrfacher
  Render-Anforderungen auf den regulären Frame.
- Echter WorldEdit-Controller mit Berliner Gebäudefixture: sauberes Beenden
  ohne Szenenscan, Erhalt derselben Vorschaugeometrie bei laufender Speicherung,
  Ende der Überwachung nach Übergabe und Schließen nach Bestätigung.
- Fehlerfälle behalten den Entwurf: ungültige Daten, Konflikt/erneuter Versuch,
  verlorene Antwort mit Receipt, langsamer CAD-Aufruf und verspätete Antwort
  einer älteren Generierung.

## Chunk-Berechnung und Core/CAD

Der historische Befehl 1066 benötigte laut Datenbank 43,77 Sekunden. Der
kontrollierte Replay derselben 6→10-Geschoss-Payload fällt von 36,89 auf
9,14 Sekunden (ein weiterer Lauf: 8,59 s). Koordinatenindizes ersetzen
wiederholte Eigentümervergleiche; batchlokale Caches vermeiden wiederholtes
Einlesen, Validieren und Schreiben derselben Chunks. Die Geometrie sämtlicher
zehn Chunks bleibt exakt gleich: 23 aktive Objekte und 145 Audit-Ereignisse.
75 unterschiedliche gezielte Tests bestanden. Der gesonderte HTTP-Test mit
langem vollständigem Startup-Audit wurde abgebrochen und ausgeschlossen.
Details und Rollback-Benchmark stehen in
`vectoplan-chunk/docs/STOREY_BATCH_PERFORMANCE_2026_09_06.md`.

Core übernimmt die aktuelle Weltgeometrie als kompakten Kontext. CAD stellt
Gebäude, Dachkonturen, Flurstücke, Straßen und Bäume unabhängig vom Geschoss-
Schnitt dar. Dieser Umgebungskontext ist gegen versehentliche CAD-Bearbeitung
geschützt; vorhandene eigene CAD-Konstruktionen behalten den bisherigen
Core-Commandpfad. Der Vergleich mit den Berliner Projektdaten sinkt von
17,678 s Abruf + 13,128 s Rekonstruktion auf 1,472 s kalten Abruf + 0,169 s
Core-Konvertierung. 39 Core- und 59 CAD-Tests sowie die Browserprüfung mit
68 SVG-Primitiven bestanden. Details: `vectoplan-core/docs/world-context-cad.md`.

Diese Teilmessungen ersetzen keinen neuen kontrollierten FPS-Vergleich der
vollständig geladenen Benutzerszene. Die zusätzliche native Chrome-Prüfung
wurde von Computer Use beendet, weil die aktuelle URL nicht sicher ermittelt
werden konnte. Die isolierten Browserprüfungen verwendeten die produktiven
Controller beziehungsweise CAD-Dateien und eine Kopie echter Projektdaten.

## Prüfung nach Bereitstellung

Editor, Chunk, Core und CAD wurden lokal neu gebaut und gestartet. Ihre
Readiness-Endpunkte antworten mit HTTP 200. Der ausgelieferte Editor-Einstieg
ist `assets/main-CDrimefx.js` (ebenfalls HTTP 200).

Ein erneuter Rollback-Benchmark direkt mit dem ausgelieferten Chunk-Code
misst 9,376 s für dieselbe 6→10-Ersetzung. Er bestätigt erneut 23 aktive
Objekte, zehn Chunks, 9.762 betroffene Zellen und 145 Ereignisse. Die
Benutzerszene wurde für diesen Test nicht verändert.

Der vollständige erste CAD-Abruf zeigte nach der ersten Bereitstellung noch
22,795 s. Die verbleibende Bremse war der Abruf der Benutzerbauteile:
historische Command-Payloads wurden für viele Ereignisse wiederholt geladen.
Der neue Lesepfad übernimmt gezielt die benötigten JSON-Felder und lädt jeden
Befehl nur einmal je Seite. 3.581 Placements einschließlich ihrer Footprints,
Pagination, Fingerprint und Koordinaten bleiben exakt gleich. Die Datenbank-
Payload sinkt von 199,7 auf 13,0 MB. 18 gezielte Tests und ein unabhängiger
Vergleich mit 144 Semantikfällen bestanden.

Nach erneutem Chunk-Build und Neustart dauert der vollständige CAD-Abruf mit
einem neuen Projektionsschlüssel 7,478 s (cacheHit=false). Der Folgeabruf liegt
bei 0,625 s (cacheHit=true). Beide liefern dieselben 62 Kontextelemente in allen
sechs Ebenen und keine Kontextfehler. Das sind Ende-zu-Ende-API-Zeiten; die
oben genannten kleineren Werte messen nur den kompakten Kontext-Teilpfad.
Protokoll: `tmp/cad-projection-final-live-20260906.log`.
