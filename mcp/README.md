# master-canvas-mcp

Headless MCP (Model Context Protocol) server for **[Master Canvas](https://github.com/wassermanproductions/master-canvas)** — the local-first pre-production canvas for AI video planning, prompts, assets, and handoff packages. With this server connected, an AI agent can read and edit a Master Canvas project and build generator-ready handoff packages **without opening the desktop app** — it works directly on the project's JSON data on disk.

An agent can create a board, add scene/shot/reference cards, write prompts and negative prompts, set camera and lighting notes, attach source images and reference links, order shots, and export a complete handoff package for ComfyUI/LTX, Kling, Veo, or a downstream agent.

Zero dependencies. Node ≥ 18. One file.

## What it operates on

Master Canvas stores each board as a project JSON file (the same shape the app exports as **`master-canvas-project.json`**): `{ title, continuity, assets[], nodes[] }`. A **card** is a node; a **board** is a project file. This server reads and writes that file directly.

The project file is resolved in this order:

1. the `projectPath` argument on a tool call, if given;
2. the `MASTER_CANVAS_PROJECT` environment variable;
3. the default app-data location — `~/Library/Application Support/master-canvas/master-canvas-project.json` on macOS (`%APPDATA%\master-canvas\…` on Windows, `$XDG_CONFIG_HOME/master-canvas/…` on Linux).

Source files attached with `attach_asset` are copied next to the project into a `<project>-assets/` folder, so a project stays self-contained and portable.

## Requirements

- **Node ≥ 18.** No build step, no `npm install` — the server uses only Node built-ins.
- A Master Canvas project JSON file (create one with `create_project`, or point at a `master-canvas-project.json` you exported from the app).

## Connect

### Hermes

Add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  master-canvas:
    command: "node"
    args: ["/absolute/path/to/master-canvas-mcp/master-canvas-mcp.mjs"]
    env:
      MASTER_CANVAS_PROJECT: "/absolute/path/to/your/master-canvas-project.json"
```

### Claude Code

```bash
claude mcp add master-canvas \
  --env MASTER_CANVAS_PROJECT=/absolute/path/to/your/master-canvas-project.json \
  -- node /absolute/path/to/master-canvas-mcp/master-canvas-mcp.mjs
```

### Codex

Add to your Codex MCP config (`~/.codex/config.toml`):

```toml
[mcp_servers.master-canvas]
command = "node"
args = ["/absolute/path/to/master-canvas-mcp/master-canvas-mcp.mjs"]
env = { MASTER_CANVAS_PROJECT = "/absolute/path/to/your/master-canvas-project.json" }
```

### Any MCP client (generic stdio config)

```json
{
  "mcpServers": {
    "master-canvas": {
      "command": "node",
      "args": ["/absolute/path/to/master-canvas-mcp/master-canvas-mcp.mjs"],
      "env": { "MASTER_CANVAS_PROJECT": "/absolute/path/to/your/master-canvas-project.json" }
    }
  }
}
```

## Tools (14)

Call **`get_project` first** — its response explains the data conventions (scene binding, shot order, card types).

| Tool | What it does |
| --- | --- |
| `get_project` | Read the project and summarize title, continuity, cards by type, scene keys, shot order, and assets. Start here. |
| `create_project` | Create a new empty project JSON. |
| `list_cards` | List cards (nodes) with type, title, scene key, order label, and position. |
| `get_card` | Full record of one card. |
| `add_card` | Add a card: `media` (a shot to generate), `scene`/`section`/`shot` (scene heads), `workflow`/`imageWorkflow` (generation steps), `styleRef`/`musicRef` (references), `placeholder`, `note`. |
| `update_card` | Change fields on a card (prompt, negative prompt, camera, lighting, provider, etc.). |
| `move_card` | Reposition a card. Canvas order drives scene grouping and shot order. |
| `delete_card` | Remove a card. |
| `set_shot_order` | Set explicit shot order from an ordered list of card ids. |
| `attach_asset` | Register a file (copied into the project) or a link, and optionally link it to a card slot. |
| `set_continuity` | Update the continuity bible (characters, wardrobe, locations, props, style rules, never-change). |
| `build_handoff_package` | Assemble a generator-ready package: `project_manifest.json`, copied `assets/`, a ComfyUI/LTX shot manifest and per-shot jobs, a Hermes job, `timeline/` shot order + scene bins, `deliverables/bin_plan.json`, and a readable `shot-package.md`. |
| `inspect_package` | Summarize an existing handoff package (scenes, shots, assets, readiness). |
| `comfy_plan` | Emit a shot-by-shot ComfyUI/LTX execution plan from a package or manifest. |

`build_handoff_package`, `inspect_package`, and `comfy_plan` produce and read the same `project_manifest.json` contract (`schema: master-canvas-handoff-v1`) that the Master Canvas app's Hermes plugin uses, so packages built here are drop-in compatible with existing Hermes / ComfyUI tooling.

A typical agent session: `get_project` → `set_continuity` → `add_card` (scene) → `add_card` (media shots) → `update_card` (prompts/camera) → `attach_asset` (source images) → `set_shot_order` → `build_handoff_package` → hand the folder to a ComfyUI/LTX or Kling/Veo workflow.

## Security

This server only touches the local filesystem: it reads and writes the Master Canvas project JSON and copies asset files you point it at into the project folder. It opens no network connections and exposes nothing off-machine. Point it only at project paths you trust.

## License & credit

MIT — see [LICENSE](LICENSE). Per the [NOTICE](NOTICE) file, please credit **Sam Wasserman ([wassermanproductions.com](https://wassermanproductions.com))** in uses, forks, and redistributions.
