# Eine stimmige Präsentation mit KI erstellen

KI macht Folien schnell. Die Folien, die sie allein macht, ergeben selten eine Präsentation: Jede
für sich ist in Ordnung, zusammen sagen sie nichts Bestimmtes, die Zahlen passen nicht ganz zum
Bericht, und die Hälfte ignoriert die Firmenvorlage. Mehr Folien zu erzeugen ändert daran nichts.

Eine stimmige Präsentation entsteht aus Entscheidungen, die **vor** der ersten Folie fallen: für wen
sie ist, was das Publikum mitnehmen soll, die Geschichte in einer Handvoll Sätzen und woher jede
Zahl kommt. Dieses Tutorial legt diese Entscheidungen im
[KI-Aufgaben-Ordner](/de/workflows/ai-project-folder) ab und überlässt der KI den langsamen Teil:
eine abgestimmte Storyline in Folien umzusetzen.

Das durchgehende Beispiel: ein vierteljährliches Lieferantenreview für den Einkauf, erstellt aus
einem Word-Bericht und einer Excel-Tabelle mit Zahlen.

**[Den Beispiel-Ordner herunterladen](/de/workflows/powerpoint-with-ai/starter-de.zip)** zum
Mitmachen: Bericht und Zahlen in `input/`, das Briefing aus Schritt 2 als `README.md` und die Prompts
dieser Seite in `prompts.md`. Entpacken Sie ihn (Rechtsklick, **Alle extrahieren**) und legen Sie
Ihre Firmenvorlage in `template/`.

## Was Sie brauchen

- Den Ordner aus [Einen Ordner für die Arbeit mit KI anlegen](/de/workflows/ai-project-folder).
- Das Quellmaterial: Berichte, Notizen, Excel-Zahlen und eine frühere Präsentation, falls es eine
  gibt.
- Die Firmenvorlage (`.potx` oder eine `.pptx`, die sie verwendet). Fragen Sie die Person, die die
  Vorlagen betreut, nach der aktuellen; kopieren Sie nicht das Aussehen einer alten Präsentation von
  Hand.
- Das KI-Werkzeug, das Ihre Firma bereitstellt. Copilot in PowerPoint und ähnliche Assistenten
  können Folien aus einer Gliederungsdatei und der Vorlage bauen; ein Chat oder Agent schreibt die
  Storyline und die Sprechernotizen, und manche können die Vorlage mit einem Python-Skript direkt
  befüllen.

## 1. Den Ordner anlegen

```text
Lieferantenreview Q3/
  README.md                das Briefing: zuerst lesen
  input/
    q3-supplier-report.docx
    q3-figures.xlsx
  template/
    firmenvorlage.potx
  output/
    2026-10-29/
```

`input/` ist wie immer schreibgeschützt. Wenn eine Zahl im Bericht falsch ist, wird sie in der
nächsten Version des Berichts korrigiert, nicht still auf einer Folie.

## 2. Das Briefing schreiben

Für eine Präsentation ist `README.md` ein Briefing. Das meiste darin handelt vom Publikum und von der
Botschaft, nicht von Folien:

```markdown
# Lieferantenreview Q3 2026

## Publikum und Zweck
Teamleitungen im Einkauf, 20 Minuten im Monatsmeeting. Sie entscheiden, ob Bergwerk auf die
Beobachtungsliste kommt.

## Kernbotschaft (ein Satz)
Die Termintreue von Bergwerk ist in diesem Quartal von 94,4 % auf 80,8 % gefallen, und zwei
unserer drei größten Sortimente hängen von Bergwerk ab, deshalb sollten wir jetzt einen zweiten
Lieferanten qualifizieren.

## Quellen (input/)
- q3-supplier-report.docx: der Quartalsbericht; einzige Quelle für Text und Zusammenhang.
- q3-figures.xlsx, Blatt `Termintreue`: Bestellungen und pünktliche Lieferungen pro Monat;
  einzige Quelle für Lieferzahlen. Termintreue = pünktlich / Bestellungen.
- q3-figures.xlsx, Blatt `Sortiment`: Umsatzanteil und Hauptlieferant pro Sortiment.

## Regeln
- 8 bis 10 Folien einschließlich Titel und Zusammenfassung.
- Jeder Folientitel ist ein ganzer Satz, der die Aussage nennt („Die Termintreue fiel um fast
  14 Punkte“), kein Thema („Lieferung“).
- Jede Zahl auf einer Folie stammt aus einer benannten Quellzelle oder Seite. Höchstens eine
  Nachkommastelle.
- Eine Aussage pro Folie; höchstens 30 Wörter Fließtext; Details in die Sprechernotizen.
- Verwende die Firmenvorlage in template/; keine anderen Schriften oder Farben.
- Sprache: Deutsch.

## Fertig, wenn
- Die Folientitel allein erzählen die ganze Geschichte.
- Jede Zahl steht mit ihrer Quelle im Zahlen-Check.
```

Die **Kernbotschaft** ist die nützlichste Zeile im Ordner. Wenn Sie sie nicht in einem Satz
schreiben können, ist die Präsentation noch nicht bereit, gebaut zu werden, und keine KI findet die
Botschaft für Sie. Sie kann aber bei der Suche helfen: „Lies den Bericht und schlag mir drei
mögliche Kernbotschaften für dieses Publikum vor, jede in einem Satz.“

## 3. Zuerst die Storyline schreiben

Der erste Prompt fragt nach der Geschichte, nicht nach Folien:

