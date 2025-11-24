// =======================
// GET LIVE LOCATION FUNCTION
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
// AUTO-FETCH LOCATION ON PAGE LOAD
// =======================
window.onload = async () => {
  await getLiveLocation("Page Load");
};

// =======================
// VARIABLES
// =======================
const fileInput = document.getElementById("files");
const cameraInput = document.getElementById("cameraInput");
const cameraBtn = document.getElementById("openCameraBtn");
const preview = document.getElementById("preview");

// =======================
// FILE SELECTED
// =======================
fileInput.addEventListener("change", async () => {
  if (fileInput.files.length > 0) {
    cameraBtn.disabled = true;
    cameraBtn.style.opacity = "0.5";
    cameraInput.value = "";

    showPreview(fileInput.files);
    await getLiveLocation("File Selected");
  } else {
    cameraBtn.disabled = false;
    cameraBtn.style.opacity = "1";
  }
});

// =======================
// CAMERA CAPTURED
// =======================
cameraInput.addEventListener("change", async () => {
  if (cameraInput.files.length > 0) {
    fileInput.disabled = true;
    fileInput.style.opacity = "0.5";
    fileInput.value = "";

    preview.innerHTML = "<p>📸 Camera image attached ✔</p>";

    await getLiveLocation("Camera Capture");
  }
});

// =======================
// OPEN CAMERA
// =======================
cameraBtn.addEventListener("click", () => {
  cameraInput.click();
});

// =======================
// PREVIEW FOR FILES
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

  [...fileInput.files].forEach(f => formData.append("files[]", f));
  [...cameraInput.files].forEach(f => formData.append("files[]", f));

  try {
    const res = await fetch("/portal/api/complaints", {
      method: "POST",
      body: formData
    });

    await res.json();

    alert("✔ Complaint submitted successfully!");

    // REFRESH FIX FOR MOBILE BROWSERS
    setTimeout(() => {
      location.reload();
    }, 800);

  } catch (err) {
    console.error("Submit Error:", err);
    alert("❌ Failed to submit complaint.");
  }
});
