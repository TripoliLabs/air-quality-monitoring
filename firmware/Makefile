# Host build for the portable firmware core (off-target runs + unit tests).
# On-target builds use PlatformIO/ESP-IDF (see platformio.ini).

CC ?= gcc
CFLAGS ?= -std=c11 -Wall -Wextra -O2 -Icore
BUILD := build

CORE := core/aq_payload.c core/aq_node.c

.PHONY: host test clean
host: $(BUILD)/aq-node-sim ## build the host node simulator binary

$(BUILD)/aq-node-sim: $(CORE) sim/sensors_sim.c sim/main.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

test: $(BUILD)/test_payload ## build + run the host unit tests
	./$(BUILD)/test_payload

$(BUILD)/test_payload: core/aq_payload.c test/test_payload.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

clean:
	rm -rf $(BUILD)
