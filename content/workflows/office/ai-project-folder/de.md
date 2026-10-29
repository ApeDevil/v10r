# Einen Ordner für die Arbeit mit KI anlegen

Die meisten Menschen lernen KI als Chatfenster kennen: etwas hineinkopieren, etwas zurückbekommen,
morgen wieder bei null anfangen. Für eine einzelne Frage reicht das. Sobald eine Aufgabe echte
Eingangsdateien, ein paar Regeln und ein Ergebnis hat, auf das sich jemand verlässt, bricht es
zusammen: Die KI sieht nie das ganze Bild, und nichts von dem, was Sie vereinbart haben, überlebt
den Chat.

Die Lösung ist kein spezielles Programm. Es ist ein **Ordner**, der alles enthält, was die Aufgabe
braucht: die Dateien, die Sie bekommen haben, die Anweisungen in klaren Worten, die kleinen
Programme, die die KI schreibt, und jedes Ergebnis mit Datum. Jedes KI-Werkzeug, das Ihre Firma
bereitstellt, kann mit diesem Ordner arbeiten, ebenso eine Kollegin, ein Kollege oder Sie selbst
im nächsten Monat.

Dieses Tutorial legt den Ordner an. Die beiden folgenden nutzen ihn für echte Arbeit:
[Excel-Tabellen](/de/workflows/excel-with-ai) und [Präsentationen](/de/workflows/powerpoint-with-ai).

**[Den leeren Aufgaben-Ordner herunterladen](/de/workflows/ai-project-folder/starter-de.zip)**: das
Ordnergerüst, eine README-Vorlage zum Ausfüllen und eine Seite mit Prompts für die Runden aus
Schritt 5. Entpacken Sie ihn (Rechtsklick, **Alle extrahieren**) dort, wo Sie Ihre Arbeitsdateien
ablegen.

## Die drei Dinge, die jede KI-Aufgabe braucht

| Zutat | Was es ist | Wo es liegt |
|---|---|---|
| **Quellen** | Die Dateien, mit denen die Arbeit beginnt, genau so, wie Sie sie bekommen haben | `input/` |
| **Anweisungen** | Das Ziel, was die Quellen bedeuten, die Regeln und wie „fertig“ aussieht | `README.md` |
| **Werkzeuge** | Kleine Programme (meist Python), die zählen und ändern | `tools/` |

Das vierte Ding, das **Ergebnis**, legt die KI in `output/` ab. Wenn eine Aufgabe schiefgeht, fehlt
fast immer eines der drei: Die KI rät, was eine Spalte bedeutet (keine Anweisungen), arbeitet mit
den ersten fünfzig Zeilen, die sie sehen konnte (keine Werkzeuge), oder ändert die Originaldatei
(kein klarer Platz für Quellen).

## 1. Den Ordner anlegen

Ein Ordner pro Aufgabe, dort, wo Sie Arbeitsdateien ablegen: Dokumente, OneDrive, eine Teamseite
oder ein Netzlaufwerk. Geben Sie ihm einen Namen, den eine Kollegin verstehen würde.

```text
Lieferant Bergwerk/
  README.md       die Anweisungen: zuerst lesen
  input/          die Dateien, wie sie gekommen sind, nie verändert
  tools/          Programme der KI, aufbewahrt, damit die Aufgabe wieder laufen kann
  output/         ein Ordner mit Datum pro Ergebnis
    2026-10-29/
```

Vier Regeln halten ihn funktionsfähig:

1. **`input/` ist schreibgeschützt.** Niemand bearbeitet eine Quelldatei, weder Sie noch die KI.
   Ein falsches Ergebnis kann man immer wegwerfen; eine geänderte Quelle lässt sich nicht
   zurückändern.
2. **Jedes Ergebnis kommt in einen neuen Ordner mit Datum** unter `output/`, damit das letzte gute
   Ergebnis nie überschrieben wird.
3. **Eine Aufgabe pro Ordner.** Ein zweiter Lieferant oder eine zweite Präsentation ist ein zweiter
   Ordner. Kopieren Sie den ersten und tauschen Sie die Dateien aus.
4. **Entscheidungen werden aufgeschrieben**, in `README.md`, nicht im Chat gelassen. Ein Chat
   endet; die Datei bleibt.

