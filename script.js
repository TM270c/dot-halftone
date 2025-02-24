const fileUpload = document.getElementById('fileUpload');
const secondaryUpload = document.getElementById('secondaryUpload');
const swapButton = document.getElementById('swapButton'); // Swap images button
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const exportSVGButton = document.getElementById('exportSVG');
const invertButton = document.getElementById('invertButton');

// Image controls
const imageWidthInput = document.getElementById('imageWidth');
const brightnessInput = document.getElementById('brightness');
const contrastInput = document.getElementById('contrast');
const gammaInput = document.getElementById('gamma');
const blurInput = document.getElementById('blur');

// Dot controls
const gridSizeInput = document.getElementById('gridSize');
const dotScaleInput = document.getElementById('dotScale');
const gradientModeInput = document.getElementById('gradientMode');

let img = new Image();
let secondaryImg = new Image();
let processedDots = [];
let invertImage = false;
let originalImageData = null;
let secondaryImageData = null;
let halftoneProcessed = false;

// Utility function to update button state
function updateButtonState() {
    swapButton.disabled = !img.src || !secondaryImg.src;
    swapButton.classList.toggle('disabled', !img.src || !secondaryImg.src);

    exportSVGButton.disabled = !halftoneProcessed;
    exportSVGButton.classList.toggle('disabled', !halftoneProcessed);

    invertButton.disabled = !img.src;
    invertButton.classList.toggle('disabled', !img.src);
}

// Initial button state setup
updateButtonState();


// Load Main Image
fileUpload.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        img.src = URL.createObjectURL(file);
        img.onload = function () {
            updateHalftone();
            updateButtonState();
        };
    }
});

// Load Secondary Image
secondaryUpload.addEventListener('change', function (event) {
    const file = event.target.files[0];
    if (file) {
        secondaryImg.src = URL.createObjectURL(file);
        secondaryImg.onload = function () {
            updateSecondaryImage();
            updateButtonState();
        };
    }
});

// Swap Primary and Secondary Images
swapButton.addEventListener('click', function () {
    // Swap the image sources
    [img.src, secondaryImg.src] = [secondaryImg.src, img.src];
    [originalImageData, secondaryImageData] = [secondaryImageData, originalImageData];

    // Reload both images and update their processing
    img.onload = function () {
        updateHalftone();
        updateButtonState();
    };

    secondaryImg.onload = function () {
        updateSecondaryImage();
        updateButtonState();
    };

    // If images are already loaded, trigger updates
    if (img.complete) updateHalftone();
    if (secondaryImg.complete) updateSecondaryImage();
    updateButtonState();
});

// Invert Image
invertButton.addEventListener("click", function () {
    invertImage = !invertImage;
    updateHalftone();
});

// Update halftone when settings change
[imageWidthInput, brightnessInput, contrastInput, gammaInput, blurInput,
    gridSizeInput, dotScaleInput, gradientModeInput].forEach(input => {
        input.addEventListener('input', updateHalftone);
    });

function updateHalftone() {
    if (!img.src) {
        halftoneProcessed = false;
        updateButtonState();
        return;
    }

    const desiredWidth = parseInt(imageWidthInput.value);
    const scaleFactor = desiredWidth / img.width;
    const newHeight = img.height * scaleFactor;

    canvas.width = desiredWidth;
    canvas.height = newHeight;
    ctx.drawImage(img, 0, 0, desiredWidth, newHeight);

    // Store original image data
    originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    updateSecondaryImage(); // Ensure secondary image is also resized

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyAdjustments(imageData);
    halftoneProcessed = true;
    updateButtonState();
}

// Update and Resize Secondary Image
function updateSecondaryImage() {
    if (!secondaryImg.src || !img.src) return;

    const desiredWidth = parseInt(imageWidthInput.value);
    const scaleFactor = desiredWidth / img.width;
    const newHeight = img.height * scaleFactor;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = desiredWidth;
    tempCanvas.height = newHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    tempCtx.drawImage(secondaryImg, 0, 0, desiredWidth, newHeight);
    secondaryImageData = tempCtx.getImageData(0, 0, desiredWidth, newHeight);
}

