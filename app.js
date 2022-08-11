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
			state_machine.d(event.le === 'visible' ? 'draw_hands' : 'background');
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

				// schedule to redraw at the start of the next hour
				var delay = (60 - common.minute) * 60 * 1000;
				start_timer(self.node_name, 'timer_tick', delay);

				self.draw_hands(response);
				self.draw_moon(response);
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
		},
	},

	"draw_hands": function(response) {
		var hour = common.hour;
		var minute = common.minute;
		//var minute = (now() % 60000) / 1000; // actually seconds
		var degrees_hour = 360 * hour / 24;
		var degrees_minute = 360 * minute / 60;

		// move the hands to an absolute position
		response.move = {
			h: degrees_hour,
			m: degrees_minute,
			is_relative: false,
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
	"draw_moon": function(response) {
		var ymd = localization_snprintf("%04d-%02d-%02d",
			common.year, common.month+1, common.date);

		var jd = this.julian(common.year, common.month+1, common.date);
		var newmoon = this.julian(1900, 1, 1);
		var delta = jd - newmoon;
		var lunar_len = 29.53059;
		var lunar_month = Math.floor(delta / lunar_len);
		var lunar_day = delta - (lunar_month * lunar_len);

		// we have 24 lunar images instead of 29, so scale it
		var moon_image = Math.floor(lunar_day * 24 / lunar_len);

		// update the hour hand position
		var hour = common.hour;
		var hour_str = localization_snprintf("%02d", hour);
		var hour_x = 240/2 + 110 * Math.sin(2 * Math.PI * hour / 24);
		var hour_y = 240/2 - 110 * Math.cos(2 * Math.PI * hour / 24);

		response.draw = {
			"update_type": 'du4', // full.	gu4 == partial
		};
		response.draw[this.node_name] = {
			layout_function: "layout_parser_json",
			layout_info: {
				json_file: 'timer_layout',
				moon_phase: 'moon_' + moon_image,
				// date, away from the hour hand
				date: ymd,
				date_y: common.hour > 18 || common.hour < 6 ? 210 : 40,

				// hour hand label
				hour: hour_str,
				hour_x: hour_x,
				hour_y: hour_y,
			},
		};
	},
};
