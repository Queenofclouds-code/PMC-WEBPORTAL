/* =======================
   SIGN-IN POPUP CONTROL
======================= */
function openSigninModal() {
    const modal = document.getElementById("signinModal");
    if (modal) modal.style.display = "flex";
}

function closeSigninModal() {
    const modal = document.getElementById("signinModal");
    if (modal) modal.style.display = "none";
}

/* =======================
   SEND OTP
======================= */
async function sendOTP() {
    const phone = document.getElementById("loginPhone").value;

    if (phone.length !== 10) {
        alert("Enter a valid phone number");
        return;
    }

    await fetch("/portal/api/auth/send-otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ phone })
    });

    document.getElementById("otpBox").style.display = "block";
}

/* =======================
   VERIFY OTP
======================= */
async function verifyOTP() {
    const phone = document.getElementById("loginPhone").value;
    const otp = document.getElementById("loginOtp").value;

    const res = await fetch("/portal/api/auth/verify-otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ phone, otp })
    });

    const data = await res.json();

    if (!data.token) {
        alert("Incorrect OTP");
        return;
    }

    // Save login token
    localStorage.setItem("user_token", data.token);

    closeSigninModal();

    // Redirect to intended page (if set)
    if (window.gotoAfterLogin) {
        window.location.href = window.gotoAfterLogin;
    }
}

/* =======================
   GET LIVE LOCATION
======================= */
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

/* =======================
   FILE INPUT PREVIEW
======================= */
const fileInput = document.getElementById("files");
const preview = document.getElementById("preview");

if (fileInput) {
    fileInput.addEventListener("change", () => {
        preview.innerHTML = "<p>✔ Files attached</p>";
    });
}

/* =======================
   COMPRESS LARGE IMAGES
======================= */
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
                            new File(
                                [blob],
                                file.name.replace(/\.[^/.]+$/, ".jpg"),
                                { type: "image/jpeg" }
                            )
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

/* =======================
   SUBMIT COMPLAINT FORM
======================= */
if (document.getElementById("complaintForm")) {
    document
        .getElementById("complaintForm")
        .addEventListener("submit", async (e) => {
            e.preventDefault();

            // Must be logged in (still enforced on submit)
            if (!localStorage.getItem("user_token")) {
                window.gotoAfterLogin = "complaint.html";
                openSigninModal();
                return;
            }

            await getLiveLocation();

            const formData = new FormData();
            formData.append("fullname", fullname.value);
            formData.append("phone", phone.value);
            formData.append("complaint_type", complaintType.value);
            formData.append("description", description.value);
            formData.append("urgency", urgency.value);
            formData.append("latitude", latitude.value);
            formData.append("longitude", longitude.value);

            if (fileInput && fileInput.files.length > 0) {
                for (let f of fileInput.files) {
                    const optimized = await compressIfNeeded(f);
                    formData.append("files[]", optimized);
                }
            }

            try {
                const res = await fetch("https://gist.aeronica.in/portal/api/complaints", {
                    method: "POST",
                    body: formData
                });

                await res.json();

                alert("✔ Complaint submitted!");

                document.getElementById("complaintForm").reset();
                if (preview) preview.innerHTML = "";

                window.location.reload();
            } catch (err) {
                alert("❌ Submission failed");
            }
        });
}
