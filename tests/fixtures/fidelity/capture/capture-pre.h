// Render fidelity capture: included before an exported program (g++ -include), it routes the
// first glutSwapBuffers or glFlush to the capture in capture.cpp.
#include <GL/glew.h>
#include <GL/freeglut.h>
#ifdef __cplusplus
extern "C" {
#endif
void vams_capture_swap(void);
void vams_capture_flush(void);
#ifdef __cplusplus
}
#endif
#define glutSwapBuffers vams_capture_swap
#define glFlush vams_capture_flush
