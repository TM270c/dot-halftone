/*************************************************
 * script.js
 *************************************************/

// 1) MEDIA HANDLER
class MediaHandler {
    constructor() {
      this.mediaElement = null; // <video> or <img>
      this.isVideo = false;
      this.isLoaded = false;
      this.width = 0;
      this.height = 0;
    }
    loadFromFile(file) {
      return new Promise((resolve, reject) => {
        if (file.type.startsWith('video/')) {
          this.isVideo = true;
          const v = document.createElement('video');
          v.autoplay = false;
          v.loop = true;
          v.muted = true;
          v.playsInline = true;
          v.src = URL.createObjectURL(file);
          v.addEventListener('loadeddata', () => {
            this.mediaElement = v;
            this.width = v.videoWidth;
            this.height = v.videoHeight;
            this.isLoaded = true;
            resolve();
          });
          v.addEventListener('error', () => reject(new Error('Error loading video file.')));
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
    // New method: load media from a URL (works for both video and image)
    loadFromUrl(url) {
      return new Promise((resolve, reject) => {
        // Check for common video extensions (you may extend this list)
        const videoExtensions = ['mp4', 'webm', 'ogg'];
        const urlLower = url.toLowerCase();
        const isVideo = videoExtensions.some(ext => urlLower.endsWith(ext));
        if (isVideo) {
          this.isVideo = true;
          const v = document.createElement('video');
          v.autoplay = false;
          v.loop = true;
          v.muted = true;
          v.playsInline = true;
          v.crossOrigin = "anonymous"; // To avoid CORS issues if allowed
          v.addEventListener('loadeddata', () => {
            this.mediaElement = v;
            this.width = v.videoWidth;
            this.height = v.videoHeight;
            this.isLoaded = true;
            resolve();
          });
          v.addEventListener('error', () => reject(new Error('Failed to load video from URL.')));
          v.src = url;
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
  
  // Existing file inputs and buttons
  const scaleInput       = document.getElementById('scaleMediaFile');
  const colorInput       = document.getElementById('colorMediaFile');
  const dotShapeFile     = document.getElementById('dotShapeFile');
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
  const cellSizeInput    = document.getElementById('cellSize');  // Cell Size slider
  const dotScaleInput    = document.getElementById('dotScale');    // Dot Scale slider
  
  const invertScaleCheckbox = document.getElementById('invertScale');
  const hueInput         = document.getElementById('hue');
  
  // NEW: References for video URL inputs and load button (added in the header)
  const scaleVideoUrl    = document.getElementById('scaleVideoUrl');
  const colorVideoUrl    = document.getElementById('colorVideoUrl');
  const loadVideoUrlsBtn = document.getElementById('loadVideoUrls');
  
  // Media handler objects (for scale and color)
  let scaleMedia = new MediaHandler();
  let colorMedia = new MediaHandler();
  
  // Global variables for rendering, dot shape, etc.
  let animationId = null;
  let noiseColorCache = {};
  
  let dotShapeImg = null;
  let dotShapeLoaded = false;
  let dotShapeW = 0;
  let dotShapeH = 0;
  
  // 3) NEW: Video URL Loader
  loadVideoUrlsBtn.addEventListener('click', () => {
    const scaleUrl = scaleVideoUrl.value.trim();
    const colorUrl = colorVideoUrl.value.trim();
    
    if (scaleUrl) {
      scaleMedia = new MediaHandler();
      scaleMedia.loadFromUrl(scaleUrl)
        .then(() => {
          if (scaleMedia.isVideo) {
            scaleMedia.mediaElement.currentTime = 0;
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
            colorMedia.mediaElement.play();
          }
          checkAndStartBoth();
        })
        .catch(err => console.error("Error loading color video from URL:", err));
    }
  });
  
  // 4) FILE INPUT EVENT LISTENERS FOR SCALE & COLOR
  scaleInput.onchange = async () => {
    const file = scaleInput.files[0];
    if (!file) return;
    if (animationId) cancelAnimationFrame(animationId);
    noiseColorCache = {};
    scaleMedia = new MediaHandler();
    await scaleMedia.loadFromFile(file);
    if (scaleMedia.isVideo) {
      attachFPSCounter(scaleMedia.mediaElement, 'scaleFPS');
    } else {
      document.getElementById('scaleFPS').textContent = 'FPS: N/A';
    }
    checkAndStartBoth();
  };
  
  colorInput.onchange = async () => {
    const file = colorInput.files[0];
    if (!file) return;
    if (animationId) cancelAnimationFrame(animationId);
    noiseColorCache = {};
    colorMedia = new MediaHandler();
    await colorMedia.loadFromFile(file);
    if (colorMedia.isVideo) {
      attachFPSCounter(colorMedia.mediaElement, 'colorFPS');
    } else {
      document.getElementById('colorFPS').textContent = 'FPS: N/A';
    }
    checkAndStartBoth();
  };
  
  // 5) REMOVE / SWAP MEDIA
  removeScaleBtn.addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    noiseColorCache = {};
    if (scaleMedia.isVideo && scaleMedia.mediaElement) {
      scaleMedia.mediaElement.pause();
    }
    scaleMedia = new MediaHandler();
    scaleInput.value = null;
    document.getElementById('scaleFPS').textContent = 'FPS: --';
    if (colorMedia.isLoaded) {
      setupCanvas();
      startRenderLoop();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
  
  removeColorBtn.addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    noiseColorCache = {};
    if (colorMedia.isVideo && colorMedia.mediaElement) {
      colorMedia.mediaElement.pause();
    }
    colorMedia = new MediaHandler();
    colorInput.value = null;
    document.getElementById('colorFPS').textContent = 'FPS: --';
    if (scaleMedia.isLoaded) {
      setupCanvas();
      startRenderLoop();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
  
  swapBtn.addEventListener('click', () => {
    if (animationId) cancelAnimationFrame(animationId);
    noiseColorCache = {};
    [scaleMedia, colorMedia] = [colorMedia, scaleMedia];
    reattachFPSUI();
    if (scaleMedia.isLoaded) {
      setupCanvas();
      startRenderLoop();
    } else if (colorMedia.isLoaded) {
      canvas.width = 500;
      const ratio = colorMedia.height / colorMedia.width;
      canvas.height = 500 * ratio;
      startRenderLoop();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  });
  
  function reattachFPSUI() {
    if (scaleMedia.isVideo && scaleMedia.isLoaded) {
      attachFPSCounter(scaleMedia.mediaElement, 'scaleFPS');
    } else {
      document.getElementById('scaleFPS').textContent = 'FPS: N/A';
    }
    if (colorMedia.isVideo && colorMedia.mediaElement) {
      attachFPSCounter(colorMedia.mediaElement, 'colorFPS');
    } else {
      document.getElementById('colorFPS').textContent = 'FPS: N/A';
    }
  }
  
  // 6) START OR RESUME RENDERING
  function checkAndStartBoth() {
    if (scaleMedia.isLoaded && colorMedia.isLoaded) {
      if (scaleMedia.isVideo) {
        scaleMedia.mediaElement.currentTime = 0;
        scaleMedia.mediaElement.play();
      }
      if (colorMedia.isVideo) {
        colorMedia.mediaElement.currentTime = 0;
        colorMedia.mediaElement.play();
      }
      setupCanvas();
      startRenderLoop();
    } else if (scaleMedia.isLoaded) {
      if (scaleMedia.isVideo) {
        scaleMedia.mediaElement.currentTime = 0;
        scaleMedia.mediaElement.play();
      }
      setupCanvas();
      startRenderLoop();
    } else if (colorMedia.isLoaded) {
      if (colorMedia.isVideo) {
        colorMedia.mediaElement.currentTime = 0;
        colorMedia.mediaElement.play();
      }
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
  
  // 7) MAIN RENDER LOOP
  function startRenderLoop() {
    (function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    
      // Grab raw image data for scale & color
      const scaleData = scaleMedia.isLoaded ? scaleMedia.getFrameImageData(canvas.width, canvas.height) : null;
      const colorData = colorMedia.isLoaded ? colorMedia.getFrameImageData(canvas.width, canvas.height) : null;
    
      // 7A) Process scale data into a grayscale Float32 array
      let scaleGray = null;
      if (scaleData) {
        scaleGray = convertToGrayscaleFloat(scaleData);
        applyBrightnessContrastGamma(
          scaleGray,
          canvas.width,
          canvas.height,
          parseInt(brightnessInput.value, 10),
          parseInt(contrastInput.value, 10),
          parseFloat(gammaInput.value)
        );
        scaleGray = applyBoxBlur(
          scaleGray,
          canvas.width,
          canvas.height,
          parseFloat(smoothingInput.value)
        );
        applyDithering(
          scaleGray,
          canvas.width,
          canvas.height,
          ditherSelect.value
        );
        if (invertScaleCheckbox.checked) {
          for (let i = 0; i < scaleGray.length; i++) {
            scaleGray[i] = 255 - scaleGray[i];
          }
        }
      }
    
      const cellSize = getCellSize();
    
      // 7B) Halftone loop over each cell
      for (let y = 0; y < canvas.height; y += cellSize) {
        for (let x = 0; x < canvas.width; x += cellSize) {
          const radius = computeBrightnessRadius(scaleGray, x, y);
          if (radius <= 0.5) continue;
          const fill = getFillColor(x, y, scaleGray, colorData);
          if (dotShapeLoaded && dotShapeImg) {
            drawCustomShape(ctx, x + cellSize / 2, y + cellSize / 2, radius, fill);
          } else {
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
          }
        }
      }
    
      animationId = requestAnimationFrame(render);
    })();
  }
    
  // 7B) Helper: Convert ImageData to grayscale Float32 array
  function convertToGrayscaleFloat(imageData) {
    const { data, width } = imageData;
    const gray = new Float32Array(width * imageData.height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const val = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i / 4] = val;
    }
    return gray;
  }
    
  // 8) DRAWING THE CUSTOM SHAPE
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
    const dotScale = parseFloat(dotScaleInput.value);
    const scaleFactor = (2 * radius) / dotShapeW;
    mainCtx.scale(scaleFactor, scaleFactor);
    mainCtx.drawImage(offCanvas, -dotShapeW / 2, -dotShapeH / 2);
    mainCtx.restore();
  }
    
  // 9) COMPUTE DOT RADIUS (using processed grayscale array)
  function computeBrightnessRadius(scaleGray, x, y) {
    const dotScale = parseFloat(dotScaleInput.value);
    const cellSize = getCellSize();
    if (!scaleGray) {
      return (cellSize / 2) * dotScale;
    }
    const width = canvas.width;
    const idx = y * width + x;
    const val = scaleGray[idx];
    return (cellSize / 2) * dotScale * (1 - val / 255);
  }
    
  // 10) COLOR MODES (FILL COLOR)
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
        if (!colorData) {
          base = getColorFromGradient(0, stops);
        } else {
          const idxC = (y * colorData.width + x) * 4;
          const r = colorData.data[idxC],
                g = colorData.data[idxC + 1],
                b = colorData.data[idxC + 2];
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          const factor = brightness / 255;
          base = getColorFromGradient(factor, stops);
        }
        break;
      }
      case 'imageSecondary': {
        if (colorData) {
          const idxC = (y * colorData.width + x) * 4;
          const r = colorData.data[idxC],
                g = colorData.data[idxC + 1],
                b = colorData.data[idxC + 2];
          // Convert to hex string so adjustHue works properly
          base = rgbToHex(r, g, b);
        } else {
          base = 'blue';
        }
        break;
      }
      case 'noise': {
        base = getNoiseGradientColor(x, y, stops);
        break;
      }
      case 'checkered': {
        if (stops.length < 2) {
          const isEven = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
          base = isEven ? '#000' : '#fff';
        } else {
          const firstC = stops[0].color;
          const lastC = stops[stops.length - 1].color;
          const isEven = (Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 0;
          base = isEven ? firstC : lastC;
        }
        break;
      }
      default: {
        const factor = getBrightnessFactor(scaleGray, x, y);
        base = getColorFromGradient(factor, stops);
      }
    }
    
    // Apply hue shift to every computed color.
    const hueVal = parseFloat(hueInput.value) || 0;
    if (hueVal !== 0) {
      base = adjustHue(base, hueVal);
    }
    return base;
  }
    
  // Utility: Return brightness factor [0..1] from scaleGray array.
  function getBrightnessFactor(scaleGray, x, y) {
    if (!scaleGray) return 0;
    const width = canvas.width;
    const idx = y * width + x;
    const val = scaleGray[idx];
    return val / 255;
  }
    
  // 10B) GRADIENT & NOISE UTILS
  function getColorFromGradient(t, stops) {
    const sorted = [...stops].sort((a, b) => a.position - b.position);
    const position = t * 100;
    let left = sorted[0], right = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].position <= position && sorted[i + 1].position >= position) {
        left = sorted[i];
        right = sorted[i + 1];
        break;
      }
    }
    if (left.position === right.position) {
      return left.color;
    }
    const localFactor = (position - left.position) / (right.position - left.position);
    return blendColors(left.color, right.color, localFactor);
  }
    
  function getNoiseGradientColor(x, y, stops) {
    const key = `${x}_${y}`;
    if (!noiseColorCache[key]) {
      const t = Math.random();
      noiseColorCache[key] = getColorFromGradient(t, stops);
    }
    return noiseColorCache[key];
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
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }
    
  function toHex(val) {
    return val.toString(16).padStart(2, '0');
  }
    
  // Hue adjustment helpers
  function adjustHue(hex, hueDegrees) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + hueDegrees) % 360;
    if (hsl.h < 0) hsl.h += 360;
    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  }
    
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length !== 6) return null;
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }
    
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }
    
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
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
    if (s === 0) {
      r = g = b = l;
    } else {
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
    
  // 11) BRIGHTNESS/CONTRAST/GAMMA + SMOOTHING + SMOOTHING + DITHERING
  function applyBrightnessContrastGamma(gray, width, height, brightnessVal, contrastVal, gammaVal) {
    const contrastFactor = (259 * (contrastVal + 255)) / (255 * (259 - contrastVal));
    for (let i = 0; i < gray.length; i++) {
      let val = gray[i];
      val = contrastFactor * (val - 128) + 128;
      val += brightnessVal;
      val = Math.max(0, Math.min(255, val));
      val = 255 * Math.pow(val / 255, 1 / gammaVal);
      gray[i] = val;
    }
  }
    
  function applyBoxBlur(gray, width, height, strength) {
    if (strength <= 0) return gray;
    let result = new Float32Array(gray);
    const passes = Math.floor(strength);
    for (let p = 0; p < passes; p++) {
      let temp = new Float32Array(result.length);
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
    if (frac > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] = gray[i] * (1 - frac) + result[i] * frac;
      }
    }
    return result;
  }
    
