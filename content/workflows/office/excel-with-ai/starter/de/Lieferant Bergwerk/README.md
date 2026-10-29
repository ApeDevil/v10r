# Lieferant Bergwerk: Produktliste für den Shop-Import

Lies diese Datei zuerst und halte dich daran.

## Ziel
Den monatlichen Produktexport von Bergwerk in die Tabelle umwandeln, die unser Shop importiert.

## Quellen (input/)
- `bergwerk-products.xlsx`, Blatt `Export`, Überschriften in Zeile 1, eine Zeile pro Produkt.
  `Artikelnr` ist die eindeutige Artikelnummer des Lieferanten.

### Spalten
| Spalte | Bedeutung | Hinweise |
|---|---|---|
| Artikelnr | Artikelnummer des Lieferanten | Eindeutig; wird unsere `sku` |
| EAN | Barcode (GTIN-13) | Excel zeigt ihn manchmal als 4.01235E+12 |
| Bezeichnung | Produktname, Deutsch | Kann länger als 80 Zeichen sein |
| Farbe | Farbe, Deutsch, Freitext | „schwarz“, „Schwarz“, „sw“ heißen alle schwarz |
| Gewicht | Gewicht | Gemischt: „1,2 kg“, „850g“, „1200“ (ohne Einheit) |
| Maße cm (BxHxT) | Breite x Höhe x Tiefe in cm | Ein Textwert, z. B. „30 x 45 x 15“ |
| Hersteller | Marke | Manchmal leer |
| Kategorie | Produktkategorie, Deutsch | Wird nicht importiert |

## Ziel-Format (output/<Datum>/shop-import.xlsx, Blatt `products`)
| Spalte | Format | Pflicht |
|---|---|---|
| sku | Text, aus Artikelnr | ja |
| gtin | 13 Ziffern, gültige Prüfziffer, als Text gespeichert | ja |
| title | Text, höchstens 80 Zeichen | ja |
| color | Einer der Werte: Black, Red, Blue, White | nein |
| weight_kg | Zahl in kg, Dezimalpunkt | ja |
| width_cm, height_cm, depth_cm | Zahlen | nein |
| brand | Text, aus Hersteller | ja |

## Ergebnis (output/<Datum>/)
- `shop-import.xlsx` mit drei Blättern: `products` (das Ziel-Format oben), `issues` (jeder Wert,
  der sich nicht umwandeln ließ, mit Quellzeile und Grund) und `changes` (jede geänderte Zelle,
  vorher und nachher).

## Regeln
- Ändere nie die Dateien in input/.
- Zählen und Umrechnen erledigt ein Python-Skript in tools/, nicht das Lesen der Zeilen.
- Rate nie. Ein Wert, den du nicht umwandeln kannst, bleibt unverändert und kommt auf das Blatt issues.
- Speichere jede Zelle als Text, damit Barcodes ihre führenden Nullen behalten.
- Frag mich, bevor du eine Spalte oder Zeile weglässt.

## Fertig, wenn
- Jede Produktzeile der Quelle steht in products oder issues (gleiche Anzahl).
- Jeder Wert in products entspricht dem Ziel-Format.

## Entscheidungen
- (noch keine)
