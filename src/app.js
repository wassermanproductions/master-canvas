const STORAGE_KEY = "master-canvas-project-v1";
const PROJECTS_KEY = "master-canvas-projects-v1";
const ACTIVE_PROJECT_KEY = "master-canvas-active-project-v1";
const PROJECT_KEY_PREFIX = "master-canvas-project-v1:";
const HELP_POSITION_KEY = "master-canvas-help-position-v1";
const PANEL_LAYOUT_KEY = "master-canvas-panel-layout-v1";
const ASSET_SIZE_KEY = "master-canvas-asset-size-v1";
const ACTIVE_TOOL_KEY = "master-canvas-active-tool-v1";
const VERSIONS_KEY_PREFIX = "master-canvas-versions-v1:";
const DB_NAME = "master-canvas-assets";
const DB_VERSION = 1;
const STORE_NAME = "assets";
const UNDO_LIMIT = 60;

const els = {
  projectTitle: document.querySelector("#projectTitle"),
  canvasSelect: document.querySelector("#canvasSelect"),
  undoBtn: document.querySelector("#undoBtn"),
  newCanvasBtn: document.querySelector("#newCanvasBtn"),
  templatesBtn: document.querySelector("#templatesBtn"),
  continuityBtn: document.querySelector("#continuityBtn"),
  shotListBtn: document.querySelector("#shotListBtn"),
  searchCanvasBtn: document.querySelector("#searchCanvasBtn"),
  batchEditBtn: document.querySelector("#batchEditBtn"),
  versionsBtn: document.querySelector("#versionsBtn"),
  helpBtn: document.querySelector("#helpBtn"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  resetViewBtn: document.querySelector("#resetViewBtn"),
  addReferenceBtn: document.querySelector("#addReferenceBtn"),
  openFileBtn: document.querySelector("#openFileBtn"),
  fileInput: document.querySelector("#fileInput"),
  nodeFileInput: document.querySelector("#nodeFileInput"),
  assetSearch: document.querySelector("#assetSearch"),
  assetGrid: document.querySelector("#assetGrid"),
  assetTypeFilters: document.querySelector("#assetTypeFilters"),
  assetSizeBtn: document.querySelector("#assetSizeBtn"),
  assetResizeHandle: document.querySelector("#assetResizeHandle"),
  assetCount: document.querySelector("#assetCount"),
  showInboxBtn: document.querySelector("#showInboxBtn"),
  showFavoritesBtn: document.querySelector("#showFavoritesBtn"),
  toggleArchivedBtn: document.querySelector("#toggleArchivedBtn"),
  viewport: document.querySelector("#canvasViewport"),
  world: document.querySelector("#canvasWorld"),
  nodeLayer: document.querySelector("#nodeLayer"),
  linkLayer: document.querySelector("#linkLayer"),
  lassoBox: document.querySelector("#lassoBox"),
  minimap: document.querySelector("#minimap"),
  minimapSvg: document.querySelector("#minimapSvg"),
  inspector: document.querySelector("#inspector"),
  inspectorResizeHandle: document.querySelector("#inspectorResizeHandle"),
  shotListPanel: document.querySelector("#shotListPanel"),
  shotListCloseBtn: document.querySelector("#shotListCloseBtn"),
  shotListContent: document.querySelector("#shotListContent"),
  searchPanel: document.querySelector("#searchPanel"),
  searchCloseBtn: document.querySelector("#searchCloseBtn"),
  canvasSearchInput: document.querySelector("#canvasSearchInput"),
  clearCanvasSearchBtn: document.querySelector("#clearCanvasSearchBtn"),
  exportDialog: document.querySelector("#exportDialog"),
  helpPanel: document.querySelector("#helpPanel"),
  helpDragHandle: document.querySelector("#helpDragHandle"),
  helpCloseBtn: document.querySelector("#helpCloseBtn"),
  exportText: document.querySelector("#exportText"),
  downloadMarkdownBtn: document.querySelector("#downloadMarkdownBtn"),
  downloadStoryboardBtn: document.querySelector("#downloadStoryboardBtn"),
  downloadStoryboardPdfBtn: document.querySelector("#downloadStoryboardPdfBtn"),
  downloadJsonBtn: document.querySelector("#downloadJsonBtn"),
  downloadHandoffZipBtn: document.querySelector("#downloadHandoffZipBtn"),
  continuityDialog: document.querySelector("#continuityDialog"),
  continuityCharacters: document.querySelector("#continuityCharacters"),
  continuityWardrobe: document.querySelector("#continuityWardrobe"),
  continuityLocations: document.querySelector("#continuityLocations"),
  continuityProps: document.querySelector("#continuityProps"),
  continuityStyleRules: document.querySelector("#continuityStyleRules"),
  continuityNeverChange: document.querySelector("#continuityNeverChange"),
  saveContinuityBtn: document.querySelector("#saveContinuityBtn"),
  templatesDialog: document.querySelector("#templatesDialog"),
  templatesList: document.querySelector("#templatesList"),
  referenceDialog: document.querySelector("#referenceDialog"),
  referenceType: document.querySelector("#referenceType"),
  referenceTitle: document.querySelector("#referenceTitle"),
  referenceUrl: document.querySelector("#referenceUrl"),
  referenceNotes: document.querySelector("#referenceNotes"),
  saveReferenceBtn: document.querySelector("#saveReferenceBtn"),
  batchDialog: document.querySelector("#batchDialog"),
  batchCountLabel: document.querySelector("#batchCountLabel"),
  batchStatus: document.querySelector("#batchStatus"),
  batchTags: document.querySelector("#batchTags"),
  applyBatchBtn: document.querySelector("#applyBatchBtn"),
  versionsDialog: document.querySelector("#versionsDialog"),
  versionName: document.querySelector("#versionName"),
  saveVersionBtn: document.querySelector("#saveVersionBtn"),
  versionsList: document.querySelector("#versionsList"),
};

const now = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const esc = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

let db;
let saveTimer;
let state = createDefaultProject();
let projects = [];
let allAssets = [];
let dragState = null;
let panState = null;
let lassoState = null;
let helpDragState = null;
let connectState = null;
let pendingNodeFileId = "";
let undoStack = [];
let resizeState = null;
let suppressNextNodeClick = false;
let isSpacePanning = false;
let inspectorOpen = true;
let panelLayout = { assetWidth: 360, inspectorWidth: 380 };
let assetSizeMode = ["small", "medium", "large"].includes(localStorage.getItem(ASSET_SIZE_KEY)) ? localStorage.getItem(ASSET_SIZE_KEY) : "medium";
let activeTool = ["select", "hand"].includes(localStorage.getItem(ACTIVE_TOOL_KEY)) ? localStorage.getItem(ACTIVE_TOOL_KEY) : "select";
let canvasSearch = "";
let assetFilters = {
  search: "",
  type: "all",
  favoritesOnly: false,
  inboxOnly: false,
  showArchived: false,
};

function createDefaultProject() {
  return {
    id: uid("project"),
    title: "Untitled pre-production board",
    createdAt: now(),
    updatedAt: now(),
    view: { x: 520, y: 230, scale: 0.9 },
    selectedNodeId: null,
    selectedNodeIds: [],
    selectedAssetId: null,
    continuity: defaultContinuity(),
    assets: [],
    nodes: [],
  };
}

function defaultContinuity() {
  return {
    characters: "",
    wardrobe: "",
    locations: "",
    props: "",
    styleRules: "",
    neverChange: "",
  };
}

function seedProject() {
  state.nodes = [
    makeNode("note", -420, -110, {
      title: "Story spine",
      notes: "Act beats, references, and decisions live on the board.",
    }),
    makeNode("character", -80, -180, {
      title: "Character ref",
      notes: "Attach model sheets, wardrobe, face references, and continuity notes.",
      tags: "character, continuity",
    }),
    makeNode("scene", -80, 80, {
      title: "Scene ref",
      notes: "Collect locations, palettes, lighting, lenses, and blocking references.",
      tags: "scene, lookdev",
    }),
    makeNode("workflow", 340, -40, {
      title: "Image to Video",
      prompt: "Locked camera. Subject moves through frame with clean continuity.",
      status: "ready",
      tags: "shot, motion",
    }),
  ];
  setSelectedNodeIds([state.nodes[3].id]);
}

function makeNode(type, x, y, overrides = {}) {
  const base = {
    id: uid("node"),
    type,
    x,
    y,
    w: type === "section" ? 760 : type === "workflow" || type === "imageWorkflow" ? 320 : type === "placeholder" ? 300 : 270,
    h: type === "section" ? 440 : 180,
    title: nodeTypeLabel(type),
    notes: "",
    tags: "",
    status: type === "workflow" || type === "imageWorkflow" ? "ready" : "draft",
    provider: type === "imageWorkflow" ? "ComfyUI" : "Kling",
    model: type === "imageWorkflow" ? "SDXL / Flux" : "Kling 3.0 Pro",
    aspectRatio: "16:9",
    resolution: "1080p",
    duration: "10s",
    seed: "",
    prompt: "",
    negativePrompt: "",
    startAssetId: "",
    endAssetId: "",
    assetId: "",
    referenceAssetId: "",
    referenceUrl: "",
    sourceNodeId: "",
    neededFor: "",
    assignedSectionId: "",
    linkSourceSide: "right",
    linkTargetSide: "left",
    overallPrompt: "",
    stylePrompt: "",
    musicPrompt: "",
    shotSize: "",
    cameraAngle: "",
    cameraMovement: "",
    subjectAction: "",
    location: "",
    mood: "",
    lighting: "",
    lensFeel: "",
    priority: "normal",
    shotOrderLabel: "",
    shotBeatTitle: "",
    globalShotOrder: "",
    influenceColor: "",
    influencePacing: "",
    influenceCamera: "",
    influenceLighting: "",
    influenceUse: "",
    influenceStrength: "medium",
    doNotCopy: "",
    reviewOwner: "",
    reviewDecision: "",
    reviewNotes: "",
    attempts: [],
    createdAt: now(),
    updatedAt: now(),
  };
  return { ...base, ...overrides };
}

function nodeTypeLabel(type) {
  const labels = {
    workflow: "Image to Video",
    imageWorkflow: "Generate Image",
    shot: "Shot Card",
    character: "Character Ref",
    scene: "Scene Ref",
    section: "Scene Section",
    placeholder: "Placeholder",
    inspiration: "Inspiration",
    styleRef: "Style References",
    musicRef: "Music References",
    note: "Text Note",
    media: "Media",
  };
  return labels[type] || "Card";
}

function isWorkflowNode(node) {
  return node && (node.type === "workflow" || node.type === "imageWorkflow");
}

function versionStorageKey(projectId = state.id) {
  return `${VERSIONS_KEY_PREFIX}${projectId}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbTransaction(mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function getAllAssets() {
  return new Promise((resolve, reject) => {
    const request = dbTransaction().getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function putAsset(asset) {
  return new Promise((resolve, reject) => {
    const request = dbTransaction("readwrite").put(asset);
    request.onsuccess = () => resolve(asset);
    request.onerror = () => reject(request.error);
  });
}

async function boot() {
  db = await openDb();
  allAssets = await getAllAssets();
  state.assets = allAssets;
  migrateLegacyProject();
  projects = readProjectsIndex();
  const importUrl = new URLSearchParams(window.location.search).get("import");
  if (importUrl) {
    await importPackageFromManifest(importUrl);
    history.replaceState(null, "", window.location.pathname);
  } else if (projects.length) {
    loadProject(localStorage.getItem(ACTIVE_PROJECT_KEY) || projects[0].id);
  } else if (!state.nodes.length) {
    seedProject();
    persistProjectState();
  }
  els.projectTitle.value = state.title;
  restorePanelLayout();
  wireEvents();
  setActiveTool(activeTool, false);
  restoreHelpPanelPosition();
  render();
  toast("Local canvas ready");
}

function readProjectsIndex() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeProjectsIndex(nextProjects = projects) {
  projects = nextProjects
    .filter((project) => project && project.id)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function projectStorageKey(id) {
  return `${PROJECT_KEY_PREFIX}${id}`;
}

function migrateLegacyProject() {
  if (localStorage.getItem(PROJECTS_KEY) || !localStorage.getItem(STORAGE_KEY)) return;
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const migrated = {
      ...createDefaultProject(),
      ...legacy,
      id: legacy.id || uid("project"),
      updatedAt: legacy.updatedAt || now(),
    };
    localStorage.setItem(projectStorageKey(migrated.id), JSON.stringify(serializeProject(migrated)));
    writeProjectsIndex([{ id: migrated.id, title: migrated.title, updatedAt: migrated.updatedAt }]);
    localStorage.setItem(ACTIVE_PROJECT_KEY, migrated.id);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadProject(projectId) {
  const saved = localStorage.getItem(projectStorageKey(projectId));
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    const loaded = { ...createDefaultProject(), ...parsed, id: parsed.id || projectId };
    loaded.continuity = { ...defaultContinuity(), ...(parsed.continuity || {}) };
    loaded.nodes = (loaded.nodes || []).map(normalizeNode);
    state = loaded;
    state.assets = allAssets;
    localStorage.setItem(ACTIVE_PROJECT_KEY, state.id);
    return true;
  } catch {
    return false;
  }
}

function normalizeNode(node) {
  return {
    ...makeNode(node.type || "note", node.x || 0, node.y || 0),
    ...node,
    attempts: Array.isArray(node.attempts) ? node.attempts : [],
  };
}

function getSceneKey(node, visited = new Set()) {
  if (!node || visited.has(node.id)) return "";
  visited.add(node.id);
  const direct = extractSceneKey(node);
  if (direct) return direct;
  if (node.sourceNodeId) {
    const source = state.nodes.find((item) => item.id === node.sourceNodeId);
    const sourceKey = getSceneKey(source, visited);
    if (sourceKey) return sourceKey;
  }
  const headers = state.nodes
    .filter((item) => item.type === "scene" || item.type === "shot" || item.type === "section")
    .sort((a, b) => b.y - a.y || b.x - a.x);
  return headers.find((header) => header.y <= node.y + 80)?.title || "";
}

function extractSceneKey(node) {
  const text = `${node.title || ""} ${node.tags || ""}`.trim();
  const sceneMatch = text.match(/\bscene\s*0*(\d+)\b/i);
  if (sceneMatch) return `Scene ${Number(sceneMatch[1])}`;
  if (node.type === "scene" || node.type === "shot" || node.type === "section") return node.title || "";
  return "";
}

function sortNodesByCanvasOrder(a, b) {
  const rowA = Math.round((a.y || 0) / 80);
  const rowB = Math.round((b.y || 0) / 80);
  return rowA - rowB || (a.x || 0) - (b.x || 0);
}

function sceneNumberFromKey(sceneKey) {
  const match = String(sceneKey).match(/Scene\s+(\d+)/i);
  return match ? match[1] : "";
}

async function manifestExists(manifestUrl) {
  try {
    const response = await fetch(manifestUrl, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

function clearAssetsStore() {
  return new Promise((resolve, reject) => {
    const request = dbTransaction("readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function importPackageFromManifest(manifestUrl) {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Could not load import manifest: ${manifestUrl}`);
  const manifest = await response.json();
  state = createDefaultProject();
  state.title = manifest.title || "Imported pre-production board";
  state.view = manifest.view || { x: 140, y: 140, scale: 0.62 };
  state.assets = allAssets;
  state.nodes = [];

  const importedByUrl = new Map();
  for (const group of manifest.groups || []) {
    for (const item of group.files || []) {
      let asset = allAssets.find((existing) => existing.name === item.name);
      if (!asset) {
        asset = await createAssetFromUrl(item.url, {
          name: item.name,
          tags: [group.name, item.role, item.tags].filter(Boolean).join(", "),
        });
        await putAsset(asset);
        allAssets.push(asset);
      }
      importedByUrl.set(item.url, asset);
    }
  }
  state.assets = allAssets;

  layoutImportedPackage(manifest, importedByUrl);
  persistProjectState();
}

