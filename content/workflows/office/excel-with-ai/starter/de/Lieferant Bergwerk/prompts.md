# Prompts für die Bergwerk-Tabelle

Jeweils ein Prompt, in dieser Reihenfolge. Setzen Sie das heutige Datum ein.

## Spaltenbeschreibung entwerfen
Sieh dir input/bergwerk-products.xlsx an und entwirf die Spaltentabelle für README.md. Markiere
alles, bei dem du unsicher bist, mit einem Fragezeichen.

## Erst ein Profil, nichts ändern
Lies README.md. Schreib ein Python-Skript tools/profile.py, das jede Zeile von
input/bergwerk-products.xlsx liest und für jede Spalte berichtet: wie viele Zellen gefüllt sind,
wie viele verschiedene Werte es gibt, die zehn häufigsten Werte und alles, was nicht zur
Beschreibung in README.md passt. Führ es aus und zeig mir den Bericht. Ändere nichts.

## Den Plan abstimmen
Schreib den Plan als Tabelle: jede Zielspalte, die Quellspalte, aus der sie kommt, und die Regel,
die das eine ins andere umwandelt. Liste die Werte auf, die du nicht zuordnen konntest. Warte auf
mein OK.

## Das Skript die Arbeit machen lassen
Schreib tools/transform.py nach dem Plan. Es liest input/bergwerk-products.xlsx und schreibt
output/<Datum>/shop-import.xlsx mit drei Blättern: products (der Import), issues (jeder Wert, der
sich nicht umwandeln ließ, mit Nummer der Quellzeile und Grund) und changes (jede geänderte Zelle,
vorher und nachher). Speichere jede Zelle als Text, damit Barcodes ihre führenden Nullen behalten.
Rate nie: Ein Wert, der nicht zu den Regeln passt, bleibt unverändert und kommt auf issues. Führ
es aus und nenn mir die Anzahlen.

## Mit Zahlen prüfen
Wie viele Produktzeilen stehen in der Quelle, in products und in issues? Welche Annahmen hast du
getroffen, die nicht in README.md stehen?

## Festhalten
Trag die Entscheidungen von heute im Abschnitt Entscheidungen in README.md ein.

## Nächsten Monat
Neuer Export in input/. Führ tools/profile.py aus und sag mir, was sich gegenüber dem letzten Mal
geändert hat. Wenn nichts Neues dabei ist, führ tools/transform.py nach output/<Datum>/ aus.
