# README.md - Minimal Distributed Synthesis

## Project Overview

A minimal WebRTC-based distributed audio synthesis system designed for edge deployment on Deno Deploy. This project enables a controller interface to manipulate audio parameters on multiple distributed synthesizer clients in real-time.

## Background & Motivation

This project emerged from an over-engineered Fresh + Preact + Zustand implementation that became too complex to reason about. Even simple tasks like adding a console.log to a button click required tracing through multiple abstraction layers.

The goal is to strip away all unnecessary complexity and build the simplest possible implementation that:
- Establishes WebRTC connections between controller and synth clients
- Sends real-time parameter updates over data channels
- Generates audio (starting with pink noise) on synth clients
- Works reliably on Deno Deploy's edge infrastructure

## Core Technical Challenge: Edge Deployment

Deno Deploy runs on a globally distributed edge network. This means:
- Controller might connect to Edge Server A (New York)
- Synth might connect to Edge Server B (London)
- Traditional in-memory WebSocket management won't work
- Need persistent state that works across edge locations

## Proposed Architecture

### 1. Minimal Deno Server (~100 lines)
- WebSocket endpoint for signaling
- HTTP endpoints as fallback
- Deno KV for cross-edge message queuing
- Static file serving for HTML clients

### 2. Controller Client (ctrl.html)
- Plain HTML + vanilla JavaScript
- WebRTC connection management
- Simple parameter controls (volume, frequency, etc.)
- Direct data channel messaging

### 3. Synth Client (index.html)
- Plain HTML + vanilla JavaScript
- Web Audio API for sound generation
- WebRTC data channel receiver
- Pink noise generator as starting point

### 4. Signaling Flow Using Deno KV

```
[Controller @ Edge A] → WebSocket → [Edge Server A]
                                          ↓
                                    [Deno KV Queue]
                                          ↓
[Synth @ Edge B] ← WebSocket ← [Edge Server B]
```

Messages are queued in Deno KV with TTL, and each edge server polls for messages destined to its connected clients.

## Key Design Decisions

1. **No frameworks** - Just HTML, JavaScript, and Deno
2. **No build process** - Direct file serving
3. **Minimal abstractions** - Code you can read top to bottom
4. **Edge-first** - Built for distributed deployment from day one
5. **WebRTC focused** - Signaling is just a means to establish P2P

## Message Protocol (Simplified)

```javascript
// Announce presence
{ type: "announce", source: "synth-123", target: "ctrl-*" }

// WebRTC signaling
{ type: "offer", source: "ctrl-123", target: "synth-456", data: {sdp} }
{ type: "answer", source: "synth-456", target: "ctrl-123", data: {sdp} }
{ type: "ice", source: "ctrl-123", target: "synth-456", data: {candidate} }

// Parameter updates (over data channel once connected)
{ type: "param", name: "volume", value: 0.5 }
{ type: "param", name: "frequency", value: 440 }
```

## Getting Started

```bash
# Clone the repo
git clone [repo-url]
cd minimal-distributed-synth

# Run locally
deno run --allow-net --allow-read --allow-env --unstable-kv server.ts

# Open in browser
# Controller: http://localhost:8000/ctrl.html
# Synth: http://localhost:8000/index.html (or just http://localhost:8000)
```

## Project Structure

```
/
├── server.ts      # Deno server with WebSocket + KV signaling
├── ctrl.html      # Controller interface
├── index.html     # Synthesizer client (default page)
└── README.md      # This file
```

## Next Steps

1. **Implement basic server.ts** with Deno KV message queuing
2. **Create minimal ctrl.html** with volume slider
3. **Create minimal index.html** with pink noise generator
4. **Test locally** with multiple browser tabs
5. **Deploy to Deno Deploy** and test across regions
6. **Add second data channel** for high-frequency updates
7. **Expand audio capabilities** (oscillators, filters, etc.)

But first, we prove the architecture with just volume control.

## Why This Approach?

After spending significant time fighting framework complexity, we realized:
- WebRTC + edge deployment is challenging enough on its own
- Every abstraction layer adds more places for things to go wrong
- The simplest code is often the best
- You can always add complexity later

## Technical References

- [Deno KV Documentation](https://deno.land/manual/runtime/kv)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Deno Deploy](https://deno.com/deploy)

## Contributing

This is a learning/experiment project. The goal is to keep it as simple as possible while solving the distributed synthesis challenge with clarity and simplicity.

---

*"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." - Antoine de Saint-Exupéry*
