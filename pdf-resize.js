const { jsPDF } = window.jspdf;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const pdfInput = document.getElementById('pdfInput');
const pdfDropZone = document.getElementById('pdfDropZone');
const pdfSettings = document.getElementById('pdfSettings');
const selectedFileName = document.getElementById('selectedFileName');
const resizePdfBtn = document.getElementById('resizePdfBtn');
const pdfResultArea = document.getElementById('pdfResultArea');
const finalPdfSize = document.getElementById('finalPdfSize');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const targetKbInput = document.getElementById('targetKb');
const previewContainer = document.getElementById('previewContainer');

let currentFile = null;
let resizedBlobUrl = null;

pdfDropZone.addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (file.type !== "application/pdf") return alert("Please select a valid PDF file.");
    currentFile = file;
    selectedFileName.innerHTML = `<i class="fas fa-file-pdf"></i> Selected: ${file.name} (${(file.size/1024).toFixed(2)} KB)`;
    pdfSettings.style.display = 'block';
    pdfResultArea.style.display = 'none';
    pdfSettings.scrollIntoView({ behavior: 'smooth' });
}

resizePdfBtn.addEventListener('click', async () => {
    const targetKb = parseFloat(targetKbInput.value);
    if (!targetKb) return alert("Enter target KB.");

    resizePdfBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Engine Calibration...`;
    resizePdfBtn.disabled = true;

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfData = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
        // --- STEP 1: High-Density DPI Scaling ---
        let scale = targetKb > 1500 ? 5.5 : (targetKb > 800 ? 4.0 : 2.5);

        const getPages = async (s) => {
            let canvases = [];
            for (let i = 1; i <= pdfData.numPages; i++) {
                const page = await pdfData.getPage(i);
                const viewport = page.getViewport({scale: s});
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height; 
                canvas.width = viewport.width;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                await page.render({canvasContext: ctx, viewport: viewport}).promise;
                canvases.push(canvas);
            }
            return canvases;
        };

        let pagesCanvas = await getPages(scale);

        // --- STEP 2: Strict Binary Search (35 Cycles) ---
        let minQ = 0.0001, maxQ = 1.0, bestBlob = null, bestSize = 0;

        for (let attempt = 0; attempt < 35; attempt++) {
            let q = (minQ + maxQ) / 2;
            const outPdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4',
                compress: false
            });

            const pWidth = outPdf.internal.pageSize.getWidth();
            const pHeight = outPdf.internal.pageSize.getHeight();

            for (let j = 0; j < pagesCanvas.length; j++) {
                if (j > 0) outPdf.addPage();
                const imgData = pagesCanvas[j].toDataURL('image/jpeg', q);
                outPdf.addImage(imgData, 'JPEG', 0, 0, pWidth, pHeight, undefined, 'NONE');
            }
            
            let tempBlob = outPdf.output('blob');
            let currentSize = tempBlob.size / 1024;

            if (currentSize <= targetKb) {
                if (currentSize > bestSize) {
                    bestSize = currentSize;
                    bestBlob = tempBlob;
                }
                minQ = q;
            } else {
                maxQ = q;
            }

            // --- CRITICAL AUTO-CORRECTION ---
            // अगर 20 कोशिशों के बाद भी साइज टारगेट के 85% तक नहीं पहुँचा, तो स्केल बढ़ाकर री-स्टार्ट करें
            if (attempt === 20 && bestSize < targetKb * 0.85 && scale < 8) {
                scale += 2.0;
                pagesCanvas = await getPages(scale);
                minQ = 0.5; // Reset quality search with higher DPI
            }

            // अगर 10KB का फासला मिल गया, तो तुरंत ब्रेक करें
            if (currentSize <= targetKb && (targetKb - currentSize) <= 10) break;
        }

        if (bestBlob) {
            if (resizedBlobUrl) URL.revokeObjectURL(resizedBlobUrl);
            resizedBlobUrl = URL.createObjectURL(bestBlob);
            previewContainer.innerHTML = `<iframe src="${resizedBlobUrl}" style="width:100%; height:400px; border-radius:12px;"></iframe>`;
            finalPdfSize.innerText = `Final Size: ${(bestBlob.size / 1024).toFixed(2)} KB`;
            pdfResultArea.style.display = 'block';
        } else {
            alert("Could not reach target. Try a higher KB.");
        }

    } catch (err) {
        alert("Precision Error.");
        console.error(err);
    } finally {
        resizePdfBtn.innerText = "Compress PDF";
        resizePdfBtn.disabled = false;
    }
});