'use strict';

const Homey = require('homey');
var Cutter = require('utf8-binary-cutter');
// Index for Energy consumption data
const LIFX_energyData = require('../../lib/lifxPowerConstants');

function WaitOnInitComplete (current_device) {
	if (Homey.app.logInfos) Homey.app.log("Waiting on device '", current_device.getName(), "' init completion..");
	if (current_device.light == null) {
		current_device.setUnavailable(Homey.__("inAppErrors.waitOnInitComplete"));
		setTimeout(function() { WaitOnInitComplete(current_device); }, 3000);
		return;
	}
	if (current_device.light.data.light_temperature == null) {
		current_device.setUnavailable(Homey.__("inAppErrors.waitOnInitComplete"));
		setTimeout(function() { WaitOnInitComplete(current_device); }, 3000);
		return;
	}
	current_device.setAvailable();
	if (Homey.app.logInfos) Homey.app.log("Device '", current_device.getName(), "' init completed.");
}

function WaitOnDevice (current_device) {
	var device_data = current_device.getData();
	var temp_light = Homey.app.getLight(device_data.id, Homey.app.temp_lights);
	if (temp_light == null) {
		current_device.setUnavailable(Homey.__("inAppErrors.waitOnDevice"));
		if (Homey.app.logInfos) Homey.app.log("Waiting on device '", current_device.getName(), "'..");
		setTimeout(function() { WaitOnDevice(current_device); }, 2000);
		return;
	}
	if (Homey.app.logInfos) Homey.app.log("Device '", current_device.getName(), "' showed up!");
	WaitOnInitComplete (current_device);
	temp_light.device = current_device;
	current_device.light = {
				data: {
					id: temp_light.data.id,
					client: temp_light.data.client,
					status: temp_light.data.status,
					init_stage: true,
					init_poll_count: 0,
					init_poll_count_restart: -60,
					wifi_poll_status_counter: 0
				},
				name: temp_light.name,
				device: current_device,
				temp_min: 1500,
				temp_max: 9000,
				ambient_flux: -1,
				wifi_status: {
					rx: 0,
					tx: 0,
					signal: '-'
				}
			};
			var light = current_device.light;
					clearInterval(current_device.light.pollingInterval);
					light.pollingInterval = setInterval(async function () {
						if (!current_device.getAvailable()) {
						  if (!current_device.light.data.init_stage) {
								if (Homey.app.logInfos) Homey.app.log('Not polling status update for offline device ', current_device.light.name, '..');
								return;
							} else {
								if (!current_device.light.data.init_poll_count <= 6) {
									current_device.light.data.init_poll_count++;
									if (Homey.app.logInfos) Homey.app.log('Init polling try ', current_device.light.data.init_poll_count,'for offline device ', current_device.light.name, '..');
								} else {
									current_device.light.data.init_stage = false;
									current_device.light.data.init_poll_count_restart++;
									if (Homey.app.logInfos) Homey.app.log('Init restart sleeping at ', current_device.light.data.init_poll_count_restart,' for offline device ', current_device.light.name, '..');
									if (current_device.light.data.init_poll_count_restart >= 0) {
										if (Homey.app.logInfos) Homey.app.log('Init restart for offline device ', current_device.light.name, '..');
										current_device.light.data.init_poll_count_restart = -60;
										current_device.light.data.init_stage = true;
										current_device.light.data.init_poll_count = 0;
									}
									return;
								}
							}
						} else {
							current_device.light.data.init_stage = false;
							current_device.light.data.init_poll_count_restart = -60;
							current_device.light.data.init_poll_count = 0;
						}
						if (Homey.app.logInfos) Homey.app.log('Polling status update for ', current_device.light.name, '..');
						if (light.hardware == null) {
							if (Homey.app.logInfos) Homey.app.log('No hardware info, yet. Asking ', current_device.light.name, ' for it now..');
							await light.data.client.getHardwareVersion(async function (err, data) {
									if (data != null) {
										if (Homey.app.logInfos) Homey.app.log('Got hardware info for ', current_device.light.name, ':', data);
										light.hardware = data;
										if (light.hardware.productFeatures != null) {
											// Update Kelvin range by hardware info
											if (light.hardware.productFeatures.temperature_range != null) {
												if (Homey.app.logInfos) Homey.app.log('Found Kelvin range for ', current_device.light.name, ':', light.hardware.productFeatures.temperature_range);
												light.temp_min = light.hardware.productFeatures.temperature_range[0];
												light.temp_max = light.hardware.productFeatures.temperature_range[1];
												let currentSettings = current_device.getSettings();
												let newSettings = {};
												if (currentSettings.tempMin != light.temp_min) newSettings.tempMin = light.temp_min;
												if (currentSettings.tempMax != light.temp_max) newSettings.tempMax = light.temp_max;
												if (currentSettings.supportColor != light.hardware.productFeatures.color) newSettings.supportColor = light.hardware.productFeatures.color;
												if (currentSettings.supportInfrared != light.hardware.productFeatures.infrared) newSettings.supportInfrared = light.hardware.productFeatures.infrared;
												if (currentSettings.supportMultiZone != light.hardware.productFeatures.multizone) newSettings.supportMultiZone = light.hardware.productFeatures.multizone;
												if (currentSettings.supportChain != light.hardware.productFeatures.chain) newSettings.supportChain = light.hardware.productFeatures.chain;
												if (currentSettings.vendorName != light.hardware.vendorName) newSettings.vendorName = light.hardware.vendorName;
												if (currentSettings.productName != light.hardware.productName) newSettings.productName = light.hardware.productName;
												if (currentSettings.version != light.hardware.version) newSettings.version = light.hardware.version;
												if (currentSettings.vendorId != light.hardware.vendorId) newSettings.vendorId = light.hardware.vendorId;
												if (currentSettings.productId != light.hardware.productId) newSettings.productId = light.hardware.productId;
												await current_device.setSettings(newSettings)
												.catch(err => {
													if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
												})
												// Update Energy Object based on device type
												let powerData = LIFX_energyData.ENERGY_DATA[light.hardware.vendorId.toString()][light.hardware.productId.toString()];
												if (!powerData) {
													powerData = LIFX_energyData.ENERGY_DATA_BY_PRODUCT[light.hardware.productName];
												}
												if (powerData) {
													let new_energy_object = {
														'approximation': {
															"usageOn": powerData.usageOn, // in Watt
															"usageOff": powerData.usageOff // in Watt
														}
													};
													console.log("Found E-Data:", new_energy_object);
													await current_device.setEnergy(new_energy_object);
												} else {
													console.warn("WARNING: No energy data for Vendor:", light.hardware.vendorId, "Product:", light.hardware.productId, "Device:", light.hardware.vendorName, "-", light.hardware.productName, "Named:", current_device.light.name);
												}
											}

											if (light.hardware.productFeatures.multizone == false) {
												if (current_device.hasCapability("multiple_zones")) {
													light.device.removeCapability("multiple_zones");
												}
											} else {
												if (!current_device.hasCapability("multiple_zones")) {
													light.device.addCapability("multiple_zones");
												}
											}

											if (light.hardware.productFeatures.chain == false) {
												if (current_device.hasCapability("chain_device")) {
													light.device.removeCapability("chain_device");
												}
											} else {
												if (!current_device.hasCapability("chain_device")) {
													light.device.addCapability("chain_device");
												}
											}

											if (light.hardware.productFeatures.infrared == false) {
												if (current_device.hasCapability("infrared_max_level")) {
													light.device.removeCapability("infrared_max_level");
												}
											}

											if (light.hardware.productFeatures.color == false) {
												if (current_device.hasCapability("light_hue")) {
													light.device.removeCapability("light_hue");
												}
												if (current_device.hasCapability("light_saturation")) {
													light.device.removeCapability("light_saturation");
												}
											}
											// Automigrate missing flux capabillity
											if (!current_device.hasCapability("current_ambient_flux")) {
												light.device.addCapability("current_ambient_flux");
											}
										}
									}
							});
						}

						if (light.firmware == null) {
							if (Homey.app.logInfos) Homey.app.log('No firmware version info, yet. Asking ', current_device.light.name, ' for it now..');
							await light.data.client.getFirmwareVersion(async function (err, data) {
								if (data != null) {
									if (Homey.app.logInfos) Homey.app.log('Got firmware version info for ', current_device.light.name, ':', data);
									light.firmware = data;
									let oldMaV = current_device.getSettings('majorVersion');
									let oldMiV = current_device.getSettings('minorVersion');
									if (oldMaV != light.firmware.majorVersion || oldMiV != light.firmware.minorVersion) {
										await current_device.setSettings({
											majorVersion: light.firmware.majorVersion,
											minorVersion: light.firmware.minorVersion
										})
										.catch(err => {
											if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
										})
									}
								}
							});
						}

						if (light.wifi_version == null) {
							if (Homey.app.logInfos) Homey.app.log('No wifi version info, yet. Asking ', current_device.light.name, ' for it now..');
							await light.data.client.getWifiVersion(async function (err, data) {
								if (data != null) {
									if (Homey.app.logInfos) Homey.app.log('Got wifi version info for ', current_device.light.name, ':', data);
									light.wifi_version = data;
									if (light.wifi_version.majorVersion == 0 && light.wifi_version.minorVersion == 0) {
										let oldChkValue = current_device.getSettings('wifi_majorVersion');
										if (oldChkValue != Homey.__("inAppErrors.dataNotAvailable")) {
											await current_device.setSettings({
												wifi_majorVersion: Homey.__("inAppErrors.dataNotAvailable"),
												wifi_minorVersion: Homey.__("inAppErrors.dataNotAvailable")
											})
											.catch(err => {
												if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
											})
										}
									} else {
										let oldWFMaV = current_device.getSettings('wifi_majorVersion');
										let oldWFMiV = current_device.getSettings('wifi_minorVersion');
										if (oldWFMaV != light.wifi_version.majorVersion.toString() || oldWFMiV != light.wifi_version.minorVersion.toString()) {
											await current_device.setSettings({
												wifi_majorVersion: light.wifi_version.majorVersion.toString(),
												wifi_minorVersion: light.wifi_version.minorVersion.toString()
											})
											.catch(err => {
												if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
											})
										}
									}
								}
							});
						}

						//Note: This seems very intense for the app so we don't do this all the time
						light.data.wifi_poll_status_counter--;
						if (light.data.wifi_poll_status_counter <= 0) {
							light.data.wifi_poll_status_counter = 6;
							await light.data.client.getWifiInfo(async function (err, data) {
								if (data != null) {
									if (Homey.app.logInfos) Homey.app.log('Got wifi info for ', current_device.light.name, ':', data);
									light.wifi_status.rx = data.rx;
									light.wifi_status.tx = data.tx;
									light.wifi_status.signal = wifiSignalToHR(data.signal);
								}
							});

							// Update IR data
							if (light.hardware != null) {
								if (light.hardware.productFeatures != null) {
									if (light.hardware.productFeatures.infrared != null) {
										if (light.hardware.productFeatures.infrared == true) {
											await light.data.client.getMaxIR(async function (err, data) {
												if (data != null) {
													if (Homey.app.logInfos) Homey.app.log('Got infrared_max_level info for ', current_device.light.name, ':', data);
													this.setCapabilityValue("infrared_max_level", data.brightness)
													.then( result => {
														if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated infrared_max_level value");
													})
													.catch( err => {
														if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
													})
												}
											});
										}
									}
								}
							}// Update IR Data

							// Ambient light data
							await light.data.client.getAmbientLight(async function (err, data) {
								if (data != null) {
									if (Homey.app.logInfos) Homey.app.log('Got ambient_light info for ', current_device.light.name, ':', data);
									if (light.ambient_flux != data) {
										// update flux capability
										light.device.setCapabilityValue("current_ambient_flux", data)
										.then( result => {
											if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated current_ambient_flux value");
										})
										.catch( err => {
											if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
										})
										// emit event for flowcard
										let device_driver = current_device.getDriver();
										let trigger_specific_device_tokens = {
											'device_label': current_device.light.name,
											'device_flux_level_new': data,
											'device_flux_level_old': light.ambient_flux
										};
										light.ambient_flux = data;
										let trigger_specific_device_state = {
										};
										device_driver.triggerFluxChanged(current_device, trigger_specific_device_tokens, trigger_specific_device_state);
									}
								}
							}); //getAmbientLight

						}

						// Multizone Data Example - one call only retrieves up to 8 LEDs
						/*{
							count: 61,
							index: 0,
							color:
							[ { hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 },
								{ hue: 24, saturation: 76, brightness: 52, kelvin: 2500 }
							]
						}*/
						if (light.hardware != null) {
							if (light.hardware.productFeatures != null) {
								if (light.hardware.productFeatures.multizone == true) {
									if (Homey.app.logInfos) Homey.app.log('Polling multizone state data for ', light.name, '..');
									await light.data.client.getColorZones(0, 255, async function (err, data) {
										if (Homey.app.logInfos) Homey.app.log('Got multizone state data for ', light.name, '..');
										if (err) {
											if (err && Homey.app.logErrors) Homey.app.error(light.name, ":", err);
										}
										if (data != null) {
											if (light.updateTimeout) {
												if (Homey.app.logInfos) Homey.app.log(light.name, ': In debounce mode. Suppressing update..');
												return;
											}
											light.data.zonesData = data;
											let oldCount = current_device.getSettings('zonesCount');
											if (oldCount != data.count.toString()) {
												await current_device.setSettings({
													zonesCount: data.count.toString()
												})
												.catch(err => {
													if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
												})
											}
										}
									});
								}
							}
						}

						await light.data.client.getState(async function (err, data) {
							if (Homey.app.logInfos) Homey.app.log('Got state data for ', light.name, '..');
							if (err) {
								if (Homey.app.logErrors) Homey.app.error(light.name, ":", err);
							}
							if (data != null) {
								if (light.updateTimeout) {
									if (Homey.app.logInfos) Homey.app.log(light.name, ': In debounce mode. Suppressing update..');
									return;
								}

								if (data.label != null) {
									if (light.name != data.label) {
										if (Homey.app.logInfos) Homey.app.log(light.name, ': Updating name to: ', data.label);
										light.name = data.label;
										var ActualName = current_device.getName();
										if (ActualName != light.name) {
											//TODO: Update name in Homey -> This is currently not supported by Homey :(
										}
									}
								}

								light.data.onoff = ( data.power === 1 ) ? true : false;
								light.device.setCapabilityValue("onoff", light.data.onoff)
								.then( result => {
									if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated onoff value");
								})
								.catch( err => {
									if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
								})

								light.data.light_temperature = Homey.app.mapKelvinScale(light.temp_max, light.temp_min, 0, 1, data.color.kelvin);
								light.device.setCapabilityValue("light_temperature", light.data.light_temperature)
								.then( result => {
									if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_temperature value");
								})
								.catch( err => {
									if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
								})

								light.data.dim = data.color.brightness / 100;
								light.device.setCapabilityValue("dim", light.data.dim)
								.then( result => {
									if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated dim value");
								})
								.catch( err => {
									if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
								})

								light.data.light_saturation = data.color.saturation / 100;
								light.device.setCapabilityValue("light_saturation", light.data.light_saturation)
								.then( result => {
									if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_saturation value");
								})
								.catch( err => {
									if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
								})

								light.data.light_hue = data.color.hue / 360;
								light.device.setCapabilityValue("light_hue", light.data.light_hue)
								.then( result => {
									if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_hue value");
								})
								.catch( err => {
									if (Homey.app.logErrors) Homey.app.error(light.name, ': ' + err);
								})
								// update light mode
								light.data.light_mode = "temperature";
								if (light.data.light_saturation > 0) light.data.light_mode = "color";
							} else {
								if (Homey.app.logErrors) Homey.app.error(light.name, ': No data received!');
							}
						})
						Homey.app.triggerGC();
					}, Homey.app.statePollingInterval + Math.floor(Math.random() * 1000)); // Experimentally add a slight deviation to unstress Homey for large number of devices
}

