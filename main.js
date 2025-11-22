// =====================================================
// FINAL LEAFLET MAP + CLUSTERS + FILTER + AUTO-ZOOM (DEFAULT MARKERS)
// =====================================================

// Initialize Map
let map = L.map("map").setView([18.5204, 73.8567], 12);

L.tileLayer(
  "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    attribution: "© OpenStreetMap & Stadia Maps"
  }
).addTo(map);



// Initialize Marker Cluster Group
const markers = L.markerClusterGroup();
map.addLayer(markers);

// Fetch & Load Complaints
function loadComplaints(filterType = "All") {
  fetch("https://gist.aeronica.in/portal/api/complaints")   // ✅ LIVE SERVER
    .then(res => res.json())
    .then(data => {

      markers.clearLayers();
      const grouped = {};

      // ⭐ Find most recent complaint
      let latest = null;
      if (data.complaints.length > 0) {
        latest = data.complaints[data.complaints.length - 1];
        map.flyTo([latest.latitude, latest.longitude], 17);
      }

      // Group complaints by coordinates
      data.complaints.forEach(c => {
        if (!c.latitude || !c.longitude) return;

        const key = `${c.latitude},${c.longitude}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
      });

      // Create markers for each location
      Object.keys(grouped).forEach(key => {
        let items = grouped[key];
        const [lat, lng] = key.split(",").map(Number);

        // Show marker only if ANY record matches filter
        if (filterType !== "All" && !items.some(c => c.complaint_type === filterType)) return;

        // Filter popup items based on filter
        if (filterType !== "All") {
          items = items.filter(c => c.complaint_type === filterType);
        }

        let index = 0;

        // 🔹 DEFAULT MARKER (no colored circles)
        const marker = L.marker([lat, lng]).bindPopup("");

        // Function to update popup content
        function showPopup() {
          const d = items[index];

          let html = `
            <b>${d.complaint_type}</b><br>
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

            if (next) next.onclick = (e) => {
              e.stopPropagation();
              index = (index + 1) % items.length;
              showPopup();
            };

            if (prev) prev.onclick = (e) => {
              e.stopPropagation();
              index = (index - 1 + items.length) % items.length;
              showPopup();
            };

            const popupEl = document.querySelector(".leaflet-popup");
            if (popupEl) L.DomEvent.disableClickPropagation(popupEl);

          }, 150);
        }

        // Click Handler to Open Popup
        marker.on("click", showPopup);

        // Add Marker to Cluster Layer
        markers.addLayer(marker);
      });
    });
}

// Load Initial Data
loadComplaints();

// Filter Buttons
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadComplaints(btn.dataset.type);
  });
});
