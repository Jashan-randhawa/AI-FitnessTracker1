# 🚢 Production Deployment Guide

[← Back to Documentation Index](README.md)

## 🚢 Deployment

### Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Set root directory to `client`.
3. Add Environment Variable:
   - `VITE_API_URL` = `https://your-backend-api-url.com`
4. The repo includes `client/vercel.json` for SPA URL rewrites:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
   ```

### Backend (Render / Railway / Fly.io / VPS)
1. Deploy `server/` to any Node.js host.
2. Ensure Node.js version is `>=20.0.0` (Node 22 recommended).
3. Set all required environment variables in the host dashboard.
4. Set start command: `npm start`.

---


### Security Checklist for Production
- [ ] Set `NODE_ENV=production`.
- [ ] Ensure `JWT_SECRET` is a high-entropy string (`openssl rand -base64 48`).
- [ ] Configure `REFRESH_TOKEN_SECURE=true` for HTTPS cookie transmission.
- [ ] Set `REFRESH_TOKEN_COOKIE_PATH=/api/auth` to limit cookie scope.
- [ ] Protect `GET /api/metrics` with a non-empty `METRICS_TOKEN`.
- [ ] Authenticate email status webhooks with `BREVO_WEBHOOK_KEY`.
- [ ] Configure MongoDB Atlas with IP access lists and dedicated credentials.
