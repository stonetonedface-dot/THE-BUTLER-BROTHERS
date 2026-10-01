export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes)) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
};

export class ViewerUI {
  constructor(root) {
    this.root = root;
    this.empty = root.querySelector('[data-viewer-empty]');
    this.status = root.querySelector('[data-viewer-status]');
    this.state = root.querySelector('[data-viewer-state]');
    this.progress = root.querySelector('[data-viewer-progress]');
    this.progressBar = root.querySelector('[data-viewer-progress-bar]');
    this.animationList = root.querySelector('[data-animation-list]');
    this.materialList = root.querySelector('[data-material-list]');
    this.animationCount = root.querySelector('[data-animation-count]');
    this.materialCount = root.querySelector('[data-material-count]');
  }

  setStatus(message, type = 'ready') {
    this.status.textContent = message;
    this.status.className = `viewer-status${type === 'error' ? ' is-error' : type === 'loading' ? ' is-loading' : ''}`;
    this.state.textContent = type === 'loading' ? 'LOADING' : type === 'error' ? 'ERROR' : type === 'loaded' ? 'ONLINE' : 'STANDBY';
  }

  setProgress(value = null) {
    const active = value !== null;
    this.progress.classList.toggle('is-active', active);
    this.progressBar.style.width = active ? `${Math.max(3, Math.min(value, 100))}%` : '0%';
  }

  setLoaded(loaded) { this.empty.classList.toggle('is-hidden', loaded); }

  setInfo(info) {
    const assign = (key, value) => {
      const row = this.root.querySelector(`[data-info-${key}]`);
      const destination = this.root.querySelector(`[data-model-${key}]`);
      row.hidden = value === null || value === undefined || value === '';
      if (destination && !row.hidden) destination.textContent = value;
    };
    assign('name', info.name || '—');
    assign('format', info.format || '—');
    assign('size', info.size ? formatBytes(info.size) : null);
    assign('animations', Number.isFinite(info.animations) ? String(info.animations) : null);
    assign('materials', Number.isFinite(info.materials) ? String(info.materials) : null);
  }

  setAnimations(clips, onSelect) {
    this.animationCount.textContent = String(clips.length).padStart(2, '0');
    this.animationList.replaceChildren();
    if (!clips.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-panel';
      empty.textContent = 'NO ANIMATIONS FOUND';
      this.animationList.append(empty);
      return;
    }
    clips.forEach((clip, index) => {
      const button = document.createElement('button');
      const label = document.createElement('span');
      const duration = document.createElement('b');
      button.type = 'button';
      label.textContent = `▶ ${clip.name || `ANIMATION ${String(index + 1).padStart(2, '0')}`}`;
      duration.textContent = `${clip.duration.toFixed(1)}S`;
      button.append(label, duration);
      button.addEventListener('click', () => {
        this.animationList.querySelectorAll('button').forEach((item) => item.classList.toggle('is-active', item === button));
        onSelect(clip);
      });
      this.animationList.append(button);
    });
  }

  setMaterials(materials) {
    this.materialCount.textContent = String(materials.length).padStart(2, '0');
    this.materialList.replaceChildren();
    if (!materials.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-panel';
      empty.textContent = 'NO MATERIALS DETECTED';
      this.materialList.append(empty);
      return;
    }
    materials.forEach((material, index) => {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const kind = document.createElement('b');
      name.textContent = `○ ${material.name || `MATERIAL ${String(index + 1).padStart(2, '0')}`}`;
      kind.textContent = material.type.replace('Material', '').toUpperCase() || 'DEFAULT';
      item.append(name, kind);
      this.materialList.append(item);
    });
  }

  setModelControls(enabled) {
    this.root.querySelectorAll('[data-reset-camera], [data-auto-rotate], [data-lighting]').forEach((button) => { button.disabled = !enabled; });
  }

  setAnimationControls(enabled) {
    this.root.querySelectorAll('[data-animation-play], [data-animation-pause], [data-animation-stop], [data-animation-loop]').forEach((control) => { control.disabled = !enabled; });
  }
}
