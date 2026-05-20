"""Tool schemas exposed to Hermes for Master Canvas packages."""

PACKAGE_PATH_FIELD = {
    "type": "string",
    "description": "Absolute path to a Master Canvas handoff ZIP or extracted project_manifest.json.",
}


MASTERCANVAS_CAPABILITIES = {
    "name": "mastercanvas_capabilities",
    "description": "Explain how to use the Master Canvas Hermes plugin.",
    "parameters": {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    },
}


MASTERCANVAS_INSPECT_PACKAGE = {
    "name": "mastercanvas_inspect_package",
    "description": "Read a Master Canvas handoff ZIP or manifest and summarize project, scenes, shots, assets, and readiness.",
    "parameters": {
        "type": "object",
        "properties": {
            "package_path": PACKAGE_PATH_FIELD,
        },
        "required": ["package_path"],
        "additionalProperties": False,
    },
}


MASTERCANVAS_EXTRACT_PACKAGE = {
    "name": "mastercanvas_extract_package",
    "description": "Extract a Master Canvas handoff ZIP into a local folder for ComfyUI or another generation workflow.",
    "parameters": {
        "type": "object",
        "properties": {
            "package_path": PACKAGE_PATH_FIELD,
            "output_dir": {
                "type": "string",
                "description": "Absolute or user-relative folder where the package should be extracted.",
            },
            "overwrite": {
                "type": "boolean",
                "description": "When false, refuse to overwrite existing files.",
                "default": False,
            },
        },
        "required": ["package_path", "output_dir"],
        "additionalProperties": False,
    },
}


MASTERCANVAS_COMFY_PLAN = {
    "name": "mastercanvas_comfy_plan",
    "description": "Build a concise ComfyUI/LTX shot plan from a Master Canvas package or manifest.",
    "parameters": {
        "type": "object",
        "properties": {
            "package_path": PACKAGE_PATH_FIELD,
        },
        "required": ["package_path"],
        "additionalProperties": False,
    },
}
