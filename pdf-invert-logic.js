// Variable selection matching your HTML IDs
const pdfInput = document.getElementById('pdfInput');
const dropZone = document.getElementById('pdfDropZone'); // Matching your HTML ID
const loader = document.getElementById('loader'); // Check if loader exists in HTML
const resultSection = document.getElementById('pdfResultArea'); // Matching your HTML ID
const pdfPreview = document.getElementById('pdfPreview');
const downloadBtn = document.getElementById('downloadPdfBtn'); // Matching your HTML ID
const modeToggle = document.getElementById('modeToggle');
const labelBefore = document.getElementById('labelBefore');
const labelAfter = document.getElementById('labelAfter');
const statusText = document.getElementById('pdfStatusText');

let originalBlobUrl = null;
let invertedBlobUrl = null;
let currentFileName = "";

// --- Drag & Drop Handlers ---
dropZone.ondragover = (e) => { 
    e.preventDefault(); 
    dropZone.style.backgroundColor = "#eef2f7";
    dropZone.style.borderColor = "#0d6efd";
};

dropZone.ondragleave = () => {
    dropZone.style.backgroundColor = "#f8f9fa";
    dropZone.style.borderColor = "#0d6efd";
};

dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = "#f8f9fa";
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") processPDF(file);
};

// Click to upload support
dropZone.onclick = () => pdfInput.click();
pdfInput.onchange = (e) => processPDF(e.target.files[0]);

async function processPDF(file) {
    if (!file) return;
    
    currentFileName = file.name;
    // UI Updates
    statusText.innerText = "Selected: " + currentFileName;
    document.getElementById('pdfSettings').style.display = "block";
    document.getElementById('selectedFileName').innerText = "File: " + currentFileName;
    
    // Hide old results if any
    resultSection.style.display = "none";
}

// Invert Button Click (Triggering the heavy work)
document.getElementById('invertBtn').onclick = async () => {
    const file = pdfInput.files[0] || null;
    if(!file && !originalBlobUrl) return alert("Please select a PDF first!");

    document.getElementById('invertBtn').innerText = "Processing...";
    document.getElementById('invertBtn').disabled = true;

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // 1. Create/Store Original URL for Comparison
        if (originalBlobUrl) URL.revokeObjectURL(originalBlobUrl);
        originalBlobUrl = URL.createObjectURL(new Blob([arrayBuffer], {type: 'application/pdf'}));

        // 2. Create Inverted PDF using PDF-Lib
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawRectangle({
                x: 0, y: 0, width, height,
                color: PDFLib.rgb(1, 1, 1),
                blendMode: PDFLib.BlendMode.Difference,
            });
        });

        const invertedBytes = await pdfDoc.save();
        if (invertedBlobUrl) URL.revokeObjectURL(invertedBlobUrl);
        invertedBlobUrl = URL.createObjectURL(new Blob([invertedBytes], {type: 'application/pdf'}));

        // Show Inverted by default on success
        modeToggle.checked = true;
        updatePreview();
        resultSection.style.display = "block";
        
        // Scroll to preview
        resultSection.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        alert("Error processing PDF!");
        console.error(err);
    } finally {
        document.getElementById('invertBtn').innerText = "Invert Colors & Preview";
        document.getElementById('invertBtn').disabled = false;
    }
};

// --- Toggle Logic (Before/After) ---
modeToggle.onchange = () => updatePreview();

function updatePreview() {
    if (modeToggle.checked) {
        pdfPreview.src = invertedBlobUrl;
        labelAfter.style.fontWeight = "bold"; labelAfter.style.color = "#1d3557";
        labelBefore.style.fontWeight = "normal"; labelBefore.style.color = "#666";
    } else {
        pdfPreview.src = originalBlobUrl;
        labelBefore.style.fontWeight = "bold"; labelBefore.style.color = "#1d3557";
        labelAfter.style.fontWeight = "normal"; labelAfter.style.color = "#666";
    }
}

// Final Download
downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.href = invertedBlobUrl;
    link.download = "NightMode_SHC_" + currentFileName;
    link.click();
};