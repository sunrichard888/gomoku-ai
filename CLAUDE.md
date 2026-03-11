# Gomoku AI - Project Guide

> **Primary agent: Read `.team/coordinator-instructions.md` first.**

## Quick Start

1. Read `.team/coordinator-instructions.md` for your role
2. Team members are in `.team/` directory
3. Project constraints are in `PROJECT.md`
4. Team conventions are in `AGENTS.md`

## Tech Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Canvas API for board rendering
- Web Worker for AI computation
- Deploy to Vercel

## Project Structure

```
/
├── .team/                    # Team member profiles
├── docs/                     # Architecture & glossary
├── app/                      # Next.js App Router
├── components/               # React components
├── lib/                      # Game logic & AI
└── public/                   # Assets
```

## First Task

Initialize the Next.js project with:
```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Then follow the coordinator instructions.
