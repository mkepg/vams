// Textured quads. Top row: checkerboard.png magnified with GL_NEAREST, then GL_LINEAR.
// Middle row: texture coordinates from -0.25 to 1.25 with GL_LINEAR, wrapped with GL_CLAMP
// (the border colour, black, blends in) and with GL_CLAMP_TO_EDGE.
// Bottom row: a 64 x 64 texture whose mipmap levels are each one colour (red, green, blue,
// yellow, magenta, cyan, white), drawn 64, 32, 16, 8 and 4 pixels wide with
// GL_NEAREST_MIPMAP_NEAREST, then 26 and 45 pixels wide with GL_LINEAR_MIPMAP_LINEAR.
#include <GL/glew.h>
#include <GL/freeglut.h>
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

GLuint checker, levels;

void quad(float x, float y, float size, float t0, float t1)
{
    glBegin(GL_QUADS);
    glTexCoord2f(t0, t0); glVertex2f(x, y);
    glTexCoord2f(t1, t0); glVertex2f(x + size, y);
    glTexCoord2f(t1, t1); glVertex2f(x + size, y + size);
    glTexCoord2f(t0, t1); glVertex2f(x, y + size);
    glEnd();
}

void filters(GLint minFilter, GLint magFilter, GLint wrap)
{
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, minFilter);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, magFilter);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrap);
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_TEXTURE_2D);
    glColor3f(1.0f, 1.0f, 1.0f);

    glBindTexture(GL_TEXTURE_2D, checker);
    filters(GL_NEAREST, GL_NEAREST, GL_REPEAT);
    quad(20, 300, 160, 0.0f, 1.0f);
    filters(GL_LINEAR, GL_LINEAR, GL_REPEAT);
    quad(220, 300, 160, 0.0f, 1.0f);
    filters(GL_LINEAR, GL_LINEAR, GL_CLAMP);
    quad(20, 120, 160, -0.25f, 1.25f);
    filters(GL_LINEAR, GL_LINEAR, GL_CLAMP_TO_EDGE);
    quad(220, 120, 160, -0.25f, 1.25f);

    glBindTexture(GL_TEXTURE_2D, levels);
    filters(GL_NEAREST_MIPMAP_NEAREST, GL_NEAREST, GL_REPEAT);
    float x = 20;
    for (int size = 64; size >= 4; size /= 2) {
        quad(x, 20, size, 0.0f, 1.0f);
        x += size + 12;
    }
    filters(GL_LINEAR_MIPMAP_LINEAR, GL_LINEAR, GL_REPEAT);
    quad(x + 10, 20, 26, 0.0f, 1.0f);
    quad(x + 50, 20, 45, 0.0f, 1.0f);

    glDisable(GL_TEXTURE_2D);
    glutSwapBuffers();
}

void init()
{
    int w, h, n;
    stbi_set_flip_vertically_on_load(true);
    unsigned char* image = stbi_load("checkerboard.png", &w, &h, &n, 4);
    glGenTextures(1, &checker);
    glBindTexture(GL_TEXTURE_2D, checker);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, image);
    stbi_image_free(image);

    const unsigned char colours[7][4] = {
        { 255, 0, 0, 255 }, { 0, 255, 0, 255 }, { 0, 0, 255, 255 }, { 255, 255, 0, 255 },
        { 255, 0, 255, 255 }, { 0, 255, 255, 255 }, { 255, 255, 255, 255 },
    };
    static unsigned char texels[64 * 64 * 4];
    glGenTextures(1, &levels);
    glBindTexture(GL_TEXTURE_2D, levels);
    for (int level = 0, size = 64; size >= 1; level++, size /= 2) {
        for (int i = 0; i < size * size; i++) {
            for (int k = 0; k < 4; k++) texels[i * 4 + k] = colours[level][k];
        }
        glTexImage2D(GL_TEXTURE_2D, level, GL_RGBA, size, size, 0, GL_RGBA, GL_UNSIGNED_BYTE, texels);
    }
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Textured quads");
    glClearColor(0.3f, 0.3f, 0.35f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    init();
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
