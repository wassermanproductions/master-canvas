"""Hermes handlers for Master Canvas handoff packages."""

from __future__ import annotations

import json
import shutil
import zipfile
from pathlib import Path


def _json(data):
    return json.dumps(data, indent=2)


def _resolve(path: str) -> Path:
    return Path(path).expanduser().resolve()


def _read_manifest(package_path: str) -> tuple[dict, Path, bool]:
    path = _resolve(package_path)
    if path.is_dir():
        manifest_path = path / "project_manifest.json"
        return json.loads(manifest_path.read_text()), path, False
    if path.name == "project_manifest.json":
        return json.loads(path.read_text()), path.parent, False
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            with archive.open("project_manifest.json") as handle:
                return json.loads(handle.read().decode("utf-8")), path, True
    raise ValueError(f"Unsupported Master Canvas package: {path}")


def handle_capabilities(_args):
    return _json(
        {
            "toolset": "mastercanvas",
            "workflow": [
                "Use mastercanvas_inspect_package on a handoff ZIP first.",
                "Use mastercanvas_extract_package to unpack assets and job files.",
                "Use mastercanvas_comfy_plan to get a shot-by-shot LTX/ComfyUI execution plan.",
                "Then hand the extracted comfyui/jobs files to the ComfyUI tool/plugin.",
            ],
            "package_contract": [
                "project_manifest.json is the source of truth.",
                "assets/ contains source images, video, and audio references.",
                "comfyui/jobs contains one JSON job per shot.",
                "deliverables/bin_plan.json defines scene bins for returned renders.",
            ],
        }
    )


def handle_inspect_package(args):
    manifest, source, is_zip = _read_manifest(args["package_path"])
    scenes = manifest.get("scenes", [])
    shots = manifest.get("shots", [])
    missing_assets = [shot for shot in shots if not shot.get("sourcePath")]
    return _json(
        {
            "source": str(source),
            "source_type": "zip" if is_zip else "folder_or_manifest",
            "title": manifest.get("title"),
            "schema": manifest.get("schema"),
            "scene_count": len(scenes),
            "shot_count": len(shots),
            "asset_count": len(manifest.get("assets", [])),
            "reference_count": len(manifest.get("references", [])),
            "target_generation": manifest.get("targetGeneration", {}),
            "scene_bins": [
                {
                    "scene": scene.get("sceneKey"),
                    "shot_count": len(scene.get("shots", [])),
                    "output_bin": f"renders/{_scene_folder(scene.get('sceneKey', 'scene'))}",
                }
                for scene in scenes
            ],
            "missing_source_paths": [
                {"orderLabel": shot.get("orderLabel"), "title": shot.get("title")}
                for shot in missing_assets
            ],
            "ready": len(missing_assets) == 0,
        }
    )


def handle_extract_package(args):
    package_path = _resolve(args["package_path"])
    output_dir = _resolve(args["output_dir"])
    overwrite = bool(args.get("overwrite", False))
    if output_dir.exists() and any(output_dir.iterdir()) and not overwrite:
        return _json(
            {
                "extracted": False,
                "reason": "output_dir exists and is not empty; pass overwrite=true to replace files",
                "output_dir": str(output_dir),
            }
        )
    output_dir.mkdir(parents=True, exist_ok=True)
    if zipfile.is_zipfile(package_path):
        with zipfile.ZipFile(package_path) as archive:
            archive.extractall(output_dir)
    elif package_path.is_dir():
        for child in package_path.iterdir():
            target = output_dir / child.name
            if child.is_dir():
                if target.exists() and overwrite:
                    shutil.rmtree(target)
                shutil.copytree(child, target, dirs_exist_ok=overwrite)
            else:
                shutil.copy2(child, target)
    else:
        return _json({"extracted": False, "reason": "package_path must be a ZIP or extracted package folder"})
    return _json({"extracted": True, "output_dir": str(output_dir)})


def handle_comfy_plan(args):
    manifest, source, _is_zip = _read_manifest(args["package_path"])
    shots = manifest.get("shots", [])
    return _json(
        {
            "source": str(source),
            "title": manifest.get("title"),
            "engine": "ComfyUI",
            "model": "LTX 2.3 image-to-video",
            "quality_floor": manifest.get("targetGeneration", {}).get("minimumResolution", "1080p"),
            "shots": [
                {
                    "orderLabel": shot.get("orderLabel"),
                    "scene": shot.get("sceneKey"),
                    "sourceImage": shot.get("sourcePath"),
                    "outputBin": shot.get("outputBin"),
                    "duration": shot.get("duration"),
                    "resolution": shot.get("resolution"),
                    "prompt": shot.get("prompt"),
                    "negativePrompt": shot.get("negativePrompt"),
                }
                for shot in shots
            ],
        }
    )


def _scene_folder(scene_key: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in scene_key).strip("-")
    return cleaned or "scene"
