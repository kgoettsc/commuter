# Commuter

A real-time commuter dashboard for NYC Metro-North Harlem Line and 6 Train riders. Get live departure times, optimal connection planning, and drive time estimates all in one view.

## Features

- **Live Transit Data**: Real-time departure information from MTA GTFS feeds
- **Smart Mode Detection**: Automatically switches between work and home modes based on time of day
- **Connection Planning**: Calculates optimal Harlem Line connections from 6 Train arrivals at Grand Central
- **Drive Time Estimates**: Shows drive time to Goldens Bridge Station with traffic conditions (via Google Maps Distance Matrix API)
- **Graceful Fallbacks**: Uses time-based estimates when live data is unavailable
- **Responsive Design**: Optimized for both mobile and desktop viewing
- **Dark Theme**: Easy-to-read interface designed for commuter use

## Prerequisites

- Node.js 20 or later
- npm or yarn
- MTA API key (free, register at https://api.mta.info/)
- Google Maps API key with Distance Matrix API enabled (optional, has free tier with billing account)

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd commuter
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# MTA API Key (Required for live 6 Train data)
# Register at https://api.mta.info/
MTA_API_KEY=your_mta_api_key_here

# Google Maps API Key (Optional - will use time-based fallback without it)
# Register at https://console.cloud.google.com/
# Enable Distance Matrix API (requires billing, has $200/month free tier)
GOOGLE_MAPS_API_KEY=your_google_maps_key_here

# Your addresses for drive time calculation
HOME_ADDRESS="123 Main St, New York, NY"
GOLDENS_BRIDGE_ADDRESS="Goldens Bridge Station, NY 10526"
```

**Important**: Never commit `.env.local` to version control. It's already ignored in `.gitignore`.

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### Transit Data

- `GET /api/harlem-line` - Metro-North Harlem Line departures from Goldens Bridge
- `GET /api/6-train` - NYC Subway 6 Train northbound departures from Spring St
- `GET /api/drive-time` - Drive time from home to Goldens Bridge Station

### Commute Modes

- `GET /api/work-mode` - Morning commute: Drive + Harlem Line to Grand Central
- `GET /api/home-mode` - Evening commute: 6 Train + Harlem Line to Goldens Bridge

Each endpoint returns JSON with `live` status and `data` payload. When live data is unavailable, endpoints gracefully fall back to estimated/stub data.

## Production Build

### Test locally

```bash
# Build the production version
npm run build

# Start the production server
npm start
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

1. Push your code to a GitHub repository
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings:
   - `MTA_API_KEY`
   - `GOOGLE_MAPS_API_KEY` (optional)
   - `HOME_ADDRESS`
   - `GOLDENS_BRIDGE_ADDRESS`
4. Deploy!

Vercel will automatically build and deploy your app. Subsequent pushes to your main branch will trigger automatic deployments.

## Architecture

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with shadcn/ui patterns
- **Data Sources**:
  - MTA GTFS Realtime feeds (gtfs-realtime-bindings)
  - Google Maps Distance Matrix API
- **State Management**: React hooks
- **Testing**: Jest with React Testing Library

## Development

### Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Project structure

```
commuter/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── 6-train/       # 6 Train endpoint
│   │   ├── harlem-line/   # Harlem Line endpoint
│   │   ├── drive-time/    # Drive time endpoint
│   │   ├── work-mode/     # Work commute endpoint
│   │   └── home-mode/     # Home commute endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main dashboard page
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and API clients
│   └── server/            # Server-side utilities
├── types/                 # TypeScript type definitions
├── public/                # Static assets
└── .env.local            # Environment variables (not in git)
```

## Troubleshooting

### No live data showing

- Check that your `MTA_API_KEY` is correctly set in `.env.local`
- MTA feeds may occasionally be unavailable - the app will fall back to estimated data
- For Google Maps data, ensure billing is enabled (required even for free tier)

### Build errors

- Ensure all environment variables are properly formatted (no trailing spaces)
- Try deleting `.next` folder and rebuilding: `rm -rf .next && npm run build`

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

Built with [Next.js](https://nextjs.org) and the MTA GTFS Realtime API.
# Last updated: Fri Apr 17 13:18:50 EDT 2026
