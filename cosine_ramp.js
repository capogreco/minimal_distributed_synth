// Cosine Ramp AudioWorklet - Smooth parameter ramping utility
// Provides natural-sounding parameter transitions that can reach exactly zero

class CosineRampProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
        
        // Default configuration
        const opts = options.processorOptions || {};
        this.startValue = opts.startValue !== undefined ? opts.startValue : 0.0;
        this.endValue = opts.endValue !== undefined ? opts.endValue : 1.0;
        this.duration = opts.duration !== undefined ? opts.duration : 1.0; // seconds
        this.autoTrigger = opts.trigger !== undefined ? opts.trigger : false;
        
        // Internal state
        this.isRamping = this.autoTrigger;
        this.elapsedTime = 0.0;
        this.currentValue = this.startValue;
        this.sampleRate = 48000; // Will be updated in process()
        
        // Message handling for dynamic control
        this.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'trigger':
                    this.trigger(data);
                    break;
                case 'setTarget':
                    this.setTarget(data.endValue, data.duration);
                    break;
                case 'reset':
                    this.reset();
                    break;
            }
        };
    }
    
    static get parameterDescriptors() {
        return [
            {
                name: 'startValue',
                defaultValue: 0.0,
                minValue: -1000,
                maxValue: 1000,
                automationRate: 'k-rate'
            },
            {
                name: 'endValue', 
                defaultValue: 1.0,
                minValue: -1000,
                maxValue: 1000,
                automationRate: 'k-rate'
            },
            {
                name: 'duration',
                defaultValue: 1.0,
                minValue: 0.001,
                maxValue: 60.0,
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
        const startVal = this.startValue;
        const endVal = this.endValue;
        const duration = Math.max(0.001, this.duration);
        
        const samplesPerFrame = outputChannel.length;
        const timeStep = 1.0 / this.sampleRate;
        
        for (let i = 0; i < samplesPerFrame; i++) {
            if (this.isRamping) {
                // Calculate progress (0 to 1)
                const progress = Math.min(this.elapsedTime / duration, 1.0);
                
                // Cosine interpolation: smooth S-curve from 0 to 1
                // Formula: 1 - ((cos(progress * π) + 1) / 2)
                const cosineProgress = 1.0 - ((Math.cos(progress * Math.PI) + 1.0) / 2.0);
                
                // Calculate current value
                this.currentValue = startVal + (endVal - startVal) * cosineProgress;
                
                // Update elapsed time
                this.elapsedTime += timeStep;
                
                // Check if ramp is complete
                if (progress >= 1.0) {
                    this.isRamping = false;
                    this.currentValue = endVal; // Ensure exact end value
                    
                    // Notify completion
                    this.port.postMessage({
                        type: 'complete',
                        finalValue: this.currentValue
                    });
                }
            }
            
            // Output current value
            outputChannel[i] = this.currentValue;
        }
        
        return true;
    }
    
    // Trigger a new ramp with optional parameters
    trigger(config = {}) {
        this.startValue = config.startValue !== undefined ? config.startValue : this.currentValue;
        this.endValue = config.endValue !== undefined ? config.endValue : this.endValue;
        this.duration = config.duration !== undefined ? config.duration : this.duration;
        
        this.elapsedTime = 0.0;
        this.isRamping = true;
        this.currentValue = this.startValue;
        
        console.log(`Cosine ramp triggered: ${this.startValue} → ${this.endValue} over ${this.duration}s`);
    }
    
    // Set new target without changing start value
    setTarget(newEndValue, newDuration) {
        this.trigger({
            startValue: this.currentValue,
            endValue: newEndValue,
            duration: newDuration
        });
    }
    
    // Reset to start value
    reset() {
        this.isRamping = false;
        this.elapsedTime = 0.0;
        this.currentValue = this.startValue;
    }
}

registerProcessor('cosine-ramp', CosineRampProcessor);