# BehindTheGates
Behind The Gates is a booking platform for guided visits inside real, working companies — factories, refineries, ports — giving students, career-explorers, and the curious a seat on tours that don't normally exist.

There's no way to book a visit to see how a real business actually operates — a car plant, an oil refinery, a container port — the way you'd book a museum ticket. Behind The Gates fixes that: a GetYourGuide-style marketplace where companies open their doors for guided tours, and visitors — especially students deciding on a career — book a seat online. For companies, it's a low-effort recruiting and employer-branding channel; for visitors, it's the closest thing to trying a career on before choosing one.

Behind The Gates is an online marketplace for booking guided visits to real operating companies — manufacturing plants, energy facilities, logistics hubs, and other sites people are curious about but can't normally access. Think GetYourGuide, but instead of museums and city tours, the inventory is working businesses: a Porsche assembly line, an oil refinery, a container port. The primary audience is students and career-explorers who want to see an industry from the inside before choosing where to study or work, alongside general enthusiasts and families. For host companies, participating isn't about ticket revenue — it's a recruiting pipeline, an employer-branding tool, and a community/CSR touchpoint, with the platform handling booking, waivers, scheduling, and safety logistics so it doesn't disrupt their operations.

## AI Port Operations Copilot (MVP)

This repository also hosts the **AI Port Operations Copilot**, a cloud-native SaaS platform that simulates a container terminal and uses optimization plus machine learning to recommend operational decisions. It lives under [`backend/`](backend/) and [`frontend/`](frontend/) and is a separate application from the tour-booking marketplace above.

See [`docs/PORT_COPILOT.md`](docs/PORT_COPILOT.md) for the full architecture, setup, and API reference. Quick start:

```bash
cp .env.example .env
docker compose up --build
# API:      http://localhost:8000/docs
# Frontend: http://localhost:3000
```
