#ifndef __gl_h_
#define __gl_h_
#define __GL_H__

/*
 * gl.h for VAMS Lab: the OpenGL 1.5 calls and constants a 2D lab program
 * uses. GL/glu.h, GL/glut.h, GL/freeglut.h and GL/glew.h all include it, so
 * every program sees the same set. The buffer object calls a lab PC gets
 * through GLEW are declared here as ordinary functions.
 *
 * Signatures follow MinGW's GL/gl.h and GLEW 2.2's GL 1.5 entry points.
 */

#include <stddef.h>

#ifndef APIENTRY
#define APIENTRY
#endif
#ifndef WINGDIAPI
#define WINGDIAPI
#endif
#ifndef GLAPI
#define GLAPI extern
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef unsigned int GLenum;
typedef unsigned char GLboolean;
typedef unsigned int GLbitfield;
typedef signed char GLbyte;
typedef short GLshort;
typedef int GLint;
typedef int GLsizei;
typedef unsigned char GLubyte;
typedef unsigned short GLushort;
typedef unsigned int GLuint;
typedef float GLfloat;
typedef float GLclampf;
typedef double GLdouble;
typedef double GLclampd;
typedef void GLvoid;
typedef char GLchar;
typedef ptrdiff_t GLintptr;
typedef ptrdiff_t GLsizeiptr;

#define GL_VERSION_1_1 1
#define GL_VERSION_1_2 1
#define GL_VERSION_1_3 1
#define GL_VERSION_1_4 1
#define GL_VERSION_1_5 1

/* Booleans */
#define GL_FALSE 0
#define GL_TRUE 1

/* Data types */
#define GL_BYTE 0x1400
#define GL_UNSIGNED_BYTE 0x1401
#define GL_SHORT 0x1402
#define GL_UNSIGNED_SHORT 0x1403
#define GL_INT 0x1404
#define GL_UNSIGNED_INT 0x1405
#define GL_FLOAT 0x1406
#define GL_DOUBLE 0x140A

/* Primitives */
#define GL_POINTS 0x0000
#define GL_LINES 0x0001
#define GL_LINE_LOOP 0x0002
#define GL_LINE_STRIP 0x0003
#define GL_TRIANGLES 0x0004
#define GL_TRIANGLE_STRIP 0x0005
#define GL_TRIANGLE_FAN 0x0006
#define GL_QUADS 0x0007
#define GL_QUAD_STRIP 0x0008
#define GL_POLYGON 0x0009

/* glClear */
#define GL_COLOR_BUFFER_BIT 0x00004000
#define GL_DEPTH_BUFFER_BIT 0x00000100

/* Matrices */
#define GL_MODELVIEW 0x1700
#define GL_PROJECTION 0x1701

/* glEnable and glDisable */
#define GL_BLEND 0x0BE2
#define GL_LINE_STIPPLE 0x0B24
#define GL_TEXTURE_2D 0x0DE1
#define GL_SCISSOR_TEST 0x0C11

/* glBlendFunc */
#define GL_ZERO 0
#define GL_ONE 1
#define GL_SRC_COLOR 0x0300
#define GL_ONE_MINUS_SRC_COLOR 0x0301
#define GL_SRC_ALPHA 0x0302
#define GL_ONE_MINUS_SRC_ALPHA 0x0303
#define GL_DST_ALPHA 0x0304
#define GL_ONE_MINUS_DST_ALPHA 0x0305
#define GL_DST_COLOR 0x0306
#define GL_ONE_MINUS_DST_COLOR 0x0307

/* glShadeModel */
#define GL_FLAT 0x1D00
#define GL_SMOOTH 0x1D01

/* glPolygonMode */
#define GL_FRONT 0x0404
#define GL_BACK 0x0405
#define GL_FRONT_AND_BACK 0x0408
#define GL_POINT 0x1B00
#define GL_LINE 0x1B01
#define GL_FILL 0x1B02

/* Client-side arrays */
#define GL_VERTEX_ARRAY 0x8074
#define GL_COLOR_ARRAY 0x8076
#define GL_TEXTURE_COORD_ARRAY 0x8078

/* Textures */
#define GL_TEXTURE_MAG_FILTER 0x2800
#define GL_TEXTURE_MIN_FILTER 0x2801
#define GL_TEXTURE_WRAP_S 0x2802
#define GL_TEXTURE_WRAP_T 0x2803
#define GL_NEAREST 0x2600
#define GL_LINEAR 0x2601
#define GL_REPEAT 0x2901
#define GL_CLAMP 0x2900
#define GL_CLAMP_TO_EDGE 0x812F
#define GL_TEXTURE_ENV 0x2300
#define GL_TEXTURE_ENV_MODE 0x2200
#define GL_MODULATE 0x2100
#define GL_REPLACE 0x1E01
#define GL_DECAL 0x2101

