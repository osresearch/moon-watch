# Moonphase and 24-hour clock

![Moon phase watch in an early form](images/moonwatch.jpg)

This is an application to demonstrate a simple watch face with image drawing.

You will need to have built and installed `jerryscript-2.1.0` as well as the `Fossil-HR-SDK`.

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

* https://gml.noaa.gov/grad/solcalc/solareqns.PDF

## Notes

* If you want to reset the watch, hold down the middle button until it vibrates.
* Do *NOT* select "Reset and disconnect"; it will erase the watch menu and you'll have to re-pair with the factory app

