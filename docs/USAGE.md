# Usage Guide

Master Canvas is a local planning board for AI video pre-production.

## Basic Flow

1. Create a canvas.
2. Import images, video files, audio files, or reference links.
3. Add scene cards and shot cards.
4. Connect assets to shot or workflow cards.
5. Fill prompts, negative prompts, camera notes, lighting, lenses, action, sound, and review notes in the inspector.
6. Export a handoff package when the board is ready.

## Controls

- Cursor tool: select cards, lasso multiple cards, drag selected groups, edit connections.
- Hand tool: pan around the canvas.
- Mouse wheel: zoom.
- Asset drawer: search, filter, and drag assets onto the canvas.
- Inspector: edit the selected card, prompts, metadata, references, and review notes.
- Minimap: jump around large boards.
- Undo: recover accidental deletes or moves.

## Exports

- Markdown: readable prompt and shot package.
- Storyboard HTML: visual handoff page.
- Storyboard PDF: shareable visual storyboard.
- JSON: full project data.
- Handoff ZIP: assets, manifests, Hermes context, ComfyUI/LTX jobs, Kling/Veo prompts, and scene bin plan.

## Handoff ZIP Structure

```text
README.md
project_manifest.json
master-canvas-project.json
storyboard.html
shot-package.md
assets/
timeline/
hermes-agent/
comfyui/
kling-veo/
deliverables/
```

`project_manifest.json` is the source of truth for agents and operators.
