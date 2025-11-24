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

// Make camera input mobile-compatible
cameraInput.style.opacity = "0";
cameraInput.style.position = "absolute";
cameraInput.style.left = "-9999px";

// =======================
// IMAGE COMPRESSION FUNCTION
// =======================
function compressImage(file, quality = 0.6) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const MAX_WIDTH = 1080;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality
        );
      };
    };
    reader.readAsDataURL(file);
  });
}

// =======================
// IMAGE PREVIEW
// =======================
function showPreview(files) {
  preview.innerHTML = "";
  [...files].forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "120px";
    img.style.margin = "5px";
    img.style.borderRadius = "10px";
    preview.appendChild(img);
  });
}

// =======================
// FILE INPUT (Gallery)
// =======================
fileInput.addEventListener("change", async () => {
  if (fileInput.files.length > 0) {
    cameraInput.value = "";
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
  cameraInput.click(); // now works on all mobiles
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

  // ====== COMPRESS FILES BEFORE UPLOAD ======
  async function appendCompressed(files) {
    for (let f of files) {
      const compressed = await compressImage(f);
      formData.append("files[]", compressed);
    }
  }

  if (fileInput.files.length > 0) {
    await appendCompressed(fileInput.files);
  }

  if (cameraInput.files.length > 0) {
    await appendCompressed(cameraInput.files);
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
    }, 700);

  } catch (err) {
    console.error("Submit Error:", err);
    alert("❌ Failed to submit complaint.");
  }
});
