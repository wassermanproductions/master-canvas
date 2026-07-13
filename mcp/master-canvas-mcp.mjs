#!/usr/bin/env node
/**
 * Master Canvas MCP server — zero-dependency Node >=18 stdio bridge.
 *
 * Speaks the MCP stdio transport: newline-delimited JSON-RPC 2.0 on
 * stdin/stdout (NOT Content-Length framed): initialize /
 * notifications/initialized / tools/list / tools/call / ping.
 *
 * HEADLESS wrapper around a Master Canvas project. Instead of driving the
 * desktop GUI, every tool reads and writes the Master Canvas project JSON
 * directly on disk (the same shape the app exports as
 * `master-canvas-project.json`), copies asset files into the project, and
 * assembles handoff packages for downstream generators (ComfyUI/LTX, Kling,
 * Veo, Hermes). Any MCP agent can plan a Master Canvas project without the app.
 *
 * Uses only Node built-ins (fs, path, os) — run directly with `node`.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, basename, extname, resolve, isAbsolute } from 'node:path'
import { homedir, platform } from 'node:os'
import { randomUUID } from 'node:crypto'

const PROTOCOL_VERSION = '2024-11-05'

/* ------------------------- project location ----------------------------- */

// Mirror Electron's app.getPath('appData') + userData ("master-canvas").
function appDataDir() {
  const home = homedir()
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support')
  if (platform() === 'win32') return process.env.APPDATA || join(home, 'AppData', 'Roaming')
  return process.env.XDG_CONFIG_HOME || join(home, '.config')
}

const DEFAULT_PROJECT = join(appDataDir(), 'master-canvas', 'master-canvas-project.json')

// Resolve the project file: explicit arg > MASTER_CANVAS_PROJECT env > default.
function resolveProjectPath(args) {
  const raw = (args && args.projectPath) || process.env.MASTER_CANVAS_PROJECT || DEFAULT_PROJECT
  const expanded = raw.startsWith('~') ? join(homedir(), raw.slice(1)) : raw
  return isAbsolute(expanded) ? expanded : resolve(expanded)
}

/* ---------------------------- project model ----------------------------- */

const NODE_TYPES = [
  'note', 'character', 'scene', 'section', 'shot', 'workflow', 'imageWorkflow',
  'placeholder', 'inspiration', 'styleRef', 'musicRef', 'media'
]

const NODE_TYPE_LABELS = {
  workflow: 'Image to Video', imageWorkflow: 'Generate Image', shot: 'Shot Card',
  character: 'Character Ref', scene: 'Scene Ref', section: 'Scene Section',
  placeholder: 'Placeholder', inspiration: 'Inspiration', styleRef: 'Style References',
  musicRef: 'Music References', note: 'Text Note', media: 'Media'
}

function now() { return new Date().toISOString() }
function uid(prefix) { return `${prefix}-${randomUUID().slice(0, 8)}` }

function nodeTypeLabel(type) { return NODE_TYPE_LABELS[type] || 'Card' }

function defaultContinuity() {
  return { characters: '', wardrobe: '', locations: '', props: '', styleRules: '', neverChange: '' }
}

function makeNode(type, x, y, overrides = {}) {
  const base = {
    id: uid('node'),
    type,
    x,
    y,
    w: type === 'section' ? 760 : type === 'workflow' || type === 'imageWorkflow' ? 320 : type === 'placeholder' ? 300 : 270,
    h: type === 'section' ? 440 : 180,
    title: nodeTypeLabel(type),
    notes: '',
    tags: '',
    status: type === 'workflow' || type === 'imageWorkflow' ? 'ready' : 'draft',
    provider: type === 'imageWorkflow' ? 'ComfyUI' : 'Kling',
    model: type === 'imageWorkflow' ? 'SDXL / Flux' : 'Kling 3.0 Pro',
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: '10s',
    seed: '',
    prompt: '',
    negativePrompt: '',
    startAssetId: '',
    endAssetId: '',
    assetId: '',
    referenceAssetId: '',
    referenceUrl: '',
    sourceNodeId: '',
    neededFor: '',
    assignedSectionId: '',
    linkSourceSide: 'right',
    linkTargetSide: 'left',
    overallPrompt: '',
    stylePrompt: '',
    musicPrompt: '',
    shotSize: '',
    cameraAngle: '',
    cameraMovement: '',
    subjectAction: '',
    location: '',
    mood: '',
    lighting: '',
    lensFeel: '',
    priority: 'normal',
    shotOrderLabel: '',
    shotBeatTitle: '',
    globalShotOrder: '',
    influenceColor: '',
    influencePacing: '',
    influenceCamera: '',
    influenceLighting: '',
    influenceUse: '',
    influenceStrength: 'medium',
    doNotCopy: '',
    reviewOwner: '',
    reviewDecision: '',
    reviewNotes: '',
    attempts: [],
    createdAt: now(),
    updatedAt: now()
  }
  return { ...base, ...overrides }
}

function normalizeNode(node) {
  return {
    ...makeNode(node.type || 'note', node.x || 0, node.y || 0),
    ...node,
    attempts: Array.isArray(node.attempts) ? node.attempts : []
  }
}

function createDefaultProject(title) {
  return {
    id: uid('project'),
    title: title || 'Untitled pre-production board',
    createdAt: now(),
    updatedAt: now(),
    view: { x: 520, y: 230, scale: 0.9 },
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedAssetId: null,
    continuity: defaultContinuity(),
    assets: [],
    nodes: []
  }
}

function loadProject(path) {
  if (!existsSync(path)) {
    const err = new Error(`No Master Canvas project at ${path}. Call create_project first, or pass projectPath / set MASTER_CANVAS_PROJECT.`)
    err.userFacing = true
    throw err
  }
  const parsed = JSON.parse(readFileSync(path, 'utf-8'))
  const project = { ...createDefaultProject(), ...parsed, id: parsed.id || uid('project') }
  project.continuity = { ...defaultContinuity(), ...(parsed.continuity || {}) }
  project.assets = Array.isArray(parsed.assets) ? parsed.assets : []
  project.nodes = (parsed.nodes || []).map(normalizeNode)
  return project
}