`README.md` ist eine einfache Textdatei. Legen Sie sie im Explorer an (**Neu → Textdokument**, dann
umbenennen) und öffnen Sie sie mit dem Editor oder einem anderen Programm, das Ihre Firma
bereitstellt. Die Endung `.md` steht für „Markdown“: einfacher Text, in dem `#` eine Überschrift
und `-` einen Listenpunkt beginnt. Jedes KI-Werkzeug liest das gut.

## 2. Die Anweisungen schreiben

Die Anweisungen sind die wichtigste Datei im Ordner, und sie sind kurz. Schreiben Sie sie, bevor
Sie ein KI-Werkzeug öffnen: Wenn Sie nicht sagen können, wie „fertig“ aussieht, kann es die KI auch
nicht.

```markdown
# Lieferant Bergwerk: Produktliste für den Shop-Import

## Ziel
Den monatlichen Produktexport von Bergwerk in die Tabelle umwandeln, die unser Shop importiert.

## Quellen (input/)
- `bergwerk-products.xlsx`, Blatt `Export`: eine Zeile pro Produkt, Überschriften in Zeile 1.
  Was die Spalten bedeuten, steht unten unter „Spalten“.

## Ergebnis (output/<Datum>/)
- `shop-import.xlsx` mit den Spalten unter „Ziel-Format“.
- Ein Blatt `issues`: jeder Wert, der sich nicht umwandeln ließ, mit seiner Quellzeile.

## Regeln
- Ändere nie die Dateien in input/.
- Zählen und Umrechnen erledigt ein Python-Skript in tools/, nicht das Lesen der Zeilen.
- Rate nie. Ein Wert, den du nicht umwandeln kannst, bleibt unverändert und kommt auf issues.
- Frag mich, bevor du eine Spalte oder Zeile weglässt.

## Fertig, wenn
- Jede Produktzeile der Quelle steht im Ergebnis (gleiche Anzahl).
- Jeder Wert im Ergebnis entspricht dem Ziel-Format oder steht in issues.

## Entscheidungen
- 2026-10-29: Gewichte ohne Einheit sind Gramm (jedes Gewicht mit Einheit liegt unter 2 kg).
```

Die Abschnitte, die bei jeder Aufgabe zählen, egal welcher Dateityp:

| Abschnitt | Beantwortet | Ohne ihn … |
|---|---|---|
| Ziel | Wofür ist das, und für wen? | optimiert die KI auf das Falsche |
| Quellen | Welche Datei, welches Blatt, was eine Zeile oder Seite ist | rät sie, was Spalten bedeuten |
| Ergebnis | Welche Datei, wo, in welchem Format | erfindet sie ein Format, das Sie dann umbauen |
| Regeln | Was sie nie tun darf, wann sie fragen muss | ändert sie Dinge, um die Sie nicht gebeten haben |
| Fertig, wenn | Wie Sie das Ergebnis prüfen | hört sie bei „sieht plausibel aus“ auf |
| Entscheidungen | Was schon geklärt ist, mit Datum | fragt sie erneut oder entscheidet nächstes Mal anders |

Der Abschnitt **Entscheidungen** wächst mit der Zeit. Jedes Mal, wenn Sie eine Frage der KI
beantworten, kommt eine Zeile dazu. Nach zwei oder drei Durchläufen erklärt sich die Aufgabe von
selbst.

## 3. Das KI-Werkzeug wählen

Nutzen Sie die KI-Werkzeuge, die Ihre Firma bereitstellt und freigibt. Laden Sie keine Firmendateien
in einen Dienst hoch, den Ihre Firma nicht freigegeben hat. Der Ordner funktioniert mit allen drei
Arten von Werkzeug; anders ist nur, wie die Anweisungen zur KI gelangen.

| Art von Werkzeug | Beispiele | Wie es die Anweisungen bekommt | Gut für |
|---|---|---|---|
| **Assistent in der App** | Copilot in Excel oder PowerPoint | Den Text von `README.md` in den Chatbereich einfügen | Eine offene Datei, schnelle Fragen und Änderungen |
| **Chat mit Datei-Upload** | Copilot Chat, ChatGPT, Claude, Gemini | `README.md` und die Dateien aus `input/` hochladen, Ergebnisse selbst in `output/` speichern | Auswertungen über einige Dateien; führt Python für Sie aus |
| **Agent im Ordner** | Copilot CLI, Claude Code, Codex, eine Desktop-Agenten-App | Auf den Ordner zeigen; er liest `README.md` selbst und schreibt in `output/` | Wiederkehrende Aufgaben, viele Dateien, alles, was nächsten Monat wieder laufen muss |

