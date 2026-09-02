# `$lib/server/showcases`

Server code that exists to **demonstrate** a pattern, not to run the product.

Everything here backs a page under `(public)/showcases/`. It is written to the same
standard as the rest of the tree — that is the point, these are the reference
implementations people copy — but it owns no product behaviour, and deleting a showcase
page should never break anything outside this directory.

The distinction matters because this repo *is* a pattern library: a reader who copies
`showcases/cycle/` should know they are copying a demonstration of request-lifecycle
instrumentation, not a service the app depends on.

Product domains that a showcase merely happens to be the only current caller of —
`imagemeta/`, for instance, which owns a real `image` pgSchema and feeds AI cost
accounting — stay outside this directory.