async function createAssetFromUrl(url, meta = {}) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not import asset: ${url}`);
  const blob = await response.blob();
  const dataUrl = await blobToDataUrl(blob);
  return {
    id: uid("asset"),
    name: meta.name || decodeURIComponent(url.split("/").pop() || "Imported asset"),
    type: blob.type.startsWith("video/") ? "video" : "image",
    mime: blob.type || "application/octet-stream",
    size: blob.size,
    dataUrl,
    createdAt: now(),
    updatedAt: now(),
        favorite: false,
        archived: false,
        inbox: false,
        tags: meta.tags || "",
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function layoutImportedPackage(manifest, importedByUrl) {
  const rowGap = 420;
  const cardW = 250;
  const mediaW = 250;
  const mediaH = 178;
  let y = -760;
  let lastSceneNodeId = "";

  for (const group of manifest.groups || []) {
    const groupAssets = (group.files || []).map((item) => importedByUrl.get(item.url)).filter(Boolean);
    const isTextCard = group.type === "text-card";
    const header = makeNode(isTextCard ? "shot" : "scene", -1180, y, {
      title: group.name,
      notes: group.notes || "",
      status: isTextCard ? "ready" : "draft",
      tags: group.type || "scene",
      w: cardW,
    });
    state.nodes.push(header);

    const mediaNodes = [];
    groupAssets.forEach((asset, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const node = makeNode("media", -860 + col * 285, y + row * 215, {
        title: asset.name,
        assetId: asset.id,
        notes: asset.tags,
        tags: group.name,
        w: mediaW,
        h: mediaH,
        sourceNodeId: header.id,
      });
      state.nodes.push(node);
      mediaNodes.push(node);
    });

    if (isTextCard && mediaNodes[0]) {
      const note = group.name.includes("Ending") ? "Ending title card" : "Text card between Scene 4 and Scene 5";
      const workflow = makeNode("workflow", 360, y + 18, {
        title: `${group.name} Hold`,
        sourceNodeId: mediaNodes[0].id,
        startAssetId: mediaNodes[0].assetId,
        prompt: "Hold on the text card long enough to read clearly. Keep the composition stable and preserve the typography.",
        notes: note,
        tags: "text card, title",
        duration: group.name.includes("Ending") ? "5s" : "4s",
        status: "ready",
      });
      state.nodes.push(workflow);
      lastSceneNodeId = workflow.id;
    } else if (mediaNodes.length) {
      const workflow = makeNode("workflow", 360, y + 18, {
        title: `${group.name} Image to Video`,
        sourceNodeId: mediaNodes[0].id,
        startAssetId: mediaNodes[0].assetId,
        endAssetId: mediaNodes.at(-1)?.assetId || "",
        prompt: group.prompt || "Animate this scene with clean continuity, stable character identity, and motivated camera movement.",
        notes: `Primary workflow placeholder for ${group.name}.`,
        tags: `${group.name}, image-to-video`,
        status: "ready",
      });
      state.nodes.push(workflow);
      lastSceneNodeId = workflow.id;
    }

    y += rowGap + Math.max(0, Math.ceil(groupAssets.length / 4) - 1) * 215;
  }

  const summary = makeNode("note", 740, -760, {
    title: "Package loaded",
    notes: `Imported ${state.assets.length} assets from ${manifest.title}. Scene rows are laid out top to bottom. Each row includes media cards and a ready Image-to-Video workflow placeholder.`,
    tags: "import, guide",
    status: "ready",
    w: 310,
    sourceNodeId: lastSceneNodeId,
  });
  state.nodes.push(summary);
  setSelectedNodeIds([summary.id]);
}

function saveProject(showToast = false) {
  state.title = els.projectTitle.value.trim() || "Untitled pre-production board";
  state.updatedAt = now();
  persistProjectState();
  if (showToast) toast("Saved locally");
}

function persistProjectState() {
  state.updatedAt = state.updatedAt || now();
  localStorage.setItem(projectStorageKey(state.id), JSON.stringify(serializeProject(state)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject(state)));
  localStorage.setItem(ACTIVE_PROJECT_KEY, state.id);
  upsertProjectIndex(state);
  renderProjectSelect();
}

function serializeProject(project) {
  return {
    ...project,
    assets: project.assets.map(({ dataUrl, ...asset }) => asset),
  };
}

function upsertProjectIndex(project) {
  const withoutCurrent = projects.filter((item) => item.id !== project.id);
  writeProjectsIndex([
    { id: project.id, title: project.title, updatedAt: project.updatedAt || now() },
    ...withoutCurrent,
  ]);
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProject(false), 220);
}

function recordUndo() {
  undoStack.push(JSON.stringify(serializeProject(state)));
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  updateUndoButton();
}

function undoLastChange() {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  clearTimeout(saveTimer);
  const parsed = JSON.parse(snapshot);
  state = { ...createDefaultProject(), ...parsed, id: parsed.id || state.id };
  state.continuity = { ...defaultContinuity(), ...(parsed.continuity || {}) };
  state.nodes = (state.nodes || []).map(normalizeNode);
  state.assets = allAssets;
  els.projectTitle.value = state.title;
  persistProjectState();
  render();
  updateUndoButton();
  toast("Undone");
}

function updateUndoButton() {
  if (!els.undoBtn) return;
  els.undoBtn.disabled = undoStack.length === 0;
}

function restorePanelLayout() {
  try {
    panelLayout = { ...panelLayout, ...JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) || "{}") };
  } catch {
    panelLayout = { assetWidth: 360, inspectorWidth: 380 };
  }
  panelLayout.assetWidth = clamp(panelLayout.assetWidth, 240, 640);
  panelLayout.inspectorWidth = clamp(panelLayout.inspectorWidth, 300, 720);
  inspectorOpen = panelLayout.inspectorOpen !== false;
  applyPanelLayout();
}

function savePanelLayout() {
  localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify({ ...panelLayout, inspectorOpen }));
}

function applyPanelLayout() {
  const app = document.querySelector("#app");
  app?.style.setProperty("--asset-panel-width", `${panelLayout.assetWidth}px`);
  app?.style.setProperty("--inspector-panel-width", inspectorOpen ? `${panelLayout.inspectorWidth}px` : "0px");
  app?.classList.toggle("inspector-collapsed", !inspectorOpen);
}

function openInspectorPanel() {
  if (inspectorOpen) return;
  inspectorOpen = true;
  applyPanelLayout();
  savePanelLayout();
}

function closeInspectorPanel() {
  inspectorOpen = false;
  applyPanelLayout();
  savePanelLayout();
  renderMinimap();
}

function wireEvents() {
  els.projectTitle.addEventListener("input", queueSave);
  els.canvasSelect.addEventListener("change", () => {
    saveProject(false);
    if (loadProject(els.canvasSelect.value)) {
      undoStack = [];
      updateUndoButton();
      els.projectTitle.value = state.title;
      render();
      toast(`Opened ${state.title}`);
    }
  });
  els.undoBtn.addEventListener("click", undoLastChange);
  els.newCanvasBtn.addEventListener("click", createNewCanvas);
  els.templatesBtn.addEventListener("click", openTemplatesDialog);
  els.templatesList.addEventListener("click", onTemplateListClick);
  els.continuityBtn.addEventListener("click", openContinuityDialog);
  els.saveContinuityBtn.addEventListener("click", saveContinuity);
  els.shotListBtn.addEventListener("click", toggleShotListPanel);
  els.shotListCloseBtn.addEventListener("click", closeShotListPanel);
  els.shotListContent.addEventListener("click", onShotListClick);
  els.searchCanvasBtn.addEventListener("click", toggleSearchPanel);
  els.searchCloseBtn.addEventListener("click", closeSearchPanel);
  els.canvasSearchInput.addEventListener("input", () => {
    canvasSearch = els.canvasSearchInput.value.trim().toLowerCase();
    renderNodes();
  });
  els.clearCanvasSearchBtn.addEventListener("click", clearCanvasSearch);
  els.batchEditBtn.addEventListener("click", openBatchDialog);
  els.applyBatchBtn.addEventListener("click", applyBatchEdit);
  els.versionsBtn.addEventListener("click", openVersionsDialog);
  els.saveVersionBtn.addEventListener("click", saveCheckpoint);
  els.versionsList.addEventListener("click", onVersionListClick);
  els.helpBtn.addEventListener("click", toggleHelpPanel);
  els.helpCloseBtn.addEventListener("click", closeHelpPanel);
  els.helpDragHandle.addEventListener("pointerdown", onHelpPointerDown);
  els.saveProjectBtn.addEventListener("click", () => saveProject(true));
  els.exportBtn.addEventListener("click", openExportDialog);
  els.resetViewBtn.addEventListener("click", fitView);
  els.addReferenceBtn.addEventListener("click", openReferenceDialog);
  els.saveReferenceBtn.addEventListener("click", saveReferenceLink);
  els.openFileBtn.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", async () => {
    await importFiles([...els.fileInput.files], viewportCenterWorld());
    els.fileInput.value = "";
  });
  els.nodeFileInput.addEventListener("change", async () => {
    await attachFileToSelectedReference([...els.nodeFileInput.files][0]);
    els.nodeFileInput.value = "";
  });
  els.assetSearch.addEventListener("input", () => {
    assetFilters.search = els.assetSearch.value.trim().toLowerCase();
    renderAssets();
  });
  els.assetTypeFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-asset-filter]");
    if (!button) return;
    assetFilters.type = button.dataset.assetFilter || "all";
    renderAssets();
  });
  els.assetSizeBtn.addEventListener("click", cycleAssetSizeMode);
  els.showInboxBtn.addEventListener("click", () => {
    assetFilters.inboxOnly = !assetFilters.inboxOnly;
    els.showInboxBtn.classList.toggle("primary", assetFilters.inboxOnly);
    renderAssets();
  });
  els.showFavoritesBtn.addEventListener("click", () => {
    assetFilters.favoritesOnly = !assetFilters.favoritesOnly;
    els.showFavoritesBtn.classList.toggle("primary", assetFilters.favoritesOnly);
    renderAssets();
  });
  els.toggleArchivedBtn.addEventListener("click", () => {
    assetFilters.showArchived = !assetFilters.showArchived;
    els.toggleArchivedBtn.classList.toggle("primary", assetFilters.showArchived);
    renderAssets();
  });

  document.querySelectorAll("[data-add]").forEach((button) => {
    button.addEventListener("click", () => addNodeFromToolbar(button.dataset.add));
  });
  document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
    button.addEventListener("click", () => setActiveTool(button.dataset.tool));
  });

  els.viewport.addEventListener("wheel", onWheel, { passive: false });
  els.viewport.addEventListener("pointerdown", onViewportPointerDown);
  els.minimap.addEventListener("pointerdown", onMinimapPointerDown);
  els.minimap.addEventListener("keydown", onMinimapKeyDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointermove", onHelpPointerMove);
  window.addEventListener("pointermove", onPanelResizeMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointerup", onHelpPointerUp);
  window.addEventListener("pointerup", onPanelResizeEnd);
  els.assetResizeHandle.addEventListener("pointerdown", (event) => startPanelResize(event, "asset"));
  els.inspectorResizeHandle.addEventListener("pointerdown", (event) => startPanelResize(event, "inspector"));
  els.nodeLayer.addEventListener("pointerdown", onNodePointerDown);
  els.nodeLayer.addEventListener("click", onNodeClick);
  els.assetGrid.addEventListener("click", onAssetGridClick);
  els.assetGrid.addEventListener("dragstart", onAssetDragStart);
  els.viewport.addEventListener("dragover", (event) => event.preventDefault());
  els.viewport.addEventListener("drop", onCanvasDrop);
  els.inspector.addEventListener("input", onInspectorInput);
  els.inspector.addEventListener("change", onInspectorInput);
  els.inspector.addEventListener("click", onInspectorClick);
  els.downloadMarkdownBtn.addEventListener("click", () => downloadText(exportMarkdown(), "master-canvas-shot-package.md", "text/markdown"));
  els.downloadStoryboardBtn.addEventListener("click", () => downloadText(exportStoryboardHtml(), "master-canvas-storyboard.html", "text/html"));
  els.downloadStoryboardPdfBtn.addEventListener("click", exportStoryboardPdf);
  els.downloadJsonBtn.addEventListener("click", () => downloadText(JSON.stringify(exportProject(), null, 2), "master-canvas-project.json", "application/json"));
  els.downloadHandoffZipBtn.addEventListener("click", exportHandoffZip);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", renderMinimap);
  window.addEventListener("resize", keepHelpPanelInBounds);
}

function cycleAssetSizeMode() {
  const modes = ["small", "medium", "large"];
  const currentIndex = modes.indexOf(assetSizeMode);
  assetSizeMode = modes[(currentIndex + 1) % modes.length];
  localStorage.setItem(ASSET_SIZE_KEY, assetSizeMode);
  renderAssets();
}

function setActiveTool(tool, announce = true) {
  activeTool = tool === "hand" ? "hand" : "select";
  localStorage.setItem(ACTIVE_TOOL_KEY, activeTool);
  document.querySelectorAll(".tool-button[data-tool]").forEach((button) => {
    const isActive = button.dataset.tool === activeTool;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  els.viewport.dataset.tool = activeTool;
  els.viewport.classList.toggle("is-hand-tool", activeTool === "hand");
  els.viewport.classList.toggle("is-select-tool", activeTool === "select");
  if (announce) toast(activeTool === "hand" ? "Hand mode: drag to pan" : "Cursor mode: select and lasso");
}

function assetSizeLabel() {
  return { small: "S", medium: "M", large: "L" }[assetSizeMode] || "M";
}

function toggleShotListPanel() {
  els.shotListPanel.classList.toggle("is-hidden");
  els.shotListBtn.classList.toggle("primary", !els.shotListPanel.classList.contains("is-hidden"));
  renderShotList();
}

function closeShotListPanel() {
  els.shotListPanel.classList.add("is-hidden");
  els.shotListBtn.classList.remove("primary");
}

function toggleSearchPanel() {
  els.searchPanel.classList.toggle("is-hidden");
  els.searchCanvasBtn.classList.toggle("primary", !els.searchPanel.classList.contains("is-hidden"));
  if (!els.searchPanel.classList.contains("is-hidden")) els.canvasSearchInput.focus();
}

function closeSearchPanel() {
  els.searchPanel.classList.add("is-hidden");
  els.searchCanvasBtn.classList.remove("primary");
}

function clearCanvasSearch() {
  canvasSearch = "";
  els.canvasSearchInput.value = "";
  renderNodes();
}

function nodeSearchText(node) {
  const asset = assetById(node.assetId) || assetById(node.referenceAssetId);
  return [
    node.title,
    nodeTypeLabel(node.type),
    node.status,
    node.tags,
    node.notes,
    node.prompt,
    node.negativePrompt,
    node.overallPrompt,
    node.stylePrompt,
    node.musicPrompt,
    node.referenceUrl,
    node.neededFor,
    node.shotSize,
    node.cameraAngle,
    node.cameraMovement,
    node.subjectAction,
    node.location,
    node.mood,
    node.lighting,
    node.lensFeel,
    node.priority,
    node.influenceUse,
    node.doNotCopy,
    node.reviewOwner,
    node.reviewDecision,
    node.reviewNotes,
    ...(node.attempts || []).flatMap((attempt) => [attempt.label, attempt.status, attempt.notes, attempt.outputUrl]),
    asset?.name,
    asset?.tags,
    asset?.externalUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function nodeMatchesCanvasSearch(node) {
  return !canvasSearch || nodeSearchText(node).includes(canvasSearch);
}

function readinessForNode(node) {
  const checks = [];
  const add = (label, pass) => checks.push({ label, pass: Boolean(pass) });
  const readyStatus = ["ready", "approved"].includes(node.status);

  if (isWorkflowNode(node)) {
    add("start frame", node.startAssetId || node.sourceNodeId);
    add("generation prompt", node.prompt?.trim());
    add("ready status", readyStatus);
  } else if (node.type === "section" || node.type === "scene" || node.type === "shot") {
    add("scene description", node.overallPrompt?.trim() || node.notes?.trim());
    add("style direction", node.stylePrompt?.trim() || node.tags?.toLowerCase().includes("style"));
    add("music/sound direction", node.musicPrompt?.trim() || node.tags?.toLowerCase().includes("music"));
  } else if (node.type === "placeholder") {
    add("need described", node.notes?.trim() || node.prompt?.trim() || node.neededFor?.trim());
    add("resolved", readyStatus || node.assetId || node.referenceAssetId || node.referenceUrl);
  } else if (node.type === "styleRef") {
    add("reference attached", node.referenceUrl || node.referenceAssetId || node.notes?.trim());
    add("style direction", node.stylePrompt?.trim() || node.notes?.trim());
  } else if (node.type === "musicRef") {
    add("reference attached", node.referenceUrl || node.referenceAssetId || node.notes?.trim());
    add("music direction", node.musicPrompt?.trim() || node.notes?.trim());
  } else if (node.type === "media") {
    add("asset attached", node.assetId);
    add("prompt or notes", node.prompt?.trim() || node.notes?.trim());
  } else {
    add("notes", node.notes?.trim() || node.prompt?.trim());
  }

  const done = checks.filter((check) => check.pass).length;
  return { done, total: checks.length, items: checks };
}

function renderShotList() {
  if (!els.shotListContent || els.shotListPanel.classList.contains("is-hidden")) return;
  const items = state.nodes
    .filter((node) => ["section", "scene", "shot", "workflow", "imageWorkflow", "placeholder"].includes(node.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  els.shotListContent.innerHTML = items.length
    ? items
        .map((node) => {
          const ready = readinessForNode(node);
          return `
            <button class="shot-list-item" type="button" data-node-id="${node.id}">
              <strong>${esc(node.title)}</strong>
              <span>${esc(nodeTypeLabel(node.type))} · ${ready.done}/${ready.total} ready</span>
            </button>
          `;
        })
        .join("")
    : `<p class="help-text">Add sections, scenes, shots, workflows, or placeholders to build a navigator.</p>`;
}

function onShotListClick(event) {
  const id = event.target.closest("[data-node-id]")?.dataset.nodeId;
  if (!id) return;
  jumpToNode(id);
}

function jumpToNode(id) {
  const node = nodeById(id);
  if (!node) return;
  const rect = els.viewport.getBoundingClientRect();
  state.view.x = rect.width / 2 - (node.x + node.w / 2) * state.view.scale;
  state.view.y = rect.height / 2 - (node.y + node.h / 2) * state.view.scale;
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = null;
  openInspectorPanel();
  queueSave();
  render();
}

function onKeyUp(event) {
  if (event.code !== "Space") return;
  isSpacePanning = false;
  els.viewport.classList.remove("space-pan");
}

function toggleHelpPanel() {
  if (els.helpPanel.classList.contains("is-hidden")) {
    openHelpPanel();
  } else {
    closeHelpPanel();
  }
}

function openHelpPanel() {
  els.helpPanel.classList.remove("is-hidden");
  els.helpBtn.classList.add("primary");
  keepHelpPanelInBounds();
}

function closeHelpPanel() {
  els.helpPanel.classList.add("is-hidden");
  els.helpBtn.classList.remove("primary");
}

function restoreHelpPanelPosition() {
  const fallback = defaultHelpPanelPosition();
  let position = fallback;
  try {
    position = { ...fallback, ...JSON.parse(localStorage.getItem(HELP_POSITION_KEY) || "{}") };
  } catch {
    position = fallback;
  }
  setHelpPanelPosition(position.x, position.y);
}

function defaultHelpPanelPosition() {
  const width = Math.min(460, Math.max(300, window.innerWidth - 96));
  return {
    x: Math.max(72, window.innerWidth - width - 400),
    y: 72,
  };
}

function setHelpPanelPosition(x, y) {
  const width = els.helpPanel.offsetWidth || Math.min(460, window.innerWidth - 96);
  const height = els.helpPanel.offsetHeight || Math.min(640, window.innerHeight - 88);
  const nextX = clamp(x, 8, Math.max(8, window.innerWidth - width - 8));
  const nextY = clamp(y, 8, Math.max(8, window.innerHeight - height - 8));
  els.helpPanel.style.left = `${nextX}px`;
  els.helpPanel.style.top = `${nextY}px`;
  els.helpPanel.style.right = "auto";
}

function keepHelpPanelInBounds() {
  if (els.helpPanel.classList.contains("is-hidden")) return;
  const rect = els.helpPanel.getBoundingClientRect();
  setHelpPanelPosition(rect.left || defaultHelpPanelPosition().x, rect.top || defaultHelpPanelPosition().y);
}

function onHelpPointerDown(event) {
  if (event.target.closest("button")) return;
  const rect = els.helpPanel.getBoundingClientRect();
  helpDragState = {
    startX: event.clientX,
    startY: event.clientY,
    panelX: rect.left,
    panelY: rect.top,
  };
  els.helpPanel.classList.add("is-dragging");
  els.helpDragHandle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
}

function onHelpPointerMove(event) {
  if (!helpDragState) return;
  setHelpPanelPosition(
    helpDragState.panelX + event.clientX - helpDragState.startX,
    helpDragState.panelY + event.clientY - helpDragState.startY,
  );
}

function onHelpPointerUp() {
  if (!helpDragState) return;
  helpDragState = null;
  els.helpPanel.classList.remove("is-dragging");
  const rect = els.helpPanel.getBoundingClientRect();
  localStorage.setItem(HELP_POSITION_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }));
}

function startPanelResize(event, panel) {
  if (panel === "inspector" && !inspectorOpen) return;
  resizeState = {
    panel,
    startX: event.clientX,
    assetWidth: panelLayout.assetWidth,
    inspectorWidth: panelLayout.inspectorWidth,
  };
  document.body.classList.add("is-resizing-panel");
  event.currentTarget.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPanelResizeMove(event) {
  if (!resizeState) return;
  const delta = event.clientX - resizeState.startX;
  if (resizeState.panel === "asset") {
    panelLayout.assetWidth = clamp(resizeState.assetWidth + delta, 240, Math.min(640, window.innerWidth - 760));
  } else {
    panelLayout.inspectorWidth = clamp(resizeState.inspectorWidth - delta, 300, Math.min(720, window.innerWidth - 760));
  }
  applyPanelLayout();
  renderMinimap();
}

function onPanelResizeEnd() {
  if (!resizeState) return;
  resizeState = null;
  document.body.classList.remove("is-resizing-panel");
  savePanelLayout();
}

function createNewCanvas() {
  saveProject(false);
  undoStack = [];
  updateUndoButton();
  state = createDefaultProject();
  state.title = nextUntitledTitle();
  state.assets = allAssets;
  state.nodes = [];
  setSelectedNodeIds([]);
  state.selectedAssetId = null;
  els.projectTitle.value = state.title;
  persistProjectState();
  render();
  toast("New canvas created");
}

function openContinuityDialog() {
  const continuity = { ...defaultContinuity(), ...(state.continuity || {}) };
  els.continuityCharacters.value = continuity.characters;
  els.continuityWardrobe.value = continuity.wardrobe;
  els.continuityLocations.value = continuity.locations;
  els.continuityProps.value = continuity.props;
  els.continuityStyleRules.value = continuity.styleRules;
  els.continuityNeverChange.value = continuity.neverChange;
  els.continuityDialog.showModal();
}

function saveContinuity() {
  recordUndo();
  state.continuity = {
    characters: els.continuityCharacters.value.trim(),
    wardrobe: els.continuityWardrobe.value.trim(),
    locations: els.continuityLocations.value.trim(),
    props: els.continuityProps.value.trim(),
    styleRules: els.continuityStyleRules.value.trim(),
    neverChange: els.continuityNeverChange.value.trim(),
  };
  queueSave();
  renderInspector();
  els.continuityDialog.close();
  toast("Continuity bible saved");
}

const TEMPLATE_DEFS = [
  {
    id: "music-video",
    title: "Music Video",
    description: "Performance, story scenes, music direction, style refs, and generation attempts.",
    nodes: [
      ["section", -1080, -520, { title: "Performance Look", overallPrompt: "Main performance world, lighting, wardrobe, and camera language.", status: "draft" }],
      ["placeholder", -990, -360, { title: "Hero Performance Image", neededFor: "image", prompt: "Missing hero image/reference for the main performance look." }],
      ["shot", -650, -360, { title: "Opening Hook Shot", shotSize: "close-up", cameraMovement: "push in", priority: "high" }],
      ["workflow", -270, -370, { title: "Opening Hook I2V", prompt: "Describe the first 3 seconds, camera motivation, and performance energy." }],
      ["section", -1080, 40, { title: "Narrative Inserts", overallPrompt: "Story inserts, symbolic images, and transition moments.", status: "draft" }],
      ["musicRef", -250, 110, { title: "Music Direction", musicPrompt: "Tempo, edit rhythm, instrumentation, and emotion notes." }],
      ["styleRef", 120, 110, { title: "Video Style References", stylePrompt: "Color, pacing, framing, and references to borrow from." }],
    ],
  },
  {
    id: "short-film",
    title: "Short Film",
    description: "Character continuity, scene sections, shot cards, props, and review handoff.",
    nodes: [
      ["character", -1120, -540, { title: "Lead Character Continuity", tags: "character, continuity", notes: "Face, wardrobe, posture, and emotional range." }],
      ["section", -1080, -260, { title: "Scene 1 Setup", overallPrompt: "Where we are, what changes, and what must stay consistent." }],
      ["shot", -960, -100, { title: "Establishing Shot", shotSize: "wide", cameraAngle: "eye-level", cameraMovement: "slow drift" }],
      ["workflow", -590, -110, { title: "Scene 1 I2V", prompt: "Maintain character identity and location continuity." }],
      ["section", -1080, 300, { title: "Scene 2 Turn", overallPrompt: "Main emotional turn and visual escalation." }],
      ["placeholder", -960, 460, { title: "Prop Reference Needed", neededFor: "style", prompt: "Prop or object reference that must be consistent." }],
      ["note", -590, 470, { title: "Review Notes", notes: "Capture client/editor decisions here." }],
    ],
  },
  {
    id: "product-video",
    title: "Product Video",
    description: "Hero product shots, object consistency, features, proof points, and final CTA.",
    nodes: [
      ["section", -1080, -420, { title: "Product Identity", overallPrompt: "Product form, material, scale, brand feel, and object consistency." }],
      ["placeholder", -960, -260, { title: "Product Clean Reference", neededFor: "image", prompt: "Upload or generate the cleanest product reference." }],
      ["shot", -610, -260, { title: "Hero Reveal", shotSize: "medium", cameraMovement: "orbit", lighting: "controlled studio glow", priority: "high" }],
      ["workflow", -240, -270, { title: "Hero Reveal I2V", prompt: "Elegant product reveal with consistent object geometry and premium lighting." }],
      ["section", -1080, 140, { title: "Features / Benefits", overallPrompt: "Feature cards, proof points, and supporting visuals." }],
      ["shot", -960, 300, { title: "Feature Detail", shotSize: "macro", cameraAngle: "low angle", lensFeel: "macro commercial lens" }],
      ["note", -610, 300, { title: "CTA / End Card", notes: "Final copy, logo, offer, and lockup." }],
    ],
  },
  {
    id: "social-ad",
    title: "Social Ad",
    description: "Hook, proof, offer, CTA, aspect variants, and platform notes.",
    nodes: [
      ["section", -1040, -360, { title: "Hook", overallPrompt: "First second visual and message." }],
      ["shot", -910, -190, { title: "Thumb-stopping Opener", shotSize: "close-up", priority: "high", duration: "4s" }],
      ["workflow", -540, -200, { title: "Hook I2V", aspectRatio: "9:16", duration: "4s", prompt: "Immediate motion and clear visual premise." }],
      ["section", -1040, 140, { title: "Proof / Offer / CTA", overallPrompt: "Proof visual, offer card, and final end frame." }],
      ["placeholder", -910, 310, { title: "Offer Copy Needed", neededFor: "text", prompt: "Final offer, disclaimer, and call-to-action copy." }],
      ["styleRef", -540, 310, { title: "Platform Style Reference", influenceUse: "pacing, framing, caption density" }],
    ],
  },
  {
    id: "character-continuity",
    title: "Character Continuity",
    description: "Character bible, wardrobe, expressions, locations, and consistency tests.",
    nodes: [
      ["character", -960, -410, { title: "Hero Character", tags: "character, continuity", notes: "Canonical face and identity rules." }],
      ["placeholder", -620, -410, { title: "Expression Sheet Needed", neededFor: "image", prompt: "Neutral, happy, intense, profile, three-quarter." }],
      ["section", -1020, -120, { title: "Continuity Tests", overallPrompt: "Test the character across lighting, scenes, and wardrobe." }],
      ["workflow", -900, 50, { title: "Lighting Test I2V", prompt: "Same character identity under different lighting." }],
      ["workflow", -540, 50, { title: "Wardrobe Test I2V", prompt: "Same character identity with wardrobe continuity." }],
      ["styleRef", -180, 50, { title: "Canonical Style", stylePrompt: "Style rules that apply to all character generations." }],
    ],
  },
];

function openTemplatesDialog() {
  els.templatesList.innerHTML = TEMPLATE_DEFS.map(
    (template) => `
      <button class="template-card" type="button" data-template-id="${template.id}">
        <strong>${esc(template.title)}</strong>
        <span>${esc(template.description)}</span>
      </button>
    `,
  ).join("");
  els.templatesDialog.showModal();
}

function onTemplateListClick(event) {
  const templateId = event.target.closest("[data-template-id]")?.dataset.templateId;
  if (!templateId) return;
  const template = TEMPLATE_DEFS.find((item) => item.id === templateId);
  if (!template) return;
  saveProject(false);
  undoStack = [];
  state = createDefaultProject();
  state.title = nextTemplateTitle(template.title);
  state.assets = allAssets;
  state.view = { x: 760, y: 420, scale: 0.72 };
  state.nodes = template.nodes.map(([type, x, y, overrides]) => makeNode(type, x, y, { ...referenceNodeDefaults(type), ...overrides }));
  const workflows = state.nodes.filter(isWorkflowNode);
  workflows.forEach((workflow) => {
    const nearest = state.nodes
      .filter((node) => node.id !== workflow.id && !isWorkflowNode(node))
      .sort((a, b) => Math.abs(a.x - workflow.x) + Math.abs(a.y - workflow.y) - (Math.abs(b.x - workflow.x) + Math.abs(b.y - workflow.y)))[0];
    if (nearest) workflow.sourceNodeId = nearest.id;
  });
  setSelectedNodeIds([state.nodes[0]?.id].filter(Boolean));
  state.selectedAssetId = null;
  els.projectTitle.value = state.title;
  persistProjectState();
  render();
  els.templatesDialog.close();
  toast(`${template.title} canvas created`);
}

function nextTemplateTitle(title) {
  const base = `${title} Canvas`;
  const existing = new Set(projects.map((project) => project.title));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function mergeTags(existing = "", added = "") {
  const parts = [...existing.split(","), ...added.split(",")]
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function openBatchDialog() {
  const ids = selectedNodeIds();
  if (!ids.length) {
    toast("Select cards first");
    return;
  }
  els.batchCountLabel.textContent = `${ids.length} selected card${ids.length === 1 ? "" : "s"}`;
  els.batchStatus.value = "";
  els.batchTags.value = "";
  els.batchDialog.showModal();
}

function applyBatchEdit() {
  const ids = selectedNodeIds();
  if (!ids.length) return;
  const status = els.batchStatus.value;
  const tags = els.batchTags.value.trim();
  if (!status && !tags) {
    toast("Choose a status or add tags");
    return;
  }
  recordUndo();
  ids.forEach((id) => {
    const node = nodeById(id);
    if (!node) return;
    if (status) node.status = status;
    if (tags) node.tags = mergeTags(node.tags, tags);
    node.updatedAt = now();
  });
  queueSave();
  render();
  els.batchDialog.close();
  toast(`Updated ${ids.length} card${ids.length === 1 ? "" : "s"}`);
}

function readVersions(projectId = state.id) {
  try {
    return JSON.parse(localStorage.getItem(versionStorageKey(projectId)) || "[]");
  } catch {
    return [];
  }
}

function writeVersions(versions, projectId = state.id) {
  localStorage.setItem(versionStorageKey(projectId), JSON.stringify(versions.slice(0, 30)));
}

function openVersionsDialog() {
  els.versionName.value = "";
  renderVersionsList();
  els.versionsDialog.showModal();
}

function saveCheckpoint() {
  saveProject(false);
  const versions = readVersions();
  const label = els.versionName.value.trim() || `Checkpoint ${versions.length + 1}`;
  versions.unshift({
    id: uid("version"),
    name: label,
    createdAt: now(),
    project: serializeProject(state),
  });
  writeVersions(versions);
  els.versionName.value = "";
  renderVersionsList();
  toast("Checkpoint saved");
}

function renderVersionsList() {
  const versions = readVersions();
  els.versionsList.innerHTML = versions.length
    ? versions
        .map(
          (version) => `
            <article class="version-row">
              <div>
                <strong>${esc(version.name)}</strong>
                <span>${new Date(version.createdAt).toLocaleString()}</span>
              </div>
              <div class="version-actions">
                <button class="button compact" type="button" data-version-action="restore" data-version-id="${version.id}">Restore</button>
                <button class="button compact" type="button" data-version-action="delete" data-version-id="${version.id}">Delete</button>
              </div>
            </article>
          `,
        )
        .join("")
    : `<p class="help-text">No checkpoints saved for this canvas yet.</p>`;
}

function onVersionListClick(event) {
  const button = event.target.closest("[data-version-action]");
  if (!button) return;
  const action = button.dataset.versionAction;
  const id = button.dataset.versionId;
  const versions = readVersions();
  const version = versions.find((item) => item.id === id);
  if (!version) return;
  if (action === "delete") {
    writeVersions(versions.filter((item) => item.id !== id));
    renderVersionsList();
    toast("Checkpoint deleted");
    return;
  }
  if (action === "restore") {
    recordUndo();
    const restored = { ...createDefaultProject(), ...version.project, id: version.project.id || state.id };
    restored.continuity = { ...defaultContinuity(), ...(version.project.continuity || {}) };
    restored.nodes = (restored.nodes || []).map(normalizeNode);
    state = restored;
    state.assets = allAssets;
    els.projectTitle.value = state.title;
    persistProjectState();
    render();
    els.versionsDialog.close();
    toast(`Restored ${version.name}`);
  }
}

function nextUntitledTitle() {
  const base = "Untitled Canvas";
  const existing = new Set(projects.map((project) => project.title));
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base} ${index}`)) index += 1;
  return `${base} ${index}`;
}

