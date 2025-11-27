from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
import os

# ===== NEW IMPORTS (JWT + BCRYPT) =====
import bcrypt
import jwt
from functools import wraps
from datetime import datetime, timedelta

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
# POSTGRESQL CONNECTION CHECK
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
# POST: Store complaint + image
# ==========================
@app.route("/portal/api/complaints", methods=["POST"])
def add_complaint():
    data = request.form

    fullname = data.get("fullname")
    phone = data.get("phone")
    complaint_type = data.get("complaint_type")
    description = data.get("description")
    urgency = data.get("urgency")
    latitude = data.get("latitude")
    longitude = data.get("longitude")

    image_file = request.files.get("files[]")
    image_url = None

    if image_file:
        filename = image_file.filename.replace(" ", "_")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        image_file.save(filepath)

        BASE_URL = "https://gist.aeronica.in/portal"
        image_url = f"{BASE_URL}/uploads/{filename}"

    sql = """
        INSERT INTO complaints(fullname, phone, complaint_type, description,
        urgency, latitude, longitude, image_url)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(sql, (
        fullname, phone, complaint_type, description,
        urgency, latitude, longitude, image_url
    ))

    conn.commit()

    return jsonify({"status": "success", "message": "Complaint saved", "image_url": image_url})


# ==========================
# HOST UPLOADED IMAGES
# ==========================
@app.route("/portal/uploads/<path:filename>")
def serve_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


# ==========================
# 🔒 ADMIN: GET ALL COMPLAINTS (PROTECTED)
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
            "phone": r[2],
            "complaint_type": r[3],
            "description": r[4],
            "urgency": r[5],
            "latitude": r[6],
            "longitude": r[7],
            "created_at": str(r[8]),
            "image_url": r[9],
            "status": r[10]
        })

    return jsonify({"complaints": complaints})


# ==========================
# RUN APP
# ==========================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
