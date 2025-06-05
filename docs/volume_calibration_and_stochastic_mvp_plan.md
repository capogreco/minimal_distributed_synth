# Volume Calibration & Stochastic Synthesis MVP Plan

## Overview

This document outlines the implementation plan for adding volume calibration and stochastic synthesis features to the minimal distributed synthesizer. The plan follows an incremental, testable approach with four distinct phases.

## Architecture Goals

- **Volume calibration phase** prior to joining the instrument proper
- **Global phase synchronization** across all synths via controller
- **Harmonic stochasticity** using SIN (Stochastic Integer Notation) for LFO frequency relationships
- **Persistent audio graph paradigm** - graphs stay connected, just muted/unmuted
- **Testable milestones** with clear success criteria at each phase

## Phase Synchronization Strategy

**Phase reset approach** (not continuous streaming):
- Controller sends phase reset messages only when needed (period changes, manual reset)
- Synths calculate their own phase between resets: `(Date.now() - resetTime) / (period * 1000) % 1.0`
- Efficient: ~1-10 messages/minute vs 3600/minute with streaming

```javascript
// Phase reset message format
{
  type: "phase-reset", 
  timestamp: Date.now(), 
  period: 2.5  // seconds
}
```

## Audio Graph Architecture

### Calibration Phase
```
PinkNoiseWorklet(0.2) -> GainNode -> AudioDestination
                                  -> AnalyserNode (FFT visualizer)
```

### Instrument Proper (built during calibration, initially silent)
```
WhiteNoiseWorklet -> LowPassFilter -> GainNode -> MuteNode -> AudioDestination
                                               -> AnalyserNode (shared FFT)
                  ↗                 ↗
        SinusoidalLFO        RampLFO
                  ↑                 ↑
            MasterPhaseRamp (generic ramp LFO instance)
```

## Implementation Phases

### Phase 1: Basic Infrastructure & LFO Foundation
**Objective**: Volume calibration works + LFO system operational

**Deliverables:**
- [x] **Volume calibration flow**
  - Instructions UI with "Join Instrument" button
  - Pink noise at 0.2 volume for hardware level setting
  - Smooth transition to instrument proper using cosine ramp
  - **Test**: User can start calibration, hear pink noise at 0.2, click "Join Instrument" ✅

- [x] **Generic LFO AudioWorklet** (one worklet, mode parameter)
  - Support for `{mode: "ramp", period: 2.0, width: 1.0, offset: 0.0}`
  - Support for `{mode: "sinusoidal", period: 2.0, width: 1.0, offset: 0.0}`
  - Sinusoidal mode uses inverted cosine (1 phase = sine envelope)
  - **Test**: Can instantiate both modes, verify output waveforms ✅

- [x] **Cosine ramp utility** (additional implementation)
  - Smooth parameter automation with exact zero capability
  - Message-based control for dynamic ramping
  - Overcomes Web Audio API limitations
  - **Test**: Smooth 2-second fade from calibration to instrument ✅

- [ ] **Master phase ramp** (deferred - using direct LFO control instead)
  - Controls global phase for all other LFOs
  - Receives period updates from controller
  - **Test**: Master phase outputs 0-1 sawtooth wave at specified period

- [ ] **Linear phase indicator in controller**
  - Horizontal progress bar showing current phase (0-1)
  - Updates smoothly during playback
  - **Test**: Phase bar shows current phase position, updates smoothly

- [ ] **Period control in controller**
  - Slider for global period (0.1s - 10.0s, default 2.0s)
  - Sends updates to all connected synths
  - **Test**: Period slider changes master phase frequency, synths receive updates

**Success Criteria**: Calibration→instrument transition works, phase indicator animates correctly

**✅ COMPLETED**: Volume calibration with smooth cosine ramp transition and additional AudioWorklet utilities

---

### Phase 2: Basic Synthesis Chain
**Objective**: Functioning white noise instrument with LFO modulation

