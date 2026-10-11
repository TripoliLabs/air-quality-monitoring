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

# Test vectors shared with the TypeScript codec; both suites must pass them.
VECTORS := ../packages/telemetry-codec/vectors

test: $(BUILD)/test_payload $(BUILD)/test_downlink $(BUILD)/test_sample $(BUILD)/test_vectors ## build + run the host unit tests
	./$(BUILD)/test_payload
	./$(BUILD)/test_downlink
	./$(BUILD)/test_sample
	./$(BUILD)/test_vectors $(VECTORS)

$(BUILD)/test_payload: core/aq_payload.c test/test_payload.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

$(BUILD)/test_downlink: core/aq_downlink.c test/test_downlink.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

$(BUILD)/test_vectors: core/aq_payload.c core/aq_downlink.c test/test_vectors.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

$(BUILD)/test_sample: core/aq_node.c test/test_sample.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $^ -lm -o $@

clean:
	rm -rf $(BUILD)
