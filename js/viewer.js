import { disposeObject3D, ModelLoader, displayName } from './viewer-loader.js?v=20261002d';
import { ViewerScene } from './viewer-controls.js?v=20261002d';
import { ViewerUI } from './viewer-ui.js?v=20261002d';

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
let currentRoot = null;
let clips = [];

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
  ui.setInfo({ name: displayName(source.name), format: source.format, size: source.local ? source.size : null, animations: clips.length, materials: materials.length });
  ui.setAnimations(clips, activateAnimation);
  ui.setMaterials(materials);
  ui.setModelControls(true);
  ui.setAnimationControls(Boolean(clips.length));
  ui.setStatus(`MODEL READY / ${source.format} / ${source.local ? 'LOCAL FILE' : 'REMOTE URL'}`, 'loaded');
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

fileInput.addEventListener('change', () => loadLocal(fileInput.files));
urlButton.addEventListener('click', loadRemote);
urlInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadRemote(); });
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
