from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
import os
import bcrypt
import jwt
import datetime
from functools import wraps

app = Flask(__name__)
CORS(app)

# ==========================
# JWT SECRET KEY
# ==========================
SECRET_KEY = "MY_SUPER_SECRET_KEY_123"

# ==========================
# POSTGRESQL CONNECTION
# ==========================
try:
    conn = psycopg2.connect(
        host="localhost",
        database="complaint_portal",
        user="postgres",
        password="meghaj"     # <-- Update if needed
    )
    cursor = conn.cursor()
    print("✅ PostgreSQL Connected Successfully!")
except Exception as e:
    print("❌ Database connection failed:", e)

# ==========================
# JWT AUTH DECORATOR
# ==========================
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]

        if not token:
            return jsonify({"error": "Token missing"}), 400

        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            admin_id = data["admin_id"]
        except Exception:
            return jsonify({"error": "Invalid or expired token"}), 401

        return f(*args, **kwargs)

    return decorated

# ==========================
# ADMIN LOGIN
# ==========================
@app.route("/portal/api/admin/login", methods=["POST"])
def admin_login():
    data = request.json
    username = data.get("username")
    password = data.get("password").encode()

    cursor.execute("SELECT id, password_hash FROM admin_users WHERE username=%s", (username,))
    admin = cursor.fetchone()

    if not admin:
        return jsonify({"error": "Invalid username or password"}), 401

    admin_id, stored_hash = admin

    if not bcrypt.checkpw(password, stored_hash.encode()):
        return jsonify({"error": "Invalid username or password"}), 401

    token = jwt.encode({
        "admin_id": admin_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    }, SECRET_KEY, algorithm="HS256")

    return jsonify({"token": token})

# ==========================
# GET ALL COMPLAINTS (ADMIN)
# ==========================
@app.route("/portal/api/admin/complaints", methods=["GET"])
@admin_required
def get_all_complaints():
    cursor.execute("SELECT * FROM complaints ORDER BY id DESC")
    rows = cursor.fetchall()

    complaints = []
    columns = [desc[0] for desc in cursor.description]

    for row in rows:
        complaints.append(dict(zip(columns, row)))

    return jsonify({"complaints": complaints})

# ==========================
# UPDATE COMPLAINT STATUS (ADMIN)
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
# SERVE FRONTEND FILES
# ==========================
@app.route('/')
def index():
    return send_from_directory(".", "index.html")

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(".", path)

# ==========================
# RUN APP (DEV MODE)
# ==========================
if __name__ == "__main__":
    app.run(debug=True, port=5050)
