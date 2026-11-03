// GL/glew.h for the Lab. The buffer object calls GLEW looks up on a lab PC are part of the Lab's
// GL already, so glewInit has nothing to find and succeeds. The strings are GLEW 2.2's.

#include <GL/glew.h>

GLboolean glewExperimental = GL_FALSE;

GLenum glewInit(void) { return GLEW_OK; }

const GLubyte *glewGetErrorString(GLenum error) {
  if (error == GLEW_OK) return (const GLubyte *)"No error";
  if (error == GLEW_ERROR_NO_GL_VERSION) return (const GLubyte *)"Missing GL version";
  return (const GLubyte *)"Unknown error";
}

const GLubyte *glewGetString(GLenum name) {
  return name == GLEW_VERSION ? (const GLubyte *)"2.2.0" : (const GLubyte *)0;
}
