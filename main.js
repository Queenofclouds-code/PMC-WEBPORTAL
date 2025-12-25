// =====================================================
// FINAL LEAFLET MAP + CLUSTERS + FILTER + AUTO-ZOOM
// =====================================================

// Initialize Map
let map = L.map("map").setView([18.5204, 73.8567], 12);

// =====================================================
// CREATE PANES (ORDER CONTROL)
// =====================================================
map.createPane("basePane");
map.createPane("wardPane");
map.createPane("rasterPane");
map.createPane("markerPane");

// Set stacking order
map.getPane("basePane").style.zIndex = 200;
map.getPane("wardPane").style.zIndex = 300;
map.getPane("rasterPane").style.zIndex = 400;   // ✅ Raster ABOVE wards
map.getPane("markerPane").style.zIndex = 600;   // ✅ Markers always on top

// =====================================================
// PUNE RASTER BOUNDS
// =====================================================
const puneRasterBounds = [
  [18.523400, 73.865117],
  [18.526086, 73.867950]
];

// =====================================================
// OSM BASE MAP
// =====================================================
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  pane: "basePane",
  maxZoom: 25,
  attribution: "© OpenStreetMap Contributors"
}).addTo(map);

// =====================================================
// RASTER OVERLAY (ABOVE WARDS)
// =====================================================
const puneRaster = L.tileLayer(
  "/portal/static/Raster_Tiles/Pune/{z}/{x}/{y}.png",
  {
    pane: "rasterPane",
    minZoom: 11,
    maxZoom: 22,
    tms: true,
    tileSize: 512,
    opacity: 1,
    noWrap: true
  }
);

puneRaster.addTo(map);
map.fitBounds(puneRasterBounds);

// Optional: allow clicks to pass through raster
map.getPane("rasterPane").style.pointerEvents = "none";

// =====================================================
// PUNE WARDS (BELOW RASTER)
// =====================================================
fetch("/portal/static/data/Pune.geojson")
  .then(res => res.json())
  .then(data => {
    L.geoJSON(data, {
      pane: "wardPane",
      style: {
        color: "#0b5ed7",
        weight: 2,
        fillColor: "#74c0fc",
        fillOpacity: 0.25
      },
      onEachFeature: function (feature, layer) {

        const wardNo = feature.properties.wardnum;
        const center = layer.getBounds().getCenter();

        L.marker(center, {
          pane: "wardPane",
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

// =====================================================
// GLOBAL MAP RESIZE HANDLER
// =====================================================
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
  collapseSidebar.textContent =
    leftPanel.classList.contains("collapsed") ? "▶" : "◀";
  refreshMap();
});

// =====================================================
// MARKERS + CLUSTERS (TOP MOST)
// =====================================================
const markers = L.markerClusterGroup({ pane: "markerPane" });
map.addLayer(markers);

let allComplaints = [];
let heatLayer = null;

// =====================================================
// NORMALIZE TEXT
// =====================================================
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

// =====================================================
// LOAD COMPLAINTS
// =====================================================
function loadComplaints() {
  fetch("https://gist.aeronica.in/portal/api/complaints")
    .then(res => res.json())
    .then(data => {
      allComplaints = data.complaints || [];
      applyFilters();
    })
    .catch(err => console.error("Failed to load complaints:", err));
}
loadComplaints();

// =====================================================
// BUILD MARKERS
// =====================================================
function buildMarkers(complaints) {
  markers.clearLayers();

  const grouped = {};
  complaints.forEach(c => {
    if (!c.latitude || !c.longitude) return;
    const key = `${c.latitude},${c.longitude}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  Object.keys(grouped).forEach(key => {
    const items = grouped[key];
    const [lat, lng] = key.split(",").map(Number);
    let index = 0;

    const marker = L.marker([lat, lng], { pane: "markerPane" }).bindPopup("");

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
        html += `<img src="${d.image_url}" style="width:240px;border-radius:10px;"><br>`;
      }

      if (items.length > 1) {
        html += `
          <button id="prevBtn">⬅ Prev</button>
          <button id="nextBtn">Next ➡</button>
        `;
      }

      marker.getPopup().setContent(html);

      setTimeout(() => {
        document.getElementById("nextBtn")?.onclick = e => {
          e.stopPropagation();
          index = (index + 1) % items.length;
          showPopup();
        };
        document.getElementById("prevBtn")?.onclick = e => {
          e.stopPropagation();
          index = (index - 1 + items.length) % items.length;
          showPopup();
        };
      }, 100);
    }

    marker.on("click", showPopup);
    markers.addLayer(marker);
  });

  refreshMap();
}

// =====================================================
// APPLY FILTERS
// =====================================================
function applyFilters() {
  const type = norm(document.getElementById("filterType").value);
  const status = norm(document.getElementById("filterStatus").value);
  const urgency = norm(document.getElementById("filterUrgency").value);

  const filtered = allComplaints.filter(d => {
    if (type !== "all" && norm(d.complaint_type) !== type) return false;
    if (status !== "all" && norm(d.status) !== status) return false;
    if (urgency !== "all" && norm(d.urgency) !== urgency) return false;
    return true;
  });

  buildMarkers(filtered);

  if (filtered.length && filtered[0].latitude && filtered[0].longitude) {
    map.flyTo([filtered[0].latitude, filtered[0].longitude], 16);
  }
}

// =====================================================
// FILTER LISTENERS
// =====================================================
document.getElementById("filterType").addEventListener("change", applyFilters);
document.getElementById("filterStatus").addEventListener("change", applyFilters);
document.getElementById("filterUrgency").addEventListener("change", applyFilters);

// =====================================================
// HEATMAP TOGGLE
// =====================================================
const heatBtn = document.getElementById("toggleHeatmap");

if (heatBtn) {
  heatBtn.addEventListener("click", () => {
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
      heatLayer = null;
      return;
    }

    const points = allComplaints
      .filter(c => c.latitude && c.longitude)
      .map(c => [
        Number(c.latitude),
        Number(c.longitude),
        c.urgency?.toLowerCase() === "high" ? 1.2 :
        c.urgency?.toLowerCase() === "medium" ? 0.9 : 0.6
      ]);

    if (!points.length) return;

    heatLayer = L.heatLayer(points, {
      radius: 30,
      blur: 20,
      maxZoom: 18,
      max: 1.2,
      pane: "markerPane"
    });

    map.addLayer(heatLayer);
  });
}
