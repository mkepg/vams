#ifndef __FREEGLUT_EXT_H__
#define __FREEGLUT_EXT_H__

/*
 * freeglut_ext.h for VAMS Lab: the FreeGLUT additions a 2D lab program uses.
 * Signatures and constants follow FreeGLUT's freeglut_ext.h.
 */

#include <GL/freeglut_std.h>

#ifdef __cplusplus
extern "C" {
#endif

/* glutSetOption(GLUT_ACTION_ON_WINDOW_CLOSE, ...) */
#define GLUT_ACTION_EXIT 0
#define GLUT_ACTION_GLUTMAINLOOP_RETURNS 1
#define GLUT_ACTION_CONTINUE_EXECUTION 2
#define GLUT_ACTION_ON_WINDOW_CLOSE 0x01F9

FGAPI void FGAPIENTRY glutLeaveMainLoop(void);
FGAPI void FGAPIENTRY glutMouseWheelFunc(void (*callback)(int, int, int, int));
FGAPI void FGAPIENTRY glutCloseFunc(void (*callback)(void));
FGAPI void FGAPIENTRY glutSetOption(GLenum option_flag, int value);
FGAPI int FGAPIENTRY glutBitmapHeight(void *font);
FGAPI void FGAPIENTRY glutBitmapString(void *font, const unsigned char *string);

#ifdef __cplusplus
}
#endif

#endif /* __FREEGLUT_EXT_H__ */
