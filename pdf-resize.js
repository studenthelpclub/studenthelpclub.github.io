// TOP LEVEL INITIALIZATION
const { jsPDF } = window.jspdf;
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Elements
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
let globalBestBlob = null; // Asli PDF data yahan rahega

// Event Listeners
pdfDropZone.addEventListener('click', () => pdfInput.click());
pdfInput.addEventListener('change', (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); });

function handleFile(file) {
    if (file.type !== "application/pdf") return alert("Please select a valid PDF file.");
    currentFile = file;
    selectedFileName.innerHTML = `<i class="fas fa-file-pdf"></i> Selected: ${file.name} (${(file.size/1024).toFixed(2)} KB)`;
    pdfSettings.style.display = 'block';
    pdfResultArea.style.display = 'none';
}

resizePdfBtn.addEventListener('click', async () => {
    const targetKb = parseFloat(targetKbInput.value);
    if (!targetKb) return alert("Enter target KB.");

    resizePdfBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    resizePdfBtn.disabled = true;

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdfData = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        
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
                await page.render({canvasContext: ctx, viewport: viewport}).promise;
                canvases.push(canvas);
            }
            return canvases;
        };

        let pagesCanvas = await getPages(scale);
        let minQ = 0.0001, maxQ = 1.0, bestBlob = null, bestSize = 0;

        // Binary Search Logic
        for (let attempt = 0; attempt < 35; attempt++) {
            let q = (minQ + maxQ) / 2;
            const outPdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: false });
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
            if (attempt === 20 && bestSize < targetKb * 0.85 && scale < 8) {
                scale += 2.0;
                pagesCanvas = await getPages(scale);
                minQ = 0.5;
            }
            if (currentSize <= targetKb && (targetKb - currentSize) <= 10) break;
        }

        if (bestBlob) {
            globalBestBlob = bestBlob; // Download ke liye save karein
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            
            previewContainer.innerHTML = ''; // Pehle saaf karein

            if (isMobile) {
                // MOBILE: Pure Canvas Method (No iframe)
                const mCanvas = document.createElement('canvas');
                mCanvas.style.width = "100%";
                mCanvas.style.borderRadius = "10px";
                mCanvas.style.border = "1px solid #ddd";
                previewContainer.appendChild(mCanvas);
                
                const reader = new FileReader();
                reader.onload = async function() {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({scale: 0.5});
                    const context = mCanvas.getContext('2d');
                    mCanvas.height = viewport.height;
                    mCanvas.width = viewport.width;
                    await page.render({canvasContext: context, viewport: viewport}).promise;
                };
                reader.readAsArrayBuffer(bestBlob);
            } else {
                // DESKTOP: Iframe with direct blob object
                const iframe = document.createElement('iframe');
                iframe.src = URL.createObjectURL(bestBlob);
                iframe.style.width = "100%";
                iframe.style.height = "500px";
                iframe.style.border = "1px solid #ddd";
                iframe.style.borderRadius = "10px";
                previewContainer.appendChild(iframe);
            }

            finalPdfSize.innerText = `Final Size: ${(bestBlob.size / 1024).toFixed(2)} KB`;
            pdfResultArea.style.display = 'block';
        }
    } catch (err) {
        alert("Error processing PDF. Please try again.");
    } finally {
        resizePdfBtn.innerText = "Compress PDF";
        resizePdfBtn.disabled = false;
    }
});

// DOWNLOAD BUTTON FIX - Sabse Mazboot Tarika
downloadPdfBtn.onclick = (e) => {
    e.preventDefault(); // Default behaviour rokein
    
    if (!globalBestBlob) {
        alert("File taiyar nahi hai, pehle compress karein!");
        return;
    }

    try {
        // 1. Ek temporary Link banayein
        const link = document.createElement('a');
        const url = window.URL.createObjectURL(globalBestBlob);
        
        // 2. Browser ko batayein ki ye download hai
        link.href = url;
        link.download = `Resized_SHC_${Math.floor(Math.random() * 1000)}.pdf`;
        
        // 3. Mobile Chrome Fix: Link ko DOM mein add karna zaroori hai
        document.body.appendChild(link);
        
        // 4. Click trigger karein
        link.click();
        
        // 5. Kaam hone ke baad saaf-safayi
        document.body.removeChild(link);
        
        // Memory leak na ho isliye revoke thoda ruk kar karein
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 2000);

    } catch (err) {
        console.error("Download failed:", err);
        alert("Download error! Ek baar page refresh karke try karein.");
    }
};
