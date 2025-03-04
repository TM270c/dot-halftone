/*************************************************
 * script.js - Optimized with Tab Visibility, Sync & Dot Shape Fixes
 *************************************************/

// 1) MEDIA HANDLER
class MediaHandler {
  constructor() {
    this.mediaElement = null;
    this.isVideo = false;
    this.isLoaded = false;
    this.width = 0;
    this.height = 0;
    this.frameRate = 24;
  }
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('video/')) {
        this.isVideo = true;
        const video = document.createElement('video');
        video.autoplay = false;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.src = URL.createObjectURL(file);
        video.addEventListener('loadeddata', () => {
          this.mediaElement = video;
          this.width = video.videoWidth;
          this.height = video.videoHeight;
          this.isLoaded = true;
          resolve();
        });
        video.addEventListener('error', () => reject(new Error('Error loading video file.')));
      } else if (file.type.startsWith('image/')) {
        this.isVideo = false;
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.addEventListener('load', () => {
          this.mediaElement = img;
          this.width = img.naturalWidth;
          this.height = img.naturalHeight;
          this.isLoaded = true;
          resolve();
        });
        img.addEventListener('error', () => reject(new Error('Error loading image file.')));
      } else {
        reject(new Error('File type not supported.'));
      }
    });
  }
  loadFromUrl(url) {
    return new Promise((resolve, reject) => {
      const videoExtensions = ['mp4', 'webm', 'ogg'];
      const isVideo = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
      if (isVideo) {
        this.isVideo = true;
        const video = document.createElement('video');
        video.autoplay = false;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.addEventListener('loadeddata', () => {
          this.mediaElement = video;
          this.width = video.videoWidth;
          this.height = video.videoHeight;
          this.isLoaded = true;
          resolve();
        });
        video.addEventListener('error', () => reject(new Error('Failed to load video from URL.')));
        video.src = url;
      } else {
        this.isVideo = false;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.addEventListener('load', () => {
          this.mediaElement = img;
          this.width = img.naturalWidth;
          this.height = img.naturalHeight;
          this.isLoaded = true;
          resolve();
        });
        img.addEventListener('error', () => reject(new Error('Failed to load image from URL.')));
        img.src = url;
      }
    });
  }
  drawFrameToContext(ctx, w, h) {
    if (!this.isLoaded || !this.mediaElement) return;
    if (this.isVideo && this.mediaElement.readyState < 2) return;
    ctx.drawImage(this.mediaElement, 0, 0, w, h);
  }
  getFrameImageData(w, h) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    this.drawFrameToContext(offCtx, w, h);
    return offCtx.getImageData(0, 0, w, h);
  }
}

// 2) DOM REFERENCES & GLOBALS
const scaleInput       = document.getElementById('scaleMediaFile');
const colorInput       = document.getElementById('colorMediaFile');
const dotShapeFile     = document.getElementById('dotShapeFile');  // Dot shape file input
const removeDotShapeBtn= document.getElementById('removeDotShape'); // Dot shape remove button
const removeScaleBtn   = document.getElementById('removeScaleMedia');
const removeColorBtn   = document.getElementById('removeColorMedia');
const swapBtn          = document.getElementById('swapMedia');
const exportBtn        = document.getElementById('exportSVG');

const canvas           = document.getElementById('canvas');
const ctx              = canvas.getContext('2d');

const gradientContainer = document.getElementById('gradientContainer');
const gradientSlider   = new GradientSlider(gradientContainer);
const colorModeSelect  = document.getElementById('colorMode');

const brightnessInput  = document.getElementById('brightness');
const contrastInput    = document.getElementById('contrast');
const gammaInput       = document.getElementById('gamma');
const smoothingInput   = document.getElementById('smoothing');
const ditherSelect     = document.getElementById('ditherType');
const cellSizeInput    = document.getElementById('cellSize');
const dotScaleInput    = document.getElementById('dotScale');

const invertScaleCheckbox = document.getElementById('invertScale');
const hueInput         = document.getElementById('hue');

const scaleVideoUrl    = document.getElementById('scaleVideoUrl');
const colorVideoUrl    = document.getElementById('colorVideoUrl');
const loadVideoUrlsBtn = document.getElementById('loadVideoUrls');

let scaleMedia = new MediaHandler();
let colorMedia = new MediaHandler();
let animationId = null;
let noiseColorCache = {};
let isNoisePatternGenerated = false;

const TARGET_FPS = 24;
const TIME_STEP = 1000 / TARGET_FPS;
let lastFrameTime = 0;
let accumulatedTime = 0;

