#ifndef _WINDOWS_
#define _WINDOWS_

/*
 * windows.h for VAMS Lab: the basic Windows types and Sleep, as Dev-C++ GLUT
 * labs use them. The sizes match 32-bit and 64-bit Windows: DWORD and LONG
 * are 32 bits. Like FreeGLUT's include of windows.h, it defines no min or
 * max macros.
 */

#ifndef WINAPI
#define WINAPI
#endif
#ifndef APIENTRY
#define APIENTRY
#endif
#ifndef CALLBACK
#define CALLBACK
#endif
#ifndef WINBASEAPI
#define WINBASEAPI extern
#endif

#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef int BOOL;
typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned long DWORD;
typedef int INT;
typedef unsigned int UINT;
typedef short SHORT;
typedef unsigned short USHORT;
typedef long LONG;
typedef unsigned long ULONG;
typedef char CHAR;
typedef unsigned char UCHAR;
typedef float FLOAT;
typedef char *LPSTR;
typedef const char *LPCSTR;
typedef void *LPVOID;
typedef const void *LPCVOID;

/* Pauses the program for the given number of milliseconds. */
WINBASEAPI void WINAPI Sleep(DWORD dwMilliseconds);

#ifdef __cplusplus
}
#endif

#endif /* _WINDOWS_ */
