# Gemeinsames Inventar und bearbeitbare LoD2-Gebäude

Dieser Bericht beschreibt die vorherige Ausbaustufe. Der aktuelle LoD2-Standard von 3,0 m, variable Höhen, Kartenorientierung und Baumkataster sind im [Folgebericht](storey-heights-maps-trees-2026-09-05.md) beschrieben.

## Verhalten

- Die OSM-Karte ist dauerhaft aktiv. Rechts unten steht der Quellenlink „OSM“; die Test-Checkbox entfällt.
- Die zusätzlichen weißen Straßenbänder aus den Geodaten werden nicht mehr gezeichnet. Manuell platzierte Bauobjekte bleiben bestehen.
- Grundstücksgrenzen werden als 3 Pixel breite Linien dargestellt, auch auf WebGL-Systemen ohne breite native Linien.
- Ego und Planung verwenden dieselbe Library-Hotbar und dieselbe Creative Library über **I**. Die getrennten Belegungen `default` und `planning` bleiben jeweils gespeichert.
- Planung akzeptiert ausschließlich WorldEdit-Werkzeuge. Nur beim erstmaligen Anlegen werden neun Slots vorbelegt: Auswahl, Linienbrush, Geschosse, Dach, Straße/Pfad, Grundstück, Grundstücksraster, Treppe und Messen. Eine später geleerte Belegung wird nicht wieder automatisch gefüllt.
- Die zusätzliche Planungsleiste und „Schneller Baukörper“ entfallen. Linienbrush und Geschosse sind in der WorldEdit-Kategorie verfügbar.

## LoD2 und gemeinsame Werkzeuge

Die bestehenden Fassaden erhalten sichtbare Deckenbänder im Abstand von **2,645 m**. Die ursprüngliche Traufe bleibt unverändert; ein oberes Restgeschoss wird nicht auf volle Höhe gestreckt. Die Darstellung behält die ursprünglichen Blockkoordinaten für das Abbauen.

Linienbrush und Geschosswerkzeug können ein bestehendes LoD2-Gebäude auswählen. Die erste Auswahl schreibt noch nichts. Vor einer Bearbeitung lädt der Editor sämtliche Dachobjekte und den gegebenenfalls bereits vorhandenen Gebäude-Parent über den neuen gebäudebezogenen GET-Endpunkt. Damit hängt die Vollständigkeit nicht vom geladenen Kamerabereich ab.

Der neue Konturvertrag verwendet die tatsächlichen GroundSurface-Polygone einschließlich Innenhöfen und getrennter Gebäudeteile. Er rekonstruiert diese Kontur nicht aus einem umschließenden Rechteck oder einer Mittellinie. Punkte können eingefügt, verschoben und gelöscht werden; ungültige Kreuzungen und außerhalb liegende Hofringe werden verworfen.

Geschossänderungen verwenden die gemeinsamen Bauteil- und Dachsysteme. Bestehende Dachflächen werden verschoben; bei Konturänderungen werden vorhandene Dachflächen zugeschnitten und auf Erweiterungen fortgeführt. Getrennte Gebäudeteile, niedrigere Anbauten, Stufenwände und Hofwände werden berücksichtigt. Ein separat mit dem Dachwerkzeug geändertes Dach wird beim nächsten Gebäudeabruf als aktuelle Grundlage übernommen.

Die erste Umwandlung bereinigt Originalwandzellen nur mit serverseitig nachgewiesener Importherkunft. Nutzeränderungen, abgebaute Löcher und fremde Objekte bleiben geschützt. Bereinigung und neue Bauteile gehören zu einer Datenbanktransaktion. Geschützte, vollständig leere Bauteile halten die anschließende Anzeige nicht in einem endlosen Ladezustand.

Große ObjectBatch-Aufträge werden ab 1 MiB für den Versand komprimiert. Die JSON-Transporthülle lässt die bestehenden Proxy- und HTTP-Größenlimits unverändert. Der Chunk-Dienst prüft Berechtigungen, entpackt mit einem festen Byte-Limit und verarbeitet anschließend denselben kanonischen Befehl wie bisher. Komprimierte Aufträge erhalten 120 Sekunden Wartezeit und werden bei einer unklaren Antwort nicht automatisch wiederholt.

## Prüfungen

- Alle Skripte der Editor-Checkkette, TypeScript-Prüfung und Produktionsbuild bestanden. Nach Anpassung des erweiterten Geschoss-Hinweistextes wurde die zunächst dort unterbrochene Checkkette ab diesem Test fortgesetzt.
- Neue gezielte Frontendtests: 24 für LoD2-Konturen, Dächer, Deckenzonen, Plan-Cache und Anzeigeübergabe; 4 für Inventarbelegungen und verspätete Antworten.
- Backend: 10 LoD2-Tests einschließlich echter Datenbank, komprimiertem HTTP-Auftrag, Folgegeneration, geschützter Blöcke und vollständigem Rollback; 4 Berechtigungs-, 9 Editor-Proxy/Client- und 2 SQL-Ladeprüfungen. Die ältere ObjectBatch-DB-Suite wurde wegen ihres vollständigen WSGI-Startups abgebrochen; ihre fünf reinen Tests bestanden. Die neuen LoD2-DB-Tests verwenden gezielt eine eigene temporäre Testwelt ohne Produktionsstartup.
- Transport: 9 Frontend- und 28 Decoderprüfungen für exakten UTF-8-Roundtrip, Limits, Abbruch, fehlerhafte Hüllen und keine Wiederholung von Schreibvorgängen. Zusätzlich wurde ein aus den Berliner Geometrien erzeugter Batch mit 178.517 Körper-/Dachwandzellen und Dachmetadaten tatsächlich vom Browser-Encoder zum Python-Decoder übertragen: 93.373.845 entpackte Bytes, 14.595.628 Versandbytes; ohne Mutation des Berliner Projekts.
- Library: 7 Tests für Toolkatalog und Belegung.
- Browser mit echten Library-Iframes: **I**, WorldEdit-Filter, Drag-and-drop, gespeicherte Planung und unveränderte Ego-Belegung geprüft. Die Teständerung wurde zurückgesetzt.
- Browser mit echtem WorldEdit-Controller und isoliertem Chunktransport: LoD2-Auswahl ohne Schreiben, zwei Geschossänderungen in beiden Ansichten, Innenhof und geneigtes Dach, Gebäudewechsel sowie Anzeigeübergabe bei geschützten Zellen bestanden. Die zugehörige Three.js-Szene wurde visuell geprüft.
- Zusätzlich wurden die vollständigen aktuellen Daten des Berliner Testprojekts schreibfrei geprüft: 3 Gebäude mit insgesamt 33 Dachobjekten. Für eine Geschosserhöhung entstanden 228, 85.392 beziehungsweise 165.380 Körperzellen zuzüglich Dachwandzellen. Plan- und Dachschnitt-Cache reduzierten die beiden großen Berechnungen auf diesem Rechner von etwa 7/35 Sekunden auf etwa 1,5/2,3 Sekunden; dies ist eine Geometrie-Messung ohne Server-Speicherung und Chunk-Nachladen.

## Grenzen und Betriebsdetails

Komplexitätsgrenzen des gemeinsamen Gebäudegenerators gelten weiterhin. Für LoD2 gilt ein Gesamtbudget von 262.144 Zellen, während einzelne Bauteilbefehle und der normale Linienbrush weiterhin auf 65.536 begrenzt sind. Das bleibt unter dem standardmäßigen ObjectBatch-Limit von 1.048.576 Zellen und lässt Platz für Bereinigung und Ersetzungen. Übermäßig große Dachoperationen werden vor einem Teilumbau mit einer Fehlermeldung beendet. Die Browserregression prüft den echten Controller mit isoliertem Transport; sie ersetzt keine vollständige visuelle Prüfung jeder Berliner LoD2-Form im angemeldeten Benutzerprojekt.

Beim Library-Neustart erzeugte der vorhandene Autogenerate-Mechanismus die bereits angewendete Revision `6cea17a0aeaf`. Ursache sind zwei gleichnamige Priority-Indizes im bestehenden Library-Modell, nicht ein neues Inventarschema. Die Revisionsdatei bleibt erhalten, damit die laufende Datenbank ihren Migrationsstand auflösen kann.

Editor und Chunk wurden einschließlich des Größen-/Transportnachtrags erfolgreich neu gebaut und gestartet. Editor, Chunk und Library melden einen gesunden Zustand. Das ausgelieferte Frontend `assets/main-BaU-ppxU.js` stimmt mit dem abschließenden lokalen Build überein. Die serverseitigen Berechtigungsprüfungen bleiben aktiv: ein anonymer Aufruf des Editor-Gebäudeendpunkts erhält 401, ein interner Aufruf ohne Benutzer-Projektkontext 403.
