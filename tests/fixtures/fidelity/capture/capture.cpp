// Render fidelity capture: compiled into an exported program with capture-pre.h, it writes the
// program's first frame (width, height, sample count, then bottom-up RGBA rows), prints the
// renderer it ran on, and exits.
#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cstdio>
#include <cstdlib>
#include <vector>

// Runs the program on the discrete GPU of a laptop with switchable graphics, as the Lab's
// references do (tests/fixtures/lab/capture). Without it a laptop picks its integrated GPU,
// which draws a multisampled point as a square instead of the circle OpenGL 1.5 asks for (3.3.3).
extern "C" {
__declspec(dllexport) unsigned long NvOptimusEnablement = 1;
__declspec(dllexport) int AmdPowerXpressRequestHighPerformance = 1;
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
  fprintf(stderr, "%s, %s\n", (const char*)glGetString(GL_RENDERER), (const char*)glGetString(GL_VERSION));
  exit(0);
}
extern "C" void vams_capture_swap(void) { glFinish(); dump(GL_BACK); }
extern "C" void vams_capture_flush(void) { glFinish(); dump(GL_FRONT); }