function saveProject(path, project) {
  project.updatedAt = now()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(project, null, 2))
}

function projectAssetsDir(path) {
  return join(dirname(path), `${basename(path, extname(path))}-assets`)
}

/* --------------------------- scene / order utils ------------------------ */

function sceneNumberFromKey(sceneKey) {
  const match = String(sceneKey).match(/Scene\s+(\d+)/i)
  return match ? match[1] : ''
}

function safeSlug(value = 'item') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'item'
}

function sceneFolderName(sceneKey = 'scene') {
  if (sceneNumberFromKey(sceneKey)) return `scene-${String(sceneNumberFromKey(sceneKey)).padStart(2, '0')}`
  return safeSlug(sceneKey || 'references')
}

function normalizeResolution(value = '1080p') {
  const v = String(value).toLowerCase()
  if (v === '1080p') return '1920x1080'
  if (v === '720p') return '1280x720'
  if (v === '4k') return '3840x2160'
  return value
}

function sortNodesByCanvasOrder(a, b) {
  const rowA = Math.round((a.y || 0) / 80)
  const rowB = Math.round((b.y || 0) / 80)
  return rowA - rowB || (a.x || 0) - (b.x || 0)
}

function extractSceneKey(node) {
  const text = `${node.title || ''} ${node.tags || ''}`.trim()
  const sceneMatch = text.match(/\bscene\s*0*(\d+)\b/i)
  if (sceneMatch) return `Scene ${Number(sceneMatch[1])}`
  if (node.type === 'scene' || node.type === 'shot' || node.type === 'section') return node.title || ''
  return ''
}

function getSceneKey(project, node, visited = new Set()) {
  if (!node || visited.has(node.id)) return ''
  visited.add(node.id)
  const direct = extractSceneKey(node)
  if (direct) return direct
  if (node.sourceNodeId) {
    const source = project.nodes.find((item) => item.id === node.sourceNodeId)
    const sourceKey = getSceneKey(project, source, visited)
    if (sourceKey) return sourceKey
  }
  const headers = project.nodes
    .filter((item) => item.type === 'scene' || item.type === 'shot' || item.type === 'section')
    .sort((a, b) => b.y - a.y || b.x - a.x)
  return headers.find((header) => header.y <= node.y + 80)?.title || ''
}

function defaultDurationForScene(sceneKey) {
  if (sceneKey === 'Text Card - Between Scene 4 and 5') return '4s'
  if (sceneKey === 'Ending Text Card') return '5s'
  return '6s'
}

function assetById(project, id) { return project.assets.find((a) => a.id === id) }

function isWorkflowNode(node) { return node && (node.type === 'workflow' || node.type === 'imageWorkflow') }

/* --------------------------- handoff manifest --------------------------- */

function orderedSceneKeysForExport(project) {
  const discovered = [...new Set(project.nodes.map((node) => getSceneKey(project, node)).filter(Boolean))]
  return discovered.sort((a, b) => {
    const aNode = project.nodes.find((node) => getSceneKey(project, node) === a)
    const bNode = project.nodes.find((node) => getSceneKey(project, node) === b)
    return sortNodesByCanvasOrder(aNode || {}, bNode || {})
  })
}

function buildHandoffShot(project, node, sceneKey, index) {
  const asset = assetById(project, node.assetId)
  const label = node.shotOrderLabel || `${sceneKey.replace(/\s+/g, '')}-${String(index + 1).padStart(2, '0')}`
  return {
    id: node.id,
    nodeId: node.id,
    assetId: node.assetId || '',
    assetName: asset?.name || '',
    sceneKey,
    sceneNumber: sceneNumberFromKey(sceneKey) || '',
    shotNumber: index + 1,
    orderLabel: label,
    beatTitle: node.shotBeatTitle || label,
    title: node.title,
    status: node.status || '',
    prompt: node.prompt || '',
    negativePrompt: node.negativePrompt || '',
    notes: node.notes || '',
    tags: node.tags || '',
    shotSize: node.shotSize || '',
    cameraAngle: node.cameraAngle || '',
    cameraMovement: node.cameraMovement || '',
    subjectAction: node.subjectAction || '',
    location: node.location || '',
    mood: node.mood || '',
    lighting: node.lighting || '',
    lensFeel: node.lensFeel || '',
    provider: node.provider || '',
    model: node.model || '',
    aspectRatio: node.aspectRatio || '16:9',
    resolution: normalizeResolution(node.resolution || '1080p'),
    duration: node.duration || defaultDurationForScene(sceneKey),
    seed: node.seed || '',
    reviewDecision: node.reviewDecision || '',
    reviewNotes: node.reviewNotes || '',
    sourcePath: '',
    outputBin: `renders/${sceneFolderName(sceneKey)}`
  }
}

function buildHandoffWorkflow(project, node) {
  return {
    id: node.id,
    title: node.title,
    sceneKey: getSceneKey(project, node) || '',
    status: node.status || '',
    provider: node.provider || '',
    model: node.model || '',
    prompt: node.prompt || '',
    negativePrompt: node.negativePrompt || '',
    startAssetId: node.startAssetId || '',
    endAssetId: node.endAssetId || '',
    referenceAssetId: node.referenceAssetId || '',
    aspectRatio: node.aspectRatio || '',
    resolution: normalizeResolution(node.resolution || '1080p'),
    duration: node.duration || '',
    seed: node.seed || '',
    notes: node.notes || ''
  }
}

function buildHandoffReferences(project) {
  const assetRefs = project.assets
    .filter((asset) => ['video-link', 'music-link', 'reference-link', 'audio', 'video'].includes(asset.type))
    .map((asset) => ({
      id: asset.id, assetId: asset.id, title: asset.name, type: asset.type,
      externalUrl: asset.externalUrl || '', tags: asset.tags || '', notes: asset.notes || '', sourcePath: ''
    }))
  const cardRefs = project.nodes
    .filter((node) => node.type === 'styleRef' || node.type === 'musicRef')
    .map((node) => {
      const asset = assetById(project, node.referenceAssetId)
      return {
        id: node.id, assetId: asset?.id || '', title: node.title, type: node.type,
        externalUrl: node.referenceUrl || asset?.externalUrl || '', sourcePath: '',
        influenceUse: node.influenceUse || '', influenceStrength: node.influenceStrength || '',
        color: node.influenceColor || '', pacing: node.influencePacing || '',
        camera: node.influenceCamera || '', lighting: node.influenceLighting || '',
        doNotCopy: node.doNotCopy || '', prompt: node.stylePrompt || node.musicPrompt || '', notes: node.notes || ''
      }
    })
  return [...assetRefs, ...cardRefs]
}