let dotShapeImg = null;   // Holds the uploaded dot shape SVG as an Image
let dotShapeLoaded = false;
let dotShapeW = 0;
let dotShapeH = 0;

// 3) VIDEO URL LOADER
loadVideoUrlsBtn.addEventListener('click', () => {
  const scaleUrl = scaleVideoUrl.value.trim();
  const colorUrl = colorVideoUrl.value.trim();
  isNoisePatternGenerated = false;
  if (scaleUrl) {
    scaleMedia = new MediaHandler();
    scaleMedia.loadFromUrl(scaleUrl)
      .then(() => {
        if (scaleMedia.isVideo) {
          scaleMedia.mediaElement.currentTime = 0;
          scaleMedia.mediaElement.playbackRate = 1.0;
          scaleMedia.mediaElement.play();
        }
        checkAndStartBoth();
      })
      .catch(err => console.error("Error loading scale video from URL:", err));
  }
  if (colorUrl) {
    colorMedia = new MediaHandler();
    colorMedia.loadFromUrl(colorUrl)
      .then(() => {
        if (colorMedia.isVideo) {
          colorMedia.mediaElement.currentTime = 0;
          colorMedia.mediaElement.playbackRate = 1.0;
          colorMedia.mediaElement.play();
        }
        checkAndStartBoth();
      })
      .catch(err => console.error("Error loading color video from URL:", err));
  }
});

// 4) FILE INPUT EVENT LISTENERS
scaleInput.onchange = async () => {
  const file = scaleInput.files[0];
  if (!file) return;
  if (animationId) cancelAnimationFrame(animationId);
  isNoisePatternGenerated = false;
  scaleMedia = new MediaHandler();
  await scaleMedia.loadFromFile(file);
  if (scaleMedia.isVideo) {
    attachFPSCounter(scaleMedia.mediaElement, 'scaleFPS');
    scaleMedia.mediaElement.playbackRate = 1.0;
  } else {
    document.getElementById('scaleFPS').textContent = 'FPS: N/A';
  }
  checkAndStartBoth();
};

colorInput.onchange = async () => {
  const file = colorInput.files[0];
  if (!file) return;
  if (animationId) cancelAnimationFrame(animationId);
  isNoisePatternGenerated = false;
  colorMedia = new MediaHandler();
  await colorMedia.loadFromFile(file);
  if (colorMedia.isVideo) {
    attachFPSCounter(colorMedia.mediaElement, 'colorFPS');
    colorMedia.mediaElement.playbackRate = 1.0;
  } else {
    document.getElementById('colorFPS').textContent = 'FPS: N/A';
  }
  checkAndStartBoth();
};

