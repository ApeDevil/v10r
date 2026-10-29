# Set up a folder for AI work

Most people meet AI as a chat box: paste something in, get something back, start again from zero
tomorrow. That is fine for one question. It falls apart as soon as the job has real inputs, a few
rules and a result someone else will rely on, because the AI never sees the whole picture and
nothing of what you agreed on survives the chat.

The fix is not a special program. It is a **folder** that holds everything the job needs: the
files you received, the instructions in plain words, the small programs the AI writes, and every
result with its date. Any AI tool your company gives you can work from that folder, and so can a
colleague, or you, next month.

This tutorial sets up that folder. The two that follow use it for real work:
[Excel sheets](/workflows/excel-with-ai) and [presentations](/workflows/powerpoint-with-ai).

## The three things every AI job needs

| Ingredient | What it is | Where it lives |
|---|---|---|
| **Sources** | The files the work starts from, exactly as you received them | `input/` |
| **Instructions** | The goal, what the sources mean, the rules and what "done" looks like | `README.md` |
| **Tools** | Small programs (usually Python) that do the counting and the changing | `tools/` |

The AI adds the fourth thing, the **result**, into `output/`. When a job goes wrong it is almost
always because one of the three is missing: the AI guesses what a column means (no instructions),
works from the first fifty rows it could see (no tools), or changes the original file (no clear
place for sources).

## 1. Make the folder

One folder per job, wherever you keep work files: your documents, OneDrive, a team site or a
shared drive. Give it a name a colleague would understand.

```text
Supplier Bergwerk/
  README.md       the instructions: read this first
  input/          the files as you received them, never changed
  tools/          programs the AI wrote, kept so the job can run again
  output/         one dated folder per result
    2026-10-29/
```

Four rules keep it working:

1. **`input/` is read-only.** Nobody edits a source file, not you and not the AI. A wrong result
   can always be thrown away; a changed source cannot be un-changed.
2. **Every result goes into a new dated folder** under `output/`, so the last good result is
   never overwritten.
3. **One job per folder.** A second supplier or a second deck is a second folder. Copy the first
   one and swap the files.
4. **Decisions are written down** in `README.md`, not left in a chat. A chat ends; the file stays.

`README.md` is a plain text file. Create it in Explorer (**New → Text Document**, then rename it),
and open it with Notepad, or with any editor your company provides. The `.md` ending means
"Markdown": plain text where `#` starts a heading and `-` starts a list item. Every AI tool reads
it well.

## 2. Write the instructions

The instructions are the most important file in the folder, and they are short. Write them before
you open any AI tool: if you cannot say what done looks like, the AI cannot either.

```markdown
# Supplier Bergwerk: product sheet for the shop import

## Goal
Turn Bergwerk's monthly product export into the sheet our shop imports.

## Sources (input/)
- `bergwerk-products.xlsx`, sheet `Export`: one row per product, headers in row 1.
  Column meanings are listed under "Columns" below.

## Result (output/<date>/)
- `shop-import.xlsx` with the columns listed under "Target".
- An `issues` sheet: every value that could not be converted, with its source row.

## Rules
- Never change the files in input/.
- Do counting and converting with a Python script in tools/, not by reading the rows.
- Never guess. A value you cannot convert stays as it is and goes on the issues sheet.
- Ask me before you drop a column or a row.

## Done when
- Every product row from the source is in the result (same count).
- Every value in the result matches the target format, or is listed in issues.

## Decisions
- 2026-10-29: weights without a unit are grams (all other weights are 0.2 to 2 kg).
```

The sections that matter in every job, whatever the file type:

| Section | Answers | Without it the AI… |
|---|---|---|
| Goal | What is this for, and for whom? | optimises for the wrong thing |
| Sources | Which file, which sheet, what one row or one page is | guesses the meaning of columns |
| Result | Which file, where, in which format | invents a format you then reformat |
| Rules | What it must never do, when it must ask | changes things you did not ask for |
| Done when | How you will check the result | stops at "looks plausible" |
| Decisions | What you already settled, with the date | asks again, or decides differently next time |

The **Decisions** section grows over time. Every time you answer a question the AI asks, add one
line. After two or three runs the job explains itself.

## 3. Pick the AI tool

Use the AI tools your company provides and approves. Do not upload company files to a service
your company has not approved. The folder works with all three kinds of tool; what changes is how
the instructions reach the AI.

| Kind of tool | Examples | How it gets the instructions | Good for |
|---|---|---|---|
| **Assistant inside the app** | Copilot in Excel or PowerPoint | Paste the text of `README.md` into the chat pane | One open file, quick questions and edits |
| **Chat with file upload** | Copilot Chat, ChatGPT, Claude, Gemini | Upload `README.md` and the files from `input/`, then save the results into `output/` yourself | Analysis across a few files; runs Python for you |
| **Agent in the folder** | Copilot CLI, Claude Code, Codex, a desktop agent app | Point it at the folder; it reads `README.md` itself and writes into `output/` | Repeated jobs, many files, anything that must run again next month |

Some agents read a file with a fixed name on their own, such as `AGENTS.md`. If yours does, call
the instruction file that, or start every session with "Read README.md first and follow it".
Either way the instructions live in the folder, not in your head.

## 4. Let Python do the counting

A language model reads and writes text. It is good at understanding what a column means and
deciding what should happen to it. It is bad at doing the same thing to forty thousand rows, and
it will happily give you a total it never actually added up.

So split the work:

- **The AI decides** what to do: it looks at the data, explains it, proposes the steps.
- **A script does it**: a short Python program, written by the AI, that reads the source and writes
  the result. It does exactly the same thing to every row, every time.
- **You check** the result against "Done when".

You do not need to install Python or write it yourself. Chat tools run the AI's Python in their own
sandbox, Excel can run Python in a cell (`=PY(...)`) where your company has it switched on, and
agents use the Python already on your laptop when IT provides it. Ask for the script to be saved
into `tools/`: it is the record of exactly what was done, and next month it runs again without a
new conversation.

## 5. Work in rounds

Whatever the job, the conversation has the same shape. Each step is one short message.

1. **Brief.** "Read README.md. Then look at the files in input/ and tell me, in your own words,
   what they contain and what you are going to do. Don't change anything yet."
2. **Correct.** The AI's summary shows what it misunderstood. Fix the misunderstanding in
   `README.md`, not only in the chat, then say "I updated README.md, read it again."
3. **Plan.** "Write the plan as a numbered list, and wait for my OK."
4. **Do.** "Go ahead. Put the script in tools/ and the result in output/2026-10-29/."
5. **Check.** "Check the result against 'Done when' in README.md and list anything that fails."
   Then look yourself (each tutorial says what to look at).
6. **Record.** "Add the decisions we made today to the Decisions section of README.md."

The first round takes the longest. The second time the same kind of file arrives, steps 1 to 3
shrink to one message: "New file in input/. Run the script in tools/ and tell me what is different
from last time."

## 6. Hand it over

The folder is the whole job: what came in, what was asked, how it was done and what came out, by
date. Zip it, put it on the shared drive or send it to a colleague, and they can continue with
whatever AI tool they have.

Next: [analyse and transform an Excel sheet](/workflows/excel-with-ai) in this folder, or
[build a presentation](/workflows/powerpoint-with-ai) the same way.
