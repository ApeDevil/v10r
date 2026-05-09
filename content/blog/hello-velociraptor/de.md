---
id: 019e0bd2-9cf9-775b-8208-ab374dff5cb5
slug: hello-velociraptor
title: 'Hallo, Velociraptor'
summary: Ein erster mehrsprachiger Beitrag, übertragen über den Datei-Workflow.
tags: []
status: draft
date: '2026-05-09'
sourceContentHash: b9ecd12003c82a2fd85ef8d5667dca4c0518dabeb762904f5e7212be500df0c7
---

Dies ist der erste Beitrag, der über den Datei-als-Quelle-Workflow für Inhalte übertragen wurde.

Der Beitrag liegt als drei Markdown-Dateien vor: `en.md`, `de.md`, `ru.md`. Die englische Datei ist die maßgebliche Quelle. Die deutsche und russische Datei sind Übersetzungen, die im Dev-Loop entstehen. Bei jeder Übertragung wird ein Inhalts-Hash berechnet; identische Dateien bleiben unverändert.

## Was hier geprüft wird

- Das Scaffold-Skript schreibt ein Frontmatter mit einer stabilen UUID.
- `bun run content:check` meldet fehlende Sprachen und veraltete Übersetzungen.
- `bun run content:push` legt den Beitrag an und erzeugt eine Revision pro Sprache.
- Eine erneute Übertragung ohne Änderungen ist ein No-Op (Skip per Hash).
- Die Vorschau-Route unter `/admin/content/posts/preview/<slug>/<locale>` rendert aus der Datei und zeigt in einem Banner an, ob die Datei mit der Datenbank übereinstimmt.

## Warum erst die Datei

Dateien liegen in Git. Übersetzungen werden in Pull Requests geprüft – nicht in einem CMS. Cony schreibt dieselbe Datei, die der Entwickler liest. Die Datenbank ist nur ein schneller Lookup-Index – nichts Originales liegt dort, das nicht über eine Datei reingekommen wäre.