> Lies README.md und die Dateien in input/. Schreib output/2026-10-29/storyline.md: für jede Folie
> den Titel als ganzen Satz, zwei oder drei stützende Punkte und die Quelle jeder Zahl (Datei, Blatt
> und Zelle oder Seite). Liste danach alles aus den Quellen auf, was du weggelassen hast, und warum.
> Mach noch keine Folien.

Das Ergebnis ist eine Seite einfacher Text:

```markdown
1. Bergwerk ist für unsere Kernsortimente kein verlässlicher Lieferant mehr
2. Die Termintreue fiel in einem Quartal von 94,4 % auf 80,8 %
   - Q2: 355 von 376 Bestellungen pünktlich (q3-figures.xlsx, Termintreue!B2:C4)
   - Q3: 316 von 391 Bestellungen pünktlich (Termintreue!B5:C7)
   - Schlechtester Monat September: 95 von 129, 73,6 % (Termintreue!B7:C7)
3. Zwei unserer drei größten Sortimente hängen von Bergwerk ab
   - Rucksäcke 34 % und Schlafausrüstung 27 % des Umsatzes (Sortiment!B2:B3)
   ...
```

Lesen Sie jetzt **nur die Titel**, einen nach dem anderen. Sie sollten jemandem, der die Folien nie
sieht, die ganze Geschichte erzählen. Wo sie das nicht tun, tut es die Präsentation auch nicht.
Korrigieren Sie die Storyline in Worten: „Tausch 3 und 4“, „Folie 5 sagt dasselbe wie Folie 2, fass
sie zusammen“, „Die Empfehlung braucht eine Kostenangabe“. Eine Textzeile zu ändern kostet nichts;
zehn fertige Folien zu ändern kostet einen Nachmittag.

Bitten Sie bewusst um die Liste des Weggelassenen. Sie zeigt, was die KI für unwichtig hielt, und
manchmal ist das genau der Punkt, nach dem Ihr Publikum fragen wird.

## 4. Aus der Storyline Folien machen

Erst jetzt entstehen die Folien, aus der abgestimmten Storyline und der Vorlage:

- **Mit einem Assistenten in PowerPoint:** Erstellen Sie eine neue Präsentation aus der
  Firmenvorlage, öffnen Sie den Chatbereich und bitten Sie ihn, die Präsentation aus
  `storyline.md` zu bauen und die Titel wörtlich zu übernehmen.
- **Mit einem Chat oder Agenten, der Python ausführt:** Bitten Sie um ein Skript in `tools/`, das
  die Layouts der Vorlage selbst mit der Storyline befüllt, damit das Ergebnis die echten Masterfolien
  verwendet, statt sie nachzuahmen. Das Skript läuft wieder, wenn sich die Storyline ändert.
- **Von Hand:** Mit einer guten Storyline bauen Sie zehn Folien in einer Stunde selbst, und das ist
  immer noch viel schneller als mit einer leeren Seite anzufangen.

Für Diagramme gilt eine zusätzliche Regel: **Erstellen Sie sie in Excel, aus dem Quellblatt**, und
fügen Sie sie ein. Ein Diagramm, das die KI aus Zahlen zeichnet, die sie in einem Dokument gelesen
hat, kann niemand prüfen. Ein Diagramm aus `q3-figures.xlsx` aktualisiert sich mit den Zahlen. Das
[Excel-Tutorial](/de/workflows/excel-with-ai) zeigt, wie die KI das Auswertungsblatt dahinter baut.

Bitten Sie dann um die Sprechernotizen:

> Schreib für jede Folie Sprechernotizen mit drei bis fünf Sätzen: was zu sagen ist und das Detail,
> das nicht auf die Folie passte. Verwende nur Fakten aus den Quellen.

## 5. Die Präsentation prüfen

| Prüfung | Wie | Sie findet |
|---|---|---|
| Titel durchlesen | Ansicht → Gliederung, nur die Titel lesen | Eine Präsentation ohne Geschichte |
| Zahlen-Check | „Liste jede Zahl der Präsentation mit Folie, Wert und Quellzelle auf; markiere jede, die du nicht zurückverfolgen kannst.“ Drei der Quellen selbst öffnen | Erfundene oder veraltete Zahlen |
| Vorlage | Jede Folie verwendet ein Layout der Vorlage; keine fremden Schriften oder Farben (Ihr Werkzeug hat vielleicht eine Markenprüfung) | Folien, die leicht falsch aussehen |
| Wortzahl | „Welche Folien haben mehr als 30 Wörter Fließtext?“ | Folien, die vorgelesen statt präsentiert werden |
| Publikum | „Welche drei Fragen werden die Teamleitungen im Einkauf danach stellen? Wird jede beantwortet?“ | Lücken, die Sie sonst erst im Meeting bemerken |

Speichern Sie das Ergebnis als `output/2026-10-29/supplier-review-q3.pptx` neben der Storyline und
dem Zahlen-Check, und tragen Sie alles, was Sie unterwegs entschieden haben, unter Entscheidungen
in der README ein.

## Nächstes Quartal

Kopieren Sie den Ordner, ersetzen Sie die Dateien in `input/`, passen Sie Kernbotschaft und Daten in
`README.md` an und beginnen Sie wieder bei Schritt 3. Briefing, Regeln und Vorlage bleiben; die
Storyline wird aus den neuen Zahlen neu gebaut, und der Zahlen-Check zeigt Ihnen, welche Folien sich
geändert haben.

## Wann der Ordner überflüssig ist

Ein Update mit drei Folien für das eigene Team braucht kein Briefing. Der Ordner lohnt sich, wenn
die Präsentation an Menschen geht, die auf ihrer Grundlage entscheiden, wenn die Zahlen stimmen
müssen oder wenn dieselbe Art Präsentation jeden Monat oder jedes Quartal wiederkommt.