function buildHandoffData(project) {
  const continuity = { ...defaultContinuity(), ...(project.continuity || {}) }
  const sceneKeys = orderedSceneKeysForExport(project)
  const scenes = sceneKeys.map((sceneKey) => {
    const sceneNode = project.nodes
      .filter((node) => getSceneKey(project, node) === sceneKey && (node.type === 'scene' || node.type === 'shot' || node.type === 'section'))
      .sort(sortNodesByCanvasOrder)[0]
    const mediaNodes = project.nodes
      .filter((node) => node.type === 'media' && getSceneKey(project, node) === sceneKey)
      .sort(sortNodesByCanvasOrder)
    return {
      sceneKey,
      sceneNumber: sceneNumberFromKey(sceneKey) || '',
      title: sceneNode?.title || sceneKey,
      orderLabel: sceneNode?.shotOrderLabel || sceneKey,
      description: sceneNode?.overallPrompt || sceneNode?.notes || '',
      stylePrompt: sceneNode?.stylePrompt || '',
      musicPrompt: sceneNode?.musicPrompt || '',
      notes: sceneNode?.notes || '',
      shots: mediaNodes.map((node, index) => buildHandoffShot(project, node, sceneKey, index))
    }
  })
  const shots = scenes.flatMap((scene) => scene.shots)
  shots.forEach((shot, index) => {
    shot.globalOrder = index + 1
    shot.globalOrderLabel = String(index + 1).padStart(2, '0')
  })
  const workflows = project.nodes.filter(isWorkflowNode).sort(sortNodesByCanvasOrder).map((n) => buildHandoffWorkflow(project, n))
  const references = buildHandoffReferences(project)
  return {
    schema: 'master-canvas-handoff-v1',
    title: project.title,
    projectId: project.id,
    exportedAt: now(),
    intent: 'Self-contained pre-production handoff for Hermes Agent, ComfyUI LTX 2.3, Kling, Veo, and human operators. Preserve shot order, scene bins, assets, prompts, negative prompts, references, and continuity.',
    targetGeneration: {
      primary: 'ComfyUI with LTX 2.3',
      alternates: ['Veo', 'Kling'],
      minimumResolution: '1080p',
      aspectRatio: '16:9',
      delivery: 'Organize outputs into bins by scene number and return best takes plus notes.'
    },
    continuity,
    scenes,
    shots,
    workflows,
    references,
    assets: project.assets.map((asset) => ({
      id: asset.id, name: asset.name, type: asset.type, mime: asset.mime, size: asset.size,
      tags: asset.tags || '', notes: asset.notes || '', externalUrl: asset.externalUrl || ''
    }))
  }
}

function hydrateHandoffAssetPaths(manifest, assetPathById) {
  const cloned = JSON.parse(JSON.stringify(manifest))
  cloned.shots.forEach((shot) => { shot.sourcePath = assetPathById.get(shot.assetId) || '' })
  cloned.scenes.forEach((scene) => {
    scene.shots.forEach((shot) => { shot.sourcePath = assetPathById.get(shot.assetId) || '' })
  })
  cloned.workflows.forEach((workflow) => {
    workflow.startAssetPath = assetPathById.get(workflow.startAssetId) || ''
    workflow.endAssetPath = assetPathById.get(workflow.endAssetId) || ''
    workflow.referenceAssetPath = assetPathById.get(workflow.referenceAssetId) || ''
  })
  cloned.references.forEach((reference) => { reference.sourcePath = assetPathById.get(reference.assetId) || '' })
  cloned.assets.forEach((asset) => { asset.sourcePath = assetPathById.get(asset.id) || '' })
  return cloned
}

function assetExtension(asset) {
  if (asset.sourcePath && extname(asset.sourcePath)) return extname(asset.sourcePath)
  if (asset.name && extname(asset.name)) return extname(asset.name)
  const mimeExt = { 'image/png': '.png', 'image/jpeg': '.jpg', 'video/mp4': '.mp4', 'audio/mpeg': '.mp3', 'audio/wav': '.wav' }
  return mimeExt[asset.mime] || ''
}

function buildComfyShotJob(shot, manifest) {
  return {
    engine: 'ComfyUI',
    model: 'LTX 2.3 image-to-video',
    projectTitle: manifest.title,
    sceneKey: shot.sceneKey,
    sceneNumber: shot.sceneNumber,
    shotNumber: shot.shotNumber,
    orderLabel: shot.orderLabel,
    sourceImage: shot.sourcePath,
    outputBin: shot.outputBin,
    outputName: `${shot.orderLabel || `shot-${shot.globalOrderLabel}`}-${safeSlug(shot.beatTitle || shot.title)}`,
    settings: {
      aspectRatio: shot.aspectRatio || '16:9',
      resolution: normalizeResolution(shot.resolution || '1080p'),
      duration: shot.duration,
      seed: shot.seed || 'auto',
      fps: 24,
      qualityTarget: '1080p minimum, prefer higher if stable'
    },
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    camera: {
      shotSize: shot.shotSize, angle: shot.cameraAngle, movement: shot.cameraMovement,
      lens: shot.lensFeel, lighting: shot.lighting, action: shot.subjectAction
    },
    continuity: manifest.continuity,
    notes: shot.notes
  }
}

function buildComfyManifest(manifest) {
  return {
    engine: 'ComfyUI',
    model: 'LTX 2.3 image-to-video',
    resolution: '1920x1080',
    aspectRatio: '16:9',
    scenes: manifest.scenes.map((scene) => ({
      sceneKey: scene.sceneKey,
      sceneNumber: scene.sceneNumber,
      outputBin: `renders/${sceneFolderName(scene.sceneKey)}`,
      description: scene.description,
      stylePrompt: scene.stylePrompt,
      musicPrompt: scene.musicPrompt,
      shots: scene.shots.map((shot) => buildComfyShotJob(shot, manifest))
    }))
  }
}

