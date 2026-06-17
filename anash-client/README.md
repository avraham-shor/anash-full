# anash-client

Hebrew community directory — search members by name, phone, city, or synagogue.  
Created by **Avraham Shor**.

Single-page React application (SPA) built with React Router 7, TypeScript, and Vite. Communicates with [anash-server](../anash-server/README.md) for all data.

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| UI | React 19 |
| Routing | React Router 7 (file-based, SPA mode) |
| Build | Vite 8 |
| Styling | CSS Modules + global CSS variables |
| Auth | JWT stored in `localStorage` |
| Deploy | GitHub Pages (`gh-pages`) |

---

## Project Structure

```
src/
├── entry.client.tsx        # Client entry point (HydratedRouter)
├── root.tsx                # Root layout — header, nav, error boundary
├── routes.ts               # Route definitions
├── config.ts               # API endpoint constants
├── styles.css              # Global design tokens (colors, typography, shadows)
│
├── context/
│   └── auth.tsx            # AuthContext — token, role, login(), logout()
│
├── routes/
│   ├── login.tsx           # Public login page
│   ├── protected-layout.tsx# JWT expiry guard, wraps all authenticated routes
│   ├── home.tsx            # Main search/dashboard page
│   ├── login-logs.tsx      # Login audit log (owner only)
│   └── users+/
│       ├── _layout.tsx     # Outlet wrapper for /users/* routes
│       └── $id.details.tsx # User detail page
│
├── components/
│   ├── card.tsx            # Full user detail card (used on detail page)
│   ├── short-card.tsx      # Compact result card (used in search grid)
│   ├── icon.tsx            # Phone / WhatsApp / email action button
│   └── loader.tsx          # Three-dot loading animation
│
├── models/
│   └── user.ts             # User TypeScript type
│
└── utils/
    ├── maps.ts             # Static synagogue and city data
    └── utils.ts            # getWhatsappUrl() helper
```

---

## Running Locally

```bash
npm install
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # Production build → build/client/
npm run preview   # Preview production build locally
```

---

## Config

All API URLs are defined in [src/config.ts](src/config.ts):

```ts
AUTH_URL            = '/api/auth/login'
CHANGE_PASSWORD_URL = '/api/auth/change-password'
USERS_URL           = '/api/users/'
LOGIN_LOGS_URL      = '/api/auth/login-logs'
```

In production the client is served from the same origin as the server so relative paths work without a proxy. For local dev, configure a Vite proxy in `vite.config.ts` if the server runs on a different port.

---

## Routing

Defined in [src/routes.ts](src/routes.ts):

```
/login          → routes/login.tsx               (public)
/               → routes/home.tsx                (protected)
/users/:id      → routes/users+/$id.details.tsx  (protected)
/login-logs     → routes/login-logs.tsx          (protected, owner only)
```

`protected-layout.tsx` wraps all non-login routes. It decodes the JWT from `localStorage`, checks the `exp` claim, and redirects to `/login` if the token is missing or expired.

---

## Authentication

Managed by [src/context/auth.tsx](src/context/auth.tsx).

```
localStorage["token"]  ←→  AuthContext { token, id, name, role }
```

- **`login(phone, password?)`** — `POST /api/auth/login`, stores the returned JWT
- **`logout()`** — clears `localStorage` and resets context state
- **`useAuth()`** — hook to read `{ token, id, name, role }` from any component

The JWT payload (`{ id, email, name, role }`) is base64-decoded client-side — no separate `/me` call is needed.

### Roles

| Role | Access |
|---|---|
| `user` | Search, user detail (restricted columns) |
| `admin` | Search, user detail (all columns including IDs and system phones) |
| `owner` | Everything above + password/role management + login logs |

---

## Pages

### `/login`

Public. Phone number is required; password is optional (phone-only grants `user` role). Redirects to `/` on success.

---

### `/` — Home / Search

All search state is synced to URL parameters so the back button and link-sharing work correctly.

