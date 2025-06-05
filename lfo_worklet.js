// Generic LFO AudioWorklet - Supports ramp and sinusoidal modes
// Provides synchronized oscillation for parameter modulation

class LFOProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
        
        // Configuration from options
        const opts = options.processorOptions || {};
        this.mode = opts.mode || "ramp"; // "ramp" or "sinusoidal"
        this.period = opts.period !== undefined ? opts.period : 2.0; // seconds
        this.width = opts.width !== undefined ? opts.width : 1.0; // output range width
        this.offset = opts.offset !== undefined ? opts.offset : 0.0; // output offset
        this.paused = opts.paused !== undefined ? opts.paused : false;
        
        // Internal state
        this.phase = 0.0; // 0 to 1
        this.sampleRate = 48000; // Will be updated in process()
        this.pauseAtEndOfPhase = false; // Flag for pause-at-end behavior
        
        // Message handling for dynamic control
        this.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'setPeriod':
                    this.period = Math.max(0.001, data.period);
                    break;
                case 'pause':
                    this.paused = true;
                    break;
                case 'resume':
                    this.paused = false;
                    this.pauseAtEndOfPhase = false;
                    break;
                case 'pauseAtEndOfPhase':
                    this.pauseAtEndOfPhase = true;
                    break;
                case 'resetPhase':
                    this.phase = data.phase !== undefined ? data.phase : 0.0;
                    break;
                case 'setMode':
                    this.mode = data.mode;
                    break;
            }
        };
    }
    
    static get parameterDescriptors() {
        return [
            {
                name: 'period',
                defaultValue: 2.0,
                minValue: 0.001,
                maxValue: 60.0,
                automationRate: 'k-rate'
            },
            {
                name: 'width',
                defaultValue: 1.0,
                minValue: 0.0,
                maxValue: 10.0,
                automationRate: 'k-rate'
            },
            {
                name: 'offset',
                defaultValue: 0.0,
                minValue: -10.0,
                maxValue: 10.0,
                automationRate: 'k-rate'
            }
        ];
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outputChannel = output[0];
        
        if (!outputChannel) return true;
        
        // Update sample rate
        this.sampleRate = sampleRate;
        
        // Use instance values instead of parameters
        const period = Math.max(0.001, this.period);
        const width = this.width;
        const offset = this.offset;
        
        const samplesPerFrame = outputChannel.length;
        const phaseIncrement = 1.0 / (period * this.sampleRate);
        
        for (let i = 0; i < samplesPerFrame; i++) {
            let outputValue;
            
            if (this.mode === "sinusoidal") {
                // Sinusoidal LFO using inverted cosine (1 phase = sine envelope)
                // Formula: (1 - cos(phase * 2π)) / 2
                const cosineValue = Math.cos(this.phase * 2.0 * Math.PI);
                const normalizedValue = (1.0 - cosineValue) / 2.0; // 0 to 1
                outputValue = offset + (normalizedValue * width);
                
            } else if (this.mode === "ramp") {
                // Ramp LFO (sawtooth from 0 to 1)
                outputValue = offset + (this.phase * width);
                
            } else {
                // Default to ramp if mode is unknown
                outputValue = offset + (this.phase * width);
            }
            
            outputChannel[i] = outputValue;
            
            // Update phase if not paused
            if (!this.paused) {
                this.phase += phaseIncrement;
                
                // Handle phase wrap and pause-at-end behavior
                if (this.phase >= 1.0) {
                    if (this.pauseAtEndOfPhase) {
                        this.phase = 1.0; // Hold at end
                        this.paused = true;
                        this.pauseAtEndOfPhase = false;
                        
                        // Notify completion
                        this.port.postMessage({
                            type: 'phaseComplete',
                            phase: this.phase
                        });
                    } else {
                        // Loop back to start
                        this.phase = this.phase - 1.0; // Preserve fractional part for smooth looping
                    }
                }
            }
        }
        
        return true;
    }
}

registerProcessor('generic-lfo', LFOProcessor);