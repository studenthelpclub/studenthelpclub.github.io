const imageInput = document.getElementById('imageInput');
const dropZone = document.getElementById('dropZone');
const settingsArea = document.getElementById('settingsArea');
const previewImg = document.getElementById('previewImg');
const resizeBtn = document.getElementById('resizeBtn');
const resultArea = document.getElementById('resultArea');
const finalImageSize = document.getElementById('finalImageSize');
const downloadBtn = document.getElementById('downloadBtn');
const targetKbInput = document.getElementById('targetKb');

let resizedBlob = null;

// File Selection
dropZone.addEventListener('click', () => imageInput.click());
imageInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

// Drag & Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.backgroundColor = "#e9f7ef"; });
dropZone.addEventListener('dragleave', () => { dropZone.style.backgroundColor = "#f8fbff"; });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = "#f8fbff";
    handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return alert("Please select an image file.");
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        settingsArea.style.display = 'block';
        resultArea.style.display = 'none';
        settingsArea.scrollIntoView({ behavior: 'smooth' });
    };
    reader.readAsDataURL(file);
}

// Precision Resize Logic (Binary Search)
resizeBtn.addEventListener('click', async () => {
    const targetKb = parseFloat(targetKbInput.value);
    if (!targetKb) return alert("Please enter Target KB");

    resizeBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
    resizeBtn.disabled = true;
    
    const img = new Image();
    img.src = previewImg.src;

    img.onload = async () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        let minQ = 0.01, maxQ = 0.98, currentQ = 0.5;
        let lastBlob = null;

        for (let i = 0; i < 10; i++) {
            currentQ = (minQ + maxQ) / 2;
            const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', currentQ));
            if ((blob.size / 1024) > targetKb) maxQ = currentQ;
            else { minQ = currentQ; lastBlob = blob; }
        }

        resizedBlob = lastBlob || await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.01));
        finalImageSize.innerText = `Final Size: ${(resizedBlob.size / 1024).toFixed(2)} KB`;
        resultArea.style.display = 'block';
        resizeBtn.innerHTML = `Resize Image`;
        resizeBtn.disabled = false;
        resultArea.scrollIntoView({ behavior: 'smooth' });
    };
});

downloadBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(resizedBlob);
    a.download = `SHC_Image_${targetKbInput.value}KB.jpg`;
    a.click();
});