import { createRouter, createWebHistory } from 'vue-router'
import SearchView from '../views/SearchView.vue'
import SemanticMapView from '../views/SemanticMapView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/search' },
    { path: '/search', name: 'search', component: SearchView },
    { path: '/map', name: 'map', component: SemanticMapView },
  ],
})

export default router
