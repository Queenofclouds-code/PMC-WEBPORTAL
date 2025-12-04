// =====================================================
// FINAL LEAFLET MAP + CLUSTERS + FILTER + AUTO-ZOOM
// =====================================================

// Initialize Map
let map = L.map("map").setView([18.5204, 73.8567], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: "© OpenStreetMap Contributors"
}).addTo(map);

// =========================
// GLOBAL MAP RESIZE HANDLER
// =========================
function refreshMap() {
  if (typeof map.invalidateSize === "function") {
    setTimeout(() => map.invalidateSize(), 200);
  }
}

window.addEventListener("resize", refreshMap);

// =====================================================
// COLLAPSIBLE SIDEBAR LOGIC
// =====================================================
const leftPanel = document.getElementById("leftPanel");
const collapseSidebar = document.getElementById("collapseSidebar");

collapseSidebar.addEventListener("click", () => {
  leftPanel.classList.toggle("collapsed");
  collapseSidebar.textContent = leftPanel.classList.contains("collapsed") ? "▶" : "◀";
  refreshMap();
});

// =========================
// MARKERS + CLUSTERS
// =========================
const markers = L.markerClusterGroup();
map.addLayer(markers);

let allComplaints = []; // store full dataset
window.hasZoomedOnce = false;

// =========================
// NORMALIZE TEXT
// =========================
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-"); // "In Progress" → "in-progress"
}

// =========================
// LOAD COMPLAINTS FROM API
// =========================
function loadComplaints() {
  fetch("https://gist.aeronica.in/portal/api/complaints")
    .then((res) => res.json())
    .then((data) => {
      allComplaints = data.complaints || [];
      applyFilters(); // load with filters applied
    })
    .catch((err) => console.error("Failed to load complaints:", err));
}

loadComplaints();

// =========================
// BUILD MARKERS WITH GROUPING
// =========================
function buildMarkers(complaints) {
  markers.clearLayers();

  const grouped = {};

  // Group complaints by exact coordinates
  complaints.forEach((c) => {
    if (!c.latitude || !c.longitude) return;
    const key = `${c.latitude},${c.longitude}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  Object.keys(grouped).forEach((key) => {
    let items = grouped[key];
    const [lat, lng] = key.split(",").map(Number);

    let index = 0;
    const marker = L.marker([lat, lng]).bindPopup("");

    function showPopup() {
      const d = items[index];

      let html = `
        <b>${d.complaint_type}</b><br>
        <b>Status:</b> ${d.status}<br>
        <b>Urgency:</b> ${d.urgency}<br>
        <b>Description:</b> ${d.description}<br>
        <b>Reported By:</b> ${d.fullname}<br>
        <small>${index + 1} / ${items.length}</small><br><br>
      `;

      if (d.image_url) {
        html += `<img src="${d.image_url}" style="width:240px;border-radius:10px;margin-bottom:10px;"><br>`;
      }

      if (items.length > 1) {
        html += `
          <button id="prevBtn">⬅ Prev</button>
          <button id="nextBtn">Next ➡</button>
        `;
      }

      marker.getPopup().setContent(html);

      setTimeout(() => {
        const next = document.getElementById("nextBtn");
        const prev = document.getElementById("prevBtn");

        if (next)
          next.onclick = (e) => {
            e.stopPropagation();
            index = (index + 1) % items.length;
            showPopup();
          };

        if (prev)
          prev.onclick = (e) => {
            e.stopPropagation();
            index = (index - 1 + items.length) % items.length;
            showPopup();
          };
      }, 150);
    }

    marker.on("click", showPopup);
    markers.addLayer(marker);
  });

  refreshMap();
}

// =========================
// APPLY FILTERS: TYPE + STATUS + URGENCY
// =========================
function applyFilters() {
  const type = norm(document.getElementById("filterType").value);
  const status = norm(document.getElementById("filterStatus").value);
  const urgency = norm(document.getElementById("filterUrgency").value);

  const filtered = allComplaints.filter((d) => {
    if (type !== "all" && norm(d.complaint_type) !== type) return false;
    if (status !== "all" && norm(d.status) !== status) return false;
    if (urgency !== "all" && norm(d.urgency) !== urgency) return false;
    return true;
  });

  buildMarkers(filtered);

  // Auto zoom to newest in FILTERED dataset
  if (filtered.length > 0) {
    const newest = filtered[0];
    if (newest.latitude && newest.longitude) {
      map.flyTo([Number(newest.latitude), Number(newest.longitude)], 16);
    }
  }
}

// =========================
// DROP-DOWN EVENT LISTENERS
// =========================
document.getElementById("filterType").addEventListener("change", applyFilters);
document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterUrgency").addEventListener("change", applyFilters);
