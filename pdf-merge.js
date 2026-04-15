const { jsPDF } = window.jspdf;
const { PDFDocument } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const pdfInput = document.getElementById('pdfInput');
const pdfDropZone = document.getElementById('pdfDropZone');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
const fastMergeBtn = document.getElementById('fastMergeBtn');
const actionButtons = document.getElementById('actionButtons');
const pdfResultArea = document.getElementById('pdfResultArea');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const targetKbInput = document.getElementById('targetKb');
const finalPdfSize = document.getElementById('finalPdfSize');
const previewContainer = document.getElementById('previewContainer');

let selectedFiles = [];
let mergedPdfBlobUrl = null;

pdfDropZone.addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
    const newFiles = Array.from(files).filter(f => f.type === "application/pdf");
    selectedFiles = [...selectedFiles, ...newFiles];
    updateUI();
}

function updateUI() {
    fileList.innerHTML = selectedFiles.length > 0 ? `<p style="font-weight:bold; margin-bottom:10px;">Selected Files (${selectedFiles.length}):</p>` : "";
    selectedFiles.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = "file-item";
        item.innerHTML = `<span><i class="fas fa-file-pdf" style="color:#e74c3c"></i> ${f.name}</span>
            <div>
                <i class="fas fa-arrow-up" style="cursor:pointer; color:#0d6efd; margin-right:12px;" onclick="moveFile(${i}, -1)"></i>
                <i class="fas fa-trash-alt" style="color:red; cursor:pointer;" onclick="removeFile(${i})"></i>
            </div>`;
        fileList.appendChild(item);
    });
    const hasFiles = selectedFiles.length > 0;
    actionButtons.style.display = hasFiles ? 'flex' : 'none';
    document.getElementById('resizeOptionBox').style.display = hasFiles ? 'block' : 'none';
}

window.moveFile = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < selectedFiles.length) {
        [selectedFiles[idx], selectedFiles[newIdx]] = [selectedFiles[newIdx], selectedFiles[idx]];
        updateUI();
    }
};

window.removeFile = (i) => { selectedFiles.splice(i, 1); updateUI(); };
document.getElementById('resetPdfBtn').onclick = () => location.reload();

// Fast Merge (Original Quality)
fastMergeBtn.addEventListener('click', async () => {
    fastMergeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Merging...`;
    try {
        const mergedPdf = await PDFDocument.create();
        for (const f of selectedFiles) {
            const pdf = await PDFDocument.load(await f.arrayBuffer());
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
        }
        showResult(new Blob([await mergedPdf.save()], { type: 'application/pdf' }));
    } catch(e) { alert("Error merging PDFs"); }
    fastMergeBtn.innerHTML = `<i class="fas fa-bolt"></i> Fast Merge`;
});

// --- NEW ULTRA-PRECISION MERGE & RESIZE LOGIC ---
mergeBtn.addEventListener('click', async () => {
    const targetKb = parseFloat(targetKbInput.value);
    if (!targetKb) return alert("Please enter Target KB");

    mergeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Target: ${targetKb}KB...`;
    mergeBtn.disabled = true;
    
    try {
        // Step 1: Strict Dynamic DPI Scaling
        let scale = targetKb > 1500 ? 5.5 : (targetKb > 800 ? 4.0 : 2.5);

        const getCanvases = async (s) => {
            let canvases = [];
            for (const f of selectedFiles) {
                const pdf = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
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
            }
            return canvases;
        };

        let pagesCanvas = await getCanvases(scale);

        // Step 2: Extreme Precision Binary Search (35 Iterations)
        let minQ = 0.0001, maxQ = 1.0, bestBlob = null, bestSize = 0;

        for (let i = 0; i < 35; i++) {
            let q = (minQ + maxQ) / 2;
            const outPdf = new jsPDF({
                orientation: 'p',
                unit: 'pt',
                format: 'a4',
                compress: false
            });

            const pWidth = outPdf.internal.pageSize.getWidth();
            const pHeight = outPdf.internal.pageSize.getHeight();

            pagesCanvas.forEach((c, idx) => {
                if (idx > 0) outPdf.addPage();
                const imgData = c.toDataURL('image/jpeg', q);
                outPdf.addImage(imgData, 'JPEG', 0, 0, pWidth, pHeight, undefined, 'NONE');
            });
            
            const tempBlob = outPdf.output('blob');
            const currentSizeKb = tempBlob.size / 1024;

            if (currentSizeKb <= targetKb) {
                if (currentSizeKb > bestSize) {
                    bestSize = currentSizeKb;
                    bestBlob = tempBlob;
                }
                minQ = q;
            } else {
                maxQ = q;
            }

            // --- AUTO-CORRECTION IF UNDERWEIGHT ---
            if (i === 20 && bestSize < targetKb * 0.85 && scale < 8) {
                scale += 2.0;
                pagesCanvas = await getCanvases(scale);
                minQ = 0.5; // High Scale par quality firse check karein
            }

            // 10KB Tolerance Break
            if (currentSizeKb <= targetKb && (targetKb - currentSizeKb) <= 10) break;
        }

        if (bestBlob) {
            showResult(bestBlob);
        } else {
            alert("Could not reach target accurately. Try a higher KB.");
        }

    } catch(e) { 
        alert("Precision error during Merge-Resize."); 
        console.error(e);
    } finally {
        mergeBtn.innerHTML = `<i class="fas fa-compress-arrows-alt"></i> Merge & Resize`;
        mergeBtn.disabled = false;
    }
});

function showResult(blob) {
    if (mergedPdfBlobUrl) URL.revokeObjectURL(mergedPdfBlobUrl);
    mergedPdfBlobUrl = URL.createObjectURL(blob);
    previewContainer.innerHTML = `<iframe src="${mergedPdfBlobUrl}" style="width:100%; height:400px; border-radius:12px; border:1px solid #ddd;"></iframe>`;
    finalPdfSize.innerText = `Final Size: ${(blob.size / 1024).toFixed(2)} KB`;
    pdfResultArea.style.display = 'block';
    pdfResultArea.scrollIntoView({ behavior: 'smooth' });
}

downloadPdfBtn.onclick = () => {
    const name = document.getElementById('customFileName').value.trim() || "Merged_Document_SHC";
    const a = document.createElement('a');
    a.href = mergedPdfBlobUrl;
    a.download = `${name}.pdf`;
    a.click();
};