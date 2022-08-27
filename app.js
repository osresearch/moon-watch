/*
 * Minimal example of a clock face application
 */
return {
	"node_name": '',
	"manifest": {
		"timers": ['select_tick', 'timer_tick']
	},
	"persist": {},
	"config": {},
	"animation_steps": 0,
	"moon_image": 0,
	"solar": null,

	"log": function (object, tag) {
		req_data(this.node_name, '"type": "log", "node":"' + this.node_name + '", "tag":"' + tag +  '", "data":' + JSON.stringify(object), 999999, true)
	},

	// called when application starts
	"init": function () {
		var self = this;
		self.state_machine = new state_machine(
			self,
			self.handle_global_event,
			function(state,phase) { return self.handle_state_event(state, phase) },
			undefined,
			'background'
		);
		self.state_machine.new_state = self.state_machine.d;
		self.log("init called", "moonphase");
	},

	// called periodically as a method on the object
	"handler": function (event, response) {
		this.state_machine._(event, response);
	},

	// event.de == "concerns_this_app"
	// event.le == "new_state"
	// event.ze == "old_state"
	// state_machine.n == "current state"
	// state_machine.d() == "set_current state"
	"handle_global_event": function (self, state_machine, event, response) {
		if (event.type === 'system_state_update' && event.de)
		{
			state_machine.new_state(event.le === 'visible' ? 'draw_hands' : 'background');
		} else
		if (event.type === 'middle_hold')
		{
			response.action = {
				type: 'go_back',
				Se: true, // kill the app
			};
		}
	},

	// the state machine object will call this function to get a handler
	// for the current event based on the event type (or entry/exit transition)
	// if there are state machine entries for those transitions, use them,
	// otherwise for "during" events, return a generic handler that will
	// do an additional lookup on event type
	"handle_state_event": function (state, phase) {
		var handlers = this.states[state];
		if (!handlers)
			return;

		// if there is a entry/exit/during phase handler, return it
		if (phase in handlers)
			return handlers[phase];
		if (phase != 'during')
			return;

		// otherwise return the generic handler that will dispatch based on event type
		return function(self,state_machine,event,response) {
			var handler = handlers[event.type];
			if (handler)
				handler(self, state_machine, event, response);
		};
	},

	// event types are:
	// * 'system_state_update'
	// * 'middle_hold', 'middle_press', 'middle_short_press_release'
	// * 'top_hold', 'top_press', 'top_short_press_release'
	// * 'bottom_hold', 'bottom_press', 'bottom_short_press_release'
	// * 'timer_restart', 'timer_dismiss', 'timer_expired',
	// * 'time_telling_update' -- when the hands need to move normally
	// * 'common_update' -- something has changed in the global common struct
	// * 'flick_away' -- user has flicked their wrist
	// * 'notification_received'
	// * 'node_config_update'
	"states": {
		"draw_hands": {
			"entry": function(self,state_machine,event,response) {
				// we will do the hand and screen updates ourselves
				//enable_time_telling();
				self.last_quarter = -1;
				start_timer(self.node_name, 'timer_tick', 200);
				self.log("entry called", "moonphase");
			},
			"exit": function(self,state_machine,event,response) {
				stop_timer(self.node_name, 'timer_tick');
			},
			"timer_expired": function(self,state_machine,event,response) {
				if (!is_this_timer_expired(event, self.node_name, 'timer_tick'))
					return;


				// track minutes and seconds based on unix time,
				// since it seems to disagree with common.minute?
				self.update_time();

				// every quarter hour update the screen
				if (self.quarter != self.last_quarter)
				{
					//self.log(common.time_zone_local + " " + self.hour, "update");
					//self.log(common, "common");
					self.last_quarter = self.quarter;
					self.update_moon();
					self.draw_moon(response, true);
				}

				self.draw_hands(response);
/*
				// schedule to redraw on 15-minute internvals
				var sec_past_quarter = self.second_past_hour % (60 * 15);
				var delay_sec = 60 * 15 - sec_past_quarter;

				start_timer(self.node_name, 'timer_tick', delay_sec * 1000);
*/
				// update hands every 20 seconds
				start_timer(self.node_name, 'timer_tick', 20000);
			},

			// called every 20 seconds or so to update the hands
			"time_telling_update": function(self,state_machine,event,response) {
				self.update_time();
				self.draw_hands(response);
			},

			"middle_short_press_release": function(self,sm,event,response) {
				sm.new_state('stopwatch');
			},
			"bottom_press": function(self,state_machine,event,response) {
				// move the hands a bit
				response.move = {
					h: -3,
					m: 10,
					is_relative: true,
				};
			},
			"flick_away": function(self,sm,event,response) {
				//sm.new_state('animate_moon');
			},
		},

		"stopwatch": {
			"entry": function(self,sm,event,response) {
				if (!self.stopwatch)
				{
					self.stopwatch = {
						timing: false,
						total: 0,
						lap: 0,
						lap_start: 0,
						start_milis: 0,
					};
				}

				// always redraw on entry
				self.stopwatch.force_redraw = true;

				start_timer(self.node_name, 'timer_tick', 50);
			},
			"exit": function(self)
			{
				stop_timer(self.node_name, 'timer_tick');
			},
			"timer_expired": function(self,state_machine,event,response) {
				if (!is_this_timer_expired(event, self.node_name, 'timer_tick'))
					return;

				// accumulate time if we are timing
				if (self.stopwatch.timing)
				{
					var n = now();
					self.stopwatch.total += (n - self.stopwatch.start_milis);
					self.stopwatch.start_milis = n;
				} else
				if (!self.stopwatch.force_redraw)
					return;

				// jump hand for the minute hand
				var total_sec = self.stopwatch.total / 1000;
				var sec_angle = 360 * (total_sec % 60) / 60;
				var hour_angle = 360 * Math.floor(total_sec / 60) / 12;

				response.move = {
					h: hour_angle,
					m: sec_angle,
					is_relative: false,
				};

				// only do a redraw if we are paused or forced
				if (!self.stopwatch.timing || self.stopwatch.force_redraw)
					self.draw_stopwatch(response);

				// update the hands once per second while timing
				if (self.stopwatch.timing)
					start_timer(self.node_name, 'timer_tick', 1000);
			},
			"top_press": function(self,state_machine,event,response) {
				// start/stop the timer
				if (self.stopwatch.timing)
				{
					// copy the accrued time to the total counter
					self.stopwatch.total += now() - self.stopwatch.start_milis;
					self.stopwatch.timing = false;
				} else {
					self.stopwatch.start_milis = now();
					self.stopwatch.timing = true;
				}

				// trigger an immediate redraw
				start_timer(self.node_name, 'timer_tick', 50);
				self.stopwatch.force_redraw = true;
			},
			"bottom_press": function(self,state_machine,event,response) {
				if (self.stopwatch.timing)
				{
					// if timing, trigger a lap time
					// lap not yet implemented.
				} else {
					// if not timing, reset everything
					self.stopwatch.total = 0;
				}

				// trigger an immediate redraw
				start_timer(self.node_name, 'timer_tick', 50);
				self.stopwatch.force_redraw = true;
			},
			"middle_short_press_release": function(self,state_machine,event,response) {
				state_machine.new_state("text_display");
			},
		},


		"text_display": {
			"entry": function(self,sm,event,response) {
				disable_time_telling();
				start_timer(self.node_name, 'timer_tick', 200);
			},
			"middle_short_press_release": function(self,sm,event,response) {
				sm.new_state("draw_hands");
			},
			"timer_expired": function(self,state_machine,event,response) {
				response.move = {
					h: -90,
					m: +90,
					is_relative: false
				};
				self.update_moon();
				self.draw_text(response);

				// update once per minute
				start_timer(self.node_name, 'timer_tick', 60*1000);
			},
		},

		"animate_moon": {
			// start the animation counter and reset the timer
			"entry": function(self,sm,event,response) {
				self.animation_steps = 24 * 3;
				start_timer(self.node_name, 'timer_tick', 10);
			},
			"timer_expired": function(self,sm,event,response) {
				if (self.animation_steps-- == 0)
				{
					sm.new_state('draw_hands');
					return;
				}

				start_timer(self.node_name, 'timer_tick', 60);

				if ((self.animation_steps % 3) == 2)
				{
					self.moon_image = (self.moon_image + 1) % 24;
					self.draw_moon(response, false);
				}

				response.move = {
					h: 49,
					m: -49,
					is_relative: true,
				};

			},
			"flick_away": function(self,sm,event,response) {
				// stop the animation and return to normal
				self.animation_steps = 0;
			},
		},
	},

	"update_time": function() {
		var epoch = get_unix_time();
		this.second = epoch % 60;
		epoch = Math.floor(epoch / 60);
		this.minute = epoch % 60;
		epoch = Math.floor(epoch / 60);
		this.hour = (epoch + common.time_zone_local / 60) % 24;

		// some commonly used values
		this.second_past_hour = this.minute * 60 + this.second;
		this.quarter = Math.floor((this.hour * 3600 + this.second_past_hour) / (60 * 15));
	},

	"draw_hands": function(response) {
		var hour = this.hour;
		var minute = this.minute;
		var seconds = this.second;

		// put 12 at the top
		var degrees_hour = 360 * (hour + minute/60 + seconds/3600 + 12) / 24;
		var degrees_minute = this.second_past_hour * 360 / 3600;

		// pre-wrap the hour hand
		if (degrees_hour > 360)
			degrees_hour -= 360;

		// move the hands to an absolute position
		response.move = {
			h: degrees_hour,
			m: degrees_minute,
			is_relative: false,
		};
	},

	// 24 hours per rotation, with noon at the top (to match the real sky)
	"hour_coords": function(radius, hour) {
		return {
			x: 240/2 + radius * Math.sin(2 * Math.PI * hour / 24 + Math.PI),
			y: 240/2 - radius * Math.cos(2 * Math.PI * hour / 24 + Math.PI),
		};
	},

	// from wikipedia: https://en.wikipedia.org/wiki/Julian_day#Converting_Gregorian_calendar_date_to_Julian_Day_Number
	// all division is "round towards zero"
	"julian": function(Year,Month,Day) {
		var a = Math.floor((14 - Month) / 12)
		var y = Year + 4800 - a
		var m = Month + 12 * a - 3
		return Day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
	},

	"update_moon": function() {
		var jd = this.julian(common.year, common.month+1, common.date);

		// update the solar information; how to get the lat/lon?
		var lat = 52.3676;
		var lon = 4.9041;
		var alt = 0; // netherlands, right?
		var tz = common.time_zone_local;

		var sun = this.suncalc.getTimes(jd, lat, lon, alt);
		var moon = this.suncalc.getMoonTimes(jd, lat, lon);
		var phase = this.suncalc.getMoonIllumination(jd).phase;

		// call back into the library to get the moon position for the rise and set times
		this.lunar = {
			rise: this.suncalc.getMoonPosition(moon.rise, lat, lon),
			set: this.suncalc.getMoonPosition(moon.set, lat, lon),
		};

		// we have 24 lunar images, so scale the phase (0-1.0) and store the global
		this.moon_image = Math.floor(phase * 24);
		
		this.solar = {
			noon: (sun.solarNoon - jd) * 24 + tz/60,
			sunrise: (sun.sunrise - jd) * 24 + tz/60,
			sunset: (sun.sunset - jd) * 24 + tz/60,
			dawn: (sun.dawn - jd) * 24 + tz/60,
			dusk: (sun.dusk - jd) * 24 + tz/60,
			moonrise: (moon.rise - jd) * 24 + tz/60,
			moonset: (moon.set - jd) * 24 + tz/60,
		};
	},

	"draw_moon": function(response, full) {
		if (!this.solar)
			this.update_moon();

		var ymd = localization_snprintf("%04d-%02d-%02d",
			common.year, common.month+1, common.date);

		// put the markers on dawn and dusk, instead of sunrise/sunset
		var noon = this.hour_coords(108, this.solar.noon);
		var sunrise = this.hour_coords(112, this.solar.dawn);
		var sunset = this.hour_coords(112, this.solar.dusk);
		var moonrise = this.hour_coords(98, this.solar.moonrise);
		var moonset = this.hour_coords(98, this.solar.moonset);

		var hour_int = common.hour;
		var hour_str = localization_snprintf("%02d", hour_int);
		var hour = this.hour_coords(68, hour_int);

		var minute = common.minute;
		var hour2_int = -1;
		var hour2_str = "";
		var hour2 = hour;

		if (minute < 5)
		{
			hour2_int = (hour_int + 24 - 1) % 24;
			hour2 = this.hour_coords(72, hour2_int - 0.75);
		} else
		if (minute >= 40)
		{
			hour2_int = (hour_int + 1) % 24;
			hour2 = this.hour_coords(72, hour2_int + 0.75);
		}

		if (hour2_int != -1)
			hour2_str = localization_snprintf("%02d", hour2_int);

		// this assumes that sunrise and sunset are on opposite sides of the
		// watch face.  it would be easier if we had a line draw function...
		var leftcover_y = this.hour_coords(120, this.solar.sunrise).y;
		var rightcover_y = this.hour_coords(120, this.solar.sunset).y;

		response.draw = {
			"update_type": full ? 'du4' : 'gu4'
		};
		response.draw[this.node_name] = {
			layout_function: "layout_parser_json",
			layout_info: {
				json_file: 'moonphase_layout',
				moon_phase: 'moon_' + this.moon_image,

				// date, away from the hour hand
				date: ymd,
				date_y: common.hour > 18 || common.hour < 6 ? 40: 210,

				// hour hand label (attempt to center)
				hour: hour_str,
				hour_x: hour.x - 32/3,
				hour_y: hour.y - 32/2,

				// next or previous hour in a faint font
				hour2: hour2_str,
				hour2_x: hour2.x - 5,
				hour2_y: hour2.y - 10,

				// solar data
				sunrise_x: sunrise.x - 8,
				sunrise_y: sunrise.y - 8,
				sunset_x: sunset.x - 6,
				sunset_y: sunset.y - 8,
				noon_x: noon.x - 12,
				noon_y: noon.y - 12,

				moonrise_x: moonrise.x - 24/2,
				moonrise_y: moonrise.y - 24/2,
				moonset_x: moonset.x - 24/2,
				moonset_y: moonset.y - 24/2,

				// covers for the sunlight ring
				leftcover_y: leftcover_y,
				leftcover_h: 240 - leftcover_y,
				rightcover_y: rightcover_y,
				rightcover_h: 240 - rightcover_y,
			},
		};
	},

	"draw_text": function(response)
	{
		var ymd = localization_snprintf("%04d-%02d-%02d",
			common.year, common.month+1, common.date);
		var hms = localization_snprintf("%02d:%02d",
			common.hour, common.minute);

		var floor = Math.floor;
		var frac = function(x) { return floor(60*(x - floor(x))) };

		var sunrise = localization_snprintf("%02d:%02d",
			floor(this.solar.sunrise),
			frac(this.solar.sunrise));
		var sunset = localization_snprintf("%02d:%02d",
			floor(this.solar.sunset),
			frac(this.solar.sunset));
		var moonrise = localization_snprintf("%02d:%02d",
			floor(this.solar.moonrise),
			frac(this.solar.moonrise));
		var moonset = localization_snprintf("%02d:%02d",
			floor(this.solar.moonset),
			frac(this.solar.moonset));

		response.draw = {
			"update_type": 'gu4',
		};
		response.draw[this.node_name] = {
			layout_function: "layout_parser_json",
			layout_info: {
				json_file: 'text_layout',

				date: ymd,
				time: hms,
				sunrise: sunrise,
				sunset: sunset,
				moonrise: moonrise,
				moonset: moonset,
				//moonrise_heading: localization_snprintf("%.0f°", this.lunar.rise.azimuth * 180 / Math.PI ),
				//moonset_heading: localization_snprintf("%.0f°", this.lunar.set.azimuth * 180 / Math.PI ),
				moonrise_heading: this.heading_str(this.lunar.rise.azimuth),
				moonset_heading: this.heading_str(this.lunar.set.azimuth),
			},
		};
	},

	"heading_str": function(rad) {
		var deg = rad * 180 / Math.PI;
		if (deg < 0)
			deg += 360;
		if (deg > 360)
			deg -= 360;
		return localization_snprintf("%3d°", deg);
	},

	"draw_stopwatch": function(response) {
		this.stopwatch.force_redraw = false;

		var total = this.stopwatch.total;
		var ms = total % 1000;
		total = Math.floor(total / 1000);
		var sec = total % 60;
		total = Math.floor(total / 60);
		var min = total;
		
		var total_str = localization_snprintf("%02d:%02d.%03d", min, sec, ms);
		var mode_str = this.stopwatch.timing ? "RUN" : "PAUSED";

		response.draw = {
			"update_type": 'gu4',
		};
		response.draw[this.node_name] = {
			layout_function: "layout_parser_json",
			layout_info: {
				json_file: 'stopwatch_layout',

				total: total_str,
				total_color: this.stopwatch.timing ? 1 : 3,
				mode: mode_str,
				lap: "lap",
			},
		};
	},

/*
 (c) 2011-2015, Vladimir Agafonkin
 SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 https://github.com/mourner/suncalc

 Modified to not use the Javascript Date class since the Fossil SDK doesn't support it.
*/

	"suncalc":
(function () { 'use strict';

// shortcuts for easier to read formulas

var PI   = Math.PI,
    sin  = Math.sin,
    cos  = Math.cos,
    tan  = Math.tan,
    asin = Math.asin,
    atan = Math.atan2,
    acos = Math.acos,
    rad  = PI / 180;

// sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas


// date/time constants and conversions

var dayMs = 1000 * 60 * 60 * 24,
    J1970 = 2440588,
    J2000 = 2451545;

//function fromJulian(j)  { return (j + 0.5 - J1970) * dayMs; }
//function fromJulian(j)  { return (j + 0.5 - J1970); }
function fromJulian(j)  { return (j + 0.5 ); }
function toDays(date)   { return date - J2000; }


// general calculations for position

var e = rad * 23.4397; // obliquity of the Earth

function rightAscension(l, b) { return atan(sin(l) * cos(e) - tan(b) * sin(e), cos(l)); }
function declination(l, b)    { return asin(sin(b) * cos(e) + cos(b) * sin(e) * sin(l)); }

function azimuth(H, phi, dec)  { return atan(sin(H), cos(H) * sin(phi) - tan(dec) * cos(phi)); }
function altitude(H, phi, dec) { return asin(sin(phi) * sin(dec) + cos(phi) * cos(dec) * cos(H)); }

function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }

function astroRefraction(h) {
    if (h < 0) // the following formula works for positive altitudes only.
        h = 0; // if h = -0.08901179 a div/0 would occur.

    // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
    // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
}

// general sun calculations

function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }

function eclipticLongitude(M) {

    var C = rad * (1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M)), // equation of center
        P = rad * 102.9372; // perihelion of the Earth

    return M + C + P + PI;
}

