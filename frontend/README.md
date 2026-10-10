# VIGIL frontend

React + Vite frontend for the existing Flask backend.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The API base URL is configured with `VITE_API_BASE_URL`. Local development
defaults to `http://localhost:5000`; production builds do not contain a
localhost fallback and should set this variable to the deployed API origin.
Production build and tests:

```powershell
npm run build
npm test
```
