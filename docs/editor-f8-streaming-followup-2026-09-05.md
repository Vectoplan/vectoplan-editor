# F8: Nachladen während Kamerabewegung

## Messbefund

Die unveränderten Aufnahmen liegen lokal unter `tmp/editor-f8-perf_ba52a0d399ac40a5.json` und `tmp/editor-f8-perf_ce8b33f775b14caf.json` im Server-Workspace. Beide wurden vor einem weiteren Editor-Neustart gesichert.

| Aufnahme am 5. September 2026 (CEST) | Ø FPS | p95 Bildabstand | längster Bildabstand | geladene Chunks |
| --- | ---: | ---: | ---: | --- |
| 23:33:58 | 33,73 | 93,3 ms | 320 ms | 346 → 611 |
| 23:35:30 | 13,66 | 280,2 ms | 533,4 ms | 1.098 → 1.203 |

Die vorherige Aufnahme mit 0,78 FPS hatte rund 1.407 geladene Chunks. Die unterschiedlichen Datenmengen und Kamerabewegungen erlauben keine isolierte FPS-Zuordnung zur letzten Änderung. Der zweite neue Test belegt weiterhin störende Aussetzer in einer größeren Szene.

24 von 25 langen Browseraufgaben liegen außerhalb der regulären Frame-Callbacks. Die längste Aufgabe dauert 496 ms und enthält mehrere Registry-Scans hintereinander. Geodatenlinien werden achtmal synchronisiert, durchschnittlich 137 ms und maximal 191,5 ms. Sieben dieser Synchronisierungen stimmen zeitlich mit eigenen langen Browseraufgaben überein. Eingabehandler selbst benötigen höchstens 3,1 ms.

Zusätzlich zeigen zwei gültige GPU-Messungen 275 und 232 ms. Deren Ursache lässt sich aus den vorhandenen Daten nicht auf Shader oder Uploads eingrenzen. Die CPU-Optimierungen unten erklären daher keinen vollständigen Wegfall aller GPU-Ausreißer. WorldEdit ist im zweiten Test in allen 205 Frames inaktiv.

## Änderungen

- Geodatenlinien behalten unveränderte Geländeabschnitte und GPU-Geometrien. Eine Änderung der abgefragten Höhen, der Quelldaten oder der Sichtbarkeit invalidiert die betroffenen Daten. Auch bislang fehlende Höhensamples bleiben als Abhängigkeit erfasst.
- Registry-Scans lesen jeden Chunk samt Nachbarn einmal und verwenden bereits vorbereitete Fassadendaten. Neue Revisionen und optimistische Dachänderungen bleiben wirksam.
- Progressive Ladepakete setzen ihre Arbeit nach einem Frame in einem neuen Browser-Task fort. Das gilt auch für sofort verfügbare Quellpakete und fehlgeschlagene Pakete. Ein zwischenzeitlich geänderter Kameraausschnitt wird vom alten Ladevorgang nicht überschrieben.
- `renderOnce` erzeugt während einer laufenden Kamera kein zusätzliches synchrones Bild. Der nächste reguläre Frame stellt Änderungen dar. Angehaltene Vorschauen rendern weiterhin sofort; dieser Pfad wird während F8 mitgemessen.

Laderadius, Datenumfang und Geometriequalität bleiben erhalten.

## Gezielte Prüfung

Mit denselben 96 gespeicherten Berliner Chunks benötigt die Overlay-Aktualisierung einer Revision 2,49 statt 19,94 ms und verwendet alle fünf vorhandenen Geometrien weiter. Alle sechs verglichenen Zustände enthalten exakt dieselben Ergebniszahlen. Der Kaltaufbau war in diesem einzelnen Lauf mit 106,5 statt 79,5 ms langsamer; der belegte Gewinn betrifft das wiederholte Nachladen, nicht den Erstaufbau.

Der Registry-Vergleich mit 35 Scans reduziert Lesezugriffe von 23.520 auf 10.500 und wiederholtes Fassadenparsing von 3.010 auf null nach sechs einmalig vorbereiteten Quellen. Der gemessene Median sinkt von 1,03 auf 0,32 ms bei identischen Revisionsdaten. Auch das ist ein Komponentenvergleich, keine FPS-Prognose.

Neun Overlaytests prüfen unter anderem Höhenänderungen, später vorhandene Samples, geänderte Quellen, Sichtbarkeit und unveränderliche frühere Snapshots. 14 Streamingtests prüfen vollständigen Radius, Teilausfälle, Dachabhängigkeiten, Kamerawechsel und die neue Freigabe zwischen Paketen.

Die echte SceneRuntime-/WebGL-/Worker-Browserfixture besteht sechs Fälle: konkurrierende Revisionen, Nachbarflächen, Gebäudegeometrie samt Mining, vollständig ausbleibende Leerlaufcallbacks sowie 24 zusätzliche Renderanforderungen während laufender Kamera. Letztere ergeben genau ein reguläres Bild; die pausierte Vorschau aktualisiert weiterhin sofort. Keine Nutzerprojektdaten wurden dabei verändert.

Der vollständige `npm run check` einschließlich Typecheck und Produktionsbuild ist erfolgreich. Die drei neuen Registry-/Fassaden-Cachetests sind dauerhaft in `test:lod2-editing` eingebunden (41 Tests grün); der echte Worker-Latenztest ist in `test:construction-worker` enthalten (vier Tests grün). Diese Script-Ergänzungen wurden nach dem vollständigen Check separat ausgeführt. Der normale Git-Whitespace-Check besteht.

Um 23:54 Uhr CEST am 5. September 2026 lokal eingespielt: Produktionsentry `assets/main-BqBUcgjU.js`; der bestehende Worker bleibt `assets/chunk_mesh_worker-BLaVTouE.js`. Alle zwölf Manifest-/Workerdateien antworten mit HTTP 200. Editor und unveränderter Chunk-Dienst melden healthy.

Eine erneute Aufnahme aus der großen authentifizierten Editorszene bleibt zur Bewertung des verbleibenden Ruckelns erforderlich. Der Nutzer wurde um Neuladen, ungefähr eine Minute Nachladen und einen neuen 15-Sekunden-Mitschnitt gebeten. Die beiden bisherigen Aufnahmen bleiben lokal gesichert.
