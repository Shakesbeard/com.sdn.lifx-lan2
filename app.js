'use strict';

const Homey = require('homey');
// Cloud Support
const LIFX_CloudApi = require('./lib/cloudSupportClient');

class SDN_LIFX_LAN2 extends Homey.App {

	async onInit() {
		this.log('LIFX LANv2 is starting up...');

		global.cloudApiClient = new LIFX_CloudApi();

		new Homey.FlowCardAction('activate_scene')
			.register()
			.registerRunListener(async args => {
				let ignoreList = [];
				if (args.turn_on == "No") {
					ignoreList.push("power");
				}
				if (args.ignore_infrared == "Yes") {
					ignoreList.push("infrared");
				}
				let api = global.cloudApiClient; // developer token variant
				if( typeof args.duration === 'number' )
					args.duration /= 1000;
				return api.setScene({
					sceneUuid: args.scene.uuid,
					ignoreList: ignoreList,
					duration: args.duration
				});
			})
			.getArgument('scene')
			.registerAutocompleteListener( async query => {
				let api = global.cloudApiClient; // developer token variant
				return api.getScenes().then( scenes => {
					return scenes.map(scene => {
						return {
							name: scene.name,
							uuid: scene.uuid
						}
					})
				});
			});

			new Homey.FlowCardAction('deactivate_scene')
				.register()
				.registerRunListener(async args => {
					let ignoreList = [
						"infrared",
						"hue",
						"intensity",
						"saturation",
						"kelvin"
					];
					let api = global.cloudApiClient; // developer token variant
					if( typeof args.duration === 'number' )
						args.duration /= 1000;
					let stateOverride = {
						power: "off",
						duration: args.duration,
						fast: true
					};
					return api.setSceneOverride({
						sceneUuid: args.scene.uuid,
						ignoreList: ignoreList,
						state: stateOverride,
						duration: args.duration
					});
				})
				.getArgument('scene')
				.registerAutocompleteListener( async query => {
					let api = global.cloudApiClient; // developer token variant
					return api.getScenes().then( scenes => {
						return scenes.map(scene => {
							return {
								name: scene.name,
								uuid: scene.uuid
							}
						})
					});
				});

				new Homey.FlowCardAction('activate_lights_in_scene')
					.register()
					.registerRunListener(async args => {
						let ignoreList = [
							"infrared",
							"hue",
							"intensity",
							"saturation",
							"kelvin"
						];
						let api = global.cloudApiClient; // developer token variant
						if( typeof args.duration === 'number' )
							args.duration /= 1000;
						let stateOverride = {
							power: "on",
							duration: args.duration,
							fast: true
						};
						return api.setSceneOverride({
							sceneUuid: args.scene.uuid,
							ignoreList: ignoreList,
							state: stateOverride,
							duration: args.duration
						});
					})
					.getArgument('scene')
					.registerAutocompleteListener( async query => {
						let api = global.cloudApiClient; // developer token variant
						return api.getScenes().then( scenes => {
							return scenes.map(scene => {
								return {
									name: scene.name,
									uuid: scene.uuid
								}
							})
						});
					});

				new Homey.FlowCardAction('set_lights_color_in_scene')
					.register()
					.registerRunListener(async args => {
						let ignoreList = [
							"infrared"
						];
						if (args.turn_on == "No") {
							ignoreList.push("power");
						}
						let api = global.cloudApiClient; // developer token variant
						if( typeof args.duration === 'number' )
							args.duration /= 1000;
						let stateOverride = {
							color: args.light_color,
							duration: args.duration,
							fast: true
						};
						return api.setSceneOverride({
							sceneUuid: args.scene.uuid,
							ignoreList: ignoreList,
							state: stateOverride,
							duration: args.duration
						});
					})
					.getArgument('scene')
					.registerAutocompleteListener( async query => {
						let api = global.cloudApiClient; // developer token variant
						return api.getScenes().then( scenes => {
							return scenes.map(scene => {
								return {
									name: scene.name,
									uuid: scene.uuid
								}
							})
						});
					});

					new Homey.FlowCardAction('set_lights_brightness_in_scene')
						.register()
						.registerRunListener(async args => {
							let ignoreList = [
								"infrared",
								"hue",
								"intensity",
								"saturation",
								"kelvin"
							];
							if (args.turn_on == "No") {
								ignoreList.push("power");
							}
							let api = global.cloudApiClient; // developer token variant
							if( typeof args.duration === 'number' )
								args.duration /= 1000;
							let stateOverride = {
								brightness: args.new_brightness,
								duration: args.duration,
								fast: true
							};
							return api.setSceneOverride({
								sceneUuid: args.scene.uuid,
								ignoreList: ignoreList,
								state: stateOverride,
								duration: args.duration
							});
						})
						.getArgument('scene')
						.registerAutocompleteListener( async query => {
							let api = global.cloudApiClient; // developer token variant
							return api.getScenes().then( scenes => {
								return scenes.map(scene => {
									return {
										name: scene.name,
										uuid: scene.uuid
									}
								})
							});
						});

			new Homey.FlowCardAction('activate_tile_flame')
				.register()
				.registerRunListener(async args => {
					let api = global.cloudApiClient; // developer token variant
					return api.setEffectFlame({
						device_id: args.my_device.light.data.id,
						period: args.effect_speed,
						power_on: (args.turn_on == "Yes") ? true : false
					});
				});

				new Homey.FlowCardAction('activate_tile_morph')
				.register()
				.registerRunListener(async args => {
					let api = global.cloudApiClient; // developer token variant
					return api.setEffectMorph({
						device_id: args.my_device.light.data.id,
						period: args.effect_speed,
						palette: [args.effect_color1, args.effect_color2, args.effect_color3, args.effect_color4, args.effect_color5, args.effect_color6, args.effect_color7],
						power_on: (args.turn_on == "Yes") ? true : false
					});
				});

				new Homey.FlowCardAction('stop_chain_effect')
				.register()
				.registerRunListener(async args => {
					let api = global.cloudApiClient; // developer token variant
					return api.stopChainDeviceEffect({
						device_id: args.my_device.light.data.id,
						power_off: (args.turn_off == "Yes") ? true : false
					});
				});

		// Set defaults if not present..
		var PollInterval = parseInt(Homey.ManagerSettings.get('statePollingInterval'));
		if (isNaN(PollInterval)) Homey.ManagerSettings.set('statePollingInterval', 10000);
		var Duration = parseInt(Homey.ManagerSettings.get('defaultTransitionDuration'));
		if (isNaN(Duration)) Homey.ManagerSettings.set('defaultTransitionDuration', 500);
		var LogInfo = parseInt(Homey.ManagerSettings.get('loggingInfoEnabled'));
		if (typeof LogInfo != "boolean"){
			Homey.ManagerSettings.set('loggingInfoEnabled', false);
		}
		var LogError = parseInt(Homey.ManagerSettings.get('loggingErrorEnabled'));
		if (typeof LogError != "boolean"){
			Homey.ManagerSettings.set('loggingErrorEnabled', false);
		}
		// Init UI Info Data
		/*
			[
				data: {
					id: "dummy_id_123abc",
					name: "Dummy Name",
					ip: "123.123.123.123",
					wifi: "Maybe Good",
					product: "Dummy A19"
				},...
			]
		*/
		this.info_data = [];
		this.info_data_pollingInterval = setInterval(async function () {
			Homey.app.temp_lights.forEach(function (light) {
				var old_data = Homey.app.getLight(light.data.id, Homey.app.info_data);
				if (old_data) {
					old_data.data.name = (light.device) ? light.device.getName() : "-";
					old_data.data.ip = (light.data.client) ? light.data.client.address : "-";
					old_data.data.wifi = (light.device) ? light.device.light.wifi_status.signal : "-";
				} else {
					var new_data = {
						data: {
							id: light.data.id,
							name: (light.device) ? light.device.getName() : "-",
							ip: (light.data.client) ? light.data.client.address : "-",
							wifi: (light.device) ? light.device.light.wifi_status.signal : "-",
							product: (light.device) ? light.device.getSetting('productName') : "-"
						}
					};
					Homey.app.info_data.push(new_data);
				}
			});
		}, 10000);
	}

