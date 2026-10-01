import { LoadingManager } from 'three';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

const supportedModel = /\.(glb|gltf)$/i;

export const getExtension = (name = '') => name.split('?')[0].split('#')[0].split('.').pop().toUpperCase();

export function displayName(name = 'UNTITLED MODEL') {
  const finalPart = name.split('/').pop().split('?')[0];
  return decodeURIComponent(finalPart).replace(/\.(glb|gltf)$/i, '') || 'UNTITLED MODEL';
}

export function disposeObject3D(root) {
  if (!root) return;
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) value.dispose();
      });
      material.dispose();
    });
  });
}

export class ModelLoader {
  constructor() {
    this.manager = new LoadingManager();
    this.loader = new GLTFLoader(this.manager);
    this.objectUrls = [];
  }

  clearLocalResources() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
    this.manager.setURLModifier((url) => url);
  }

  async loadLocal(files) {
    const list = [...files];
    const primary = list.find((file) => supportedModel.test(file.name));
    if (!primary) throw new Error('INVALID FILE FORMAT. SELECT A .GLB OR .GLTF MODEL.');

    this.clearLocalResources();
    const resourceMap = new Map();
    list.forEach((file) => {
      const objectUrl = URL.createObjectURL(file);
      this.objectUrls.push(objectUrl);
      resourceMap.set(file.name.toLowerCase(), objectUrl);
    });

    this.manager.setURLModifier((url) => {
      const resourceName = decodeURIComponent(url.split('?')[0].split('/').pop()).toLowerCase();
      return resourceMap.get(resourceName) || url;
    });

    const buffer = await primary.arrayBuffer();
    const gltf = await new Promise((resolve, reject) => this.loader.parse(buffer, '', resolve, reject));
    return { gltf, source: { name: primary.name, size: primary.size, format: getExtension(primary.name), local: true } };
  }

  async loadRemote(url, onProgress) {
    this.clearLocalResources();
    if (!supportedModel.test(new URL(url).pathname)) throw new Error('MODEL URL MUST POINT DIRECTLY TO A .GLB OR .GLTF FILE.');

    const gltf = await new Promise((resolve, reject) => {
      this.loader.load(url, resolve, onProgress, reject);
    });
    return { gltf, source: { name: displayName(url), format: getExtension(url), local: false } };
  }
}
