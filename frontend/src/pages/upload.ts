import { initNavbar, enforceAuthGuard, getSessionUserId, apiUrl } from '../common';

enforceAuthGuard('upload');
initNavbar('upload');

const userId = getSessionUserId() || '';

const dropZone = document.getElementById('drop-zone') as HTMLDivElement | null;
const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
const fileNameDisplay = document.getElementById('file-name-display') as HTMLElement | null;
const clearFileBtn = document.getElementById('clear-file-btn') as HTMLButtonElement | null;
const uploadForm = document.getElementById('twin-upload-form') as HTMLFormElement | null;
const uploadStatus = document.getElementById('upload-status') as HTMLDivElement | null;
const submitBtn = document.getElementById('submit-upload-btn') as HTMLButtonElement | null;
const samplePresetBtn = document.getElementById('sample-preset-btn') as HTMLButtonElement | null;

let selectedFile: File | null = null;

function setFile(file: File | null) {
  selectedFile = file;
  if (fileNameDisplay && clearFileBtn) {
    if (file) {
      fileNameDisplay.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
      clearFileBtn.style.display = 'inline-flex';
      dropZone?.classList.add('hov');
    } else {
      fileNameDisplay.textContent = 'No file selected. Manual entry form below will be compiled as CSV.';
      clearFileBtn.style.display = 'none';
      dropZone?.classList.remove('hov');
      if (fileInput) fileInput.value = '';
    }
  }
}

// File drop zone events
if (dropZone && fileInput) {
  dropZone.addEventListener('click', (e) => {
    // If click was not the clear button
    if ((e.target as HTMLElement)?.id !== 'clear-file-btn') {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      setFile(fileInput.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('hov');
  });

  dropZone.addEventListener('dragleave', () => {
    if (!selectedFile) {
      dropZone.classList.remove('hov');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  });
}

if (clearFileBtn) {
  clearFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setFile(null);
  });
}

// Sample preset autofill
if (samplePresetBtn) {
  samplePresetBtn.addEventListener('click', () => {
    const values: Record<string, string> = {
      age: '58',
      sex: '1',
      bmi: '31.4',
      sbp: '142',
      dbp: '84',
      total_chol: '198',
      hdl: '38',
      creatinine: '1.0',
      hba1c: '7.9',
      insulin: '0',
    };
    for (const [k, v] of Object.entries(values)) {
      const el = document.getElementById(k) as HTMLInputElement | HTMLSelectElement | null;
      if (el) el.value = v;
    }
    setFile(null);
  });
}

// Form Submission
// Endpoint: POST /twin/upload?user_id={id}  (multipart/form-data, field name "file")
uploadForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!userId) {
    window.location.href = 'login.html';
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `⏳ Analyzing biomarkers...`;
  }
  if (uploadStatus) {
    uploadStatus.style.display = 'block';
    uploadStatus.textContent = selectedFile
      ? `Uploading and extracting biomarkers from ${selectedFile.name}...`
      : 'Compiling 10-parameter CSV and computing clinical risk scores...';
  }

  const formData = new FormData();

  if (selectedFile) {
    formData.append('file', selectedFile, selectedFile.name);
  } else {
    // b) manual-entry form with these 10 inputs, in this exact order/keys
    // (build a one-row CSV client-side with this header order if no file is chosen, and upload that as "file"):
    // age,sex,bmi,sbp,dbp,total_chol,hdl,creatinine,hba1c,insulin
    const ageVal = (document.getElementById('age') as HTMLInputElement).value || '58';
    const sexVal = (document.getElementById('sex') as HTMLSelectElement).value || '1';
    const bmiVal = (document.getElementById('bmi') as HTMLInputElement).value || '31.4';
    const sbpVal = (document.getElementById('sbp') as HTMLInputElement).value || '142';
    const dbpVal = (document.getElementById('dbp') as HTMLInputElement).value || '84';
    const totalCholVal = (document.getElementById('total_chol') as HTMLInputElement).value || '198';
    const hdlVal = (document.getElementById('hdl') as HTMLInputElement).value || '38';
    const creatinineVal = (document.getElementById('creatinine') as HTMLInputElement).value || '1.0';
    const hba1cVal = (document.getElementById('hba1c') as HTMLInputElement).value || '7.9';
    const insulinVal = (document.getElementById('insulin') as HTMLSelectElement).value || '0';

    const header = 'age,sex,bmi,sbp,dbp,total_chol,hdl,creatinine,hba1c,insulin';
    const row = `${ageVal},${sexVal},${bmiVal},${sbpVal},${dbpVal},${totalCholVal},${hdlVal},${creatinineVal},${hba1cVal},${insulinVal}`;
    const csvContent = `${header}\n${row}\n`;

    const csvBlob = new Blob([csvContent], { type: 'text/csv' });
    formData.append('file', csvBlob, 'manual_metrics.csv');
  }

  try {
    const res = await fetch(apiUrl(`/twin/upload?user_id=${encodeURIComponent(userId)}`), {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || `Upload failed with status ${res.status}`);
    }

    const twinData = await res.json();
    sessionStorage.setItem('twin', JSON.stringify(twinData));

    if (uploadStatus) {
      uploadStatus.style.background = '#f6ffed';
      uploadStatus.style.color = '#389e0d';
      uploadStatus.textContent = 'Digital twin calculated successfully. Opening dashboard...';
    }

    setTimeout(() => {
      window.location.href = 'twin.html';
    }, 600);
  } catch (err: any) {
    if (uploadStatus) {
      uploadStatus.style.background = '#fff1f0';
      uploadStatus.style.color = '#cf1322';
      uploadStatus.textContent = `Error: ${err.message || 'Failed to process twin upload'}`;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'See my health picture';
    }
  }
});