function buildSceneBins(manifest) {
  return manifest.scenes.map((scene) => ({
    sceneKey: scene.sceneKey,
    sceneNumber: scene.sceneNumber,
    bin: `renders/${sceneFolderName(scene.sceneKey)}`,
    shots: scene.shots.map((shot) => shot.orderLabel)
  }))
}

function buildDeliverableBinPlan(manifest) {
  return {
    root: 'renders',
    bins: buildSceneBins(manifest),
    expectedFiles: manifest.shots.map((shot) => ({
      orderLabel: shot.orderLabel,
      sceneKey: shot.sceneKey,
      bin: shot.outputBin,
      filenamePrefix: `${shot.orderLabel}-${safeSlug(shot.beatTitle || shot.title)}`
    }))
  }
}

function buildHermesJob(manifest) {
  return {
    agent: 'Hermes',
    source: 'Master Canvas handoff package',
    task: 'Generate all shots in ComfyUI using LTX 2.3 and return organized scene bins.',
    qualityFloor: manifest.targetGeneration.minimumResolution,
    primaryEngine: manifest.targetGeneration.primary,
    continuity: manifest.continuity,
    inputs: {
      projectManifest: '../project_manifest.json',
      comfyManifest: '../comfyui/shot_manifest_ltx23.json',
      shotOrderCsv: 'shot_order.csv',
      assetInventoryCsv: 'asset_inventory.csv'
    },
    requiredOutputBins: buildDeliverableBinPlan(manifest),
    shots: manifest.shots.map((shot) => ({
      sceneKey: shot.sceneKey, orderLabel: shot.orderLabel, sourcePath: shot.sourcePath,
      prompt: shot.prompt, negativePrompt: shot.negativePrompt, lensFeel: shot.lensFeel,
      lighting: shot.lighting, cameraMovement: shot.cameraMovement, duration: shot.duration,
      resolution: shot.resolution, outputBin: shot.outputBin
    }))
  }
}

