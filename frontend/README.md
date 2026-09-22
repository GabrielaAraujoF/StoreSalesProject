This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The frontend targets Node.js 24 LTS. Version managers can read `.nvmrc`, and
Vercel reads the matching `engines.node` declaration from `package.json`.

## Backend API

In local development, `/api` points to `http://localhost:5000` by default. You
can override the Flask server URL in `frontend/.env.local`:

```env
BACKEND_URL=http://localhost:5000
```

The `.env.local` file is intentionally ignored by Git. Restart the Next.js
development server after changing it.

Frontend requests must use relative `/api/...` paths. The rewrite configured in
`next.config.ts` proxies those requests to the Flask server, so the browser keeps
the same `http://localhost:3000` origin and Flask does not need CORS for this
development setup. Cookies, authentication and the CSRF header also remain on
the frontend origin. Keep trailing slashes consistent with the Flask route
(for example, use `/api/products/` for the products collection).

`BACKEND_URL` is server-only and must not use the `NEXT_PUBLIC_` prefix. Client
code must not call Railway directly.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Configure this environment variable in Vercel for Production and for every
Preview environment that should be deployable:

```env
BACKEND_URL=https://your-backend.up.railway.app
```

Production builds fail when `BACKEND_URL` is missing, does not use HTTPS or
points to localhost. The Next.js rewrite proxies `/api/...` to Railway, so no
CORS configuration is needed in Flask for the frontend.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
