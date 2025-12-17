document.addEventListener('DOMContentLoaded', () => {
    // DOM ELEMENTS & STATE
    // Core UI elements for input and status announcements
    const fileInput = document.getElementById('file-input');
    const saturationSlider = document.getElementById('saturation-slider');
    const saturationOutput = document.getElementById('saturation-output');
    const colorSelectionContainer = document.getElementById('color-selection');
    const colorSelectionInputs = document.getElementsByName('target-color');

    // Canvass elements for original and prcoessed image display
    const previewCanvas = document.getElementById('preview-image');
    const previewCtx = previewCanvas.getContext('2d');
    const processedCanvas = document.getElementById('processed-canvas');
    const ctx = processedCanvas.getContext('2d');

    // Global variable to hold original pixels for re-processing
    let originalImageData = null;

    // Color Conversion Helpers
    // Converts RGB pixel values (0-255) to HSV format (0-360, 0-1, 0-1)
    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const cmax = Math.max(r, g, b);
        const cmin = Math.min(r, g, b);
        const delta = cmax - cmin;
        let h = 0;
        if (delta === 0) { h = 0; } 
        else if (cmax === r) { h = (60 * (((g - b) / delta) % 6) + 360) % 360; } 
        else if (cmax === g) { h = (60 * ((b - r) / delta) + 120) % 360; } 
        else if (cmax === b) { h = (60 * ((r - g) / delta) + 240) % 360; }
        const s = cmax === 0 ? 0 : delta / cmax;
        const v = cmax;
        return { h, s, v };
    }

    // Converts HSV values back to RGB format for canvas display
    function hsvToRgb(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        if (0 <= h && h < 60) { r = c; g = x; b = 0; } 
        else if (60 <= h && h < 120) { r = x; g = c; b = 0; } 
        else if (120 <= h && h < 180) { r = 0; g = c; b = x; } 
        else if (180 <= h && h < 240) { r = 0; g = x; b = c; } 
        else if (240 <= h && h < 300) { r = x; g = 0; b = c; } 
        else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);
        return { r, g, b };
    }

    // Sizes canvas and draws the image without distortion
    function drawImageToCanvas(img, canvas, context) {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    // Core Processing Logic
    // Loops through original image pixels and modifies saturation based on user settings
    function processImage() {
        if (!originalImageData) return;

        const saturationFactor = saturationSlider.value / 100.0;
        let targetColor = 'blue';
        for (const radio of colorSelectionInputs) {
            if (radio.checked) {
                targetColor = radio.value;
                break;
            }
        }

        // Internal helper to determine if a pixel's hue matches the target radio button
        function isTargetHue(h, targetColor) {
            switch (targetColor) {
                case 'red': return (h >= 345 && h <= 360) || (h >= 0 && h <= 15);
                case 'green': return h >= 80 && h <= 160;
                case 'blue': return h >= 190 && h <= 260;
                case 'all': return true;
                default: return false;
            }
        }

        const imageData = new ImageData(new Uint8ClampedArray(originalImageData.data), originalImageData.width, originalImageData.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            let { h, s, v } = rgbToHsv(data[i], data[i+1], data[i+2]);
            if (isTargetHue(h, targetColor)) { s *= saturationFactor; }
            const { r: newR, g: newG, b: newB } = hsvToRgb(h, s, v);
            data[i] = newR; data[i + 1] = newG; data[i + 2] = newB;
        }
        ctx.putImageData(imageData, 0, 0);
    }

    fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file || !file.type.startsWith('image/')) {
            originalImageData = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                drawImageToCanvas(img, previewCanvas, previewCtx);
                processedCanvas.width = previewCanvas.width;
                processedCanvas.height = previewCanvas.height;
                originalImageData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
                processImage();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    saturationSlider.addEventListener('input', () => {
        saturationOutput.textContent = saturationSlider.value + '%';
        if (originalImageData) processImage();
    });
    
    colorSelectionContainer.addEventListener('change', () => {
        if (originalImageData) processImage();
    });

    saturationOutput.textContent = saturationSlider.value + '%';
});