**Deliverables:**
- [x] **White noise → LPF → gain → mute audio graph**
  - WhiteNoiseWorklet implementation
  - BiquadFilterNode (lowpass) for filtering with high Q resonance
  - GainNode for amplitude control
  - Final mute/unmute capability
  - **Test**: Can hear filtered white noise when unmuted during instrument phase ✅

- [x] **LFO→filter + LFO→gain connections**
  - Sinusoidal LFO modulates filter cutoff frequency (23.4Hz - 9.6kHz exponential sweep)
  - Ramp LFO modulates gain amplitude (0.001 - 1.0 exponential curve)
  - Proper audio rate parameter control
  - **Test**: Filter cutoff sweeps exponentially across full FFT range, gain ramps exponentially ✅

- [x] **Exponential converter utility** (additional implementation)
  - Converts linear LFO output to exponential parameter control
  - Musical frequency sweeps and natural amplitude curves
  - Configurable min/max range with automatic ratio calculation
  - **Test**: Filter sweeps span entire FFT visualizer, amplitude curves sound natural ✅

- [ ] **Phase reset messaging**
  - Controller sends phase-reset commands
  - Synths reset their master phase ramp
  - Message sent via reliable data channel (TCP-like)
  - **Test**: Controller can send phase reset, all synths synchronize phase

- [ ] **LFO synchronized to master phase**
  - All LFOs derive timing from master phase ramp
  - Phase relationships maintained across synths
  - **Test**: Multiple synths show synchronized filter/gain modulation

**Success Criteria**: Multiple synths play synchronized filtered white noise with visible/audible LFO modulation

**✅ COMPLETED**: White noise synthesis with exponential LFO modulation spanning full FFT range

---

### Phase 3: SIN Integration Foundation
**Objective**: Each synth has individual LFO frequencies based on harmonic ratios

**Deliverables:**
- [ ] **SIN parser function**
  - Parse comma-separated lists: `"1,3,5,7"` → `[1,3,5,7]`
  - Parse range notation: `"1-5"` → `[1,2,3,4,5]`
  - Parse single values: `"5"` → `[5]`
  - Handle duplicates: `"1,1,2,3"` → `[1,1,2,3]`
  - **Test**: All SIN notation formats parse correctly

- [ ] **Basic harmonic ratio generator**
  - Deterministic pseudo-random selection based on synth ID
  - `generateHarmonicRatio(synthId, paramName, numeratorSIN, denominatorSIN)`
  - Safety limiting (0.25x - 4x range)
  - **Test**: Same synth ID always gets same ratio, different synths get different ratios

- [ ] **Controller UI for LFO SIN configs**
  - Input fields for numerator/denominator SIN per LFO type
  - Default values: numerator="1", denominator="1" (no variation)
  - Real-time updates sent to synths
  - **Test**: Can set SIN configs, synths receive and apply new ratios

- [ ] **LFO frequency = masterFreq × ratio**
  - Each synth calculates: `lfoFreq = globalPeriodFreq * harmonicRatio`
  - Maintains phase synchronization despite frequency differences
  - **Test**: Synths have different LFO speeds but maintain phase relationship

**Success Criteria**: Multiple synths have harmonically-related but different LFO frequencies, creating ensemble texture

---

### Phase 4: Full Stochastic System
**Objective**: Complete parameter stochasticity like Cicada Assembly

**Deliverables:**
- [ ] **StochasticDistributor class**
  - Manages all stochastic parameter resolution
  - Caching system for consistency
  - Generation counter for regeneration
  - **Test**: Can resolve multiple parameters with different SIN configs

- [ ] **Additional stochastic parameters**
  - Filter Q factor variation
  - Noise amount per synth
  - Additional timing parameters
  - **Test**: Multiple parameters show per-synth variations

- [ ] **Regeneration system**
  - Controller can trigger new ratio generation
  - Smooth parameter transitions
  - Selective or global regeneration
  - **Test**: Can trigger new ratio generation, synths update smoothly

