var dayCycle, decider, isLightOutside, lightSensor, lookOutside, powerSensor, sitThere;

isLightOutside = 1;
dayCycle = setInterval(function () {isLightOutside = (isLightOutside ? 0 : 1);}, 5000)

sitThere = new Action({
    name: 'sitThere',
    func: function (companion) {
        console.log(this.constructor, 'not doing anything' + (companion ? ' with ' + companion : ''));
    }
});

lookOutside = new Action({
    name: 'lookOutside',
    func: function () {
        console.log('It ' + (isLightOutside ? 'is' : 'isn’t') + ' light out');
        this.factors.isLightOutside = isLightOutside;
    }
});

photosynthesize = new Action({
    name: 'photosynthesize',
    func: function () {
        this.energy(-0.1);
        if (isLightOutside) {
            this.energy(0.5);
        }
        console.log(this.energy());
    }
});

decider = new Decider();

lightSensor = new Sensor({
    label: 'lightSensor',
    spectra: ['isLightOutside']
});

powerSensor = new Sensor({
    label: 'powerSensor',
    spectra: ['_energy'],
    world: decider
});

decider.addSensor(lightSensor);
decider.addSensor(powerSensor);

decider.addAction(sitThere);
decider.addAction(lookOutside);
decider.addAction(photosynthesize);

decider.energy = function (amount) {
    this._energy = this._energy || 1.0;
    if (amount) {
        this._energy = Math.min(1, Math.max(0, this._energy + amount));
    }
    return this._energy.valueOf();
}

decider.energy();
decider.sensorSweep = setInterval(function () {decider.readSensors();}, 16);