  function applyDithering(gray, width, height, ditherType) {
    switch (ditherType) {
      case 'FloydSteinberg':
        applyFloydSteinbergDithering(gray, width, height);
        break;
      case 'Ordered':
        applyOrderedDithering(gray, width, height);
        break;
      case 'Noise':
        applyNoiseDithering(gray, width, height);
        break;
      case 'None':
      default:
        break;
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
        if (x + 1 < width) {
          gray[y * width + (x + 1)] += error * (7 / 16);
        }
        if (y + 1 < height) {
          if (x - 1 >= 0) {
            gray[(y + 1) * width + (x - 1)] += error * (3 / 16);
          }
          gray[(y + 1) * width + x] += error * (5 / 16);
          if (x + 1 < width) {
            gray[(y + 1) * width + (x + 1)] += error * (1 / 16);
          }
        }
      }
    }
  }
    
  function applyOrderedDithering(gray, width, height) {
    const bayer2x2 = [
      [0, 2],
      [3, 1]
    ];
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
    
  // 12) EXPORT BUTTON & SVG (Circles only)
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
    const fps = 30;
    const zip = new JSZip();
    if (animationId) cancelAnimationFrame(animationId);
    if (scaleMedia.isLoaded && scaleMedia.isVideo) {
      scaleMedia.mediaElement.currentTime = 0;
    }
    if (colorMedia.isLoaded && colorMedia.isVideo) {
      colorMedia.mediaElement.currentTime = 0;
    }
    await Promise.all([
      scaleMedia.isLoaded && scaleMedia.isVideo ? waitForSeek(scaleMedia.mediaElement) : Promise.resolve(),
      colorMedia.isLoaded && colorMedia.isVideo ? waitForSeek(colorMedia.mediaElement) : Promise.resolve()
    ]);
    for (let f = 0; f < frameCount; f++) {
      const svgContent = renderHalftoneFrameAsSVG();
      const filename = `halftone_frame_${String(f).padStart(3, '0')}.svg`;
      zip.file(filename, svgContent);
      if (scaleMedia.isLoaded && scaleMedia.isVideo) {
        scaleMedia.mediaElement.currentTime += 1 / fps;
      }
      if (colorMedia.isLoaded && colorMedia.isVideo) {
        colorMedia.mediaElement.currentTime += 1 / fps;
      }
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
      const onSeek = () => {
        video.removeEventListener('seeked', onSeek);
        resolve();
      };
      video.addEventListener('seeked', onSeek);
    });
  }
    
  // 13) RENDER SVG FOR EXPORT (Circles only)
  function renderHalftoneFrameAsSVG() {
    const scaleData = scaleMedia.isLoaded ? scaleMedia.getFrameImageData(canvas.width, canvas.height) : null;
    const colorData = colorMedia.isLoaded ? colorMedia.getFrameImageData(canvas.width, canvas.height) : null;
    let svg = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
    let scaleGray = null;
    if (scaleData) {
      scaleGray = convertToGrayscaleFloat(scaleData);
      applyBrightnessContrastGamma(
        scaleGray,
        canvas.width,
        canvas.height,
        parseInt(brightnessInput.value, 10),
        parseInt(contrastInput.value, 10),
        parseFloat(gammaInput.value)
      );
      scaleGray = applyBoxBlur(
        scaleGray,
        canvas.width,
        canvas.height,
        parseFloat(smoothingInput.value)
      );
      applyDithering(
        scaleGray,
        canvas.width,
        canvas.height,
        ditherSelect.value
      );
      if (invertScaleCheckbox.checked) {
        for (let i = 0; i < scaleGray.length; i++) {
          scaleGray[i] = 255 - scaleGray[i];
        }
      }
    }
    const cellSize = getCellSize();
    for (let y = 0; y < canvas.height; y += cellSize) {
      for (let x = 0; x < canvas.width; x += cellSize) {
        const radius = computeBrightnessRadius(scaleGray, x, y);
        if (radius <= 0.5) continue;
        let fill = (colorModeSelect.value === 'noise')
          ? getNoiseGradientColor(x, y, gradientSlider.getStops())
          : getFillColor(x, y, scaleGray, colorData);
        svg += `<circle cx="${x + cellSize/2}" cy="${y + cellSize/2}" r="${radius}" fill="${fill}" />`;
      }
    }
    svg += '</svg>';
    return svg;
  }
    
  // 14) Utility: Get cell size from slider
  function getCellSize() {
    return parseInt(cellSizeInput.value, 10) || 10;
  }
    
  // 15) Utility: Invert a hex color
  function invertHexColor(hex) {
    hex = hex.replace('#', '');
    const num = parseInt(hex, 16);
    const inv = 0xFFFFFF - num;
    return '#' + inv.toString(16).padStart(6, '0');
  }
  