class LIFXDevice extends Homey.Device {

	async onSettings( oldSettingsObj, newSettingsObj, changedKeysArr ) {
    // run when the user has changed the device's settings in Homey.
    // changedKeysArr contains an array of keys that have been changed
    // if the settings must not be saved for whatever reason:
    throw new Error(Homey.__('inAppErrors.advSettingsReadOnly'));
  }

  async onDeleted() {
		if (Homey.app.logInfos) this.log('LIFXDevice is being deleted..');
		if (Homey.app.logInfos) this.log('Name:', this.getName());
		if (Homey.app.logInfos) this.log('Class:', this.getClass());
		clearInterval(this.light.pollingInterval);
	}

  async onRenamed(new_name) {
		if (Homey.app.logInfos) this.log('Renamed to: ', new_name);
		var device_data = this.getData();
		// Check for valid new name
		if (typeof device_data === "object" && typeof new_name === "string" && new_name !== '') {

			// Parse new label and truncate at 32 bytes
			var label = Cutter.truncateToBinarySize(new_name, 32);

			// Get light targeted
			var light = this.light;
			var temp_light = Homey.app.getLight(device_data.id, Homey.app.temp_lights);

			// Store new name internally
			if (light) light.name = label;
			if (temp_light) temp_light.name = label;

			// Set new label with a max of 32 bytes (LIFX limit)
			if (light) light.data.client.setLabel(label);
		}
	}

