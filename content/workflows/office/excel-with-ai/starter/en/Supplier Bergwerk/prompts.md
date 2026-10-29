# Prompts for the Bergwerk sheet

One prompt at a time, in this order. Change the date to today.

## Draft the column description
Look at input/bergwerk-products.xlsx and draft the Columns table for README.md. Mark anything
you are unsure about with a question mark.

## Profile before changing anything
Read README.md. Write a Python script tools/profile.py that reads every row of
input/bergwerk-products.xlsx and reports, for each column: how many cells are filled, how many
different values there are, the ten most common values, and anything that does not fit the
description in README.md. Run it and show me the report. Don't change anything.

## Agree on the plan
Write the plan as a table: each target column, the source column it comes from, and the rule
that turns one into the other. List the values you could not map. Wait for my OK.

## Let the script do the work
Write tools/transform.py that follows the plan. It reads input/bergwerk-products.xlsx and writes
output/<date>/shop-import.xlsx with three sheets: products (the import), issues (every value it
could not convert, with the source row number and the reason) and changes (every cell it changed,
before and after). Store every cell as text so barcodes keep their leading zeros. Never guess: a
value that does not fit the rules stays unchanged and goes on issues. Run it and give me the
counts.

## Check by numbers
How many product rows are in the source, in products and in issues? Which assumptions did you
make that are not in README.md?

## Record
Add the decisions we made today to the Decisions section of README.md.

## Next month
New export in input/. Run tools/profile.py and tell me what is different from last time. If
nothing new, run tools/transform.py into output/<date>/.
