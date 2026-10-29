# Eine Excel-Tabelle mit KI auswerten und umwandeln

Wer eine KI bittet, „diese Tabelle aufzuräumen“, bekommt meist eine selbstsichere Antwort über die
ersten paar Dutzend Zeilen, eine falsch verstandene Spalte und eine Summe, die niemand nachprüfen
kann. Das Problem ist nicht die Tabelle. Der KI wurde nie gesagt, was die Tabelle bedeutet, und sie
musste Tausende Zeilen mit bloßem Auge lesen.

Dieses Tutorial geht eine echte Aufgabe im [KI-Aufgaben-Ordner](/de/workflows/ai-project-folder)
durch: Ein Lieferant, Bergwerk, schickt jeden Monat einen deutschen Produktexport, und der Shop
braucht ihn in seinem eigenen Import-Format. Unterwegs zeigt es die drei Dinge, die jede
Excel-Aufgabe mit KI verlässlich machen: **die Tabelle beschreiben**, **ein Skript die Zeilen
bearbeiten lassen** und **das Ergebnis mit Zahlen prüfen**.

**[Den Beispiel-Ordner herunterladen](/de/workflows/excel-with-ai/starter-de.zip)** zum Mitmachen:
der Bergwerk-Export in `input/`, die README aus Schritt 2 fertig ausgefüllt und die Prompts dieser
Seite in `prompts.md`. Entpacken Sie ihn (Rechtsklick, **Alle extrahieren**) und richten Sie Ihr
KI-Werkzeug darauf.

## Was Sie brauchen

- Den Ordner aus [Einen Ordner für die Arbeit mit KI anlegen](/de/workflows/ai-project-folder),
  mit der Datei des Lieferanten in `input/`.
- Das KI-Werkzeug, das Ihre Firma bereitstellt. Die Prompts unten funktionieren in einem Chat mit
  Datei-Upload oder mit einem Agenten im Ordner. Mit einem Assistenten in Excel fügen Sie den
  README-Text in den Chatbereich ein und lassen die Tabelle geöffnet.
- Eine Beschreibung, wie das Ergebnis aussehen soll: die Import-Dokumentation des Shops, ein
  Beispiel einer korrekten Import-Datei oder einfach das, was Sie wissen.

## 1. Die Tabelle lesbar machen

Eine KI liest eine Tabelle so, wie ein Programm es tut, nicht so, wie Sie sie am Bildschirm sehen.
Prüfen Sie die Quelle vor allem anderen auf das, was sie verwirrt:

| Am Bildschirm | Was die KI sieht | Was zu tun ist |
|---|---|---|
| Zwei Tabellen nebeneinander auf einem Blatt | Eine breite Tabelle mit leeren Spalten | In der README sagen, welcher Bereich welcher ist, oder um ein Blatt pro Tabelle bitten |
| Verbundene Zellen und mehrzeilige Überschriften | Leere Zellen und Überschriften wie `Unnamed: 3` | Sagen, welche Zeile die echten Überschriften enthält |
| Farbe bedeutet etwas („rot = ausgelistet“) | Gar nichts; Farbe geht meist verloren | Eine Spalte in der Beschreibung ergänzen oder sagen „rote Zeilen sind ausgelistet“, damit ein Skript die Füllfarbe liest |
| Eine Summenzeile unten | Ein Produkt namens „Summe“ | Sagen „die letzte Zeile ist eine Summe, überspringen“ |
| `4.01235E+12` in einer Barcode-Spalte | Eine gerundete Zahl: Die Ziffern sind weg | Erwähnen; das Skript muss sie markieren, nicht „reparieren“ |

Räumen Sie die Datei des Lieferanten nicht von Hand auf, um das loszuwerden. Beschreiben Sie es,
damit das Skript es nächsten Monat genauso behandelt.

## 2. Die Tabelle in der README beschreiben

Diesen Schritt lassen die meisten aus, und er ist der wichtigste. Die KI kennt Excel; Ihr Geschäft
kennt sie nicht. Ergänzen Sie in `README.md` einen Abschnitt **Spalten**: eine Zeile pro Spalte,
was sie bedeutet und was an ihr ungewöhnlich ist.

```markdown
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
```

Beschreiben Sie dann das **Ziel-Format** genauso. Es ist die Definition von „fertig“, also seien
Sie genau:

