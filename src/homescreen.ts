import './homescreen.css';

// Import Three.js
import * as THREE from 'three';

/**
 * Define constants.
 */
const TEXTURE_PATH = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/123879/';

/**
 * Create the animation request.
 */
declare global {
  interface Window {
    mozRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    msRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    oRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    webkitRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
  }
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (function() {
    return window.mozRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (callback: FrameRequestCallback) {
      // 60 FPS
      return window.setTimeout(() => callback(Date.now()), 1000 / 60);
    };
  })();
}

/**
 * Set our global variables.
 */
var camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    element: HTMLCanvasElement,
    container: HTMLDivElement,
    sphere: THREE.Mesh,
    sphereCloud: THREE.Mesh,
    baseRotationPoint: THREE.Object3D,
    worldRotationPoint: THREE.Object3D,
    rotationPoint: THREE.Object3D;

var degreeOffset = 90;
var earthRadius = 120; // Increased from 80 to make Earth bigger

var getEarthRotation = function() {
  // Get the current time.
  var d = new Date();
  var h = d.getUTCHours();
  var m = d.getUTCMinutes();

  // Calculate total minutes.
  var minutes = h * 60;
  minutes += m;

  // Turn minutes into degrees.
  var degrees = minutes/3.9907;

  // Add an offset to match UTC time.
  degrees += degreeOffset;
  return degrees;
}

var degrees = getEarthRotation();

// Calculate Earth's rotation position.
setInterval(function() {
  // Get the current time.
  var d = new Date();
  var h = d.getUTCHours();
  var m = d.getUTCMinutes();

  // Calculate total minutes.
  var minutes = h * 60;
  minutes += m;

  // Turn minutes into degrees.
  degrees = minutes/3.9907;

  // Add an offset to match UTC time.
  degrees += degreeOffset;
}, 60000);

// Create navigation UI
function createNavigationUI() {
  const nav = document.createElement('div');
  nav.className = 'homescreen-nav';
  nav.innerHTML = `
    <div class="nav-content">
      <div class="nav-header">
        <h1>RADAR</h1>
        <p>Rokt Assistant For Discovering and Assessing Regions</p>
      </div>
      <button id="enter-map" class="enter-button">
        <span>Enter Map</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m9 18 6-6-6-6"/>
        </svg>
      </button>
    </div>
  `;
  
  document.getElementById('homescreen')?.appendChild(nav);
  
  // Create white transition overlay
  const transitionOverlay = document.createElement('div');
  transitionOverlay.className = 'transition-overlay';
  document.body.appendChild(transitionOverlay);
  
  // Add click handler with smooth transition
  document.getElementById('enter-map')?.addEventListener('click', async () => {
    console.log('Enter Map button clicked');
    
    // Step 1: Fade to white
    transitionOverlay.classList.add('fade-in');
    
    // Wait for fade-in to complete
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Step 2: Switch content while screen is white
    const homescreen = document.getElementById('homescreen');
    const mapContainer = document.getElementById('map-container');
    
    if (homescreen && mapContainer) {
      console.log('Hiding homescreen, showing map container');
      homescreen.style.display = 'none';
      mapContainer.style.display = 'block';
      
      // Initialize the map
      console.log('Dispatching initializeMap event');
      const event = new CustomEvent('initializeMap');
      window.dispatchEvent(event);
    }
    
    // Wait a moment for map to start loading
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 3: Fade from white to reveal the map
    transitionOverlay.classList.remove('fade-in');
    transitionOverlay.classList.add('fade-out');
    
    // Clean up after transition completes
    setTimeout(() => {
      transitionOverlay.classList.remove('fade-out');
    }, 800);
  });
}

init();
animate();

/**
 * Initializer function.
 */
