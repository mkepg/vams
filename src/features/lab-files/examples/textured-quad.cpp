// A textured quad. init loads checkerboard.png from your files with stb_image and hands its
// pixels to OpenGL with glTexImage2D. display then draws a quad with a texture coordinate at
// each corner, so the whole image covers it. GL_NEAREST keeps each texel a sharp square.
#include <GL/glew.h>
#include <GL/freeglut.h>
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

GLuint texture = 0;

void init() {
    glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(-1.0, 1.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);

    int width, height, channels;
    // Images are stored top row first; OpenGL expects the bottom row first.
    stbi_set_flip_vertically_on_load(1);
    unsigned char* pixels = stbi_load("checkerboard.png", &width, &height, &channels, 4);
    if (!pixels) return;

    glGenTextures(1, &texture);
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels);
    stbi_image_free(pixels);
}

void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, texture);
    glColor3f(1.0f, 1.0f, 1.0f);
    glBegin(GL_QUADS);
    glTexCoord2f(0.0f, 0.0f); glVertex2f(-0.6f, -0.6f);
    glTexCoord2f(1.0f, 0.0f); glVertex2f(0.6f, -0.6f);
    glTexCoord2f(1.0f, 1.0f); glVertex2f(0.6f, 0.6f);
    glTexCoord2f(0.0f, 1.0f); glVertex2f(-0.6f, 0.6f);
    glEnd();
    glDisable(GL_TEXTURE_2D);
    glFlush();
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Textured quad");
    glewInit();
    init();
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