**Search modes**

| Mode | API call |
|---|---|
| By phone | `GET /api/users/search/phone?number=...&shul=...&city=...` |
| By name | `GET /api/users/search/name?fullname=...&shul=...&city=...` |
| By place (shul/city only) | `GET /api/users/search/place?shul=...&city=...` |
| Empty input | `GET /api/users` — full list |

**Filters** (collapsible panel)
- City dropdown — 7 options including `אחר` (all other cities)
- Synagogue dropdown — 21 options, scoped to the selected city

Results are displayed as a grid of `ShortCard` components. Clicking a card navigates to `/users/:id`.

**Admin bar** (visible to `admin` / `owner`)
- Change own password modal
- Link to `/login-logs` (owner only)

---

### `/users/:id` — User Detail

Fetches `GET /api/users/:id` with the Bearer token and renders a `Card` component. Column visibility is role-dependent (see Roles above).

---

### `/login-logs` — Login Audit Log (owner only)

Redirects non-owners to `/`.

**Filters**

| Type | Options |
|---|---|
| Period | All / Today / This week / This month / This year |
| Outcome | All / Successful / Failed |

Stats cards (total / successful / failed) always reflect the selected period, independent of the outcome filter.

Table columns: status badge · name (link to user detail) · city · date & time · IP address · browser (truncated user-agent).

---

## Components

### `Card`

Full-detail user card. Sections render conditionally — a section is hidden when all its fields are empty.

| Section | Fields shown |
|---|---|
| Contact | husbandMobile, wifeMobile, homePhone, whatsappNumber, email1, email2 |
| Address | street + buildingNumber + entranceNumber + apartmentNumber + neighborhood + city |
| Family | wifeName, fatherName, childrenAtHomeCount, hasMarriedChildren, isGroomOfRabbi |
| Admin (admin/owner only) | idNumber, wifeIdNumber, systemPhone1, systemPhone2 |

Contact action row: phone · WhatsApp · email — each button only appears when the value exists.

`EditPasswordModal` (owner only) — set a password and/or change the role for this user.

---

### `ShortCard`

Compact search-result card. Shows name, father name, primary phone, home phone, address summary, and synagogue. The entire card is a `<Link>` to `/users/:id`.

---

### `Icon`

Contact action button with three types:

| Type | Link format |
|---|---|
| `phone` | `tel:<number>` |
| `whatsapp` | `https://wa.me/972<number>` |
| `email` | `mailto:<address>` |

`getWhatsappUrl(phone)` strips spaces/hyphens and replaces the leading `0` with `+972`.

---

### `Loader`

Three pulsing dots with staggered CSS animation delays. Optional `text` prop (default: `"טוען נתונים..."`).

---

## Design System

Global tokens in [src/styles.css](src/styles.css):

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#7C3AED` | Buttons, links, accents |
| `--color-primary-hover` | `#6D28D9` | Hover states |
| `--color-primary-light` | `#EDE9FE` | Backgrounds, badges |
| `--color-bg` | `#F5F3FF` | Page background |

**Typography** — Heebo (Hebrew-optimised Google Font), `direction: rtl` globally.

**Dark mode** — full dark theme via `@media (prefers-color-scheme: dark)`, background switches to `#0D0B1E`.

**Transitions** — `200ms cubic-bezier(0.4,0,0.2,1)` default.

Each component has its own `.module.css` file for scoped styles.

---

## Static Data

[src/utils/maps.ts](src/utils/maps.ts) exports two arrays used by the search filter dropdowns:

- **`synagogues`** — 21 entries, each with `{ label, value, city }`. The city field is used to filter the synagogue list when a city is selected.
- **`cities`** — 7 entries: ירושלים · מודיעין עילית · ביתר עילית · בני ברק · טבריה · גבעת זאב · אחר.

---

## Deploy

```bash
npm run deploy    # runs build then gh-pages -d build/client
```

Publishes to the `gh-pages` branch, served via GitHub Pages.