function addNodeFromToolbar(kind) {
  const center = viewportCenterWorld();
  const selected = selectedNode();
  const type = kind === "imageWorkflow" ? "imageWorkflow" : kind;
  const sidecarOffset = type === "styleRef" ? { x: 430, y: -210 } : type === "musicRef" ? { x: 430, y: 35 } : type === "section" ? { x: -380, y: -220 } : { x: -150, y: -90 };
  recordUndo();
  const node = makeNode(type, center.x + sidecarOffset.x, center.y + sidecarOffset.y, referenceNodeDefaults(type));
  if (kind === "workflow" && selected && !isWorkflowNode(selected)) {
    node.sourceNodeId = selected.id;
    if (selected.assetId) node.startAssetId = selected.assetId;
  }
  state.nodes.push(node);
  openInspectorPanel();
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = null;
  queueSave();
  render();
}

function referenceNodeDefaults(type) {
  if (type === "section") {
    const sectionCount = state.nodes.filter((node) => node.type === "section").length + 1;
    return {
      title: `Scene Section ${sectionCount}`,
      notes: "Use this frame to gather related shots, prompts, references, and placeholders.",
      tags: "section, scene",
      status: "draft",
      w: 760,
      h: 440,
    };
  }
  if (type === "placeholder") {
    return {
      title: "Missing Asset",
      notes: "Describe the image, reference, prompt, or audio you still need.",
      tags: "placeholder, missing",
      status: "blocked",
      neededFor: "image",
      w: 300,
    };
  }
  if (type === "inspiration") {
    return {
      title: "Inspiration",
      notes: "Store reusable style notes, prompt fragments, camera language, palette ideas, or handoff reminders.",
      tags: "inspiration, prompt-fragment",
      status: "ready",
      w: 310,
    };
  }
  if (type === "styleRef") {
    return {
      title: "Video Style References",
      notes: "Drop video files here or add links that define style, tone, pacing, camera language, color, or editing rhythm.",
      tags: "style, tone, video-reference",
      status: "ready",
      w: 310,
    };
  }
  if (type === "musicRef") {
    return {
      title: "Music References",
      notes: "Drop audio files here or add links for music direction, tempo, mood, instrumentation, and final track ideas.",
      tags: "music, audio-reference",
      status: "ready",
      w: 310,
    };
  }
  return {};
}

function selectedNode() {
  return state.nodes.find((node) => node.id === state.selectedNodeId) || null;
}

function selectedNodeIds() {
  if (Array.isArray(state.selectedNodeIds) && state.selectedNodeIds.length) {
    return state.selectedNodeIds.filter((id) => nodeById(id));
  }
  return state.selectedNodeId && nodeById(state.selectedNodeId) ? [state.selectedNodeId] : [];
}

function isNodeSelected(id) {
  return selectedNodeIds().includes(id);
}

function setSelectedNodeIds(ids) {
  const unique = [...new Set(ids)].filter((id) => nodeById(id));
  state.selectedNodeIds = unique;
  state.selectedNodeId = unique.at(-1) || null;
}

function toggleNodeSelection(id) {
  const ids = selectedNodeIds();
  if (ids.includes(id)) {
    setSelectedNodeIds(ids.filter((item) => item !== id));
  } else {
    setSelectedNodeIds([...ids, id]);
  }
}

function selectedAsset() {
  return state.assets.find((asset) => asset.id === state.selectedAssetId) || null;
}

function assetById(id) {
  return state.assets.find((asset) => asset.id === id) || null;
}

function nodeById(id) {
  return state.nodes.find((node) => node.id === id) || null;
}

function nodesInsideSection(section) {
  if (!section || section.type !== "section") return [];
  return state.nodes.filter(
    (node) =>
      node.id !== section.id &&
      node.x >= section.x &&
      node.y >= section.y &&
      node.x + node.w <= section.x + section.w &&
      node.y + Math.max(154, node.h) <= section.y + section.h,
  );
}

function viewportCenterWorld() {
  const rect = els.viewport.getBoundingClientRect();
  return screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function screenToWorld(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.view.x) / state.view.scale,
    y: (clientY - rect.top - state.view.y) / state.view.scale,
  };
}

function worldToScreen(x, y) {
  return {
    x: x * state.view.scale + state.view.x,
    y: y * state.view.scale + state.view.y,
  };
}

function onWheel(event) {
  event.preventDefault();
  const before = screenToWorld(event.clientX, event.clientY);
  const nextScale = clamp(state.view.scale * (event.deltaY < 0 ? 1.08 : 0.92), 0.22, 2.3);
  state.view.scale = nextScale;
  const rect = els.viewport.getBoundingClientRect();
  state.view.x = event.clientX - rect.left - before.x * nextScale;
  state.view.y = event.clientY - rect.top - before.y * nextScale;
  applyView();
  renderLinks();
  renderMinimap();
  queueSave();
}

function onViewportPointerDown(event) {
  if (event.target !== els.viewport && event.target !== els.world && event.target !== els.nodeLayer && event.target !== els.linkLayer) return;
  if (event.button !== 0) return;
  if (activeTool === "hand") {
    startPan(event);
    return;
  }
  if (event.shiftKey || event.altKey || isSpacePanning) {
    startPan(event);
    return;
  }
  startLasso(event);
}

function startPan(event) {
  panState = {
    startX: event.clientX,
    startY: event.clientY,
    viewX: state.view.x,
    viewY: state.view.y,
  };
  els.viewport.classList.add("is-panning");
  event.preventDefault();
}

function onNodePointerDown(event) {
  if (activeTool === "hand" && !event.target.closest("button,input,textarea,select,a,audio,video")) {
    startPan(event);
    event.stopPropagation();
    return;
  }
  const handle = event.target.closest("[data-connection-handle]");
  if (handle) {
    startNodeConnection(event, handle);
    return;
  }
  const nodeEl = event.target.closest(".canvas-node");
  if (!nodeEl || event.target.closest("button,input,textarea,select,a,audio,video")) return;
  const node = nodeById(nodeEl.dataset.nodeId);
  if (!node) return;
  openInspectorPanel();
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    toggleNodeSelection(node.id);
  } else if (!isNodeSelected(node.id)) {
    setSelectedNodeIds([node.id]);
  }
  state.selectedAssetId = null;
  const dragIds =
    node.type === "section" && selectedNodeIds().length <= 1
      ? [node.id, ...nodesInsideSection(node).map((item) => item.id)]
      : selectedNodeIds();
  dragState = {
    id: node.id,
    ids: dragIds,
    startX: event.clientX,
    startY: event.clientY,
    nodePositions: dragIds.map((id) => {
      const item = nodeById(id);
      return { id, x: item.x, y: item.y };
    }),
    undoRecorded: false,
    moved: false,
  };
  nodeEl.setPointerCapture?.(event.pointerId);
  render();
}

function onPointerMove(event) {
  if (connectState) {
    updateConnectionPreview(event.clientX, event.clientY);
    return;
  }
  if (lassoState) {
    updateLasso(event.clientX, event.clientY);
    return;
  }
  if (dragState) {
    const dx = (event.clientX - dragState.startX) / state.view.scale;
    const dy = (event.clientY - dragState.startY) / state.view.scale;
    if (Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY) > 3) dragState.moved = true;
    if (!dragState.undoRecorded) {
      recordUndo();
      dragState.undoRecorded = true;
    }
    dragState.nodePositions.forEach((position) => {
      const node = nodeById(position.id);
      if (!node) return;
      node.x = position.x + dx;
      node.y = position.y + dy;
      node.updatedAt = now();
    });
    renderNodes();
    renderLinks();
    renderMinimap();
    queueSave();
    return;
  }
  if (panState) {
    state.view.x = panState.viewX + event.clientX - panState.startX;
    state.view.y = panState.viewY + event.clientY - panState.startY;
    applyView();
    renderLinks();
    renderMinimap();
    queueSave();
  }
}

function onPointerUp(event) {
  if (connectState) {
    finishNodeConnection(event);
    return;
  }
  if (lassoState) {
    finishLasso(event);
    return;
  }
  if (dragState?.moved) suppressNextNodeClick = true;
  dragState = null;
  panState = null;
  els.viewport.classList.remove("is-panning");
}

function startLasso(event) {
  const rect = els.viewport.getBoundingClientRect();
  lassoState = {
    startClientX: event.clientX,
    startClientY: event.clientY,
    startX: event.clientX - rect.left,
    startY: event.clientY - rect.top,
  };
  els.viewport.classList.add("is-lassoing");
  updateLasso(event.clientX, event.clientY);
  event.preventDefault();
}

function updateLasso(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  const currentX = clientX - rect.left;
  const currentY = clientY - rect.top;
  const left = Math.min(lassoState.startX, currentX);
  const top = Math.min(lassoState.startY, currentY);
  const width = Math.abs(currentX - lassoState.startX);
  const height = Math.abs(currentY - lassoState.startY);
  els.lassoBox.hidden = false;
  els.lassoBox.style.left = `${left}px`;
  els.lassoBox.style.top = `${top}px`;
  els.lassoBox.style.width = `${width}px`;
  els.lassoBox.style.height = `${height}px`;
}

function finishLasso(event) {
  const moved = Math.abs(event.clientX - lassoState.startClientX) + Math.abs(event.clientY - lassoState.startClientY) > 8;
  if (moved) {
    const rect = els.lassoBox.getBoundingClientRect();
    const selectedIds = state.nodes
      .filter((node) => {
        const nodeEl = els.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeEl) return false;
        const nodeRect = nodeEl.getBoundingClientRect();
        return rect.left <= nodeRect.right && rect.right >= nodeRect.left && rect.top <= nodeRect.bottom && rect.bottom >= nodeRect.top;
      })
      .map((node) => node.id);
    setSelectedNodeIds(selectedIds);
    state.selectedAssetId = null;
    if (selectedIds.length) openInspectorPanel();
    render();
    if (selectedIds.length) toast(`${selectedIds.length} card${selectedIds.length === 1 ? "" : "s"} selected`);
  } else {
    setSelectedNodeIds([]);
    state.selectedAssetId = null;
    render();
  }
  lassoState = null;
  els.lassoBox.hidden = true;
  els.viewport.classList.remove("is-lassoing");
}

function startNodeConnection(event, handle) {
  const nodeEl = handle.closest(".canvas-node");
  const node = nodeEl ? nodeById(nodeEl.dataset.nodeId) : null;
  if (!node) return;
  connectState = {
    sourceNodeId: node.id,
    sourceSide: handle.dataset.side || "right",
    previewId: "connection-preview",
  };
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = null;
  updateConnectionPreview(event.clientX, event.clientY);
  renderInspector();
  event.preventDefault();
  event.stopPropagation();
}

function updateConnectionPreview(clientX, clientY) {
  const source = nodeById(connectState.sourceNodeId);
  if (!source) return;
  const end = screenToWorld(clientX, clientY);
  const start = connectionPoint(source, connectState.sourceSide);
  const targetSide = targetSideFromPoint(clientX, clientY) || (end.x < start.x ? "right" : "left");
  const pathData = connectionPath(start, end, connectState.sourceSide, targetSide);
  const existing = els.linkLayer.querySelector(`#${connectState.previewId}`);
  const path = existing || document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.id = connectState.previewId;
  path.classList.add("connection-preview");
  path.setAttribute("d", pathData);
  if (!existing) els.linkLayer.append(path);
}

