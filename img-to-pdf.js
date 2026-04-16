const { jsPDF } = window.jspdf;

const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const imageList = document.getElementById('imageList');
const pdfSettings = document.getElementById('pdfSettings');
const convertBtn = document.getElementById('convertBtn');
const resetBtn = document.getElementById('resetBtn');
const resultArea = document.getElementById('resultArea');
const downloadBtn = document.getElementById('downloadBtn');
const previewContainer = document.getElementById('previewContainer');
const orientationSelect = document.getElementById('orientation');

let selectedImages = [];
let finalPdfBlobUrl = null;

dropZone.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImages.push({ 
                name: file.name, 
                src: e.target.result,
                type: file.type // फाइल का असली टाइप (PNG/JPG) सेव करना
            });
            updateUI();
        };
        reader.readAsDataURL(file);
    });
}

function updateUI() {
    imageList.innerHTML = selectedImages.length > 0 ? `<p style="font-weight:bold; margin-bottom:12px;">Images Added (${selectedImages.length}):</p>` : "";
    selectedImages.forEach((img, i) => {
        const item = document.createElement('div');
        item.className = "file-item";
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <img src="${img.src}" style="width:45px; height:45px; border-radius:6px; object-fit:cover; border:1px solid #eee;">
                <span style="font-size:13px; font-weight:500;">${img.name}</span>
            </div>
            <div>
                <i class="fas fa-arrow-up" style="cursor:pointer; color:#198754; margin-right:15px;" onclick="moveImage(${i}, -1)"></i>
                <i class="fas fa-trash-alt" style="color:#dc3545; cursor:pointer;" onclick="removeImage(${i})"></i>
            </div>`;
        imageList.appendChild(item);
    });
    pdfSettings.style.display = selectedImages.length > 0 ? 'block' : 'none';
}

window.moveImage = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx >= 0 && newIdx < selectedFiles.length) {
        [selectedImages[idx], selectedImages[newIdx]] = [selectedImages[newIdx], selectedImages[idx]];
        updateUI();
    }
};

window.removeImage = (i) => { selectedImages.splice(i, 1); updateUI(); };
resetBtn.onclick = () => { selectedImages = []; updateUI(); resultArea.style.display = 'none'; };

// --- HIGH QUALITY PDF LOGIC ---
convertBtn.addEventListener('click', async () => {
    if (selectedImages.length === 0) return;
    
    convertBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Converting in High Quality...`;
    convertBtn.disabled = true;

    // यूनिट को 'pt' (points) में रखने से क्लैरिटी बढ़ती है
    const pdf = new jsPDF({
        orientation: orientationSelect.value,
        unit: 'pt',
        format: 'a4',
        compress: false // इंटरनल कम्प्रेसन बंद
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        if (i > 0) pdf.addPage();

        // इमेज का फॉर्मेट (JPEG/PNG) पहचानना
        const format = img.type.includes('png') ? 'PNG' : 'JPEG';
        
        // 'FAST' के बजाय 'NONE' कम्प्रेशन और हाई रिज़ॉल्यूशन रेंडरिंग
        pdf.addImage(img.src, format, 0, 0, pdfWidth, pdfHeight, undefined, 'NONE');
    }

    const blob = pdf.output('blob');
    if (finalPdfBlobUrl) URL.revokeObjectURL(finalPdfBlobUrl);
    finalPdfBlobUrl = URL.createObjectURL(blob);
    
    previewContainer.innerHTML = `<iframe src="${finalPdfBlobUrl}" style="width:100%; height:400px; border-radius:12px; border:1px solid #ddd;"></iframe>`;
    resultArea.style.display = 'block';
    convertBtn.innerHTML = "Create PDF Now";
    convertBtn.disabled = false;
    resultArea.scrollIntoView({ behavior: 'smooth' });
});

downloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = finalPdfBlobUrl;
    a.download = `HighRes_Images_to_PDF_SHC.pdf`;
    a.click();
};