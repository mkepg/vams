#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Centre_cap = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Second_hand = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Minute_hand = { 0.0000f, 0.0000f, -60.0000f, 1.0000f, 1.0000f };
ObjectState state_Hour_hand = { 0.0000f, 0.0000f, 55.0000f, 1.0000f, 1.0000f };
ObjectState state_Twelve = { -0.0450f, 0.5000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Three = { 0.5000f, -0.0300f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Six = { -0.0200f, -0.5800f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Nine = { -0.5500f, -0.0300f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Hour_ticks = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Minute_ticks = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Face = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Rim = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Second_hand = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Minute_hand = { 0.0000f, 0.0000f, -60.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Hour_hand = { 0.0000f, 0.0000f, 55.0000f, 1.0000f, 1.0000f };

void draw_Centre_cap();
void draw_Second_hand();
void draw_Minute_hand();
void draw_Hour_hand();
void draw_Hour_ticks();
void draw_Minute_ticks();
void draw_Face();
void draw_Rim();
void init();

void draw_Centre_cap()
{
    // Centre cap
    glPushMatrix();
    // Transform
    glTranslatef(state_Centre_cap.x, state_Centre_cap.y, 0.0f);
    glRotatef(state_Centre_cap.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Centre_cap.scaleX, state_Centre_cap.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.42f, 0.36f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0280f, 0.0000f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0242f, 0.0140f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0140f, 0.0242f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0000f, 0.0280f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(-0.0140f, 0.0242f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(-0.0242f, 0.0140f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(-0.0280f, 0.0000f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(-0.0242f, -0.0140f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(-0.0140f, -0.0242f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0000f, -0.0280f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0140f, -0.0242f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0242f, -0.0140f);
        glColor3f(0.72f, 0.14f, 0.10f);
        glVertex2f(0.0280f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Second_hand()
{
    // Second hand
    glPushMatrix();
    // Transform
    glTranslatef(state_Second_hand.x, state_Second_hand.y, 0.0f);
    glRotatef(state_Second_hand.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Second_hand.scaleX, state_Second_hand.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(-0.0070f, -0.1200f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.0070f, -0.1200f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(0.0042f, 0.6000f);
        glColor3f(0.83f, 0.22f, 0.17f);
        glVertex2f(-0.0042f, 0.6000f);
    glEnd();
    glPopMatrix();
}

void draw_Minute_hand()
{
    // Minute hand
    glPushMatrix();
    // Transform
    glTranslatef(state_Minute_hand.x, state_Minute_hand.y, 0.0f);
    glRotatef(state_Minute_hand.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Minute_hand.scaleX, state_Minute_hand.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.0220f, -0.0500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0220f, -0.0500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0132f, 0.5600f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.0132f, 0.5600f);
    glEnd();
    glPopMatrix();
}

void draw_Hour_hand()
{
    // Hour hand
    glPushMatrix();
    // Transform
    glTranslatef(state_Hour_hand.x, state_Hour_hand.y, 0.0f);
    glRotatef(state_Hour_hand.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Hour_hand.scaleX, state_Hour_hand.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.0300f, -0.0500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0300f, -0.0500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0180f, 0.3600f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.0180f, 0.3600f);
    glEnd();
    glPopMatrix();
}

void draw_Hour_ticks()
{
    // Hour ticks
    glPushMatrix();
    // Transform
    glTranslatef(state_Hour_ticks.x, state_Hour_ticks.y, 0.0f);
    glRotatef(state_Hour_ticks.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Hour_ticks.scaleX, state_Hour_ticks.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(3.00f);

    glBegin(GL_LINES);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0000f, 0.6000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0000f, 0.7000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.3000f, 0.5196f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.3500f, 0.6062f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.5196f, 0.3000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.6062f, 0.3500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.6000f, 0.0000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.7000f, 0.0000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.5196f, -0.3000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.6062f, -0.3500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.3000f, -0.5196f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.3500f, -0.6062f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0000f, -0.6000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(0.0000f, -0.7000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.3000f, -0.5196f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.3500f, -0.6062f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.5196f, -0.3000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.6062f, -0.3500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.6000f, 0.0000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.7000f, 0.0000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.5196f, 0.3000f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.6062f, 0.3500f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.3000f, 0.5196f);
        glColor3f(0.16f, 0.15f, 0.13f);
        glVertex2f(-0.3500f, 0.6062f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Minute_ticks()
{
    // Minute ticks
    glPushMatrix();
    // Transform
    glTranslatef(state_Minute_ticks.x, state_Minute_ticks.y, 0.0f);
    glRotatef(state_Minute_ticks.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Minute_ticks.scaleX, state_Minute_ticks.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(1.00f);

    glBegin(GL_LINES);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.0690f, 0.6564f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.0732f, 0.6962f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.1372f, 0.6456f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.1455f, 0.6847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2040f, 0.6277f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2163f, 0.6657f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2684f, 0.6029f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2847f, 0.6395f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.3879f, 0.5340f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4114f, 0.5663f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4416f, 0.4905f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4684f, 0.5202f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4905f, 0.4416f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5202f, 0.4684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5340f, 0.3879f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5663f, 0.4114f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6029f, 0.2684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6395f, 0.2847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6277f, 0.2040f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6657f, 0.2163f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6456f, 0.1372f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6847f, 0.1455f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6564f, 0.0690f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6962f, 0.0732f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6564f, -0.0690f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6962f, -0.0732f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6456f, -0.1372f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6847f, -0.1455f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6277f, -0.2040f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6657f, -0.2163f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6029f, -0.2684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.6395f, -0.2847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5340f, -0.3879f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5663f, -0.4114f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4905f, -0.4416f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.5202f, -0.4684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4416f, -0.4905f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4684f, -0.5202f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.3879f, -0.5340f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.4114f, -0.5663f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2684f, -0.6029f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2847f, -0.6395f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2040f, -0.6277f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.2163f, -0.6657f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.1372f, -0.6456f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.1455f, -0.6847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.0690f, -0.6564f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(0.0732f, -0.6962f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.0690f, -0.6564f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.0732f, -0.6962f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.1372f, -0.6456f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.1455f, -0.6847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2040f, -0.6277f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2163f, -0.6657f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2684f, -0.6029f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2847f, -0.6395f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.3879f, -0.5340f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4114f, -0.5663f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4416f, -0.4905f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4684f, -0.5202f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4905f, -0.4416f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5202f, -0.4684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5340f, -0.3879f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5663f, -0.4114f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6029f, -0.2684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6395f, -0.2847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6277f, -0.2040f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6657f, -0.2163f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6456f, -0.1372f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6847f, -0.1455f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6564f, -0.0690f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6962f, -0.0732f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6564f, 0.0690f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6962f, 0.0732f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6456f, 0.1372f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6847f, 0.1455f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6277f, 0.2040f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6657f, 0.2163f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6029f, 0.2684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.6395f, 0.2847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5340f, 0.3879f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5663f, 0.4114f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4905f, 0.4416f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.5202f, 0.4684f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4416f, 0.4905f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4684f, 0.5202f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.3879f, 0.5340f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.4114f, 0.5663f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2684f, 0.6029f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2847f, 0.6395f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2040f, 0.6277f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.2163f, 0.6657f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.1372f, 0.6456f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.1455f, 0.6847f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.0690f, 0.6564f);
        glColor3f(0.48f, 0.45f, 0.38f);
        glVertex2f(-0.0732f, 0.6962f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Face()
{
    // Face
    glPushMatrix();
    // Transform
    glTranslatef(state_Face.x, state_Face.y, 0.0f);
    glRotatef(state_Face.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Face.scaleX, state_Face.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.99f, 0.98f, 0.95f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7400f, 0.0000f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7337f, 0.0966f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7148f, 0.1915f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.6837f, 0.2832f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.6409f, 0.3700f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.5871f, 0.4505f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.5233f, 0.5233f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.4505f, 0.5871f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.3700f, 0.6409f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.2832f, 0.6837f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.1915f, 0.7148f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.0966f, 0.7337f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.0000f, 0.7400f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.0966f, 0.7337f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.1915f, 0.7148f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.2832f, 0.6837f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.3700f, 0.6409f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.4505f, 0.5871f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.5233f, 0.5233f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.5871f, 0.4505f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.6409f, 0.3700f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.6837f, 0.2832f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.7148f, 0.1915f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.7337f, 0.0966f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.7400f, 0.0000f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.7337f, -0.0966f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.7148f, -0.1915f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.6837f, -0.2832f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.6409f, -0.3700f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.5871f, -0.4505f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.5233f, -0.5233f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.4505f, -0.5871f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.3700f, -0.6409f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.2832f, -0.6837f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.1915f, -0.7148f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(-0.0966f, -0.7337f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.0000f, -0.7400f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.0966f, -0.7337f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.1915f, -0.7148f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.2832f, -0.6837f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.3700f, -0.6409f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.4505f, -0.5871f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.5233f, -0.5233f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.5871f, -0.4505f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.6409f, -0.3700f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.6837f, -0.2832f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7148f, -0.1915f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7337f, -0.0966f);
        glColor3f(0.90f, 0.86f, 0.78f);
        glVertex2f(0.7400f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Rim()
{
    // Rim
    glPushMatrix();
    // Transform
    glTranslatef(state_Rim.x, state_Rim.y, 0.0f);
    glRotatef(state_Rim.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Rim.scaleX, state_Rim.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.89f, 0.76f, 0.49f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.8000f, 0.0000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7932f, 0.1044f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7727f, 0.2071f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7391f, 0.3061f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.6928f, 0.4000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.6347f, 0.4870f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.5657f, 0.5657f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.4870f, 0.6347f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.4000f, 0.6928f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.3061f, 0.7391f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.2071f, 0.7727f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.1044f, 0.7932f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.0000f, 0.8000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.1044f, 0.7932f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.2071f, 0.7727f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.3061f, 0.7391f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.4000f, 0.6928f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.4870f, 0.6347f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.5657f, 0.5657f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.6347f, 0.4870f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.6928f, 0.4000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7391f, 0.3061f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7727f, 0.2071f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7932f, 0.1044f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.8000f, 0.0000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7932f, -0.1044f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7727f, -0.2071f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.7391f, -0.3061f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.6928f, -0.4000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.6347f, -0.4870f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.5657f, -0.5657f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.4870f, -0.6347f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.4000f, -0.6928f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.3061f, -0.7391f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.2071f, -0.7727f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(-0.1044f, -0.7932f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.0000f, -0.8000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.1044f, -0.7932f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.2071f, -0.7727f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.3061f, -0.7391f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.4000f, -0.6928f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.4870f, -0.6347f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.5657f, -0.5657f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.6347f, -0.4870f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.6928f, -0.4000f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7391f, -0.3061f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7727f, -0.2071f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.7932f, -0.1044f);
        glColor3f(0.54f, 0.42f, 0.18f);
        glVertex2f(0.8000f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_Rim();
    draw_Face();
    draw_Minute_ticks();
    draw_Hour_ticks();
    // Nine
    glPushMatrix();
    // Transform
    glTranslatef(state_Nine.x, state_Nine.y, 0.0f);
    glRotatef(state_Nine.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Nine.scaleX, state_Nine.scaleY, 1.0f);

    // Text: "9"
    glColor3f(0.16f, 0.15f, 0.13f);
    glRasterPos2f(0.0f, 0.0000f);
    {
        const char* textLine = "9";
        for (const char* c = textLine; *c != '\0'; c++) {
            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
        }
    }
    glPopMatrix();
    // Six
    glPushMatrix();
    // Transform
    glTranslatef(state_Six.x, state_Six.y, 0.0f);
    glRotatef(state_Six.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Six.scaleX, state_Six.scaleY, 1.0f);

    // Text: "6"
    glColor3f(0.16f, 0.15f, 0.13f);
    glRasterPos2f(0.0f, 0.0000f);
    {
        const char* textLine = "6";
        for (const char* c = textLine; *c != '\0'; c++) {
            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
        }
    }
    glPopMatrix();
    // Three
    glPushMatrix();
    // Transform
    glTranslatef(state_Three.x, state_Three.y, 0.0f);
    glRotatef(state_Three.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Three.scaleX, state_Three.scaleY, 1.0f);

    // Text: "3"
    glColor3f(0.16f, 0.15f, 0.13f);
    glRasterPos2f(0.0f, 0.0000f);
    {
        const char* textLine = "3";
        for (const char* c = textLine; *c != '\0'; c++) {
            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
        }
    }
    glPopMatrix();
    // Twelve
    glPushMatrix();
    // Transform
    glTranslatef(state_Twelve.x, state_Twelve.y, 0.0f);
    glRotatef(state_Twelve.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Twelve.scaleX, state_Twelve.scaleY, 1.0f);

    // Text: "12"
    glColor3f(0.16f, 0.15f, 0.13f);
    glRasterPos2f(0.0f, 0.0000f);
    {
        const char* textLine = "12";
        for (const char* c = textLine; *c != '\0'; c++) {
            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
        }
    }
    glPopMatrix();
    draw_Hour_hand();
    draw_Minute_hand();
    draw_Second_hand();
    draw_Centre_cap();
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
    case 'm':
    case 'M':
        state_Minute_hand.rotation += -6.00f;
        break;
    case 'h':
    case 'H':
        state_Hour_hand.rotation += -30.00f;
        break;
    case ' ':
        state_Second_hand = initial_Second_hand;
        state_Minute_hand = initial_Minute_hand;
        state_Hour_hand = initial_Hour_hand;
        break;
    }
    glutPostRedisplay();
}

// Idle callback: glutIdleFunc
void onIdle()
{
    state_Second_hand.rotation += -1.00f;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // No VBO primitives to initialise
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

    glClearColor(0.12f, 0.15f, 0.22f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutIdleFunc(_vams_idle);

    glutMainLoop();
    return 0;
}
