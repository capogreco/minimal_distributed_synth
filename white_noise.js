// White Noise AudioWorklet - Simple white noise generator

class WhiteNoiseProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
    }
    
    static get parameterDescriptors() {
        return [
            {
                name: "amplitude",
                defaultValue: 1.0,
                minValue: 0,
                maxValue: 2.0,
                automationRate: "a-rate",
            },
        ];
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const outputChannel = output[0]; // Assuming mono output
        
        if (!outputChannel) return true;
        
        const amplitudeValues = parameters.amplitude;
        let currentAmplitude;
        
        for (let i = 0; i < outputChannel.length; i++) {
            currentAmplitude = amplitudeValues.length > 1 ? amplitudeValues[i] : amplitudeValues[0];
            
            // Generate white noise: random value between -1 and 1
            const whiteNoise = Math.random() * 2.0 - 1.0;
            
            outputChannel[i] = whiteNoise * currentAmplitude;
        }
        
        return true; // Keep processor alive
    }
}

registerProcessor("white-noise-generator", WhiteNoiseProcessor);