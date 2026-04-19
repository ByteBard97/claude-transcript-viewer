interface UmapPoint {
  x: number
  y: number
  z: number
  title: string
  project: string
}

const SIGNALCANVAS_POINT_COUNT = 1200
const FLORA_POINT_COUNT = 800
const CLUSTER_SPREAD = 0.8

function gaussian(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

interface ClusterCenter {
  x: number
  y: number
  z: number
  label: string
  count: number
}

function generateCluster(center: ClusterCenter, titles: string[]): UmapPoint[] {
  return Array.from({ length: center.count }, (_, i) => ({
    x: center.x + gaussian() * CLUSTER_SPREAD,
    y: center.y + gaussian() * CLUSTER_SPREAD,
    z: center.z + gaussian() * CLUSTER_SPREAD,
    title: titles[i % titles.length],
    project: center.label,
  }))
}

const SIGNALCANVAS_CLUSTERS: ClusterCenter[] = [
  { x: -3, y: 2, z: 1, label: 'SignalCanvas', count: 400 },
  { x: -1, y: -2, z: 2, label: 'SignalCanvas', count: 350 },
  { x: -4, y: -1, z: -1, label: 'SignalCanvas', count: 300 },
  { x: -2, y: 4, z: -2, label: 'SignalCanvas', count: 150 },
]

const FLORA_CLUSTERS: ClusterCenter[] = [
  { x: 3, y: 2, z: -1, label: 'Flora UXP', count: 350 },
  { x: 2, y: -3, z: 1, label: 'Flora UXP', count: 280 },
  { x: 4, y: 0, z: 2, label: 'Flora UXP', count: 170 },
]

const SC_TITLES = [
  'Implementing laneDeconflict stage',
  'Router extraction and testing',
  'PatchLang compiler v0.2',
  'Vue Flow canvas integration',
  'Signal path tracing algorithm',
  'Django REST API setup',
  'WASM binding for Rust compiler',
  'Pinia state normalization',
  'Port alignment optimization',
  'Crossing reduction heuristics',
]

const FLORA_TITLES = [
  'Adobe UXP plugin setup',
  'CEP to UXP migration',
  'Flora backend API',
  'Illustrator panel rendering',
  'HTTP client integration',
  'Asset export pipeline',
  'Plugin manifest config',
  'Layer tree navigation',
]

export function generateMockUmapData(): {
  signalCanvasPoints: UmapPoint[]
  floraPoints: UmapPoint[]
} {
  const signalCanvasPoints = SIGNALCANVAS_CLUSTERS.flatMap((c) => generateCluster(c, SC_TITLES))
  const floraPoints = FLORA_CLUSTERS.flatMap((c) => generateCluster(c, FLORA_TITLES))

  // Trim to target counts
  return {
    signalCanvasPoints: signalCanvasPoints.slice(0, SIGNALCANVAS_POINT_COUNT),
    floraPoints: floraPoints.slice(0, FLORA_POINT_COUNT),
  }
}