// *** Dot Shape File Handling ***
// When a user uploads a dot shape (SVG), load it into an Image.
dotShapeFile.onchange = async () => {
  const file = dotShapeFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    dotShapeImg = new Image();
    dotShapeImg.onload = function() {
      dotShapeLoaded = true;
      dotShapeW = dotShapeImg.width;
      dotShapeH = dotShapeImg.height;
    };
    dotShapeImg.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

// Allow removal of the dot shape.
removeDotShapeBtn.addEventListener('click', () => {
  dotShapeImg = null;
  dotShapeLoaded = false;
  dotShapeW = 0;
  dotShapeH = 0;
  dotShapeFile.value = "";
});

// 5) REMOVE / SWAP MEDIA
removeScaleBtn.addEventListener('click', () => {
  if (animationId) cancelAnimationFrame(animationId);
  if (colorModeSelect.value === 'noise') isNoisePatternGenerated = false;
  if (scaleMedia.isVideo && scaleMedia.mediaElement) scaleMedia.mediaElement.pause();
  scaleMedia = new MediaHandler();
  scaleInput.value = null;
  document.getElementById('scaleFPS').textContent = 'FPS: --';
  if (colorMedia.isLoaded) { setupCanvas(); startRenderLoop(); }
  else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
});

removeColorBtn.addEventListener('click', () => {
  if (animationId) cancelAnimationFrame(animationId);
  if (colorModeSelect.value === 'noise') isNoisePatternGenerated = false;
  if (colorMedia.isVideo && colorMedia.mediaElement) colorMedia.mediaElement.pause();
  colorMedia = new MediaHandler();
  colorInput.value = null;
  document.getElementById('colorFPS').textContent = 'FPS: --';
  if (scaleMedia.isLoaded) { setupCanvas(); startRenderLoop(); }
  else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
});

swapBtn.addEventListener('click', () => {
  if (animationId) cancelAnimationFrame(animationId);
  isNoisePatternGenerated = false;
  [scaleMedia, colorMedia] = [colorMedia, scaleMedia];
  reattachFPSUI();
  if (scaleMedia.isLoaded) { setupCanvas(); startRenderLoop(); }
  else if (colorMedia.isLoaded) {
    canvas.width = 500;
    const ratio = colorMedia.height / colorMedia.width;
    canvas.height = 500 * ratio;
    startRenderLoop();
  } else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
});

function reattachFPSUI() {
  if (scaleMedia.isVideo && scaleMedia.isLoaded)
    attachFPSCounter(scaleMedia.mediaElement, 'scaleFPS');
  else document.getElementById('scaleFPS').textContent = 'FPS: N/A';
  
  if (colorMedia.isVideo && colorMedia.mediaElement)
    attachFPSCounter(colorMedia.mediaElement, 'colorFPS');
  else document.getElementById('colorFPS').textContent = 'FPS: N/A';
}

// 6) START OR RESUME RENDERING
function checkAndStartBoth() {
  if (scaleMedia.isLoaded && colorMedia.isLoaded) {
    if (scaleMedia.isVideo) { scaleMedia.mediaElement.currentTime = 0; scaleMedia.mediaElement.play(); }
    if (colorMedia.isVideo) { colorMedia.mediaElement.currentTime = 0; colorMedia.mediaElement.play(); }
    setupCanvas(); startRenderLoop();
  } else if (scaleMedia.isLoaded) {
    if (scaleMedia.isVideo) { scaleMedia.mediaElement.currentTime = 0; scaleMedia.mediaElement.play(); }
    setupCanvas(); startRenderLoop();
  } else if (colorMedia.isLoaded) {
    if (colorMedia.isVideo) { colorMedia.mediaElement.currentTime = 0; colorMedia.mediaElement.play(); }
    canvas.width = 500;
    const ratio = colorMedia.height / colorMedia.width;
    canvas.height = 500 * ratio;
    startRenderLoop();
  }
}

function setupCanvas() {
  if (!scaleMedia.isLoaded) return;
  const ratio = scaleMedia.height / scaleMedia.width;
  scaleMedia.width = 500;
  scaleMedia.height = 500 * ratio;
  canvas.width = scaleMedia.width;
  canvas.height = scaleMedia.height;
}

// 7) MAIN RENDER LOOP (Fixed Time Step with Delta Clamping & Sync)
function startRenderLoop() {
  lastFrameTime = performance.now();
  accumulatedTime = 0;
  
  if (colorModeSelect.value === 'noise' && !isNoisePatternGenerated) {
    generateNoisePattern(canvas.width, canvas.height, getCellSize());
    isNoisePatternGenerated = true;
  }
  
  function animate(currentTime) {
    let deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    deltaTime = Math.min(deltaTime, 50);
    accumulatedTime += deltaTime;
    
    while (accumulatedTime >= TIME_STEP) {
      updateFrame();
      accumulatedTime -= TIME_STEP;
    }
    
    // Synchronize videos if both are playing and out-of-sync by > 0.1s
    if (scaleMedia.isVideo && colorMedia.isVideo && scaleMedia.mediaElement && colorMedia.mediaElement) {
      const diff = Math.abs(scaleMedia.mediaElement.currentTime - colorMedia.mediaElement.currentTime);
      if (diff > 0.1) {
        colorMedia.mediaElement.currentTime = scaleMedia.mediaElement.currentTime;
      }
    }
    
    animationId = requestAnimationFrame(animate);
  }
  
  animationId = requestAnimationFrame(animate);
}

function generateNoisePattern(width, height, cellSize) {
  noiseColorCache = {};
  const stops = gradientSlider.getStops();
  for (let y = 0; y < height; y += cellSize)
    for (let x = 0; x < width; x += cellSize) {
      const key = `${x}_${y}`;
      noiseColorCache[key] = getColorFromGradient(Math.random(), stops);
    }
}

function updateFrame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scaleData = scaleMedia.isLoaded ? scaleMedia.getFrameImageData(canvas.width, canvas.height) : null;
  const colorData = colorMedia.isLoaded ? colorMedia.getFrameImageData(canvas.width, canvas.height) : null;
  let scaleGray = null;
  if (scaleData) {
    scaleGray = convertToGrayscaleFloat(scaleData);
    applyBrightnessContrastGamma(scaleGray, canvas.width, canvas.height,
      parseInt(brightnessInput.value, 10),
      parseInt(contrastInput.value, 10),
      parseFloat(gammaInput.value));
    scaleGray = applyBoxBlur(scaleGray, canvas.width, canvas.height, parseFloat(smoothingInput.value));
    applyDithering(scaleGray, canvas.width, canvas.height, ditherSelect.value);
    if (invertScaleCheckbox.checked)
      for (let i = 0; i < scaleGray.length; i++) { scaleGray[i] = 255 - scaleGray[i]; }
  }
  
  const cellSize = getCellSize();
  if (colorModeSelect.value === 'noise' && !isNoisePatternGenerated) {
    generateNoisePattern(canvas.width, canvas.height, cellSize);
    isNoisePatternGenerated = true;
  }
  
  for (let y = 0; y < canvas.height; y += cellSize)
    for (let x = 0; x < canvas.width; x += cellSize) {
      const radius = computeBrightnessRadius(scaleGray, x, y);
      if (radius <= 0.5) continue;
      const fill = getFillColor(x, y, scaleGray, colorData);
      if (dotShapeLoaded && dotShapeImg)
        drawCustomShape(ctx, x + cellSize / 2, y + cellSize / 2, radius, fill);
      else {
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fill;
        ctx.fill();
      }
    }
}

