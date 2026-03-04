# FlashQuote Frontend

FlashQuote is a React frontend for an AI-powered software quotation platform focused on freelancers.

It includes:
- Marketing landing page
- Clerk authentication (sign-in/sign-up)
- Free-plan activation flow
- Stripe checkout UI for paid plans
- Interactive dashboard (quotes, templates, clients, billing, settings, help)

## Tech Stack

- React (Create React App)
- React Router
- Tailwind CSS
- Clerk (`@clerk/clerk-react`) for auth
- Stripe Elements (`@stripe/react-stripe-js`, `@stripe/stripe-js`) for payments UI

## Project Structure

```text
src/
	App.js            # Routing + landing/auth/checkout/activation flows
	Dashboard.jsx     # Dashboard UI and interactions
	Constants.js      # Backend base URL
	index.js          # App bootstrap + ClerkProvider + BrowserRouter
	index.css         # Tailwind directives

tailwind.config.js
postcss.config.js
```

## Environment Variables

Create a `.env` file in the project root:

```env
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
REACT_APP_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

Notes:
- Stripe key is only required for paid plan checkout (`Starter`, `Professional`, `Agency Plus`).
- Backend base URL is currently set in `src/Constants.js`:

```js
export const BASE_URL = "http://localhost:8000";
```

## Installation

```bash
npm install
```

## Run Locally

```bash
npm start
```

App runs on: `http://localhost:3000`

## Available Scripts

```bash
npm start
npm test
npm run build
```

## Routing Overview

- `/` → Home landing page (or auto-redirects to `/dashboard` if `session_token` exists in `localStorage`)
- `/dashboard` → Main product dashboard
- `/activate-free` → Free plan activation flow
- `/checkout?plan=<PlanName>` → Checkout screen
- `/sign-in/*` → Clerk sign-in page
- `/sign-up/*` → Clerk sign-up page

## Backend API Calls Used by Frontend

### 1) User Sync (after login)

- Endpoint: `POST /api/users/login`
- Trigger: Authenticated user on landing page (`UserSyncPanel`)
- Behavior:
	- Sends Clerk auth/user snapshot
	- Includes `Authorization: Bearer <clerk_jwt>` when available
	- Stores backend `session_token` in `localStorage` if returned

### 2) Free Plan Subscription Activation

- Endpoint: `POST /api/subscriptions/subscribe`
- Trigger: `/activate-free` route
- Behavior:
	- Uses Clerk JWT via `getToken()`
	- Sends idempotency key in header/body
	- On success, redirects to `/dashboard`

## Dashboard Capabilities

The dashboard currently includes rich interactive UI with local state:

- Sidebar navigation with smooth section scrolling
- KPI cards and AI prompt area
- Upload Brief modal (mock upload/parse states)
- Create Quote wizard and draft insertion into Recent Quotes
- Recent Quotes search field scoped to the Recent Quotes section
- Clients section + Add Client modal
- Templates section + Create Template modal
- Template Preview modal + Use Template prefill flow
- Billing section + Upgrade Plan modal (redirects to checkout)
- Settings section with configurable actions and feedback
- Help section with guidance cards

## Authentication & Session Behavior

- Clerk handles sign-in/sign-up/auth state.
- Backend-issued `session_token` is saved to `localStorage`.
- Home route checks for `session_token` and redirects logged-in users to `/dashboard`.

## Styling

Tailwind is enabled via:
- `tailwind.config.js`
- `postcss.config.js`
- `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Current Scope Notes

- Several dashboard actions are UI-driven mocks (no persistent backend storage yet).
- Stripe flow currently captures payment method details in UI; full payment intent/charge completion should be wired on backend.

## Quick Start Checklist

1. Set Clerk and Stripe env vars
2. Ensure backend is running at `BASE_URL`
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`
