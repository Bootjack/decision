function _clone (obj, isDeepClone) {
    var clone = {};
    for (prop in obj) {
        if (isDeepClone || obj.hasOwnProperty(prop)) {
            clone[prop] = obj[prop];
        }
    }
    return clone;
}

function _compare (a, b, isDeepCompare) {
    var result = true;
    for (prop in a) {
        if (isDeepCompare || a.hasOwnProperty(prop)) {
            if (b[prop] !== a[prop]) {
                result = false;
                break;
            }
        }
    }
    return result;
}

function _inherit (obj, model) {
    var prop;
    for (prop in model.prototype) {
        if (!obj.hasOwnProperty(prop)) {
            obj[prop] = model.prototype[prop];
        }
    }
}

/**
 * An action has a function with a name and a history of
 * past uses under different circumstances, producing
 * different outcomes.
 * 
 * Factors are both the names of the properties with an
 * aggregate effect on the outcome and the specific state
 * of those factors at the time of a given instance
 **/

function Action (config) {
    var factors, fname, func, iterator, outcomes;
    fname = config.name;
    func = config.func;
    factors = {length: 0};
    outcomes = {length: 0};
    iterator = 1;
    
    function action () {
        factors[iterator] = _clone(this.factors);
        factors.length += 1;
        func.call(this);
        outcomes[iterator] = _clone(this.factors);
        outcomes.length += 1;
        return iterator++;
    };
    action.fname = fname;
    action.factors = factors;
    action.outcomes = outcomes;
    
    action.constructor = Action;
    _inherit(action, Action);
    
    return action;
}

Action.prototype.aggregate = function (config) {
    var f, i, aggregate, difference, factors, instance;
    
    config = config || {};
    factors = (config.type && this[config.type]) || this.factors;
    aggregate = {};
    
    for (i = 0; i < factors.length; i += 1) {
        inputs = this.factors[i];
        oucomes = this.outcomes[i];
        for (f in inputs) {
            if (inputs.hasOwnProperty(f)) {
                aggregate[f] = aggregate[f] || {};
                if ('undefined' === typeof aggregate[f].count) {
                    aggregate[f].count = 0;
                }
                if ('undefined' === typeof aggregate[f].sum) {
                    aggregate[f].sum = 0;
                }
                if ('outcomes' === config.type) {
                    difference = outcomes[f] - inputs[f];
                    if ('undefined' === typeof aggregate[f].max || difference > aggregate[f].max) {
                        aggregate[f].max = difference;                        
                    }
                    if ('undefined' === typeof aggregate[f].min || difference < aggregate[f].min) {
                        aggregate[f].min = difference;
                    }
                    aggregate[f].count += 1;
                    aggregate[f].sum += outcomes[f] - inputs[f];
                    aggregate[f].mean = aggregate[f].sum / aggregate[f].count;
                } else {
                    if ('undefined' === typeof aggregate[f].max || inputs[f] > aggregate[f].max) {
                        aggregate[f].max = inputs[f];                        
                    }
                    if ('undefined' === typeof aggregate[f].min || inputs[f] < aggregate[f].min) {
                        aggregate[f].min = inputs[f];
                    }
                    aggregate[f].count += 1;
                    aggregate[f].sum += inputs[f];
                    aggregate[f].mean = aggregate[f].sum / aggregate[f].count;
                }
            }
        }
    }
    
    return aggregate;
};

