import { createRouter, createWebHistory } from 'vue-router'

import { useAuth } from './auth/session'
import AuthView from './views/AuthView.vue'
import GoogleCallbackView from './views/GoogleCallbackView.vue'
import GoogleLinkView from './views/GoogleLinkView.vue'
import PortfoliosView from './views/PortfoliosView.vue'
import ProfileView from './views/ProfileView.vue'

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
      path: '/profile',
      component: ProfileView,
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
