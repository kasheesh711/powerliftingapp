# Google OAuth + Drive Picker Setup

Date: 2026-02-25

## Purpose
Prepare Google OAuth and Drive Picker credentials for the dashboard flow. This setup is non-blocking for the Excel demo path, but required for Google-backed selection/parity work.

## 1) Create/Select Google Cloud Project
1. Open Google Cloud Console.
2. Create a dedicated project (or use an existing app-specific project).
3. Confirm billing/org policy requirements.

## 2) Enable Required APIs
Enable both APIs:
- Google Sheets API
- Google Drive API

## 3) Configure OAuth Consent Screen
1. Go to `APIs & Services -> OAuth consent screen`.
2. Set app name and support email.
3. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
4. Add rehearsal/test users.

## 4) Create OAuth Client
1. Go to `APIs & Services -> Credentials -> Create Credentials -> OAuth client ID`.
2. Select `Web application`.
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-deployed-domain>/api/auth/callback/google`
4. Save and record:
   - Client ID
   - Client secret

## 5) Create Drive Picker Credentials
1. Create an API key in Google Cloud.
2. Restrict key usage to required APIs/domains.
3. Record Picker App ID (GCP Project Number).

## 6) Map to Runtime Environment Variables
Set these in local and deployment environments:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PICKER_API_KEY`
- `GOOGLE_PICKER_APP_ID`

## 7) Validation Checklist
- [ ] Google sign-in completes successfully.
- [ ] `/api/spreadsheets/picker-config` returns `enabled: true`.
- [ ] `/api/spreadsheets/picker-token` returns access token for authenticated users.
- [ ] Drive Picker opens and returns spreadsheet ID/URL.
- [ ] Selected spreadsheet persists and loads in dashboard flow.

