pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const processSettings = document.getElementById('processSettings');
const fileNameDisplay = document.getElementById('fileName');
const convertBtn = document.getElementById('convertBtn');
const progressArea = document.getElementById('progressArea');
const progressStatus = document.getElementById('progressStatus');
const resultArea = document.getElementById('resultArea');
const textPreview = document.getElementById('textPreview');
const downloadBtn = document.getElementById('downloadBtn');

let extractedText = "";

// File Selection
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        fileNameDisplay.innerHTML = `<i class="fas fa-file-alt"></i> Selected: ${e.target.files[0].name}`;
        processSettings.style.display = 'block';
        resultArea.style.display = 'none';
        processSettings.scrollIntoView({ behavior: 'smooth' });
    }
});

// Main Conversion Logic
convertBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    convertBtn.disabled = true;
    progressArea.style.display = 'block';
    extractedText = "";

    try {
        if (file.type === "application/pdf") {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            
            for (let i = 1; i <= pdf.numPages; i++) {
                progressStatus.innerText = `Scanning Page ${i} of ${pdf.numPages}...`;
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({scale: 2.0});
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({canvasContext: ctx, viewport: viewport}).promise;
                
                // OCR on PDF page
                const result = await Tesseract.recognize(canvas, 'eng');
                extractedText += result.data.text + "\n\n";
            }
        } else {
            // OCR on Image
            progressStatus.innerText = "Extracting text from Image...";
            const result = await Tesseract.recognize(file, 'eng');
            extractedText = result.data.text;
        }

        textPreview.value = extractedText;
        resultArea.style.display = 'block';
        progressArea.style.display = 'none';
        resultArea.scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        alert("OCR Error: Document could not be read.");
        console.error(err);
    } finally {
        convertBtn.disabled = false;
        progressArea.style.display = 'none';
    }
});

// Download DOCX
downloadBtn.addEventListener('click', () => {
    const content = textPreview.value.trim();
    if (!content) return alert("No text found to download.");

    const doc = new docx.Document({
        sections: [{
            children: content.split('\n').map(line => new docx.Paragraph({
                children: [new docx.TextRun({ text: line, font: "Arial", size: 24 })]
            }))
        }]
    });

    docx.Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Extracted_Text_SHC.docx");
    });
});