// conio.h for the Lab: single keys from the Console. Each call waits on the Console in the
// worker (library_vams.js), as a console window waits on a lab PC; what the program printed
// before it is on the Console first.

#include <conio.h>

extern int vams_getch(void);
extern int vams_getche(void);
extern int vams_kbhit(void);

int getch(void) { return vams_getch(); }

int getche(void) { return vams_getche(); }

int kbhit(void) { return vams_kbhit(); }
