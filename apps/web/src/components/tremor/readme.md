# Tremor components

`card.tsx` and `badge.tsx` are adapted from
[tremorlabs/template-overview](https://github.com/tremorlabs/template-overview)
(MIT), with the template's visual structure preserved.

The upstream components use fixed gray/blue colors and dark variants. These
versions keep only the light presentation and replace every color with Torii's
CSS-variable tokens (`--color-surface`, `--color-line`, `--color-ink`, and so
on). That keeps a future theme switch down to a token override.