// 7A) Convert ImageData to Grayscale Float32 Array
function convertToGrayscaleFloat({ data, width, height }) {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < data.length; i += 4)
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return gray;
}

// 8) Draw Custom Shape using the uploaded SVG as a mask
function drawCustomShape(mainCtx, cx, cy, radius, fillColor) {
  if (!dotShapeImg) return;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = dotShapeW;
  offCanvas.height = dotShapeH;
  const offCtx = offCanvas.getContext('2d');
  offCtx.fillStyle = fillColor;
  offCtx.fillRect(0, 0, dotShapeW, dotShapeH);
  offCtx.globalCompositeOperation = 'destination-in';
  offCtx.drawImage(dotShapeImg, 0, 0);
  mainCtx.save();
  mainCtx.translate(cx, cy);
  const scaleFactor = (2 * radius) / dotShapeW;
  mainCtx.scale(scaleFactor, scaleFactor);
  mainCtx.drawImage(offCanvas, -dotShapeW / 2, -dotShapeH / 2);
  mainCtx.restore();
}

// 9) Compute Dot Radius
function computeBrightnessRadius(scaleGray, x, y) {
  const dotScale = parseFloat(dotScaleInput.value);
  const cellSize = getCellSize();
  if (!scaleGray) return (cellSize / 2) * dotScale;
  const idx = y * canvas.width + x;
  return (cellSize / 2) * dotScale * (1 - scaleGray[idx] / 255);
}

// 10) Get Fill Color based on the selected mode
function getFillColor(x, y, scaleGray, colorData) {
  const mode = colorModeSelect.value || 'gradientLum1';
  const stops = gradientSlider.getStops();
  const cellSize = getCellSize();
  let base = 'blue';
  switch (mode) {
    case 'gradientX':
      base = getColorFromGradient(x / (canvas.width - 1), stops);
      break;
    case 'gradientY':
      base = getColorFromGradient(y / (canvas.height - 1), stops);
      break;
    case 'gradientLum1': {
      const factor = getBrightnessFactor(scaleGray, x, y);
      base = getColorFromGradient(factor, stops);
      break;
    }
    case 'gradientLum2': {
      if (!colorData) base = getColorFromGradient(0, stops);
      else {
        const idxC = (y * colorData.width + x) * 4;
        const brightness = 0.299 * colorData.data[idxC] + 0.587 * colorData.data[idxC + 1] + 0.114 * colorData.data[idxC + 2];
        base = getColorFromGradient(brightness / 255, stops);
      }
      break;
    }
    case 'imageSecondary': {
      if (colorData) {
        const idxC = (y * colorData.width + x) * 4;
        base = rgbToHex(colorData.data[idxC], colorData.data[idxC + 1], colorData.data[idxC + 2]);
      }
      break;
    }
    case 'noise': {
      const key = `${x}_${y}`;
      if (!noiseColorCache[key]) noiseColorCache[key] = getColorFromGradient(Math.random(), stops);
      base = noiseColorCache[key];
      break;
    }
    case 'checkered': {
      const isEven = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
      base = (stops.length < 2) ? (isEven ? '#000' : '#fff') : (isEven ? stops[0].color : stops[stops.length - 1].color);
      break;
    }
    default: {
      const factor = getBrightnessFactor(scaleGray, x, y);
      base = getColorFromGradient(factor, stops);
    }
  }
  const hueVal = parseFloat(hueInput.value) || 0;
  return hueVal ? adjustHue(base, hueVal) : base;
}