function csvRow(cells) {
  return cells.map((cell) => {
    const s = String(cell ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(',')
}

function buildShotOrderCsv(manifest) {
  const rows = [csvRow(['global_order', 'scene', 'scene_number', 'shot_number', 'order_label', 'beat_title', 'source_path', 'output_bin', 'duration', 'resolution'])]
  manifest.shots.forEach((shot) => {
    rows.push(csvRow([shot.globalOrder, shot.sceneKey, shot.sceneNumber, shot.shotNumber, shot.orderLabel, shot.beatTitle, shot.sourcePath, shot.outputBin, shot.duration, shot.resolution]))
  })
  return rows.join('\n')
}

function buildAssetInventoryCsv(manifest) {
  const rows = [csvRow(['asset_id', 'name', 'type', 'source_path', 'external_url', 'tags'])]
  manifest.assets.forEach((asset) => {
    rows.push(csvRow([asset.id, asset.name, asset.type, asset.sourcePath || '', asset.externalUrl || '', asset.tags || '']))
  })
  return rows.join('\n')
}

function buildRootHandoffReadme(manifest) {
  return `# ${manifest.title} - Handoff Package

Exported: ${manifest.exportedAt}

This package contains everything needed to generate the project from the Master Canvas:

- \`project_manifest.json\`: full structured source of truth
- \`assets/\`: source images, video, and audio references used by the shot cards
- \`timeline/shot_order.csv\`: scene and shot order for editorial/generation tracking
- \`hermes-agent/\`: task brief and JSON job packet for a generation agent
- \`comfyui/\`: LTX 2.3 ComfyUI shot manifest and per-shot jobs
- \`kling-veo/\`: human-operator prompts and checklist for Kling or Veo
- \`shot-package.md\`: readable prompt package

Primary target: ComfyUI with LTX 2.3 at 1080p or better.

Important rule: preserve scene order and shot order. Outputs should be organized into bins by scene number, then returned with best takes, rejected takes, seeds/settings, and notes.`
}

function buildShotPackageMarkdown(project, manifest) {
  const lines = []
  lines.push(`# ${manifest.title}`, '', `Exported: ${manifest.exportedAt}`, '')
  lines.push('## Continuity Bible')
  const rows = [
    ['Characters', manifest.continuity.characters], ['Wardrobe / Look', manifest.continuity.wardrobe],
    ['Locations', manifest.continuity.locations], ['Props / Objects', manifest.continuity.props],
    ['Style Rules', manifest.continuity.styleRules], ['Never Change', manifest.continuity.neverChange]
  ].filter(([, v]) => v)
  if (!rows.length) lines.push('', 'No continuity bible notes yet.')
  rows.forEach(([label, value]) => lines.push(`- ${label}: ${String(value).replace(/\n/g, ' ')}`))
  lines.push('', '## Shots')
  if (!manifest.shots.length) lines.push('', 'No shot (media) cards yet.')
  manifest.shots.forEach((shot) => {
    lines.push('', `### ${shot.orderLabel} - ${shot.beatTitle || shot.title} (${shot.sceneKey})`)
    if (shot.prompt) lines.push(`- Prompt: ${shot.prompt.replace(/\n/g, ' ')}`)
    if (shot.negativePrompt) lines.push(`- Negative: ${shot.negativePrompt.replace(/\n/g, ' ')}`)
    if (shot.cameraMovement) lines.push(`- Camera: ${shot.cameraMovement}`)
    if (shot.lensFeel) lines.push(`- Lens: ${shot.lensFeel}`)
    if (shot.lighting) lines.push(`- Lighting: ${shot.lighting}`)
    lines.push(`- Duration ${shot.duration} · Resolution ${shot.resolution} · Output ${shot.outputBin}`)
  })
  return lines.join('\n')
}

// Assemble the full handoff package as an unpacked folder (Hermes-compatible:
// inspect/extract read a folder containing project_manifest.json).
function buildHandoffPackage(project, projectPath, outputDir) {
  const manifest = buildHandoffData(project)
  const assetsDir = projectAssetsDir(projectPath)
  const usedAssetIds = new Set()
  manifest.scenes.forEach((scene) => scene.shots.forEach((shot) => { if (shot.assetId) usedAssetIds.add(shot.assetId) }))
  manifest.references.forEach((reference) => { if (reference.assetId) usedAssetIds.add(reference.assetId) })
  manifest.workflows.forEach((wf) => {
    if (wf.startAssetId) usedAssetIds.add(wf.startAssetId)
    if (wf.endAssetId) usedAssetIds.add(wf.endAssetId)
    if (wf.referenceAssetId) usedAssetIds.add(wf.referenceAssetId)
  })

  const assetPathById = new Map()
  const copied = []
  const missing = []
  mkdirSync(outputDir, { recursive: true })

  project.assets.filter((asset) => usedAssetIds.has(asset.id)).forEach((asset) => {
    // Resolve the asset's real bytes on disk.
    let srcFile = asset.sourcePath || ''
    if (srcFile && !isAbsolute(srcFile)) srcFile = join(assetsDir, srcFile)
    if (!srcFile || !existsSync(srcFile)) { missing.push({ id: asset.id, name: asset.name }); return }
    const sceneKey = sceneKeyForAsset(project, asset.id) || 'references'
    const sceneFolder = sceneFolderName(sceneKey)
    const shot = manifest.shots.find((item) => item.assetId === asset.id)
    const basenameStr = shot ? `${shot.orderLabel || `shot-${shot.globalOrder}`}-${safeSlug(asset.name)}` : `${asset.id}-${safeSlug(asset.name)}`
    const relPath = shot ? `assets/${sceneFolder}/${basenameStr}${assetExtension(asset)}` : `assets/references/${basenameStr}${assetExtension(asset)}`
    const destFile = join(outputDir, relPath)
    mkdirSync(dirname(destFile), { recursive: true })
    copyFileSync(srcFile, destFile)
    assetPathById.set(asset.id, relPath)
    copied.push(relPath)
  })

  const hydrated = hydrateHandoffAssetPaths(manifest, assetPathById)
  const writeFile = (rel, data) => {
    const dest = join(outputDir, rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, typeof data === 'string' ? data : JSON.stringify(data, null, 2))
  }

  writeFile('README.md', buildRootHandoffReadme(hydrated))
  writeFile('project_manifest.json', hydrated)
  writeFile('master-canvas-project.json', project)
  writeFile('shot-package.md', buildShotPackageMarkdown(project, hydrated))
  writeFile('timeline/shot_order.csv', buildShotOrderCsv(hydrated))
  writeFile('timeline/scene_bins.json', buildSceneBins(hydrated))
  writeFile('hermes-agent/hermes_job.json', buildHermesJob(hydrated))
  writeFile('hermes-agent/shot_order.csv', buildShotOrderCsv(hydrated))
  writeFile('hermes-agent/asset_inventory.csv', buildAssetInventoryCsv(hydrated))
  writeFile('comfyui/shot_manifest_ltx23.json', buildComfyManifest(hydrated))
  hydrated.shots.forEach((shot) => {
    writeFile(`comfyui/jobs/${sceneFolderName(shot.sceneKey)}/${shot.orderLabel || `shot-${shot.globalOrder}`}.json`, buildComfyShotJob(shot, hydrated))
  })
  writeFile('deliverables/bin_plan.json', buildDeliverableBinPlan(hydrated))

  return {
    outputDir,
    sceneCount: hydrated.scenes.length,
    shotCount: hydrated.shots.length,
    assetsCopied: copied.length,
    missingAssetSources: missing,
    manifestPath: join(outputDir, 'project_manifest.json'),
    ready: missing.length === 0
  }
}

function sceneKeyForAsset(project, assetId) {
  const node = project.nodes.find((item) => item.type === 'media' && item.assetId === assetId)
  return node ? getSceneKey(project, node) : ''
}

/* ------------------------ package inspection (read) --------------------- */

function readManifestFrom(packagePath) {
  const p = packagePath.startsWith('~') ? join(homedir(), packagePath.slice(1)) : packagePath
  const abs = isAbsolute(p) ? p : resolve(p)
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    return { manifest: JSON.parse(readFileSync(join(abs, 'project_manifest.json'), 'utf-8')), source: abs }
  }
  if (basename(abs) === 'project_manifest.json') {
    return { manifest: JSON.parse(readFileSync(abs, 'utf-8')), source: dirname(abs) }
  }
  // Also accept a master-canvas-project.json directly and build a manifest from it.
  if (existsSync(abs)) {
    const raw = JSON.parse(readFileSync(abs, 'utf-8'))
    if (raw.schema === 'master-canvas-handoff-v1') return { manifest: raw, source: dirname(abs) }
    if (Array.isArray(raw.nodes)) {
      const project = { ...createDefaultProject(), ...raw }
      project.nodes = (raw.nodes || []).map(normalizeNode)
      return { manifest: buildHandoffData(project), source: dirname(abs) }
    }
  }
  const err = new Error(`Unsupported Master Canvas package: ${abs}`)
  err.userFacing = true
  throw err
}

/* ---------------------------------- tools ------------------------------- */

const PROJECT_PATH_FIELD = {
  type: 'string',
  description: 'Absolute path to the Master Canvas project JSON. Optional — defaults to MASTER_CANVAS_PROJECT env, then the app data location.'
}

const CARD_FIELDS = {
  type: { type: 'string', enum: NODE_TYPES, description: 'Card type. "media" cards become shots in the handoff; "workflow"/"imageWorkflow" are generation cards; "scene"/"section"/"shot" head a scene; "styleRef"/"musicRef" carry references.' },
  title: { type: 'string' },
  notes: { type: 'string' },
  tags: { type: 'string', description: 'Comma-separated. Include "Scene N" here or in the title to bind a card to a scene bin.' },
  prompt: { type: 'string' },
  negativePrompt: { type: 'string' },
  overallPrompt: { type: 'string', description: 'Scene/section description prompt.' },
  stylePrompt: { type: 'string' },
  musicPrompt: { type: 'string', description: 'Music/sound direction for a scene or musicRef card.' },
  shotSize: { type: 'string' },
  cameraAngle: { type: 'string' },
  cameraMovement: { type: 'string' },
  subjectAction: { type: 'string' },
  location: { type: 'string' },
  mood: { type: 'string' },
  lighting: { type: 'string' },
  lensFeel: { type: 'string' },
  provider: { type: 'string', description: 'Generator, e.g. "ComfyUI", "Kling", "Veo".' },
  model: { type: 'string' },
  aspectRatio: { type: 'string' },
  resolution: { type: 'string', description: '"1080p", "720p", "4k", or explicit WxH.' },
  duration: { type: 'string' },
  seed: { type: 'string' },
  status: { type: 'string' },
  referenceUrl: { type: 'string', description: 'External reference URL for styleRef/musicRef cards.' },
  shotOrderLabel: { type: 'string' },
  shotBeatTitle: { type: 'string' },
  reviewDecision: { type: 'string' },
  reviewNotes: { type: 'string' }
}

const TOOLS = [
  {
    name: 'get_project',
    description:
      'Call FIRST. Reads the Master Canvas project on disk and returns a summary: title, continuity bible, the cards (nodes) grouped by type, discovered scene keys in order, the ordered shot (media-card) list, and the assets. Conventions: a Master Canvas "board" is a project JSON file; a "card" is a node. A card is bound to a scene bin when its title or tags contain "Scene N" (else it inherits the nearest scene/section header above it on the canvas). "media" cards are the shots that get generated (they carry prompt, negativePrompt, camera/lens/lighting/action, provider/model, resolution, duration). Shot order follows canvas position (top-to-bottom, then left-to-right) unless shotOrderLabel is set. Assets are files/links registered on the project; attach_asset links them to cards. build_handoff_package turns all of this into a generator-ready package.',
    inputSchema: { type: 'object', properties: { projectPath: PROJECT_PATH_FIELD }, additionalProperties: false }
  },
  {
    name: 'create_project',
    description: 'Create a new, empty Master Canvas project JSON at projectPath (or the default location). Fails if a project already exists there unless overwrite is true.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        title: { type: 'string', description: 'Project/board title.' },
        overwrite: { type: 'boolean', description: 'Replace an existing project file. Default false.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'list_cards',
    description: 'List the cards (nodes) on the board with id, type, title, derived sceneKey, shotOrderLabel, and canvas position. Optionally filter by type.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        type: { type: 'string', enum: NODE_TYPES, description: 'Optional card-type filter.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_card',
    description: 'Return the full record of one card by id, including its derived sceneKey.',
    inputSchema: {
      type: 'object',
      properties: { projectPath: PROJECT_PATH_FIELD, cardId: { type: 'string', description: 'Card id from get_project/list_cards.' } },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'add_card',
    description: 'Add a new card (node) to the board. Use type "media" for a shot to generate, "scene"/"section" to head a scene bin, "workflow"/"imageWorkflow" for a generation step, "styleRef"/"musicRef" for references, "placeholder" for a missing asset, or "note". Returns the new card id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        x: { type: 'number', description: 'Canvas X (left-to-right). Optional.' },
        y: { type: 'number', description: 'Canvas Y (top-to-bottom; lower is earlier in shot order). Optional.' },
        ...CARD_FIELDS
      },
      required: ['type'],
      additionalProperties: false
    }
  },
  {
    name: 'update_card',
    description: 'Update fields on an existing card. Only the fields you pass are changed.',
    inputSchema: {
      type: 'object',
      properties: { projectPath: PROJECT_PATH_FIELD, cardId: { type: 'string' }, ...CARD_FIELDS },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'move_card',
    description: 'Reposition a card on the canvas. Canvas order (top-to-bottom, then left-to-right) drives scene grouping and shot order.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        cardId: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number' },
        h: { type: 'number' }
      },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_card',
    description: 'Delete a card from the board by id.',
    inputSchema: {
      type: 'object',
      properties: { projectPath: PROJECT_PATH_FIELD, cardId: { type: 'string' } },
      required: ['cardId'],
      additionalProperties: false
    }
  },
  {
    name: 'set_shot_order',
    description: 'Set the explicit shot order by passing card ids in the order they should generate. Each listed card gets a zero-padded shotOrderLabel (S01, S02, …) and globalShotOrder index. Cards not listed keep their canvas-position order.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        order: { type: 'array', items: { type: 'string' }, description: 'Ordered array of card ids.' },
        prefix: { type: 'string', description: 'Label prefix, default "S".' }
      },
      required: ['order'],
      additionalProperties: false
    }
  },
  {
    name: 'attach_asset',
    description: 'Register an asset on the project and optionally link it to a card. Provide filePath (a real file, copied into the project\'s <project>-assets/ folder) or externalUrl (a link). Set cardId + optionally slot ("asset" for a media shot image, "start"/"end"/"reference" for a workflow card, "reference" for a styleRef/musicRef card). Returns the new asset id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        name: { type: 'string', description: 'Display name. Defaults to the file/URL basename.' },
        filePath: { type: 'string', description: 'Absolute path to a source file to copy into the project.' },
        externalUrl: { type: 'string', description: 'External reference URL (for link assets).' },
        assetType: { type: 'string', description: 'e.g. "image", "video", "audio", "video-link", "music-link", "reference-link". Inferred from the file/URL when omitted.' },
        tags: { type: 'string' },
        notes: { type: 'string' },
        cardId: { type: 'string', description: 'Optional card to link this asset to.' },
        slot: { type: 'string', enum: ['asset', 'start', 'end', 'reference'], description: 'Which card slot to fill. Default "asset".' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'set_continuity',
    description: 'Update the continuity bible (characters, wardrobe, locations, props, styleRules, neverChange). Only provided fields change. These travel with every handoff package.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        characters: { type: 'string' },
        wardrobe: { type: 'string' },
        locations: { type: 'string' },
        props: { type: 'string' },
        styleRules: { type: 'string' },
        neverChange: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'build_handoff_package',
    description: 'Assemble a generator-ready handoff package folder from the project: project_manifest.json (schema master-canvas-handoff-v1, the source of truth), copied source assets under assets/<scene>/, a ComfyUI/LTX shot manifest and one job JSON per shot under comfyui/jobs/, a Hermes agent job, timeline shot_order.csv + scene_bins.json, deliverables/bin_plan.json, and a readable shot-package.md. Preserves scene order, shot order, prompts, negative prompts, references, and continuity.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: PROJECT_PATH_FIELD,
        outputDir: { type: 'string', description: 'Folder to write the package into. Defaults to <project>-handoff next to the project file.' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'inspect_package',
    description: 'Read a Master Canvas handoff package (a folder with project_manifest.json, a project_manifest.json path, or a master-canvas-project.json) and summarize project, scenes, shots, assets, references, target generation, scene bins, and readiness (which shots are missing source images).',
    inputSchema: {
      type: 'object',
      properties: { package_path: { type: 'string', description: 'Path to a handoff folder, project_manifest.json, or master-canvas-project.json.' } },
      required: ['package_path'],
      additionalProperties: false
    }
  },
  {
    name: 'comfy_plan',
    description: 'Build a concise ComfyUI/LTX 2.3 shot-by-shot execution plan from a handoff package or manifest: for every shot in order, the source image path, output bin, duration, resolution, prompt, and negative prompt.',
    inputSchema: {
      type: 'object',
      properties: { package_path: { type: 'string', description: 'Path to a handoff folder, project_manifest.json, or master-canvas-project.json.' } },
      required: ['package_path'],
      additionalProperties: false
    }
  }
]

const TOOL_NAMES = new Set(TOOLS.map((t) => t.name))

/* --------------------------- tool handlers ------------------------------ */

function summarizeCard(project, node) {
  return {
    id: node.id, type: node.type, title: node.title,
    sceneKey: getSceneKey(project, node), shotOrderLabel: node.shotOrderLabel || '',
    x: node.x, y: node.y, status: node.status, assetId: node.assetId || ''
  }
}

const CARD_FIELD_KEYS = Object.keys(CARD_FIELDS).filter((k) => k !== 'type')

function inferAssetType(filePath, externalUrl) {
  if (externalUrl) return 'reference-link'
  const ext = extname(filePath || '').toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) return 'image'
  if (['.mp4', '.mov', '.webm', '.m4v'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.aac', '.m4a', '.flac'].includes(ext)) return 'audio'
  return 'file'
}

function runTool(name, args) {
  switch (name) {
    case 'get_project': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const byType = {}
      project.nodes.forEach((n) => { (byType[n.type] ||= []).push(summarizeCard(project, n)) })
      const sceneKeys = orderedSceneKeysForExport(project)
      const shots = project.nodes
        .filter((n) => n.type === 'media')
        .sort((a, b) => (String(a.shotOrderLabel).localeCompare(String(b.shotOrderLabel))) || sortNodesByCanvasOrder(a, b))
        .map((n) => summarizeCard(project, n))
      return {
        projectPath: path,
        id: project.id,
        title: project.title,
        updatedAt: project.updatedAt,
        continuity: project.continuity,
        cardCount: project.nodes.length,
        cardsByType: byType,
        sceneKeys,
        shotOrder: shots,
        assets: project.assets.map((a) => ({ id: a.id, name: a.name, type: a.type, externalUrl: a.externalUrl || '', sourcePath: a.sourcePath || '' }))
      }
    }
    case 'create_project': {
      const path = resolveProjectPath(args)
      if (existsSync(path) && !args.overwrite) {
        const err = new Error(`A project already exists at ${path}. Pass overwrite:true to replace it.`)
        err.userFacing = true
        throw err
      }
      const project = createDefaultProject(args.title)
      saveProject(path, project)
      return { created: true, projectPath: path, id: project.id, title: project.title }
    }
    case 'list_cards': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const cards = project.nodes
        .filter((n) => !args.type || n.type === args.type)
        .sort(sortNodesByCanvasOrder)
        .map((n) => summarizeCard(project, n))
      return { projectPath: path, count: cards.length, cards }
    }
    case 'get_card': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const node = project.nodes.find((n) => n.id === args.cardId)
      if (!node) { const e = new Error(`No card with id ${args.cardId}.`); e.userFacing = true; throw e }
      return { ...node, sceneKey: getSceneKey(project, node) }
    }
    case 'add_card': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const overrides = {}
      CARD_FIELD_KEYS.forEach((k) => { if (args[k] !== undefined) overrides[k] = args[k] })
      const node = makeNode(args.type, args.x ?? 0, args.y ?? 0, overrides)
      project.nodes.push(node)
      saveProject(path, project)
      return { added: true, cardId: node.id, type: node.type, sceneKey: getSceneKey(project, node) }
    }
    case 'update_card': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const node = project.nodes.find((n) => n.id === args.cardId)
      if (!node) { const e = new Error(`No card with id ${args.cardId}.`); e.userFacing = true; throw e }
      CARD_FIELD_KEYS.forEach((k) => { if (args[k] !== undefined) node[k] = args[k] })
      if (args.type !== undefined) node.type = args.type
      node.updatedAt = now()
      saveProject(path, project)
      return { updated: true, cardId: node.id }
    }
    case 'move_card': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const node = project.nodes.find((n) => n.id === args.cardId)
      if (!node) { const e = new Error(`No card with id ${args.cardId}.`); e.userFacing = true; throw e }
      if (args.x !== undefined) node.x = args.x
      if (args.y !== undefined) node.y = args.y
      if (args.w !== undefined) node.w = args.w
      if (args.h !== undefined) node.h = args.h
      node.updatedAt = now()
      saveProject(path, project)
      return { moved: true, cardId: node.id, x: node.x, y: node.y }
    }
    case 'delete_card': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const before = project.nodes.length
      project.nodes = project.nodes.filter((n) => n.id !== args.cardId)
      if (project.nodes.length === before) { const e = new Error(`No card with id ${args.cardId}.`); e.userFacing = true; throw e }
      saveProject(path, project)
      return { deleted: true, cardId: args.cardId }
    }
    case 'set_shot_order': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const prefix = args.prefix || 'S'
      const applied = []
      args.order.forEach((cardId, index) => {
        const node = project.nodes.find((n) => n.id === cardId)
        if (!node) return
        node.shotOrderLabel = `${prefix}${String(index + 1).padStart(2, '0')}`
        node.globalShotOrder = String(index + 1)
        node.updatedAt = now()
        applied.push({ cardId, shotOrderLabel: node.shotOrderLabel })
      })
      saveProject(path, project)
      return { ordered: applied.length, cards: applied }
    }
    case 'attach_asset': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      if (!args.filePath && !args.externalUrl) {
        const e = new Error('Provide filePath or externalUrl.'); e.userFacing = true; throw e
      }
      const asset = {
        id: uid('asset'),
        name: args.name || (args.filePath ? basename(args.filePath) : args.externalUrl),
        type: args.assetType || inferAssetType(args.filePath, args.externalUrl),
        tags: args.tags || '',
        notes: args.notes || '',
        externalUrl: args.externalUrl || '',
        sourcePath: '',
        createdAt: now()
      }
      if (args.filePath) {
        let src = args.filePath.startsWith('~') ? join(homedir(), args.filePath.slice(1)) : args.filePath
        src = isAbsolute(src) ? src : resolve(src)
        if (!existsSync(src)) { const e = new Error(`No file at ${src}.`); e.userFacing = true; throw e }
        const assetsDir = projectAssetsDir(path)
        mkdirSync(assetsDir, { recursive: true })
        const destName = `${asset.id}-${safeSlug(basename(src, extname(src)))}${extname(src)}`
        const dest = join(assetsDir, destName)
        copyFileSync(src, dest)
        asset.sourcePath = dest
        asset.size = statSync(dest).size
      }
      project.assets.push(asset)
      let linked = null
      if (args.cardId) {
        const node = project.nodes.find((n) => n.id === args.cardId)
        if (!node) { const e = new Error(`No card with id ${args.cardId}.`); e.userFacing = true; throw e }
        const slot = args.slot || 'asset'
        const field = slot === 'start' ? 'startAssetId' : slot === 'end' ? 'endAssetId' : slot === 'reference' ? 'referenceAssetId' : 'assetId'
        node[field] = asset.id
        if (asset.externalUrl && (node.type === 'styleRef' || node.type === 'musicRef')) node.referenceUrl = asset.externalUrl
        node.updatedAt = now()
        linked = { cardId: node.id, slot, field }
      }
      saveProject(path, project)
      return { attached: true, assetId: asset.id, name: asset.name, type: asset.type, sourcePath: asset.sourcePath, linked }
    }
    case 'set_continuity': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      for (const k of ['characters', 'wardrobe', 'locations', 'props', 'styleRules', 'neverChange']) {
        if (args[k] !== undefined) project.continuity[k] = args[k]
      }
      saveProject(path, project)
      return { updated: true, continuity: project.continuity }
    }
    case 'build_handoff_package': {
      const path = resolveProjectPath(args)
      const project = loadProject(path)
      const outputDir = args.outputDir
        ? (isAbsolute(args.outputDir) ? args.outputDir : resolve(args.outputDir))
        : join(dirname(path), `${basename(path, extname(path))}-handoff`)
      return buildHandoffPackage(project, path, outputDir)
    }
    case 'inspect_package': {
      const { manifest, source } = readManifestFrom(args.package_path)
      const scenes = manifest.scenes || []
      const shots = manifest.shots || []
      const missing = shots.filter((shot) => !shot.sourcePath)
      return {
        source,
        title: manifest.title,
        schema: manifest.schema,
        scene_count: scenes.length,
        shot_count: shots.length,
        asset_count: (manifest.assets || []).length,
        reference_count: (manifest.references || []).length,
        target_generation: manifest.targetGeneration || {},
        scene_bins: scenes.map((scene) => ({
          scene: scene.sceneKey,
          shot_count: (scene.shots || []).length,
          output_bin: `renders/${sceneFolderName(scene.sceneKey || 'scene')}`
        })),
        missing_source_paths: missing.map((shot) => ({ orderLabel: shot.orderLabel, title: shot.title })),
        ready: missing.length === 0
      }
    }
    case 'comfy_plan': {
      const { manifest, source } = readManifestFrom(args.package_path)
      return {
        source,
        title: manifest.title,
        engine: 'ComfyUI',
        model: 'LTX 2.3 image-to-video',
        quality_floor: (manifest.targetGeneration || {}).minimumResolution || '1080p',
        shots: (manifest.shots || []).map((shot) => ({
          orderLabel: shot.orderLabel,
          scene: shot.sceneKey,
          sourceImage: shot.sourcePath,
          outputBin: shot.outputBin,
          duration: shot.duration,
          resolution: shot.resolution,
          prompt: shot.prompt,
          negativePrompt: shot.negativePrompt
        }))
      }
    }
    default: {
      const e = new Error(`Unknown tool: ${name}`)
      e.userFacing = true
      throw e
    }
  }
}