- [ ] **Safety limiting & parameter categories**
  - Frequency parameters: 0.25x - 4x range
  - Timing parameters: 0.1x - 5x range
  - Appropriate limits per parameter type
  - **Test**: No ratios exceed reasonable bounds

**Success Criteria**: Rich, varied ensemble texture with controllable stochastic evolution

---

## Technical Implementation Details

### LFO AudioWorklet Design

**Single worklet with mode parameter**:
```javascript
// Instantiation
new AudioWorkletNode(context, "generic-lfo", {
  processorOptions: { 
    mode: "ramp",        // or "sinusoidal"
    period: 2.0,         // seconds
    width: 1.0,          // output range width
    offset: 0.0,         // output offset
    paused: false        // pause state
  }
})

// Parameter updates
lfoNode.parameters.get('period').value = newPeriod;
```

### Message Types

**New message types to implement**:
```javascript
// Phase control
{ type: "phase-reset", timestamp: Date.now(), period: 2.5 }

// Parameter updates with SIN configs
{ 
  type: "param", 
  name: "lfo-sin-config", 
  value: { 
    sinusoidalNumerator: "1,3,5", 
    sinusoidalDenominator: "2,4",
    rampNumerator: "2,3",
    rampDenominator: "1,2"
  }
}

// Regeneration
{ type: "regenerate-stochastic", parameterName: "all" }
```

### Controller UI Additions

**New controls to add**:
- Period slider (0.1s - 10.0s)
- Linear phase indicator bar
- SIN configuration inputs (4 text fields)
- Regenerate button
- Calibration instructions + join button

### File Structure

**New files to create**:
- [x] `lfo_worklet.js` - Generic LFO AudioWorklet ✅
- [x] `cosine_ramp.js` - Smooth parameter automation utility ✅
- [x] `white_noise.js` - White noise generator AudioWorklet ✅
- [x] `exp_converter.js` - Linear to exponential range converter ✅
- [ ] `sin_parser.js` - SIN notation parsing utilities
- [ ] `stochastic_distributor.js` - Harmonic ratio generation system

## Testing Strategy

Each phase should be fully tested before proceeding to the next:

1. **Manual Testing**: Each deliverable has specific test scenarios
2. **Integration Testing**: Phase success criteria verify complete functionality
3. **Multi-Client Testing**: Test with 2-3 synth clients + 1 controller
4. **Edge Cases**: Test SIN parsing edge cases, network disconnections, etc.

## Completed Features

### AudioWorklet Utilities Library
The project now includes a comprehensive set of AudioWorklet utilities that overcome Web Audio API limitations:

- **`cosine_ramp.js`**: Smooth parameter automation with exact zero capability and message-based control
- **`lfo_worklet.js`**: Generic LFO with ramp and sinusoidal modes, pause/resume, and phase control  
- **`white_noise.js`**: Simple white noise generator for synthesis
- **`exp_converter.js`**: Linear to exponential range converter for musical parameter scaling
- **`pink_noise.js`**: Ridge-Rat Type 2 pink noise algorithm (existing)

### Controller Improvements
- **Cleaner URLs**: `/ctrl` route for controller access
- **Conflict resolution**: "Kick other controllers" functionality for multiple controller conflicts
- **FFT visualization**: Proper integration with synthesis chain

## Future Extensions

Beyond Phase 4, the system could be extended with:
- **Advanced SIN notations** (weighted selections, geometric progressions)
- **Multi-dimensional ratios** (spatial, amplitude, timbral)
- **Evolutionary algorithms** for automatic SIN configuration
- **Species-specific presets** based on cicada assembly research
- **Continuous detune system** using simplex noise (as in Cicada Assembly)
- **Global phase synchronization** system for multi-synth coordination

---

*This plan provides a clear roadmap from basic volume calibration to sophisticated stochastic ensemble synthesis, with testable milestones ensuring reliable progress.*