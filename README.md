# Moonphase and 24-hour clock

![Moon phase watch in an early form](images/moonwatch.jpg)

This is an application for the Skagen/Fossil Hybrid watch to demonstrate
a moderately complicated watch face with image drawing
and some practical functions.  It's been tested on the Skagen Gen 6,
sold in some markets as the SKT3200 (metal band) or SKT3201 (brown band).

The watch shows several celestial datapoints:

* the hour hand rotates once per day, with noon at the top
* the current hour is prominently displayed near the hour hand
* the current phase of the moon is large in the center
* the local dawn and dusk times are marked with small circles
* the local solar noon has a small sun icon
* the daylight hours between sunrise and sunset have an arc along the outside
* there are grid bars every to help estimate daylight remaining
* the upcoming moon rise and set times are marked with small icons

The middle button cycles through the modes:

* Moon phase
* Stop watch (top button to start and stop, bottom button to reset)
* Numeric display of solar and lunar event times and headings


## Building

```
sudo apt install jq
make deps
```

This will built [`jerryscript-2.1.0`](https://github.com/jerryscript-project/jerryscript/releases/tag/v2.1.0) (newer versions don't work?),
with options to enable line-number errors when compiling
(otherwise it only outputs "`Syntax error`" with no information about
where).

it will also download the current head of the [Fossil-HR-SDK](https://github.com/dakhnod/Fossil-HR-SDK/blob/main/DOCUMENTATION.md),
which has the tools to build and pack the `wapp` files to install via [GadgetBridge](https://gadgetbridge.org/).  As of 2022-08-12, the gen6 support is not yet in mainline, so you will need to build
with [PR#2775](https://codeberg.org/Freeyourgadget/Gadgetbridge/pulls/2775) to detect the newer watches.
Also note that there are [special paring instructions for the Fossil/Skagen HR](https://codeberg.org/Freeyourgadget/Gadgetbridge/wiki/Fossil-Hybrid-HR)
that require an authorization key to be retrieved from the OEM's servers.

If these are installed and your watch paired, you *should* be able to run
`make` and have it build the `build/stopwatchApp.wapp` file and use `adb`
to push it to your Android phone running GadgetBridge, which *should*
install it to the watch.  There's lots of issues here, so it might
require some hacking or manual steps. Sorry, I haven't figured out how to
do this reliably yet either.


## Images

![Moon phases](images/moonphases.png)

```
convert \
	moonphases.png \
	-crop 160x160 \
	-set filename:tile \
	"%[fx:page.x/160]_%[fx:page.y/160*-1+3]" \
	+repage \
	-rotate 90 \
	PNG32:"images/moon-%[filename:tile].png"
```

## Celestial math

The sunrise / sunset and moon rise / set / phase calculations are using [suncalc.js](https://github.com/mourner/suncalc), modified to not use any of the Javascript `Date` class, since the SDK doesn't include it.

## Notes

If you want to reset the watch, hold down the middle button until it vibrates.
**Do *NOT* select "Reset and disconnect"**; it will erase the watch menu and you'll have to re-pair with the factory app

The moon rise / set icons are not very good.  It would be nice to also have the moon heading.
