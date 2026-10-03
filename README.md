# KMSFLIMS

React + Node.js/Express + Supabase movie platform.

### Features
- Real Node.js API backed by Supabase Postgres
- Movie, series and episode records
- YouTube Data API v3 trailer search with embeddable/syndicated filters
- Optional English → Kinyarwanda translation using Google Cloud Translation
- Kinyarwanda descriptions stored in Supabase
- RLS enabled on all KMSFLIMS tables

### Setup
1. Copy `server/.env.example` to `server/.env`.
2. Add the Supabase server-only service role key, YouTube API key and optional Google Translation key.
3. Run `npm install` from the root.
4. Run `npm run dev`.
5. Frontend: http://localhost:5173
6. API: http://localhost:5000/api/health

Never commit secrets. Only publishable/anon keys belong in a browser; the service-role key must remain server-side.