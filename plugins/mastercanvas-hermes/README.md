# Master Canvas Hermes Plugin

This is a starter Hermes Agent plugin for reading Master Canvas handoff packages.

## Install

Copy this folder to:

```bash
~/.hermes/plugins/master-canvas
```

Then restart Hermes.

## Tools

- `mastercanvas_capabilities`: explains package structure and workflow.
- `mastercanvas_inspect_package`: summarizes scenes, shots, assets, and readiness.
- `mastercanvas_extract_package`: extracts a handoff ZIP.
- `mastercanvas_comfy_plan`: returns a shot-by-shot ComfyUI/LTX 2.3 execution plan.

The plugin intentionally does not generate video by itself. It prepares the package so Hermes can hand the extracted job files to a ComfyUI skill/plugin.