Manche Agenten lesen von sich aus eine Datei mit festem Namen, etwa `AGENTS.md`. Wenn Ihrer das
tut, nennen Sie die Anweisungsdatei so, oder beginnen Sie jede Sitzung mit „Lies zuerst README.md
und halte dich daran“. So oder so liegen die Anweisungen im Ordner, nicht in Ihrem Kopf.

## 4. Python das Zählen überlassen

Ein Sprachmodell liest und schreibt Text. Es ist gut darin zu verstehen, was eine Spalte bedeutet,
und zu entscheiden, was mit ihr geschehen soll. Es ist schlecht darin, dasselbe mit vierzigtausend
Zeilen zu tun, und es nennt Ihnen bereitwillig eine Summe, die es nie wirklich ausgerechnet hat.

Teilen Sie die Arbeit deshalb auf:

- **Die KI entscheidet**, was zu tun ist: Sie sieht sich die Daten an, erklärt sie, schlägt die
  Schritte vor.
- **Ein Skript führt es aus**: ein kurzes Python-Programm, von der KI geschrieben, das die Quelle
  liest und das Ergebnis schreibt. Es macht mit jeder Zeile genau dasselbe, jedes Mal.
- **Sie prüfen** das Ergebnis gegen „Fertig, wenn“.

Sie müssen Python weder installieren noch selbst schreiben. Chat-Werkzeuge führen das Python der KI
in ihrer eigenen Umgebung aus, Excel kann Python in einer Zelle ausführen (`=PY(...)`), wo Ihre
Firma es freigeschaltet hat, und Agenten verwenden das Python, das schon auf Ihrem Laptop ist, wenn
die IT es bereitstellt. Lassen Sie das Skript in `tools/` speichern: Es dokumentiert genau, was
getan wurde, und läuft nächsten Monat ohne neues Gespräch wieder.

## 5. In Runden arbeiten

Egal welche Aufgabe, das Gespräch hat dieselbe Form. Jeder Schritt ist eine kurze Nachricht.

1. **Briefing.** „Lies README.md. Sieh dir dann die Dateien in input/ an und beschreibe mit eigenen
   Worten, was sie enthalten und was du vorhast. Ändere noch nichts.“
2. **Korrigieren.** Die Zusammenfassung der KI zeigt, was sie missverstanden hat. Beheben Sie das
   Missverständnis in `README.md`, nicht nur im Chat, und sagen Sie dann: „Ich habe README.md
   aktualisiert, lies sie noch einmal.“
3. **Planen.** „Schreib den Plan als nummerierte Liste und warte auf mein OK.“
4. **Ausführen.** „Leg los. Speichere das Skript in tools/ und das Ergebnis in output/2026-10-29/.“
5. **Prüfen.** „Prüfe das Ergebnis gegen ‚Fertig, wenn‘ in README.md und liste alles auf, was nicht
   passt.“ Sehen Sie dann selbst nach (jedes Tutorial sagt, worauf).
6. **Festhalten.** „Trag die Entscheidungen von heute im Abschnitt Entscheidungen in README.md ein.“

Die erste Runde dauert am längsten. Wenn dieselbe Art Datei zum zweiten Mal kommt, schrumpfen die
Schritte 1 bis 3 auf eine Nachricht: „Neue Datei in input/. Führe das Skript in tools/ aus und sag
mir, was sich gegenüber dem letzten Mal geändert hat.“

## 6. Übergeben

Der Ordner ist die ganze Aufgabe: was hereinkam, was verlangt war, wie es gemacht wurde und was
herauskam, nach Datum. Packen Sie ihn als ZIP, legen Sie ihn aufs Netzlaufwerk oder schicken Sie
ihn einem Kollegen, und er kann mit dem KI-Werkzeug weitermachen, das er hat.

Weiter: [eine Excel-Tabelle auswerten und umwandeln](/de/workflows/excel-with-ai) in diesem Ordner,
oder auf dieselbe Weise [eine Präsentation erstellen](/de/workflows/powerpoint-with-ai).
