import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/controls/OrbitControls.js';

export class ViewerScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b111c');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    this.camera.position.set(3.5, 2.2, 4.8);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(1, 1, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.append(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 100;

    this.modelRoot = new THREE.Group();
    this.scene.add(this.modelRoot);
    this.hemi = new THREE.HemisphereLight('#cadcff', '#17110e', 2.3);
    this.key = new THREE.DirectionalLight('#fff1d4', 3.3);
    this.key.position.set(4, 7, 5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.fill = new THREE.DirectionalLight('#4f81ff', 1.6);
    this.fill.position.set(-5, 3, -4);
    this.scene.add(this.hemi, this.key, this.fill);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.26 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.clock = new THREE.Clock();
    this.mixer = null;
    this.currentAction = null;
    this.loop = true;
    this.defaultView = null;
    this.lightingMode = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.render = this.render.bind(this);
    this.render();
  }

  render() {
    this.frame = requestAnimationFrame(this.render);
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.mixer?.update(delta);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  removeModel() {
    const current = this.modelRoot.children[0];
    if (current) this.modelRoot.remove(current);
    this.mixer = null;
    this.currentAction = null;
    return current;
  }

  setModel(model, clips = []) {
    this.removeModel();
    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    this.modelRoot.add(model);
    this.mixer = clips.length ? new THREE.AnimationMixer(model) : null;
    this.frameObject(model);
  }

  frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() * 0.5, 0.75);
    const offset = new THREE.Vector3(radius * 1.5, radius * 0.92, radius * 1.65);
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(offset);
    this.controls.minDistance = radius * 0.28;
    this.controls.maxDistance = Math.max(radius * 12, 30);
    this.camera.near = Math.max(radius / 100, 0.01);
    this.camera.far = Math.max(radius * 100, 100);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.defaultView = { position: this.camera.position.clone(), target: this.controls.target.clone() };
  }

  resetCamera() {
    if (!this.defaultView) return;
    this.camera.position.copy(this.defaultView.position);
    this.controls.target.copy(this.defaultView.target);
    this.controls.update();
  }

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 1.35;
  }

  cycleLighting() {
    this.lightingMode = (this.lightingMode + 1) % 3;
    const modes = [
      { background: '#0b111c', hemi: 2.3, key: 3.3, fill: 1.6, exposure: 1.08 },
      { background: '#101822', hemi: 1.15, key: 5.2, fill: 0.7, exposure: 1.22 },
      { background: '#181119', hemi: 1.75, key: 2.25, fill: 3, exposure: 0.98 },
    ];
    const mode = modes[this.lightingMode];
    this.scene.background.set(mode.background);
    this.hemi.intensity = mode.hemi;
    this.key.intensity = mode.key;
    this.fill.intensity = mode.fill;
    this.renderer.toneMappingExposure = mode.exposure;
    return this.lightingMode + 1;
  }

  playClip(clip) {
    if (!this.mixer || !clip) return false;
    this.mixer.stopAllAction();
    this.currentAction = this.mixer.clipAction(clip);
    this.currentAction.reset();
    this.currentAction.setLoop(this.loop ? THREE.LoopRepeat : THREE.LoopOnce, this.loop ? Infinity : 1);
    this.currentAction.clampWhenFinished = !this.loop;
    this.currentAction.play();
    return true;
  }

  pauseAnimation() {
    if (this.currentAction) this.currentAction.paused = true;
  }

  resumeAnimation() {
    if (this.currentAction) {
      this.currentAction.paused = false;
      this.currentAction.play();
    }
  }

  stopAnimation() {
    if (this.currentAction) this.currentAction.stop();
  }

  setLoop(loop) {
    this.loop = loop;
    if (this.currentAction) {
      this.currentAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      this.currentAction.clampWhenFinished = !loop;
    }
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