```markdown
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
```

Das müssen Sie nicht allein schreiben. Bitten Sie die KI: „Sieh dir input/bergwerk-products.xlsx an
und entwirf die Spaltentabelle für README.md. Markiere alles, bei dem du unsicher bist, mit einem
Fragezeichen.“ Korrigieren Sie dann den Entwurf. Einen Entwurf zu verbessern geht viel schneller,
als bei null anzufangen, und die Fragezeichen zeigen Ihnen genau, wo sie geraten hätte.

## 3. Erst hinsehen, dann ändern

Der erste echte Prompt bittet die KI, die Tabelle zu **profilieren**, nicht, sie zu ändern:

> Lies README.md. Schreib ein Python-Skript tools/profile.py, das jede Zeile von
> input/bergwerk-products.xlsx liest und für jede Spalte berichtet: wie viele Zellen gefüllt sind,
> wie viele verschiedene Werte es gibt, die zehn häufigsten Werte und alles, was nicht zur
> Beschreibung in README.md passt. Führ es aus und zeig mir den Bericht. Ändere nichts.

Warum ein Skript und nicht „sieh dir die Tabelle an“: Die KI kann nur begrenzt viel Text auf einmal
lesen. Bei einer großen Tabelle schaut sie still auf die ersten Zeilen und nimmt an, der Rest sehe
genauso aus. Ein Profil deckt jede Zeile ab, egal wie groß die Tabelle ist, und kommt als ein
kurzer Bericht zurück. Für die Gewichtsspalte der Beispieltabelle:

```text
Gewicht   filled 24 / 24   distinct 23
  top: "1,2 kg" (2)  "850g" (1)  "0.4 kg" (1)  "450" (1)  "ca. 2kg" (1)
  note: decimal commas and points; units with and without a space; 2 values without a unit
```

Bei einer Tabelle mit vierzigtausend Zeilen ist der Bericht genauso lang. Lesen Sie ihn gegen Ihre
Spaltentabelle. Jede Überraschung ist entweder ein Fehler in Ihrer Beschreibung (README korrigieren)
oder eine Entscheidung, die zu treffen ist (unter Entscheidungen eintragen):

```markdown
## Entscheidungen
- 2026-10-29: Gewichte ohne Einheit sind Gramm; jedes Gewicht mit Einheit liegt unter 2 kg.
- 2026-10-29: „ca.“-Werte sind Schätzungen; für den Lieferanten stehen lassen, nicht umrechnen.
```

## 4. Den Plan abstimmen

> Schreib den Plan als Tabelle: jede Zielspalte, die Quellspalte, aus der sie kommt, und die
> Regel, die das eine ins andere umwandelt. Liste die Werte auf, die du nicht zuordnen konntest.
> Warte auf mein OK.

Der Plan ist in einer Minute gelesen, und hier fangen Sie die echten Fehler ab: eine Farbe, die dem
falschen Wert zugeordnet ist, zwei vertauschte Spalten, eine Einheit falsch herum angenommen.
Korrigieren Sie ihn in klaren Worten. Wenn er stimmt, sagen Sie OK.

## 5. Das Skript die Arbeit machen lassen

> Schreib tools/transform.py nach dem Plan. Es liest input/bergwerk-products.xlsx und schreibt
> output/2026-10-29/shop-import.xlsx mit drei Blättern: `products` (der Import), `issues` (jeder
> Wert, der sich nicht umwandeln ließ, mit Nummer der Quellzeile und Grund) und `changes` (jede
> geänderte Zelle, vorher und nachher). Speichere jede Zelle als Text, damit Barcodes ihre
> führenden Nullen behalten. Rate nie: Ein Wert, der nicht zu den Regeln passt, bleibt unverändert
> und kommt auf issues. Führ es aus und nenn mir die Anzahlen.

Drei Details in diesem Prompt erledigen den Großteil der Arbeit:

- **„Rate nie.“** Ohne diesen Satz füllt eine KI Lücken mit plausiblen Werten. Mit ihm landen die
  Lücken auf einer Liste, die Sie abarbeiten können.
- **Das Blatt `issues` mit Quellzeilen.** Ein Problem, das Sie in der Originaldatei finden, ist
  ein Problem, nach dem Sie den Lieferanten fragen können.
