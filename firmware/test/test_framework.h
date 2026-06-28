#ifndef TEST_FRAMEWORK_H
#define TEST_FRAMEWORK_H

/* Minimal Unity-compatible host test harness. On-target tests use PlatformIO +
 * Unity (`pio test`); these run the portable core on the host via gcc. */
#include <stdio.h>

static int tf_assertions = 0;
static int tf_failed = 0;

#define TEST_ASSERT(cond)                                                      \
    do {                                                                       \
        tf_assertions++;                                                       \
        if (!(cond)) {                                                         \
            tf_failed++;                                                       \
            printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);           \
        }                                                                      \
    } while (0)

#define TEST_ASSERT_EQUAL_UINT(expected, actual)                               \
    do {                                                                       \
        tf_assertions++;                                                       \
        unsigned long _e = (unsigned long)(expected);                          \
        unsigned long _a = (unsigned long)(actual);                            \
        if (_e != _a) {                                                        \
            tf_failed++;                                                       \
            printf("  FAIL %s:%d: expected %lu, got %lu\n", __FILE__, __LINE__, \
                   _e, _a);                                                    \
        }                                                                      \
    } while (0)

#define RUN_TEST(fn)                                                           \
    do {                                                                       \
        printf("- %s\n", #fn);                                                 \
        fn();                                                                  \
    } while (0)

#define TEST_SUMMARY()                                                         \
    do {                                                                       \
        printf("\n%d assertions, %d failed\n", tf_assertions, tf_failed);      \
        return tf_failed ? 1 : 0;                                              \
    } while (0)

#endif /* TEST_FRAMEWORK_H */
