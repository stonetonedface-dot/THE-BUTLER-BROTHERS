import { GoogleDriveClient, GoogleDriveError } from './google-drive.js?v=20261002-drive';
import { disposeObject3D, ModelLoader, displayName } from './viewer-loader.js?v=20261002d';
import { ViewerScene } from './viewer-controls.js?v=20261002d';
import { ViewerUI } from './viewer-ui.js?v=20261002d';

const GOOGLE_CLIENT_ID = '975176995240-3esbvb8k73sjtl5ar169pkcbcgfattn3.apps.googleusercontent.com';

const root = document.querySelector('[data-viewer-root]');
const stage = root.querySelector('[data-viewer-stage]');
const scene = new ViewerScene(root.querySelector('[data-viewer-canvas]'));
const loader = new ModelLoader();
const ui = new ViewerUI(root);
const fileInput = root.querySelector('[data-model-file]');
const urlInput = root.querySelector('[data-model-url]');
const urlButton = root.querySelector('[data-load-url]');
const autoRotate = root.querySelector('[data-auto-rotate]');
const lighting = root.querySelector('[data-lighting]');
const loopControl = root.querySelector('[data-animation-loop]');
const drive = new GoogleDriveClient(GOOGLE_CLIENT_ID);
const driveConnect = root.querySelector('[data-drive-connect]');
const driveActions = root.querySelector('[data-drive-actions]');
const driveSelectFolder = root.querySelector('[data-drive-select-folder]');
const driveBack = root.querySelector('[data-drive-back]');
const driveState = root.querySelector('[data-drive-state]');
const driveAccount = root.querySelector('[data-drive-account]');
const driveMessage = root.querySelector('[data-drive-message]');
const driveBrowser = root.querySelector('[data-drive-browser]');
const driveLocation = root.querySelector('[data-drive-location]');
const driveFolders = root.querySelector('[data-drive-folders]');
const driveModels = root.querySelector('[data-drive-models]');
let currentRoot = null;
let clips = [];
let driveFolder = null;
let driveFolderAssets = [];
const driveTrail = [];

const materialsFrom = (model) => {
  const found = new Map();
  model.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      if (!found.has(material.uuid)) found.set(material.uuid, material);
    });
  });
  return [...found.values()];
};

const setBusy = (busy) => {
  fileInput.disabled = busy;
  urlInput.disabled = busy;
  urlButton.disabled = busy;
};

const setDriveBusy = (busy) => {
  driveConnect.disabled = busy;
  driveSelectFolder.disabled = busy;
  driveBack.disabled = busy;
  driveFolders.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  driveModels.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
};

const setDriveMessage = (message, error = false) => {
  driveMessage.textContent = message;
  driveMessage.classList.toggle('is-error', error);
};

const activateAnimation = (clip) => {
  scene.playClip(clip);
  ui.setStatus(`PLAYING / ${clip.name || 'UNNAMED ANIMATION'}`, 'loaded');
};

const acceptModel = ({ gltf, source }) => {
  const oldRoot = currentRoot;
  currentRoot = gltf.scene;
  clips = gltf.animations || [];
  scene.setModel(currentRoot, clips);
  disposeObject3D(oldRoot);
  const materials = materialsFrom(currentRoot);
  ui.setLoaded(true);
  ui.setInfo({ name: displayName(source.name), format: source.format, size: source.size || null, animations: clips.length, materials: materials.length });
  ui.setAnimations(clips, activateAnimation);
  ui.setMaterials(materials);
  ui.setModelControls(true);
  ui.setAnimationControls(Boolean(clips.length));
  const origin = source.drive ? 'GOOGLE DRIVE' : source.local ? 'LOCAL FILE' : 'REMOTE URL';
  ui.setStatus(`MODEL READY / ${source.format} / ${origin}`, 'loaded');
  ui.setProgress(null);
};

const showError = (error, remote = false) => {
  console.error(error);
  const message = remote
    ? 'UNABLE TO LOAD MODEL. THE SERVER MAY NOT ALLOW CROSS-ORIGIN REQUESTS.'
    : error?.message || 'MODEL LOAD FAILED. CHECK THE FILE AND TRY AGAIN.';
  ui.setProgress(null);
  ui.setStatus(message.toUpperCase(), 'error');
};

const loadLocal = async (files) => {
  if (!files?.length) return ui.setStatus('NO MODEL SELECTED.', 'error');
  setBusy(true);
  ui.setStatus('LOADING LOCAL MODEL...', 'loading');
  ui.setProgress(18);
  try {
    const result = await loader.loadLocal(files);
    ui.setProgress(86);
    acceptModel(result);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
    fileInput.value = '';
  }
};