	onInit() {
		if (Homey.app.logInfos) this.log('LIFXDevice has been initialized.');
		if (Homey.app.logInfos) this.log('Name:', this.getName());
		if (Homey.app.logInfos) this.log('Class:', this.getClass());
		// register a capability listener
		this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
		this.registerCapabilityListener('light_hue', this.onCapabilityHue.bind(this));
		this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
		this.registerCapabilityListener('light_temperature', this.onCapabilityTemp.bind(this));
		this.registerCapabilityListener('light_saturation', this.onCapabilitySat.bind(this));
		this.registerCapabilityListener('light_mode', this.onCapabilityMode.bind(this));
		this.registerCapabilityListener('infrared_max_level', this.onCapabilityInfrared.bind(this));

		// Install status polling
		WaitOnDevice(this);
	}//onInit

	async onCapabilityInfrared( max_ir, opts ) {
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update infrared_max_level event: ", max_ir);
		if (light != null && light.data != null && light.data.client !== null) {
			// Update bulb state
			await light.data.client.maxIR(max_ir, function (err) {
				if (err && Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityInfrared->client.maxIR:', err);
			});
			this.setCapabilityValue("infrared_max_level", max_ir)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated infrared_max_level value: ", max_ir);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityInfrared: ', err);
			})
		}
		return Promise.resolve();
	}

  async UpdateLightState(duration) {
		// Set hue and saturation
		var hue = Math.round(this.light.data.light_hue * 360);
		var saturation = this.light.data.light_saturation * 100;
		// If light mode is white
		if (this.light.data.light_mode == "temperature") {
			// Set hue and saturation to 0
			//hue = 0;
			saturation = 0;
		}
		if (this.light.updateTimeout) {
			// Clear timeout
			clearTimeout(this.light.updateTimeout);
			// Destroy timeout
			this.light.updateTimeout = null;
		}
		var light = this.light;
		this.light.updateTimeout = setTimeout(async function () {
			// Perform update on bulb
			clearTimeout(light.updateTimeout);
			light.updateTimeout = null;
			await light.data.client.color(hue, saturation, light.data.dim * 100, Homey.app.mapKelvinScale(0.0, 1.0, light.temp_max, light.temp_min, light.data.light_temperature), duration, function (err) {
				if (err && Homey.app.logErrors) Homey.app.error(light.name, "UpdateLightState:", err);
			});
		}, 150);
	}

	async onCapabilityMode( new_mode, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update mode event: ", new_mode);
		if (light != null && light.data != null && light.data.client !== null) {
			// Toggle color mode
			light.data.light_mode = new_mode;
			// Update bulb state
			this.UpdateLightState(duration);
			this.setCapabilityValue("light_mode", light.data.light_mode)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_mode value: ", light.data.light_mode);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityMode: ', err);
			})
		}
		return Promise.resolve();
	}

	async onCapabilitySat( sat, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update light_saturation event: ", sat);
		if (light != null && light.data != null && light.data.client !== null) {
			// Store light_saturation
			light.data.light_saturation = sat;
			// Toggle color mode
			if (sat > 0) light.data.light_mode = "color";
			// Update bulb state
			this.UpdateLightState(duration);
			this.setCapabilityValue("light_mode", light.data.light_mode)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_mode value: ", light.data.light_mode);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilitySat: ', err);
			})
			this.setCapabilityValue("light_saturation", sat)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_saturation value: ", sat);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilitySat: ', err);
			})
		}
		return Promise.resolve();
	}

	async onCapabilityTemp( temp, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update light_temperature event: ", temp);
		if (light != null && light.data != null && light.data.client !== null) {
			// Store light_temperature
			light.data.light_temperature = temp;
			// Switch to temp mode
			this.light.data.light_mode = "temperature";
			// Update bulb state
			this.UpdateLightState(duration);
			this.setCapabilityValue("light_mode", light.data.light_mode)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_mode value: ", light.data.light_mode);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityTemp: ', err);
			})
			this.setCapabilityValue("light_temperature", temp)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_temperature value: ", temp);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityTemp: ', err);
			})
		}
		return Promise.resolve();
	}

	async onCapabilityDim( dim, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update dim event: ", dim);
		if (light != null && light.data != null && light.data.client !== null) {
			// Store dim value
			light.data.dim = dim;
			// Update bulb state
			this.UpdateLightState(duration);
			this.setCapabilityValue("light_mode", light.data.light_mode)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_mode value: ", light.data.light_mode);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityDim: ', err);
			})
			this.setCapabilityValue("dim", dim)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated dim value: ", dim);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityDim: ', err);
			})
		}
		return Promise.resolve();
	}

  async onCapabilityHue( light_hue, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update light_hue event: ", light_hue);
		if (light != null && light.data != null && light.data.client !== null) {
			// Store light_hue
			light.data.light_hue = light_hue;
			// Toggle color mode
			if (light_hue > 0) light.data.light_mode = "color";
			// Update bulb state
			this.UpdateLightState(duration);
			this.setCapabilityValue("light_mode", light.data.light_mode)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_mode value: ", light.data.light_mode);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityHue: ', err);
			})
			this.setCapabilityValue("light_hue", light_hue)
			.then( result => {
				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated light_hue value: ", light_hue);
			})
			.catch( err => {
				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityHue: ', err);
			})
		}
		return Promise.resolve();
	}
	// this method is called when the Device has requested a state change (turned on or off)
	async onCapabilityOnOff( value, opts ) {
		var duration = Homey.app.defaultTransitionDuration;
		if (opts.duration != null) {
			duration = opts.duration;
		}
		var light = this.light;
		if (Homey.app.logInfos) Homey.app.log(light.name, ": Update onoff event: ", value);
		if (light != null && light.data != null && light.data.client !== null) {
			if (value) {
				// Turn bulb on with global duration setting
				await light.data.client.on(duration, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityOnOff->client.on:', err);
				});
				this.setCapabilityValue("onoff", value)
				.then( result => {
  				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated onoff value: ", value);
				})
				.catch( err => {
  				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityOnOff: ', err);
				})
			}	else {
				// Turn bulb off with global duration setting
				await light.data.client.off(duration, function (err) {
					if (err && Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityOnOff->client.off:', err);
				});
				this.setCapabilityValue("onoff", value)
				.then( result => {
  				if (Homey.app.logInfos) Homey.app.log(light.name, ": Updated onoff value: ", value);
				})
				.catch( err => {
  				if (Homey.app.logErrors) Homey.app.error(light.name, 'onCapabilityOnOff: ', err);
				})
			}
		}
		return Promise.resolve();
	}//onCapabilityOnoff
}

