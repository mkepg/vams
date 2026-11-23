// Render fidelity capture: compiled into an exported program with capture-pre.h, it writes the
// program's first frame (width, height, sample count, then bottom-up RGBA rows), prints its
// sample positions and the renderer it ran on, and exits. It asks for no particular GPU, so a laptop
// with switchable graphics runs it on its integrated Intel GPU, the reference.
#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cstdio>
#include <cstdlib>
#include <vector>

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

static void dump(GLenum buf) {
  int w = glutGet(GLUT_WINDOW_WIDTH), h = glutGet(GLUT_WINDOW_HEIGHT);
  std::vector<unsigned char> px((size_t)w * h * 4);
  glReadBuffer(buf);
  glPixelStorei(GL_PACK_ALIGNMENT, 1);
  glReadPixels(0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, px.data());
  const char* out = getenv("VAMS_CAPTURE_OUT");
  FILE* f = fopen(out ? out : "capture.rgba", "wb");
  fwrite(&w, 4, 1, f); fwrite(&h, 4, 1, f);
  GLint samples = 0; glGetIntegerv(GL_SAMPLES, &samples); fwrite(&samples, 4, 1, f);
  fwrite(px.data(), 1, px.size(), f); fclose(f);
  printSamplePositions(samples);
  fprintf(stderr, "%s, %s\n", (const char*)glGetString(GL_RENDERER), (const char*)glGetString(GL_VERSION));
  exit(0);
}
extern "C" void vams_capture_swap(void) { glFinish(); dump(GL_BACK); }
extern "C" void vams_capture_flush(void) { glFinish(); dump(GL_FRONT); }