const loadRemote = async () => {
  const url = urlInput.value.trim();
  if (!url) return ui.setStatus('NO MODEL URL PROVIDED.', 'error');
  let parsed;
  try { parsed = new URL(url); } catch { return ui.setStatus('INVALID MODEL URL.', 'error'); }
  if (!/^https?:$/.test(parsed.protocol)) return ui.setStatus('MODEL URL MUST USE HTTP OR HTTPS.', 'error');

  setBusy(true);
  ui.setStatus('LOADING MODEL...', 'loading');
  ui.setProgress(4);
  try {
    const result = await loader.loadRemote(url, (event) => {
      if (event.lengthComputable) ui.setProgress((event.loaded / event.total) * 100);
      else ui.setProgress(45);
    });
    acceptModel(result);
  } catch (error) {
    showError(error, true);
  } finally {
    setBusy(false);
  }
};

const reportDriveError = (error, fallback = 'MODEL LOAD FAILED.') => {
  console.error(error);
  let message = fallback;
  if (error instanceof GoogleDriveError) {
    if (error.code === 'NOT_CONNECTED') message = 'GOOGLE DRIVE NOT CONNECTED.';
    if (error.code === 'ACCESS_DENIED') message = 'GOOGLE DRIVE ACCESS DENIED.';
    if (error.code === 'AUTH_FAILED' || error.code === 'GIS_UNAVAILABLE') message = 'GOOGLE AUTHORIZATION FAILED.';
    if (error.code === 'API_DISABLED') message = 'GOOGLE DRIVE API IS NOT ENABLED. ENABLE IT IN GOOGLE CLOUD CONSOLE.';
    if (error.code === 'NETWORK_BLOCKED') message = 'MODEL LOAD FAILED. GOOGLE DRIVE MAY HAVE BLOCKED THIS FILE.';
  }
  setDriveMessage(message, true);
  ui.setStatus(message, 'error');
  ui.setProgress(null);
};

const clearDriveList = (list) => list.replaceChildren();

const makeDriveButton = (label, marker, handler) => {
  const button = document.createElement('button');
  const name = document.createElement('span');
  const hint = document.createElement('b');
  button.type = 'button';
  name.textContent = label;
  hint.textContent = marker;
  button.append(name, hint);
  button.addEventListener('click', handler);
  return button;
};

const renderDriveContents = (contents) => {
  clearDriveList(driveFolders);
  clearDriveList(driveModels);
  contents.folders.forEach((folder) => {
    const item = document.createElement('li');
    item.append(makeDriveButton(`FOLDER / ${folder.name}`, '→', () => openDriveFolder(folder, true)));
    driveFolders.append(item);
  });

  if (!contents.models.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-panel';
    empty.textContent = 'NO 3D MODELS FOUND';
    driveModels.append(empty);
  } else {
    contents.models.forEach((model) => {
      const item = document.createElement('li');
      item.append(makeDriveButton(model.name, 'LOAD', () => loadDriveModel(model)));
      driveModels.append(item);
    });
  }
};

const openDriveFolder = async (folder, addToTrail = false) => {
  if (!drive.connected) return reportDriveError(new GoogleDriveError('NOT_CONNECTED', 'GOOGLE DRIVE NOT CONNECTED.'));
  setDriveBusy(true);
  setDriveMessage('LOADING FOLDER CONTENTS...');
  try {
    const contents = await drive.listFolderContents(folder.id);
    if (addToTrail && driveFolder) driveTrail.push(driveFolder);
    driveFolder = folder;
    driveFolderAssets = contents.assets;
    driveLocation.textContent = `FOLDERS / ${folder.name}`;
    driveBack.hidden = !driveTrail.length;
    driveBrowser.hidden = false;
    renderDriveContents(contents);
    setDriveMessage(contents.models.length ? 'SELECT A 3D MODEL TO LOAD.' : 'NO 3D MODELS FOUND.');
    ui.setStatus(contents.models.length ? 'GOOGLE DRIVE FOLDER READY.' : 'NO 3D MODELS FOUND.', contents.models.length ? 'loaded' : 'ready');
  } catch (error) {
    reportDriveError(error, 'MODEL LOAD FAILED.');
  } finally {
    setDriveBusy(false);
  }
};

