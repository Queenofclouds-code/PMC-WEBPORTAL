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

        resolve({ lat, lng });
      },
      (err) => {
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

// Fix: cameraInput must not be display:none
cameraInput.style.opacity = "0";
cameraInput.style.position = "absolute";
cameraInput.style.left = "-9999px";

// =======================
// COMPRESS TO ~3MB
// =======================
async function compressImageToTarget(file, targetBytes = 3 * 1024 * 1024) {
  if (file.size <= targetBytes) return file;

  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  let width = Math.min(1600, img.width);
  let height = img.height * (width / img.width);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  let quality = 0.85;
  let blob;

  for (let i = 0; i < 8; i++) {
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    if (blob && blob.size <= targetBytes) break;

    if (quality > 0.5) quality -= 0.12;
    else {
      width *= 0.8;
      height *= 0.8;
    }
  }

  return new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
    type: "image/jpeg",
  });
}

// =======================
// SAFE PREVIEW (ONLY small gallery images)
// =======================
function showPreview(files) {
  preview.innerHTML = "";
  [...files].forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "90px";
    img.style.borderRadius = "8px";
    img.style.margin = "5px";
    preview.appendChild(img);
    setTimeout(() => URL.revokeObjectURL(img.src), 30000);
  });
}

// =======================
// FILE INPUT (Gallery)
// =======================
fileInput.addEventListener("change", async () => {
  cameraInput.value = "";

  if (fileInput.files[0].size < 8 * 1024 * 1024) {
    showPreview(fileInput.files);
  } else {
    preview.innerHTML =
      "<p>🖼 Large file selected — preview disabled for safety</p>";
  }

  await getLiveLocation("Gallery Select");
});

// =======================
// CAMERA CAPTURE
// =======================
cameraInput.addEventListener("change", async () => {
  fileInput.value = "";

  preview.innerHTML =
    "<p>📸 Camera image attached ✔ (preview disabled for safety)</p>";

  await getLiveLocation("Camera Capture");
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
document
  .getElementById("complaintForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    await getLiveLocation("Submit");

    const formData = new FormData();

    formData.append("fullname", fullname.value);
    formData.append("phone", phone.value);
    formData.append("complaint_type", complaintType.value);
    formData.append("description", description.value);
    formData.append("urgency", urgency.value);
    formData.append("latitude", latitude.value);
    formData.append("longitude", longitude.value);

    async function addFiles(files) {
      for (let f of files) {
        const c = await compressImageToTarget(f);
        formData.append("files[]", c);
      }
    }

    if (fileInput.files.length > 0) await addFiles(fileInput.files);
    if (cameraInput.files.length > 0) await addFiles(cameraInput.files);

    try {
      const res = await fetch("/portal/api/complaints", {
        method: "POST",
        body: formData,
      });

      await res.json();

      alert("✔ Complaint submitted successfully!");

      // ======================
      // FINAL FIX FOR ANDROID
      // ======================
      document.getElementById("complaintForm").reset();
      preview.innerHTML = "";
      latitude.value = "";
      longitude.value = "";

      setTimeout(() => {
        window.location.href = window.location.href;
      }, 400);
    } catch (err) {
      alert("❌ Submission failed");
    }
  });
