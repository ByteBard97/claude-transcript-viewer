import type { Scenario } from 'myopex'

const BASE_URL = 'http://localhost:5173'

const scenarios: Scenario[] = [
  {
    name: 'search-default',
    url: `${BASE_URL}/search`,
  },
  {
    name: 'map-3d',
    url: `${BASE_URL}/map`,
  },
  {
    name: 'map-2d',
    url: `${BASE_URL}/map`,
    steps: [
      { click: 'button:has-text("2D")' },
      { wait: 800 },
    ],
  },
]

export default scenarios