const loadDriveModel = async (model) => {
  if (!drive.connected) return reportDriveError(new GoogleDriveError('NOT_CONNECTED', 'GOOGLE DRIVE NOT CONNECTED.'));
  setBusy(true);
  setDriveBusy(true);
  ui.setStatus('LOADING GOOGLE DRIVE MODEL...', 'loading');
  ui.setProgress(7);
  setDriveMessage(`LOADING / ${model.name}`);
  try {
    const files = await drive.downloadModelBundle(model, driveFolderAssets, (loaded, total) => {
      ui.setProgress(total ? Math.min(82, (loaded / total) * 82) : 48);
    });
    ui.setProgress(86);
    const result = await loader.loadLocal(files);
    result.source.drive = true;
    acceptModel(result);
    setDriveMessage(`LOADED / ${model.name}`);
  } catch (error) {
    reportDriveError(error, 'MODEL LOAD FAILED.');
  } finally {
    setBusy(false);
    setDriveBusy(false);
  }
};

const connectGoogleDrive = async () => {
  setDriveBusy(true);
  driveState.textContent = 'CONNECTING';
  setDriveMessage('OPENING GOOGLE AUTHORIZATION...');
  try {
    const account = await drive.connect();
    const identity = [account.name, account.email].filter(Boolean).join(' / ');
    driveState.textContent = 'CONNECTED';
    driveAccount.textContent = `GOOGLE DRIVE CONNECTED${identity ? ` / ${identity}` : ''}`;
    driveAccount.classList.add('is-connected');
    driveActions.hidden = false;
    driveConnect.innerHTML = 'RECONNECT GOOGLE DRIVE <b>↻</b>';
    setDriveMessage('SELECT FOLDER TO BROWSE 3D MODELS.');
    ui.setStatus('GOOGLE DRIVE CONNECTED.', 'loaded');
  } catch (error) {
    driveState.textContent = 'OFFLINE';
    driveAccount.textContent = 'GOOGLE DRIVE NOT CONNECTED';
    driveAccount.classList.remove('is-connected');
    reportDriveError(error, 'GOOGLE AUTHORIZATION FAILED.');
  } finally {
    setDriveBusy(false);
  }
};

fileInput.addEventListener('change', () => loadLocal(fileInput.files));
urlButton.addEventListener('click', loadRemote);
urlInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadRemote(); });
driveConnect.addEventListener('click', connectGoogleDrive);
driveSelectFolder.addEventListener('click', () => {
  driveTrail.length = 0;
  openDriveFolder({ id: 'root', name: 'MY DRIVE' });
});
driveBack.addEventListener('click', () => {
  const parent = driveTrail.pop();
  if (parent) openDriveFolder(parent);
});
root.querySelector('[data-reset-camera]').addEventListener('click', () => { scene.resetCamera(); ui.setStatus('CAMERA RESET.', 'loaded'); });
autoRotate.addEventListener('click', () => {
  const active = autoRotate.getAttribute('aria-pressed') !== 'true';
  autoRotate.setAttribute('aria-pressed', String(active));
  autoRotate.querySelector('b').textContent = active ? '●' : '○';
  scene.setAutoRotate(active);
  ui.setStatus(active ? 'AUTO ROTATE ENABLED.' : 'AUTO ROTATE DISABLED.', 'loaded');
});
lighting.addEventListener('click', () => {
  const mode = scene.cycleLighting();
  lighting.querySelector('b').textContent = String(mode).padStart(2, '0');
  ui.setStatus(`LIGHTING PROFILE ${String(mode).padStart(2, '0')} ACTIVE.`, 'loaded');
});
root.querySelector('[data-animation-play]').addEventListener('click', () => {
  if (!scene.currentAction && clips[0]) activateAnimation(clips[0]);
  else scene.resumeAnimation();
});
root.querySelector('[data-animation-pause]').addEventListener('click', () => scene.pauseAnimation());
root.querySelector('[data-animation-stop]').addEventListener('click', () => scene.stopAnimation());
loopControl.addEventListener('change', () => scene.setLoop(loopControl.checked));

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  } catch (error) { showError(new Error('FULLSCREEN IS NOT AVAILABLE IN THIS BROWSER.')); }
};
root.querySelector('[data-fullscreen]').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const button = root.querySelector('[data-fullscreen]');
  button.innerHTML = document.fullscreenElement ? 'EXIT FULLSCREEN <b>×</b>' : 'FULLSCREEN <b>↗</b>';
  window.setTimeout(() => scene.resize(), 20);
});

['dragenter', 'dragover'].forEach((type) => stage.addEventListener(type, (event) => {
  event.preventDefault();
  stage.classList.add('is-dragging');
}));
['dragleave', 'drop'].forEach((type) => stage.addEventListener(type, (event) => {
  event.preventDefault();
  stage.classList.remove('is-dragging');
}));
stage.addEventListener('drop', (event) => loadLocal(event.dataTransfer.files));
window.addEventListener('pagehide', () => {
  disposeObject3D(currentRoot);
  loader.clearLocalResources();
  scene.destroy();
});