function applyAdjustments(imageData) {
    let data = imageData.data;
    const brightness = parseFloat(brightnessInput.value);
    const contrast = parseFloat(contrastInput.value);
    const gamma = parseFloat(gammaInput.value);

    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
        let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        gray = contrastFactor * (gray - 128) + 128 + brightness;
        gray = Math.max(0, Math.min(255, gray));
        gray = 255 * Math.pow(gray / 255, 1 / gamma);

        if (invertImage) {
            gray = 255 - gray;
        }

        data[i] = data[i + 1] = data[i + 2] = gray;
    }

    ctx.putImageData(imageData, 0, 0);
    applyHalftone();
}

function applyHalftone() {
    const gridSize = parseInt(gridSizeInput.value);
    const dotScale = parseFloat(dotScaleInput.value);
    const gradientMode = gradientModeInput.value;

    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    processedDots = [];

    for (let y = 0; y < canvas.height; y += gridSize) {
        for (let x = 0; x < canvas.width; x += gridSize) {
            const i = (y * canvas.width + x) * 4;
            let luminance = data[i] / 255;
            const baseRadius = (gridSize / 2) * (1 - luminance);
            const radius = baseRadius * dotScale;

            if (radius > 0.5) {
                let color = getGradientColor(luminance, x, y, gradientMode);
                ctx.beginPath();
                ctx.arc(x + gridSize / 2, y + gridSize / 2, radius, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
        }
    }
}

// Extract colors from images
function getOriginalImageColor(x, y) {
    return getImageColor(originalImageData, x, y);
}

function getSecondaryImageColor(x, y) {
    return getImageColor(secondaryImageData, x, y);
}

function getImageColor(imageData, x, y) {
    if (!imageData) return "black";
    const i = (y * imageData.width + x) * 4;
    const data = imageData.data;
    return `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`;
}

// Get gradient color modes
function getGradientColor(luminance, x, y, mode) {
    let t = luminance;

    switch (mode) {
        case "imgFill":
            return getOriginalImageColor(x, y);
        case "secondary":
            return getSecondaryImageColor(x, y);
        case "dotLuminance":
            return getRainbowColor(luminance);
        case "randomNoise":
            t = Math.random();
            break;
        case "checkered":
            t = ((x + y) % 2 === 0) ? 0.25 : 0.75;
            break;
        case "gradientX":
            t = x / canvas.width;
            break;
        case "gradientY":
            t = y / canvas.height;
            break;
        default:
            return getRainbowColor(luminance);
    }

    return getRainbowColor(t);
}

function getRainbowColor(t) {
    const colors = [
        [255, 0, 0], [255, 165, 0], [255, 255, 0],
        [0, 255, 0], [0, 0, 255], [75, 0, 130], [148, 0, 211]
    ];

    let index = Math.floor(t * (colors.length - 1));
    let nextIndex = Math.min(index + 1, colors.length - 1);
    let blend = (t * (colors.length - 1)) - index;

    let r = Math.round(colors[index][0] * (1 - blend) + colors[nextIndex][0] * blend);
    let g = Math.round(colors[index][1] * (1 - blend) + colors[nextIndex][1] * blend);
    let b = Math.round(colors[index][2] * (1 - blend) + colors[nextIndex][2] * blend);

    return `rgb(${r},${g},${b})`;
}


// Export as SVG
exportSVGButton.addEventListener("click", function () {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
    processedDots.forEach(dot => {
        svg += `<circle cx="${dot.x}" cy="${dot.y}" r="${dot.r}" fill="${dot.color}"/>`;
    });
    svg += `</svg>`;

    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "halftone.svg";
    link.click();
});