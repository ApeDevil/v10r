# Prompts für das Lieferantenreview

Jeweils ein Prompt, in dieser Reihenfolge. Setzen Sie das heutige Datum ein.

## Die Kernbotschaft finden (falls noch keine da ist)
Lies den Bericht und schlag mir drei mögliche Kernbotschaften für dieses Publikum vor, jede in
einem Satz.

## Zuerst die Storyline
Lies README.md und die Dateien in input/. Schreib output/<Datum>/storyline.md: für jede Folie den
Titel als ganzen Satz, zwei oder drei stützende Punkte und die Quelle jeder Zahl (Datei, Blatt
und Zelle oder Seite). Liste danach alles aus den Quellen auf, was du weggelassen hast, und warum.
Mach noch keine Folien.

## Folien aus der Storyline
Erstelle die Präsentation aus output/<Datum>/storyline.md mit der Vorlage in template/. Übernimm
die Titel wörtlich. Diagramme kommen aus input/q3-figures.xlsx.

## Sprechernotizen
Schreib für jede Folie Sprechernotizen mit drei bis fünf Sätzen: was zu sagen ist und das Detail,
das nicht auf die Folie passte. Verwende nur Fakten aus den Quellen.

## Zahlen-Check
Liste jede Zahl der Präsentation mit Folie, Wert und Quellzelle auf; markiere jede, die du nicht
zurückverfolgen kannst. Speichere das als output/<Datum>/numbers-check.md.

## Publikums-Check
Welche drei Fragen werden die Teamleitungen im Einkauf danach stellen? Wird jede beantwortet?

## Festhalten
Trag die Entscheidungen von heute im Abschnitt Entscheidungen in README.md ein.
