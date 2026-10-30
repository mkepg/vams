#ifndef _INC_CONIO
#define _INC_CONIO

/*
 * conio.h for VAMS Lab: reading single keys from the Console, as Dev-C++ labs
 * do. getch and getche wait for a key; getche also echoes it. kbhit says
 * whether a key is waiting. Signatures follow MinGW's conio.h.
 */

#ifndef CONIOAPI
#define CONIOAPI extern
#endif

#ifdef __cplusplus
extern "C" {
#endif

CONIOAPI int getch(void);
CONIOAPI int getche(void);
CONIOAPI int kbhit(void);

#define _getch getch
#define _getche getche
#define _kbhit kbhit

#ifdef __cplusplus
}
#endif

#endif /* _INC_CONIO */
