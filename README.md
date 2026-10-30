# Emerge

> **TODO:** One-sentence description of what Emerge is and who it's for.

<!-- Optional: add a screenshot or demo GIF here -->
<!-- ![Emerge screenshot](public/screenshot.png) -->

## Features

- **TODO:** Key feature one
- **TODO:** Key feature two
- **TODO:** Key feature three

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
