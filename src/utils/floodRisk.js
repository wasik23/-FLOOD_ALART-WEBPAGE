export const riskLevels = {
  Low: {
    label: 'Low',
    color: '#16A34A',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
  },
  Medium: {
    label: 'Medium',
    color: '#EAB308',
    bgClass: 'bg-yellow-50',
    textClass: 'text-yellow-700',
  },
  High: {
    label: 'High',
    color: '#F97316',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
  },
  Critical: {
    label: 'Critical',
    color: '#DC2626',
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
  },
}

const criticalDistricts = new Set([
  'Bagerhat',
  'Barguna',
  'Bhola',
  'Cox\'s Bazar',
  'Kurigram',
  'Noakhali',
  'Patuakhali',
  'Satkhira',
  'Sunamganj',
  'Sylhet',
])

const highDistricts = new Set([
  'Chandpur',
  'Chittagong',
  'Faridpur',
  'Feni',
  'Gaibandha',
  'Gopalganj',
  'Habiganj',
  'Jamalpur',
  'Kishoreganj',
  'Lalmonirhat',
  'Lakshmipur',
  'Madaripur',
  'Manikganj',
  'Moulvibazar',
  'Munshiganj',
  'Netrokona',
  'Pirojpur',
  'Rajbari',
  'Shariatpur',
  'Sherpur',
  'Sirajganj',
  'Tangail',
])

const mediumDistricts = new Set([
  'Barisal',
  'Bogra',
  'Brahmanbaria',
  'Comilla',
  'Dhaka',
  'Dinajpur',
  'Joypurhat',
  'Khulna',
  'Kushtia',
  'Magura',
  'Meherpur',
  'Narayanganj',
  'Narsingdi',
  'Natore',
  'Nawabganj',
  'Nilphamari',
  'Pabna',
  'Rajshahi',
  'Rangpur',
  'Thakurgaon',
])

function getRiskLevel(districtName) {
  if (criticalDistricts.has(districtName)) {
    return 'Critical'
  }

  if (highDistricts.has(districtName)) {
    return 'High'
  }

  if (mediumDistricts.has(districtName)) {
    return 'Medium'
  }

  return 'Low'
}

function hashName(value) {
  return value.split('').reduce((total, character) => {
    return total + character.charCodeAt(0)
  }, 0)
}

function getWaterLevel(districtName, riskLevel) {
  const ranges = {
    Low: [2.1, 3.7],
    Medium: [3.8, 5.3],
    High: [5.4, 6.8],
    Critical: [6.9, 8.6],
  }
  const [min, max] = ranges[riskLevel]
  const ratio = (hashName(districtName) % 100) / 100

  return `${(min + (max - min) * ratio).toFixed(2)} m`
}

export function getDistrictName(properties) {
  return properties.adm2_en || properties.ADM2_EN || properties.name || 'Unknown'
}

export function getDistrictFloodRisk(feature, lastUpdated) {
  const districtName = getDistrictName(feature.properties)
  const riskLevel = getRiskLevel(districtName)

  return {
    districtName,
    division: feature.properties.adm1_en || 'Bangladesh',
    riskLevel,
    riverWaterLevel: getWaterLevel(districtName, riskLevel),
    lastUpdated,
    color: riskLevels[riskLevel].color,
  }
}
