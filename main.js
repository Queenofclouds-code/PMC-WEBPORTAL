// =====================================================
// FINAL LEAFLET MAP + CLUSTERS + FILTER + AUTO-ZOOM
// =====================================================

// Initialize Map
let map = L.map("map").setView([18.5204, 73.8567], 12);


// =========================
// PUNE RASTER BOUNDS
// =========================
const puneRasterBounds = [
  [18.523400, 73.865117], // Lower Left (SW)
  [18.526086, 73.867950]  // Upper Right (NE)
];


// OSM base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 25,
  attribution: "© OpenStreetMap Contributors"
}).addTo(map);

// Raster overlay
const puneRaster = L.tileLayer(
  "/portal/static/Raster_Tiles/Pune/{z}/{x}/{y}.png",
  {
    minZoom: 11,
    maxZoom: 19,
    tms: true,        // ✅ Leaflet handles Y flip
    opacity: 1
  }
);

puneRaster.addTo(map);


map.fitBounds(puneRasterBounds);






// =========================
// PUNE WARD NUMBERS (ON LOAD)
// =========================
fetch("/portal/static/data/Pune.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: "#0b5ed7",        
        weight: 2,
        fillColor: "#74c0fc",
        fillOpacity: 0.25
      },
      onEachFeature: function (feature, layer) {

        // ✅ Correct ward number field
        const wardNo = feature.properties.wardnum;

        // Place label at ward centroid
        const center = layer.getBounds().getCenter();

        L.marker(center, {
          icon: L.divIcon({
            className: "ward-label",
            html: wardNo,
            iconSize: [28, 28]
          }),
          interactive: false
        }).addTo(map);
      }
    }).addTo(map);
  })
  .catch(err => console.error("Ward GeoJSON load error:", err));


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
let heatLayer = null;

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

// =========================
// HEATMAP TOGGLE BUTTON
// =========================
const heatBtn = document.getElementById("toggleHeatmap");

if (heatBtn) {
  heatBtn.addEventListener("click", () => {
    // If heatmap is visible, hide it and reset
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
      heatLayer = null;            // important: reset
      return;
    }

    // Rebuild points every time you turn it ON
    const points = allComplaints
      .filter(c => c.latitude && c.longitude)
      .map(c => {
        const u = (c.urgency || "").toLowerCase();
        let intensity = 0.6;
        if (u === "medium") intensity = 0.9;
        if (u === "high") intensity = 1.2;
        return [Number(c.latitude), Number(c.longitude), intensity];
      });

    if (!points.length) return;    // nothing to show

    heatLayer = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 18,
      max: 1.2
    });

    map.addLayer(heatLayer);
  });
}
