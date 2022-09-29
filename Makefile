# Location for sunrise/sunset and moonrise/moonset
LAT ?= 52.3676
LON ?= 4.9041
ALT ?= 0.0000

JERRYSCRIPT_VERSION ?= 2.1.0
O ?= ./build
WATCH_SDK_PATH ?= $O/Fossil-HR-SDK
JERRYSCRIPT_PATH ?= $O/jerryscript-$(JERRYSCRIPT_VERSION)

json_file := app.json
source_file := app.js

identifier := $(shell cat $(json_file) | jq -r '.identifier')
snapshot_file := $O/files/code/${identifier}
tools_dir := $(WATCH_SDK_PATH)/tools
image_compress := $(tools_dir)/image_compress.py
pack := python3 $(tools_dir)/pack.py
snapshot := $(JERRYSCRIPT_PATH)/build/bin/jerry-snapshot

package_file := $O/${identifier}.wapp

adb_target := 192.168.0.192:5555
adb_target_dir := /sdcard/Download
adb_target_file := $(adb_target_dir)/$(notdir $(package_file))

.PHONY: all build compile pack push connect install clean

all: build push install
build: compile pack

icon_dir := $O/files/icons

define _icon
icons += $(icon_dir)/$1
$(icon_dir)/$1: $2 | $(image_compress)
	@mkdir -p $(icon_dir)
	python3 $(image_compress) -f rle -o $$@ -i $$< -w $3 -h $4
endef
define icon
$(eval $(call _icon,$(strip $1),$(strip $2),$3,$4))
endef

$(call icon, icHome, images/home.png, 14, 14)
$(call icon, !icon_lg, $O/time.png, 44, 44) # When selected
$(call icon, !icon_sm, images/moon.png, 44, 44) # Unselected in the menu
$(call icon, ring, images/ring.png, 240, 240)
$(call icon, sun, images/sun.png, 24, 24)
$(call icon, circle, images/circle.png, 16, 16)
$(call icon, moonrise, images/moonrise.png, 24, 24)
$(call icon, moonset, images/moonset.png, 24, 24)
$(call icon, moon_0, images/moon-0_0.png, 160, 160)
$(call icon, moon_1, images/moon-0_1.png, 160, 160)
$(call icon, moon_2, images/moon-0_2.png, 160, 160)
$(call icon, moon_3, images/moon-0_3.png, 160, 160)
$(call icon, moon_4, images/moon-1_0.png, 160, 160)
$(call icon, moon_5, images/moon-1_1.png, 160, 160)
$(call icon, moon_6, images/moon-1_2.png, 160, 160)
$(call icon, moon_7, images/moon-1_3.png, 160, 160)
$(call icon, moon_8, images/moon-2_0.png, 160, 160)
$(call icon, moon_9, images/moon-2_1.png, 160, 160)
$(call icon, moon_10, images/moon-2_2.png, 160, 160)
$(call icon, moon_11, images/moon-2_3.png, 160, 160)
$(call icon, moon_12, images/moon-3_0.png, 160, 160)
$(call icon, moon_13, images/moon-3_1.png, 160, 160)
$(call icon, moon_14, images/moon-3_2.png, 160, 160)
$(call icon, moon_15, images/moon-3_3.png, 160, 160)
$(call icon, moon_16, images/moon-4_0.png, 160, 160)
$(call icon, moon_17, images/moon-4_1.png, 160, 160)
$(call icon, moon_18, images/moon-4_2.png, 160, 160)
$(call icon, moon_19, images/moon-4_3.png, 160, 160)
$(call icon, moon_20, images/moon-5_0.png, 160, 160)
$(call icon, moon_21, images/moon-5_1.png, 160, 160)
$(call icon, moon_22, images/moon-5_2.png, 160, 160)
$(call icon, moon_23, images/moon-5_3.png, 160, 160)
$(call icon, curiosity, images/curiosity.png, 150, 150)
$(call icon, perseverance, images/perseverance.png, 150, 150)

layouts += moonphase_layout
layouts += text_layout
layouts += stopwatch_layout
layouts += mars_layout

compile: $(snapshot_file)

$O/files/layout/%: %.json
	@mkdir -p $(dir $@)
	cp $< $@
$O/app.json: $(json_file)
	@mkdir -p $(dir $@)
	cp $< $@
$O/files/display_name/display_name: $(json_file)
	@mkdir -p $(dir $@)
	jq -r '.display_name' $< > $@
$O/files/config:
	mkdir -p $@


build_files += $O/app.json
build_files += $O/files/display_name/display_name
build_files += $O/files/config
build_files += $(foreach L,$(layouts),$O/files/layout/$L)
build_files += $(icons)
build_files += $(snapshot_file)

# Generate a new icon every build so that it is easy to see if the upload worked
$O/time.png: $(source_file) $(filter-out $O/files/icons/!icon_lg,$(build_files))
	convert \
		-size 420x420 \
		-background black \
		-fill white \
		-gravity center \
		-pointsize 200 \
		label:'$(shell date "+%H\n%M")' \
		PNG32:$@


$(snapshot_file): $(source_file) $(json_file) | $(snapshot)
	@mkdir -p $(dir $@)
	$(snapshot) generate -f '' $< -o $@

$(package_file): $(build_files)
	$(pack) -i $O/ -o $@

pack: $(package_file)
push: $(package_file)
	adb shell mkdir -p $(adb_target_dir)
	adb push $< $(adb_target_file)

connect:
	adb connect ${adb_target}

install:
	adb shell am broadcast \
	-a "nodomain.freeyourgadget.gadgetbridge.Q_UPLOAD_FILE" \
	--es EXTRA_HANDLE APP_CODE \
	--es EXTRA_PATH "$(adb_target_file)" \
	--ez EXTRA_GENERATE_FILE_HEADER false


# note the extra quotes due to shell forwarding!
location:
	adb shell am broadcast \
	-a "nodomain.freeyourgadget.gadgetbridge.Q_PUSH_CONFIG" \
	--es EXTRA_CONFIG_JSON \
	\''{"push":{"set":{"stopwatchApp._.config.position":{"lat":$(LAT),"lon":$(LON),"alt":$(ALT)}}}}'\'


clean:
	rm -rf build

FORCE:

deps: $(snapshot) $(tools_dir)/pack.py
	pip3 install crc32c

$(image_compress):
	cd $O && git clone https://github.com/dakhnod/Fossil-HR-SDK

$O/jerryscript-$(JERRYSCRIPT_VERSION).tar.gz:
	wget -O $@ https://github.com/jerryscript-project/jerryscript/archive/refs/tags/v$(JERRYSCRIPT_VERSION).tar.gz
$(JERRYSCRIPT_PATH): $O/jerryscript-$(JERRYSCRIPT_VERSION).tar.gz
	tar zxf $< -C $O

$(snapshot): $(JERRYSCRIPT_PATH)
	cd $(JERRYSCRIPT_PATH) \
	&& python3 tools/build.py \
		--snapshot-exec=on \
		--jerry-cmdline-snapshot=on \
		--profile=es5.1 \
		--error-messages=on \
		--line-info=on \
		--logging=on

logs:
	adb logcat -e "Unhandled request from watch"
