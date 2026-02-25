# Google OAuth + Drive Picker Setup (Next Cycle Prep)

Date: 2026-02-25

## Purpose
Prepare Google credentials and Picker configuration without blocking the Excel MVP demo track.

## 1) Google Cloud Project
1. Create a dedicated Google Cloud project for this app.
2. Enable billing if required by your organization policy.

## 2) Enable APIs
Enable:
- Google Sheets API
- Google Drive API

## 3) OAuth Consent Screen
1. Configure app name and support email.
2. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.file`
3. Add test users for pre-production testing.

## 4) OAuth Client Credentials
1. Create a Web application OAuth client.
2. Record:
   - Client ID
   - Client secret
3. Add redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-deployment-domain>/api/auth/callback/google`

## 5) Drive Picker Credentials
1. Create an API key (restricted to required APIs).
2. Record Picker app ID from the Cloud project.
3. Configure allowed origins for deployed domain and localhost.

## 6) Secret Management
Store secrets in a vault/password manager and map to runtime env vars:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PICKER_API_KEY`
- `GOOGLE_PICKER_APP_ID`

## 7) Validation Checklist
- [ ] Google sign-in completes with callback URL.
- [ ] Token vault persistence path works end-to-end.
- [ ] `/api/spreadsheets/picker-config` returns `enabled: true`.
- [ ] `/api/spreadsheets/picker-token` returns access token for authenticated users.
- [ ] Drive Picker opens and returns spreadsheet ID/url.

