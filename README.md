# Responsive Web Dashboard UI

A responsive web dashboard built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui components.

---

## Getting Started in VSCode

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher

### Setup

1. **Open the folder in VSCode**
   `File → Open Folder → select this folder`

2. **Install dependencies**
   Open the integrated terminal (Ctrl+` or Terminal → New Terminal) and run:
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```
   Then open http://localhost:5173 in your browser.

### Build for production
```bash
npm run build
```

---

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool & dev server
- **Tailwind CSS v4** — Utility-first styling
- **shadcn/ui + Radix UI** — Accessible component primitives
- **Recharts** — Charts and data visualisation
- **React Router v7** — Client-side routing
- **MUI Icons** — Icon set

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   ├── AlertCard.tsx
│   ├── CameraCard.tsx
│   ├── ConversionCard.tsx
│   ├── HeatmapChart.tsx
│   ├── KPICard.tsx
│   ├── Sidebar.tsx
│   └── TrafficChart.tsx
├── pages/
│   ├── Layout.tsx
│   ├── DashboardPage.tsx
│   ├── CamerasPage.tsx
│   └── ...
├── styles/
├── App.tsx
├── routes.ts
└── main.tsx
```
