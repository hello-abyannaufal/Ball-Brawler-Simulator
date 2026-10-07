# Ball Battle Simulator

A deterministic, seeded ball-versus-ball battle simulator built with Nuxt 3, TypeScript, and a framework-free engine core.

## Local Setup

### Prerequisites

| Tool           | Version           |
| -------------- | ----------------- |
| Node.js        | >= 18.12.0 (v24 recommended) |
| npm            | Ships with Node   |
| Docker + Compose | Any recent stable |

### 1. Install dependencies

```fish
nvm use 24
npm install
```

### 2. Set up environment variables

```fish
cp .env.example .env
```

Edit `.env` to match your local setup. The defaults work with the provided docker-compose. If port 5432 is taken, change `POSTGRES_PORT` and update `DATABASE_URL` accordingly.

### 3. Start the database

```fish
docker compose up -d
```

This starts a local PostgreSQL instance on the port defined in `.env`.

### 4. Run migrations

```fish
npm run db:migrate
```

Applies all pending migrations. Prints the count on success. On connection failure, reports the host/port attempted without leaking secrets.

### 5. Run the app

```fish
npm run dev
```

Opens at `http://localhost:3000`.

### 6. Run tests

```fish
npm test
```

Runs both engine (Node env, no DOM) and app (happy-dom) test suites via Vitest.

### Available scripts

| Script         | Description                         |
| -------------- | ----------------------------------- |
| `npm run dev`  | Start Nuxt dev server               |
| `npm run build`| Production build                    |
| `npm test`     | Run all tests (vitest)              |
| `npm run lint` | Lint with ESLint                    |
| `npm run db:generate` | Generate Drizzle migrations  |
| `npm run db:migrate`  | Apply pending DB migrations  |