/* Pixel formats */
#define GL_ALPHA 0x1906
#define GL_RGB 0x1907
#define GL_RGBA 0x1908
#define GL_LUMINANCE 0x1909
#define GL_LUMINANCE_ALPHA 0x190A
#define GL_BGR 0x80E0
#define GL_BGRA 0x80E1
#define GL_UNPACK_ALIGNMENT 0x0CF5

/* Display lists */
#define GL_COMPILE 0x1300
#define GL_COMPILE_AND_EXECUTE 0x1301

/* Buffer objects */
#define GL_ARRAY_BUFFER 0x8892
#define GL_ELEMENT_ARRAY_BUFFER 0x8893
#define GL_STREAM_DRAW 0x88E0
#define GL_STATIC_DRAW 0x88E4
#define GL_DYNAMIC_DRAW 0x88E8
#define GL_READ_ONLY 0x88B8
#define GL_WRITE_ONLY 0x88B9
#define GL_READ_WRITE 0x88BA

/* glGetError */
#define GL_NO_ERROR 0
#define GL_INVALID_ENUM 0x0500
#define GL_INVALID_VALUE 0x0501
#define GL_INVALID_OPERATION 0x0502
#define GL_STACK_OVERFLOW 0x0503
#define GL_STACK_UNDERFLOW 0x0504
#define GL_OUT_OF_MEMORY 0x0505

/* glGetString */
#define GL_VENDOR 0x1F00
#define GL_RENDERER 0x1F01
#define GL_VERSION 0x1F02
#define GL_EXTENSIONS 0x1F03

#define GL_NONE 0

/* Vertices and their attributes */
GLAPI void glBegin(GLenum mode);
GLAPI void glEnd(void);
GLAPI void glVertex2d(GLdouble x, GLdouble y);
GLAPI void glVertex2f(GLfloat x, GLfloat y);
GLAPI void glVertex2i(GLint x, GLint y);
GLAPI void glVertex2fv(const GLfloat *v);
GLAPI void glVertex3d(GLdouble x, GLdouble y, GLdouble z);
GLAPI void glVertex3f(GLfloat x, GLfloat y, GLfloat z);
GLAPI void glVertex3i(GLint x, GLint y, GLint z);
GLAPI void glVertex3fv(const GLfloat *v);
GLAPI void glColor3d(GLdouble red, GLdouble green, GLdouble blue);
GLAPI void glColor3f(GLfloat red, GLfloat green, GLfloat blue);
GLAPI void glColor3ub(GLubyte red, GLubyte green, GLubyte blue);
GLAPI void glColor3fv(const GLfloat *v);
GLAPI void glColor3ubv(const GLubyte *v);
GLAPI void glColor4d(GLdouble red, GLdouble green, GLdouble blue, GLdouble alpha);
GLAPI void glColor4f(GLfloat red, GLfloat green, GLfloat blue, GLfloat alpha);
GLAPI void glColor4ub(GLubyte red, GLubyte green, GLubyte blue, GLubyte alpha);
GLAPI void glColor4fv(const GLfloat *v);
GLAPI void glColor4ubv(const GLubyte *v);
GLAPI void glTexCoord2d(GLdouble s, GLdouble t);
GLAPI void glTexCoord2f(GLfloat s, GLfloat t);
GLAPI void glTexCoord2i(GLint s, GLint t);
GLAPI void glTexCoord2fv(const GLfloat *v);
GLAPI void glRasterPos2d(GLdouble x, GLdouble y);
GLAPI void glRasterPos2f(GLfloat x, GLfloat y);
GLAPI void glRasterPos2i(GLint x, GLint y);
GLAPI void glRasterPos3f(GLfloat x, GLfloat y, GLfloat z);
GLAPI void glRectd(GLdouble x1, GLdouble y1, GLdouble x2, GLdouble y2);
GLAPI void glRectf(GLfloat x1, GLfloat y1, GLfloat x2, GLfloat y2);
GLAPI void glRecti(GLint x1, GLint y1, GLint x2, GLint y2);

