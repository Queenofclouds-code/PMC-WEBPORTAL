// =======================
// AUTO LOCATION ON PAGE LOAD
// =======================
window.onload = () => {
  getLiveLocation("Page Load");
};

// =======================
// GET LIVE LOCATION FUNCTION
// =======================
function getLiveLocation(source) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("latitude").value = pos.coords.latitude;
        document.getElementById("longitude").value = pos.coords.longitude;
        console.log(`📍 LIVE GPS (${source}):`, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("❌ GPS Error:", err);
        alert("⚠ Please enable location permission.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
  }
}

// =======================
// VARIABLES
// =======================
const fileInput = document.getElementById("files");
const cameraInput = document.getElementById("cameraInput");
const cameraBtn = document.getElementById("openCameraBtn");

// =======================
// FILE SELECTED → DISABLE CAMERA + CAPTURE LIVE LOCATION
// =======================
fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    cameraBtn.disabled = true;
    cameraBtn.style.opacity = "0.5";
    cameraInput.value = "";

    // 📍 Always capture live GPS when selecting file
    getLiveLocation("File Selected");

    showPreview(fileInput.files);
  }
});

// =======================
// CAMERA USED → DISABLE FILE INPUT + CAPTURE LIVE LOCATION
// =======================
cameraInput.addEventListener("change", () => {
  if (cameraInput.files.length > 0) {
    fileInput.disabled = true;
    fileInput.style.opacity = "0.5";
    fileInput.value = "";

    // 📍 Always capture live GPS when using camera
    getLiveLocation("Camera Capture");

    showPreview(cameraInput.files);
  }
});

// =======================
// CAMERA BUTTON OPENS SYSTEM CAMERA
// =======================
cameraBtn.addEventListener("click", () => {
  cameraInput.click();
});

// =======================
// IMAGE PREVIEW
// =======================
function showPreview(files) {
  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  [...files].forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.width = "120px";
    img.style.margin = "5px";
    preview.appendChild(img);
  });
}

// =======================
// SUBMIT FORM
// =======================
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullname = document.getElementById("fullname").value;
  if (!/^[A-Za-z ]{3,}$/.test(fullname)) {
    alert("Enter a valid full name (letters only)");
    return;
  }

  const phone = document.getElementById("phone").value;
  if (!/^[0-9]{10}$/.test(phone.trim())) {
    alert("Enter a valid 10-digit phone number");
    return;
  }

  const complaint_type = document.getElementById("complaintType").value;
  const description = document.getElementById("description").value;
  const urgency = document.getElementById("urgency").value;
  const latitude = document.getElementById("latitude").value;
  const longitude = document.getElementById("longitude").value;

  const formData = new FormData();

  formData.append("fullname", fullname);
  formData.append("phone", phone);
  formData.append("complaint_type", complaint_type);
  formData.append("description", description);
  formData.append("urgency", urgency);
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);

  [...fileInput.files].forEach(file => formData.append("files[]", file));
  [...cameraInput.files].forEach(file => formData.append("files[]", file));

  try {
    const res = await fetch("/portal/api/complaints", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    console.log(result);

    alert("✔ Complaint submitted successfully!");

    // RESET
    fileInput.disabled = false;
    cameraBtn.disabled = false;
    fileInput.style.opacity = "1";
    cameraBtn.style.opacity = "1";

    fileInput.value = "";
    cameraInput.value = "";
    document.getElementById("preview").innerHTML = "";

  } catch (err) {
    console.error(err);
    alert("❌ Failed to submit complaint.");
  }
});
