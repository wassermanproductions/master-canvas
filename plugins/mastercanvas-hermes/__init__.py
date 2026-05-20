"""Hermes plugin registration for Master Canvas handoff tools."""

from __future__ import annotations

try:
    from . import schemas
    from .tools import (
        handle_capabilities,
        handle_comfy_plan,
        handle_extract_package,
        handle_inspect_package,
    )
except ImportError:
    import schemas
    from tools import (
        handle_capabilities,
        handle_comfy_plan,
        handle_extract_package,
        handle_inspect_package,
    )


TOOLS = [
    (
        "mastercanvas_capabilities",
        schemas.MASTERCANVAS_CAPABILITIES,
        handle_capabilities,
        "Explain how to use Master Canvas handoff packages.",
    ),
    (
        "mastercanvas_inspect_package",
        schemas.MASTERCANVAS_INSPECT_PACKAGE,
        handle_inspect_package,
        "Inspect a Master Canvas package and summarize generation readiness.",
    ),
    (
        "mastercanvas_extract_package",
        schemas.MASTERCANVAS_EXTRACT_PACKAGE,
        handle_extract_package,
        "Extract a Master Canvas handoff ZIP to a local folder.",
    ),
    (
        "mastercanvas_comfy_plan",
        schemas.MASTERCANVAS_COMFY_PLAN,
        handle_comfy_plan,
        "Create a concise ComfyUI/LTX execution plan from a Master Canvas package.",
    ),
]


def register(ctx):
    for name, schema, handler, description in TOOLS:
        ctx.register_tool(
            name=name,
            toolset="mastercanvas",
            schema=schema,
            handler=handler,
            description=description,
        )
