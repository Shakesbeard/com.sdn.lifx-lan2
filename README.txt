Adds support for controlling LIFX devices over your local network.

Supported Languages: English, German
Supported Devices: All LIFX Devices (theoretically, I don't own all models)

Available Flowcard Actions:
 - All default light parameters with optional transition duration
 - Set infrared max (can also be set from the Homey app as additional dim value)
 - Set Multizone Advanced and Simple (like for LIFX Beam, see details below)
 - Play effects per device (see details below)
 - Special card which takes an RGB Hex Code for setting the color (useful if you have such codes in tags)
Additonal Flowcard Actions (which require you to set your LIFX cloud access token in the app settings):
 - Set scene stored in LIFX cloud
 - Set color of lights in a scene
 - Set brightness of lights in a scene
 - Turn lights of a scene on
 - Turn lights of a scene off

Available Flowcard Triggers:
 - All default light triggers
 - Ambient Light Level changed event (in flux)
 - Device gone offline/online event (generic and per device)

Available Flowcard Conditions:
 - All default light conditions
 - Ambient Light (in flux) is available as token for inclusion in logic cards

Set Multizone Action Card
The Set Multizone action card is enabled to set every single zone.
The Zone Code consists of a light description containing the color, saturation, brightness and kelvin. Or a RGB hex code.
You can address as many zones as you like by adding more such sets separated by ';'.
Syntax: hue[0-360],saturation[0-100],brightness[0-100],kelvin[2500-9000];...
Syntax: #ff0000;#00ff00;...
Both syntax can be mixed.
Do not add a trailing ';' to the end of the text.
The next parameter is a number from 0 to 255. This number defines at which zone index we shall start to apply the list of settings.
Finally you can choose whether to apply your settings immediately or leave the configuration pending.
This is useful if you want to split up your section settings into multiple cards.
On the last card you should of course set it to apply settings.
Not Working? Then you have a syntax error in your configuration string. Check and try again.
Example: 0, 50, 50, 2500;50, 50, 50, 2500;150, 50, 50, 2500;200, 50, 50, 2500;250, 50, 50, 2500

Effects
Effects are supported for devices with color support only.
 - Glow: Sine & Triangle (First number is the repetitions, second number duration of one impulse)
 - Saw: Saw & Half-Sine
 - Blink: Pulse
Firmware Effects for Multizone Devices (LIFX BEAM and STRIP)
 - Move Transition (infinite) & Stop
Firmware Effects for Chain Devices (LIFX Tile, requires you to set your LIFX cloud access token in the app settings)
 - Flames Effect (infinite)
 - Color Morph Effect (infinite)

Power Consumption Data for Homey Energy
This app preconfigures the power consumption data for energy usage approximation.
This is currently supported for Original 1000 bulbs only.
Once I get the correct power details from LIFX I will update the software to include those.
Note: If you set the values manually, this app will not update them anymore, even after the data was added to the app.

App Settings (do change these if really needed only)
 - Polling Interval (for light stats requests)
 - Developer Token (required for LIFX Cloud Access)
 - Default light transition duration
 - List of all devices

Known Issues / Limitations
 - Firmware effects for LIFX Tile can only be controlled through cloud access
 - LIFX Tiles cannot be controlled individually
 - Power consumption for Tile and multizone devices (BEAM, Strip,..) are vague as calculating it by every lit led would cost too much network traffic
 - Ambient light flux is showing for all devices, but I don't know if all devices support that
 - No fixed listed IPs for lights supported. Discovery broadcast packages must be allowed to find the devices

Special Thanks (for answering my stupid beginners questions and their patience with me)
Remco M (aka caseda)
Robert Kelb
petterHomey
Bas van den Bosch (for sharing the old lan driver, which inspired me to build this)
Emile Nijssen (aka WeeJeWel)
Ramón Baas
And of course all the nice guys at https://github.com/node-lifx/lifx-lan-client/ for the underlying controller library
