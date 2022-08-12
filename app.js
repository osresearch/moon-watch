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
				enable_time_telling();
				start_timer(self.node_name, 'timer_tick', 100);

			},
			"exit": function(self,state_machine,event,response) {
				stop_timer(self.node_name, 'timer_tick');
			},
			"timer_expired": function(self,state_machine,event,response) {
				if (!is_this_timer_expired(event, self.node_name, 'timer_tick'))
					return;

				self.update_moon();
				self.draw_moon(response);
				self.draw_hands(response, true);

				// schedule to redraw at the start of the next hour
				var delay = (60 - common.minute) * 60 * 1000;
				start_timer(self.node_name, 'timer_tick', delay);

			},

			// called every 20 seconds or so to update the hands
			"time_telling_update": function(self,state_machine,event,response) {
				self.draw_hands(response);
			},

			"middle_short_press_release": function(self,sm,event,response) {
				response.action = {
					type: 'go_back',
					Se: true, // kill the app
				};
			},
			"top_press": function(self,state_machine,event,response) {
				// move the hands a bit
				response.move = {
					h: 10,
					m: -3,
					is_relative: true,
				};
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
				sm.new_state('animate_moon');
			},
		},

		"animate_moon": {
			// start the animation counter and reset the timer
			"entry": function(self,sm,event,response) {
				self.animation_steps = 24 * 3;
				start_timer(self.node_name, 'timer_tick', 100);
			},
			"timer_expired": function(self,sm,event,response) {
				if (self.animation_steps-- == 0)
				{
					sm.new_state('draw_hands');
					return;
				}

				start_timer(self.node_name, 'timer_tick', 80);

				if ((self.animation_steps % 3) == 2)
				{
					self.moon_image = (self.moon_image + 1) % 24;
					self.draw_moon(response, false);
				}

				response.move = {
					h: 60,
					m: -60,
					is_relative: true,
				};

			},
			"flick_away": function(self,sm,event,response) {
				// stop the animation and return to normal
				self.animation_steps = 0;
			},
		},
	},

	"draw_hands": function(response) {
		var hour = common.hour;
		var minute = common.minute;

		// put 12 at the top
		var degrees_hour = 360 * (hour + minute/60 + 12) / 24;
		var degrees_minute = 360 * minute / 60;

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

	// from https://www.hermetic.ch/cal_stud/jdn.htm
	"julian": function(y,m,d) {
		var m14 = Math.floor((m-14)/12);
		return  Math.floor( 1461 * ( y + 4800 + m14 ) / 4) +
			Math.floor(  367 * ( m - 2 - 12 * m14 ) / 12) -
			Math.floor(    3 * Math.floor((y + 4900 + m14) / 100) / 4) +
			d - 32075;
	},

/*
 * The approximate age of the Moon, and hence the approximate phase, can be
 * calculated for any date by calculating the number of days since a known
 * new moon (such as January 1, 1900 or August 11, 1999) and reducing this
 * modulo 29.53059 days (the mean length of a synodic month).[6][e] The
 * difference between two dates can be calculated by subtracting the Julian
 * day number of one from that of the other, or there are simpler formulae
 * giving (for instance) the number of days since December 31, 1899.
 */
	"update_moon": function() {
		var jd = this.julian(common.year, common.month+1, common.date);
		var newmoon = this.julian(1900, 1, 1);
		var delta = jd - newmoon;
		var lunar_month_len = 29.53059;
		var lunar_month = Math.floor(delta / lunar_month_len);
		var lunar_day = delta - (lunar_month * lunar_month_len);

		// we have 24 lunar images instead of 29, so scale it and store the global
		this.moon_image = Math.floor(lunar_day * 24 / lunar_month_len);

		// update the solar information; how to get the lat/lon?
		var lat = 52.3676;
		var lon = 4.9041;
		var tz = common.time_zone_local;
		var hour_frac = common.hour + common.minute / 60;

		this.solar = this.solar_noon(
			common.year,
			common.month+1,
			common.date,
			hour_frac,
			lat,
			lon,
			tz
		);
	},

	"draw_moon": function(response, full) {
		if (!this.solar)
			this.update_moon();

		var ymd = localization_snprintf("%04d-%02d-%02d",
			common.year, common.month+1, common.date);

		var sunrise = this.hour_coords(110, this.solar.sunrise);
		var noon = this.hour_coords(105, this.solar.noon);
		var sunset = this.hour_coords(110, this.solar.sunset);

		var hour_int = common.hour;
		var hour_str = localization_snprintf("%02d", hour_int);
		var hour = this.hour_coords(90, hour_int);

		response.draw = {
			"update_type": full ? 'gu4' : 'du4'
		};
		response.draw[this.node_name] = {
			layout_function: "layout_parser_json",
			layout_info: {
				json_file: 'timer_layout',
				moon_phase: 'moon_' + this.moon_image,

				// date, away from the hour hand
				date: ymd,
				date_y: common.hour > 18 || common.hour < 6 ? 40: 210,

				// hour hand label
				hour: hour_str,
				hour_x: hour.x - 20,
				hour_y: hour.y - 10,

				// solar data
				sunrise_x: sunrise.x - 5,
				sunrise_y: sunrise.y - 5,
				sunset_x: sunset.x - 5,
				sunset_y: sunset.y - 5,
				noon_x: noon.x - 8,
				noon_y: noon.y - 8,
			},
		};
	},

	"leap_year": function(y)
	{
		if (y % 4 != 0)
			return false;
		if (y % 400 == 0)
			return true;
		return y % 100 != 0;
	},
		
/* General solar position calculations https://gml.noaa.gov/grad/solcalc/solareqns.PDF */
	"solar_noon": function(y,m,d,hour,lat,lon,tz) {
		var lat_rad = lat * Math.PI / 180;
		var lon_rad = lon * Math.PI / 180;

		var day_of_year = this.julian(y,m,d) - this.julian(y,1,1);
		var days_in_year = this.leap_year(y) ? 366 : 365;
		var frac_year = 2 * Math.PI / days_in_year * (day_of_year - 1 + (hour - 12) / 24);

		// estimate equation of time in minutes
		var eqtime = 229.18*(
			+ 0.000075
			+ 0.001868*Math.cos(frac_year)
			- 0.032077*Math.sin(frac_year)
			- 0.014615*Math.cos(2*frac_year)
			- 0.040849*Math.sin(2*frac_year)
		);

		// estimate of solar declination angle (radians)
		var decl = (
			+ 0.006918
			- 0.399912*Math.cos(frac_year)
			+ 0.070257*Math.sin(frac_year)
			- 0.006758*Math.cos(2*frac_year)
			+ 0.000907*Math.sin(2*frac_year)
			- 0.002697*Math.cos(3*frac_year)
			+ 0.001480*Math.sin(3*frac_year)
		);

		// approximate correction for atmospheric refraction
		// and the size of the solar disk
		var zenith = 90.833 * Math.PI / 180;

		// hour angle (in deg) for the given zenith angle (in radians)
		var ha = Math.acos(
			Math.cos(zenith) / (Math.cos(lat_rad) * Math.cos(decl))
			- Math.tan(lat_rad) * Math.tan(decl)
		) * 180 / Math.PI;

		// estimate the minute of sunrise, noon and sunset based on the hour angle
		var sunrise_utc = 720 - 4 * (lon + ha) - eqtime;
		var sunset_utc = 720 - 4 * (lon - ha) - eqtime;
		var noon_utc = 720 - 4 * lon - eqtime;

		// convert it to a fractional hour of local time
		return {
			sunrise: (sunrise_utc + tz) / 60,
			noon: (noon_utc + tz) / 60,
			sunset: (sunset_utc + tz) / 60,
		};
	},
};
