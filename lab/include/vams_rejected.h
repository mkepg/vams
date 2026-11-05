#ifndef VAMS_REJECTED_H
#define VAMS_REJECTED_H

/*
 * Names a lab PC's headers declare that VAMS Lab's 2D set leaves out. Each one
 * is declared unavailable, so a call stops the build on its line with a
 * message naming what to use instead. Constants outside the set, such as
 * GL_LIGHTING, are simply not declared.
 */

#define VAMS_REJECT_MESSAGE(name, use) #name " isn't part of VAMS Lab's OpenGL. Use " use "."

#ifdef __cplusplus
#define VAMS_REJECT(name, use) extern "C" void name(...) __attribute__((unavailable(VAMS_REJECT_MESSAGE(name, use))));
#else
#define VAMS_REJECT(name, use) void name() __attribute__((unavailable(VAMS_REJECT_MESSAGE(name, use))));
#endif

/* Projection and the camera */
VAMS_REJECT(gluPerspective, "glOrtho or gluOrtho2D")
VAMS_REJECT(glFrustum, "glOrtho or gluOrtho2D")
VAMS_REJECT(gluLookAt, "glTranslatef and glRotatef")

/* Lights and materials */
VAMS_REJECT(glLightf, "glColor3f or glColor4f")
VAMS_REJECT(glLightfv, "glColor3f or glColor4f")
VAMS_REJECT(glLighti, "glColor3f or glColor4f")
VAMS_REJECT(glLightiv, "glColor3f or glColor4f")
VAMS_REJECT(glLightModelf, "glColor3f or glColor4f")
VAMS_REJECT(glLightModelfv, "glColor3f or glColor4f")
VAMS_REJECT(glLightModeli, "glColor3f or glColor4f")
VAMS_REJECT(glLightModeliv, "glColor3f or glColor4f")
VAMS_REJECT(glMaterialf, "glColor3f or glColor4f")
VAMS_REJECT(glMaterialfv, "glColor3f or glColor4f")
VAMS_REJECT(glMateriali, "glColor3f or glColor4f")
VAMS_REJECT(glMaterialiv, "glColor3f or glColor4f")
VAMS_REJECT(glColorMaterial, "glColor3f or glColor4f")

/* Normals */
VAMS_REJECT(glNormal3d, "glColor3f on each vertex")
VAMS_REJECT(glNormal3f, "glColor3f on each vertex")
VAMS_REJECT(glNormal3fv, "glColor3f on each vertex")
VAMS_REJECT(glNormalPointer, "glColorPointer")

/* GLUT's shapes, from freeglut_std.h */
VAMS_REJECT(glutSolidCube, "glRectf or glBegin(GL_QUADS)")
VAMS_REJECT(glutWireCube, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidSphere, "glBegin(GL_TRIANGLE_FAN) with cosf and sinf")
VAMS_REJECT(glutWireSphere, "glBegin(GL_LINE_LOOP) with cosf and sinf")
VAMS_REJECT(glutSolidCone, "glBegin(GL_TRIANGLES)")
VAMS_REJECT(glutWireCone, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidTorus, "glBegin(GL_QUAD_STRIP) with cosf and sinf")
VAMS_REJECT(glutWireTorus, "glBegin(GL_LINE_LOOP) with cosf and sinf")
VAMS_REJECT(glutSolidDodecahedron, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireDodecahedron, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidOctahedron, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireOctahedron, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidTetrahedron, "glBegin(GL_TRIANGLES)")
VAMS_REJECT(glutWireTetrahedron, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidIcosahedron, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireIcosahedron, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidTeapot, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireTeapot, "glBegin(GL_LINE_LOOP)")

/* GLUT's shapes, from freeglut_ext.h */
VAMS_REJECT(glutSolidRhombicDodecahedron, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireRhombicDodecahedron, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidSierpinskiSponge, "glBegin(GL_TRIANGLES)")
VAMS_REJECT(glutWireSierpinskiSponge, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidCylinder, "glRectf or glBegin(GL_QUADS)")
VAMS_REJECT(glutWireCylinder, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidTeacup, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireTeacup, "glBegin(GL_LINE_LOOP)")
VAMS_REJECT(glutSolidTeaspoon, "glBegin(GL_POLYGON)")
VAMS_REJECT(glutWireTeaspoon, "glBegin(GL_LINE_LOOP)")

#endif /* VAMS_REJECTED_H */
