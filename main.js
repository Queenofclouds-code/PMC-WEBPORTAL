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

window.hasZoomedOnce = false;

// =========================
// LOAD COMPLAINTS
// =========================
function loadComplaints(filterType = "All") {
  fetch("https://gist.aeronica.in/portal/api/complaints")
    .then(res => res.json())
    .then(data => {
      markers.clearLayers();
      const grouped = {};

      // Group complaints
      data.complaints.forEach(c => {
        if (!c.latitude || !c.longitude) return;
        const key = `${c.latitude},${c.longitude}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
      });

      // Create markers
      Object.keys(grouped).forEach(key => {
        let items = grouped[key];
        const [lat, lng] = key.split(",").map(Number);

        if (filterType !== "All") {
          items = items.filter(x => x.complaint_type === filterType);
          if (!items.length) return;
        }

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
              next.onclick = e => {
                e.stopPropagation();
                index = (index + 1) % items.length;
                showPopup();
              };

            if (prev)
              prev.onclick = e => {
                e.stopPropagation();
                index = (index - 1 + items.length) % items.length;
                showPopup();
              };
          }, 150);
        }

        marker.on("click", showPopup);
        markers.addLayer(marker);
      });

    // ⭐⭐⭐ ALWAYS ZOOM TO THE NEWEST COMPLAINT — 100% reliable with clusters
if (!window.hasZoomedOnce && data.complaints.length > 0) {

    const newest = data.complaints[0];
    const ny = Number(newest.latitude);
    const nx = Number(newest.longitude);

    if (!ny || !nx) {
        console.warn("Newest complaint has invalid coordinates:", newest);
    } else {
        // TEMP MARKER – ensures MarkerCluster can reveal it
        const tempMarker = L.marker([ny, nx]);

        // lightweight popup
        tempMarker.bindPopup(
            `<b>${newest.complaint_type}</b><br>
             <small>${newest.fullname} • ${newest.created_at}</small>`
        );

        // Add ONLY this temporary marker so MarkerCluster can expand to it
        markers.addLayer(tempMarker);

        // Zoom to show this marker inside the cluster
        markers.zoomToShowLayer(tempMarker, () => {
            try {
                tempMarker.openPopup();
                map.flyTo([ny, nx], 17, { animate: true });
                window.hasZoomedOnce = true;
            } catch (err) {
                console.error("ZoomToShowLayer error:", err);
            }
        });

        // Remove temp marker after 8 seconds (optional)
        setTimeout(() => {
            try { markers.removeLayer(tempMarker); } catch(e) {}
        }, 8000);
    }
}



      refreshMap();
    })
    .catch(err => console.error("Failed to load complaints:", err));
}

loadComplaints();

// FILTER BUTTONS
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    window.hasZoomedOnce = false; // reset on filter
    loadComplaints(btn.dataset.type);
  });
});
