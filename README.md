# Lando Curb

A tiny traffic-puzzle game about drawing streets, connecting homes, and keeping impatient commuters from turning the neighborhood into a parking lot.

Build roads between garages and houses, spend your limited path tiles wisely, and adapt as the map fills up with new demand. The whole game runs in the browser as a static Vite app.

## Play

Once GitHub Pages has finished deploying, the game should be available at:

https://landostock.github.io/lando-curb/

## How To Play

Drag from a garage or existing road tile to draw streets toward houses. Connected houses can receive commuters. Better routes mean happier drivers, but every road tile costs space from your limited inventory.

You can pause to think, remove roads when your plan changes, and use diagonals to stretch your road budget further.

## Features

- SVG-based rendering with smooth browser-native transforms
- Procedural map generation
- Road drawing and removal
- Commuter spawning, routing, and traffic behavior
- Upgrade and game-over flow
- Adaptive background music and synthesized sound effects

## Tech

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Kontra.js](https://straker.github.io/kontra/)
- SVG, CSS transitions, and browser audio APIs

## Local Development

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Build the static site:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Deployment

This repo includes a GitHub Actions workflow for GitHub Pages. Every push to `main` builds the game and deploys the `dist/` output.

## Versioning

Stable milestones can be tagged in Git, for example:

```bash
git tag v0.1.0
git push origin v0.1.0
```

To inspect previous versions:

```bash
git log --oneline
```

## Rights

Copyright (c) 2026 Lando Stock. All rights reserved.

This repository is public for hosting and portfolio purposes. No permission is granted to copy, modify, distribute, reuse, or repackage the code, music, or other assets without written permission.
