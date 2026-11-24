// Texture filters, wraps and environments on a 4 × 4 image made in the program: GL_NEAREST and
// GL_LINEAR, GL_REPEAT and GL_CLAMP over coordinates from -0.5 to 1.5, and GL_MODULATE with a
// colour against GL_REPLACE. One unit is one pixel.
#include <GL/freeglut.h>

GLuint tex;

void quad(float x, float y, float size, float lo, float hi)
{
    glBegin(GL_QUADS);
    glTexCoord2f(lo, lo); glVertex2f(x, y);
    glTexCoord2f(hi, lo); glVertex2f(x + size, y);
    glTexCoord2f(hi, hi); glVertex2f(x + size, y + size);
    glTexCoord2f(lo, hi); glVertex2f(x, y + size);
    glEnd();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, tex);
    for (int f = 0; f < 2; f++) {
        GLint filter = f == 0 ? GL_NEAREST : GL_LINEAR;
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
        for (int w = 0; w < 2; w++) {
            GLint wrap = w == 0 ? GL_REPEAT : GL_CLAMP;
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap);
            glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrap);
            for (int e = 0; e < 2; e++) {
                glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, e == 0 ? GL_MODULATE : GL_REPLACE);
                glColor3f(1.0f, 0.6f, 0.3f);
                quad(15.3f + (w * 2 + e) * 120.0f, 20.6f + f * 200.0f, 110.0f, -0.5f, 1.5f);
            }
        }
    }
    glDisable(GL_TEXTURE_2D);
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 420);
    glutCreateWindow("Texture modes");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 420.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);

    unsigned char image[4 * 4 * 4];
    for (int i = 0; i < 16; i++) {
        image[i * 4 + 0] = (unsigned char)(i * 16);
        image[i * 4 + 1] = (unsigned char)(255 - i * 12);
        image[i * 4 + 2] = (unsigned char)((i % 3) * 120);
        image[i * 4 + 3] = 255;
    }
    glGenTextures(1, &tex);
    glBindTexture(GL_TEXTURE_2D, tex);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, 4, 4, 0, GL_RGBA, GL_UNSIGNED_BYTE, image);

    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
