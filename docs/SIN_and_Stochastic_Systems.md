# SIN (Stochastic Integer Notation) and Harmonic Ratio Generators

## Overview

The Cicada Assembly project implements a sophisticated stochastic parameter system that enables controlled randomness in distributed audio synthesis. At the heart of this system are two key concepts:

1. **SIN (Stochastic Integer Notation)** - A compact notation for specifying sets of integers
2. **Harmonic Ratio Generators** - Deterministic pseudo-random systems that generate frequency and timing ratios using SIN

This approach allows multiple synthesis clients to maintain synchronized yet individualized parameter variations, creating rich ensemble textures while preserving musical coherence.

## SIN (Stochastic Integer Notation)

### Syntax

SIN provides two ways to specify integer sets:

#### Comma-Separated Lists
```
1,3,5,7    → [1, 3, 5, 7]
2,4,8      → [2, 4, 8]
1,1,2,3    → [1, 1, 2, 3]  (duplicates allowed)
```

#### Range Notation
```
1-5        → [1, 2, 3, 4, 5]
3-7        → [3, 4, 5, 6, 7]
10-12      → [10, 11, 12]
```

#### Single Values
```
5          → [5]
```

### Use Cases

SIN is particularly powerful for musical applications where you want to constrain randomness to musically meaningful values:

- **Harmonic Series**: `1,2,3,4,5,6,7,8` for natural harmonics
- **Odd Harmonics**: `1,3,5,7,9` for hollow, square-wave-like timbres  
- **Perfect Fifths**: `2,3` for 3:2 ratios
- **Chromatic Steps**: `1-12` for equal temperament divisions
- **Pentatonic**: `1,2,3,5,6` mapped to scale degrees

## Harmonic Ratio Generators

### Core Concept

Harmonic ratio generators create frequency and timing relationships by:

1. Taking two SIN specifications (numerator and denominator sets)
2. Randomly selecting one value from each set
3. Computing the ratio (numerator ÷ denominator)
4. Applying safety limits to prevent extreme values

### Implementation Architecture

```javascript
// Example: Generate ratio for client "synth-001" parameter "resonantFreq"
const numerators = parseSIN("1,3,5");     // [1, 3, 5]
const denominators = parseSIN("2,4");     // [2, 4]

// Deterministic selection based on client ID + parameter + generation
const ratio = generateHarmonicRatio("synth-001", "resonantFreq", "1,3,5", "2,4");
// Possible results: 1/2=0.5, 1/4=0.25, 3/2=1.5, 3/4=0.75, 5/2=2.5, 5/4=1.25

const finalFreq = baseFrequency * ratio;
```

### Deterministic Randomness

The system uses **deterministic pseudo-randomness** to ensure:

- **Consistency**: Same client always gets same ratio for same parameter
- **Variation**: Different clients get different ratios
- **Regeneration**: Ratios can be updated globally while maintaining determinism

```javascript
// Seed generation combines multiple factors
const seed = hash(clientId + parameterName + generationCounter);
const rng = createSeededRNG(seed);

// Selection is predictable but appears random
const selectedNumerator = numerators[Math.floor(rng() * numerators.length)];
const selectedDenominator = denominators[Math.floor(rng() * denominators.length)];
```

### Safety Limiting

Different parameter types have different safety constraints:

```javascript
// Frequency parameters: 0.25x to 4x range
if (paramName.includes('freq')) {
    ratio = Math.max(0.25, Math.min(4.0, ratio));
}

// Timing parameters: 0.1x to 5x range (more conservative)
if (paramName === 'groupSpacing') {
    ratio = Math.max(0.1, Math.min(5.0, ratio));
}
```

## Stochastic System Architecture

### Parameter Categories

The system handles four types of parameters:

1. **Stochastic Parameters**: Use harmonic ratio generators
   - `clickRate`, `resonantFreq`, `harmonicFreq`
   - `groupSpacing`, `echemeRate`, `echemeDuration`

