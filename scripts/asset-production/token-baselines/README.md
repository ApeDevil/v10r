# Token baselines

What an assistant would write *instead of* a parametric model, for the same three workloads,
so `modeling-tokens.ts` can compare the cost of each approach. Each file is the shortest
reasonable, complete program a careful assistant would emit for that tool — not a strawman
and not golfed. They are measured, never run: the `.txt` suffix keeps them out of every linter
and build.