function init() {
  // Build the container
  container = document.createElement('div');
  container.className = 'earth-container';
  document.getElementById('homescreen')?.appendChild(container);

  // Create navigation UI
  createNavigationUI();

  // Create the scene.
  scene = new THREE.Scene();

  // Create a rotation point.
  baseRotationPoint = new THREE.Object3D();
  baseRotationPoint.position.set(0, 0, 0);
  scene.add(baseRotationPoint);
  
  // Create world rotation point.
  worldRotationPoint = new THREE.Object3D();
  worldRotationPoint.position.set(0, 0, 0);
  scene.add(worldRotationPoint);

  rotationPoint = new THREE.Object3D();
  rotationPoint.position.set(0, 0, earthRadius * 4);
  baseRotationPoint.add(rotationPoint);

  // Create the camera.
  camera = new THREE.PerspectiveCamera(
    45, // Angle
    window.innerWidth / window.innerHeight, // Aspect Ratio.
    1, // Near view.
    10000 // Far view.
  );
  rotationPoint.add(camera);

  // Build the renderer.
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  element = renderer.domElement;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(element);

  // Remove orbit controls - Earth will rotate automatically without user interaction

  // Bright ambient lights but not too overwhelming
  var ambient = new THREE.AmbientLight(0x606060, 2.0); // Reduced from 3.0
  scene.add(ambient);

  // Bright sun light but more reasonable
  var light = new THREE.PointLight(0xffeecc, 3.5, 12000); // Reduced from 5.0
  light.position.set(-400, 0, 100);
  scene.add(light);

  // Fill lights with reduced intensity
  var light2 = new THREE.PointLight(0xffffff, 1.8, 8000); // Reduced from 2.5
  light2.position.set(-400, 0, 250);
  scene.add(light2);

  var light3 = new THREE.PointLight(0xffffff, 1.8, 8000); // Reduced from 2.5
  light3.position.set(-400, 0, -150);
  scene.add(light3);

  var light4 = new THREE.PointLight(0xffffff, 1.8, 8000); // Reduced from 2.5
  light4.position.set(-400, 150, 100);
  scene.add(light4);

  var light5 = new THREE.PointLight(0xffffff, 1.8, 8000); // Reduced from 2.5
  light5.position.set(-400, -150, 100);
  scene.add(light5);

  // Additional lights with reduced intensity
  var frontLight = new THREE.PointLight(0xffffff, 1.4, 8000); // Reduced from 2.0
  frontLight.position.set(200, 0, 200);
  scene.add(frontLight);

  var topLight = new THREE.PointLight(0xffffff, 1.0, 6000); // Reduced from 1.5
  topLight.position.set(0, 300, 0);
  scene.add(topLight);

  // Add more lights for even distribution
  var bottomLight = new THREE.PointLight(0xffffff, 1.0, 6000); // Reduced from 1.5
  bottomLight.position.set(0, -300, 0);
  scene.add(bottomLight);

  var rightLight = new THREE.PointLight(0xffffff, 1.0, 6000); // Reduced from 1.5
  rightLight.position.set(300, 0, 0);
  scene.add(rightLight);

  var leftLight = new THREE.PointLight(0xffffff, 1.0, 6000); // Reduced from 1.5
  leftLight.position.set(-300, 0, 0);
  scene.add(leftLight);

  // Add the Earth sphere model.
  var geometry = new THREE.SphereGeometry(earthRadius, 128, 128);

  // Create the Earth materials. 
  var loader = new THREE.TextureLoader();
  loader.setCrossOrigin('https://s.codepen.io');
  var texture = loader.load(TEXTURE_PATH + 'ColorMap.jpg');

  var bump = loader.load(TEXTURE_PATH + 'Bump.jpg');
  var spec = loader.load(TEXTURE_PATH + 'SpecMask.jpg');

  var material = new THREE.MeshPhongMaterial({
    color: "#ffffff",
    shininess: 30, // Even more reflective
    map: texture,
    specularMap: spec,
    specular: "#aaaaaa", // Even brighter specular
    bumpMap: bump,
    emissive: "#222222", // Slightly reduced emissive glow
  });

  sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(0, 0, 0);
  sphere.rotation.y = Math.PI;

  // Focus initially on the prime meridian.
  sphere.rotation.y = -1 * (8.7 * Math.PI / 17);

  // Add the Earth to the scene.
  worldRotationPoint.add(sphere);

  // Add the Earth sphere model.
  var geometryCloud = new THREE.SphereGeometry(earthRadius + 0.2, 128, 128);

  var alpha = loader.load(TEXTURE_PATH + "alphaMap.jpg");

  var materialCloud = new THREE.MeshPhongMaterial({
    alphaMap: alpha,
  });

  materialCloud.transparent = true;

  sphereCloud = new THREE.Mesh(geometryCloud, materialCloud);
  scene.add(sphereCloud);

  // Add back a subtle transparent glow effect
  var glowGeometry = new THREE.SphereGeometry(earthRadius * 1.1, 64, 64);
  var glowMaterial = new THREE.MeshBasicMaterial({
    color: 0x88ccff,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide
  });
  var glow = new THREE.Mesh(glowGeometry, glowMaterial);
  scene.add(glow);

  // Add starfield background
  addStarfield();

  // Remove the skybox that was causing visual artifacts
  // addSkybox();

  window.addEventListener('resize', onWindowResize, false);
}

/**
 * Events to fire upon window resizing.
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Add the sun to the scene.
 */
function createSun() {
  // Add the Sun sphere model.
  var sunGeometry = new THREE.SphereGeometry(100, 16, 16);

  // Create the Sun materials.
  var sunMaterial = new THREE.MeshLambertMaterial({
    color: '#ffff55',
    emissive: '#ffff55',
  });

  var sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.castShadow = false;
  sun.receiveShadow = false;
  sun.position.set(-9500, 0, 0);
  sun.rotation.y = Math.PI;

  // Add the Sun to the scene.
  scene.add(sun);
}

createSun();

/**
 * Updates to apply to the scene while running.
 */
function update() {
  camera.updateProjectionMatrix();
  worldRotationPoint.rotation.y = degrees * Math.PI/180;
  sphereCloud.rotation.y += 0.00025;
  baseRotationPoint.rotation.y -= 0.00025;
}

/**
 * Render the scene.
 */
function render() {
  renderer.render(scene, camera);
}

/**
 * Animate the scene.
 */
function animate() {
  requestAnimationFrame(animate);
  update();
  render();
}

// Create a starfield background
function addStarfield() {
  const starGeometry = new THREE.BufferGeometry();
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  
  for (let i = 0; i < starCount * 3; i += 3) {
    // Create stars in a large sphere around the scene
    const radius = 1000 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    positions[i] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i + 2] = radius * Math.cos(phi);
  }
  
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: false
  });
  
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}

// Removed addSkybox function as it was causing visual artifacts 