import { createRouter, createWebHistory } from 'vue-router'

import { useAuth } from './auth/session'
import AuthView from './views/AuthView.vue'
import GoogleCallbackView from './views/GoogleCallbackView.vue'
import GoogleLinkView from './views/GoogleLinkView.vue'
import AlertsView from './views/AlertsView.vue'
import AssetDetailView from './views/AssetDetailView.vue'
import PortfolioDetailView from './views/PortfolioDetailView.vue'
import PortfoliosView from './views/PortfoliosView.vue'
import ProfileView from './views/ProfileView.vue'
import WatchlistView from './views/WatchlistView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/portfolios',
    },
    {
      path: '/login',
      component: AuthView,
    },
    {
      path: '/auth/callback',
      component: GoogleCallbackView,
      meta: { restoreSession: true },
    },
    {
      path: '/auth/link',
      component: GoogleLinkView,
    },
    {
      path: '/portfolios',
      component: PortfoliosView,
      meta: { requiresAuth: true },
    },
    {
      path: '/portfolios/:id',
      component: PortfolioDetailView,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      component: ProfileView,
      meta: { requiresAuth: true },
    },
    {
      path: '/watchlist',
      component: WatchlistView,
      meta: { requiresAuth: true },
    },
    {
      path: '/alerts',
      component: AlertsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/assets/:id',
      component: AssetDetailView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuth()

  if (to.meta.requiresAuth || to.meta.restoreSession) {
    await auth.restoreSession()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    return '/login'
  }

  if (
    (to.path === '/login' || to.path === '/auth/callback') &&
    auth.isAuthenticated.value
  ) {
    return '/portfolios'
  }

  return true
})

export default router
