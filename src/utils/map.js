import L from 'leaflet'

export const bangladeshCenter = [23.685, 90.3563]

export function createBangladeshMap(element) {
  const map = L.map(element, {
    center: bangladeshCenter,
    maxZoom: 12,
    minZoom: 5,
    scrollWheelZoom: true,
    zoom: 7,
    zoomControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map)

  return map
}
