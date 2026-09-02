# `$lib/3d`

The 3D **asset catalog** — which scenes exist, what parts they have, and what may be
customized. Data, not UI.

It sits below the component layer because two different feature directories render from
it: `components/3d/` (the viewer and customizer) and `components/blog/embeds/` (scenes
embedded in posts). Putting it inside either would make one feature import the other.

`models.ts` here means *3D models*; the LLM model registry is `server/ai/providers.ts`.