	get cloudApiToken(){
		return Homey.ManagerSettings.get('cloudApiToken');
	}
	set cloudApiToken(value){
		Homey.ManagerSettings.set('cloudApiToken', value);
	}

	get logInfos(){
		return Homey.ManagerSettings.get('loggingInfoEnabled');
	}
	set logInfos(value){
		Homey.ManagerSettings.set('loggingInfoEnabled', value);
	}

	get logErrors(){
		return Homey.ManagerSettings.get('loggingErrorEnabled');
	}
	set logErrors(value){
		Homey.ManagerSettings.set('loggingErrorEnabled', value);
	}

	get statePollingInterval(){
		var Interval = parseInt(Homey.ManagerSettings.get('statePollingInterval'));
		if (isNaN(Interval)) Interval = 10000;
		if (Interval == null) {
			return 10000;
		} else {
			return Interval;
		}
	}
	set statePollingInterval(value){
		Homey.ManagerSettings.set('statePollingInterval', value);
	}

	get defaultTransitionDuration(){
		var Interval = parseInt(Homey.ManagerSettings.get('defaultTransitionDuration'));
		if (isNaN(Interval)) Interval = 500;
		if (Interval == null) {
			return 500;
		} else {
			return Interval;
		}
	}
	set defaultTransitionDuration(value){
		Homey.ManagerSettings.set('defaultTransitionDuration', value);
	}

