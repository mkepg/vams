#ifndef __FREEGLUT_STD_H__
#define __FREEGLUT_STD_H__

/*
 * freeglut_std.h for VAMS Lab: the GLUT calls a 2D lab program uses.
 * Signatures, constants and the font handles follow FreeGLUT's
 * freeglut_std.h as a lab PC's MinGW sees it.
 */

/* A lab PC's FreeGLUT brings in windows.h, so Sleep needs no include of its own. */
#include <windows.h>
#include <GL/gl.h>
#include <GL/glu.h>
#include <stdlib.h>

#ifndef FGAPI
#define FGAPI extern
#endif
#ifndef FGAPIENTRY
#define FGAPIENTRY
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define FREEGLUT 1
#define GLUT_API_VERSION 4
#define FREEGLUT_VERSION_2_0 1

/* Special keys */
#define GLUT_KEY_F1 0x0001
#define GLUT_KEY_F2 0x0002
#define GLUT_KEY_F3 0x0003
#define GLUT_KEY_F4 0x0004
#define GLUT_KEY_F5 0x0005
#define GLUT_KEY_F6 0x0006
#define GLUT_KEY_F7 0x0007
#define GLUT_KEY_F8 0x0008
#define GLUT_KEY_F9 0x0009
#define GLUT_KEY_F10 0x000A
#define GLUT_KEY_F11 0x000B
#define GLUT_KEY_F12 0x000C
#define GLUT_KEY_LEFT 0x0064
#define GLUT_KEY_UP 0x0065
#define GLUT_KEY_RIGHT 0x0066
#define GLUT_KEY_DOWN 0x0067
#define GLUT_KEY_PAGE_UP 0x0068
#define GLUT_KEY_PAGE_DOWN 0x0069
#define GLUT_KEY_HOME 0x006A
#define GLUT_KEY_END 0x006B
#define GLUT_KEY_INSERT 0x006C

/* Mouse */
#define GLUT_LEFT_BUTTON 0x0000
#define GLUT_MIDDLE_BUTTON 0x0001
#define GLUT_RIGHT_BUTTON 0x0002
#define GLUT_DOWN 0x0000
#define GLUT_UP 0x0001

/* Display modes */
#define GLUT_RGB 0x0000
#define GLUT_RGBA 0x0000
#define GLUT_SINGLE 0x0000
#define GLUT_DOUBLE 0x0002
#define GLUT_ALPHA 0x0008
#define GLUT_DEPTH 0x0010
#define GLUT_STENCIL 0x0020
#define GLUT_MULTISAMPLE 0x0080

/* Bitmap fonts, as the constant handles FreeGLUT uses under MinGW */
#define GLUT_BITMAP_9_BY_15 ((void *)0x0002)
#define GLUT_BITMAP_8_BY_13 ((void *)0x0003)
#define GLUT_BITMAP_TIMES_ROMAN_10 ((void *)0x0004)
#define GLUT_BITMAP_TIMES_ROMAN_24 ((void *)0x0005)
#define GLUT_BITMAP_HELVETICA_10 ((void *)0x0006)
#define GLUT_BITMAP_HELVETICA_12 ((void *)0x0007)
#define GLUT_BITMAP_HELVETICA_18 ((void *)0x0008)

/* glutGet */
#define GLUT_WINDOW_X 0x0064
#define GLUT_WINDOW_Y 0x0065
#define GLUT_WINDOW_WIDTH 0x0066
#define GLUT_WINDOW_HEIGHT 0x0067
#define GLUT_SCREEN_WIDTH 0x00C8
#define GLUT_SCREEN_HEIGHT 0x00C9
#define GLUT_INIT_WINDOW_X 0x01F4
#define GLUT_INIT_WINDOW_Y 0x01F5
#define GLUT_INIT_WINDOW_WIDTH 0x01F6
#define GLUT_INIT_WINDOW_HEIGHT 0x01F7
#define GLUT_ELAPSED_TIME 0x02BC

/* glutGetModifiers */
#define GLUT_ACTIVE_SHIFT 0x0001
#define GLUT_ACTIVE_CTRL 0x0002
#define GLUT_ACTIVE_ALT 0x0004

/* Starting up */
FGAPI void FGAPIENTRY glutInit(int *pargc, char **argv);
FGAPI void FGAPIENTRY glutInitWindowPosition(int x, int y);
FGAPI void FGAPIENTRY glutInitWindowSize(int width, int height);
FGAPI void FGAPIENTRY glutInitDisplayMode(unsigned int displayMode);
FGAPI void FGAPIENTRY glutMainLoop(void);

/* The window */
FGAPI int FGAPIENTRY glutCreateWindow(const char *title);
FGAPI void FGAPIENTRY glutDestroyWindow(int window);
FGAPI int FGAPIENTRY glutGetWindow(void);
FGAPI void FGAPIENTRY glutSetWindowTitle(const char *title);
FGAPI void FGAPIENTRY glutReshapeWindow(int width, int height);
FGAPI void FGAPIENTRY glutPositionWindow(int x, int y);
FGAPI void FGAPIENTRY glutFullScreen(void);
FGAPI void FGAPIENTRY glutPostRedisplay(void);
FGAPI void FGAPIENTRY glutSwapBuffers(void);

/* Right-click menus */
FGAPI int FGAPIENTRY glutCreateMenu(void (*callback)(int menu));
FGAPI void FGAPIENTRY glutDestroyMenu(int menu);
FGAPI void FGAPIENTRY glutAddMenuEntry(const char *label, int value);
FGAPI void FGAPIENTRY glutAddSubMenu(const char *label, int subMenu);
FGAPI void FGAPIENTRY glutAttachMenu(int button);
FGAPI void FGAPIENTRY glutDetachMenu(int button);

/* Callbacks */
FGAPI void FGAPIENTRY glutTimerFunc(unsigned int time, void (*callback)(int), int value);
FGAPI void FGAPIENTRY glutIdleFunc(void (*callback)(void));
FGAPI void FGAPIENTRY glutDisplayFunc(void (*callback)(void));
FGAPI void FGAPIENTRY glutReshapeFunc(void (*callback)(int, int));
FGAPI void FGAPIENTRY glutKeyboardFunc(void (*callback)(unsigned char, int, int));
FGAPI void FGAPIENTRY glutKeyboardUpFunc(void (*callback)(unsigned char, int, int));
FGAPI void FGAPIENTRY glutSpecialFunc(void (*callback)(int, int, int));
FGAPI void FGAPIENTRY glutSpecialUpFunc(void (*callback)(int, int, int));
FGAPI void FGAPIENTRY glutMouseFunc(void (*callback)(int, int, int, int));
FGAPI void FGAPIENTRY glutMotionFunc(void (*callback)(int, int));
FGAPI void FGAPIENTRY glutPassiveMotionFunc(void (*callback)(int, int));

/* State */
FGAPI int FGAPIENTRY glutGet(GLenum query);
FGAPI int FGAPIENTRY glutGetModifiers(void);

/* Bitmap text */
FGAPI void FGAPIENTRY glutBitmapCharacter(void *font, int character);
FGAPI int FGAPIENTRY glutBitmapWidth(void *font, int character);
FGAPI int FGAPIENTRY glutBitmapLength(void *font, const unsigned char *string);

#ifdef __cplusplus
}
#endif

#endif /* __FREEGLUT_STD_H__ */
