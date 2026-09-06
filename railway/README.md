# Railway deploy helpers
#
# railway.api.json / railway.web.json live at the repo root.
# Copy env from .env.railway.example into the API service variables.
#
# After both services have public domains, update:
#   API: CORS_ORIGIN, GOOGLE_* URLs
#   Web build: VITE_API_URL
# Then redeploy web so the baked API URL is correct.
