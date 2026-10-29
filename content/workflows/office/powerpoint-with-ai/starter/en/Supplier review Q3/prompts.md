# Prompts for the supplier review

One prompt at a time, in this order. Change the date to today.

## Find the key message (if you have none yet)
Read the report and give me three candidate key messages for this audience, each one sentence.

## Storyline first
Read README.md and the files in input/. Write output/<date>/storyline.md: for each slide, the
title as one full sentence, two or three supporting points, and the source of every number
(file, sheet and cell, or page). Then list anything from the sources you left out, and why.
Don't make slides yet.

## Slides from the storyline
Build the deck from output/<date>/storyline.md with the template in template/. Keep the titles
word for word. Charts come from input/q3-figures.xlsx.

## Speaker notes
For each slide, write speaker notes of three to five sentences: what to say, and the detail that
did not fit on the slide. Use only facts from the sources.

## Numbers check
List every number in the deck with slide, value and source cell; mark any you cannot trace.
Save it as output/<date>/numbers-check.md.

## Audience check
What three questions will purchasing leads ask after this? Is each answered?

## Record
Add the decisions we made today to the Decisions section of README.md.
