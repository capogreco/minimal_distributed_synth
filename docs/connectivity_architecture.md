# Connectivity Architecture

## Overview

This document describes the connectivity architecture for the distributed FM Formant Synthesizer system, which consists of controller clients (touch interfaces) and synthesizer clients (audio generators) that communicate via WebRTC data channels with WebSocket signaling.

## Core Principles

### 1. Synth-Always-Initiates
- **Synthesizer clients always initiate WebRTC connections** to controller clients
- Controllers act as "servers" that accept incoming connections
- This simplifies the connection logic and naturally handles the N-to-1 relationship (many synths to one controller)

### 2. KV-Based Discovery
- **Deno KV serves as the single source of truth** for active controllers
- No peer-to-peer announcements or complex message routing
- Server mediates discovery through KV queries

### 3. Automatic Reconnection
- Synths automatically connect to new controllers as they appear
- Controllers automatically accept connections from any synth
- No manual intervention required for reconnection

## Architecture Components

### Server (Deno)
- WebSocket signaling server
- Manages Deno KV registry of active controllers
- Routes WebRTC signaling messages (offer/answer/ICE)
- Notifies synths of controller availability changes

### Controller Clients
- Register with server on connection
- Send periodic heartbeats (every 20 seconds) to maintain KV entry
- Accept incoming WebRTC connections from synths
- Broadcast touch/parameter data to all connected synths

### Synthesizer Clients  
- Request list of active controllers on startup
- Initiate WebRTC connections to all discovered controllers
- Receive real-time parameter updates via unreliable data channels
- Handle connection failures gracefully

## Discovery Flow

### When a Synth Joins

```
1. Synth → Server: "register" (identifies as synth-XXXXX)
2. Synth → Server: "request-controllers"
3. Server queries KV: list(prefix: ["controllers"])
4. Server → Synth: "controllers-list" [ctrl-A, ctrl-B, ...]
5. Synth initiates WebRTC connection to each controller
```

### When a Controller Joins

```
1. Controller → Server: "register" (identifies as ctrl-XXXXX)
2. Server adds to KV: set(["controllers", ctrl-XXXXX], {timestamp}, TTL: 60s)
3. Server → All Synths: "controller-joined" {controller_id: ctrl-XXXXX}
4. Each synth initiates WebRTC connection to new controller
```

### When a Controller Leaves

```
1. WebSocket closes
2. Server removes from KV: delete(["controllers", ctrl-XXXXX])
3. Synths detect WebRTC connection failure
4. Synths clean up peer connection state
```

## KV Registry Design

### Entry Structure
```typescript
Key: ["controllers", controller_id]
Value: {
    timestamp: Date.now(),
    ws_id: websocket_temp_id
}
TTL: 60 seconds
```

### Heartbeat Mechanism
- Controllers send heartbeat every 20 seconds
- Server refreshes KV entry with new 60-second TTL
- Stale entries automatically expire if controller disconnects ungracefully

## Message Types

### Discovery Messages
- `register` - Client identifies itself to server
- `request-controllers` - Synth requests list of active controllers
- `controllers-list` - Server responds with controller array
- `controller-joined` - Server notifies synths of new controller
- `heartbeat` - Controller keeps its KV entry alive

### WebRTC Signaling
- `offer` - Synth initiates connection
- `answer` - Controller accepts connection
- `ice-candidate` - ICE negotiation

### Data Channel Messages
- `touch` - Touch position and state
- `ping/pong` - Latency measurement and state synchronization

## State Synchronization

### Mechanism
- Controllers send `ping` messages to synths every second
- Synths respond with `pong` messages that include their complete state
- No separate state notification messages needed
- State automatically propagates without explicit requests

### State Structure
```javascript
{
  type: "pong",
  timestamp: data.timestamp,
  state: {
    audio_enabled: !!audio_context,
    volume: stored_volume,
    powered_on: is_powered_on
    // easily extensible with new state fields
  }
}
```

### Benefits of Ping/Pong State Sync
- **Always Fresh**: State updates automatically every second
- **Single Mechanism**: No need for separate state messages
- **Race-Free**: No timing issues or state inconsistencies
- **Extensible**: Adding new state is as simple as adding fields
- **Debuggable**: State flow is predictable and observable

## Benefits

### Simplicity
- No announcement loops or complex routing logic
- Clear unidirectional connection flow
- Single source of truth in KV

### Reliability
- Automatic cleanup of stale entries via TTL
- Graceful handling of ungraceful disconnects
- Natural reconnection on controller restart

### Scalability
- Works across distributed edge deployments
- Each edge server maintains its own KV namespace
- WebSocket messages route between servers as needed

## Edge Deployment Considerations

### Cross-Server Discovery
- Controllers and synths may connect to different edge servers
- Server-to-server message routing handles cross-server signaling
- KV registries can be per-edge or globally replicated

### Latency Optimization
- Synths prefer controllers on the same edge server
- Server can include edge location in controller metadata
- Smart routing based on geographic proximity

### Failover
- If edge server fails, clients reconnect to another edge
- New edge server has fresh KV registry
- Discovery process naturally re-establishes connections

## Implementation Notes

### Why Not Controller-Initiated?
- Would require controllers to track all synths
- More complex connection management on controller side
- Less natural for N-to-1 relationship

### Why Not Peer Announcements?
- Creates announcement storms and loops
- Requires complex deduplication logic
- Doesn't scale well with many clients

### Why 60-Second TTL?
- Balances between quick cleanup and heartbeat overhead
- 3x heartbeat interval provides good safety margin
- Prevents permanent KV pollution from crashed clients