- **Das Blatt `changes`.** Jede Änderung ist sichtbar, Sie können also eine Spalte filtern und auf
  einen Blick sehen, ob die Farbzuordnung das getan hat, was Sie meinten.

Wenn Ihr Werkzeug stattdessen Python in Excel ausführt, bitten Sie um dasselbe als `=PY()`-Zellen
auf einem neuen Blatt: Die Formeln bleiben in der Arbeitsmappe und rechnen neu, wenn sich die Daten
ändern.

## 6. Das Ergebnis mit Zahlen prüfen

„Sieht gut aus“ ist keine Prüfung. Fragen Sie die KI nach Zahlen, die Sie nachprüfen können, und
prüfen Sie einige selbst:

| Prüfung | Fragen oder tun | Sie findet |
|---|---|---|
| Zeilenzahl | „Wie viele Produktzeilen in der Quelle, in products, in issues?“ | Verlorene oder doppelte Zeilen |
| Summen | „Summe der Gewichte in kg, vorher und nachher“ (drei Zeilen der Quelle von Hand umrechnen) | Falschen Umrechnungsfaktor |
| Werteliste | `color` im Ergebnis filtern: nur erlaubte Werte und leere? | Nicht zugeordnete Schreibweisen |
| Stichprobe | Fünf zufällige Quellzeilen wählen und im Ergebnis suchen | Verschobene oder vertauschte Spalten |
| Issues | Das Blatt `issues` lesen: Ist jeder Eintrag wirklich nicht zu beheben? | Zu strenge Regeln |
| Annahmen | „Welche Annahmen hast du getroffen, die nicht in README.md stehen?“ | Stille Vermutungen |

Was die letzte Frage zutage fördert, kommt unter Entscheidungen oder wird zur Regel.

## Auswerten statt umwandeln

Derselbe Ordner beantwortet auch Fragen zu einer Tabelle. Das Muster ist dasselbe: beschreiben, per
Skript rechnen, prüfen. Anders ist der Prompt. Sagen Sie, **welche Spalten**, **wie gerechnet wird**
und **in welcher Form die Antwort kommen soll**:

| Vage | Genau |
|---|---|
| „Werte die Umsätze aus.“ | „Summe `Umsatz` pro `Region` und Monat, aus Blatt `2026`, als Pivot-Tabelle auf einem neuen Blatt.“ |
| „Gibt es Probleme in den Daten?“ | „Liste die Zeilen, in denen `Gewicht` leer ist oder die `GTIN` die Prüfziffer nicht besteht, mit Zeilennummern.“ |
| „Welche Lieferanten sind die besten?“ | „Ordne die Lieferanten nach Termintreue (`Geliefert` am oder vor `Zugesagt`), mindestens 20 Bestellungen je Lieferant.“ |
| „Mach ein Diagramm.“ | „Liniendiagramm des Monatsumsatzes pro Region, eine Linie pro Region, als Blatt im Ergebnis gespeichert.“ |

Und bitten Sie um die Antwort **in der Arbeitsmappe**, als Formeln, Pivot-Tabelle oder Skript, nicht
nur als Satz im Chat. Eine Zahl im Chat lässt sich nicht prüfen; eine Formel schon.

## Nächsten Monat

Wenn der nächste Export kommt, legen Sie ihn in `input/` (die Datei vom Vormonat behalten Sie unter
einem Namen mit Datum oder verschieben sie in ihren Ergebnis-Ordner), dann:

> Neuer Export in input/. Führ tools/profile.py aus und sag mir, was sich gegenüber dem letzten Mal
> geändert hat. Wenn nichts Neues dabei ist, führ tools/transform.py nach output/2026-11-28/ aus.

Eine neue Spalte oder eine neue Farbschreibweise zeigt sich im Profil, die KI ändert eine Zeile im
Skript, und Sie ergänzen eine Zeile unter Entscheidungen. Der Monat danach ist eine einzige
Nachricht.

## Wann es von Hand schneller geht

Eine einmalige Korrektur von ein paar Hundert Zeilen, die niemand wieder schickt, geht direkt in
Excel schneller. Der Ordner lohnt sich, wenn dieselbe Art Datei wiederkommt, wenn die Tabelle zu
groß ist, um sie mit bloßem Auge zu prüfen, oder wenn später jemand anderes verstehen muss, was
gemacht wurde.
