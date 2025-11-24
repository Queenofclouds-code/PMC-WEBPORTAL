
// =======================
// GET LIVE LOCATION
// =======================
function getLiveLocation(source = "Unknown") {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      alert("⚠ Your device does not support location.");
      return reject("No geolocation");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        document.getElementById("latitude").value = lat;
        document.getElementById("longitude").value = lng;

        console.log(`📍 LIVE GPS (${source}):`, lat, lng);
        resolve({ lat, lng });
      },
      (err) => {
        console.warn("GPS Error:", err);
        alert("⚠ Please enable location permission.");
        reject(err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  });
}

// =======================
// AUTO GET LOCATION
// =======================
window.onload = async () => {
  await getLiveLocation("Page Load");
};

// =======================
// DOM ELEMENTS
// =======================
const fileInput = document.getElementById("files");
const cameraInput = document.getElementById("cameraInput");
const cameraBtn = document.getElementById("openCameraBtn");
const preview = document.getElementById("preview");

// ---- Ensure input is not display:none (browser blocks camera) ----
if (cameraInput) {
  cameraInput.style.opacity = "0";
  cameraInput.style.position = "absolute";
  cameraInput.style.left = "-9999px";
}

// =======================
// Safer compress-to-target function (~3MB target)
// =======================
async function compressImageToTarget(file, targetBytes = 3 * 1024 * 1024) {
  // If file already smaller than target, return original
  if (file.size <= targetBytes) return file;

  // Read as data URL (small memory footprint compared to canvas ops)
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // Create image element
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  // Start with conservative downscale to reduce memory usage (max width)
  let maxWidth = 1600; // start here for good quality but safe memory
  let scale = Math.min(1, maxWidth / img.width);
  let width = Math.round(img.width * scale);
  let height = Math.round(img.height * scale);

  // Create canvas and draw
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Iteratively reduce quality and size until under targetBytes or limits reached
  let quality = 0.85;
  let blob = null;

  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    // await toBlob
    blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (!blob) break;

    if (blob.size <= targetBytes) {
      // Good: return compressed file
      return new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
    }

    // If too big, reduce quality first
    if (quality > 0.5) {
      quality -= 0.12; // reduce quality step
    } else {
      // reduce dimensions if quality already low
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
      // avoid extremely small sizes
      if (width < 400 || height < 400) {
        // last resort: return current blob even if larger than target
        return new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
      }
    }
  }

  // fallback - return last produced blob as file
  if (blob) return new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });

  // If compression failed, return original file
  return file;
}

// =======================
// IMAGE PREVIEW (thumbnail only)
// =======================
function showPreview(files) {
  preview.innerHTML = "";
  [...files].forEach(file => {
    const img = document.createElement("img");
    // Use small thumbnail by setting object URL and CSS width - browser will handle
    img.src = URL.createObjectURL(file);
    img.style.width = "90px";
    img.style.height = "auto";
    img.style.objectFit = "cover";
    img.style.margin = "5px";
    img.style.borderRadius = "8px";
    preview.appendChild(img);
    // Revoke object URL later to free memory
    setTimeout(() => { URL.revokeObjectURL(img.src); }, 60000);
  });
}

// =======================
// FILE INPUT (Gallery)
// =======================
fileInput.addEventListener("change", async () => {
  if (fileInput.files.length > 0) {
    cameraInput.value = "";
    // For safety, only show previews (no heavy canvas ops)
    showPreview(fileInput.files);
    await getLiveLocation("File Selected");
  }
});

// =======================
// CAMERA CAPTURE
// =======================
cameraInput.addEventListener("change", async () => {
  if (cameraInput.files.length > 0) {
    fileInput.value = "";
    preview.innerHTML = "<p>📸 Camera image attached ✔</p>";
    await getLiveLocation("Camera Capture");
  }
});

// =======================
// OPEN CAMERA BUTTON
// =======================
cameraBtn.addEventListener("click", () => {
  cameraInput.click();
});

// =======================
// FORM SUBMIT
// =======================
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  try {
    await getLiveLocation("Submit Button");
  } catch (err) {
    alert("⚠ Could not fetch live location.");
    return;
  }

  const fullname = document.getElementById("fullname").value;
  const phone = document.getElementById("phone").value;
  const complaint_type = document.getElementById("complaintType").value;
  const description = document.getElementById("description").value;
  const urgency = document.getElementById("urgency").value;
  const latitude = document.getElementById("latitude").value;
  const longitude = document.getElementById("longitude").value;

  // Basic validation
  if (!/^[A-Za-z ]{3,}$/.test(fullname)) {
    alert("Enter a valid full name");
    return;
  }

  if (!/^[0-9]{10}$/.test(phone.trim())) {
    alert("Enter a valid 10-digit phone number");
    return;
  }

  const formData = new FormData();
  formData.append("fullname", fullname);
  formData.append("phone", phone);
  formData.append("complaint_type", complaint_type);
  formData.append("description", description);
  formData.append("urgency", urgency);
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);

  // Append files: compress to ~3MB target for mobile safety
  async function appendFilesWithCompression(files) {
    for (let f of files) {
      try {
        const compressed = await compressImageToTarget(f, 3 * 1024 * 1024);
        formData.append("files[]", compressed);
      } catch (err) {
        // if compression fails, append original (fallback)
        formData.append("files[]", f);
      }
    }
  }

  if (fileInput.files.length > 0) {
    await appendFilesWithCompression(fileInput.files);
  }

  if (cameraInput.files.length > 0) {
    await appendFilesWithCompression(cameraInput.files);
  }

  // Submit to backend
  try {
    const res = await fetch("/portal/api/complaints", {
      method: "POST",
      body: formData
    });

    await res.json();

    alert("✔ Complaint submitted successfully!");

    setTimeout(() => {
      location.reload();
    }, 800);

  } catch (err) {
    console.error("Submit Error:", err);
    alert("❌ Failed to submit complaint.");
  }
});
