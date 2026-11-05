#ifndef __glu_h__
#define __glu_h__
#define __GLU_H__

/*
 * glu.h for VAMS Lab: the GLU calls a 2D lab program uses.
 * Signatures follow MinGW's GL/glu.h.
 */

#include <GL/gl.h>

#ifndef GLUAPI
#define GLUAPI extern
#endif

#ifdef __cplusplus
extern "C" {
#endif

GLUAPI void gluOrtho2D(GLdouble left, GLdouble right, GLdouble bottom, GLdouble top);
GLUAPI const GLubyte *gluErrorString(GLenum errCode);

#ifdef __cplusplus
}
#endif

#endif /* __glu_h__ */