function sunCoords(d) {

    var M = solarMeanAnomaly(d),
        L = eclipticLongitude(M);

    return {
        dec: declination(L, 0),
        ra: rightAscension(L, 0)
    };
}


var SunCalc = {};


// calculates sun position for a given Julian date and latitude/longitude

SunCalc.getPosition = function (date, lat, lng) {

    var lw  = rad * -lng,
        phi = rad * lat,
        d   = toDays(date),

        c  = sunCoords(d),
        H  = siderealTime(d, lw) - c.ra;

    return {
        azimuth: azimuth(H, phi, c.dec),
        altitude: altitude(H, phi, c.dec)
    };
};


// sun times configuration (angle, morning name, evening name)

var times = SunCalc.times = [
    [-0.833, 'sunrise',       'sunset'      ],
    [  -0.3, 'sunriseEnd',    'sunsetStart' ],
    [    -6, 'dawn',          'dusk'        ],
    [   -12, 'nauticalDawn',  'nauticalDusk'],
    [   -18, 'nightEnd',      'night'       ],
    [     6, 'goldenHourEnd', 'goldenHour'  ]
];

// adds a custom time to the times config

SunCalc.addTime = function (angle, riseName, setName) {
    times.push([angle, riseName, setName]);
};


// calculations for sun times

