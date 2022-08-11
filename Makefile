WATCH_SDK_PATH ?= ~/build/Fossil-HR-SDK/tools
JERRYSCRIPT_PATH ?= ~/build/Fossil-HR-SDK/jerryscript-2.1.0/build/bin/

json_file := app.json
source_file := app.js

identifier := $(shell cat $(json_file) | jq -r '.identifier')
snapshot_file := build/files/code/${identifier}
tools_dir := $(if $(WATCH_SDK_PATH),$(WATCH_SDK_PATH),../../tools)
image_compress := python3 $(tools_dir)/image_compress.py
pack := python3 $(tools_dir)/pack.py

package_file := build/${identifier}.wapp

adb_target := 192.168.0.192:5555
adb_target_dir := /sdcard/Download
adb_target_file := $(adb_target_dir)/$(notdir $(package_file))

.PHONY: all build compile pack push connect install clean

all: build push install
build: compile pack

icon_dir := build/files/icons

define _icon
icons += $(icon_dir)/$1
$(icon_dir)/$1: $2
	@mkdir -p $(icon_dir)
	$(image_compress) -f rle -o $$@ -i $$< -w $3 -h $4
endef
define icon
$(eval $(call _icon,$(strip $1),$(strip $2),$3,$4))
endef

$(call icon, icHome, home.png, 14, 14)
$(call icon, !icon_lg, time.png, 44, 44) # When selected
$(call icon, !icon_sm, moon.png, 44, 44) # Unselected in the menu

layouts += timer_layout

# Generate a new icon every build so that it is easy to see if the upload worked
time.png: $(source_file)
	convert \
		-size 420x420 \
		-background black \
		-fill white \
		-gravity center \
		-pointsize 200 \
		label:'$(shell date "+%H\n%M")' \
		PNG32:$@


compile: $(snapshot_file)

build/files/layout/%: %.json
	@mkdir -p $(dir $@)
	cp $< $@
build/app.json: $(json_file)
	@mkdir -p $(dir $@)
	cp $< $@
build/files/display_name/display_name: $(json_file)
	@mkdir -p $(dir $@)
	jq -r '.display_name' $< > $@
build/files/config:
	mkdir -p $@


build_files += build/app.json
build_files += build/files/display_name/display_name
build_files += build/files/config
build_files += $(foreach L,$(layouts),build/files/layout/$L)
build_files += $(icons)
build_files += $(snapshot_file)

$(snapshot_file): $(source_file) $(json_file)
	@mkdir -p $(dir $@)
	$(JERRYSCRIPT_PATH)jerry-snapshot generate -f '' $< -o $@

$(package_file): $(build_files)
	$(pack) -i build/ -o $@

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

clean:
	rm -rf build

FORCE:
