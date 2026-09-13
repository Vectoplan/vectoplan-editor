# Variable Geschosse, Kartenorientierung und Baumkataster

## Verhalten

- Ein Inventarwechsel bei bereits gestarteter Szene setzt keinen Vollbild-Ladezustand mehr. Beim ersten Projektstart bleibt die Initialisierung sichtbar.
- Neue LoD2-Importe und die Fassadenbänder verwenden **3 Blöcke / 3,0 m** als Standard. Die reale Traufhöhe bleibt erhalten, einschließlich eines kürzeren obersten Geschosses. Bereits gespeicherte individuelle Höhen und ältere konvertierte Profile bleiben erhalten; der normale Linienbrush behält seinen bisherigen Standard.
- Das Geschosswerkzeug markiert bestehende und erzeugte Gebäude deckend blau. Das Einstellfenster öffnet erst nach Auswahl eines Gebäudes oder seines Symbols. Dach und Geschosse nutzen dieselbe Auswahl in Ego und Planung.
- Teilbereiche sind direkt über die blauen Umrisse oder im Bereichsmenü wählbar. Für LoD2 werden dafür tatsächliche Dachbereiche dauerhaft auf die vollständige Gebäudegrundfläche aufgeteilt. Innenhöfe bleiben frei, die Teilung erzeugt keine zusätzlichen raumhohen Innenwände. Entfernte Bereiche behalten ihre Identität, damit andere Einstellungen beim Konturumbau nicht auf einen anderen Gebäudeteil wechseln.
- Plus/Minus beziehungsweise der Geschossgriff ändern die Anzahl im gewählten Bereich. Einzelne Deckenlinien lassen sich mit der Maus oder über ihre Höhe im Menü verschieben. Eine innere Grenze verändert die beiden angrenzenden Geschosse und lässt das Dach stehen; die Oberkante verschiebt das zugehörige Dach. Escape bricht einen Maus-Drag ab.
- Während eines Drags zeigen die projizierten Deckenlinien die aktuelle Höhe. Der vollständige Baukörper wird beim Loslassen neu erzeugt, damit große LoD2-Gebäude die Mausbewegung nicht durch eine Geometrieberechnung pro Ereignis blockieren.

## Karte und Koordinaten

Die gespiegelte OSM-Schrift kam aus dem Unterschied zwischen dem geographischen Achsensystem (Ost / oben / Nord) und der Händigkeit der Kamera. Der geographische Szenenrenderer behandelt das jetzt zentral, einschließlich Schatten, Sprites und Maustreffer. Weltkoordinaten und Terrain-UVs bleiben unverändert. Die getrennte Vorschau gewöhnlicher Library-Objekte verwendet weiterhin ihre normale Kamera.

`TerrainMapProvider` beschreibt XYZ-URL und Quellenangabe für spätere Kartenstile. Ein konfigurierter Anbieter wird zuerst versucht; OSM bleibt Rückfallquelle. Ohne Konfiguration erscheint dauerhaft OSM. Es ist kein kostenpflichtiger Mapbox-Stil aktiviert. Details: [Koordinatenvertrag](terrain-map-coordinate-contract.md).

## Baumkataster

Das geschützte Standardprojekt **Baumkataster** ist im Datenportal angelegt. Sein Uploadlink öffnet den vorhandenen Uploader mit dem ausgewählten Projekt. Eine Baum-GPKG bleibt dort als Quelldatei erhalten und durchläuft die bestehende Freigabe. Der Veröffentlichungsweg verarbeitet sie mit GDAL, transformiert ihr Bezugssystem nach WGS84 und baut einen räumlichen Punktindex. Abmessungen und Baumart werden übernommen; fehlende Abmessungen verwenden einfache Standardwerte. Ohne hochgeladene und freigegebene Datei werden keine Baumstandorte erfunden.

Der Chunk-Dienst überführt die Punkte in das gemeinsame Weltkoordinatensystem und verwendet die Geländehöhe. Stabile Kennungen bestimmen die Ausrichtung. Zwei instanzierte Meshes pro räumlichem Batch zeichnen einfache Stämme und Kronen. Wiederholte vertikale Chunkreferenzen erzeugen keine doppelten Bäume.

Ein Treffer auf Stamm oder Krone entfernt den vollständigen Baum über den bestehenden autorisierten `RemoveObject`-Befehl. Der serverseitige Löschvermerk bleibt beim Nachladen erhalten. Die Geländevoxel unter dem Baum werden nicht entfernt. Baumkronen dienen nicht als Platzierungsfläche für neue Blöcke.

## Prüfungen

- Die vollständige Editor-Checkkette einschließlich TypeScript und Produktionsbuild bestand. Nach dem abschließenden Dachdomänen- und Drag-Nachtrag wurden die betroffenen Geometrietests, TypeScript und Build erneut geprüft.
- 72 gezielte Geometrieprüfungen decken Profile, Teilbereiche, Eigentümerschaft der Blockzellen, Dachüberhänge, Stufenwände, Innenhöfe und alte gespeicherte Profile ab.
- Drei echte Berliner LoD2-Gebäude wurden schreibfrei mit 1 / 9 / 22 Teilbereichen aufgebaut und nach Serialisierung erneut geprüft. Die vollständige Geometrieberechnung des größten Falls benötigte hier rund 8 Sekunden; das ist keine Messung der gesamten Speicherdauer einschließlich Netzwerk und Chunk-Nachladen.
- Browserprüfung mit echtem Controller und isoliertem Transport: menüfreie Aktivierung, blaue Flächen, Symbol-/Körperauswahl, getrenntes Hinzufügen/Entfernen, Höhenänderung, Originaldach und erneute Auswahl nach Speichern bestanden. Ein echter PointerCapture-Drag verschob eine innere Grenze von 3,50 auf 5,04 m, ohne Nachbarteil oder Dach zu verändern.
- GPU-Prüfung: OSM-Schrift lesbar, vier geographische Eckpunkte richtig, Maustrahl und Symbolprojektion deckungsgleich, Vorderseiten und Schatten sichtbar.
- Baumdarstellung im Browser: zwei Bäume auf geneigtem Terrain, Treffer auf Stamm und Krone, vollständiger Abbau und erneutes Laden bestanden. Drei Renderer-Tests, 14 Chunk-/Datenbanktests und 17 GPKG-/Upload-/Veröffentlichungstests bestanden. Der durchgehende Importtest sendet echte GPKG-Bytes über zwei HTTP-Uploadteile, verarbeitet den persistenten Importauftrag, gibt den Release frei und fragt anschließend seine real transformierten Baumpunkte ab; alles innerhalb einer temporären Datenbank.

Die Browserproben verwenden isolierte Testdaten. Das Berliner Nutzerprojekt wurde dabei nicht umgebaut. Echte Berliner Bäume erscheinen erst nach dem späteren GPKG-Upload und dessen Freigabe.