function getBrightnessFactor(scaleGray, x, y) {
  if (!scaleGray) return 0;
  return scaleGray[y * canvas.width + x] / 255;
}

// 10B) Gradient Utilities
function getColorFromGradient(t, stops) {
  const sorted = [...stops].sort((a, b) => a.position - b.position);
  const position = t * 100;
  if (position <= sorted[0].position) return sorted[0].color;
  if (position >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
  
  let left = sorted[0], right = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].position <= position && sorted[i + 1].position >= position) {
      left = sorted[i];
      right = sorted[i + 1];
      break;
    }
  }
  if (left.position === right.position) return left.color;
  const localFactor = (position - left.position) / (right.position - left.position);
  return blendColors(left.color, right.color, localFactor);
}

function blendColors(hex1, hex2, factor) {
  const r1 = parseInt(hex1.slice(1, 3), 16),
        g1 = parseInt(hex1.slice(3, 5), 16),
        b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16),
        g2 = parseInt(hex2.slice(3, 5), 16),
        b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function adjustHue(hex, hueDegrees) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  h = (h + hueDegrees) % 360;
  if (h < 0) h += 360;
  const newRgb = hslToRgb(h, s, l);
  return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length !== 6) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// 11) Brightness/Contrast/Gamma, Smoothing & Dithering
function applyBrightnessContrastGamma(gray, width, height, brightnessVal, contrastVal, gammaVal) {
  const contrastFactor = (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
  for (let i = 0; i < gray.length; i++) {
    let val = contrastFactor * (gray[i] - 128) + 128 + brightnessVal;
    val = Math.max(0, Math.min(255, val));
    gray[i] = 255 * Math.pow(val / 255, 1 / gammaVal);
  }
}

function applyBoxBlur(gray, width, height, strength) {
  if (strength <= 0) return gray;
  let result = new Float32Array(gray);
  const passes = Math.floor(strength);
  for (let p = 0; p < passes; p++) {
    const temp = new Float32Array(result.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += result[ny * width + nx];
              count++;
            }
          }
        }
        temp[y * width + x] = sum / count;
      }
    }
    result = temp;
  }
  const frac = strength - passes;
  if (frac > 0)
    for (let i = 0; i < result.length; i++)
      result[i] = gray[i] * (1 - frac) + result[i] * frac;
  return result;
}

function applyDithering(gray, width, height, ditherType) {
  switch (ditherType) {
    case 'FloydSteinberg': applyFloydSteinbergDithering(gray, width, height); break;
    case 'Ordered': applyOrderedDithering(gray, width, height); break;
    case 'Noise': applyNoiseDithering(gray, width, height); break;
    default: break;
  }
}

function applyFloydSteinbergDithering(gray, width, height) {
  const threshold = 128;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = gray[idx];
      const newVal = oldVal < threshold ? 0 : 255;
      const error = oldVal - newVal;
      gray[idx] = newVal;
      if (x + 1 < width) gray[y * width + (x + 1)] += error * (7/16);
      if (y + 1 < height) {
        if (x - 1 >= 0) gray[(y+1)*width + (x-1)] += error * (3/16);
        gray[(y+1)*width + x] += error * (5/16);
        if (x + 1 < width) gray[(y+1)*width + (x+1)] += error * (1/16);
      }
    }
  }
}

function applyOrderedDithering(gray, width, height) {
  const bayer2x2 = [[0,2],[3,1]];
  const size = 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const threshold = ((bayer2x2[y % size][x % size] + 0.5) * (255 / (size * size)));
      gray[idx] = gray[idx] < threshold ? 0 : 255;
    }
  }
}

function applyNoiseDithering(gray, width, height) {
  const threshold = 128;
  for (let i = 0; i < gray.length; i++) {
    const noise = (Math.random() - 0.5) * 50;
    gray[i] = (gray[i] + noise) < threshold ? 0 : 255;
  }
}

