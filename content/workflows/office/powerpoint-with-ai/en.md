# Build a coherent presentation with AI

AI makes slides quickly. The slides it makes on its own rarely make a presentation: each one is
fine, together they say nothing in particular, the numbers do not quite match the report, and half
of them ignore the company template. Generating more slides does not fix that.

A coherent deck comes from decisions made **before** the first slide: who it is for, the one thing
they should take away, the story in a handful of sentences, and where every number comes from.
This tutorial puts those decisions into the [AI project folder](/workflows/ai-project-folder) and
lets the AI do the slow part, turning an agreed storyline into slides.

The running example: a quarterly supplier review for the purchasing team, built from a Word
report and an Excel sheet of figures.

**[Download the example folder](/workflows/powerpoint-with-ai/starter-en.zip)** to follow along:
the report and the figures in `input/`, the brief from step 2 as `README.md`, and the prompts from
this page in `prompts.md`. Unpack it (right-click, **Extract All**) and add your company template
to `template/`.

## What you need

- The folder from [Set up a folder for AI work](/workflows/ai-project-folder).
- The source material: reports, notes, Excel figures, and an earlier deck if there is one.
- The company template (`.potx` or a `.pptx` that uses it). Ask whoever looks after templates for
  the current one; do not copy the look of an old deck by hand.
- Whatever AI tool your company provides. Copilot in PowerPoint and similar assistants can build
  slides from an outline file and the template; a chat or agent writes the storyline and the
  speaker notes, and some can fill the template directly with a Python script.

## 1. Set up the folder

```text
Supplier review Q3/
  README.md                the brief: read this first
  input/
    q3-supplier-report.docx
    q3-figures.xlsx
  template/
    company-template.potx
  output/
    2026-10-29/
```

`input/` is read-only, as always. If a figure in the report is wrong, it is corrected in the
report's next version, not quietly on a slide.

## 2. Write the brief

For a deck, `README.md` is a brief. Most of it is about the audience and the message, not about
slides:

```markdown
# Supplier review Q3 2026

## Audience and purpose
Purchasing team leads, 20 minutes in the monthly meeting. They decide whether to put
Bergwerk on the watch list.

## Key message (one sentence)
Bergwerk's on-time delivery fell from 94.4% to 80.8% this quarter, and two of our three
biggest product lines depend on them, so we should start qualifying a second supplier now.

## Sources (input/)
- q3-supplier-report.docx: the quarterly report; the only source for text and context.
- q3-figures.xlsx, sheet `OnTime`: orders and on-time deliveries per month; the only
  source for delivery figures. On-time rate = on time / orders.
- q3-figures.xlsx, sheet `Lines`: revenue share and main supplier per product line.

## Rules
- 8 to 10 slides including title and summary.
- Every slide title is a full sentence that states the point ("On-time delivery fell almost 14 points"),
  not a topic ("Delivery").
- Every number on a slide comes from a named source cell or page. No rounding beyond one decimal.
- One idea per slide; at most 30 words of body text; details go into the speaker notes.
- Use the company template in template/; no other fonts or colours.
- Language: English.

## Done when
- Reading only the slide titles tells the whole story.
- Every number is in the numbers check, with its source.
```

The **key message** is the most useful line in the folder. If you cannot write it in one sentence,
the deck is not ready to be built, and no AI will find the message for you. It can help you look
for it, though: "Read the report and give me three candidate key messages for this audience, each
one sentence."

## 3. Write the storyline first

The first prompt asks for the story, not for slides:

> Read README.md and the files in input/. Write output/2026-10-29/storyline.md: for each slide,
> the title as one full sentence, two or three supporting points, and the source of every number
> (file, sheet and cell, or page). Then list anything from the sources you left out, and why.
> Don't make slides yet.

The result is a page of plain text:

```markdown
1. Bergwerk is no longer a reliable supplier for our core lines
2. On-time delivery fell from 94.4% to 80.8% in one quarter
   - Q2: 355 of 376 orders on time (q3-figures.xlsx, OnTime!B2:C4)
   - Q3: 316 of 391 orders on time (OnTime!B5:C7)
   - Worst month September: 95 of 129, 73.6% (OnTime!B7:C7)
3. Two of our three biggest product lines depend on Bergwerk
   - Backpacks 34% and sleeping gear 27% of revenue (Lines!B2:B3)
   ...
```

Now read **only the titles**, one after the other. They should tell the whole story to someone who
never sees the slides. Wherever they do not, the deck will not either. Fix the storyline in words:
"Swap 3 and 4", "Slide 5 says the same as slide 2, merge them", "The recommendation needs a cost".
Changing a line of text costs nothing; changing ten finished slides costs an afternoon.

Ask for the left-out list on purpose. It shows what the AI judged unimportant, and sometimes
that is exactly the point your audience will ask about.

## 4. Turn the storyline into slides

Only now do the slides get made, from the agreed storyline and the template, one deck at a time:

- **With an assistant in PowerPoint:** create a new presentation from the company template, open
  the chat pane, and ask it to build the deck from `storyline.md`, keeping the titles word for
  word.
- **With a chat or agent that runs Python:** ask for a script in `tools/` that fills the template's
  own layouts with the storyline, so the result uses the real master slides instead of imitating
  them. The script runs again when the storyline changes.
- **By hand:** with a good storyline, building ten slides yourself is an hour, and still much
  faster than starting from a blank page.

Charts deserve one extra rule: **make them in Excel, from the source sheet**, and paste them in.
A chart the AI draws from numbers it read in a document is a chart nobody can check. A chart made
from `q3-figures.xlsx` updates when the figures do. The [Excel tutorial](/workflows/excel-with-ai)
shows how to have the AI build the summary sheet behind it.

Then ask for the speaker notes:

> For each slide, write speaker notes of three to five sentences: what to say, and the detail that
> did not fit on the slide. Use only facts from the sources.

## 5. Check the deck

| Check | How | It catches |
|---|---|---|
| Title read-through | View → Outline, read only the titles | A deck without a story |
| Numbers check | "List every number in the deck with slide, value and source cell; mark any you cannot trace." Open three of the sources yourself | Invented or outdated numbers |
| Template | Every slide uses a layout from the template; no stray fonts or colours (your tool may have a brand checker) | Slides that look slightly wrong |
| Word count | "Which slides have more than 30 words of body text?" | Slides that are read out instead of presented |
| Audience | "What three questions will purchasing leads ask after this? Is each answered?" | Gaps you will only notice in the meeting |

Save the result as `output/2026-10-29/supplier-review-q3.pptx`, next to the storyline and the
numbers check, and add anything you decided along the way to the README's Decisions.

## Next quarter

Copy the folder, replace the files in `input/`, update the key message and the dates in
`README.md`, and start again at step 3. The brief, the rules and the template stay; the storyline is
rebuilt from the new figures, and the numbers check tells you which slides changed.

## When to skip the folder

A three-slide update for your own team does not need a brief. The folder pays off when the deck
goes to people who will make a decision on it, when the numbers must be right, or when the same
kind of deck comes back every month or quarter.