var J0 = 0.0009;

function julianCycle(d, lw) { return Math.round(d - J0 - lw / (2 * PI)); }

function approxTransit(Ht, lw, n) { return J0 + (Ht + lw) / (2 * PI) + n; }
function solarTransitJ(ds, M, L)  { return J2000 + ds + 0.0053 * sin(M) - 0.0069 * sin(2 * L); }

function hourAngle(h, phi, d) { return acos((sin(h) - sin(phi) * sin(d)) / (cos(phi) * cos(d))); }
function observerAngle(height) { return -2.076 * Math.sqrt(height) / 60; }

// returns set time for the given sun altitude
function getSetJ(h, lw, phi, dec, n, M, L) {

    var w = hourAngle(h, phi, dec),
        a = approxTransit(w, lw, n);
    return solarTransitJ(a, M, L);
}


// calculates sun times for a given Julian date, latitude/longitude, and, optionally,
// the observer height (in meters) relative to the horizon

SunCalc.getTimes = function (date, lat, lng, height) {

    height = height || 0;

    var lw = rad * -lng,
        phi = rad * lat,

        dh = observerAngle(height),

        d = toDays(date),
        n = julianCycle(d, lw),
        ds = approxTransit(0, lw, n),

        M = solarMeanAnomaly(ds),
        L = eclipticLongitude(M),
        dec = declination(L, 0),

        Jnoon = solarTransitJ(ds, M, L),

        i, len, time, h0, Jset, Jrise;


    var result = {
        solarNoon: fromJulian(Jnoon),
        nadir: fromJulian(Jnoon - 0.5)
    };

    for (i = 0, len = times.length; i < len; i += 1) {
        time = times[i];
        h0 = (time[0] + dh) * rad;

        Jset = getSetJ(h0, lw, phi, dec, n, M, L);
        Jrise = Jnoon - (Jset - Jnoon);

        result[time[1]] = fromJulian(Jrise);
        result[time[2]] = fromJulian(Jset);
    }

    return result;
};