	// Manually handle garbadge collection
	/*
		Currently done at:
			As final call after status polling.
	*/
	async triggerGC() {
		if (global.gcForceCount == null) {
			global.gcForceCount = 0;
		}
		global.gcForceCount++;
		if (global.gcTimeout != null) {
			clearTimeout(global.gcTimeout);
			global.gcTimeout = null;
		}
		global.gcTimeout = setTimeout (async function () {
			if (global.gc) {
				try {
					global.gc();
				}
				catch (err) {
					console.error('ERROR: gobal.gc() failed:', err);
				}
			} else {
				console.warn('WARNING: No GC hook! --expose-gc is not set!');
			}
		}, 3000);
		if (global.gcForceCount > 10000) {
			global.gcForceCount = 0;
			if (global.gc) {
				try {
					global.gc();
				}
				catch (err) {
					console.error('ERROR: Hard enforced gobal.gc() failed:', err);
				}
			} else {
				console.warn('WARNING: No GC hook! --expose-gc is not set!');
			}
		}
	}

	/**
	 * Maps the input value for kelvin to the output value based on a dynamic scale
	 * @param input_scale_start
	 * @param input_scale_end
	 * @param output_scale_start
	 * @param output_scale_end
	 * @param value input value within the input scale
	 * @returns {*} value mapped to output scale range
	 */
	mapKelvinScale(input_scale_start, input_scale_end, output_scale_start, output_scale_end, value) {
		return output_scale_start + ((output_scale_end - output_scale_start) / (input_scale_end - input_scale_start)) * (value - input_scale_start);
	}

	/**
	 * Gets a light from one of the internal device arrays.
	 * Uses Homey.app.lights by default. Only required for some special methods.
	 * @param device_id
	 * @param list optional
	 * @returns {*}
	 */
	getLight(device_id, list) {
		let found_light = null;
		let search_list = (list) ? list : Homey.app.lights;
		search_list.forEach(function (light) {
			if (light.data.id === device_id) {
				found_light = light;
			}
		});
		return found_light;
	}

}

module.exports = SDN_LIFX_LAN2;