/**
 * Gets a human readable string for the LIFX wifi signal strength.
 * There are two different kinds of signal values, therefor the funky maths.
 * @param signal the raw value
 * @returns {*} a human readable message about the signal quality
*/
function wifiSignalToHR (signal) {
	var val = Math.floor(10 * Math.log10(signal) + 0.5)
	if (val < 0 || val == 200) {
    // The value is wifi rssi
		if (val == 200) {
			return Homey.__('wifi.noSignal'); // Which is silly because how would we get this value if the device is not connected :D
		} else if (val <= -80) {
			return Homey.__('wifi.veryBadSignal');
		} else if (val <= -70) {
			return Homey.__('wifi.somewhatBadSignal');
		} else if (val < -60) {
			return Homey.__('wifi.alrightSignal');
		} else {
			return Homey.__('wifi.goodSignal');
		}
	} else {
		// The value is signal to noise ratio
		if (val == 4 || val == 5) {
			return Homey.__('wifi.veryBadSignal');
		} else if (val >= 7 && val <= 11) {
			return Homey.__('wifi.somewhatBadSignal');
		} else if (val >= 12 && val <= 16) {
			return Homey.__('wifi.alrightSignal');
		} else if (val > 16) {
			return Homey.__('wifi.goodSignal');
		} else {
			return Homey.__('wifi.noSignal'); // Which is silly because how would we get this value if the device is not connected :D
		}
	}
}

module.exports = LIFXDevice;
