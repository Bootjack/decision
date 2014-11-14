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
 * Factors are the inputs available at the time of a given 
 * instance of performing an action. Outcomes are the 
 * aggregate effect on the input state afte rthe action
 * was performed.
 */
function Action (config) {
    var fname, func, instances, iterator, outcomes;
    fname = config.name;
    func = config.func;
    instances = [];

    function action () {
        var instance = {};
        instance.before = _clone(this.factors);
        func.apply(this, arguments);
        instance.after = _clone(this.factors);
        instances.push(instance);
    };
    action.fname = fname;
    action.instances = instances;

    action.constructor = Action;
    _inherit(action, Action);
    
    return action;
}

/**
 * Calculate a set of aggregate values for each factor available in the history of this action
 * @param config {Object} Configuration specifying:
 *    - type: either 'factors' or 'outcomes' (can only report one)
 * @returns aggregate {Object} keyed to all factors with summary data for each
 * 
 * Every time an action is run, regardless who called it, the inputs and outcomes are logged. This
 * method iterates over that entire history and calculates the aggregate results. The object returned
 * contains a key for every factor included at least once in the log. Each key contains values for
 * count, sum, max, min, and mean.
 */
Action.prototype.aggregate = function (config) {
    var f, i, aggregate, difference, instances, instance;
    
    config = config || {};
    instances = config.instances || this.instances;
    aggregate = {};
    
    /**
     * For every instance the action was called, calculate aggregate results and modify the 
     * aggregate object values keyed by the name of the factor.
     */
    for (i in instances) {
        if (instances.hasOwnProperty(i)) {
            instance = instances[i];
            inputs = instance.before;
            outcomes = instance.after;
            for (f in inputs) {
                if (inputs.hasOwnProperty(f)) {
                    // Initialize as needed
                    aggregate[f] = aggregate[f] || {};
                    if ('undefined' === typeof aggregate[f].count) {
                        aggregate[f].count = 0;
                    }
                    if ('undefined' === typeof aggregate[f].sum) {
                        aggregate[f].sum = 0;
                    }
                    
                    /**
                     * Update aggregate values for all functions. This may feel unnecessarily redundant
                     * (e.g., recalculating the mean every time rather than once at the end of the loop),
                     * but this iteration occurs over every instance in no particular order and with no
                     * way of knowing which factors will be included on a given instance.
                     */
                    if ('outcomes' === config.type) {
                        difference = outcomes[f] - inputs[f];
                        if ('undefined' === typeof aggregate[f].max || difference > aggregate[f].max) {
                            aggregate[f].max = difference;
                        }
                        if ('undefined' === typeof aggregate[f].min || difference < aggregate[f].min) {
                            aggregate[f].min = difference;
                        }
                        aggregate[f].count += 1;
                        aggregate[f].sum += difference;
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
    }
    
    return aggregate;
};

/**
 * Generate a profile grouping together instances of this action by similar starting conditions.
 * 
 * @returns profiles {Array} List of distinct sets of inputs as a profile object
 * 
 * The return value is an array of profile objects where each profile contains:
 *   - profile: an identifier object with a key for each factor and value of -1, 0, or 1
 *   - instances: an array of indicies indicating which instances of the action match this profile
 */
Action.prototype.profile = function () {
    var f, i, p, aggregate, instance, instances, inputs, isNewProfile, outcomes, profile, profiles;
    
    aggregate = this.aggregate();
    instances = this.instances;
    profiles = [];
    
    /**
     * Categorize every instance of each factor as compared to the aggregate values for that factor,
     * grouping instances that compare similarly into profiles for more generic analysis.
     */
    for (i in instances) {
        if (instances.hasOwnProperty(i)) {
            instance = instances[i];
            inputs = instance.before;
            outcomes = instance.after;
            
            /**
             * Every factor gets its own set of up to three profiles (positive, negative, or neutral),
             * and each profile contains a list of all inputs matching that profile.
             */
            for (f in inputs) {
                profile = {};
                
                /**
                 * Determine whether the input was higher or lower than normal, where any value
                 * within +/- 10% of the mean is considered normal. Assign 1, -1, or 0 for values
                 * above normal, below normal, or at normal, respectively.
                 */
                if (inputs.hasOwnProperty(f)) {
                    if (inputs[f] > aggregate[f].mean + 0.1 * (aggregate[f].max - aggregate[f].mean)) {
                        profile[f] = 1;              
                    } else if (inputs[f] < aggregate[f].mean - 0.1 * (aggregate[f].mean - aggregate[f].min)) {
                        profile[f] = -1;
                    } else {
                        profile[f] = 0;
                    }
                }
                
                /**
                 * Check whether a profile already exists for this factor-comparison pair and insert
                 * a new profile as needed into the profiles array returned by this profile() method.
                 */
                isNewProfile = true;
                for (p = 0; p < profiles.length; p += 1) {
                    if (_compare(profiles[p].definition, profile)) {
                        profiles[p].instances.push(instance);
                        isNewProfile = false;
                        break;
                    }
                }
                if (isNewProfile) {
                    profiles.push({definition: profile, instances: [instance]});
                }
            }
        }
    }
    
    return profiles;
};

Action.prototype.summarize = function () {
    var i, profiles, outcome, result, that;
    
    that = this;
    profiles = this.profile();

    /**
     * Iterate over each profile and get an aggregate outcome for only the specific set
     * of instances specified by the profile.
     */    
    result = profiles.map(function (profile) {
        var outcome = that.aggregate({type: 'outcome', instances: profile.instances});
        return {profile: profile.definition, outcome: outcome};
    });
    
    return result;
}

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
    
    sensor.label = config.label;
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
        this.actions[action.fname] = action;
    }
};

Decider.prototype.addSensor = function (sensor) {
    this.sensors[sensor.label] = sensor;
};

Decider.prototype.readSensors = function () {
    var i, sensor, sensorLabel, spectra, spectrumName;
    for (sensorLabel in this.sensors) {
        if (this.sensors.hasOwnProperty(sensorLabel)) {
            spectra = this.sensors[sensorLabel]();
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