/* State */
GLAPI void glEnable(GLenum cap);
GLAPI void glDisable(GLenum cap);
GLAPI GLboolean glIsEnabled(GLenum cap);
GLAPI void glShadeModel(GLenum mode);
GLAPI void glPointSize(GLfloat size);
GLAPI void glLineWidth(GLfloat width);
GLAPI void glLineStipple(GLint factor, GLushort pattern);
GLAPI void glPolygonMode(GLenum face, GLenum mode);
GLAPI void glBlendFunc(GLenum sfactor, GLenum dfactor);
GLAPI void glPixelStorei(GLenum pname, GLint param);
GLAPI GLenum glGetError(void);
GLAPI const GLubyte *glGetString(GLenum name);

/* The frame */
GLAPI void glClear(GLbitfield mask);
GLAPI void glClearColor(GLclampf red, GLclampf green, GLclampf blue, GLclampf alpha);
GLAPI void glViewport(GLint x, GLint y, GLsizei width, GLsizei height);
GLAPI void glScissor(GLint x, GLint y, GLsizei width, GLsizei height);
GLAPI void glFlush(void);
GLAPI void glFinish(void);

/* Matrices */
GLAPI void glMatrixMode(GLenum mode);
GLAPI void glLoadIdentity(void);
GLAPI void glOrtho(GLdouble left, GLdouble right, GLdouble bottom, GLdouble top, GLdouble zNear, GLdouble zFar);
GLAPI void glPushMatrix(void);
GLAPI void glPopMatrix(void);
GLAPI void glTranslated(GLdouble x, GLdouble y, GLdouble z);
GLAPI void glTranslatef(GLfloat x, GLfloat y, GLfloat z);
GLAPI void glRotated(GLdouble angle, GLdouble x, GLdouble y, GLdouble z);
GLAPI void glRotatef(GLfloat angle, GLfloat x, GLfloat y, GLfloat z);
GLAPI void glScaled(GLdouble x, GLdouble y, GLdouble z);
GLAPI void glScalef(GLfloat x, GLfloat y, GLfloat z);
GLAPI void glLoadMatrixd(const GLdouble *m);
GLAPI void glLoadMatrixf(const GLfloat *m);
GLAPI void glMultMatrixd(const GLdouble *m);
GLAPI void glMultMatrixf(const GLfloat *m);

/* Client-side arrays */
GLAPI void glEnableClientState(GLenum array);
GLAPI void glDisableClientState(GLenum array);
GLAPI void glVertexPointer(GLint size, GLenum type, GLsizei stride, const GLvoid *pointer);
GLAPI void glColorPointer(GLint size, GLenum type, GLsizei stride, const GLvoid *pointer);
GLAPI void glTexCoordPointer(GLint size, GLenum type, GLsizei stride, const GLvoid *pointer);
GLAPI void glDrawArrays(GLenum mode, GLint first, GLsizei count);
GLAPI void glDrawElements(GLenum mode, GLsizei count, GLenum type, const GLvoid *indices);

/* Textures */
GLAPI void glGenTextures(GLsizei n, GLuint *textures);
GLAPI void glDeleteTextures(GLsizei n, const GLuint *textures);
GLAPI void glBindTexture(GLenum target, GLuint texture);
GLAPI void glTexImage2D(GLenum target, GLint level, GLint internalformat, GLsizei width, GLsizei height, GLint border, GLenum format, GLenum type, const GLvoid *pixels);
GLAPI void glTexParameterf(GLenum target, GLenum pname, GLfloat param);
GLAPI void glTexParameteri(GLenum target, GLenum pname, GLint param);
GLAPI void glTexEnvf(GLenum target, GLenum pname, GLfloat param);
GLAPI void glTexEnvi(GLenum target, GLenum pname, GLint param);

/* Display lists */
GLAPI GLuint glGenLists(GLsizei range);
GLAPI void glNewList(GLuint list, GLenum mode);
GLAPI void glEndList(void);
GLAPI void glCallList(GLuint list);
GLAPI void glDeleteLists(GLuint list, GLsizei range);

/* Buffer objects (OpenGL 1.5) */
GLAPI void glGenBuffers(GLsizei n, GLuint *buffers);
GLAPI void glDeleteBuffers(GLsizei n, const GLuint *buffers);
GLAPI void glBindBuffer(GLenum target, GLuint buffer);
GLAPI void glBufferData(GLenum target, GLsizeiptr size, const void *data, GLenum usage);
GLAPI void glBufferSubData(GLenum target, GLintptr offset, GLsizeiptr size, const void *data);
GLAPI void *glMapBuffer(GLenum target, GLenum access);
GLAPI GLboolean glUnmapBuffer(GLenum target);

#ifdef __cplusplus
}
#endif

#include <vams_rejected.h>

#endif /* __gl_h_ */
