// windows.h for the Lab: Sleep. The worker waits with Atomics.wait on a word nothing writes, so
// only the time ends the wait (library_vams.js). system("pause") and system("cls") are handled
// where libc's system() calls out, in library_vams.js.

#include <windows.h>

extern void vams_sleep(unsigned int ms);

void WINAPI Sleep(DWORD dwMilliseconds) { vams_sleep(dwMilliseconds); }
