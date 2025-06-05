// Exponential Range Converter AudioWorklet
// Converts linear input to exponential output over specified range
// Perfect for frequency sweeps, musical intervals, and perceptually linear control

class ExponentialConverterProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);
        
        // Configuration from options
        const opts = options.processorOptions || {};
        this.minValue = opts.minValue !== undefined ? opts.minValue : 20.0;   // Hz (low frequency)
        this.maxValue = opts.maxValue !== undefined ? opts.maxValue : 20000.0; // Hz (high frequency)
        this.inputMin = opts.inputMin !== undefined ? opts.inputMin : 0.0;     // expected input range min
        this.inputMax = opts.inputMax !== undefined ? opts.inputMax : 1.0;     // expected input range max
        
        // Pre-calculate exponential ratio for efficiency
        this.updateRatio();
        

        
        // Message handling for dynamic control
        this.port.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch (type) {
                case 'setRange':
                    this.minValue = data.minValue !== undefined ? data.minValue : this.minValue;
                    this.maxValue = data.maxValue !== undefined ? data.maxValue : this.maxValue;
                    this.updateRatio();
                    break;
                case 'setInputRange':
                    this.inputMin = data.inputMin !== undefined ? data.inputMin : this.inputMin;
                    this.inputMax = data.inputMax !== undefined ? data.inputMax : this.inputMax;
                    break;
            }
        };
    }
    
    updateRatio() {
        // Calculate the exponential ratio: maxValue = minValue * ratio^1
        this.ratio = this.maxValue / this.minValue;
        
        // Handle edge cases
        if (this.minValue <= 0) {
            console.warn('ExponentialConverter: minValue must be > 0, using 0.001');
            this.minValue = 0.001;
            this.ratio = this.maxValue / this.minValue;
        }
        
        if (this.ratio <= 0) {
            console.warn('ExponentialConverter: invalid ratio, using 1000');
            this.ratio = 1000;
        }
    }
    
    static get parameterDescriptors() {
        return [
            {
                name: 'minValue',
                defaultValue: 20.0,
                minValue: 0.001,
                maxValue: 100000.0,
                automationRate: 'k-rate'
            },
            {
                name: 'maxValue',
                defaultValue: 20000.0,
                minValue: 0.001,
                maxValue: 100000.0,
                automationRate: 'k-rate'
            }
        ];
    }
    
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !input[0] || !output || !output[0]) {
            return true;
        }
        
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        // Use instance values instead of parameters
        // (Parameters would use defaults, not our configured values)
        
        const inputRange = this.inputMax - this.inputMin;
        
        for (let i = 0; i < outputChannel.length; i++) {
            // Get input value
            let inputValue = inputChannel[i];
            
            // Normalize input to 0-1 range
            let normalizedInput = (inputValue - this.inputMin) / inputRange;
            
            // Clamp to 0-1 to avoid invalid exponentials
            normalizedInput = Math.max(0.0, Math.min(1.0, normalizedInput));
            
            // Apply exponential conversion
            // Formula: minValue * (ratio ^ normalizedInput)
            // When normalizedInput = 0: output = minValue * (ratio ^ 0) = minValue * 1 = minValue
            // When normalizedInput = 1: output = minValue * (ratio ^ 1) = minValue * ratio = maxValue
            const exponentialOutput = this.minValue * Math.pow(this.ratio, normalizedInput);
            

            
            outputChannel[i] = exponentialOutput;
        }
        
        return true;
    }
}

registerProcessor('exponential-converter', ExponentialConverterProcessor);