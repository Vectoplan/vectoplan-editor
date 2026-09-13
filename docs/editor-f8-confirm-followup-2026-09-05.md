# Bestätigen und F8-Aussetzer – 5. September 2026

## Bestätigen

Die bisherige Bestätigung schloss das Linienbrush-Panel erst nach vollständiger Vorbereitung und erfolgreicher Speicherquittung. Der CAD-Aufruf während dieser Vorbereitung hatte kein Abbruchsignal und konnte das Panel unbegrenzt beschäftigt halten. Der Screenshot allein weist nicht nach, welche Phase dort gerade wartete.

Ein gültiger Entwurf wird jetzt angenommen und das Panel sofort geschlossen. Die Bearbeitungsgriffe verschwinden; die sichtbare Gebäudevorschau bleibt bis zur fertig nachgeladenen Geometrie erhalten. Die Vorbereitung gibt zunächst die Benutzeroberfläche frei und erhält ein 30-Sekunden-Zeitlimit. Bei einem sicheren Fehler bleiben Original und Entwurf erhalten; der Entwurf öffnet sich wieder zur Korrektur. Nach einem bereits versendeten Speicherauftrag wird weiterhin dieselbe Command-ID auf ihre Quittung geprüft. Eine verlorene Antwort erzeugt keine zweite Generation.

Busy-Setup und Validierung liegen innerhalb abgesicherter Fehlerbehandlung; der Button besitzt zusätzlich einen Schutz gegen Mehrfachauslösung. Ungültige Entwürfe bleiben im Panel korrigierbar, unveränderte Gebäude schließen ohne Schreibvorgang.

Die Browserfixture `line-brush-commit-audit.html` verwendet einen gespeicherten Berliner Baukörper und den tatsächlichen Controller; sämtliche Projekt-Schreibvorgänge werden abgefangen. Acht Fälle bestanden: unverändert, ungültig, langsames Speichern mit Doppelklick, Konflikt mit erneutem Versuch, verzögertes CAD, verzögertes Nachladen, verlorene Antwort mit vorhandener Quittung und ausbleibendes CAD mit dem tatsächlichen 30-Sekunden-Zeitlimit.

Ein neunter Browserfall (`?handoff=1`) prüft Werkzeugwechsel und bewusstes Wiederöffnen während noch fehlender Ersatzmeshes: Die alten Bearbeitungsgriffe bleiben entfernt; ein neuer Sechsgeschosser-Entwurf überlebt die verspätete Antwort der vorherigen Fünfgeschosser-Generation und lässt sich anschließend speichern.

## F8-Befund und Änderung

Die Aufnahme `perf_960abffed11e4e4e` vom 5. September 2026, 22:20 Uhr CEST, wurde vor dem Dienstneustart lokal gesichert. Sie enthält 13 Bilder in ungefähr 16,4 Sekunden:

| Messung | Wert |
| --- | ---: |
| Mittlere Bildrate | 0,78 FPS |
| Längster Bildabstand | 3.574 ms |
| Mittlere gemessene CPU-Arbeit im Szenenbild | 70,8 ms |
| Mittlere Wartezeit vor der Tasteneingabebehandlung | 1.492 ms |
| Gesamte gemessene Tasteneingabebehandlung | 23,3 ms |
| Geladene / dargestellte Chunks | ungefähr 1.407 / 1.191 |
| Ausstehende Geometrien | ungefähr 316 |

Ein Workerauftrag mit 0,5 ms eigener Rechenzeit wurde erst nach ungefähr sechs Sekunden zurückgemeldet. Zudem verlangte der Scheduler nach jedem Workerergebnis erneut einen Browser-Leerlaufcallback mit 250-ms-Timeout. Diese Wartebedingung ist für ausgelagerte Berechnung unnötig und entfällt jetzt. Zwischen Aufträgen bleibt ein eigener kurzer Task; die synchrone Ersatzberechnung behält ihr Leerlaufbudget. Radius und Geometriequalität wurden nicht reduziert.

Die tatsächliche SceneRuntime-/Worker-Browserprüfung bestand alle fünf Fälle. Bei absichtlich vollständig ausbleibenden Leerlaufcallbacks wurden zwölf neue Workeraufträge samt Chunkmeshes in 23 ms abgeschlossen. Der Wert belegt den behobenen Schedulerengpass; er ist keine neue FPS-Messung im Nutzerprojekt.

Die Aufnahme erklärt die gesamten mehrsekündigen Pausen noch nicht eindeutig. Insbesondere ist die Differenz zwischen Bildabstand und gemessener CPU-Arbeit kein Beweis für eine bestimmte GPU-Ursache. Das Leistungsproblem gilt erst nach einer neuen Messung im betroffenen Editor als abschließend überprüft.

## Erweiterte Diagnose

F8 erfasst nun zusätzlich:

- Zeitpunkt der rAF-Anforderung, tatsächlichen Beginn des Callbacks und dessen Verspätung;
- synchrone Geometrievorbereitung, Registry-Scan, Worker-Wartezeit, Rechenzeit und Rückgabe an den Hauptthread;
- Ressourcen per PerformanceObserver, auch wenn der ältere globale ResourceTiming-Puffer voll ist;
- Sichtbarkeit, Fokuswechsel und tatsächlich unterstützte Browsermessungen;
- Grafikrenderer und, sofern unterstützt, asynchrone GPU-Zeitmessungen während der Aufnahme.

GPU-Ergebnisse werden erst nach Verfügbarkeit abgefragt. Höchstens vier offene Messungen sind erlaubt; es gibt kein synchrones Warten auf die GPU. Fehlende, offene und durch GPU-Disjoint ungültige Werte werden ausdrücklich gekennzeichnet. Browser-Observer werden vor Aufnahmeende geleert. Sechs Regressionstests prüfen diese Diagnosepfade einschließlich begrenzter Puffer und nicht verfügbarer GPU-Timer.

## Abschlussprüfung

`npm run check` einschließlich aller Regressionen, Typecheck und Produktionsbuild ist erfolgreich. Der abschließende Handoff-Schutz besteht zusätzlich Typecheck, 15 Geometrie-, acht Settings- und vier Receipt-Tests sowie den beschriebenen Browserfall.

Die isolierte Browserprüfung des echten F8-Recorders besteht mit 24 WebGL-/rAF-Aufrufen. Der Browser meldet ANGLE/NVIDIA GeForce RTX 3070/D3D11 und liefert 23 asynchrone GPU-Messungen. Eine neue Anfrage erscheint trotz absichtlich gefülltem globalen ResourceTiming-Puffer. Die Prüfung sendet keine Serveraufnahme und verändert kein Nutzerprojekt. Sie bestätigt die Messintegration, nicht die Bildrate der großen Editorszene.

Auslieferung am 5. September 2026 gegen 22:58 Uhr CEST: Editor-Dockerimage neu gebaut und ausschließlich der Editor-Dienst neu erstellt. Produktionsentry `assets/main-DadRW8je.js`, Worker `assets/chunk_mesh_worker-BLaVTouE.js`. Alle zwölf Manifest-/Workerdateien antworten mit HTTP 200; Editor und unveränderter Chunk-Dienst melden healthy.

Eine neue F8-Aufnahme aus der authentifizierten Nutzersitzung ist für den Vergleich mit den 0,78 FPS erforderlich. Der Nutzer wurde nach erfolgreicher Auslieferung um Neuladen und eine neue 15-Sekunden-Aufnahme gebeten. Der ursprüngliche Mitschnitt liegt weiterhin lokal gesichert vor.
