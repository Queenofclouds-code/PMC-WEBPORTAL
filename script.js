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
   CHECK IF USER IS LOGGED IN
======================= */
function isLoggedIn() {
    const token = localStorage.getItem("user_token");
    if (!token) {
        return false;  // No token means user is not logged in
    }

    try {
        // Decode the JWT token (optional, but can be used for expiry checks)
        const payload = JSON.parse(atob(token.split('.')[1]));  // Decoding the payload
        const expiry = payload.exp * 1000;  // Convert expiration to milliseconds
        const now = Date.now();

        if (expiry < now) {
            localStorage.removeItem("user_token");  // Token expired, remove it
            return false;
        }

        return true;  // Token is valid
    } catch (error) {
        console.error("Invalid token format", error);
        return false;
    }
}
/* =======================
   UNLOCK COMPLAINT FORM
======================= */
function unlockForm() {
    if (!document.getElementById('complaintForm')) return;
    ['fullname', 'phone', 'complaintType', 'description', 'urgency', 'files'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.removeAttribute('disabled');
    });
    document.querySelector('.submit-btn')?.removeAttribute('disabled');
}

/* =======================
   UNLOCK VIEW COMPLAINTS
======================= */
function unlockPage() {
    if (!document.getElementById('map')) return;
    document.querySelectorAll('.filter-select').forEach(el => el.removeAttribute('disabled'));
    const leftPanel = document.getElementById('leftPanel');
    if (leftPanel) leftPanel.style.cssText = 'pointer-events: auto; opacity: 1;';
    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.style.pointerEvents = 'auto';
}


/* =======================
   LOCK COMPLAINT FORM AND VIEW COMPLAINTS FOR UNAUTHENTICATED USERS
======================= */
function lockTabsForUnauthenticatedUsers() {
    if (!isLoggedIn()) {
        // Lock the Complaint Form tab link
        document.getElementById("complaintFormLink").disabled = true;
        document.getElementById("complaintFormLink").style.pointerEvents = "none";  // Make it unclickable
        document.getElementById("complaintFormLink").style.color = "gray";  // Optional: Change color to indicate it's locked
        
        // Lock the View Complaints tab link
        document.getElementById("viewComplaintsLink").disabled = true;
        document.getElementById("viewComplaintsLink").style.pointerEvents = "none";  // Make it unclickable
        document.getElementById("viewComplaintsLink").style.color = "gray";  // Optional: Change color to indicate it's locked
        
        // Show login prompt (optional)
        document.getElementById("loginPrompt").style.display = "block";
    }
}

/* =======================
   REDIRECT TO LOGIN PAGE IF NOT LOGGED IN
======================= */
function redirectToLoginIfNotLoggedIn() {
    if (!isLoggedIn()) {
        window.location.href = "login.html";  // Redirect to your login page
    }
}

/* =======================
   SEND OTP
======================= */
async function sendOTP() {
    const email = document.getElementById("loginEmail").value;
    if (!email || !email.includes("@")) {
        alert("Enter a valid email address");
        return;
    }

    await fetch("/portal/api/auth/send-otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email })  // Send email instead of phone
    });

    document.getElementById("otpBox").style.display = "block";
}

/* =======================
   VERIFY OTP
======================= */
async function verifyOTP() {
    const email = document.getElementById("loginEmail").value;
    const otp = document.getElementById("loginOtp").value;

    const res = await fetch("/portal/api/auth/verify-otp", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, otp })
    });

    const data = await res.json();

    if (!data.token) {
        alert("❌ Incorrect OTP");
        return;
    }

    localStorage.setItem("user_token", data.token);
    closeSigninModal();
    
    // ✅ UNLOCK EVERYTHING INSTANTLY
    unlockForm();
    unlockPage();
    alert("✅ Login successful! Form unlocked.");
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

            // Ensure the user is logged in before submitting the complaint
            if (!isLoggedIn()) {
                alert("Please log in to submit a complaint.");
                return;
            }

            await getLiveLocation();

            const formData = new FormData();
            formData.append("fullname", fullname.value);
            formData.append("phone", phone.value);  // ✅ Matches your HTML + backend
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

/* =======================
   LOCKING COMPLAINT FORM AND VIEW COMPLAINTS PAGE
======================= */
document.addEventListener("DOMContentLoaded", function () {
    lockTabsForUnauthenticatedUsers();
    
    // ✅ UNLOCK IF ALREADY LOGGED IN
    if (isLoggedIn()) {
        unlockForm();
        unlockPage();
    }
    
    // Show login modal on protected pages if not logged in
    const path = window.location.pathname.split('/').pop();
    if (!isLoggedIn() && (path === 'complaint.html' || path === 'view-complaints.html')) {
        setTimeout(() => openSigninModal(), 500);
    }
});
