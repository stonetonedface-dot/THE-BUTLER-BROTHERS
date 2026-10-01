import { LoadingManager } from 'three';
import { FBXLoader } from './vendor/addons/loaders/FBXLoader.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

const supportedModel = /\.(glb|gltf|fbx)$/i;

export const getExtension = (name = '') => name.split('?')[0].split('#')[0].split('.').pop().toUpperCase();

export function displayName(name = 'UNTITLED MODEL') {
  const finalPart = name.split('/').pop().split('?')[0];
  return decodeURIComponent(finalPart).replace(/\.(glb|gltf|fbx)$/i, '') || 'UNTITLED MODEL';
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
    this.gltfLoader = new GLTFLoader(this.manager);
    this.fbxLoader = new FBXLoader(this.manager);
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
    if (!primary) {
      if (list.some((file) => /\.blend$/i.test(file.name))) {
        throw new Error('BLEND IS A BLENDER SOURCE FILE. EXPORT IT AS .GLB FIRST.');
      }
      throw new Error('INVALID FILE FORMAT. SELECT A .GLB, .GLTF OR .FBX MODEL.');
    }

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
    const format = getExtension(primary.name);
    const gltf = format === 'FBX'
      ? { scene: this.fbxLoader.parse(buffer, ''), animations: [] }
      : await new Promise((resolve, reject) => this.gltfLoader.parse(buffer, '', resolve, reject));
    if (format === 'FBX') gltf.animations = gltf.scene.animations || [];
    return { gltf, source: { name: primary.name, size: primary.size, format, local: true } };
  }

  async loadRemote(url, onProgress) {
    this.clearLocalResources();
    const format = getExtension(new URL(url).pathname);
    if (!supportedModel.test(new URL(url).pathname)) throw new Error('MODEL URL MUST POINT DIRECTLY TO A .GLB, .GLTF OR .FBX FILE.');

    const gltf = format === 'FBX'
      ? await new Promise((resolve, reject) => this.fbxLoader.load(url, (scene) => resolve({ scene, animations: scene.animations || [] }), onProgress, reject))
      : await new Promise((resolve, reject) => this.gltfLoader.load(url, resolve, onProgress, reject));
    return { gltf, source: { name: displayName(url), format, local: false } };
  }
}
