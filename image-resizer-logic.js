(function() {
    // इंतज़ार करें जब तक DOM पूरी तरह लोड न हो जाए
    document.addEventListener("DOMContentLoaded", function() {
        
        const imageInput = document.getElementById('imageInput');
        const dropZone = document.getElementById('dropZone');
        const settingsArea = document.getElementById('settingsArea');
        const resizeBtn = document.getElementById('resizeBtn');
        const resultArea = document.getElementById('resultArea');
        const finalImageSize = document.getElementById('finalImageSize');
        const downloadBtn = document.getElementById('downloadBtn');
        const targetKbInput = document.getElementById('targetKb');
        const targetWidthInput = document.getElementById('targetWidth');
        const targetHeightInput = document.getElementById('targetHeight');
        const cropperContainer = document.getElementById('cropperContainer');
        const cropperImage = document.getElementById('cropperImage');

        let resizedBlob = null;
        let cropperInstance = null;

        // 1. Force Click Trigger
        if (dropZone && imageInput) {
            dropZone.addEventListener('click', function() {
                console.log("Dropzone clicked");
                imageInput.click();
            });
        }

        // 2. File Selection Handler
        if (imageInput) {
            imageInput.addEventListener('change', function(e) {
                console.log("File input changed");
                if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                }
            });
        }

        function handleFile(file) {
            if (!file.type.startsWith('image/')) return alert("Please select an image file.");
            
            const reader = new FileReader();
            reader.onload = function(e) {
                if (cropperInstance) { cropperInstance.destroy(); }
                
                cropperImage.src = e.target.result;
                settingsArea.style.display = 'block';
                cropperContainer.style.display = 'block';
                resultArea.style.display = 'none';

                // Initialize Cropper
                cropperInstance = new Cropper(cropperImage, {
                    aspectRatio: NaN,
                    viewMode: 1,
                    autoCropArea: 0.9,
                    responsive: true,
                    dragMode: 'crop'
                });
                
                settingsArea.scrollIntoView({ behavior: 'smooth' });
            };
            reader.readAsDataURL(file);
        }

        // 3. Precision Resize Logic
        if (resizeBtn) {
            resizeBtn.addEventListener('click', async function() {
                if (!cropperInstance) return;

                const targetKb = parseFloat(targetKbInput.value);
                const userW = parseInt(targetWidthInput.value);
                const userH = parseInt(targetHeightInput.value);

                if (!targetKb) return alert("Please enter Target KB");

                resizeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
                resizeBtn.disabled = true;

                const croppedCanvas = cropperInstance.getCroppedCanvas();
                const finalW = userW || croppedCanvas.width;
                const finalH = userH || croppedCanvas.height;

                const finalCanvas = document.createElement('canvas');
                const fCtx = finalCanvas.getContext('2d');
                finalCanvas.width = finalW;
                finalCanvas.height = finalH;

                fCtx.imageSmoothingEnabled = true;
                fCtx.imageSmoothingQuality = 'high';
                fCtx.drawImage(croppedCanvas, 0, 0, finalW, finalH);

                let minQ = 0.01, maxQ = 0.99, bestBlob = null;

                for (let i = 0; i < 30; i++) {
                    let q = (minQ + maxQ) / 2;
                    const blob = await new Promise(res => finalCanvas.toBlob(res, 'image/jpeg', q));
                    let currentSize = blob.size / 1024;

                    if (currentSize <= targetKb) {
                        bestBlob = blob;
                        minQ = q;
                    } else {
                        maxQ = q;
                    }
                    if (currentSize <= targetKb && (targetKb - currentSize) < 1) break;
                }

                resizedBlob = bestBlob || await new Promise(res => finalCanvas.toBlob(res, 'image/jpeg', 0.1));

                finalImageSize.innerHTML = `Final Size: ${(resizedBlob.size / 1024).toFixed(2)} KB <br> <small>${finalW}x${finalH} px</small>`;
                resultArea.style.display = 'block';
                resizeBtn.innerHTML = `Crop & Resize Image`;
                resizeBtn.disabled = false;
                resultArea.scrollIntoView({ behavior: 'smooth' });
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', function() {
                if (!resizedBlob) return;
                const a = document.createElement('a');
                a.href = URL.createObjectURL(resizedBlob);
                a.download = `SHC_Resized_${targetKbInput.value}KB.jpg`;
                a.click();
            });
        }
    });
})();