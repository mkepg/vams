#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// stb_image: define its implementation in exactly one file, before including it
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Front_hub = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Front_rim = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Front_tyre = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Front_wheel = { 0.5925f, 0.0900f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rear_hub = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rear_rim = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rear_tyre = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rear_wheel = { -0.3000f, 0.0900f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Route = { -0.3300f, 0.2805f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Headlight = { 0.6825f, 0.2850f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Front_fender = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rear_arch = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Wheel_wells = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Jeep_body = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Jeepney = { -0.6200f, -0.7000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Lane_line = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Road = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Lamp_light = { -1.2000f, 0.0950f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Street_lamp = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Parol_strings = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Parol_4 = { 1.1700f, 0.1820f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Parol_3 = { 0.3200f, 0.0451f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Parol_2 = { -0.4000f, 0.0460f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Parol_1 = { -1.0000f, 0.1329f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Wire = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Poles = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Store_sign = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Store = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Windows = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Buildings = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Moon = { 1.2000f, 0.6000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Stars = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Sky = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Front_wheel = { 0.5925f, 0.0900f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Rear_wheel = { -0.3000f, 0.0900f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Jeepney = { -0.6200f, -0.7000f, 0.0000f, 1.0000f, 1.0000f };

// --- Texture Handles ---
GLuint tex_Store_sign = 0;

void draw_Front_hub();
void draw_Front_rim();
void draw_Front_tyre();
void draw_Rear_hub();
void draw_Rear_rim();
void draw_Rear_tyre();
void draw_Headlight();
void draw_Front_fender();
void draw_Rear_arch();
void draw_Wheel_wells();
void draw_Jeep_body();
void draw_Lane_line();
void draw_Road();
void draw_Lamp_light();
void draw_Street_lamp();
void draw_Parol_strings();
void draw_Parol_4();
void draw_Parol_3();
void draw_Parol_2();
void draw_Parol_1();
void draw_Wire();
void draw_Poles();
void draw_Store_sign();
void draw_Store();
void draw_Windows();
void draw_Buildings();
void draw_Moon();
void draw_Stars();
void draw_Sky();
void init();

void draw_Front_hub()
{
    // Front hub
    glPushMatrix();
    // Transform
    glTranslatef(state_Front_hub.x, state_Front_hub.y, 0.0f);
    glRotatef(state_Front_hub.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Front_hub.scaleX, state_Front_hub.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.96f, 0.97f, 0.98f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0180f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0127f, 0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0000f, 0.0180f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0127f, 0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0180f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0127f, -0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0000f, -0.0180f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0127f, -0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0180f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Front_rim()
{
    // Front rim
    glPushMatrix();
    // Transform
    glTranslatef(state_Front_rim.x, state_Front_rim.y, 0.0f);
    glRotatef(state_Front_rim.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Front_rim.scaleX, state_Front_rim.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.81f, 0.83f, 0.86f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0522f, 0.0000f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(0.0422f, 0.0307f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0161f, 0.0496f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0161f, 0.0496f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(-0.0422f, 0.0307f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0522f, 0.0000f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(-0.0422f, -0.0307f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0161f, -0.0496f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0161f, -0.0496f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(0.0422f, -0.0307f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0522f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Front_tyre()
{
    // Front tyre
    glPushMatrix();
    // Transform
    glTranslatef(state_Front_tyre.x, state_Front_tyre.y, 0.0f);
    glRotatef(state_Front_tyre.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Front_tyre.scaleX, state_Front_tyre.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.17f, 0.16f, 0.20f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0900f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0856f, 0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0728f, 0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0529f, 0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0278f, 0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0278f, 0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0529f, 0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0728f, 0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0856f, 0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0900f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0856f, -0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0728f, -0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0529f, -0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0278f, -0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0000f, -0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0278f, -0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0529f, -0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0728f, -0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0856f, -0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0900f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Rear_hub()
{
    // Rear hub
    glPushMatrix();
    // Transform
    glTranslatef(state_Rear_hub.x, state_Rear_hub.y, 0.0f);
    glRotatef(state_Rear_hub.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Rear_hub.scaleX, state_Rear_hub.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.96f, 0.97f, 0.98f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0180f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0127f, 0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0000f, 0.0180f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0127f, 0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0180f, 0.0000f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(-0.0127f, -0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0000f, -0.0180f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0127f, -0.0127f);
        glColor3f(0.49f, 0.52f, 0.56f);
        glVertex2f(0.0180f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Rear_rim()
{
    // Rear rim
    glPushMatrix();
    // Transform
    glTranslatef(state_Rear_rim.x, state_Rear_rim.y, 0.0f);
    glRotatef(state_Rear_rim.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Rear_rim.scaleX, state_Rear_rim.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.81f, 0.83f, 0.86f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0522f, 0.0000f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(0.0422f, 0.0307f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0161f, 0.0496f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0161f, 0.0496f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(-0.0422f, 0.0307f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0522f, 0.0000f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(-0.0422f, -0.0307f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(-0.0161f, -0.0496f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0161f, -0.0496f);
        glColor3f(0.89f, 0.91f, 0.93f);
        glVertex2f(0.0422f, -0.0307f);
        glColor3f(0.65f, 0.68f, 0.73f);
        glVertex2f(0.0522f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Rear_tyre()
{
    // Rear tyre
    glPushMatrix();
    // Transform
    glTranslatef(state_Rear_tyre.x, state_Rear_tyre.y, 0.0f);
    glRotatef(state_Rear_tyre.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Rear_tyre.scaleX, state_Rear_tyre.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.17f, 0.16f, 0.20f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0900f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0856f, 0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0728f, 0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0529f, 0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0278f, 0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0278f, 0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0529f, 0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0728f, 0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0856f, 0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0900f, 0.0000f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0856f, -0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0728f, -0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0529f, -0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.0278f, -0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0000f, -0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0278f, -0.0856f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0529f, -0.0728f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0728f, -0.0529f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0856f, -0.0278f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.0900f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Headlight()
{
    // Headlight
    glPushMatrix();
    // Transform
    glTranslatef(state_Headlight.x, state_Headlight.y, 0.0f);
    glRotatef(state_Headlight.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Headlight.scaleX, state_Headlight.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0160f, 0.0000f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0129f, 0.0094f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0049f, 0.0152f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(-0.0049f, 0.0152f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(-0.0129f, 0.0094f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(-0.0160f, 0.0000f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(-0.0129f, -0.0094f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(-0.0049f, -0.0152f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0049f, -0.0152f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0129f, -0.0094f);
        glColor3f(1.00f, 0.90f, 0.64f);
        glVertex2f(0.0160f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Front_fender()
{
    // Front fender
    glPushMatrix();
    // Transform
    glTranslatef(state_Front_fender.x, state_Front_fender.y, 0.0f);
    glRotatef(state_Front_fender.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Front_fender.scaleX, state_Front_fender.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUAD_STRIP);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4575f, 0.0900f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4815f, 0.0900f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4641f, 0.1317f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4869f, 0.1243f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4833f, 0.1694f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5027f, 0.1552f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5131f, 0.1992f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5273f, 0.1798f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5508f, 0.2184f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5582f, 0.1956f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5925f, 0.2250f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.5925f, 0.2010f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6342f, 0.2184f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6268f, 0.1956f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6719f, 0.1992f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6577f, 0.1798f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.7017f, 0.1694f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6823f, 0.1552f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.7209f, 0.1317f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6981f, 0.1243f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.7275f, 0.0900f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.7035f, 0.0900f);
    glEnd();
    glPopMatrix();
}

void draw_Rear_arch()
{
    // Rear arch
    glPushMatrix();
    // Transform
    glTranslatef(state_Rear_arch.x, state_Rear_arch.y, 0.0f);
    glRotatef(state_Rear_arch.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Rear_arch.scaleX, state_Rear_arch.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUAD_STRIP);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.4350f, 0.0900f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.4110f, 0.0900f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.4284f, 0.1317f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.4056f, 0.1243f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.4092f, 0.1694f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3898f, 0.1552f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3794f, 0.1992f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3652f, 0.1798f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3417f, 0.2184f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3343f, 0.1956f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3000f, 0.2250f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.3000f, 0.2010f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.2583f, 0.2184f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.2657f, 0.1956f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.2206f, 0.1992f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.2348f, 0.1798f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.1908f, 0.1694f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.2102f, 0.1552f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.1716f, 0.1317f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.1944f, 0.1243f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.1650f, 0.0900f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.1890f, 0.0900f);
    glEnd();
    glPopMatrix();
}

void draw_Wheel_wells()
{
    // Wheel wells
    glPushMatrix();
    // Transform
    glTranslatef(state_Wheel_wells.x, state_Wheel_wells.y, 0.0f);
    glRotatef(state_Wheel_wells.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wheel_wells.scaleX, state_Wheel_wells.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_TRIANGLES);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.1890f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.1944f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.1944f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2102f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2102f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2348f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2348f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2657f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.2657f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.2010f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.2010f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3343f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3343f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3652f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3652f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3898f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3898f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.4056f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.3000f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.4056f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(-0.4110f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.7035f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6981f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6981f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6823f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6823f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6577f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6577f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6268f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.6268f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.2010f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.2010f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5582f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5582f, 0.1956f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5273f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5273f, 0.1798f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5027f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5027f, 0.1552f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.4869f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.5925f, 0.0900f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.4869f, 0.1243f);
        glColor3f(0.08f, 0.07f, 0.10f);
        glVertex2f(0.4815f, 0.0900f);
    glEnd();
    glPopMatrix();
}

void draw_Jeep_body()
{
    // Jeep body
    glPushMatrix();
    // Transform
    glTranslatef(state_Jeep_body.x, state_Jeep_body.y, 0.0f);
    glRotatef(state_Jeep_body.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Jeep_body.scaleX, state_Jeep_body.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.16f, 0.15f, 0.20f);
        glVertex2f(-0.7500f, 0.0600f);
        glColor3f(0.16f, 0.15f, 0.20f);
        glVertex2f(-0.6600f, 0.0600f);
        glColor3f(0.16f, 0.15f, 0.20f);
        glVertex2f(-0.6600f, 0.1050f);
        glColor3f(0.16f, 0.15f, 0.20f);
        glVertex2f(-0.7500f, 0.1050f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(-0.6600f, 0.1050f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.1050f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.2790f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(-0.6600f, 0.2790f);
        glColor3f(0.95f, 0.76f, 0.19f);
        glVertex2f(-0.5250f, 0.1680f);
        glColor3f(0.95f, 0.76f, 0.19f);
        glVertex2f(0.1725f, 0.1830f);
        glColor3f(0.95f, 0.76f, 0.19f);
        glVertex2f(0.1725f, 0.1980f);
        glColor3f(0.95f, 0.76f, 0.19f);
        glVertex2f(-0.5250f, 0.1800f);
        glColor3f(0.17f, 0.37f, 0.83f);
        glVertex2f(-0.5250f, 0.1500f);
        glColor3f(0.17f, 0.37f, 0.83f);
        glVertex2f(0.1725f, 0.1620f);
        glColor3f(0.17f, 0.37f, 0.83f);
        glVertex2f(0.1725f, 0.1755f);
        glColor3f(0.17f, 0.37f, 0.83f);
        glVertex2f(-0.5250f, 0.1620f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(-0.6600f, 0.2610f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.1725f, 0.2610f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.1725f, 0.3210f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(-0.6600f, 0.3210f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6600f, 0.3210f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.1725f, 0.3210f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.1725f, 0.3330f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6600f, 0.3330f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(-0.6600f, 0.3330f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.3330f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.4500f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(-0.6600f, 0.4500f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.6300f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.4560f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.4560f, 0.4380f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.6300f, 0.4380f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.6210f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.4650f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.4650f, 0.3810f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.6210f, 0.3810f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.4320f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.2580f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.2580f, 0.4380f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.4320f, 0.4380f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.4230f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.2670f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.2670f, 0.3810f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.4230f, 0.3810f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.2340f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.0600f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.0600f, 0.4380f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.2340f, 0.4380f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.2250f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.0690f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.0690f, 0.3810f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.2250f, 0.3810f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.0360f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.1380f, 0.3480f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.1380f, 0.4380f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(-0.0360f, 0.4380f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.0270f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(0.1290f, 0.3540f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(0.1290f, 0.3810f);
        glColor3f(0.60f, 0.38f, 0.21f);
        glVertex2f(-0.0270f, 0.3810f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(-0.7590f, 0.4500f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4350f, 0.4500f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4350f, 0.4890f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(-0.7590f, 0.4890f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.7590f, 0.4500f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4350f, 0.4500f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4350f, 0.4575f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.7590f, 0.4575f);
        glColor3f(0.87f, 0.88f, 0.90f);
        glVertex2f(-0.7590f, 0.4890f);
        glColor3f(0.87f, 0.88f, 0.90f);
        glVertex2f(0.4350f, 0.4890f);
        glColor3f(0.87f, 0.88f, 0.90f);
        glVertex2f(0.4260f, 0.5100f);
        glColor3f(0.87f, 0.88f, 0.90f);
        glVertex2f(-0.7470f, 0.5100f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6720f, 0.1050f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6540f, 0.1050f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6540f, 0.4500f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.6720f, 0.4500f);
        glColor3f(1.00f, 0.23f, 0.23f);
        glVertex2f(-0.6540f, 0.2250f);
        glColor3f(1.00f, 0.23f, 0.23f);
        glVertex2f(-0.6180f, 0.2250f);
        glColor3f(1.00f, 0.23f, 0.23f);
        glVertex2f(-0.6180f, 0.2730f);
        glColor3f(1.00f, 0.23f, 0.23f);
        glVertex2f(-0.6540f, 0.2730f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.7500f, 0.1050f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.5700f, 0.1050f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.5700f, 0.1560f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(-0.7500f, 0.1560f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.1050f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.4200f, 0.1050f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.4200f, 0.4500f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.1725f, 0.4500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.1725f, 0.2610f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.4200f, 0.2610f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.4200f, 0.3210f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.1725f, 0.3210f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.1980f, 0.3180f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.3330f, 0.3180f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.3420f, 0.4350f);
        glColor3f(0.13f, 0.10f, 0.14f);
        glVertex2f(0.2100f, 0.4350f);
        glColor3f(0.23f, 0.16f, 0.15f);
        glVertex2f(0.2160f, 0.3180f);
        glColor3f(0.23f, 0.16f, 0.15f);
        glVertex2f(0.2640f, 0.3180f);
        glColor3f(0.23f, 0.16f, 0.15f);
        glVertex2f(0.2640f, 0.3780f);
        glColor3f(0.23f, 0.16f, 0.15f);
        glVertex2f(0.2160f, 0.3780f);
        glColor3f(0.53f, 0.63f, 0.77f);
        glVertex2f(0.3510f, 0.3330f);
        glColor3f(0.53f, 0.63f, 0.77f);
        glVertex2f(0.3660f, 0.4500f);
        glColor3f(0.53f, 0.63f, 0.77f);
        glVertex2f(0.3840f, 0.4500f);
        glColor3f(0.53f, 0.63f, 0.77f);
        glVertex2f(0.3690f, 0.3330f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.4200f, 0.2250f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.4200f, 0.3225f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.6600f, 0.3225f);
        glColor3f(0.78f, 0.80f, 0.83f);
        glVertex2f(0.6810f, 0.2250f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.4380f, 0.2670f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.6600f, 0.2670f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.6600f, 0.2820f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.4380f, 0.2820f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4380f, 0.2940f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6570f, 0.2940f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6570f, 0.3000f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4380f, 0.3000f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4380f, 0.2490f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6660f, 0.2490f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6660f, 0.2550f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.4380f, 0.2550f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6720f, 0.1800f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6930f, 0.1800f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6930f, 0.3210f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6720f, 0.3210f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4200f, 0.1050f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6825f, 0.1050f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.6825f, 0.2250f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4200f, 0.2250f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(-0.1500f, 0.0600f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4200f, 0.0600f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(0.4200f, 0.1050f);
        glColor3f(0.60f, 0.63f, 0.68f);
        glVertex2f(-0.1500f, 0.1050f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6825f, 0.0990f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7500f, 0.0990f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7500f, 0.1470f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.6825f, 0.1470f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7290f, 0.0990f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7440f, 0.0990f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7440f, 0.2550f);
        glColor3f(0.93f, 0.95f, 0.96f);
        glVertex2f(0.7290f, 0.2550f);
    glEnd();
    glPopMatrix();
}

void draw_Lane_line()
{
    // Lane line
    glPushMatrix();
    // Transform
    glTranslatef(state_Lane_line.x, state_Lane_line.y, 0.0f);
    glRotatef(state_Lane_line.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Lane_line.scaleX, state_Lane_line.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);
    glLineWidth(3.00f);
    glEnable(GL_LINE_STIPPLE);
    glLineStipple(6, 0x00FF);

    glBegin(GL_LINES);
        glColor3f(0.91f, 0.89f, 0.78f);
        glVertex2f(-1.6000f, -0.8000f);
        glColor3f(0.91f, 0.89f, 0.78f);
        glVertex2f(1.6000f, -0.8000f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Road()
{
    // Road
    glPushMatrix();
    // Transform
    glTranslatef(state_Road.x, state_Road.y, 0.0f);
    glRotatef(state_Road.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Road.scaleX, state_Road.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.29f, 0.27f, 0.38f);
        glVertex2f(-1.6000f, -0.4250f);
        glColor3f(0.29f, 0.27f, 0.38f);
        glVertex2f(1.6000f, -0.4250f);
        glColor3f(0.29f, 0.27f, 0.38f);
        glVertex2f(1.6000f, -0.3600f);
        glColor3f(0.29f, 0.27f, 0.38f);
        glVertex2f(-1.6000f, -0.3600f);
        glColor3f(0.11f, 0.10f, 0.15f);
        glVertex2f(-1.6000f, -0.9000f);
        glColor3f(0.11f, 0.10f, 0.15f);
        glVertex2f(1.6000f, -0.9000f);
        glColor3f(0.11f, 0.10f, 0.15f);
        glVertex2f(1.6000f, -0.4250f);
        glColor3f(0.11f, 0.10f, 0.15f);
        glVertex2f(-1.6000f, -0.4250f);
    glEnd();
    glPopMatrix();
}

void draw_Lamp_light()
{
    // Lamp light
    glPushMatrix();
    // Transform
    glTranslatef(state_Lamp_light.x, state_Lamp_light.y, 0.0f);
    glRotatef(state_Lamp_light.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Lamp_light.scaleX, state_Lamp_light.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.96f, 0.84f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0300f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0260f, 0.0150f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0150f, 0.0260f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0000f, 0.0300f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(-0.0150f, 0.0260f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(-0.0260f, 0.0150f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(-0.0300f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(-0.0260f, -0.0150f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(-0.0150f, -0.0260f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0000f, -0.0300f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0150f, -0.0260f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0260f, -0.0150f);
        glColor3f(1.00f, 0.82f, 0.48f);
        glVertex2f(0.0300f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Street_lamp()
{
    // Street lamp
    glPushMatrix();
    // Transform
    glTranslatef(state_Street_lamp.x, state_Street_lamp.y, 0.0f);
    glRotatef(state_Street_lamp.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Street_lamp.scaleX, state_Street_lamp.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3300f, -0.4000f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3100f, -0.4000f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3100f, 0.1200f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3300f, 0.1200f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3300f, 0.1000f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.2000f, 0.1000f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.2000f, 0.1200f);
        glColor3f(0.29f, 0.31f, 0.38f);
        glVertex2f(-1.3300f, 0.1200f);
    glEnd();
    glPopMatrix();
}

void draw_Parol_strings()
{
    // Parol strings
    glPushMatrix();
    // Transform
    glTranslatef(state_Parol_strings.x, state_Parol_strings.y, 0.0f);
    glRotatef(state_Parol_strings.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Parol_strings.scaleX, state_Parol_strings.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);
    glLineWidth(2.00f);

    glBegin(GL_LINES);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(-1.0000f, 0.2729f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(-1.0000f, 0.2279f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-1.0250f, 0.1029f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-1.0350f, -0.0371f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.9750f, 0.1029f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.9650f, -0.0371f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(-0.4000f, 0.1860f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(-0.4000f, 0.1410f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.4250f, 0.0160f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.4350f, -0.1240f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.3750f, 0.0160f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.3650f, -0.1240f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(0.3200f, 0.1851f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(0.3200f, 0.1401f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.2950f, 0.0151f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.2850f, -0.1249f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.3450f, 0.0151f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.3550f, -0.1249f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(1.1700f, 0.3220f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(1.1700f, 0.2770f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(1.1450f, 0.1520f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(1.1350f, 0.0120f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(1.1950f, 0.1520f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(1.2050f, 0.0120f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Parol_4()
{
    // Parol 4
    glPushMatrix();
    // Transform
    glTranslatef(state_Parol_4.x, state_Parol_4.y, 0.0f);
    glRotatef(state_Parol_4.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Parol_4.scaleX, state_Parol_4.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.90f, 1.00f, 0.85f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0000f, 0.0950f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(-0.0247f, 0.0340f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(-0.0904f, 0.0294f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(-0.0399f, -0.0130f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(-0.0558f, -0.0769f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0000f, -0.0420f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0558f, -0.0769f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0399f, -0.0130f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0904f, 0.0294f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0247f, 0.0340f);
        glColor3f(0.48f, 0.89f, 0.50f);
        glVertex2f(0.0000f, 0.0950f);
    glEnd();
    glPopMatrix();
}

void draw_Parol_3()
{
    // Parol 3
    glPushMatrix();
    // Transform
    glTranslatef(state_Parol_3.x, state_Parol_3.y, 0.0f);
    glRotatef(state_Parol_3.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Parol_3.scaleX, state_Parol_3.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.95f, 0.81f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, 0.0950f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.0247f, 0.0340f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.0904f, 0.0294f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.0399f, -0.0130f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.0558f, -0.0769f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, -0.0420f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0558f, -0.0769f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0399f, -0.0130f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0904f, 0.0294f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0247f, 0.0340f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, 0.0950f);
    glEnd();
    glPopMatrix();
}

void draw_Parol_2()
{
    // Parol 2
    glPushMatrix();
    // Transform
    glTranslatef(state_Parol_2.x, state_Parol_2.y, 0.0f);
    glRotatef(state_Parol_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Parol_2.scaleX, state_Parol_2.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.85f, 1.00f, 0.98f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0000f, 0.0950f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.0247f, 0.0340f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.0904f, 0.0294f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.0399f, -0.0130f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(-0.0558f, -0.0769f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0000f, -0.0420f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0558f, -0.0769f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0399f, -0.0130f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0904f, 0.0294f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0247f, 0.0340f);
        glColor3f(0.22f, 0.78f, 0.75f);
        glVertex2f(0.0000f, 0.0950f);
    glEnd();
    glPopMatrix();
}

void draw_Parol_1()
{
    // Parol 1
    glPushMatrix();
    // Transform
    glTranslatef(state_Parol_1.x, state_Parol_1.y, 0.0f);
    glRotatef(state_Parol_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Parol_1.scaleX, state_Parol_1.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.82f, 0.78f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0000f, 0.0950f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.0247f, 0.0340f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.0904f, 0.0294f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.0399f, -0.0130f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(-0.0558f, -0.0769f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0000f, -0.0420f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0558f, -0.0769f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0399f, -0.0130f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0904f, 0.0294f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0247f, 0.0340f);
        glColor3f(1.00f, 0.35f, 0.37f);
        glVertex2f(0.0000f, 0.0950f);
    glEnd();
    glPopMatrix();
}

void draw_Wire()
{
    // Wire
    glPushMatrix();
    // Transform
    glTranslatef(state_Wire.x, state_Wire.y, 0.0f);
    glRotatef(state_Wire.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wire.scaleX, state_Wire.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);
    glLineWidth(2.00f);

    glBegin(GL_LINE_STRIP);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-1.4600f, 0.3700f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-1.2819f, 0.3310f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-1.1037f, 0.2935f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.9256f, 0.2589f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.7475f, 0.2286f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.5694f, 0.2037f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.3912f, 0.1852f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.2131f, 0.1738f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(-0.0350f, 0.1700f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(0.1431f, 0.1738f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(0.3213f, 0.1852f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(0.4994f, 0.2037f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(0.6775f, 0.2286f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(0.8556f, 0.2589f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(1.0338f, 0.2935f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(1.2119f, 0.3310f);
        glColor3f(0.36f, 0.34f, 0.50f);
        glVertex2f(1.3900f, 0.3700f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Poles()
{
    // Poles
    glPushMatrix();
    // Transform
    glTranslatef(state_Poles.x, state_Poles.y, 0.0f);
    glRotatef(state_Poles.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Poles.scaleX, state_Poles.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.4700f, -0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.4450f, -0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.4450f, 0.4200f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.4700f, 0.4200f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.3800f, -0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.4050f, -0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.4050f, 0.4200f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.3800f, 0.4200f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.5200f, 0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.3950f, 0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.3950f, 0.3750f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(-1.5200f, 0.3750f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.3300f, 0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.4550f, 0.3600f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.4550f, 0.3750f);
        glColor3f(0.10f, 0.09f, 0.15f);
        glVertex2f(1.3300f, 0.3750f);
    glEnd();
    glPopMatrix();
}

void draw_Store_sign()
{
    // Store sign
    glPushMatrix();
    // Transform
    glTranslatef(state_Store_sign.x, state_Store_sign.y, 0.0f);
    glRotatef(state_Store_sign.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Store_sign.scaleX, state_Store_sign.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, tex_Store_sign);

    glBegin(GL_QUADS);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(0.0000f, 0.0000f);
        glVertex2f(0.5800f, -0.0250f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(1.0000f, 0.0000f);
        glVertex2f(0.9600f, -0.0250f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(1.0000f, 1.0000f);
        glVertex2f(0.9600f, 0.0700f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(0.0000f, 1.0000f);
        glVertex2f(0.5800f, 0.0700f);
    glEnd();
    glDisable(GL_TEXTURE_2D);
    glPopMatrix();
}

void draw_Store()
{
    // Store
    glPushMatrix();
    // Transform
    glTranslatef(state_Store.x, state_Store.y, 0.0f);
    glRotatef(state_Store.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Store.scaleX, state_Store.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.36f, 0.23f, 0.18f);
        glVertex2f(0.5600f, -0.3600f);
        glColor3f(0.36f, 0.23f, 0.18f);
        glVertex2f(0.9800f, -0.3600f);
        glColor3f(0.36f, 0.23f, 0.18f);
        glVertex2f(0.9800f, 0.0200f);
        glColor3f(0.36f, 0.23f, 0.18f);
        glVertex2f(0.5600f, 0.0200f);
        glColor3f(1.00f, 0.81f, 0.48f);
        glVertex2f(0.6000f, -0.3300f);
        glColor3f(1.00f, 0.81f, 0.48f);
        glVertex2f(0.9400f, -0.3300f);
        glColor3f(1.00f, 0.81f, 0.48f);
        glVertex2f(0.9400f, -0.1200f);
        glColor3f(1.00f, 0.81f, 0.48f);
        glVertex2f(0.6000f, -0.1200f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.5300f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.6100f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.6200f, -0.0500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.5400f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.6100f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.6900f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.7000f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.6200f, -0.0500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.6900f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.7700f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.7800f, -0.0500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.7000f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.7700f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.8500f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.8600f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.7800f, -0.0500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.8500f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.9300f, -0.1000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.9400f, -0.0500f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.8600f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.9300f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(1.0100f, -0.1000f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(1.0200f, -0.0500f);
        glColor3f(0.96f, 0.94f, 0.90f);
        glVertex2f(0.9400f, -0.0500f);
    glEnd();
    glPopMatrix();
}

void draw_Windows()
{
    // Windows
    glPushMatrix();
    // Transform
    glTranslatef(state_Windows.x, state_Windows.y, 0.0f);
    glRotatef(state_Windows.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Windows.scaleX, state_Windows.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, 0.1950f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, 0.1950f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, 0.2850f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, 0.2850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, 0.1950f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, 0.1950f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, 0.2850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, 0.2850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, 0.1950f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, 0.1950f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, 0.2850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, 0.2850f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, 0.0450f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, 0.0450f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, 0.1350f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, 0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, 0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, 0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, 0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, 0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, 0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, 0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, 0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, 0.1350f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, -0.1050f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, -0.1050f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, -0.0150f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, -0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, -0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, -0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, -0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, -0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, -0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, -0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, -0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, -0.0150f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, -0.2550f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, -0.2550f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.4750f, -0.1650f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-1.5650f, -0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, -0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, -0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.3150f, -0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.4050f, -0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, -0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, -0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.1550f, -0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.2450f, -0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.0850f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9883f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9883f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.0850f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9183f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.8217f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.8217f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9183f, 0.1050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.7517f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.6550f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.6550f, 0.1050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.7517f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.0850f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9883f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9883f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-1.0850f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9183f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.8217f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.8217f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.9183f, -0.0450f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.7517f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.6550f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.6550f, -0.0450f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.7517f, -0.0450f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-0.5850f, 0.3150f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-0.5050f, 0.3150f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-0.5050f, 0.4050f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(-0.5850f, 0.4050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, 0.3150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, 0.3150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, 0.4050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, 0.4050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2850f, 0.3150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2050f, 0.3150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2050f, 0.4050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2850f, 0.4050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, 0.3150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, 0.3150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, 0.4050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, 0.4050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5850f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5050f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5050f, 0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5850f, 0.2550f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.4350f, 0.1650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.3550f, 0.1650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.3550f, 0.2550f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.4350f, 0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2850f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2050f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2050f, 0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2850f, 0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, 0.2550f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, 0.2550f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.5850f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.5050f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.5050f, 0.1050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.5850f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2850f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2050f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2050f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.2850f, 0.1050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.1350f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.0550f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.0550f, 0.1050f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.1350f, 0.1050f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5850f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5050f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5050f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.5850f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.3550f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.4350f, -0.0450f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2850f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2050f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2050f, -0.0450f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(-0.2850f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.0550f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(-0.1350f, -0.0450f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, 0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, 0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, 0.1650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, 0.0750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, 0.0750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, 0.1650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, 0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, 0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, 0.1650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, -0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, -0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, -0.0750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, -0.0750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, 0.0150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, -0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, -0.0750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, 0.0150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, -0.2250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, -0.2250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.1183f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.0150f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, -0.2250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, -0.2250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.2917f, -0.1350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.1883f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, -0.2250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, -0.2250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.4650f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.3617f, -0.1350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, 0.2350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, 0.2350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, 0.3250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, 0.3250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, 0.2350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, 0.2350f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, 0.3250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, 0.3250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, 0.2350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, 0.2350f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, 0.3250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, 0.3250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, 0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, 0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, 0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, 0.1750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, 0.0850f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, 0.0850f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, 0.1750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, 0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, 0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, 0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, 0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, 0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, -0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, -0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, 0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, 0.0250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, -0.0650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, -0.0650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, 0.0250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, 0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, -0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, -0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, 0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, 0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, -0.2150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, -0.2150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.6383f, -0.1250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.5350f, -0.1250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, -0.2150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, -0.2150f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.8117f, -0.1250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(0.7083f, -0.1250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, -0.2150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, -0.2150f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.9850f, -0.1250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(0.8817f, -0.1250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.0550f, -0.0250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.1783f, -0.0250f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.1783f, 0.0650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.0550f, 0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.2483f, -0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.3717f, -0.0250f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.3717f, 0.0650f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.2483f, 0.0650f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.4417f, -0.0250f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.5650f, -0.0250f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.5650f, 0.0650f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.4417f, 0.0650f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.0550f, -0.1750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.1783f, -0.1750f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.1783f, -0.0850f);
        glColor3f(0.96f, 0.78f, 0.42f);
        glVertex2f(1.0550f, -0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.2483f, -0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.3717f, -0.1750f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.3717f, -0.0850f);
        glColor3f(0.11f, 0.09f, 0.20f);
        glVertex2f(1.2483f, -0.0850f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.4417f, -0.1750f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.5650f, -0.1750f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.5650f, -0.0850f);
        glColor3f(1.00f, 0.89f, 0.63f);
        glVertex2f(1.4417f, -0.0850f);
    glEnd();
    glPopMatrix();
}

void draw_Buildings()
{
    // Buildings
    glPushMatrix();
    // Transform
    glTranslatef(state_Buildings.x, state_Buildings.y, 0.0f);
    glRotatef(state_Buildings.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Buildings.scaleX, state_Buildings.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);

    glBegin(GL_QUADS);
        glColor3f(0.17f, 0.15f, 0.27f);
        glVertex2f(-1.6000f, -0.3600f);
        glColor3f(0.17f, 0.15f, 0.27f);
        glVertex2f(-1.1200f, -0.3600f);
        glColor3f(0.17f, 0.15f, 0.27f);
        glVertex2f(-1.1200f, 0.3800f);
        glColor3f(0.17f, 0.15f, 0.27f);
        glVertex2f(-1.6000f, 0.3800f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.6150f, 0.3800f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.1050f, 0.3800f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.1050f, 0.4050f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.6150f, 0.4050f);
        glColor3f(0.20f, 0.17f, 0.32f);
        glVertex2f(-1.1200f, -0.3600f);
        glColor3f(0.20f, 0.17f, 0.32f);
        glVertex2f(-0.6200f, -0.3600f);
        glColor3f(0.20f, 0.17f, 0.32f);
        glVertex2f(-0.6200f, 0.2000f);
        glColor3f(0.20f, 0.17f, 0.32f);
        glVertex2f(-1.1200f, 0.2000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.1350f, 0.2000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.6050f, 0.2000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.6050f, 0.2250f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-1.1350f, 0.2250f);
        glColor3f(0.15f, 0.13f, 0.25f);
        glVertex2f(-0.6200f, -0.3600f);
        glColor3f(0.15f, 0.13f, 0.25f);
        glVertex2f(-0.0200f, -0.3600f);
        glColor3f(0.15f, 0.13f, 0.25f);
        glVertex2f(-0.0200f, 0.5000f);
        glColor3f(0.15f, 0.13f, 0.25f);
        glVertex2f(-0.6200f, 0.5000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.6350f, 0.5000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.0050f, 0.5000f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.0050f, 0.5250f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.6350f, 0.5250f);
        glColor3f(0.19f, 0.16f, 0.30f);
        glVertex2f(-0.0200f, -0.3600f);
        glColor3f(0.19f, 0.16f, 0.30f);
        glVertex2f(0.5000f, -0.3600f);
        glColor3f(0.19f, 0.16f, 0.30f);
        glVertex2f(0.5000f, 0.2600f);
        glColor3f(0.19f, 0.16f, 0.30f);
        glVertex2f(-0.0200f, 0.2600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.0350f, 0.2600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(0.5150f, 0.2600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(0.5150f, 0.2850f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(-0.0350f, 0.2850f);
        glColor3f(0.16f, 0.14f, 0.27f);
        glVertex2f(0.5000f, -0.3600f);
        glColor3f(0.16f, 0.14f, 0.27f);
        glVertex2f(1.0200f, -0.3600f);
        glColor3f(0.16f, 0.14f, 0.27f);
        glVertex2f(1.0200f, 0.4200f);
        glColor3f(0.16f, 0.14f, 0.27f);
        glVertex2f(0.5000f, 0.4200f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(0.4850f, 0.4200f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.0350f, 0.4200f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.0350f, 0.4450f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(0.4850f, 0.4450f);
        glColor3f(0.21f, 0.18f, 0.33f);
        glVertex2f(1.0200f, -0.3600f);
        glColor3f(0.21f, 0.18f, 0.33f);
        glVertex2f(1.6000f, -0.3600f);
        glColor3f(0.21f, 0.18f, 0.33f);
        glVertex2f(1.6000f, 0.1600f);
        glColor3f(0.21f, 0.18f, 0.33f);
        glVertex2f(1.0200f, 0.1600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.0050f, 0.1600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.6150f, 0.1600f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.6150f, 0.1850f);
        glColor3f(0.25f, 0.22f, 0.38f);
        glVertex2f(1.0050f, 0.1850f);
    glEnd();
    glPopMatrix();
}

void draw_Moon()
{
    // Moon
    glPushMatrix();
    // Transform
    glTranslatef(state_Moon.x, state_Moon.y, 0.0f);
    glRotatef(state_Moon.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Moon.scaleX, state_Moon.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.98f, 0.90f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.1100f, 0.0000f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.1046f, 0.0340f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0890f, 0.0647f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0647f, 0.0890f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0340f, 0.1046f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0000f, 0.1100f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0340f, 0.1046f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0647f, 0.0890f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0890f, 0.0647f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.1046f, 0.0340f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.1100f, 0.0000f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.1046f, -0.0340f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0890f, -0.0647f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0647f, -0.0890f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(-0.0340f, -0.1046f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0000f, -0.1100f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0340f, -0.1046f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0647f, -0.0890f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.0890f, -0.0647f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.1046f, -0.0340f);
        glColor3f(0.95f, 0.89f, 0.65f);
        glVertex2f(0.1100f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Stars()
{
    // Stars
    glPushMatrix();
    // Transform
    glTranslatef(state_Stars.x, state_Stars.y, 0.0f);
    glRotatef(state_Stars.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Stars.scaleX, state_Stars.scaleY, 1.0f);

    // Render
    glShadeModel(GL_FLAT);
    // Adjust visible point size — default is 1px
    glPointSize(8.0f);

    glBegin(GL_POINTS);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-1.4500f, 0.8200f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-1.1800f, 0.6400f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.9200f, 0.8600f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.6000f, 0.7400f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.2800f, 0.8400f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0500f, 0.7000f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.3000f, 0.8700f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.6200f, 0.7800f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.9000f, 0.8600f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(1.4800f, 0.8000f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(1.4000f, 0.5200f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.0200f, 0.5000f);
    glEnd();
    glPointSize(1.0f); // Reset
    glPopMatrix();
}

void draw_Sky()
{
    // Sky
    glPushMatrix();
    // Transform
    glTranslatef(state_Sky.x, state_Sky.y, 0.0f);
    glRotatef(state_Sky.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Sky.scaleX, state_Sky.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(0.29f, 0.18f, 0.39f);
        glVertex2f(-1.6000f, -0.4200f);
        glColor3f(0.29f, 0.18f, 0.39f);
        glVertex2f(1.6000f, -0.4200f);
        glColor3f(0.04f, 0.06f, 0.17f);
        glVertex2f(1.6000f, 0.9000f);
        glColor3f(0.04f, 0.06f, 0.17f);
        glVertex2f(-1.6000f, 0.9000f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_Sky();
    draw_Stars();
    draw_Moon();
    draw_Buildings();
    draw_Windows();
    draw_Store();
    draw_Store_sign();
    draw_Poles();
    draw_Wire();
    draw_Parol_1();
    draw_Parol_2();
    draw_Parol_3();
    draw_Parol_4();
    draw_Parol_strings();
    draw_Street_lamp();
    draw_Lamp_light();
    draw_Road();
    draw_Lane_line();
    // Jeepney
    glPushMatrix();
    // Transform
    glTranslatef(state_Jeepney.x, state_Jeepney.y, 0.0f);
    glRotatef(state_Jeepney.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Jeepney.scaleX, state_Jeepney.scaleY, 1.0f);

    // Children
    draw_Jeep_body();
    draw_Wheel_wells();
    draw_Rear_arch();
    draw_Front_fender();
    draw_Headlight();
        // Route
        glPushMatrix();
        // Transform
        glTranslatef(state_Route.x, state_Route.y, 0.0f);
        glRotatef(state_Route.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_Route.scaleX, state_Route.scaleY, 1.0f);

        // Text: "QUIAPO - MORAYTA"
        glColor3f(1.00f, 1.00f, 1.00f);
        glRasterPos2f(0.0f, 0.0000f);
        {
            const char* textLine = "QUIAPO - MORAYTA";
            for (const char* c = textLine; *c != '\0'; c++) {
                glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
            }
        }
        glPopMatrix();
        // Rear wheel
        glPushMatrix();
        // Transform
        glTranslatef(state_Rear_wheel.x, state_Rear_wheel.y, 0.0f);
        glRotatef(state_Rear_wheel.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_Rear_wheel.scaleX, state_Rear_wheel.scaleY, 1.0f);

        // Children
        draw_Rear_tyre();
        draw_Rear_rim();
        draw_Rear_hub();
        glPopMatrix();
        // Front wheel
        glPushMatrix();
        // Transform
        glTranslatef(state_Front_wheel.x, state_Front_wheel.y, 0.0f);
        glRotatef(state_Front_wheel.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_Front_wheel.scaleX, state_Front_wheel.scaleY, 1.0f);

        // Children
        draw_Front_tyre();
        draw_Front_rim();
        draw_Front_hub();
        glPopMatrix();
    glPopMatrix();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);

    // 2D orthographic projection — see glOrtho editor in VAMS
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-1.6000, 1.6000, -0.9000, 0.9000, -1.0, 1.0);

    // Switch to the modelview stack for object transforms
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    draw();
    glutSwapBuffers();
}

// Keyboard callback: glutKeyboardFunc
void onKey(unsigned char key, int x, int y)
{
    switch (key) {
    case ' ':
        state_Jeepney = initial_Jeepney;
        state_Rear_wheel = initial_Rear_wheel;
        state_Front_wheel = initial_Front_wheel;
        break;
    }
    glutPostRedisplay();
}

// Idle callback: glutIdleFunc
void onIdle()
{
    state_Jeepney.x += 0.01f;
    state_Jeepney.y += 0.00f;
    state_Rear_wheel.rotation += -6.00f;
    state_Front_wheel.rotation += -6.00f;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // No VBO primitives to initialise
    // --- Texture setup ---
    glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);

    // OpenGL expects the 0.0 Y-coordinate to be at the bottom, but images store it at the top
    stbi_set_flip_vertically_on_load(true);

    // Store sign — texture object
    glGenTextures(1, &tex_Store_sign);
    glBindTexture(GL_TEXTURE_2D, tex_Store_sign);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    {
        int width, height, channels;
        // IMPORTANT: Replace the placeholder below with the FULL ABSOLUTE FILE PATH to your image.
        // Using a relative path may fail if the working directory differs when running the executable.
        unsigned char* data = stbi_load("C:\\path\\to\\your\\Sari-sari sign.png", &width, &height, &channels, 4);
        if (data) {
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
    }
}

// Internal VAMS wrapper: run per-frame animation and updates
void _vams_idle()
{
    onIdle();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(800, 450);
    glutCreateWindow("VAMS Preview");

    glewExperimental = GL_TRUE;
    if (glewInit() != GLEW_OK) {
        return 1; // GLEW failed to load OpenGL extensions
    }

    glClearColor(0.04f, 0.06f, 0.17f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutIdleFunc(_vams_idle);

    glutMainLoop();
    return 0;
}