function finishNodeConnection(event) {
  const sourceId = connectState.sourceNodeId;
  const sourceSide = connectState.sourceSide;
  const targetEl = document.elementFromPoint(event.clientX, event.clientY)?.closest(".canvas-node");
  const target = targetEl ? nodeById(targetEl.dataset.nodeId) : null;
  const targetSide = targetSideFromPoint(event.clientX, event.clientY) || "left";
  els.linkLayer.querySelector(`#${connectState.previewId}`)?.remove();
  connectState = null;
  dragState = null;
  panState = null;
  els.viewport.classList.remove("is-panning");
  if (!target || target.id === sourceId) {
    renderLinks();
    return;
  }
  recordUndo();
  target.sourceNodeId = sourceId;
  target.linkSourceSide = sourceSide;
  target.linkTargetSide = targetSide;
  target.updatedAt = now();
  setSelectedNodeIds([target.id]);
  state.selectedAssetId = null;
  queueSave();
  render();
  toast("Cards connected");
}

function targetSideFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const handle = element?.closest("[data-connection-handle]");
  if (handle?.dataset.side) return handle.dataset.side;
  const nodeEl = element?.closest(".canvas-node");
  if (!nodeEl) return "";
  const rect = nodeEl.getBoundingClientRect();
  return clientX < rect.left + rect.width / 2 ? "left" : "right";
}

function onMinimapPointerDown(event) {
  event.preventDefault();
  event.stopPropagation();
  jumpToMinimapPoint(event.clientX, event.clientY);
}

function onMinimapKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  fitView();
}

function jumpToMinimapPoint(clientX, clientY) {
  const geometry = getMinimapGeometry();
  if (!geometry) return;
  const rect = els.minimapSvg.getBoundingClientRect();
  const localX = ((clientX - rect.left) / rect.width) * 180;
  const localY = ((clientY - rect.top) / rect.height) * 180;
  const worldX = (localX - geometry.offsetX) / geometry.scale + geometry.bounds.minX;
  const worldY = (localY - geometry.offsetY) / geometry.scale + geometry.bounds.minY;
  const viewport = els.viewport.getBoundingClientRect();
  state.view.x = viewport.width / 2 - worldX * state.view.scale;
  state.view.y = viewport.height / 2 - worldY * state.view.scale;
  applyView();
  renderLinks();
  renderMinimap();
  queueSave();
}

function onNodeClick(event) {
  if (activeTool === "hand") return;
  if (suppressNextNodeClick) {
    suppressNextNodeClick = false;
    return;
  }
  const nodeEl = event.target.closest(".canvas-node");
  if (!nodeEl) return;
  openInspectorPanel();
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    toggleNodeSelection(nodeEl.dataset.nodeId);
  } else {
    setSelectedNodeIds([nodeEl.dataset.nodeId]);
  }
  state.selectedAssetId = null;
  render();
}

function onKeyDown(event) {
  if (event.target.matches("input,textarea,select")) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastChange();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    isSpacePanning = true;
    els.viewport.classList.add("space-pan");
    return;
  }
  const ids = selectedNodeIds();
  if ((event.key === "Backspace" || event.key === "Delete") && ids.length) {
    deleteNodes(ids);
  }
}

async function onCanvasDrop(event) {
  event.preventDefault();
  const world = screenToWorld(event.clientX, event.clientY);
  const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/"));
  if (files.length) {
    await importFiles(files, world);
    return;
  }
  const assetId = event.dataTransfer.getData("text/asset-id");
  if (assetId) addMediaNode(assetId, world.x, world.y);
}

async function importFiles(files, origin) {
  if (!files.length) return;
  recordUndo();
  const imported = [];
  for (const file of files) {
    const asset = await createAssetFromFile(file);
    await putAsset(asset);
    state.assets.unshift(asset);
    imported.push(asset);
  }
  imported.forEach((asset, index) => {
    addMediaNode(asset.id, origin.x + index * 300, origin.y + (index % 2) * 28, false);
  });
  setSelectedNodeIds([state.nodes[state.nodes.length - 1]?.id].filter(Boolean));
  state.selectedAssetId = imported[0]?.id || null;
  queueSave();
  render();
  toast(`${imported.length} asset${imported.length === 1 ? "" : "s"} imported`);
}

function createAssetFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: uid("asset"),
        name: file.name,
        type: file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image",
        mime: file.type,
        size: file.size,
        dataUrl: reader.result,
        createdAt: now(),
        updatedAt: now(),
        favorite: false,
        archived: false,
        inbox: true,
        tags: "",
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function addMediaNode(assetId, x, y, rerender = true) {
  const asset = assetById(assetId);
  if (rerender) recordUndo();
  const node = makeNode("media", x, y, {
    title: asset?.name || "Media",
    assetId,
    w: 300,
    notes: asset?.tags || "",
    tags: asset?.tags || "",
  });
  state.nodes.push(node);
  openInspectorPanel();
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = assetId;
  if (rerender) {
    queueSave();
    render();
  }
  return node;
}

function onAssetDragStart(event) {
  const card = event.target.closest(".asset-card");
  if (!card) return;
  event.dataTransfer.setData("text/asset-id", card.dataset.assetId);
  event.dataTransfer.effectAllowed = "copy";
}

async function onAssetGridClick(event) {
  const button = event.target.closest("button");
  const card = event.target.closest(".asset-card");
  if (!card) return;
  const asset = assetById(card.dataset.assetId);
  if (!asset) return;
  openInspectorPanel();
  setSelectedNodeIds([]);
  state.selectedAssetId = asset.id;
  if (button?.dataset.assetAction === "favorite") {
    asset.favorite = !asset.favorite;
    asset.updatedAt = now();
    await putAsset(asset);
    queueSave();
    render();
    return;
  }
  if (button?.dataset.assetAction === "archive") {
    asset.archived = !asset.archived;
    asset.updatedAt = now();
    await putAsset(asset);
    queueSave();
    render();
    return;
  }
  if (button?.dataset.assetAction === "inbox") {
    asset.inbox = !asset.inbox;
    asset.updatedAt = now();
    await putAsset(asset);
    queueSave();
    render();
    return;
  }
  if (button?.dataset.assetAction === "add") {
    addMediaNode(asset.id, viewportCenterWorld().x - 140, viewportCenterWorld().y - 80);
    return;
  }
  renderInspector();
}

function onInspectorInput(event) {
  const target = event.target;
  const field = target.dataset.field;
  if (!field) return;
  const node = selectedNode();
  if (!node) return;
  node[field] = target.value;
  node.updatedAt = now();
  if (field === "title" || field === "prompt" || field === "overallPrompt" || field === "stylePrompt" || field === "musicPrompt" || field === "referenceUrl" || field === "neededFor" || field === "tags" || field === "notes" || field === "shotSize" || field === "cameraAngle" || field === "cameraMovement" || field === "priority" || field === "reviewDecision") {
    renderNodes();
    renderShotList();
  }
  if (field === "startAssetId" || field === "endAssetId" || field === "sourceNodeId" || field === "linkSourceSide" || field === "linkTargetSide" || field === "status" || field === "referenceAssetId") {
    renderNodes();
    renderLinks();
    renderMinimap();
  }
  queueSave();
}

function onInspectorClick(event) {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const node = selectedNode();
  if (action === "close-inspector") {
    closeInspectorPanel();
    return;
  }
  if (action === "delete-node" && node) deleteNodes(isNodeSelected(node.id) ? selectedNodeIds() : [node.id]);
  if (action === "duplicate-node" && node) duplicateNode(node.id);
  if (action === "upload-reference-file" && node) {
    pendingNodeFileId = node.id;
    els.nodeFileInput.accept = node.type === "musicRef" ? "audio/*,video/*" : "video/*,image/*";
    els.nodeFileInput.click();
  }
  if (action === "add-attempt" && node && isWorkflowNode(node)) {
    addAttemptFromInspector(node);
  }
  if (action === "mark-attempt-winner" && node && isWorkflowNode(node)) {
    markAttemptWinner(node, event.target.closest("[data-attempt-id]")?.dataset.attemptId);
  }
  if (action === "delete-attempt" && node && isWorkflowNode(node)) {
    deleteAttempt(node, event.target.closest("[data-attempt-id]")?.dataset.attemptId);
  }
  if (action === "add-selected-asset") {
    const asset = selectedAsset();
    if (asset) addMediaNode(asset.id, viewportCenterWorld().x - 140, viewportCenterWorld().y - 80);
  }
  if (action === "workflow-from-asset") {
    const asset = selectedAsset();
    if (!asset) return;
    recordUndo();
    const center = viewportCenterWorld();
    const mediaNode = addMediaNode(asset.id, center.x - 330, center.y - 70, false);
    const workflow = makeNode("workflow", center.x + 20, center.y - 80, {
      startAssetId: asset.id,
      sourceNodeId: mediaNode.id,
      title: "Image to Video",
      prompt: "Describe the motion, camera, continuity, and final frame.",
    });
    state.nodes.push(workflow);
    setSelectedNodeIds([workflow.id]);
    queueSave();
    render();
  }
}

function inspectorAttemptValue(field) {
  return els.inspector.querySelector(`[data-attempt-field="${field}"]`)?.value.trim() || "";
}

function addAttemptFromInspector(node) {
  const outputUrl = inspectorAttemptValue("outputUrl");
  const notes = inspectorAttemptValue("notes");
  const label = inspectorAttemptValue("label") || `Attempt ${(node.attempts || []).length + 1}`;
  if (!outputUrl && !notes) {
    toast("Add an output URL or notes");
    return;
  }
  recordUndo();
  node.attempts = Array.isArray(node.attempts) ? node.attempts : [];
  node.attempts.unshift({
    id: uid("attempt"),
    label,
    status: inspectorAttemptValue("status") || "candidate",
    outputUrl,
    seed: inspectorAttemptValue("seed"),
    notes,
    createdAt: now(),
  });
  node.updatedAt = now();
  queueSave();
  renderInspector();
  renderNodes();
  toast("Attempt logged");
}

function markAttemptWinner(node, attemptId) {
  if (!attemptId) return;
  recordUndo();
  node.attempts = (node.attempts || []).map((attempt) => ({
    ...attempt,
    status: attempt.id === attemptId ? "winner" : attempt.status === "winner" ? "candidate" : attempt.status,
  }));
  node.updatedAt = now();
  queueSave();
  renderInspector();
  toast("Winner marked");
}

function deleteAttempt(node, attemptId) {
  if (!attemptId) return;
  recordUndo();
  node.attempts = (node.attempts || []).filter((attempt) => attempt.id !== attemptId);
  node.updatedAt = now();
  queueSave();
  renderInspector();
  toast("Attempt deleted");
}

async function attachFileToSelectedReference(file) {
  const node = nodeById(pendingNodeFileId);
  pendingNodeFileId = "";
  if (!file || !node) return;
  const valid =
    node.type === "musicRef"
      ? file.type.startsWith("audio/") || file.type.startsWith("video/")
      : file.type.startsWith("video/") || file.type.startsWith("image/");
  if (!valid) {
    toast(node.type === "musicRef" ? "Use audio or video for music refs" : "Use video or image for style refs");
    return;
  }
  const asset = await createAssetFromFile(file);
  asset.tags = node.type === "musicRef" ? "music, audio-reference" : "style, tone, video-reference";
  asset.inbox = false;
  await putAsset(asset);
  recordUndo();
  state.assets.unshift(asset);
  allAssets = state.assets;
  node.referenceAssetId = asset.id;
  node.updatedAt = now();
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = asset.id;
  queueSave();
  render();
  toast("File attached to card");
}

function openReferenceDialog() {
  els.referenceType.value = "video-link";
  els.referenceTitle.value = "";
  els.referenceUrl.value = "";
  els.referenceNotes.value = "";
  els.referenceDialog.showModal();
}

async function saveReferenceLink() {
  const externalUrl = els.referenceUrl.value.trim();
  if (!externalUrl) {
    toast("Add a URL first");
    return;
  }
  const type = els.referenceType.value;
  const title = els.referenceTitle.value.trim() || inferReferenceTitle(externalUrl, type);
  const tags = type === "video-link" ? "style, tone, video-reference" : type === "music-link" ? "music, audio-reference" : "reference";
  const asset = {
    id: uid("asset"),
    name: title,
    type,
    mime: "text/uri-list",
    size: 0,
    dataUrl: "",
    externalUrl,
    createdAt: now(),
    updatedAt: now(),
    favorite: false,
    archived: false,
    inbox: false,
    tags,
    notes: els.referenceNotes.value.trim(),
  };
  await putAsset(asset);
  recordUndo();
  allAssets.unshift(asset);
  state.assets = allAssets;
  const center = viewportCenterWorld();
  const isSideReference = type === "video-link" || type === "music-link";
  const node = addMediaNode(asset.id, center.x + (isSideReference ? 430 : -150), center.y + (type === "music-link" ? 35 : isSideReference ? -210 : -90), false);
  node.notes = asset.notes || asset.tags;
  node.prompt = asset.notes;
  setSelectedNodeIds([node.id]);
  state.selectedAssetId = asset.id;
  persistProjectState();
  render();
  els.referenceDialog.close();
  toast("Reference link added");
}

function inferReferenceTitle(url, type) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (type === "video-link") return `Video reference - ${host}`;
    if (type === "music-link") return `Music reference - ${host}`;
    return `Reference - ${host}`;
  } catch {
    return type === "music-link" ? "Music reference" : "Video reference";
  }
}

function deleteNode(id) {
  deleteNodes([id]);
}

function deleteNodes(ids) {
  const deleteIds = [...new Set(ids)].filter((id) => nodeById(id));
  if (!deleteIds.length) return;
  recordUndo();
  state.nodes = state.nodes.filter((node) => !deleteIds.includes(node.id));
  state.nodes.forEach((node) => {
    if (deleteIds.includes(node.sourceNodeId)) node.sourceNodeId = "";
  });
  setSelectedNodeIds([]);
  queueSave();
  render();
}

function duplicateNode(id) {
  const node = nodeById(id);
  if (!node) return;
  recordUndo();
  const copy = {
    ...node,
    id: uid("node"),
    x: node.x + 34,
    y: node.y + 34,
    title: `${node.title} copy`,
    createdAt: now(),
    updatedAt: now(),
  };
  state.nodes.push(copy);
  setSelectedNodeIds([copy.id]);
  queueSave();
  render();
}

