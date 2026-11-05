// Lab reference capture: included before a battery program (g++ -include), it routes
// glutSwapBuffers and glFlush to the frame counter in capture.cpp.
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
