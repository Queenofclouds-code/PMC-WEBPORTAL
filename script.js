// =======================
// GET LIVE LOCATION
// =======================
function getLiveLocation() {
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById("latitude").value = pos.coords.latitude;
        document.getElementById("longitude").value = pos.coords.longitude;
        resolve();
      },
      () => resolve(),
      { enableHighAccuracy: true }
    );
  });
}

window.onload = () => getLiveLocation();

// =======================
// FILE INPUT ONLY (NO CAMERA)
// =======================
const fileInput = document.getElementById("files");
const preview = document.getElementById("preview");

// No heavy preview to avoid mobile memory lag
fileInput.addEventListener("change", () => {
  preview.innerHTML = "<p>✔ Files attached</p>";
});

// =======================
// LIGHT COMPRESSION (~2–3MB) ONLY IF FILE > 8MB
// =======================
async function compressIfNeeded(file) {
  if (file.size < 8 * 1024 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let MAX_WIDTH = 1400;
        let scale = MAX_WIDTH / img.width;
        let width = MAX_WIDTH;
        let height = img.height * scale;

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) =>
            resolve(
              new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                type: "image/jpeg",
              })
            ),
          "image/jpeg",
          0.7
        );
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// =======================
// SUBMIT FORM
// =======================
document.getElementById("complaintForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  await getLiveLocation();

  const formData = new FormData();

  formData.append("fullname", fullname.value);
  formData.append("phone", phone.value);
  formData.append("complaint_type", complaintType.value);
  formData.append("description", description.value);
  formData.append("urgency", urgency.value);
  formData.append("latitude", latitude.value);
  formData.append("longitude", longitude.value);

  if (fileInput.files.length > 0) {
    for (let f of fileInput.files) {
      const optimized = await compressIfNeeded(f);
      formData.append("files[]", optimized);
    }
  }

  try {
    const res = await fetch("/portal/api/complaints", {
      method: "POST",
      body: formData,
    });

    await res.json();

    alert("✔ Complaint submitted!");

    // Reset form fields instantly
    document.getElementById("complaintForm").reset();
    preview.innerHTML = "";

    // Android-compatible page refresh
    window.location.replace(window.location.href);

  } catch (err) {
    alert("❌ Submission failed");
  }
});
