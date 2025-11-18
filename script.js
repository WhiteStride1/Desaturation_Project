document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('status');
    const announce = (msg) => { if (status) { status.textContent = msg; } };
    // const form = document.getElementById('image-form'); // No longer needed for submit
    const fileInput = document.getElementById('file-input');

    // NEW: Get the form elements
    const saturationSlider = document.getElementById('saturation-slider');
    const saturationOutput = document.getElementById('saturation-output');
    const colorSelectionContainer = document.getElementById('color-selection'); // The fieldset div
    const colorSelectionInputs = document.getElementsByName('target-color'); // Radio buttons

    // Canvases + contexts
    const previewCanvas = document.getElementById('preview-image');
    const previewCtx = previewCanvas.getContext('2d');

    const processedCanvas = document.getElementById('processed-canvas');
    const ctx = processedCanvas.getContext('2d');

    // Store the original image data to redraw the preview efficiently
    let originalImageData = null;

    // ---------- Helpers ----------
    function isImageFile(file) {
        return file && file.type.startsWith('image/');
    }

    function drawImageToCanvas(img, canvas, context) {
        // Set canvas to the image’s intrinsic size
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    // NEW: Update output label when slider moves AND trigger live processing
    saturationSlider.addEventListener('input', () => {
        saturationOutput.textContent = saturationSlider.value + '%';
        if (originalImageData) {
            processImage();
        }
    });
    
    // NEW: Trigger live processing when a color radio button is changed
    colorSelectionContainer.addEventListener('change', (e) => {
        if (e.target.name === 'target-color' && originalImageData) {
            processImage();
        }
    });


    // ---------- Live preview on file select ----------
    fileInput.addEventListener('change', () => {
        announce('Loading image…');
        const file = fileInput.files && fileInput.files[0];
        
        // Clear everything if no file or non-image file is selected
        if (!isImageFile(file)) {
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
            originalImageData = null;
            announce('File input cleared.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 1. Draw the selected image into the "Before Image" canvas
                drawImageToCanvas(img, previewCanvas, previewCtx);

                // 2. Set up the processed canvas size
                processedCanvas.width = previewCanvas.width;
                processedCanvas.height = previewCanvas.height;
                ctx.clearRect(0, 0, processedCanvas.width, processedCanvas.height);

                // 3. Store the original image data for processing
                originalImageData = previewCtx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);

                announce('Image loaded. Processing…');
                
                // 4. Immediately process the image with current settings
                processImage();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // ---------- Your existing functions (rgbToHsv and hsvToRgb remain the same) ----------
    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const cmax = Math.max(r, g, b);
        const cmin = Math.min(r, g, b);
        const delta = cmax - cmin;
        let h = 0;

        if (delta === 0) {
            h = 0;
        } else if (cmax === r) {
            h = (60 * (((g - b) / delta) % 6) + 360) % 360;
        } else if (cmax === g) {
            h = (60 * ((b - r) / delta) + 120) % 360;
        } else if (cmax === b) {
            h = (60 * ((r - g) / delta) + 240) % 360;
        }

        const s = cmax === 0 ? 0 : delta / cmax;
        const v = cmax;

        return { h, s, v };
    }

    function hsvToRgb(h, s, v) {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;

        if (0 <= h && h < 60) {
            r = c; g = x; b = 0;
        } else if (60 <= h && h < 120) {
            r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
            r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
            r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
            r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
            r = c; g = 0; b = x;
        }

        r = Math.round((r + m) * 255);
        g = Math.round((g + m) * 255);
        b = Math.round((b + m) * 255);

        return { r, g, b };
    }

    // ---------- Process (live on change) ----------
    // Remove the form submit listener: form.addEventListener('submit', (e) => { ... })
    // The following function is now called by the event listeners.
    function processImage() {
        if (!originalImageData) {
            announce('No image data to process.');
            return;
        }

        // Get the saturation factor from the slider (0-100, converted to 0.0-1.0)
        const saturationFactor = saturationSlider.value / 100.0;

        // Get the selected color range
        let targetColor = 'blue'; // default
        for (const radio of colorSelectionInputs) {
            if (radio.checked) {
                targetColor = radio.value;
                break;
            }
        }

        // Helper function to check if a hue is within a target color range
        function isTargetHue(h, targetColor) {
            switch (targetColor) {
                case 'red':
                    // Red is at the wrap-around point (0 and 360)
                    // Range: 0°-60° AND 330°-360°
                    return (h >= 0 && h <= 60) || (h >= 330 && h <= 360);
                case 'green':
                    // Range: 60°-185°
                    return h >= 60 && h <= 185;
                case 'blue':
                    // Range: 155°-265° (Teal/Cyan through Blue)
                    return h >= 155 && h <= 265;
                case 'all':
                    // Apply to all hues
                    return true;
                default:
                    return false;
            }
        }

        // Clone the original data to modify it
        const imageData = new ImageData(
            new Uint8ClampedArray(originalImageData.data),
            originalImageData.width,
            originalImageData.height
        );
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            let { h, s, v } = rgbToHsv(r, g, b);

            // Check if hue is within the selected range
            if (isTargetHue(h, targetColor)) {
                // Apply the saturation factor (0.0 to 1.0)
                s *= saturationFactor;
            }

            const { r: newR, g: newG, b: newB } = hsvToRgb(h, s, v);
            data[i] = newR;
            data[i + 1] = newG;
            data[i + 2] = newB;
        }

        ctx.putImageData(imageData, 0, 0);
        announce('Processing complete. Output ready.');
    }

    // Since the submit button is removed/unused, ensure the initial output label is correct
    saturationOutput.textContent = saturationSlider.value + '%';
});