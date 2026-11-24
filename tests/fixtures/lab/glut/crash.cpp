// How a program ends when it goes wrong, case by case: reads a case's name from standard input and
// runs it, so what a lab PC prints and the exit code it gives can be recorded and compared with the
// Lab's. A case that returns prints "after", then main returns 0.
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>
#include <stdexcept>
#ifndef __EMSCRIPTEN__
#include <windows.h>
#endif

static volatile int zero = 0;
static volatile size_t huge = 0x7fff0000;
static char* volatile kept;

// Calls itself without end, a kilobyte of stack each time.
static int deeper(int n) {
    volatile char pad[1024];
    pad[n % 1024] = (char)n;
    return deeper(n + 1) + pad[0];
}

// 1.5 MB of local array: within the 2 MB stack a lab PC's program has.
static int bigLocal() {
    int big[384 * 1024];
    for (int i = 0; i < 384 * 1024; i++) big[i] = i % 7;
    int sum = 0;
    for (int i = 0; i < 384 * 1024; i += 1024) sum += big[i];
    return sum;
}

struct Case {
    const char* name;
    void (*run)();
};

static const Case cases[] = {
    { "exit-code", [] { exit(7); } },
    { "throw-runtime-error", [] { throw std::runtime_error("the file is missing"); } },
    { "throw-int", [] { throw 42; } },
    { "new-too-big", [] { kept = new char[huge]; printf("got %d\n", kept != nullptr); } },
    { "new-caught", [] {
        try { kept = new char[huge]; } catch (std::bad_alloc& e) { printf("caught %s\n", e.what()); }
    } },
    { "malloc-too-big", [] { kept = (char*)malloc(huge); printf("malloc %s\n", kept ? "gave memory" : "gave NULL"); } },
    { "abort", [] { abort(); } },
    { "divide-by-zero", [] { int total = 100; printf("%d\n", total / zero); } },
    { "far-pointer", [] { *(volatile int*)0xF0000000u = 1; } },
    { "endless-recursion", [] { printf("%d\n", deeper(0)); } },
    { "big-local-array", [] { printf("sum %d\n", bigLocal()); } },
};

int main()
{
#ifndef __EMSCRIPTEN__
    // No Windows error report box: the recording runs unattended.
    SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
#endif
    setvbuf(stdout, nullptr, _IONBF, 0);
    char name[64] = "";
    if (scanf("%63s", name) != 1) return 2;
    for (const Case& c : cases) {
        if (strcmp(c.name, name)) continue;
        printf("start\n");
        c.run();
        printf("after\n");
        return 0;
    }
    printf("no case %s\n", name);
    return 2;
}
