// Lab reference capture: compiled into a battery program with capture-pre.h. A frame ends at
// glutSwapBuffers, or at glFlush in a GLUT_SINGLE window. At frame VAMS_CAPTURE_FRAME (default 1)
// it writes the frame's buffer (width, height, sample count, then bottom-up RGBA rows) to
// VAMS_CAPTURE_OUT and exits.
#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cstdio>
#include <cstdlib>
#include <vector>
#undef glutSwapBuffers
#undef glFlush

// No particular GPU is asked for, so a laptop with switchable graphics runs the program on its
// integrated Intel GPU, the reference.

// The sample positions of a multisampled window, as the recorders check them against Intel's.
static void printSamplePositions(GLint samples) {
  if (samples <= 1 || !glGetMultisamplefv) return;
  fprintf(stderr, "samples");
  for (GLint i = 0; i < samples; i++) {
    GLfloat p[2] = {0, 0};
    glGetMultisamplefv(GL_SAMPLE_POSITION, i, p);
    fprintf(stderr, " %.4f,%.4f", p[0], p[1]);
  }
  fprintf(stderr, "\n");
}

static int frames = 0;

static void endFrame(GLenum buffer) {
  const char* want = getenv("VAMS_CAPTURE_FRAME");
  if (++frames < (want ? atoi(want) : 1)) return;
  glFinish();
  int w = glutGet(GLUT_WINDOW_WIDTH), h = glutGet(GLUT_WINDOW_HEIGHT);
  std::vector<unsigned char> px((size_t)w * h * 4);
  glReadBuffer(buffer);
  glPixelStorei(GL_PACK_ALIGNMENT, 1);
  glReadPixels(0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, px.data());
  const char* out = getenv("VAMS_CAPTURE_OUT");
  FILE* f = fopen(out ? out : "capture.rgba", "wb");
  if (!f) {
    fprintf(stderr, "Can't write the frame to %s\n", out ? out : "capture.rgba");
    exit(3);
  }
  GLint samples = 0;
  glGetIntegerv(GL_SAMPLES, &samples);
  fwrite(&w, 4, 1, f);
  fwrite(&h, 4, 1, f);
  fwrite(&samples, 4, 1, f);
  fwrite(px.data(), 1, px.size(), f);
  fclose(f);
  printSamplePositions(samples);
  fprintf(stderr, "%s, %s\n", (const char*)glGetString(GL_RENDERER), (const char*)glGetString(GL_VERSION));
  exit(0);
}

extern "C" void vams_capture_swap(void) {
  if (glutGet(GLUT_WINDOW_DOUBLEBUFFER)) {
    endFrame(GL_BACK);
    glutSwapBuffers();
  } else {
    glutSwapBuffers();
    endFrame(GL_FRONT);
  }
}

extern "C" void vams_capture_flush(void) {
  glFlush();
  if (!glutGet(GLUT_WINDOW_DOUBLEBUFFER)) endFrame(GL_FRONT);
}