Action.prototype.profile = function () {
    var f, i, p, aggregate, inputs, isNewProfile, outcomes, profile, profiles;
    
    aggregate = this.aggregate();
    profiles = [];
    
    for (i = 0; i < this.factors.length; i += 1) {
        inputs = this.factors[i];
        outcomes = this.outcomes[i];
        for (f in inputs) {
            profile = {};
            if (inputs.hasOwnProperty(f)) {
                if (inputs[f] > aggregate[f].mean + 0.1 * (aggregate[f].max - aggregate[f].mean)) {
                    profile[f] = 1;              
                } else if (inputs[f] < aggregate[f].mean - 0.1 * (aggregate[f].mean - aggregate[f].min)) {
                    profile[f] = -1;
                } else {
                    profile[f] = 0;
                }
            }
            isNewProfile = true;
            for (p = 0; p < profiles.length; p += 1) {
                if (_compare(profiles[p].profile, profile)) {
                    profiles[p].instances.push(i);
                    isNewProfile = false;
                    break;
                }
            }
            if (isNewProfile) {
                profiles.push({profile: profile, instances: [i]});
            }
        }
    }
  
    for (i = 0; i < profiles.length; i += 1) {
        
    }
    
    return profiles;
};

/**
 * A sensor interprets world attributes and updates itself
 * in real time within limits of tolerance and granularity.
 * 
 * NOTE on tolerance and granularity: Granularity represents
 * the range represented by the reported value. In practice,
 * it's a matter of rounding. A granularity of 5 will return 
 * the sensed value rounded to the nearest multiple of 5.
 * The natural counterpart to this is tolerance, which is 
 * how consistent the sensor is. In practice, this is the 
 * magnitude of random offset applied to the reported value.
 
 * NOTE Tolerance is assumed to be +/- the given value, so a
 * tolerance of 5 indicates a ten-point range from -5 to +5.
 *
 * EXAMPLES
 * Sensor T has a granularity of 3, but a tolerance of 0.01.
 * Sensor G has a granularity of 0.01, but a tolerance of 3. 
 * Sensor M has a granularity of 1 and an tolerance of 1.
 * Assume an objective world value of 8.531.
 * Sensor T would always report 9
 * Sensor G might report 6.23, 10.98, or 8.21
 * Sensor M might report 8, 9, or 10
 **/

function Sensor (config) {
    var accuracy, precision, spectra, world;
    
    world = config.world || window;
    spectra = config.spectra || [];
    tolerance = config.tolerance || 0;
    granularity = config.granularity || 0;

    if (!spectra.hasOwnProperty('length')) {
        spectra = [spectra];
    }
    
    function applyTolerance (val) {
        return val + tolerance * (2 * Math.random() - 1);
    }

    function applyGranularity (val) {
        var adjusted, remainder;
        if (0 === granularity) {
            adjusted = val;
        } else {
            adjusted = Math.round(val / granularity) * granularity;
        }
        return adjusted;
    }
    
    function sensor () {
        var i, spectrum, values;
        values = {};
        for (i = 0; i < spectra.length; i += 1) {
            spectrum = spectra[i];
            values[spectrum] = applyGranularity(applyTolerance(world[spectrum]));
        }
        return values;
    };
    
    sensor.tolerance = tolerance;
    sensor.granularity = granularity;
    
    sensor.constructor = Sensor;
    
    return sensor;
}


/**
 * A decider has a list of potential actions that it can
 * score based on current factors and a desired outcome.
 **/

function Decider (config) {
    this.actions = {};
    this.factors = {};
    this.sensors = {};
}

Decider.prototype.addAction = function (action) {
    if (!this.hasOwnProperty(action.fname)) {
        this[action.fname] = action.bind(this);
        this.actions[action.fname] = this[action.fname];
    }
};

Decider.prototype.addSensor = function (sensor) {
    this.sensors[sensor.name] = sensor;
};

Decider.prototype.readSensors = function () {
    var i, sensor, sensorName, spectra, spectrumName;
    for (sensorName in this.sensors) {
        if (this.sensors.hasOwnProperty(sensorName)) {
            spectra = this.sensors[sensorName]();
            for (spectrumName in spectra) {
                if (spectra.hasOwnProperty(spectrumName)) {
                    this.factors[spectrumName] = spectra[spectrumName];
                }
            }
        }
    }
}

Decider.prototype.consider = function (bias) {
    this.readSensors();
};
