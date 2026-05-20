# Hermes Plugin

The starter Hermes plugin is in:

```text
plugins/mastercanvas-hermes
```

It reads Master Canvas handoff packages and prepares them for an agent workflow.

## Install

Copy the plugin folder to:

```bash
~/.hermes/plugins/master-canvas
```

Restart Hermes after copying.

## Tools

- `mastercanvas_capabilities`: explains package structure and workflow.
- `mastercanvas_inspect_package`: reads a handoff ZIP or extracted manifest and summarizes readiness.
- `mastercanvas_extract_package`: extracts a handoff ZIP into a local folder.
- `mastercanvas_comfy_plan`: returns a shot-by-shot ComfyUI/LTX 2.3 execution plan.

## Intended Agent Flow

1. User exports a Handoff ZIP from Master Canvas.
2. Hermes calls `mastercanvas_inspect_package`.
3. Hermes calls `mastercanvas_extract_package`.
4. Hermes calls `mastercanvas_comfy_plan`.
5. Hermes passes the resulting job files to its ComfyUI skill/plugin.
6. Generated clips are saved into scene bins from `deliverables/bin_plan.json`.

The plugin does not control ComfyUI by itself. It is the bridge between the visual planning app and whatever ComfyUI tooling Hermes already has.