2. **Detune Parameters**: Use simplex noise modulation for continuous drift
   - `echemeDurationDetune`, `echemeSpacingDetune`

3. **Continuous Parameters**: Direct control, no stochasticity or modulation
   - `amplitude`, `clickJitter`, `noiseAmount`

4. **Discrete Parameters**: Integer/boolean values
   - `pulseGroupSize`, `subGroupSize`, `powered_on`

### Distributed Resolution

Each synthesis client maintains its own `StochasticDistributor`:

```javascript
// Controller creates base parameters
const baseParams = {
    resonantFreq: 800,  // Hz
    clickRate: 200,     // BPM
    groupSpacing: 20    // ms
};

// Each synth client resolves individually
const synthA = new StochasticDistributor("synth-001");
const resolvedA = synthA.resolveAllParameters(baseParams, stochasticConfig);
// Result: resonantFreq: 1200, clickRate: 150, groupSpacing: 25

const synthB = new StochasticDistributor("synth-002"); 
const resolvedB = synthB.resolveAllParameters(baseParams, stochasticConfig);
// Result: resonantFreq: 600, clickRate: 300, groupSpacing: 15
```

### Caching and Regeneration

The system caches generated ratios to ensure consistency:

- **Cache Key**: `${clientId}_${parameterName}`
- **Regeneration**: Increment generation counter to force new ratios
- **Selective Updates**: Can regenerate specific parameters or all parameters

## Detune Parameters: Simplex Noise Modulation

### Decoupled Continuous Modulation

In addition to the discrete harmonic ratio system, Cicada Assembly implements a separate **detune system** that provides smooth, continuous modulation using simplex noise. This system is specifically designed for temporal parameters that benefit from subtle, natural drift.

### Implementation

The detune system operates independently from the SIN/harmonic ratio generators:

```javascript
// Simplex noise for slow, smooth modulation
this.noiseTime += 1.0 / sampleRate;
const noiseScale = 0.05; // Very slow modulation

// Two independent noise sources
const durationNoise = this.simplexNoise(this.noiseTime * noiseScale);
const spacingNoise = this.simplexNoise((this.noiseTime + 100) * noiseScale);

// Apply modulation: base ± (detune_amount * noise)
const modulatedDuration = baseDuration * (1.0 + detuneAmount * durationNoise);
const modulatedSpacing = baseSpacing * (1.0 + detuneAmount * spacingNoise);
```

### Key Characteristics

**Slow Meandering**: The noise scale factor of 0.05 creates very slow modulation that evolves over tens of seconds, mimicking natural biological variation.

**Bipolar Modulation**: Noise output ranges from -1 to +1, creating both positive and negative deviations from base values.

**Independent Channels**: Duration and spacing use separate noise sources (offset by 100 units) to prevent correlation.

**Percentage-Based**: Detune amounts are specified as percentages (0-2%), allowing proportional scaling regardless of base parameter values.

### Target Parameters

Currently applied to echeme timing parameters:

- **Echeme Duration Detune**: Varies the length of individual echeme pulses
- **Echeme Spacing Detune**: Varies the gaps between echeme pulses

### Musical Purpose

The detune system addresses a different need than the harmonic ratio generators:

- **Harmonic Ratios**: Create discrete, musically-related variations between clients
- **Detune System**: Add continuous, organic drift within each client

This combination creates:
1. **Harmonic coherence** through rational number relationships
2. **Temporal naturalism** through smooth biological-like variation
3. **Individual character** where each synthesis voice has both discrete offsets and continuous drift

### Technical Implementation

**Simplex Noise Algorithm**: Custom 1D implementation using hash-based interpolation:

```javascript
simplexNoise(x) {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3.0 - 2.0 * f); // Smooth interpolation
    
    const a = this.hash(i);
    const b = this.hash(i + 1);
    
    return a + t * (b - a); // Linear interpolation with smoothing
}
```