// 12) EXPORT BUTTON & SVG
exportBtn.onclick = async () => {
  if (!scaleMedia.isLoaded && !colorMedia.isLoaded) {
    alert('No media loaded to export!');
    return;
  }
  const frameCount = parseInt(prompt('How many frames to export?'), 10);
  if (isNaN(frameCount) || frameCount <= 0) {
    alert('Invalid frame count.');
    return;
  }
  const fps = 60;
  const zip = new JSZip();
  if (animationId) cancelAnimationFrame(animationId);
  if (scaleMedia.isLoaded && scaleMedia.isVideo) scaleMedia.mediaElement.currentTime = 0;
  if (colorMedia.isLoaded && colorMedia.isVideo) colorMedia.mediaElement.currentTime = 0;
  await Promise.all([
    scaleMedia.isLoaded && scaleMedia.isVideo ? waitForSeek(scaleMedia.mediaElement) : Promise.resolve(),
    colorMedia.isLoaded && colorMedia.isVideo ? waitForSeek(colorMedia.mediaElement) : Promise.resolve()
  ]);
  for (let f = 0; f < frameCount; f++) {
    const svgContent = renderHalftoneFrameAsSVG();
    const filename = `halftone_frame_${String(f).padStart(3, '0')}.svg`;
    zip.file(filename, svgContent);
    if (scaleMedia.isLoaded && scaleMedia.isVideo)
      scaleMedia.mediaElement.currentTime = (scaleMedia.mediaElement.currentTime + 1 / fps) % scaleMedia.mediaElement.duration;
    if (colorMedia.isLoaded && colorMedia.isVideo)
      colorMedia.mediaElement.currentTime = (colorMedia.mediaElement.currentTime + 1 / fps) % colorMedia.mediaElement.duration;
    await Promise.all([
      scaleMedia.isLoaded && scaleMedia.isVideo ? waitForSeek(scaleMedia.mediaElement) : Promise.resolve(),
      colorMedia.isLoaded && colorMedia.isVideo ? waitForSeek(colorMedia.mediaElement) : Promise.resolve()
    ]);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'frames.zip';
  link.click();
  URL.revokeObjectURL(url);
  startRenderLoop();
};

function waitForSeek(video) {
  return new Promise(resolve => {
    const onSeek = () => { video.removeEventListener('seeked', onSeek); resolve(); };
    video.addEventListener('seeked', onSeek);
  });
}

// 13) Render SVG for Export
function renderHalftoneFrameAsSVG() {
  const scaleData = scaleMedia.isLoaded ? scaleMedia.getFrameImageData(canvas.width, canvas.height) : null;
  const colorData = colorMedia.isLoaded ? colorMedia.getFrameImageData(canvas.width, canvas.height) : null;
  let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
  let scaleGray = null;
  if (scaleData) {
    scaleGray = convertToGrayscaleFloat(scaleData);
    applyBrightnessContrastGamma(scaleGray, canvas.width, canvas.height,
      parseInt(brightnessInput.value, 10),
      parseInt(contrastInput.value, 10),
      parseFloat(gammaInput.value));
    scaleGray = applyBoxBlur(scaleGray, canvas.width, canvas.height, parseFloat(smoothingInput.value));
    applyDithering(scaleGray, canvas.width, canvas.height, ditherSelect.value);
    if (invertScaleCheckbox.checked)
      for (let i = 0; i < scaleGray.length; i++) { scaleGray[i] = 255 - scaleGray[i]; }
  }
  const cellSize = getCellSize();
  for (let y = 0; y < canvas.height; y += cellSize)
    for (let x = 0; x < canvas.width; x += cellSize) {
      const radius = computeBrightnessRadius(scaleGray, x, y);
      if (radius <= 0.5) continue;
      let fill = (colorModeSelect.value === 'noise')
        ? getColorFromGradient(Math.random(), gradientSlider.getStops())
        : getFillColor(x, y, scaleGray, colorData);
      svg += `<circle cx="${x + cellSize/2}" cy="${y + cellSize/2}" r="${radius}" fill="${fill}" />`;
    }
  svg += '</svg>';
  return svg;
}

// 14) Get Cell Size
function getCellSize() {
  return parseInt(cellSizeInput.value, 10) || 10;
}

// 15) Invert HEX Color
function invertHexColor(hex) {
  hex = hex.replace('#', '');
  const num = parseInt(hex, 16);
  const inv = 0xFFFFFF - num;
  return '#' + inv.toString(16).padStart(6, '0');
}

/*************************************************
 * Compact Settings Encoding/Decoding & Settings Code Sync
 *************************************************/
function encodeSettingsCompact() {
  const stops = gradientSlider.getStops().slice(0, 5);
  const count = stops.length;
  const totalBytes = 10 + 1 + count * 3;
  const buffer = new ArrayBuffer(totalBytes);
  const view = new DataView(buffer);
  let i = 0;
  
  view.setUint8(i++, parseInt(brightnessInput.value, 10) + 100);
  view.setUint8(i++, Math.max(0, Math.min(255, parseInt(contrastInput.value, 10) + 128)));
  view.setUint8(i++, Math.max(1, Math.min(50, Math.round(parseFloat(gammaInput.value) * 10))));
  view.setUint8(i++, Math.max(0, Math.min(30, Math.round(parseFloat(smoothingInput.value) * 10))));
  view.setUint8(i++, parseInt(cellSizeInput.value, 10) - 5);
  view.setUint8(i++, Math.max(1, Math.min(50, Math.round(parseFloat(dotScaleInput.value) * 10))));
  
  const ditherOptions = ["None", "FloydSteinberg", "Ordered", "Noise"];
  const ditherIndex = ditherOptions.indexOf(ditherSelect.value);
  view.setUint8(i++, ditherIndex >= 0 ? ditherIndex : 0);
  
  view.setUint8(i++, invertScaleCheckbox.checked ? 1 : 0);
  view.setUint8(i++, Math.round((parseInt(hueInput.value, 10) + 180) / 360 * 255));
  
  const colorModeOptions = ["gradientX", "gradientY", "gradientLum1", "gradientLum2", "imageSecondary", "noise", "checkered"];
  const colorModeIndex = colorModeOptions.indexOf(colorModeSelect.value);
  view.setUint8(i++, colorModeIndex >= 0 ? colorModeIndex : 0);
  
  view.setUint8(i++, count);
  stops.forEach(stop => {
    view.setUint8(i++, Math.round(stop.position));
    const hex = stop.color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const r5 = Math.round(r / 255 * 31);
    const g6 = Math.round(g / 255 * 63);
    const b5 = Math.round(b / 255 * 31);
    const rgb565 = (r5 << 11) | (g6 << 5) | b5;
    view.setUint16(i, rgb565);
    i += 2;
  });
  
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let j = 0; j < bytes.length; j++) {
    binary += String.fromCharCode(bytes[j]);
  }
  const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64;
}

