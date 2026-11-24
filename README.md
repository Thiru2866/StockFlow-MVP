# StockFlow MVP

A single-owner, multi-tenant inventory app. Each organization can manage products,
stock levels, prices, and a default low-stock threshold.

## Requirements

- Node.js 20.19+ (or 22.12+)
- MongoDB running locally or a MongoDB connection URI

## Configure

Create `backend/.env` with:

```env
MONGO_URI=mongodb://127.0.0.1:27017
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
```

Keep `.env` private and do not commit real credentials.

## Run locally

Install dependencies once in each project directory:

```powershell
cd backend
npm install
```

In a second terminal:

```powershell
cd frontend
npm install
```

Start the backend from `backend`:

```powershell
npm run dev
```

Start the frontend from `frontend`:

```powershell
npm run dev
```

Open the Vite URL shown in the frontend terminal (normally
`http://localhost:5173`). The frontend proxies `/api` requests to the backend at
`http://127.0.0.1:5000`. Create an account on the signup screen to get started;
there is no default demo login.

## Included features

- Organization signup and login with hashed passwords and JWT authentication
- Organization-scoped product create, list, update, and delete
- SKU/name search, stock adjustment, and low-stock indicators
- Dashboard totals and low-stock list
- Organization-level default low-stock threshold

## Checks

```powershell
cd frontend
npm run lint
npm run build
```
