// ============================================
// COLLAPSIBLE PANEL LOGIC
// ============================================
const panel = document.getElementById("filterPanel");
const collapseBtn = document.getElementById("collapseBtn");

collapseBtn.addEventListener("click", () => {

    panel.classList.toggle("collapsed");
    collapseBtn.classList.toggle("panel-collapsed");

    collapseBtn.innerHTML = panel.classList.contains("collapsed") ? ">" : "<";

    setTimeout(() => {
        map.invalidateSize();
    }, 400);
});

// ============================================
// LEAFLET MAP + MARKER CLUSTER
// ============================================

let map = L.map("map").setView([18.5204, 73.8567], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "© OpenStreetMap Contributors"
}).addTo(map);

const markers = L.markerClusterGroup();
map.addLayer(markers);

// ============================================
// LOAD COMPLAINTS
// ============================================

function loadComplaints(filterType = "All") {
    fetch("https://gist.aeronica.in/portal/api/complaints")
        .then(res => res.json())
        .then(data => {

            markers.clearLayers();
            const grouped = {};

            if (data.complaints.length > 0) {
                const latest = data.complaints[0];
                map.flyTo([latest.latitude, latest.longitude], 17, { duration: 1.2 });
            }

            data.complaints.forEach(c => {
                if (!c.latitude || !c.longitude) return;

                const key = `${c.latitude},${c.longitude}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(c);
            });

            Object.keys(grouped).forEach(key => {
                let items = grouped[key];
                const [lat, lng] = key.split(",").map(Number);

                if (filterType !== "All" &&
                    !items.some(c => c.complaint_type === filterType)) return;

                if (filterType !== "All") {
                    items = items.filter(c => c.complaint_type === filterType);
                }

                let index = 0;
                const marker = L.marker([lat, lng]).bindPopup("");

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
                        html += `<img src="${d.image_url}" 
                        style="width:240px;border-radius:10px;margin-bottom:10px;"><br>`;
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
                    }, 150);
                }

                marker.on("click", showPopup);
                markers.addLayer(marker);
            });
        });
}

// INITIAL LOAD
loadComplaints();

// FILTER BUTTONS
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadComplaints(btn.dataset.type);
    });
});