**Hash Function**: Deterministic pseudo-random values:

```javascript
hash(n) {
    n = Math.sin(n) * 43758.5453;
    return 2.0 * (n - Math.floor(n)) - 1.0; // Output range: [-1, 1]
}
```

### Extensibility

The detune system can be extended to other parameter types:

- **Frequency Detune**: Subtle pitch drift for more natural tonal variation
- **Amplitude Detune**: Breathing-like volume changes
- **Filter Detune**: Slow timbral evolution
- **Spatial Detune**: Position drift in multi-channel setups

## Hybrid Architecture: Combining Both Systems

### Complementary Stochastic Approaches

Cicada Assembly's parameter control architecture combines two distinct but complementary stochastic systems that operate at different timescales and serve different musical purposes:

**Harmonic Ratio Generators (Discrete/Medium-term)**:
- Operate at connection/regeneration events (seconds to minutes)
- Create discrete, rational number relationships
- Maintain harmonic coherence across ensemble
- Enable species-specific behavioral modeling

**Simplex Noise Detune (Continuous/Short-term)**:
- Operate at audio sample rate (microseconds to seconds)  
- Create smooth, organic drift patterns
- Add biological realism to timing
- Provide individual voice character

### Layered Parameter Resolution

The complete parameter resolution chain works as follows:

```javascript
// 1. Base parameter from controller UI
const baseEchemeDuration = 300; // ms

// 2. Apply harmonic ratio (if stochastic parameter)
const stochasticRatio = generateHarmonicRatio(clientId, "echemeDuration", "1,2,3", "2");
const harmonicDuration = baseEchemeDuration * stochasticRatio; // e.g., 450ms

// 3. Apply continuous detune modulation
const detuneAmount = 0.02; // 2% detune
const noiseValue = simplexNoise(timePosition); // [-1, 1]
const finalDuration = harmonicDuration * (1.0 + detuneAmount * noiseValue);
// Result: 441-459ms range with smooth variation
```

### System Boundaries

Each system has clear operational boundaries:

**SIN/Harmonic Ratios**:
- Apply to: Fundamental frequencies, base timing values, structural parameters
- Control: Discrete harmonic relationships between clients
- Timescale: Static until regeneration events
- Range: 0.25x to 4x (with safety limiting)

**Simplex Detune**:
- Apply to: Temporal fine-tuning, subtle variations
- Control: Continuous organic drift within clients  
- Timescale: Evolving continuously at audio rate
- Range: ±2% (percentage-based scaling)

### Benefits of Hybrid Approach

**Musical Coherence**: Harmonic ratios ensure ensemble voices maintain musical relationships while detune adds naturalistic variation.

**Scalable Complexity**: Systems can be enabled/disabled independently - harmonic ratios for basic ensemble coherence, detune for added realism.

**Computational Efficiency**: Harmonic ratios calculated once per client, simplex noise computed efficiently in real-time.

**Biological Authenticity**: Mimics how natural cicada choruses work - individuals have consistent frequency relationships but with slight timing variations.

### Future Integration Possibilities

**Cross-System Modulation**: Harmonic ratios could influence detune parameters:
```javascript
// Detune amount scaled by harmonic ratio
const adaptiveDetune = baseDetune * Math.sqrt(harmonicRatio);
```

**Temporal Coupling**: Simplex noise could influence regeneration timing:
```javascript
// Regenerate ratios based on noise peaks
if (Math.abs(simplexNoise(timePosition)) > 0.8) {
    regenerateHarmonicRatios();
}
```

**Multi-Dimensional Noise**: Extend simplex to control multiple parameters simultaneously while maintaining correlation structure.

## Musical Applications

### Species-Specific Behavior

Different cicada species can be simulated using distinct SIN configurations:

```javascript
// Magicicada septendecim (17-year cicada)
// Slow, low-frequency, harmonic-rich
const septendecim = {
    clickRate: { numSIN: "1,2", denSIN: "3,4" },      // Slower rhythms
    resonantFreq: { numSIN: "1,2,3", denSIN: "2,3" }, // Lower frequencies
    harmonicFreq: { numSIN: "2,3,5", denSIN: "1,2" }  // Rich harmonics
};

// Neotibicen canicularis (Dog-day cicada)  
// Fast, high-frequency, piercing
const canicularis = {
    clickRate: { numSIN: "3,4,5", denSIN: "2" },      // Faster rhythms
    resonantFreq: { numSIN: "4,5,6", denSIN: "2,3" }, // Higher frequencies
    harmonicFreq: { numSIN: "7,9,11", denSIN: "4" }   // Piercing harmonics
};
```

### Ensemble Texture Creation

Multiple synthesis clients with the same SIN configuration create:

- **Coherent Variations**: All clients follow same harmonic relationships
- **Individual Character**: Each client has unique frequency/timing offsets
- **Dense Textures**: Many slightly different voices create natural ensemble sound
- **Musical Structure**: Ratios maintain harmonic relationships rather than random chaos

### Dynamic Evolution

The regeneration system allows for temporal evolution:

```javascript
// Every 30 seconds, evolve the texture
setInterval(() => {
    stochasticDistributor.regenerateRatios();
    console.log("Cicada swarm evolved to new harmonic relationships");
}, 30000);
```

## Implementation Details

### StochasticDistributor Class

Key methods:
- `parseSIN(notation)`: Parse SIN string into integer array
- `generateHarmonicRatio(clientId, param, numSIN, denSIN)`: Create deterministic ratio
- `resolveParameter(param, baseValue, config)`: Apply stochastic transformation
- `regenerateRatios()`: Force new ratio generation

### Integration Points

1. **UI Controls**: Each stochastic parameter has N/D (numerator/denominator) SIN inputs
2. **Parameter Manager**: Unified system for handling all parameter types
3. **WebRTC Distribution**: Base parameters sent to all clients, resolved locally
4. **Audio Processing**: Final resolved parameters drive synthesis engines

## Design Philosophy

### Controlled Randomness

Rather than pure randomness, the system uses **constrained stochasticity**:

- Musical relationships are preserved through rational number ratios
- Extreme values are prevented through safety limiting
- Harmonic series and other musical structures can be directly encoded

### Distributed Coherence

The deterministic approach ensures:

- **Reproducibility**: Same setup always produces same results
- **Synchronization**: All clients share same base parameters
- **Individuality**: Each client has unique but predictable variations
- **Evolution**: System can evolve while maintaining coherence

### Scalability

The architecture scales to:

- Hundreds of synthesis clients (limited by WebRTC, not stochastic system)
- Real-time parameter updates without glitches
- Complex parameter relationships without computational overhead

## Future Extensions

### Advanced SIN Notations

Potential extensions to SIN syntax:

```
# Weighted selections
1*3,2*1,3*2    → [1,1,1,2,3,3] (weight by repetition)

# Geometric progressions  
2^1-4          → [2,4,8,16] (powers of 2)

# Prime number sets
prime(1-10)    → [2,3,5,7] (primes in range)
```

### Multi-Dimensional Ratios

Extending beyond frequency ratios:

- **Temporal Ratios**: Rhythm, groove, swing relationships
- **Amplitude Ratios**: Dynamic relationships between voices
- **Spatial Ratios**: Positioning in distributed speaker arrays
- **Timbral Ratios**: Spectral content relationships

### Evolutionary Algorithms

Using genetic algorithms with SIN notation:

- **Mutation**: Modify SIN specifications over time
- **Crossover**: Combine successful SIN configurations
- **Selection**: Favor ratios that create pleasing ensemble textures

---

The SIN and harmonic ratio system represents a sophisticated approach to controlled randomness in distributed audio synthesis, enabling rich, evolving textures while maintaining musical coherence and system predictability.