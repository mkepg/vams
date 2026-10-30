#ifndef __glew_h__
#define __glew_h__
#define __GLEW_H__

/*
 * glew.h for VAMS Lab. The buffer object calls GLEW finds in a lab PC's
 * driver are declared in GL/gl.h, so glewInit has nothing to look up and
 * returns GLEW_OK. Including it before or after GL/freeglut.h gives the same
 * set. Signatures follow GLEW 2.2's glew.h.
 */

#include <stdint.h>
#include <GL/gl.h>
#include <GL/glu.h>

#ifndef GLEWAPI
#define GLEWAPI extern
#endif
#ifndef GLEWAPIENTRY
#define GLEWAPIENTRY
#endif

#ifdef __cplusplus
extern "C" {
#endif

#define GLEW_OK 0
#define GLEW_NO_ERROR 0
#define GLEW_ERROR_NO_GL_VERSION 1
#define GLEW_VERSION 1

GLEWAPI GLboolean glewExperimental;

GLEWAPI GLenum GLEWAPIENTRY glewInit(void);
GLEWAPI const GLubyte *GLEWAPIENTRY glewGetErrorString(GLenum error);
GLEWAPI const GLubyte *GLEWAPIENTRY glewGetString(GLenum name);

#ifdef __cplusplus
}
#endif

#endif /* __glew_h__ */
