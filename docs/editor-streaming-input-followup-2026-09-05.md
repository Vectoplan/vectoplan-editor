# Streaming, Kamera und Geschossbearbeitung – 5. September 2026

## Verhalten

- Der erste Szenenstart wartet auf Gelände, Geschosshöhen und verknüpfte Dächer im Nahbereich von sieben Chunks (112 m), einschließlich der zugehörigen Worker-Geometrie. Die Umgebung wächst danach in Stufen bis 28 Chunks (448 m). Fehlgeschlagene optionale Quellen und die begrenzte Startwartezeit lassen vorhandene Geometrie weiterhin nutzbar. Ego/Planung verwenden dieselbe laufende Szene und starten diesen Ladebildschirm nicht erneut.
- Der konfigurierte Laderadius wurde von 14 auf 28 Chunks verdoppelt. Zusätzlich wurden die bisher wirksame Begrenzung auf acht Chunks in WorldRuntime und die Begrenzung der Koordinatenmenge angepasst. Der Standardcache umfasst 8.192 Chunks; das Entladen beginnt außerhalb von 33 Chunks. Explizite kleinere Speicherbudgets begrenzen den Radius weiterhin.
- Linienbrush-Einstellungen bleiben nichtmodal. Wiederherstellen der Eingabe im selben Arbeitsmodus setzt die Kamera nicht zurück. Ein bestätigter Speichervorgang schließt das Panel bereits vor dem anschließenden Chunk-Nachladen. Unveränderte bestehende Gebäude schließen ohne erneute Erzeugung.
- Pointer-Up mit `buttons === 0` beendet die gedrückte Maustaste zuverlässig. Der erste Klick zur Aktivierung der Ego-Mausbindung wird als Aktivierung behandelt und öffnet nicht gleichzeitig erneut das anvisierte Einstellungsfenster. Deaktivierte Mausbindung im Planungsmodus unterdrückt keine Werkzeugklicks.
- Das Löschsymbol steht aufrecht. Dachaktionen erscheinen innerhalb von 80 m zur tatsächlichen Dachfläche; überlappende Symbolpaare werden ausgedünnt. Die Aktionen eines ausgewählten Daches bleiben erreichbar.
- Geschosszahl und Deckenhöhen ändern zunächst nur das lokale Profil und die Linienvorschau. Mausbewegungen werden pro Bild zusammengefasst. **Bestätigen** übernimmt den letzten Stand einmal atomar und beendet die Bearbeitung. Schließen oder Werkzeugwechsel verwirft unbestätigte Änderungen und hebt die Auswahl auf. Ein fehlgeschlagener Speichervorgang erhält den Entwurf für einen erneuten Versuch.

## Prüfung

`npm run check` ist erfolgreich einschließlich TypeScript, Produktionserstellung und der neu integrierten Regressionen für Pointer-Zustand, Aktivierungsklick und Dachaktionen. Protokoll: `.tmp-tests/editor-followup-check.log`. Vite meldet weiterhin die bestehende Warnung zur Größe des Hauptbundles.

Browserprüfungen mit Produktionsklassen und isoliertem Transport:

- `initial_scene_streaming_audit`: vier Prüfungen erfolgreich. Ein um 1,7 s verzögerter Dachanker hält die Startabdeckung offen; die 149 Oberflächen-Chunks im Nahbereich und die verknüpfte Dachgeometrie sind vor der Freigabe vorhanden. Szenenwechsel behalten Szene und Canvas. Ein fehlender Dachendpunkt blockiert die übrige Welt nicht dauerhaft.
- `line_brush_panel_controller_audit`: vier Prüfungen erfolgreich, einschließlich unveränderter Bestätigung ohne Schreibvorgang sowie Schließen nach erfolgreichem Speichern vor künstlich verzögertem Chunk-Nachladen.
- `storey_draft_controller_audit`: fünf Prüfungen erfolgreich mit einem gespeicherten Berliner Baukörper (1.545 Konstruktionszellen, zehn Kinder). 240 Abwärts-Ereignisse benötigten im gemessenen lokalen Vorschaupfad 4,8 ms und lösten keine Speicherung oder Block-Neuerzeugung aus. Bestätigung, Doppelklickschutz, Abbruch, Konflikt und erneuter Versuch sind abgedeckt. Dies ist eine Komponentenmessung, keine allgemeine FPS-Zusage.
- `roof_edit_actions_audit`: tatsächliches WebGL-Rendering und GPU-Auslesen bestätigen das aufrechte Löschsymbol; Reichweite, Überlappung und ausgewählte entfernte Dächer wurden in Ego und Planung geprüft.
- `line_brush_real_input_audit`: fünf Prüfungen erfolgreich. Tatsächliche SceneRuntime, Worker und Eingabehandler verifizieren Ego-Mausbewegung und WASD bei geöffnetem Panel, Planungs-Pan/Zoom, Isolation der Panelereignisse und Kameraeingabe nach dem Geschoss- und Dachwerkzeug. Die Ereignisse dieser automatisierten Prüfung werden durch die echten DOM-Handler verarbeitet.

Die gesonderte native Pointer-Lock-Prüfung konnte im integrierten Browser nicht erfolgreich abgeschlossen werden: Trotz vertrauenswürdigem Canvas-Klick, aktiver Benutzerinteraktion und Dokumentfokus antwortet der Browser mit `PointerLockError`. Dieser Lauf gilt ausdrücklich nicht als bestandener nativer Mausbindungstest. Aktivierungs- und Sperrzustände sind zusätzlich durch Regressionstests der tatsächlichen MouseInputHandlers abgedeckt. Eine vollständige Bedienprüfung in der authentifizierten Chrome-Sitzung des Nutzers wurde nicht durchgeführt; die Testseiten verändern keine gespeicherten Nutzergebäude.

## Lokaler Stand

Editor und Chunk wurden am 5. September gegen 22:04 CEST neu erstellt und gestartet. Beide Container sind `healthy`; Editor `/health` liefert HTTP 200, Chunk `/chunks/_status` liefert `ok: true`. Das ausgelieferte Manifest verwendet `assets/main-SMf36Tjb.js`. Alle zwölf geprüften Manifest- und Worker-Dateien liefern HTTP 200. Die laufende Editor-Konfiguration bestätigt Radius 28, Vorladen 2, Entladen 33 und Cache 8.192.

Die Änderungen benötigen einmaliges Neuladen einer bereits geöffneten Editorseite. Der Wechsel der Arbeitsansicht benötigt anschließend keinen neuen Szenenstart.
