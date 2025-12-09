from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
import os
import bcrypt
import jwt
from flask_mail import Mail, Message
from functools import wraps
from datetime import datetime, timedelta
import random

app = Flask(__name__)
CORS(app)

# ===== SECRET KEY FOR JWT =====
SECRET_KEY = "CHANGE_THIS_TO_A_RANDOM_SECRET_64_CHAR"

# ======== ALLOW 50MB UPLOADS ========
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50MB limit

# ======== FILE UPLOAD LOCATION =========
UPLOAD_FOLDER = "/var/www/complaint_uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ==========================
# POSTGRESQL CONNECTION
# ==========================
try:
    conn = psycopg2.connect(
        dbname="complaint_portal",
        user="postgres",
        password="meghaj",
        host="localhost",
        port=5432
    )
    cursor = conn.cursor()
    print("✅ PostgreSQL Connected Successfully!")
except Exception as e:
    print("❌ Failed to connect to PostgreSQL:", e)

# ======== CONFIGURE FLASK-MAIL ========
app.config['MAIL_SERVER'] = 'smtp.gmail.com'  # Example using Gmail's SMTP
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'gis@aeronica.in'  # Replace with your email
app.config['MAIL_PASSWORD'] = 'rrhicumishhnmakj'  # Replace with your email password
app.config['MAIL_DEFAULT_SENDER'] = 'gis@aeronica.in'  # Replace with your email
mail = Mail(app)

# ==========================
# 🔒 JWT VERIFICATION DECORATOR
# ==========================
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            token = request.headers["Authorization"].replace("Bearer ", "")

        if not token:
            return jsonify({"error": "Token missing"}), 401

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            request.admin_id = data["admin_id"]
        except Exception:
            return jsonify({"error": "Invalid or expired token"}), 401

        return f(*args, **kwargs)
    return decorated

# ==========================
# 🔐 ADMIN LOGIN API (JWT)
# ==========================
@app.route("/portal/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    cursor.execute("SELECT id, password_hash FROM admin_users WHERE username=%s", (username,))
    admin = cursor.fetchone()

    if not admin:
        return jsonify({"error": "Invalid username"}), 401

    admin_id, stored_hash = admin

    if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
        return jsonify({"error": "Invalid password"}), 401

    token = jwt.encode(
        {"admin_id": admin_id, "exp": datetime.utcnow() + timedelta(hours=24)},
        SECRET_KEY,
        algorithm="HS256"
    )

    return jsonify({"token": token})

# ==========================
# SEND OTP VIA EMAIL
# ==========================
@app.route("/portal/api/auth/send-otp", methods=["POST"])
def send_otp():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    otp = str(random.randint(100000, 999999))  # Generate 6-digit OTP

    # Store OTP in the database
    cursor.execute("INSERT INTO otp_verification (email, otp, created_at) VALUES (%s, %s, NOW())", (email, otp))
    conn.commit()

    # Send OTP via email
    msg = Message("Your OTP Code", recipients=[email])
    msg.body = f"Your OTP code is: {otp}"
    mail.send(msg)

    return jsonify({"message": "OTP sent successfully"})

# ==========================
# VERIFY OTP
# ==========================
@app.route("/portal/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    data = request.json
    email = data.get("email")
    otp = data.get("otp")

    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400

    # Retrieve OTP from the database
    cursor.execute("SELECT otp FROM otp_verification WHERE email=%s ORDER BY created_at DESC LIMIT 1", (email,))
    stored_otp = cursor.fetchone()

    if not stored_otp or stored_otp[0] != otp:
        return jsonify({"error": "Invalid OTP"}), 400

    # Generate JWT token after successful OTP verification
    token = jwt.encode({"email": email, "exp": datetime.utcnow() + timedelta(hours=24)},
                       SECRET_KEY, algorithm="HS256")

    return jsonify({"token": token})

# ==========================
# POST: Store complaint (with image)
# ==========================
@app.route("/portal/api/complaints", methods=["POST"])
def add_complaint():
    data = request.form
    fullname = data.get("fullname")
    phone = data.get("phone")
    complaint_type = data.get("complaint_type")  # Frontend sends complaint_type
    description = data.get("description")
    urgency = data.get("urgency")
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    image_file = request.files.get("files[]")
    image_url = None  # ✅ Table column name

    if image_file:
        filename = image_file.filename.replace(" ", "_")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        image_file.save(filepath)
        BASE_URL = "https://gist.aeronica.in/portal"
        image_url = f"{BASE_URL}/uploads/{filename}"

    # ✅ EXACT table column names
    sql = """
        INSERT INTO complaints(fullname, phone, complaint_type, description, 
                               urgency, latitude, longitude, image_url, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (fullname, phone, complaint_type, description, 
                        urgency, latitude, longitude, image_url, "pending"))
    conn.commit()

    return jsonify({"status": "success", "message": "Complaint saved", "imageurl": image_url})

# ==========================
# HOST UPLOADED IMAGES
# ==========================
@app.route("/portal/uploads/<path:filename>")
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ==========================
# 🌍 PUBLIC: GET ALL COMPLAINTS
# ==========================
@app.route("/portal/api/complaints", methods=["GET"])
def public_complaints():
    cursor.execute("SELECT * FROM complaints ORDER BY created_at DESC")
    rows = cursor.fetchall()

    complaints = []
    for r in rows:
        complaints.append({
            "id": r[0],
            "fullname": r[1],
            "phone": r[2],          # ✅ Index 2 = phone (not email)
            "complaint_type": r[3],   # ✅ complainttype (not complaint_type)
            "description": r[4],
            "urgency": r[5],
            "latitude": r[6],
            "longitude": r[7],
            "created_at": str(r[8]),
            "image_url": r[9],        # ✅ imageurl (not image_url)
            "status": r[10]
        })

    return jsonify({"complaints": complaints})

# ==========================
# 🔒 ADMIN: GET ALL COMPLAINTS
# ==========================
@app.route("/portal/api/admin/complaints", methods=["GET"])
@admin_required
def get_all_complaints():
    cursor.execute("SELECT * FROM complaints ORDER BY created_at DESC")
    rows = cursor.fetchall()

    complaints = []
    for r in rows:
        complaints.append({
            "id": r[0],
            "fullname": r[1],
            "phone": r[2],          # ✅ Index 2 = phone
            "complainttype": r[3],   # ✅ complainttype
            "description": r[4],
            "urgency": r[5],
            "latitude": r[6],
            "longitude": r[7],
            "created_at": str(r[8]),
            "image_url": r[9],        # ✅ imageurl
            "status": r[10]
        })

    return jsonify({"complaints": complaints})

# ==========================
# 🔒 ADMIN: UPDATE STATUS
# ==========================
@app.route("/portal/api/admin/update-status", methods=["PATCH"])
@admin_required
def update_status():
    data = request.json
    complaint_id = data.get("id")
    new_status = data.get("status")

    valid_status = ["pending", "in-progress", "completed"]

    if new_status not in valid_status:
        return jsonify({"error": "Invalid status"}), 400

    cursor.execute("SELECT id FROM complaints WHERE id=%s", (complaint_id,))
    exists = cursor.fetchone()

    if not exists:
        return jsonify({"error": "Complaint not found"}), 404

    cursor.execute(
        "UPDATE complaints SET status=%s WHERE id=%s",
        (new_status, complaint_id)
    )
    conn.commit()

    return jsonify({
        "message": "Status updated successfully",
        "id": complaint_id,
        "new_status": new_status
    })

# ==========================
# RUN APP (DEV MODE)
# ==========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