/* ---------------------------- JSON-RPC plumbing ------------------------- */

function write(msg) { process.stdout.write(JSON.stringify(msg) + '\n') }
function reply(id, result) { write({ jsonrpc: '2.0', id, result }) }
function replyError(id, code, message) { write({ jsonrpc: '2.0', id, error: { code, message } }) }

function handleToolCall(id, params) {
  const name = params?.name
  const args = params?.arguments ?? {}
  if (!TOOL_NAMES.has(name)) {
    reply(id, { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true })
    return
  }
  try {
    const result = runTool(name, args)
    reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
  } catch (error) {
    reply(id, { content: [{ type: 'text', text: error.userFacing ? error.message : `Error: ${error.message}` }], isError: true })
  }
}

function handle(msg) {
  const { id, method, params } = msg
  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'master-canvas', version: '1.0.0' }
      })
      return
    case 'notifications/initialized':
      return
    case 'tools/list':
      reply(id, { tools: TOOLS })
      return
    case 'tools/call':
      handleToolCall(id, params)
      return
    case 'ping':
      reply(id, {})
      return
    default:
      if (id !== undefined && id !== null) replyError(id, -32601, `Method not found: ${method}`)
      return
  }
}

/* ------------------------------- stdin loop ----------------------------- */

let buffer = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  let idx
  while ((idx = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    handle(msg)
  }
})
process.stdin.on('end', () => process.exit(0))