function decodeSettingsCompact(code) {
  code = code.replace(/-/g, '+').replace(/_/g, '/');
  while (code.length % 4) { code += '='; }
  const binary = atob(code);
  const bytes = new Uint8Array(binary.length);
  for (let j = 0; j < binary.length; j++) {
    bytes[j] = binary.charCodeAt(j);
  }
  const view = new DataView(bytes.buffer);
  let i = 0;
  brightnessInput.value = view.getUint8(i++) - 100;
  contrastInput.value   = view.getUint8(i++) - 128;
  gammaInput.value      = (view.getUint8(i++) / 10).toFixed(1);
  smoothingInput.value  = (view.getUint8(i++) / 10).toFixed(1);
  cellSizeInput.value   = view.getUint8(i++) + 5;
  dotScaleInput.value   = (view.getUint8(i++) / 10).toFixed(1);
  
  const ditherIndex = view.getUint8(i++);
  const ditherOptions = ["None", "FloydSteinberg", "Ordered", "Noise"];
  ditherSelect.value = ditherOptions[ditherIndex] || "None";
  
  invertScaleCheckbox.checked = view.getUint8(i++) === 1;
  hueInput.value = Math.round(view.getUint8(i++) / 255 * 360) - 180;
  
  const colorModeIndex = view.getUint8(i++);
  const colorModeOptions = ["gradientX", "gradientY", "gradientLum1", "gradientLum2", "imageSecondary", "noise", "checkered"];
  colorModeSelect.value = colorModeOptions[colorModeIndex] || "gradientX";
  
  const count = view.getUint8(i++);
  const stops = [];
  for (let s = 0; s < count; s++) {
    const pos = view.getUint8(i++);
    const rgb565 = view.getUint16(i);
    i += 2;
    const r5 = (rgb565 >> 11) & 0x1F;
    const g6 = (rgb565 >> 5) & 0x3F;
    const b5 = rgb565 & 0x1F;
    const r = Math.round(r5 / 31 * 255);
    const g = Math.round(g6 / 63 * 255);
    const b = Math.round(b5 / 31 * 255);
    const col = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    stops.push({ position: pos, color: col });
  }
  gradientSlider.stops = stops.slice(0, 5);
  gradientSlider.rebuildStops();
  gradientSlider.updateGradient();
  
  // Dispatch events to update display numbers and trigger any change listeners
  brightnessInput.dispatchEvent(new Event('input'));
  contrastInput.dispatchEvent(new Event('input'));
  gammaInput.dispatchEvent(new Event('input'));
  smoothingInput.dispatchEvent(new Event('input'));
  cellSizeInput.dispatchEvent(new Event('input'));
  dotScaleInput.dispatchEvent(new Event('input'));
  hueInput.dispatchEvent(new Event('input'));
  ditherSelect.dispatchEvent(new Event('change'));
  colorModeSelect.dispatchEvent(new Event('change'));

  updateSettingsCode();
}