// moon calculations, based on http://aa.quae.nl/en/reken/hemelpositie.html formulas

function moonCoords(d) { // geocentric ecliptic coordinates of the moon

    var L = rad * (218.316 + 13.176396 * d), // ecliptic longitude
        M = rad * (134.963 + 13.064993 * d), // mean anomaly
        F = rad * (93.272 + 13.229350 * d),  // mean distance

        l  = L + rad * 6.289 * sin(M), // longitude
        b  = rad * 5.128 * sin(F),     // latitude
        dt = 385001 - 20905 * cos(M);  // distance to the moon in km

    return {
        ra: rightAscension(l, b),
        dec: declination(l, b),
        dist: dt
    };
}

SunCalc.getMoonPosition = function (date, lat, lng) {

    var lw  = rad * -lng,
        phi = rad * lat,
        d   = toDays(date),

        c = moonCoords(d),
        H = siderealTime(d, lw) - c.ra,
        h = altitude(H, phi, c.dec),
        // formula 14.1 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
        pa = atan(sin(H), tan(phi) * cos(c.dec) - sin(c.dec) * cos(H));

    h = h + astroRefraction(h); // altitude correction for refraction

    return {
        azimuth: azimuth(H, phi, c.dec),
        altitude: h,
        distance: c.dist,
        parallacticAngle: pa
    };
};