function fitView() {
  if (!state.nodes.length) {
    state.view = { x: 520, y: 230, scale: 0.9 };
    render();
    return;
  }
  const rect = els.viewport.getBoundingClientRect();
  const bounds = state.nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxX: Math.max(acc.maxX, node.x + node.w),
      maxY: Math.max(acc.maxY, node.y + node.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  const width = bounds.maxX - bounds.minX || 1;
  const height = bounds.maxY - bounds.minY || 1;
  const scale = clamp(Math.min((rect.width - 120) / width, (rect.height - 120) / height), 0.25, 1.15);
  state.view.scale = scale;
  state.view.x = (rect.width - width * scale) / 2 - bounds.minX * scale;
  state.view.y = (rect.height - height * scale) / 2 - bounds.minY * scale;
  queueSave();
  render();
}

function render() {
  renderProjectSelect();
  updateUndoButton();
  applyPanelLayout();
  applyView();
  renderAssets();
  renderNodes();
  renderLinks();
  renderMinimap();
  renderShotList();
  renderInspector();
}

function renderProjectSelect() {
  if (!els.canvasSelect) return;
  els.canvasSelect.innerHTML = projects
    .map((project) => `<option value="${project.id}" ${project.id === state.id ? "selected" : ""}>${esc(project.title)}</option>`)
    .join("");
}

function applyView() {
  els.world.style.transform = `translate(${state.view.x}px, ${state.view.y}px) scale(${state.view.scale})`;
}

function renderAssets() {
  els.assetGrid.dataset.size = assetSizeMode;
  els.assetSizeBtn.textContent = `Size: ${assetSizeLabel()}`;
  els.assetSizeBtn.setAttribute("aria-label", `Asset card size ${assetSizeMode}`);
  renderAssetTypeFilters();
  const filtered = state.assets.filter((asset) => {
    if (!assetFilters.showArchived && asset.archived) return false;
    if (assetFilters.favoritesOnly && !asset.favorite) return false;
    if (assetFilters.inboxOnly && !asset.inbox) return false;
    if (!assetMatchesTypeFilter(asset, assetFilters.type)) return false;
    const haystack = `${asset.name} ${asset.tags} ${asset.notes || ""}`.toLowerCase();
    return !assetFilters.search || haystack.includes(assetFilters.search);
  });
  els.assetCount.textContent = `${filtered.length} item${filtered.length === 1 ? "" : "s"}`;
  els.assetGrid.innerHTML = filtered
    .map((asset) => {
      const media = renderAssetMedia(asset, "asset-thumb");
      return `
        <article class="asset-card" draggable="true" data-asset-id="${asset.id}">
          ${media}
          <div class="asset-meta">
            <span class="asset-name" title="${esc(asset.name)}">${esc(asset.name)}</span>
            <button class="mini-button ${asset.favorite ? "is-on" : ""}" type="button" data-asset-action="favorite" title="Mark as favorite" data-tip="Mark as favorite">F</button>
            <button class="mini-button" type="button" data-asset-action="add" title="Add to canvas" data-tip="Add to canvas">+</button>
            <button class="mini-button ${asset.inbox ? "is-on" : ""}" type="button" data-asset-action="inbox" title="${asset.inbox ? "Mark sorted" : "Send to inbox"}" data-tip="${asset.inbox ? "Mark sorted" : "Send to inbox"}">IN</button>
            <button class="mini-button ${asset.archived ? "is-on" : ""}" type="button" data-asset-action="archive" title="Archive asset" data-tip="Archive asset">A</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAssetTypeFilters() {
  els.assetTypeFilters.querySelectorAll("[data-asset-filter]").forEach((button) => {
    const isActive = (button.dataset.assetFilter || "all") === assetFilters.type;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function assetMatchesTypeFilter(asset, filterType = "all") {
  if (filterType === "all") return true;
  const haystack = `${asset.name || ""} ${asset.tags || ""} ${asset.notes || ""} ${asset.type || ""}`.toLowerCase();
  if (filterType === "storyboard") {
    return asset.type === "image" && !haystack.includes("style-reference") && !haystack.includes("music") && !haystack.includes("audio");
  }
  if (filterType === "video") {
    return asset.type === "video" || haystack.includes("video generation") || haystack.includes("generated video") || haystack.includes("render");
  }
  if (filterType === "music") {
    return asset.type === "audio" || asset.type === "music-link" || haystack.includes("music") || haystack.includes("audio");
  }
  if (filterType === "style") {
    return (
      asset.type === "video-link" ||
      asset.type === "reference-link" ||
      haystack.includes("style") ||
      haystack.includes("tone") ||
      haystack.includes("visual reference") ||
      haystack.includes("video-reference")
    ) && asset.type !== "music-link" && !haystack.includes("music");
  }
  return true;
}

function renderNodes() {
  els.nodeLayer.innerHTML = state.nodes.map(renderNode).join("");
}

function renderNode(node) {
  const classes = [
    "canvas-node",
    isNodeSelected(node.id) ? "is-selected" : "",
    node.type === "section" ? "is-section-node" : "",
    node.type === "placeholder" ? "is-placeholder-node" : "",
    node.type === "inspiration" ? "is-inspiration-node" : "",
    canvasSearch && nodeMatchesCanvasSearch(node) ? "is-search-match" : "",
    canvasSearch && !nodeMatchesCanvasSearch(node) ? "is-search-dimmed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `
    <article class="${classes}" data-node-id="${node.id}" style="--node-width:${node.w}px; --node-height:${node.h}px; transform: translate(${node.x}px, ${node.y}px);">
      <button class="connect-handle connect-left" type="button" data-connection-handle="source" data-side="left" title="Drag from this left dot to connect cards" data-tip="Drag from this left dot to connect cards" aria-label="Connect from left side"></button>
      <button class="connect-handle connect-right" type="button" data-connection-handle="source" data-side="right" title="Drag from this right dot to connect cards" data-tip="Drag from this right dot to connect cards" aria-label="Connect from right side"></button>
      <header class="node-head">
        <span class="node-title">${esc(node.title)}</span>
        ${node.shotOrderLabel ? `<span class="node-order-badge">${esc(node.shotOrderLabel)}</span>` : ""}
        <span class="node-kind">${esc(shortKind(node.type))}</span>
      </header>
      <section class="node-body">${renderNodeBody(node)}</section>
    </article>
  `;
}

function shortKind(type) {
  return {
    workflow: "I2V",
    imageWorkflow: "TXT2IMG",
    shot: "SHOT",
    character: "CHAR",
    scene: "SCENE",
    section: "GROUP",
    placeholder: "NEED",
    inspiration: "IDEA",
    styleRef: "STYLE",
    musicRef: "MUSIC",
    note: "NOTE",
    media: "MEDIA",
  }[type] || "NODE";
}

function renderNodeBody(node) {
  if (node.type === "section") {
    const ready = readinessForNode(node);
    const children = nodesInsideSection(node);
    return `
      <div class="section-summary">
        <p class="node-note">${esc(node.overallPrompt || node.notes || "Frame related shots, prompts, references, and missing pieces here.")}</p>
        <div class="status-row">
          <span class="status-pill ${esc(node.status)}">${esc(node.status || "draft")}</span>
          <span class="tag">${children.length} card${children.length === 1 ? "" : "s"}</span>
          <span class="tag">${ready.done}/${ready.total} ready</span>
        </div>
      </div>
    `;
  }
  if (node.type === "placeholder") {
    const ready = readinessForNode(node);
    return `
      <div class="placeholder-card">
        <strong>${esc(node.neededFor || "Needed")}</strong>
        <p class="node-note">${esc(node.prompt || node.notes || "Describe the missing asset, prompt, reference, or audio here.")}</p>
        <div class="status-row">
          <span class="status-pill ${esc(node.status)}">${esc(node.status || "blocked")}</span>
          <span class="tag">${ready.done}/${ready.total} resolved</span>
        </div>
      </div>
    `;
  }
  if (node.type === "inspiration") {
    return `
      <div class="inspiration-card">
        <p class="node-note">${esc(node.prompt || node.stylePrompt || node.overallPrompt || node.notes || "Drop a reusable prompt fragment, camera idea, edit note, or tone reference.")}</p>
        <div class="status-row">
          <span class="status-pill ${esc(node.status)}">${esc(node.status || "ready")}</span>
          ${node.tags ? node.tags.split(",").slice(0, 3).map((tag) => `<span class="tag">${esc(tag.trim())}</span>`).join("") : ""}
        </div>
      </div>
    `;
  }
  if (node.type === "media") {
    const asset = assetById(node.assetId);
    if (!asset) return `<p class="node-note">Missing media</p>`;
    const meta = [node.globalShotOrder ? `#${node.globalShotOrder}` : "", node.shotSize, node.cameraMovement, node.lensFeel].filter(Boolean).join(" / ");
    return `
      ${renderAssetMedia(asset, "node-media")}
      <div class="shot-card-summary">
        <strong>${esc(node.shotBeatTitle || node.shotOrderLabel || "Shot")}</strong>
        ${meta ? `<span>${esc(meta)}</span>` : ""}
      </div>
      <p class="node-note compact-note">${esc(node.subjectAction || node.notes || asset.tags || asset.name)}</p>
    `;
  }
  if (node.type === "styleRef" || node.type === "musicRef") {
    const asset = assetById(node.referenceAssetId);
    return `
      ${asset ? renderAssetMedia(asset, "node-media") : ""}
      ${node.referenceUrl ? renderReferenceUrl(node.referenceUrl, node.type) : ""}
      <div class="status-row">
        <span class="status-pill ${esc(node.status)}">${esc(node.status || "draft")}</span>
        ${node.tags ? node.tags.split(",").slice(0, 3).map((tag) => `<span class="tag">${esc(tag.trim())}</span>`).join("") : ""}
        ${node.influenceUse ? `<span class="tag">${esc(node.influenceUse)}</span>` : ""}
      </div>
      <p class="node-note">${esc(node.stylePrompt || node.musicPrompt || node.notes || "Add a link or upload a reference file from the inspector.")}</p>
    `;
  }
  if (isWorkflowNode(node)) {
    const start = assetById(node.startAssetId);
    const end = assetById(node.endAssetId);
    return `
      <div class="workflow-summary">
        <div class="workflow-strip">
          ${start ? renderAssetMedia(start, "workflow-frame") : `<div class="placeholder-frame">Start</div>`}
          <span class="workflow-arrow">-&gt;</span>
          ${end ? renderAssetMedia(end, "workflow-frame") : `<div class="placeholder-frame">End</div>`}
        </div>
        <div class="status-row">
          <span class="status-pill ${esc(node.status)}">${esc(node.status || "draft")}</span>
          <span class="tag">${esc(node.model || "Model")}</span>
          <span class="tag">${esc(node.duration || node.resolution || "")}</span>
          ${node.priority && node.priority !== "normal" ? `<span class="tag">${esc(node.priority)}</span>` : ""}
          ${(node.attempts || []).some((attempt) => attempt.status === "winner") ? `<span class="tag">winner logged</span>` : ""}
        </div>
        <p class="node-note">${esc(node.prompt || node.subjectAction || node.notes || "Prompt pending")}</p>
      </div>
    `;
  }
  return `
    <div class="status-row">
      <span class="status-pill ${esc(node.status)}">${esc(node.status || "draft")}</span>
      ${node.tags ? node.tags.split(",").slice(0, 3).map((tag) => `<span class="tag">${esc(tag.trim())}</span>`).join("") : ""}
      ${node.shotSize ? `<span class="tag">${esc(node.shotSize)}</span>` : ""}
      ${node.reviewDecision ? `<span class="tag">${esc(node.reviewDecision)}</span>` : ""}
    </div>
    <p class="node-note">${esc(node.overallPrompt || node.stylePrompt || node.musicPrompt || node.prompt || node.notes || "No notes yet.")}</p>
  `;
}

function renderReferenceUrl(url, type) {
  const label = type === "musicRef" ? "Music URL" : "Video URL";
  return `<a class="node-media asset-placeholder link-placeholder reference-url-card" href="${esc(url)}" target="_blank" rel="noreferrer"><strong>${label}</strong><span>${esc(url)}</span></a>`;
}

function renderAssetMedia(asset, className) {
  if (asset.type === "video") return `<video class="${className}" src="${asset.dataUrl}" muted playsinline controls></video>`;
  if (asset.type === "audio") {
    return `<div class="${className} asset-placeholder audio-placeholder"><strong>Audio</strong><span>${esc(asset.name)}</span><audio src="${asset.dataUrl}" controls></audio></div>`;
  }
  if (asset.type === "video-link" || asset.type === "music-link" || asset.type === "reference-link") {
    const label = asset.type === "video-link" ? "Video Ref" : asset.type === "music-link" ? "Music Ref" : "Reference";
    return `<a class="${className} asset-placeholder link-placeholder" href="${esc(asset.externalUrl)}" target="_blank" rel="noreferrer"><strong>${label}</strong><span>${esc(asset.name)}</span><small>${esc(asset.externalUrl)}</small></a>`;
  }
  return `<img class="${className}" src="${asset.dataUrl}" alt="${esc(asset.name)}" />`;
}

function renderLinks() {
  const paths = [];
  for (const node of state.nodes) {
    if (!node.sourceNodeId) continue;
    const source = nodeById(node.sourceNodeId);
    if (!source) continue;
    const sourceSide = node.linkSourceSide || "right";
    const targetSide = node.linkTargetSide || "left";
    const a = connectionPoint(source, sourceSide);
    const b = connectionPoint(node, targetSide);
    paths.push(`<path d="${connectionPath(a, b, sourceSide, targetSide)}" />`);
  }
  els.linkLayer.innerHTML = paths.join("");
}

function connectionPoint(node, side = "right") {
  return {
    x: side === "left" ? node.x : node.x + node.w,
    y: node.y + Math.max(70, node.h / 2),
  };
}

function connectionPath(start, end, sourceSide = "right", targetSide = "left") {
  const distance = Math.abs(end.x - start.x);
  const tension = Math.max(80, distance / 2);
  const sourceDirection = sourceSide === "left" ? -1 : 1;
  const targetDirection = targetSide === "left" ? -1 : 1;
  const c1 = start.x + sourceDirection * tension;
  const c2 = end.x + targetDirection * tension;
  return `M ${start.x} ${start.y} C ${c1} ${start.y}, ${c2} ${end.y}, ${end.x} ${end.y}`;
}

function getNodeBounds(padding = 220) {
  if (!state.nodes.length) return null;
  const raw = state.nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxX: Math.max(acc.maxX, node.x + node.w),
      maxY: Math.max(acc.maxY, node.y + node.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
  return {
    minX: raw.minX - padding,
    minY: raw.minY - padding,
    maxX: raw.maxX + padding,
    maxY: raw.maxY + padding,
  };
}

function getMinimapGeometry() {
  const bounds = getNodeBounds();
  if (!bounds) return null;
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(160 / width, 160 / height);
  return {
    bounds,
    scale,
    offsetX: (180 - width * scale) / 2,
    offsetY: (180 - height * scale) / 2,
  };
}

function mapToMinimap(value, min, scale, offset) {
  return (value - min) * scale + offset;
}

function renderMinimap() {
  if (!els.minimapSvg) return;
  const geometry = getMinimapGeometry();
  if (!geometry) {
    els.minimapSvg.innerHTML = `<text x="90" y="94" text-anchor="middle" class="minimap-empty">Empty canvas</text>`;
    return;
  }

  const { bounds, scale, offsetX, offsetY } = geometry;
  const nodes = state.nodes
    .map((node) => {
      const x = mapToMinimap(node.x, bounds.minX, scale, offsetX);
      const y = mapToMinimap(node.y, bounds.minY, scale, offsetY);
      const width = Math.max(3, node.w * scale);
      const height = Math.max(3, node.h * scale);
      const classes = [
        "minimap-node",
        isWorkflowNode(node) ? "is-workflow" : "",
        isNodeSelected(node.id) ? "is-selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<rect class="${classes}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="1" />`;
    })
    .join("");

  const viewport = els.viewport.getBoundingClientRect();
  const viewWorld = {
    x: -state.view.x / state.view.scale,
    y: -state.view.y / state.view.scale,
    w: viewport.width / state.view.scale,
    h: viewport.height / state.view.scale,
  };
  const viewX = mapToMinimap(viewWorld.x, bounds.minX, scale, offsetX);
  const viewY = mapToMinimap(viewWorld.y, bounds.minY, scale, offsetY);
  const viewW = Math.max(6, viewWorld.w * scale);
  const viewH = Math.max(6, viewWorld.h * scale);
  els.minimapSvg.innerHTML = `
    ${nodes}
    <rect class="minimap-view" x="${viewX.toFixed(2)}" y="${viewY.toFixed(2)}" width="${viewW.toFixed(2)}" height="${viewH.toFixed(2)}" rx="2" />
  `;
}

function renderInspector() {
  if (!inspectorOpen) return;
  if (selectedNodeIds().length > 1) {
    els.inspector.innerHTML = renderMultiNodeInspector(selectedNodeIds());
    return;
  }
  const node = selectedNode();
  if (node) {
    els.inspector.innerHTML = renderNodeInspector(node);
    return;
  }
  const asset = selectedAsset();
  if (asset) {
    els.inspector.innerHTML = renderAssetInspector(asset);
    return;
  }
  els.inspector.innerHTML = `
    <section class="inspector-empty">
      <div class="inspector-head">
        <div>
          <h2>Board</h2>
          <p>${state.nodes.length} nodes, ${state.assets.length} assets</p>
        </div>
        <button class="icon-button" type="button" data-action="close-inspector" title="Close inspector" data-tip="Close inspector" aria-label="Close inspector">X</button>
      </div>
      <button class="button primary" type="button" data-action="workflow-from-asset">Create Workflow</button>
    </section>
  `;
}

function renderMultiNodeInspector(ids) {
  return `
    <section class="inspector-section">
      <div class="panel-head inspector-head">
        <div>
          <h2>${ids.length} Cards Selected</h2>
          <span>Drag any selected card to move the group.</span>
        </div>
        <div class="inspector-actions">
          <button class="icon-button" type="button" data-action="close-inspector" title="Close inspector" data-tip="Close inspector" aria-label="Close inspector">-</button>
          <button class="icon-button danger" type="button" data-action="delete-node" title="Delete selected cards" data-tip="Delete selected cards" aria-label="Delete selected cards">X</button>
        </div>
      </div>
      <p class="help-text">Selected cards: ${ids.map((id) => nodeById(id)?.title || id).map(esc).join(", ")}</p>
    </section>
  `;
}

function renderNodeInspector(node) {
  const typeOptions = ["draft", "ready", "review", "approved", "blocked"]
    .map((status) => `<option value="${status}" ${node.status === status ? "selected" : ""}>${status}</option>`)
    .join("");
  return `
    <section class="inspector-section">
      <div class="panel-head inspector-head">
        <div>
          <h2>${esc(nodeTypeLabel(node.type))}</h2>
          <span>${esc(node.id)}</span>
        </div>
        <div class="inspector-actions">
          <button class="icon-button" type="button" data-action="close-inspector" title="Close inspector" data-tip="Close inspector" aria-label="Close inspector">-</button>
          <button class="icon-button danger" type="button" data-action="delete-node" title="Delete this card" data-tip="Delete this card" aria-label="Delete">X</button>
        </div>
      </div>
      <div class="field">
        <label>Title</label>
        <input data-field="title" value="${esc(node.title)}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Status</label>
          <select data-field="status">${typeOptions}</select>
        </div>
        <div class="field">
          <label>Tags</label>
          <input data-field="tags" value="${esc(node.tags)}" placeholder="shot, hero, v1" />
        </div>
      </div>
    </section>
    ${renderReadinessPanel(node)}
    ${isWorkflowNode(node) ? renderWorkflowFields(node) : renderPromptFields(node)}
    ${isWorkflowNode(node) ? "" : renderConnectionFields(node)}
    ${isWorkflowNode(node) ? renderAttemptsPanel(node) : ""}
    ${renderReviewPanel(node)}
    <section class="inspector-section">
      <div class="field">
        <label>Notes</label>
        <textarea data-field="notes">${esc(node.notes)}</textarea>
      </div>
      <button class="button" type="button" data-action="duplicate-node" title="Duplicate this card" data-tip="Duplicate this card">Duplicate</button>
    </section>
  `;
}

function renderReadinessPanel(node) {
  const ready = readinessForNode(node);
  return `
    <section class="inspector-section readiness-panel">
      <h3>Handoff Readiness</h3>
      <div class="readiness-meter" style="--ready:${ready.total ? ready.done / ready.total : 0}">
        <span></span>
      </div>
      <ul class="readiness-list">
        ${ready.items
          .map((item) => `<li class="${item.pass ? "is-done" : "is-missing"}">${item.pass ? "OK" : "Need"} ${esc(item.label)}</li>`)
          .join("")}
      </ul>
    </section>
  `;
}

function renderReviewPanel(node) {
  return `
    <section class="inspector-section">
      <h3>Review Notes</h3>
      <div class="field-row">
        <div class="field">
          <label>Owner</label>
          <input data-field="reviewOwner" value="${esc(node.reviewOwner || "")}" placeholder="me, editor, client" />
        </div>
        <div class="field">
          <label>Decision</label>
          <select data-field="reviewDecision">
            ${["", "needs review", "revise", "approved", "hold", "regenerate"].map((value) => `<option value="${value}" ${(node.reviewDecision || "") === value ? "selected" : ""}>${value || "none"}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea data-field="reviewNotes" placeholder="Client/editor comments, decisions, and next actions.">${esc(node.reviewNotes || "")}</textarea>
      </div>
    </section>
  `;
}

function renderAttemptsPanel(node) {
  const attempts = Array.isArray(node.attempts) ? node.attempts : [];
  return `
    <section class="inspector-section">
      <h3>Generation Attempts</h3>
      <div class="field-row">
        <div class="field">
          <label>Label</label>
          <input data-attempt-field="label" placeholder="v1, v2, Runway test" />
        </div>
        <div class="field">
          <label>Status</label>
          <select data-attempt-field="status">
            <option value="candidate">candidate</option>
            <option value="winner">winner</option>
            <option value="rejected">rejected</option>
            <option value="needs revision">needs revision</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Output URL</label>
          <input data-attempt-field="outputUrl" placeholder="https://..." />
        </div>
        <div class="field">
          <label>Seed / Settings</label>
          <input data-attempt-field="seed" placeholder="seed, cfg, motion strength" />
        </div>
      </div>
      <div class="field">
        <label>Attempt Notes</label>
        <textarea data-attempt-field="notes" placeholder="What worked, what failed, what to change next."></textarea>
      </div>
      <button class="button primary" type="button" data-action="add-attempt">Add Attempt</button>
      <div class="attempt-list">
        ${
          attempts.length
            ? attempts
                .map(
                  (attempt) => `
                    <article class="attempt-row">
                      <div>
                        <strong>${esc(attempt.label || "Attempt")}</strong>
                        <span>${esc(attempt.status || "candidate")}${attempt.seed ? ` / ${esc(attempt.seed)}` : ""}</span>
                        ${attempt.outputUrl ? `<a href="${esc(attempt.outputUrl)}" target="_blank" rel="noreferrer">${esc(attempt.outputUrl)}</a>` : ""}
                        ${attempt.notes ? `<p>${esc(attempt.notes)}</p>` : ""}
                      </div>
                      <div class="version-actions">
                        <button class="button compact" type="button" data-action="mark-attempt-winner" data-attempt-id="${attempt.id}">Winner</button>
                        <button class="button compact" type="button" data-action="delete-attempt" data-attempt-id="${attempt.id}">Delete</button>
                      </div>
                    </article>
                  `,
                )
                .join("")
            : `<p class="help-text">No generation outputs logged yet.</p>`
        }
      </div>
    </section>
  `;
}

function renderConnectionFields(node) {
  return `
    <section class="inspector-section">
      <h3>Connection</h3>
      <div class="field">
        <label>Source Card</label>
        <select data-field="sourceNodeId">
          <option value="">None</option>
          ${state.nodes
            .filter((item) => item.id !== node.id)
            .map((item) => `<option value="${item.id}" ${node.sourceNodeId === item.id ? "selected" : ""}>${esc(item.title)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Source Side</label>
          <select data-field="linkSourceSide">
            ${["left", "right"].map((side) => `<option value="${side}" ${(node.linkSourceSide || "right") === side ? "selected" : ""}>${side}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>This Card Side</label>
          <select data-field="linkTargetSide">
            ${["left", "right"].map((side) => `<option value="${side}" ${(node.linkTargetSide || "left") === side ? "selected" : ""}>${side}</option>`).join("")}
          </select>
        </div>
      </div>
    </section>
  `;
}

function renderPromptFields(node) {
  if (node.type === "media") {
    return `
      <section class="inspector-section">
        <h3>Image / Reference Prompt</h3>
        <div class="field">
          <label>Prompt For This Asset</label>
          <textarea data-field="prompt" placeholder="Prompt, motion instruction, style notes, or audio direction for this specific asset.">${esc(node.prompt)}</textarea>
        </div>
        <div class="field">
          <label>Negative Prompt</label>
          <textarea data-field="negativePrompt">${esc(node.negativePrompt)}</textarea>
        </div>
      </section>
    `;
  }
  if (node.type === "section" || node.type === "scene" || node.type === "shot") {
    return `
      ${node.type === "section" ? "" : renderShotMetadataFields(node)}
      <section class="inspector-section">
        <h3>${node.type === "section" ? "Section Plan" : "Scene Prompt"}</h3>
        <div class="field">
          <label>${node.type === "section" ? "Section Description" : "Overall Scene Description"}</label>
          <textarea data-field="overallPrompt" placeholder="What should this whole scene feel like? Include story action, tone, camera, character continuity, and visual priorities.">${esc(node.overallPrompt)}</textarea>
        </div>
        <div class="field">
          <label>Style Direction</label>
          <textarea data-field="stylePrompt" placeholder="Reference style, lighting, color, lens, pacing, or editing language.">${esc(node.stylePrompt)}</textarea>
        </div>
        <div class="field">
          <label>Music / Sound Direction</label>
          <textarea data-field="musicPrompt" placeholder="Music mood, tempo, instruments, references, or audio notes for this scene.">${esc(node.musicPrompt)}</textarea>
        </div>
      </section>
    `;
  }
  if (node.type === "placeholder") {
    return `
      <section class="inspector-section">
        <h3>Missing Piece</h3>
        <div class="field-row">
          <div class="field">
            <label>Needed For</label>
            <select data-field="neededFor">
              ${["image", "video", "music", "sound", "style", "text", "approval"].map((value) => `<option value="${value}" ${node.neededFor === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label>Resolved By Asset</label>
            <select data-field="referenceAssetId">${assetOptions(node.referenceAssetId, "None")}</select>
          </div>
        </div>
        <div class="field">
          <label>Needed Prompt / Brief</label>
          <textarea data-field="prompt" placeholder="Describe the missing image, clip, reference, music, sound, or decision.">${esc(node.prompt)}</textarea>
        </div>
      </section>
    `;
  }
  if (node.type === "inspiration") {
    return `
      <section class="inspector-section">
        <h3>Inspiration</h3>
        <div class="field">
          <label>Prompt Fragment / Idea</label>
          <textarea data-field="prompt" placeholder="Reusable wording, camera language, pacing note, palette note, or tone idea.">${esc(node.prompt)}</textarea>
        </div>
        <div class="field">
          <label>Style Direction</label>
          <textarea data-field="stylePrompt" placeholder="Optional style interpretation for this idea.">${esc(node.stylePrompt)}</textarea>
        </div>
      </section>
    `;
  }
  if (node.type === "styleRef" || node.type === "musicRef") {
    return `
      <section class="inspector-section">
        <h3>${node.type === "styleRef" ? "Style Reference" : "Music Reference"}</h3>
        <div class="field">
          <label>${node.type === "styleRef" ? "Video / Style URL" : "Music / Audio URL"}</label>
          <input data-field="referenceUrl" value="${esc(node.referenceUrl || "")}" placeholder="${node.type === "styleRef" ? "https://video-reference..." : "https://music-reference..."}" />
        </div>
        <div class="field">
          <label>Attached File / Asset</label>
          <select data-field="referenceAssetId">${referenceAssetOptions(node)}</select>
        </div>
        <button class="button" type="button" data-action="upload-reference-file" title="Upload a file directly to this card" data-tip="Upload a file directly to this card">${node.type === "styleRef" ? "Upload Video/Image" : "Upload Music/Audio"}</button>
      </section>
      <section class="inspector-section">
        <h3>${node.type === "styleRef" ? "Style Direction" : "Music Direction"}</h3>
        <div class="field">
          <label>${node.type === "styleRef" ? "Style / Tone Prompt" : "Music / Audio Prompt"}</label>
          <textarea data-field="${node.type === "styleRef" ? "stylePrompt" : "musicPrompt"}">${esc(node.type === "styleRef" ? node.stylePrompt : node.musicPrompt)}</textarea>
        </div>
      </section>
      ${renderReferenceIntelligenceFields(node)}
    `;
  }
  return "";
}

function renderShotMetadataFields(node) {
  return `
    <section class="inspector-section">
      <h3>Shot Metadata</h3>
      <div class="field-row">
        <div class="field">
          <label>Shot Size</label>
          <select data-field="shotSize">
            ${["", "extreme wide", "wide", "medium", "close-up", "extreme close-up", "macro"].map((value) => `<option value="${value}" ${(node.shotSize || "") === value ? "selected" : ""}>${value || "none"}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Camera Angle</label>
          <select data-field="cameraAngle">
            ${["", "eye-level", "low angle", "high angle", "overhead", "dutch angle", "profile", "over-the-shoulder"].map((value) => `<option value="${value}" ${(node.cameraAngle || "") === value ? "selected" : ""}>${value || "none"}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Camera Movement</label>
          <input data-field="cameraMovement" value="${esc(node.cameraMovement || "")}" placeholder="push in, orbit, handheld, locked off" />
        </div>
        <div class="field">
          <label>Priority</label>
          <select data-field="priority">
            ${["low", "normal", "high", "must-have"].map((value) => `<option value="${value}" ${(node.priority || "normal") === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Subject Action</label>
        <input data-field="subjectAction" value="${esc(node.subjectAction || "")}" placeholder="What happens in frame?" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Location</label>
          <input data-field="location" value="${esc(node.location || "")}" />
        </div>
        <div class="field">
          <label>Mood</label>
          <input data-field="mood" value="${esc(node.mood || "")}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Lighting</label>
          <input data-field="lighting" value="${esc(node.lighting || "")}" />
        </div>
        <div class="field">
          <label>Lens Feel</label>
          <input data-field="lensFeel" value="${esc(node.lensFeel || "")}" placeholder="macro, anamorphic, long lens" />
        </div>
      </div>
    </section>
  `;
}

function renderReferenceIntelligenceFields(node) {
  return `
    <section class="inspector-section">
      <h3>Reference Intelligence</h3>
      <div class="field">
        <label>Use This For</label>
        <input data-field="influenceUse" value="${esc(node.influenceUse || "")}" placeholder="color, pacing, camera, lighting, wardrobe, edit rhythm" />
      </div>
      <div class="field-row">
        <div class="field">
          <label>Influence Strength</label>
          <select data-field="influenceStrength">
            ${["light", "medium", "strong", "exact mood only"].map((value) => `<option value="${value}" ${(node.influenceStrength || "medium") === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Color Notes</label>
          <input data-field="influenceColor" value="${esc(node.influenceColor || "")}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Pacing Notes</label>
          <input data-field="influencePacing" value="${esc(node.influencePacing || "")}" />
        </div>
        <div class="field">
          <label>Camera Notes</label>
          <input data-field="influenceCamera" value="${esc(node.influenceCamera || "")}" />
        </div>
      </div>
      <div class="field">
        <label>Lighting Notes</label>
        <input data-field="influenceLighting" value="${esc(node.influenceLighting || "")}" />
      </div>
      <div class="field">
        <label>Do Not Copy</label>
        <textarea data-field="doNotCopy" placeholder="Anything to avoid copying too literally.">${esc(node.doNotCopy || "")}</textarea>
      </div>
    </section>
  `;
}

function referenceAssetOptions(node) {
  const allowedTypes = node.type === "musicRef" ? ["audio", "video"] : ["video", "image"];
  return `
    <option value="">None</option>
    ${state.assets
      .filter((asset) => !asset.archived && allowedTypes.includes(asset.type))
      .map((asset) => `<option value="${asset.id}" ${node.referenceAssetId === asset.id ? "selected" : ""}>${esc(asset.name)}</option>`)
      .join("")}
  `;
}

function renderWorkflowFields(node) {
  return `
    ${renderShotMetadataFields(node)}
    <section class="inspector-section">
      <h3>Workflow</h3>
      <div class="field-row">
        <div class="field">
          <label>Provider</label>
          <input data-field="provider" value="${esc(node.provider)}" />
        </div>
        <div class="field">
          <label>Model</label>
          <input data-field="model" value="${esc(node.model)}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Aspect</label>
          <select data-field="aspectRatio">
            ${["16:9", "9:16", "1:1", "4:5", "2.39:1"].map((value) => `<option ${node.aspectRatio === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Resolution</label>
          <select data-field="resolution">
            ${["720p", "1080p", "1440p", "4K"].map((value) => `<option ${node.resolution === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Duration</label>
          <select data-field="duration">
            ${["4s", "5s", "6s", "8s", "10s", "12s"].map((value) => `<option ${node.duration === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Seed</label>
          <input data-field="seed" value="${esc(node.seed)}" />
        </div>
      </div>
      <div class="field">
        <label>Source Node</label>
        <select data-field="sourceNodeId">
          <option value="">None</option>
          ${state.nodes
            .filter((item) => item.id !== node.id)
            .map((item) => `<option value="${item.id}" ${node.sourceNodeId === item.id ? "selected" : ""}>${esc(item.title)}</option>`)
            .join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Source Side</label>
          <select data-field="linkSourceSide">
            ${["left", "right"].map((side) => `<option value="${side}" ${(node.linkSourceSide || "right") === side ? "selected" : ""}>${side}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>This Card Side</label>
          <select data-field="linkTargetSide">
            ${["left", "right"].map((side) => `<option value="${side}" ${(node.linkTargetSide || "left") === side ? "selected" : ""}>${side}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Start Frame</label>
          <select data-field="startAssetId">${assetOptions(node.startAssetId, "None")}</select>
        </div>
        <div class="field">
          <label>End Frame</label>
          <select data-field="endAssetId">${assetOptions(node.endAssetId, "Optional")}</select>
        </div>
      </div>
      <div class="field">
        <label>Prompt</label>
        <textarea data-field="prompt" placeholder="Describe motion, camera, continuity, and final frame.">${esc(node.prompt)}</textarea>
      </div>
      <div class="field">
        <label>Negative Prompt</label>
        <textarea data-field="negativePrompt">${esc(node.negativePrompt)}</textarea>
      </div>
    </section>
  `;
}

function assetOptions(selectedId, emptyLabel) {
  return `
    <option value="">${emptyLabel}</option>
    ${state.assets
      .filter((asset) => !asset.archived && (asset.type === "image" || asset.type === "video"))
      .map((asset) => `<option value="${asset.id}" ${selectedId === asset.id ? "selected" : ""}>${esc(asset.name)}</option>`)
      .join("")}
  `;
}

function renderAssetInspector(asset) {
  return `
    <section class="inspector-section">
      <div class="panel-head inspector-head">
        <div>
          <h2>Asset</h2>
          <span>${esc(asset.type)} / ${formatBytes(asset.size)}</span>
        </div>
        <button class="icon-button" type="button" data-action="close-inspector" title="Close inspector" data-tip="Close inspector" aria-label="Close inspector">-</button>
      </div>
      ${renderAssetMedia(asset, "node-media")}
      <div class="field">
        <label>Name</label>
        <input value="${esc(asset.name)}" readonly />
      </div>
      ${asset.externalUrl ? `
        <div class="field">
          <label>URL</label>
          <input value="${esc(asset.externalUrl)}" readonly />
        </div>
      ` : ""}
      <div class="field">
        <label>Tags</label>
        <input value="${esc(asset.tags)}" readonly />
      </div>
      <div class="status-row">
        ${asset.inbox ? `<span class="tag">inbox</span>` : `<span class="tag">sorted</span>`}
        ${asset.favorite ? `<span class="tag">favorite</span>` : ""}
      </div>
      ${asset.notes ? `
        <div class="field">
          <label>Reference Notes</label>
          <textarea readonly>${esc(asset.notes)}</textarea>
        </div>
      ` : ""}
      <button class="button" type="button" data-action="add-selected-asset" title="Add this asset as a card" data-tip="Add this asset as a card">Add to Canvas</button>
      <button class="button primary" type="button" data-action="workflow-from-asset" title="Create an image-to-video workflow from this asset" data-tip="Create an image-to-video workflow from this asset">Create Workflow</button>
    </section>
  `;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openExportDialog() {
  els.exportText.value = exportMarkdown();
  els.exportDialog.showModal();
}

function exportProject() {
  return {
    ...state,
    assets: state.assets.map(({ dataUrl, ...asset }) => asset),
  };
}

function exportMarkdown() {
  const lines = [];
  lines.push(`# ${state.title}`);
  lines.push("");
  lines.push(`Updated: ${new Date(state.updatedAt).toLocaleString()}`);
  lines.push("");
  lines.push("## Continuity Bible");
  const continuity = { ...defaultContinuity(), ...(state.continuity || {}) };
  const continuityRows = [
    ["Characters", continuity.characters],
    ["Wardrobe / Look", continuity.wardrobe],
    ["Locations", continuity.locations],
    ["Props / Objects", continuity.props],
    ["Style Rules", continuity.styleRules],
    ["Never Change", continuity.neverChange],
  ].filter(([, value]) => value);
  if (!continuityRows.length) {
    lines.push("");
    lines.push("No continuity bible notes yet.");
  }
  continuityRows.forEach(([label, value]) => {
    lines.push(`- ${label}: ${value.replaceAll("\n", " ")}`);
  });
  lines.push("");
  lines.push("## Handoff Readiness");
  const handoffNodes = state.nodes
    .filter((node) => ["section", "scene", "shot", "workflow", "imageWorkflow", "placeholder", "styleRef", "musicRef"].includes(node.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!handoffNodes.length) {
    lines.push("");
    lines.push("No handoff cards yet.");
  }
  handoffNodes.forEach((node) => {
    const ready = readinessForNode(node);
    const missing = ready.items.filter((item) => !item.pass).map((item) => item.label);
    lines.push(`- ${node.title} (${nodeTypeLabel(node.type)}): ${ready.done}/${ready.total} ready${missing.length ? `; needs ${missing.join(", ")}` : ""}`);
  });
  lines.push("");
  lines.push("## Sections");
  const sections = state.nodes.filter((node) => node.type === "section").sort((a, b) => a.y - b.y || a.x - b.x);
  if (!sections.length) {
    lines.push("");
    lines.push("No section frames yet.");
  }
  sections.forEach((section) => {
    const children = nodesInsideSection(section).sort((a, b) => a.y - b.y || a.x - b.x);
    lines.push("");
    lines.push(`### ${section.title}`);
    if (section.overallPrompt || section.notes) lines.push(`- Description: ${(section.overallPrompt || section.notes).replaceAll("\n", " ")}`);
    if (section.stylePrompt) lines.push(`- Style: ${section.stylePrompt.replaceAll("\n", " ")}`);
    if (section.musicPrompt) lines.push(`- Music / Sound: ${section.musicPrompt.replaceAll("\n", " ")}`);
    lines.push(`- Contains: ${children.length ? children.map((node) => node.title).join(", ") : "No cards inside yet"}`);
  });
  lines.push("");
  lines.push("## Placeholder Needs");
  const placeholders = state.nodes.filter((node) => node.type === "placeholder").sort((a, b) => a.y - b.y || a.x - b.x);
  if (!placeholders.length) {
    lines.push("");
    lines.push("No missing asset placeholders yet.");
  }
  placeholders.forEach((node) => {
    const asset = assetById(node.referenceAssetId);
    lines.push("");
    lines.push(`- ${node.title}`);
    lines.push(`  Needed For: ${node.neededFor || ""}`);
    lines.push(`  Status: ${node.status || ""}`);
    if (node.prompt || node.notes) lines.push(`  Brief: ${(node.prompt || node.notes).replaceAll("\n", " ")}`);
    if (asset) lines.push(`  Resolved By: ${asset.name}`);
  });
  lines.push("");
  lines.push("## Scene Prompts");
  const promptNodes = state.nodes
    .filter((node) => (node.type === "section" || node.type === "scene" || node.type === "shot") && (node.overallPrompt || node.stylePrompt || node.musicPrompt || node.notes))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!promptNodes.length) {
    lines.push("");
    lines.push("No scene prompt cards yet.");
  }
  promptNodes.forEach((node) => {
    lines.push("");
    lines.push(`### ${node.title}`);
    if (node.overallPrompt) lines.push(`- Overall: ${node.overallPrompt.replaceAll("\n", " ")}`);
    if (node.shotSize || node.cameraAngle || node.cameraMovement || node.subjectAction || node.location || node.mood || node.lighting || node.lensFeel || node.priority) {
      lines.push(`- Shot Metadata: ${[
        node.shotSize && `size ${node.shotSize}`,
        node.cameraAngle && `angle ${node.cameraAngle}`,
        node.cameraMovement && `movement ${node.cameraMovement}`,
        node.subjectAction && `action ${node.subjectAction}`,
        node.location && `location ${node.location}`,
        node.mood && `mood ${node.mood}`,
        node.lighting && `lighting ${node.lighting}`,
        node.lensFeel && `lens ${node.lensFeel}`,
        node.priority && `priority ${node.priority}`,
      ].filter(Boolean).join("; ")}`);
    }
    if (node.stylePrompt) lines.push(`- Style: ${node.stylePrompt.replaceAll("\n", " ")}`);
    if (node.musicPrompt) lines.push(`- Music / Sound: ${node.musicPrompt.replaceAll("\n", " ")}`);
    if (node.notes) lines.push(`- Notes: ${node.notes.replaceAll("\n", " ")}`);
  });
  lines.push("");
  lines.push("## References");
  const referenceAssets = state.assets
    .filter((asset) => asset.type === "video-link" || asset.type === "music-link" || asset.type === "reference-link" || asset.type === "audio")
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  if (!referenceAssets.length) {
    lines.push("");
    lines.push("No style, music, or link references yet.");
  }
  referenceAssets.forEach((asset) => {
    lines.push("");
    lines.push(`- ${asset.name}`);
    lines.push(`  Type: ${asset.type}`);
    if (asset.externalUrl) lines.push(`  URL: ${asset.externalUrl}`);
    if (asset.tags) lines.push(`  Tags: ${asset.tags}`);
    if (asset.notes) lines.push(`  Notes: ${asset.notes.replaceAll("\n", " ")}`);
  });
  state.nodes
    .filter((node) => (node.type === "styleRef" || node.type === "musicRef") && (node.referenceUrl || node.referenceAssetId || node.stylePrompt || node.musicPrompt))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((node) => {
      const asset = assetById(node.referenceAssetId);
      lines.push("");
      lines.push(`- ${node.title}`);
      lines.push(`  Type: ${node.type === "musicRef" ? "music reference card" : "style reference card"}`);
      if (node.referenceUrl) lines.push(`  URL: ${node.referenceUrl}`);
      if (asset) lines.push(`  Attached File: ${asset.name}`);
      if (node.influenceUse) lines.push(`  Use For: ${node.influenceUse}`);
      if (node.influenceStrength) lines.push(`  Influence Strength: ${node.influenceStrength}`);
      if (node.influenceColor) lines.push(`  Color Notes: ${node.influenceColor}`);
      if (node.influencePacing) lines.push(`  Pacing Notes: ${node.influencePacing}`);
      if (node.influenceCamera) lines.push(`  Camera Notes: ${node.influenceCamera}`);
      if (node.influenceLighting) lines.push(`  Lighting Notes: ${node.influenceLighting}`);
      if (node.doNotCopy) lines.push(`  Do Not Copy: ${node.doNotCopy.replaceAll("\n", " ")}`);
      if (node.stylePrompt) lines.push(`  Style Prompt: ${node.stylePrompt.replaceAll("\n", " ")}`);
      if (node.musicPrompt) lines.push(`  Music Prompt: ${node.musicPrompt.replaceAll("\n", " ")}`);
    });
  lines.push("");
  lines.push("## Asset Prompts");
  const mediaPromptNodes = state.nodes
    .filter((node) => node.type === "media" && (node.prompt || node.negativePrompt))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!mediaPromptNodes.length) {
    lines.push("");
    lines.push("No per-image or reference prompts yet.");
  }
  mediaPromptNodes.forEach((node) => {
    const asset = assetById(node.assetId);
    lines.push("");
    lines.push(`### ${node.title}`);
    lines.push(`- Asset: ${asset?.name || ""}`);
    if (asset?.externalUrl) lines.push(`- URL: ${asset.externalUrl}`);
    if (node.prompt) {
      lines.push("");
      lines.push("Prompt:");
      lines.push("```");
      lines.push(node.prompt);
      lines.push("```");
    }
    if (node.negativePrompt) {
      lines.push("");
      lines.push("Negative Prompt:");
      lines.push("```");
      lines.push(node.negativePrompt);
      lines.push("```");
    }
  });
  lines.push("");
  lines.push("## Shot Package");
  const workflows = state.nodes
    .filter(isWorkflowNode)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!workflows.length) {
    lines.push("");
    lines.push("No workflow cards yet.");
  }
  workflows.forEach((node, index) => {
    const start = assetById(node.startAssetId);
    const end = assetById(node.endAssetId);
    const source = nodeById(node.sourceNodeId);
    lines.push("");
    lines.push(`### ${index + 1}. ${node.title}`);
    lines.push(`- Status: ${node.status || "draft"}`);
    lines.push(`- Provider: ${node.provider || ""}`);
    lines.push(`- Model: ${node.model || ""}`);
    lines.push(`- Aspect / Resolution / Duration: ${node.aspectRatio || ""} / ${node.resolution || ""} / ${node.duration || ""}`);
    lines.push(`- Seed: ${node.seed || ""}`);
    lines.push(`- Shot Size / Angle / Movement: ${node.shotSize || ""} / ${node.cameraAngle || ""} / ${node.cameraMovement || ""}`);
    lines.push(`- Action / Location / Mood: ${node.subjectAction || ""} / ${node.location || ""} / ${node.mood || ""}`);
    lines.push(`- Lighting / Lens / Priority: ${node.lighting || ""} / ${node.lensFeel || ""} / ${node.priority || ""}`);
    lines.push(`- Source Node: ${source?.title || ""}`);
    lines.push(`- Start Frame: ${start?.name || ""}`);
    lines.push(`- End Frame: ${end?.name || ""}`);
    lines.push(`- Tags: ${node.tags || ""}`);
    lines.push("");
    lines.push("Prompt:");
    lines.push("```");
    lines.push(node.prompt || "");
    lines.push("```");
    if (node.negativePrompt) {
      lines.push("");
      lines.push("Negative Prompt:");
      lines.push("```");
      lines.push(node.negativePrompt);
      lines.push("```");
    }
    if (node.notes) {
      lines.push("");
      lines.push(`Notes: ${node.notes}`);
    }
    if ((node.attempts || []).length) {
      lines.push("");
      lines.push("Attempts:");
      node.attempts.forEach((attempt) => {
        lines.push(`- ${attempt.label || "Attempt"} / ${attempt.status || "candidate"}${attempt.seed ? ` / ${attempt.seed}` : ""}${attempt.outputUrl ? ` / ${attempt.outputUrl}` : ""}${attempt.notes ? ` - ${attempt.notes.replaceAll("\n", " ")}` : ""}`);
      });
    }
    if (node.reviewDecision || node.reviewOwner || node.reviewNotes) {
      lines.push("");
      lines.push(`Review: ${[node.reviewDecision, node.reviewOwner, node.reviewNotes?.replaceAll("\n", " ")].filter(Boolean).join(" / ")}`);
    }
  });
  lines.push("");
  lines.push("## Review Notes");
  const reviewNodes = state.nodes
    .filter((node) => node.reviewDecision || node.reviewOwner || node.reviewNotes)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  if (!reviewNodes.length) {
    lines.push("");
    lines.push("No review notes yet.");
  }
  reviewNodes.forEach((node) => {
    lines.push(`- ${node.title}: ${[node.reviewDecision, node.reviewOwner, node.reviewNotes?.replaceAll("\n", " ")].filter(Boolean).join(" / ")}`);
  });
  lines.push("");
  lines.push("## Board Notes");
  state.nodes
    .filter((node) => !isWorkflowNode(node))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((node) => {
      lines.push(`- ${nodeTypeLabel(node.type)}: ${node.title}${node.notes ? ` - ${node.notes.replaceAll("\n", " ")}` : ""}`);
    });
  return lines.join("\n");
}

function exportStoryboardHtml() {
  const ordered = storyboardExportNodes();
  const continuity = { ...defaultContinuity(), ...(state.continuity || {}) };
  const continuityItems = [
    ["Characters", continuity.characters],
    ["Wardrobe / Look", continuity.wardrobe],
    ["Locations", continuity.locations],
    ["Props / Objects", continuity.props],
    ["Style Rules", continuity.styleRules],
    ["Never Change", continuity.neverChange],
  ].filter(([, value]) => value);
  const cards = ordered
    .map((node, index) => {
      const asset = assetById(node.assetId || node.startAssetId || node.referenceAssetId);
      const media = asset?.dataUrl
        ? asset.type === "video"
          ? `<video src="${asset.dataUrl}" controls muted playsinline></video>`
          : asset.type === "audio"
            ? `<audio src="${asset.dataUrl}" controls></audio>`
            : `<img src="${asset.dataUrl}" alt="${esc(asset.name)}" />`
        : `<div class="empty">No visual attached</div>`;
      const attempts = (node.attempts || []).map((attempt) => `<li>${esc(attempt.label || "Attempt")} / ${esc(attempt.status || "candidate")}${attempt.outputUrl ? ` / <a href="${esc(attempt.outputUrl)}">${esc(attempt.outputUrl)}</a>` : ""}</li>`).join("");
      return `
        <article class="card">
          <div class="media">${media}</div>
          <div class="meta">
            <span>${index + 1}. ${esc(nodeTypeLabel(node.type))}</span>
            <h2>${esc(node.title)}</h2>
            <p>${esc(node.overallPrompt || node.prompt || node.stylePrompt || node.musicPrompt || node.notes || "")}</p>
            <dl>
              ${node.status ? `<dt>Status</dt><dd>${esc(node.status)}</dd>` : ""}
              ${node.shotSize || node.cameraAngle || node.cameraMovement ? `<dt>Shot</dt><dd>${esc([node.shotSize, node.cameraAngle, node.cameraMovement].filter(Boolean).join(" / "))}</dd>` : ""}
              ${node.subjectAction ? `<dt>Action</dt><dd>${esc(node.subjectAction)}</dd>` : ""}
              ${node.location || node.mood ? `<dt>Location / Mood</dt><dd>${esc([node.location, node.mood].filter(Boolean).join(" / "))}</dd>` : ""}
              ${node.lighting || node.lensFeel ? `<dt>Lighting / Lens</dt><dd>${esc([node.lighting, node.lensFeel].filter(Boolean).join(" / "))}</dd>` : ""}
              ${node.reviewDecision || node.reviewNotes ? `<dt>Review</dt><dd>${esc([node.reviewDecision, node.reviewNotes].filter(Boolean).join(" / "))}</dd>` : ""}
            </dl>
            ${attempts ? `<h3>Attempts</h3><ul>${attempts}</ul>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(state.title)} Storyboard</title>
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; color: #171717; background: #f6f3ec; }
    header { padding: 28px; border-bottom: 2px solid #171717; background: #fffcf5; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .section { padding: 22px 28px; border-bottom: 1px solid #d4ccc0; }
    .continuity { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .continuity div, .card { border: 1px solid #171717; background: #fffcf5; }
    .continuity div { padding: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; padding: 22px 28px; }
    .card { display: grid; grid-template-rows: auto 1fr; break-inside: avoid; }
    .media { min-height: 190px; display: grid; place-items: center; background: #eee8dc; border-bottom: 1px solid #171717; }
    img, video { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
    audio { width: 92%; }
    .empty { color: #6d6a62; font-weight: 700; }
    .meta { padding: 12px; }
    .meta span { color: #287d8e; font-size: 12px; font-weight: 800; text-transform: uppercase; }
    h2 { margin: 4px 0 8px; font-size: 18px; }
    h3 { margin: 12px 0 6px; font-size: 13px; text-transform: uppercase; }
    p { color: #4f4c45; line-height: 1.45; white-space: pre-wrap; }
    dl { display: grid; grid-template-columns: 100px 1fr; gap: 5px 10px; font-size: 13px; }
    dt { font-weight: 800; color: #6d6a62; }
    dd { margin: 0; }
    @media print { body { background: white; } .card { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <h1>${esc(state.title)}</h1>
    <div>Storyboard handoff exported ${new Date().toLocaleString()}</div>
  </header>
  <section class="section">
    <h2>Continuity Bible</h2>
    <div class="continuity">
      ${
        continuityItems.length
          ? continuityItems.map(([label, value]) => `<div><strong>${esc(label)}</strong><p>${esc(value)}</p></div>`).join("")
          : "<p>No continuity bible notes yet.</p>"
      }
    </div>
  </section>
  <main class="grid">${cards || "<p>No storyboard cards yet.</p>"}</main>
</body>
</html>`;
}

function storyboardExportNodes() {
  return state.nodes
    .filter((node) => ["section", "scene", "shot", "workflow", "imageWorkflow", "media", "placeholder", "styleRef", "musicRef"].includes(node.type))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

async function exportStoryboardPdf() {
  const button = els.downloadStoryboardPdfBtn;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Building PDF...";
  try {
    const pages = await renderStoryboardPdfPages();
    const pdfBlob = buildPdfFromJpegPages(pages);
    downloadBlob(pdfBlob, `${safeSlug(state.title || "master-canvas")}-storyboard.pdf`);
    toast("Storyboard PDF exported");
  } catch (error) {
    console.error(error);
    toast("Could not export storyboard PDF");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function renderStoryboardPdfPages() {
  const ordered = storyboardExportNodes();
  const continuity = { ...defaultContinuity(), ...(state.continuity || {}) };
  const continuityItems = [
    ["Characters", continuity.characters],
    ["Wardrobe / Look", continuity.wardrobe],
    ["Locations", continuity.locations],
    ["Props / Objects", continuity.props],
    ["Style Rules", continuity.styleRules],
    ["Never Change", continuity.neverChange],
  ].filter(([, value]) => value);
  const pages = [];
  pages.push(await renderStoryboardPdfCover(continuityItems));

  const cardsPerPage = 4;
  for (let start = 0; start < ordered.length; start += cardsPerPage) {
    pages.push(await renderStoryboardPdfCardPage(ordered.slice(start, start + cardsPerPage), start + 1, ordered.length));
  }
  return pages;
}

async function renderStoryboardPdfCover(continuityItems) {
  const { canvas, ctx } = createPdfCanvas();
  paintPdfPage(ctx);
  ctx.fillStyle = "#171717";
  ctx.font = "800 28px Arial";
  drawWrappedText(ctx, state.title || "Storyboard", 34, 58, 544, 34, 2);
  ctx.font = "13px Arial";
  ctx.fillStyle = "#4f4c45";
  ctx.fillText(`Storyboard PDF exported ${new Date().toLocaleString()}`, 34, 112);
  ctx.fillText(`${state.nodes.length} cards / ${state.assets.length} assets`, 34, 132);
  drawPdfRule(ctx, 34, 154, 544);

  ctx.font = "800 17px Arial";
  ctx.fillStyle = "#171717";
  ctx.fillText("Continuity Bible", 34, 192);
  let y = 218;
  const boxW = 260;
  const boxGap = 16;
  continuityItems.slice(0, 6).forEach(([label, value], index) => {
    const x = 34 + (index % 2) * (boxW + boxGap);
    if (index && index % 2 === 0) y += 145;
    drawPdfCardBox(ctx, x, y, boxW, 122);
    ctx.font = "800 10px Arial";
    ctx.fillStyle = "#287d8e";
    ctx.fillText(label.toUpperCase(), x + 12, y + 22);
    ctx.font = "11px Arial";
    ctx.fillStyle = "#4f4c45";
    drawWrappedText(ctx, value, x + 12, y + 43, boxW - 24, 14, 5);
  });

  ctx.font = "800 14px Arial";
  ctx.fillStyle = "#171717";
  ctx.fillText("How to read this PDF", 34, 690);
  ctx.font = "11px Arial";
  ctx.fillStyle = "#4f4c45";
  drawWrappedText(
    ctx,
    "Cards are ordered the same way as the canvas: top to bottom, left to right. Shot badges like S2-04 mean Scene 2, Shot 4. Full prompts and negative prompts remain in the Markdown, JSON, and handoff ZIP exports.",
    34,
    714,
    544,
    15,
    4,
  );
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function renderStoryboardPdfCardPage(nodes, firstIndex, total) {
  const { canvas, ctx } = createPdfCanvas();
  paintPdfPage(ctx);
  ctx.fillStyle = "#171717";
  ctx.font = "800 16px Arial";
  ctx.fillText(state.title || "Storyboard", 34, 35);
  ctx.font = "10px Arial";
  ctx.fillStyle = "#6d6a62";
  ctx.fillText(`Cards ${firstIndex}-${Math.min(firstIndex + nodes.length - 1, total)} of ${total}`, 430, 35);
  drawPdfRule(ctx, 34, 48, 544);

  const positions = [
    [34, 70],
    [312, 70],
    [34, 420],
    [312, 420],
  ];
  for (let index = 0; index < nodes.length; index += 1) {
    await drawStoryboardPdfCard(ctx, nodes[index], firstIndex + index, positions[index][0], positions[index][1], 266, 320);
  }
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function drawStoryboardPdfCard(ctx, node, order, x, y, w, h) {
  drawPdfCardBox(ctx, x, y, w, h);
  const asset = assetById(node.assetId || node.startAssetId || node.referenceAssetId);
  const mediaH = 140;
  ctx.fillStyle = "#eee8dc";
  ctx.fillRect(x + 1, y + 1, w - 2, mediaH);
  if (asset?.dataUrl && asset.type === "image") {
    const image = await loadPdfImage(asset.dataUrl);
    drawImageCover(ctx, image, x + 1, y + 1, w - 2, mediaH);
  } else {
    ctx.fillStyle = "#6d6a62";
    ctx.font = "800 12px Arial";
    ctx.fillText(asset?.type === "video" ? "Video attached" : asset?.type === "audio" ? "Audio attached" : "No visual attached", x + 16, y + 74);
  }
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + mediaH);
  ctx.lineTo(x + w, y + mediaH);
  ctx.stroke();

  const badge = node.shotOrderLabel || String(order).padStart(2, "0");
  ctx.fillStyle = "#f7c948";
  ctx.fillRect(x + 12, y + mediaH + 12, Math.min(86, Math.max(48, badge.length * 8 + 16)), 21);
  ctx.strokeStyle = "#171717";
  ctx.strokeRect(x + 12, y + mediaH + 12, Math.min(86, Math.max(48, badge.length * 8 + 16)), 21);
  ctx.fillStyle = "#171717";
  ctx.font = "900 10px Arial";
  ctx.fillText(badge, x + 20, y + mediaH + 27);

  ctx.fillStyle = "#287d8e";
  ctx.font = "800 10px Arial";
  ctx.fillText(`${order}. ${nodeTypeLabel(node.type).toUpperCase()}`, x + 108, y + mediaH + 27);
  ctx.fillStyle = "#171717";
  ctx.font = "800 14px Arial";
  drawWrappedText(ctx, node.shotBeatTitle || node.title, x + 12, y + mediaH + 54, w - 24, 17, 2);

  ctx.fillStyle = "#4f4c45";
  ctx.font = "10px Arial";
  const metadata = [node.shotSize, node.cameraAngle, node.cameraMovement, node.lensFeel].filter(Boolean).join(" / ");
  drawWrappedText(ctx, metadata || node.title, x + 12, y + mediaH + 96, w - 24, 13, 2);
  const summary = node.subjectAction || node.overallPrompt || node.prompt || node.stylePrompt || node.musicPrompt || node.notes || "";
  drawWrappedText(ctx, summary, x + 12, y + mediaH + 130, w - 24, 13, 5);
}

function createPdfCanvas() {
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = 612 * scale;
  canvas.height = 792 * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

function paintPdfPage(ctx) {
  ctx.fillStyle = "#f6f3ec";
  ctx.fillRect(0, 0, 612, 792);
}

function drawPdfCardBox(ctx, x, y, w, h) {
  ctx.fillStyle = "#fffcf5";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawPdfRule(ctx, x, y, w) {
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function drawWrappedText(ctx, text = "", x, y, maxWidth, lineHeight, maxLines = 10) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return y;
  let line = "";
  let lines = 0;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines += 1;
      if (lines >= maxLines) {
        ctx.fillText(`${line.replace(/\.*$/, "")}...`, x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line && lines < maxLines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function loadPdfImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, w, h) {
  const imageRatio = image.width / image.height;
  const boxRatio = w / h;
  const sw = imageRatio > boxRatio ? image.height * boxRatio : image.width;
  const sh = imageRatio > boxRatio ? image.height : image.width / boxRatio;
  const sx = (image.width - sw) / 2;
  const sy = (image.height - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function buildPdfFromJpegPages(pageDataUrls) {
  const imageBytes = pageDataUrls.map(bytesFromDataUrl);
  const pageWidth = 612;
  const pageHeight = 792;
  const objectParts = [];
  const pageRefs = [];
  let objectNumber = 3;

  imageBytes.forEach((bytes, index) => {
    const pageObj = objectNumber;
    const imageObj = objectNumber + 1;
    const contentObj = objectNumber + 2;
    const imageName = `Im${index + 1}`;
    pageRefs.push(`${pageObj} 0 R`);
    objectParts.push([
      pageObj,
      asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`),
    ]);
    objectParts.push([
      imageObj,
      [
        asciiBytes(`<< /Type /XObject /Subtype /Image /Width 1224 /Height 1584 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`),
        bytes,
        asciiBytes("\nendstream"),
      ],
    ]);
    const stream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`;
    objectParts.push([
      contentObj,
      asciiBytes(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`),
    ]);
    objectNumber += 3;
  });

  const objects = [
    [1, asciiBytes("<< /Type /Catalog /Pages 2 0 R >>")],
    [2, asciiBytes(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`)],
    ...objectParts,
  ];
  return buildPdfBlob(objects, 1);
}

function buildPdfBlob(objects, rootObjectNumber) {
  const parts = [asciiBytes("%PDF-1.4\n%\xff\xff\xff\xff\n")];
  const offsets = [0];
  let byteOffset = parts[0].length;
  objects.forEach(([number, content]) => {
    offsets[number] = byteOffset;
    const start = asciiBytes(`${number} 0 obj\n`);
    const body = Array.isArray(content) ? content : [content];
    const end = asciiBytes("\nendobj\n");
    parts.push(start, ...body, end);
    byteOffset += start.length + body.reduce((sum, part) => sum + part.length, 0) + end.length;
  });
  const xrefOffset = byteOffset;
  const maxObject = Math.max(...objects.map(([number]) => number));
  const xrefRows = ["xref", `0 ${maxObject + 1}`, "0000000000 65535 f "];
  for (let number = 1; number <= maxObject; number += 1) {
    xrefRows.push(`${String(offsets[number] || 0).padStart(10, "0")} 00000 n `);
  }
  const trailer = `${xrefRows.join("\n")}\ntrailer\n<< /Size ${maxObject + 1} /Root ${rootObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(asciiBytes(trailer));
  return new Blob(parts, { type: "application/pdf" });
}

function asciiBytes(text) {
  return new TextEncoder().encode(text);
}

async function exportHandoffZip() {
  const button = els.downloadHandoffZipBtn;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Building ZIP...";
  try {
    const files = await buildHandoffPackageFiles();
    const zipBlob = buildZip(files);
    downloadBlob(zipBlob, `${safeSlug(state.title || "master-canvas")}-handoff-package.zip`);
    toast("Handoff ZIP exported");
  } catch (error) {
    console.error(error);
    toast("Could not export handoff ZIP");
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function buildHandoffPackageFiles() {
  const files = [];
  const packageData = buildHandoffData();
  const manifest = packageData.manifest;
  const assetPathById = new Map();
  const usedAssetIds = new Set();

  manifest.scenes.forEach((scene) => {
    scene.shots.forEach((shot) => {
      if (shot.assetId) usedAssetIds.add(shot.assetId);
    });
  });
  manifest.references.forEach((reference) => {
    if (reference.assetId) usedAssetIds.add(reference.assetId);
  });
  manifest.workflows.forEach((workflow) => {
    if (workflow.startAssetId) usedAssetIds.add(workflow.startAssetId);
    if (workflow.endAssetId) usedAssetIds.add(workflow.endAssetId);
    if (workflow.referenceAssetId) usedAssetIds.add(workflow.referenceAssetId);
  });

  state.assets
    .filter((asset) => usedAssetIds.has(asset.id) && asset.dataUrl)
    .forEach((asset) => {
      const sceneKey = sceneKeyForAsset(asset.id) || "references";
      const sceneFolder = sceneFolderName(sceneKey);
      const shot = manifest.shots.find((item) => item.assetId === asset.id);
      const basename = shot ? `${shot.orderLabel || `shot-${shot.globalOrder}`}-${safeSlug(asset.name)}` : `${asset.id}-${safeSlug(asset.name)}`;
      const path = shot ? `assets/${sceneFolder}/${basename}${assetExtension(asset)}` : `assets/references/${basename}${assetExtension(asset)}`;
      assetPathById.set(asset.id, path);
      files.push({ path, data: bytesFromDataUrl(asset.dataUrl) });
    });

  const hydratedManifest = hydrateHandoffAssetPaths(manifest, assetPathById);
  files.push({ path: "README.md", data: buildRootHandoffReadme(hydratedManifest) });
  files.push({ path: "master-canvas-project.json", data: JSON.stringify(exportProject(), null, 2) });
  files.push({ path: "project_manifest.json", data: JSON.stringify(hydratedManifest, null, 2) });
  files.push({ path: "storyboard.html", data: exportStoryboardHtml() });
  files.push({ path: "shot-package.md", data: exportMarkdown() });
  files.push({ path: "timeline/shot_order.csv", data: buildShotOrderCsv(hydratedManifest) });
  files.push({ path: "timeline/scene_bins.json", data: JSON.stringify(buildSceneBins(hydratedManifest), null, 2) });

  files.push({ path: "hermes-agent/README_FOR_HERMES.md", data: buildHermesReadme(hydratedManifest) });
  files.push({ path: "hermes-agent/hermes_job.json", data: JSON.stringify(buildHermesJob(hydratedManifest), null, 2) });
  files.push({ path: "hermes-agent/shot_order.csv", data: buildShotOrderCsv(hydratedManifest) });
  files.push({ path: "hermes-agent/asset_inventory.csv", data: buildAssetInventoryCsv(hydratedManifest) });

  files.push({ path: "comfyui/README_COMFYUI_LTX23.md", data: buildComfyReadme(hydratedManifest) });
  files.push({ path: "comfyui/shot_manifest_ltx23.json", data: JSON.stringify(buildComfyManifest(hydratedManifest), null, 2) });
  files.push({ path: "comfyui/workflow_templates/ltx23_adapter_template.json", data: JSON.stringify(buildComfyAdapterTemplate(), null, 2) });
  hydratedManifest.shots.forEach((shot) => {
    files.push({
      path: `comfyui/jobs/${sceneFolderName(shot.sceneKey)}/${shot.orderLabel || `shot-${shot.globalOrder}`}.json`,
      data: JSON.stringify(buildComfyShotJob(shot, hydratedManifest), null, 2),
    });
  });

  files.push({ path: "kling-veo/README_KLING_VEO.md", data: buildKlingVeoReadme(hydratedManifest) });
  files.push({ path: "kling-veo/shot_checklist.csv", data: buildShotOrderCsv(hydratedManifest) });
  hydratedManifest.shots.forEach((shot) => {
    const folder = `kling-veo/prompts/${sceneFolderName(shot.sceneKey)}`;
    files.push({ path: `${folder}/${shot.orderLabel || `shot-${shot.globalOrder}`}_prompt.txt`, data: buildOperatorPromptText(shot) });
    files.push({ path: `${folder}/${shot.orderLabel || `shot-${shot.globalOrder}`}_negative.txt`, data: shot.negativePrompt || "" });
  });

  files.push({ path: "deliverables/bin_plan.json", data: JSON.stringify(buildDeliverableBinPlan(hydratedManifest), null, 2) });
  return files;
}

function buildHandoffData() {
  const continuity = { ...defaultContinuity(), ...(state.continuity || {}) };
  const sceneKeys = orderedSceneKeysForExport();
  const scenes = sceneKeys.map((sceneKey) => {
    const sceneNode = state.nodes
      .filter((node) => getSceneKey(node) === sceneKey && (node.type === "scene" || node.type === "shot" || node.type === "section"))
      .sort(sortNodesByCanvasOrder)[0];
    const mediaNodes = state.nodes
      .filter((node) => node.type === "media" && getSceneKey(node) === sceneKey)
      .sort(sortNodesByCanvasOrder);
    return {
      sceneKey,
      sceneNumber: sceneNumberFromKey(sceneKey) || "",
      title: sceneNode?.title || sceneKey,
      orderLabel: sceneNode?.shotOrderLabel || sceneKey,
      description: sceneNode?.overallPrompt || sceneNode?.notes || "",
      stylePrompt: sceneNode?.stylePrompt || "",
      musicPrompt: sceneNode?.musicPrompt || "",
      notes: sceneNode?.notes || "",
      shots: mediaNodes.map((node, index) => buildHandoffShot(node, sceneKey, index)),
    };
  });
  const shots = scenes.flatMap((scene) => scene.shots);
  shots.forEach((shot, index) => {
    shot.globalOrder = index + 1;
    shot.globalOrderLabel = String(index + 1).padStart(2, "0");
  });
  const workflows = state.nodes.filter(isWorkflowNode).sort(sortNodesByCanvasOrder).map(buildHandoffWorkflow);
  const references = buildHandoffReferences();
  return {
    manifest: {
      schema: "master-canvas-handoff-v1",
      title: state.title,
      projectId: state.id,
      exportedAt: now(),
      intent:
        "Self-contained pre-production handoff for Hermes Agent, ComfyUI LTX 2.3, Kling, Veo, and human operators. Preserve shot order, scene bins, assets, prompts, negative prompts, references, and continuity.",
      targetGeneration: {
        primary: "ComfyUI with LTX 2.3",
        alternates: ["Veo", "Kling"],
        minimumResolution: "1080p",
        aspectRatio: "16:9",
        delivery: "Organize outputs into bins by scene number and return best takes plus notes.",
      },
      continuity,
      scenes,
      shots,
      workflows,
      references,
      assets: state.assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        mime: asset.mime,
        size: asset.size,
        tags: asset.tags || "",
        notes: asset.notes || "",
        externalUrl: asset.externalUrl || "",
      })),
    },
  };
}

function buildHandoffShot(node, sceneKey, index) {
  const asset = assetById(node.assetId);
  const label = node.shotOrderLabel || `${sceneKey.replace(/\s+/g, "")}-${String(index + 1).padStart(2, "0")}`;
  return {
    id: node.id,
    nodeId: node.id,
    assetId: node.assetId || "",
    assetName: asset?.name || "",
    sceneKey,
    sceneNumber: sceneNumberFromKey(sceneKey) || "",
    shotNumber: index + 1,
    orderLabel: label,
    beatTitle: node.shotBeatTitle || label,
    title: node.title,
    status: node.status || "",
    prompt: node.prompt || "",
    negativePrompt: node.negativePrompt || "",
    notes: node.notes || "",
    tags: node.tags || "",
    shotSize: node.shotSize || "",
    cameraAngle: node.cameraAngle || "",
    cameraMovement: node.cameraMovement || "",
    subjectAction: node.subjectAction || "",
    location: node.location || "",
    mood: node.mood || "",
    lighting: node.lighting || "",
    lensFeel: node.lensFeel || "",
    provider: node.provider || "",
    model: node.model || "",
    aspectRatio: node.aspectRatio || "16:9",
    resolution: normalizeResolution(node.resolution || "1080p"),
    duration: node.duration || defaultDurationForScene(sceneKey),
    seed: node.seed || "",
    reviewDecision: node.reviewDecision || "",
    reviewNotes: node.reviewNotes || "",
    sourcePath: "",
    outputBin: `renders/${sceneFolderName(sceneKey)}`,
  };
}

function buildHandoffWorkflow(node) {
  return {
    id: node.id,
    title: node.title,
    sceneKey: getSceneKey(node) || "",
    status: node.status || "",
    provider: node.provider || "",
    model: node.model || "",
    prompt: node.prompt || "",
    negativePrompt: node.negativePrompt || "",
    startAssetId: node.startAssetId || "",
    endAssetId: node.endAssetId || "",
    referenceAssetId: node.referenceAssetId || "",
    aspectRatio: node.aspectRatio || "",
    resolution: normalizeResolution(node.resolution || "1080p"),
    duration: node.duration || "",
    seed: node.seed || "",
    notes: node.notes || "",
  };
}

function buildHandoffReferences() {
  const assetRefs = state.assets
    .filter((asset) => asset.type === "video-link" || asset.type === "music-link" || asset.type === "reference-link" || asset.type === "audio" || asset.type === "video")
    .map((asset) => ({
      id: asset.id,
      assetId: asset.id,
      title: asset.name,
      type: asset.type,
      externalUrl: asset.externalUrl || "",
      tags: asset.tags || "",
      notes: asset.notes || "",
      sourcePath: "",
    }));
  const cardRefs = state.nodes
    .filter((node) => node.type === "styleRef" || node.type === "musicRef")
    .map((node) => {
      const asset = assetById(node.referenceAssetId);
      return {
        id: node.id,
        assetId: asset?.id || "",
        title: node.title,
        type: node.type,
        externalUrl: node.referenceUrl || asset?.externalUrl || "",
        sourcePath: "",
        influenceUse: node.influenceUse || "",
        influenceStrength: node.influenceStrength || "",
        color: node.influenceColor || "",
        pacing: node.influencePacing || "",
        camera: node.influenceCamera || "",
        lighting: node.influenceLighting || "",
        doNotCopy: node.doNotCopy || "",
        prompt: node.stylePrompt || node.musicPrompt || "",
        notes: node.notes || "",
      };
    });
  return [...assetRefs, ...cardRefs];
}

function hydrateHandoffAssetPaths(manifest, assetPathById) {
  const cloned = JSON.parse(JSON.stringify(manifest));
  cloned.shots.forEach((shot) => {
    shot.sourcePath = assetPathById.get(shot.assetId) || "";
  });
  cloned.scenes.forEach((scene) => {
    scene.shots.forEach((shot) => {
      shot.sourcePath = assetPathById.get(shot.assetId) || "";
    });
  });
  cloned.workflows.forEach((workflow) => {
    workflow.startAssetPath = assetPathById.get(workflow.startAssetId) || "";
    workflow.endAssetPath = assetPathById.get(workflow.endAssetId) || "";
    workflow.referenceAssetPath = assetPathById.get(workflow.referenceAssetId) || "";
  });
  cloned.references.forEach((reference) => {
    reference.sourcePath = assetPathById.get(reference.assetId) || "";
  });
  cloned.assets.forEach((asset) => {
    asset.sourcePath = assetPathById.get(asset.id) || "";
  });
  return cloned;
}

function orderedSceneKeysForExport() {
  const discovered = [...new Set(state.nodes.map((node) => getSceneKey(node)).filter(Boolean))];
  return discovered.sort((a, b) => {
    const aNode = state.nodes.find((node) => getSceneKey(node) === a);
    const bNode = state.nodes.find((node) => getSceneKey(node) === b);
    return sortNodesByCanvasOrder(aNode || {}, bNode || {});
  });
}

function buildRootHandoffReadme(manifest) {
  return `# ${manifest.title} - Handoff Package

Exported: ${manifest.exportedAt}

This package contains everything needed to generate the project from the Master Canvas:

- \`project_manifest.json\`: full structured source of truth
- \`assets/\`: source images, video, and audio references used by the shot cards
- \`timeline/shot_order.csv\`: scene and shot order for editorial/generation tracking
- \`hermes-agent/\`: task brief and JSON job packet for Hermes Agent
- \`comfyui/\`: LTX 2.3 ComfyUI shot manifest and per-shot jobs
- \`kling-veo/\`: human-operator prompts and checklist for Kling or Veo
- \`storyboard.html\`: visual storyboard handoff
- \`shot-package.md\`: readable prompt package

Primary target: ComfyUI with LTX 2.3 at 1080p or better.

Important rule: preserve scene order and shot order. Outputs should be organized into bins by scene number, then returned with best takes, rejected takes, seeds/settings, and notes.`;
}

function buildHermesReadme(manifest) {
  return `# Hermes Agent Brief

You are receiving a Master Canvas handoff package. Use the files here as the complete context for the project.

Goal:
Generate all shots using ComfyUI with LTX 2.3 at minimum 1080p quality, preserving the exact story order, prompts, negative prompts, image references, continuity bible, style direction, music/sound references, and scene bins.

Instructions:
1. Read \`../project_manifest.json\` first.
2. Read \`hermes_job.json\` for the task plan.
3. Use \`../comfyui/shot_manifest_ltx23.json\` and \`../comfyui/jobs/\` as the ComfyUI import/batch plan.
4. For every shot, use the listed source image path, prompt, negative prompt, lens, lighting, camera movement, action, duration, and resolution.
5. Generate at 1080p minimum. Prefer higher quality if the local ComfyUI setup supports it.
6. Organize rendered outputs into bins exactly like \`renders/scene-01\`, \`renders/scene-02\`, etc.
7. Return best takes plus generation settings, seeds, notes, and any manual adjustments needed.

Do not reinterpret the concept into a different story. Use the Master Canvas as the source of truth.`;
}

function buildHermesJob(manifest) {
  return {
    agent: "Hermes",
    source: "Master Canvas handoff package",
    task: "Generate all shots in ComfyUI using LTX 2.3 and return organized scene bins.",
    qualityFloor: manifest.targetGeneration.minimumResolution,
    primaryEngine: manifest.targetGeneration.primary,
    continuity: manifest.continuity,
    inputs: {
      projectManifest: "../project_manifest.json",
      comfyManifest: "../comfyui/shot_manifest_ltx23.json",
      shotOrderCsv: "shot_order.csv",
      assetInventoryCsv: "asset_inventory.csv",
    },
    requiredOutputBins: buildDeliverableBinPlan(manifest),
    shots: manifest.shots.map((shot) => ({
      sceneKey: shot.sceneKey,
      orderLabel: shot.orderLabel,
      sourcePath: shot.sourcePath,
      prompt: shot.prompt,
      negativePrompt: shot.negativePrompt,
      lensFeel: shot.lensFeel,
      lighting: shot.lighting,
      cameraMovement: shot.cameraMovement,
      duration: shot.duration,
      resolution: shot.resolution,
      outputBin: shot.outputBin,
    })),
  };
}

function buildComfyReadme(manifest) {
  return `# ComfyUI LTX 2.3 Handoff

This folder is built for a ComfyUI operator or agent. Because ComfyUI node graphs differ by installed custom nodes, the included files are adapter jobs rather than a hardcoded graph that assumes one local setup.

Use:
- \`shot_manifest_ltx23.json\` for the full batch plan.
- \`jobs/scene-XX/*.json\` for one job per shot.
- \`workflow_templates/ltx23_adapter_template.json\` as the mapping contract for an LTX 2.3 image-to-video graph.

Recommended setup:
- Model: LTX 2.3 image-to-video
- Resolution: 1920x1080 or higher
- Aspect: 16:9
- Use source image as first/reference frame
- Preserve prompt and negative prompt exactly unless a manual quality adjustment is needed
- Save outputs to the outputBin listed for each shot

If a local graph uses different node names, map fields from each job JSON into the matching nodes.`;
}

function buildComfyManifest(manifest) {
  return {
    engine: "ComfyUI",
    model: "LTX 2.3 image-to-video",
    resolution: "1920x1080",
    aspectRatio: "16:9",
    scenes: manifest.scenes.map((scene) => ({
      sceneKey: scene.sceneKey,
      sceneNumber: scene.sceneNumber,
      outputBin: `renders/${sceneFolderName(scene.sceneKey)}`,
      description: scene.description,
      stylePrompt: scene.stylePrompt,
      musicPrompt: scene.musicPrompt,
      shots: scene.shots.map((shot) => buildComfyShotJob(shot, manifest)),
    })),
  };
}

function buildComfyShotJob(shot, manifest) {
  return {
    engine: "ComfyUI",
    model: "LTX 2.3 image-to-video",
    projectTitle: manifest.title,
    sceneKey: shot.sceneKey,
    sceneNumber: shot.sceneNumber,
    shotNumber: shot.shotNumber,
    orderLabel: shot.orderLabel,
    sourceImage: shot.sourcePath,
    outputBin: shot.outputBin,
    outputName: `${shot.orderLabel || `shot-${shot.globalOrderLabel}`}-${safeSlug(shot.beatTitle || shot.title)}`,
    settings: {
      aspectRatio: shot.aspectRatio || "16:9",
      resolution: normalizeResolution(shot.resolution || "1080p"),
      duration: shot.duration,
      seed: shot.seed || "auto",
      fps: 24,
      qualityTarget: "1080p minimum, prefer higher if stable",
    },
    prompt: shot.prompt,
    negativePrompt: shot.negativePrompt,
    camera: {
      shotSize: shot.shotSize,
      angle: shot.cameraAngle,
      movement: shot.cameraMovement,
      lens: shot.lensFeel,
      lighting: shot.lighting,
      action: shot.subjectAction,
    },
    continuity: manifest.continuity,
    notes: shot.notes,
  };
}

function buildComfyAdapterTemplate() {
  return {
    name: "LTX 2.3 image-to-video adapter template",
    purpose: "Map each comfyui/jobs/* shot JSON into the installed local LTX 2.3 ComfyUI graph.",
    requiredInputs: {
      sourceImage: "LoadImage or equivalent first-frame/reference-image input",
      prompt: "Positive prompt text node",
      negativePrompt: "Negative prompt text node",
      resolution: "Width/height or preset node, 1920x1080 recommended",
      duration: "Frame count or seconds field depending on local LTX node",
      seed: "Seed field, auto allowed unless retrying",
      outputName: "SaveVideo/SaveImage filename prefix",
      outputBin: "Output folder/bin target",
    },
    recommendedDefaults: {
      fps: 24,
      aspectRatio: "16:9",
      resolution: "1920x1080",
      guidance: "Use local LTX 2.3 best-practice defaults, then adjust motion strength per shot.",
    },
  };
}

function buildKlingVeoReadme(manifest) {
  return `# Kling / Veo Operator Package

Use this folder if a person is generating clips manually in Kling or Veo.

Workflow:
1. Open \`shot_checklist.csv\`.
2. Work in order from the top down.
3. For each shot, upload the source image listed in the CSV.
4. Paste the matching prompt from \`prompts/scene-XX/\`.
5. Paste the matching negative prompt where the tool supports it. If the tool has no negative prompt field, use it as an avoid/quality checklist.
6. Generate at 1080p or better.
7. Save outputs into scene bins using the output bin in the CSV.
8. Log which take wins and what settings were used.

The operator should preserve the prompts unless a manual adjustment is needed to improve accuracy or quality.`;
}

function buildOperatorPromptText(shot) {
  return `Shot: ${shot.orderLabel} - ${shot.beatTitle || shot.title}
Scene: ${shot.sceneKey}
Source image: ${shot.sourcePath}
Output bin: ${shot.outputBin}
Resolution: ${shot.resolution}
Duration: ${shot.duration}

Prompt:
${shot.prompt}

Lens: ${shot.lensFeel}
Lighting: ${shot.lighting}
Camera movement: ${shot.cameraMovement}
Action: ${shot.subjectAction}
Sound/dialogue: included in prompt if needed.`;
}

function buildShotOrderCsv(manifest) {
  const rows = [
    [
      "global_order",
      "scene",
      "scene_number",
      "shot_number",
      "order_label",
      "beat_title",
      "source_path",
      "output_bin",
      "duration",
      "resolution",
      "lens",
      "lighting",
      "camera_movement",
      "prompt_path",
      "negative_prompt_path",
    ],
  ];
  manifest.shots.forEach((shot) => {
    rows.push([
      shot.globalOrderLabel || String(shot.globalOrder || ""),
      shot.sceneKey,
      shot.sceneNumber,
      shot.shotNumber,
      shot.orderLabel,
      shot.beatTitle,
      shot.sourcePath,
      shot.outputBin,
      shot.duration,
      shot.resolution,
      shot.lensFeel,
      shot.lighting,
      shot.cameraMovement,
      `kling-veo/prompts/${sceneFolderName(shot.sceneKey)}/${shot.orderLabel}_prompt.txt`,
      `kling-veo/prompts/${sceneFolderName(shot.sceneKey)}/${shot.orderLabel}_negative.txt`,
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildAssetInventoryCsv(manifest) {
  const rows = [["asset_id", "name", "type", "mime", "source_path", "tags", "notes", "external_url"]];
  manifest.assets.forEach((asset) => {
    rows.push([asset.id, asset.name, asset.type, asset.mime, asset.sourcePath, asset.tags, asset.notes, asset.externalUrl]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function buildSceneBins(manifest) {
  return manifest.scenes.map((scene) => ({
    sceneKey: scene.sceneKey,
    sceneNumber: scene.sceneNumber,
    bin: `renders/${sceneFolderName(scene.sceneKey)}`,
    shots: scene.shots.map((shot) => shot.orderLabel),
  }));
}

function buildDeliverableBinPlan(manifest) {
  return {
    root: "renders",
    bins: buildSceneBins(manifest),
    expectedFiles: manifest.shots.map((shot) => ({
      orderLabel: shot.orderLabel,
      sceneKey: shot.sceneKey,
      bin: shot.outputBin,
      filenamePrefix: `${shot.orderLabel}-${safeSlug(shot.beatTitle || shot.title)}`,
    })),
  };
}

function sceneKeyForAsset(assetId) {
  const node = state.nodes.find((item) => item.type === "media" && item.assetId === assetId);
  return node ? getSceneKey(node) : "";
}

function sceneFolderName(sceneKey = "scene") {
  if (sceneNumberFromKey(sceneKey)) return `scene-${String(sceneNumberFromKey(sceneKey)).padStart(2, "0")}`;
  return safeSlug(sceneKey || "references");
}

function defaultDurationForScene(sceneKey) {
  if (sceneKey === "Text Card - Between Scene 4 and 5") return "4s";
  if (sceneKey === "Ending Text Card") return "5s";
  return "6s";
}

function normalizeResolution(value = "1080p") {
  if (String(value).toLowerCase() === "1080p") return "1920x1080";
  if (String(value).toLowerCase() === "720p") return "1280x720";
  if (String(value).toLowerCase() === "4k") return "3840x2160";
  return value;
}

function assetExtension(asset) {
  const fromName = String(asset.name || "").match(/\.[a-z0-9]{2,5}$/i)?.[0];
  if (fromName) return fromName.toLowerCase();
  if (asset.mime?.includes("png")) return ".png";
  if (asset.mime?.includes("jpeg") || asset.mime?.includes("jpg")) return ".jpg";
  if (asset.mime?.includes("webp")) return ".webp";
  if (asset.mime?.includes("mp4")) return ".mp4";
  if (asset.mime?.includes("mpeg")) return ".mp3";
  if (asset.mime?.includes("wav")) return ".wav";
  return ".bin";
}

function safeSlug(value = "item") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "item";
}

function csvCell(value = "") {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function bytesFromDataUrl(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function buildZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.path);
    const data = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, zipTime(), true);
    localView.setUint16(12, zipDate(), true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, zipTime(), true);
    centralView.setUint16(14, zipDate(), true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
}

function crc32(bytes) {
  let crc = -1;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[index]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function zipTime() {
  const date = new Date();
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function zipDate() {
  const date = new Date();
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toast(message) {
  const existing = document.querySelector(".toast");
  existing?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  setTimeout(() => node.remove(), 1800);
}

boot().catch((error) => {
  console.error(error);
  toast("Could not start local canvas");
});
