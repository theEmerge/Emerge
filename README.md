# Emect

A chronological, algorithm-free photo network with topic communities. No algorithm. No ads.

**Live site:** [emect.netlify.app](https://emect.netlify.app)

<!-- Optional: add a screenshot or demo GIF here -->
<!-- ![Emect screenshot](public/screenshot.png) -->

## Features

- **Chronological feed:** posts appear in the order they were shared, with no ranking algorithm
- **Topic communities:** share and browse photos within communities built around topics
- **Ad-free:** no advertising
- **Accounts:** registration, login and password reset
- **TODO:** Add any other features (comments, likes, following, uploads, etc.)

## Tech Stack

- [Next.js](https://nextjs.org/) with TypeScript
- [Prisma](https://www.prisma.io/) for database access
- [Netlify](https://www.netlify.com/) for deployment

## Project Structure

```
Emerge/
├── prisma/          # Database schema and migrations
├── public/          # Static assets
├── src/             # Application source code
├── ui/              # UI components
├── netlify.toml     # Netlify deployment config
├── next.config.mjs  # Next.js config
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm
- A database supported by Prisma (**TODO:** specify, e.g. PostgreSQL)

### Installation

```bash
git clone https://github.com/theEmerge/Emerge.git
cd Emerge
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="your-database-connection-string"
# TODO: add any other required variables
```

### Database Setup

```bash
npx prisma generate
npx prisma migrate dev
```

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the development server |
| `npm run build` | Build for production         |
| `npm start`     | Run the production build     |

> **TODO:** Check these against the `scripts` section of `package.json`.

## Deployment

The project includes a `netlify.toml`, so it can be deployed to Netlify:

1. Push the repo to GitHub.
2. Import it in Netlify.
3. Add your environment variables (such as `DATABASE_URL`) in the Netlify dashboard.
4. Deploy.

## Contributing

Contributions are welcome. Please open an issue to discuss larger changes before submitting a pull request.

## License

> **TODO:** Add a license (e.g. MIT) and a `LICENSE` file.

## SEO

Only the front page (`/`) and `/register` are public, so only those are indexed. Everything else is `noindex` by default (see `src/app/layout.tsx`); a new page has to opt in.

- `src/lib/site.ts` holds the site URL, title, description and share image. It uses `https://emect.netlify.app` unless `NEXT_PUBLIC_SITE_URL` is set (use that for a custom domain).
- `src/app/robots.ts`, `sitemap.ts` and `manifest.ts` generate `/robots.txt`, `/sitemap.xml` and the web manifest. Add new public pages to `sitemap.ts` and to the `allow` list in `robots.ts`.
- `src/components/Landing.tsx` is the logged-out front page, with the FAQ and JSON-LD structured data.
- To verify with Google Search Console, set `GOOGLE_SITE_VERIFICATION` in Netlify to the token it gives you.