// calculations for illumination parameters of the moon,
// based on http://idlastro.gsfc.nasa.gov/ftp/pro/astro/mphase.pro formulas and
// Chapter 48 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.

SunCalc.getMoonIllumination = function (date) {

    var d = toDays(date),
        s = sunCoords(d),
        m = moonCoords(d),

        sdist = 149598000, // distance from Earth to Sun in km

        phi = acos(sin(s.dec) * sin(m.dec) + cos(s.dec) * cos(m.dec) * cos(s.ra - m.ra)),
        inc = atan(sdist * sin(phi), m.dist - sdist * cos(phi)),
        angle = atan(cos(s.dec) * sin(s.ra - m.ra), sin(s.dec) * cos(m.dec) -
                cos(s.dec) * sin(m.dec) * cos(s.ra - m.ra));

    return {
        fraction: (1 + cos(inc)) / 2,
        phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
        angle: angle
    };
};


function hoursLater(date, h) {
    return date + h/24;
}

// calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article

SunCalc.getMoonTimes = function (date, lat, lng) {
    //var t = Math.floor(date); // midnight
    var t = date - 0.5; // julian weirdness

    var hc = 0.133 * rad,
        h0 = SunCalc.getMoonPosition(t, lat, lng).altitude - hc,
        h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx;

    // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
    for (var i = 1; i <= 24; i += 2) {
        h1 = SunCalc.getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
        h2 = SunCalc.getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;

        a = (h0 + h2) / 2 - h1;
        b = (h2 - h0) / 2;
        xe = -b / (2 * a);
        ye = (a * xe + b) * xe + h1;
        d = b * b - 4 * a * h1;
        roots = 0;

        if (d >= 0) {
            dx = Math.sqrt(d) / (Math.abs(a) * 2);
            x1 = xe - dx;
            x2 = xe + dx;
            if (Math.abs(x1) <= 1) roots++;
            if (Math.abs(x2) <= 1) roots++;
            if (x1 < -1) x1 = x2;
        }

        if (roots === 1) {
            if (h0 < 0) rise = i + x1;
            else set = i + x1;

        } else if (roots === 2) {
            rise = i + (ye < 0 ? x2 : x1);
            set = i + (ye < 0 ? x1 : x2);
        }

        if (rise && set) break;

        h0 = h2;
    }

    var result = {};

    if (rise) result.rise = hoursLater(date, rise);
    if (set) result.set = hoursLater(date, set);

    if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;

    return result;
};

return SunCalc;
}()),
};
