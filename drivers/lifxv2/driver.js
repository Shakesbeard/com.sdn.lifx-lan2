'use strict';

const Homey = require('homey');

// LIFX Specifics
const _ = require('underscore');
const Cutter = require('utf8-binary-cutter');
const Lifx = require('lifx-lan-client').Client;

// For advanced effects
const lifx_packet = require('lifx-lan-client').packet;
const lifx_constants = require('lifx-lan-client').constants;
const lifx_utils = require('lifx-lan-client').utils;

class LIFX_LAN_Driver extends Homey.Driver {
	onInit() {
		this.log("LIFX Driver Startup..");
		global.devices_data = [];
		global.client = new Lifx();
		if (Homey.app.lights == null) {
			Homey.app.lights = [];
		}
		if (Homey.app.temp_lights == null) {
			Homey.app.temp_lights = [];
		}
		// If client fails, destroy it
		global.client.on('error', function () {
			client.destroy();
		});

		// Loop bulbs found by Lifx
		global.client.on('light-new', function (light) {
			if (Homey.app.logInfos) Homey.app.log('LIFX Client Event: light-new', light.id);

			// Get more data about the light
			light.getState(function (error, data) {

				// Add default label in case this getState call errored
				var label = Homey.__("defaultValues.noName");

				// If no data available skip this one
				if (!error && data != null) label = data.label;

				// Check if device was installed before
				var lists = (_.findWhere(global.devices_data, { id: light.id })) ? [Homey.app.lights, Homey.app.temp_lights] : [Homey.app.temp_lights];

				var pollIntervalSet = false;
				// Iterate over lists that needs to have device added
				lists.forEach(function (list) {

					// Add device including all data
					var temp_device = {
						data: {
							id: light.id,
							client: light,
							status: light.status
						},
						name: label,
						temp_min: 2500,
						temp_max: 9000
					};
					// Get more information about light
					temp_device.data.client.getState(function (error, data) {
						if (data != null) {
							// Store initial values
							temp_device.data.onoff = ( data.power === 1 ) ? true : false;
							temp_device.data.dim = data.color.brightness / 100;
							temp_device.data.light_temperature = Homey.app.mapKelvinScale(9000, 2500, 0, 1, data.color.kelvin);
							temp_device.data.light_saturation = data.color.saturation / 100;
							temp_device.data.light_hue = data.color.hue / 360;
						}
					});

					list.push(temp_device);
				});
			})
		});

		let trigger_device_gone = new Homey.FlowCardTrigger('device_gone');
		let trigger_device_back = new Homey.FlowCardTrigger('device_back');
		trigger_device_gone.register();
		trigger_device_back.register();
		let trigger_specific_device_gone = new Homey.FlowCardTriggerDevice('specific_device_gone');
		let trigger_specific_device_back = new Homey.FlowCardTriggerDevice('specific_device_back');
		trigger_specific_device_gone.register();
		trigger_specific_device_back.register();
		let action_device_set_max_ir = new Homey.FlowCardAction('set_irMax');
		action_device_set_max_ir.register().registerRunListener(async ( args, state ) => {
			args.my_device.light.data.client.maxIR(args.new_max_ir, function (err) {
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_max_ir->client.maxIR:', err);
			});
			args.my_device.setCapabilityValue("infrared_max_level", args.new_max_ir)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(args.my_device.light.name, ": Updated infrared_max_level value");
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, ': ' + err);
			})
			return Promise.resolve( true );
  	});

		this.trigger_specific_device_flux_changed = new Homey.FlowCardTriggerDevice('specific_device_flux_changed');
		this.trigger_specific_device_flux_changed.register();

		let action_device_set_mutlizone = new Homey.FlowCardAction('set_multizone');
		action_device_set_mutlizone.register().registerRunListener(async ( args, state ) => {
			//args.my_device.light.data.client.colorZones(startIndex, endIndex, hue, saturation, brightness, kelvin, duration, apply, callback)
			var duration = Homey.app.defaultTransitionDuration;
			if (args.duration != null) duration = args.duration;
			var zoneItems = args.zone_code.split(";");
			var indexRunner = args.start_index;
			for (var itemNow = 0; itemNow < zoneItems.length; itemNow++) {
				var zoneItem = zoneItems[itemNow].split(",");
				if (zoneItem.length != 1 && zoneItem.length != 4) {
					throw new Error(Homey.__('inAppErrors.zoneCodeError'));
				}
				try {
					if (zoneItem.length == 1) {
						// hex code mode
						let rgbObj = lifx_utils.rgbHexStringToObject(zoneItem[0]);
						let hsbObj = lifx_utils.rgbToHsb(rgbObj);
						args.my_device.light.data.client.colorZones(indexRunner, indexRunner, hsbObj.h, hsbObj.s, hsbObj.b, 3500, duration, itemNow == (zoneItems.length -1) && args.apply == "Yes", function (err) {
							if (err) {
								if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_mutlizone->client.colorZones:', err);
							}
							return Promise.resolve( true );
						});
					} else {
						// HSBK mode
						args.my_device.light.data.client.colorZones(indexRunner, indexRunner, parseInt(zoneItem[0]), parseInt(zoneItem[1]), parseInt(zoneItem[2]), parseInt(zoneItem[3]), duration, itemNow == (zoneItems.length -1) && args.apply == "Yes", function (err) {
							if (err) {
								if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_mutlizone->client.colorZones:', err);
							}
							return Promise.resolve( true );
						});
					}
				}
				catch (err){
					if (err){
						if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_mutlizone->client.colorZones:', err);
					}
					throw new Error(Homey.__('inAppErrors.zoneCodeError'));
				}
				indexRunner++;
			}
			return Promise.resolve( true );
  	});

		// Multizone basic
		let action_device_set_multizone_basic_6 = new Homey.FlowCardAction('set_multizone_basic_6');
		action_device_set_multizone_basic_6.register().registerRunListener(async ( args, state ) => {
			let duration = Homey.app.defaultTransitionDuration;
			if (args.duration != null) duration = args.duration;
			let colors = [
				args.color1,
				args.color2,
				args.color3,
				args.color4,
				args.color5,
				args.color6
			];
			let states = [];
			try {
				for( let zoneIndex = 0; zoneIndex < args.my_device.light.data.zonesData.count; zoneIndex++ ) {
					let colorIndex = Math.floor(colors.length / args.my_device.light.data.zonesData.count * zoneIndex)
					let rgbObj = lifx_utils.rgbHexStringToObject(colors[colorIndex]);
					let hsbObj = lifx_utils.rgbToHsb(rgbObj);
					args.my_device.light.data.client.colorZones(zoneIndex, zoneIndex, hsbObj.h, hsbObj.s, hsbObj.b, 3500, duration, zoneIndex == (args.my_device.light.data.zonesData.count -1), function (err) {
						if (err) {
							if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_multizone_basic_6->client.colorZones:', err);
							throw new Error(err);
						}
						return Promise.resolve( true );
					});
				}
			}
			catch (err){
				if (err){
					if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'set_multizone_basic_6->client.colorZones:', err);
					throw new Error(Homey.__(err));
				}
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		// RGB HEX Color Set Card
		let action_device_set_color_by_hex = new Homey.FlowCardAction('set_color_by_hex');
		action_device_set_color_by_hex.register().registerRunListener(async ( args, state ) => {
			var duration = Homey.app.defaultTransitionDuration;
			if (args.duration != null) duration = args.duration;
			try {
				args.my_device.light.data.client.colorRgbHex(args.hex_code, duration, function (err) {
					if (err) {
						if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_color_by_hex->client.colorRgbHex:', err);
						throw new Error(Homey.__('inAppErrors.hexColorError'), err);
					}
					return Promise.resolve( true );
				});
			}
			catch (err){
				if (err){
					if (Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_set_color_by_hex->client.colorRgbHex:', err);
					throw new Error(Homey.__('inAppErrors.hexColorError'), err);
				}
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		// Waveform effects see: https://lan.developer.lifx.com/docs/waveforms
		let action_device_play_effect_glow = new Homey.FlowCardAction('play_effect_glow');
		action_device_play_effect_glow.register().registerRunListener(async ( args, state ) => {
			var rgbObj = lifx_utils.rgbHexStringToObject(args.effect_color);
			var hsbObj = lifx_utils.rgbToHsb(rgbObj);
			var hue = Math.round(hsbObj.h / lifx_constants.HSBK_MAXIMUM_HUE * 65535);
		  var saturation = Math.round(hsbObj.s / lifx_constants.HSBK_MAXIMUM_SATURATION * 65535);
		  var brightness = Math.round(hsbObj.b / lifx_constants.HSBK_MAXIMUM_BRIGHTNESS * 65535);
			const packetObj = lifx_packet.create('setWaveform', {
			  isTransient: true,
			  color: {hue: hue, saturation: saturation, brightness: brightness, kelvin: 3500},
			  period: args.effect_length,
			  cycles: args.repeats,
			  skewRatio: 0.5,
			  waveform: lifx_constants.LIGHT_WAVEFORMS.indexOf(args.effect_mode) // SAW, SINE, HALF_SINE, TRIANGLE, PULSE
			}, global.client.source);
			packetObj.target = args.my_device.light.data.id;
			try {
				global.client.send(packetObj, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_glow->client.send:', err);
					return Promise.resolve( false );
				});
			}
			catch (err){
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_glow->client.send:', err);
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		let action_device_play_effect_saw = new Homey.FlowCardAction('play_effect_saw');
		action_device_play_effect_saw.register().registerRunListener(async ( args, state ) => {
			var rgbObj = lifx_utils.rgbHexStringToObject(args.effect_color);
			var hsbObj = lifx_utils.rgbToHsb(rgbObj);
			var hue = Math.round(hsbObj.h / lifx_constants.HSBK_MAXIMUM_HUE * 65535);
		  var saturation = Math.round(hsbObj.s / lifx_constants.HSBK_MAXIMUM_SATURATION * 65535);
		  var brightness = Math.round(hsbObj.b / lifx_constants.HSBK_MAXIMUM_BRIGHTNESS * 65535);
			var isTrans = true;
			if (args.effect_trans == "No") isTrans = false;
			const packetObj = lifx_packet.create('setWaveform', {
			  isTransient: isTrans,
			  color: {hue: hue, saturation: saturation, brightness: brightness, kelvin: 3500},
			  period: args.effect_length,
			  cycles: args.repeats,
			  skewRatio: 0.5,
			  waveform: lifx_constants.LIGHT_WAVEFORMS.indexOf(args.effect_mode) // SAW, SINE, HALF_SINE, TRIANGLE, PULSE
			}, global.client.source);
			packetObj.target = args.my_device.light.data.id;
			try {
				global.client.send(packetObj, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_saw->client.send:', err);
					return Promise.resolve( false );
				});
			}
			catch (err){
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_saw->client.send:', err);
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		let action_device_play_effect_pulse = new Homey.FlowCardAction('play_effect_pulse');
		action_device_play_effect_pulse.register().registerRunListener(async ( args, state ) => {
			var rgbObj = lifx_utils.rgbHexStringToObject(args.effect_color);
			var hsbObj = lifx_utils.rgbToHsb(rgbObj);
			var hue = Math.round(hsbObj.h / lifx_constants.HSBK_MAXIMUM_HUE * 65535);
		  var saturation = Math.round(hsbObj.s / lifx_constants.HSBK_MAXIMUM_SATURATION * 65535);
		  var brightness = Math.round(hsbObj.b / lifx_constants.HSBK_MAXIMUM_BRIGHTNESS * 65535);
			var isTrans = true;
			if (args.effect_trans == "No") isTrans = false;
			const packetObj = lifx_packet.create('setWaveform', {
			  isTransient: isTrans,
			  color: {hue: hue, saturation: saturation, brightness: brightness, kelvin: 3500},
			  period: args.effect_length,
			  cycles: args.repeats,
			  skewRatio: args.effect_skew,
			  waveform: lifx_constants.LIGHT_WAVEFORMS.indexOf('PULSE') // SAW, SINE, HALF_SINE, TRIANGLE, PULSE
			}, global.client.source);
			packetObj.target = args.my_device.light.data.id;
			try {
				global.client.send(packetObj, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_pulse->client.send:', err);
					return Promise.resolve( false );
				});
			}
			catch (err){
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_effect_pulse->client.send:', err);
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		let action_device_play_multizone_effect_move = new Homey.FlowCardAction('play_multizone_effect_move');
		action_device_play_multizone_effect_move.register().registerRunListener(async ( args, state ) => {
			const packetObj = lifx_packet.create('setMultiZoneEffect', {
			  effect_type: lifx_constants.MULTIZONE_EFFECTS.indexOf('MOVE'),
			  speed: args.speed,
			  parameter2: lifx_constants.MULTIZONE_EFFECTS_MOVE_DIRECTION.indexOf(args.direction)
			}, global.client.source);
			packetObj.target = args.my_device.light.data.id;
			try {
				global.client.send(packetObj, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_multizone_effect_move->client.send:', err);
					return Promise.resolve( false );
				});
			}
			catch (err){
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_play_multizone_effect_move->client.send:', err);
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		let action_device_stop_any_multizone_effect = new Homey.FlowCardAction('stop_any_multizone_effect');
		action_device_stop_any_multizone_effect.register().registerRunListener(async ( args, state ) => {
			const packetObj = lifx_packet.create('setMultiZoneEffect', {
			  effect_type: lifx_constants.MULTIZONE_EFFECTS.indexOf('OFF'),
			  speed: 0,
			}, global.client.source);
			packetObj.target = args.my_device.light.data.id;
			try {
				global.client.send(packetObj, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_stop_any_multizone_effect->client.send:', err);
					return Promise.resolve( false );
				});
			}
			catch (err){
				if (err && Homey.app.logErrors) Homey.app.error(args.my_device.light.name, 'action_device_stop_any_multizone_effect->client.send:', err);
				return Promise.resolve( false );
			}
			return Promise.resolve( true );
  	});

		// Light goes offline
		global.client.on('light-offline', function (light) {
			if (Homey.app.logInfos) Homey.app.log('LIFX Client Event: client light-offline', light.id);

			// Get light
			var foundLight = Homey.app.getLight(light.id, Homey.app.temp_lights);

			// If it exists
			if (foundLight != null && foundLight.data != null && foundLight.device != null) {
				foundLight.data.status = "off";
				if (Homey.app.logInfos) Homey.app.log("Device '", foundLight.name, "' went gone..");
				foundLight.device.setUnavailable(Homey.__("inAppErrors.deviceOffline"));

				let trigger_device_tokens = {
					'device_label': foundLight.name
				};
				trigger_device_gone.trigger(trigger_device_tokens)
				.then(() => {
					if (Homey.app.logInfos) Homey.app.log("Fired trigger device_gone for ", foundLight.name);
				})
				.catch( err => {
					if (Homey.app.logErrors) Homey.app.log(err);
				})

				let trigger_specific_device_tokens = {
					'device_label': foundLight.name
				};
				let trigger_specific_device_state = {
				};
				trigger_specific_device_gone.trigger(foundLight.device, trigger_specific_device_tokens, trigger_specific_device_state)
				.then(() => {
					if (Homey.app.logInfos) Homey.app.log("Fired trigger specific_device_gone for ", foundLight.name);
					return Promise.resolve();
				})
				.catch( err => {
					if (Homey.app.logErrors) Homey.app.log(err);
					return Promise.resolve();
				})
			}
		});

		// Light gets back online
		global.client.on('light-online', function (light) {
			if (Homey.app.logInfos) Homey.app.log('LIFX Client Event: light-online', light.id);

			// Get light
			var foundLight = Homey.app.getLight(light.id, Homey.app.temp_lights);

			// If it exists
			if (foundLight != null && foundLight.data != null && foundLight.device != null) {
				foundLight.data.status = "on";
				if (Homey.app.logInfos) Homey.app.log("Device '", foundLight.name, "' came back!");
				foundLight.device.setAvailable();

				let trigger_device_tokens = {
					'device_label': foundLight.name
				};
				trigger_device_back.trigger(trigger_device_tokens)
				.then(() => {
					if (Homey.app.logInfos) Homey.app.log("Fired trigger device_back for ", foundLight.name);
				})
				.catch( err => {
					if (Homey.app.logErrors) Homey.app.log(err);
				})

				let trigger_specific_device_tokens = {
					'device_label': foundLight.name
				};
				let trigger_specific_device_state = {
				};
				trigger_specific_device_back.trigger(foundLight.device, trigger_specific_device_tokens, trigger_specific_device_state)
				.then(() => {
					if (Homey.app.logInfos) Homey.app.log("Fired trigger specific_device_back for ", foundLight.name);
					return Promise.resolve();
				})
				.catch( err => {
					if (Homey.app.logErrors) Homey.app.log(err);
					return Promise.resolve();
				})
			}
		});

		// Initialize new Lifx client
		global.client.init({
			lightOfflineTolerance: 10,
			messageHandlerTimeout: 5000,
			startDiscovery: true,
			resendPacketDelay: 100,
			resendMaxTimes: 10,
			debug: false
		});

	} //onInit

	async triggerFluxChanged (current_device, trigger_specific_device_tokens, trigger_specific_device_state) {
		await this.trigger_specific_device_flux_changed.trigger(current_device, trigger_specific_device_tokens, trigger_specific_device_state)
		.then(() => {
			if (Homey.app.logInfos) Homey.app.log("Fired trigger trigger_specific_device_flux_changed for ", current_device.light.name);
			return Promise.resolve();
		})
		.catch( err => {
			if (Homey.app.logErrors) Homey.app.log(err);
			return Promise.resolve();
		})
		return Promise.resolve();
	}

	// this is the easiest method to overwrite, when only the template 'Drivers-Pairing-System-Views' is being used.
  async onPairListDevices( data, callback ) {
    callback( null, devices_data );
  } //onPairListDevices

	onPair(socket) {
		/**
		 * Constructs array of all available devices
		 * @param callback
		 */
		socket.on("list_devices", function (data, callback) {
			var devices = [];
			Homey.app.temp_lights.forEach(function (temp_light) {
				if (temp_light.data.status == "on") {
					devices.push({
						data: {
							id: temp_light.data.id
						},
						name: temp_light.name
					});
				}
			});

			callback(null, devices);
		});

		/**
		 * Register device internally as installed
		 * @param callback
		 * @param emit
		 * @param device
		 */
		socket.on("add_device", function (device) {
			Homey.app.temp_lights.forEach(function (temp_light) {
				if (temp_light.data.id === device.data.id) {
					var light = {
						data: {
							id: temp_light.data.id,
							client: temp_light.data.client,
							status: temp_light.data.status
						},
						name: temp_light.name,
						temp_min: 1500,
						temp_max: 9000
					};

					// Get more information about light
					light.data.client.getState(function (error, data) {
						if (data != null) {
							// Store initial values
							light.data.onoff = ( data.power === 1 ) ? true : false;
							light.data.light_temperature = Homey.app.mapKelvinScale(9000, 1500, 0, 1, data.color.kelvin);
							light.data.dim = data.color.brightness / 100;
							light.data.light_saturation = data.color.saturation / 100;
							light.data.light_hue = data.color.hue / 360;
						}
					});

					Homey.app.lights.push(light);
				}
			});
		});
	} //onPair
}

module.exports = LIFX_LAN_Driver;