function updateSettingsCode() {
  const code = encodeSettingsCompact();
  document.getElementById('settingsCode').value = code;
}

document.addEventListener('DOMContentLoaded', () => {
  const updateIDs = ['brightness', 'contrast', 'gamma', 'smoothing', 'cellSize', 'dotScale', 'hue'];
  updateIDs.forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', updateSettingsCode);
  });
  document.getElementById('ditherType').addEventListener('change', updateSettingsCode);
  document.getElementById('colorMode').addEventListener('change', updateSettingsCode);
  document.getElementById('invertScale').addEventListener('change', updateSettingsCode);

  // Patch gradientSlider.updateGradient to call updateSettingsCode after updating.
  const originalUpdateGradient = gradientSlider.updateGradient.bind(gradientSlider);
  gradientSlider.updateGradient = function() {
    originalUpdateGradient();
    updateSettingsCode();
  };

  const applyBtn = document.getElementById('applySettings');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const code = document.getElementById('settingsCode').value.trim();
      if (code) decodeSettingsCompact(code);
    });
  }
  
  updateSettingsCode();
});

/*************************************************
 * Randomize Settings Handler
 *************************************************/
document.getElementById('randomize').addEventListener('click', () => {
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const randomFloat = (min, max, step) => {
    const steps = Math.floor((max - min) / step);
    return (Math.floor(Math.random() * (steps + 1)) * step + min).toFixed(1);
  };

  const brightnessVal = randomInt(-100, 100);
  document.getElementById('brightness').value = brightnessVal;
  document.getElementById('brightness').dispatchEvent(new Event('input'));

  const contrastVal = randomInt(-128, 128);
  document.getElementById('contrast').value = contrastVal;
  document.getElementById('contrast').dispatchEvent(new Event('input'));

  const gammaVal = randomFloat(0.1, 5, 0.1);
  document.getElementById('gamma').value = gammaVal;
  document.getElementById('gamma').dispatchEvent(new Event('input'));

  const smoothingVal = randomFloat(0, 3, 0.1);
  document.getElementById('smoothing').value = smoothingVal;
  document.getElementById('smoothing').dispatchEvent(new Event('input'));

  const cellSizeVal = randomInt(5, 50);
  document.getElementById('cellSize').value = cellSizeVal;
  document.getElementById('cellSize').dispatchEvent(new Event('input'));

  const dotScaleVal = randomFloat(0.1, 5, 0.1);
  document.getElementById('dotScale').value = dotScaleVal;
  document.getElementById('dotScale').dispatchEvent(new Event('input'));

  const hueVal = randomInt(-180, 180);
  document.getElementById('hue').value = hueVal;
  document.getElementById('hue').dispatchEvent(new Event('input'));

  // Randomize dithering type
  const ditherOptions = ["None", "FloydSteinberg", "Ordered", "Noise"];
  const randomDither = ditherOptions[Math.floor(Math.random() * ditherOptions.length)];
  document.getElementById('ditherType').value = randomDither;
  document.getElementById('ditherType').dispatchEvent(new Event('change'));

  // Randomize color mode
  const colorModeOptions = ["gradientX", "gradientY", "gradientLum1", "gradientLum2", "imageSecondary", "noise", "checkered"];
  const randomColorMode = colorModeOptions[Math.floor(Math.random() * colorModeOptions.length)];
  document.getElementById('colorMode').value = randomColorMode;
  document.getElementById('colorMode').dispatchEvent(new Event('change'));
});

/*************************************************
 * Page Visibility API Handling
 *************************************************/
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    lastFrameTime = performance.now();
    accumulatedTime = 0;
    
    if (scaleMedia.isVideo && scaleMedia.mediaElement && scaleMedia.mediaElement.paused) {
      scaleMedia.mediaElement.play();
    }
    if (colorMedia.isVideo && colorMedia.mediaElement && colorMedia.mediaElement.paused) {
      colorMedia.mediaElement.play();
    }
    
    if (!animationId) {
      startRenderLoop();
    }
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }
});
