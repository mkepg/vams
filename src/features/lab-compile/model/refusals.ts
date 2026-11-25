/**
 * What a refusal says to do. A name a lab PC's headers declare and VAMS Lab's leave out stops the
 * build on its line, and the message names what to use instead:
 *
 *   glVertex2iv isn't part of VAMS Lab's OpenGL. Use glVertex2i(v[0], v[1]).
 *
 * The names lab/include/vams_rejected.h declares unavailable carry their own advice, in the same
 * form. Every other name of the reference toolchain's gl.h, glu.h, freeglut_std.h and
 * freeglut_ext.h that the Lab's headers leave out has a rule here (a test holds the list), and so
 * do the usual names of later OpenGL a program may carry, and the Windows calls students reach for.
 */

/** The text after a name that vams_rejected.h's VAMS_REJECT_MESSAGE writes. */
export const REJECTED_TEXT = " isn't part of VAMS Lab's OpenGL.";

/** The same, for a Windows call the Lab's small windows.h leaves out. */
export const WINDOWS_TEXT = " isn't part of VAMS Lab's windows.h.";

/** GL, GLU, GLUT and GLEW names: functions and constants. */
export const GL_NAME = /^(?:gl|glu|glut|glew)[A-Z]\w*$|^(?:GL|GLU|GLUT|GLEW)_\w+$/;
/** GL, GLU and GLUT type names. */
export const GL_TYPE = /^(?:GL|GLU|GLUT|GLEW)[a-z]\w*$/;

/**
 * The forms of the vertex, colour, texture coordinate, raster position and rectangle calls the
 * Lab's gl.h declares, by family.
 */
const forms = (family: string, ...suffixes: string[]) => suffixes.map((x) => family + x);
export const LAB_FORMS: Record<string, readonly string[]> = {
  glVertex: [...forms('glVertex2', 'f', 'i', 'd', 'fv'), ...forms('glVertex3', 'f', 'i', 'd', 'fv')],
  glColor: [...forms('glColor3', 'f', 'd', 'ub', 'fv', 'ubv'), ...forms('glColor4', 'f', 'd', 'ub', 'fv', 'ubv')],
  glTexCoord: forms('glTexCoord2', 'f', 'd', 'i', 'fv'),
  glRasterPos: [...forms('glRasterPos2', 'f', 'd', 'i'), 'glRasterPos3f'],
  glRect: forms('glRect', 'f', 'd', 'i'),
};

const COLOUR = 'Use glColor3f or glColor4f.';
const ON_EACH_VERTEX = 'Use glColor3f on each vertex.';
const DRAW_ORDER = 'Leave it out: each shape is drawn over the ones drawn before it.';
const KEEP_VALUE = 'Keep the value in a variable of your own when you set it.';
const LEAVE_OUT = 'Leave it out.';
const LEAVE_OUT_CALL = 'Leave out the call that uses it.';
const AS_TEXTURE = 'Draw the image as a texture: glTexImage2D, then glBegin(GL_QUADS) with glTexCoord2f.';
const BLEND = 'Use glEnable(GL_BLEND) with glBlendFunc.';
const CURVE = 'Work out points along the curve, and join them with glBegin(GL_LINE_STRIP).';
const PICK = "To find the shape under the mouse, test the click against each shape's bounds in your mouse callback.";
const ROUND = 'Draw the shape with glBegin(GL_TRIANGLE_FAN), using cosf and sinf for its points.';
const TESS = 'Split the shape into convex parts, and draw each with glBegin(GL_POLYGON).';
const RGB = "Use glColor3f: VAMS Lab's window is RGB.";
const DISPLAY_MODE = 'Use glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB).';
const ONE_WINDOW = "Draw in the program's one window, with glViewport for each area.";
const IN_VIEW = "Leave it out: the program's window stays in view while it runs.";
const KEYS_AND_MOUSE = 'Use the keyboard and mouse callbacks: glutKeyboardFunc, glutSpecialFunc and glutMouseFunc.';
const HELD_KEYS = 'Track held keys yourself: set a flag in glutKeyboardFunc, and clear it in glutKeyboardUpFunc.';
const REBUILD_MENU = 'Build the menu again: glutDestroyMenu, then glutCreateMenu and its entries.';
const GLUT_GET =
  'Ask glutGet for GLUT_WINDOW_WIDTH, GLUT_WINDOW_HEIGHT, GLUT_SCREEN_WIDTH, GLUT_SCREEN_HEIGHT or GLUT_ELAPSED_TIME, or keep the value yourself.';
const BITMAP_TEXT = 'Use glutBitmapString or glutBitmapCharacter with a bitmap font, such as GLUT_BITMAP_9_BY_15.';
const OPENGL_15 = "Draw with glBegin and glEnd, or glVertexPointer and glDrawArrays: VAMS Lab's OpenGL is version 1.5, without shaders.";
const STATE_BACK = 'Set the state back yourself after drawing, for example glDisable(GL_BLEND) or glLineWidth(1).';
const ONCE_EACH = 'Call glDrawArrays or glDrawElements once for each copy.';

/** Each rule: the names it covers, and what to do. The first rule that covers a name gives its advice. */
const RULES: [RegExp, string][] = [
  // The names vams_rejected.h refuses, for a program that uses one without including gl.h
  [/^(gluPerspective|glFrustum)$/, 'Use glOrtho or gluOrtho2D.'],
  [/^gluLookAt$/, 'Use glTranslatef and glRotatef.'],
  [/^glut(Solid|Wire)[A-Z][A-Za-z]+$/, 'Use glBegin with GL_POLYGON, GL_QUADS or GL_LINE_LOOP.'],

  // Depth
  [/^gl(DepthFunc|DepthMask|ClearDepth|DepthRange|PolygonOffset)$/, DRAW_ORDER],
  [/^GL_(DEPTH(_[A-Z]+)*|POLYGON_OFFSET_[A-Z]+)$/, DRAW_ORDER],
  [/^GLUT_WINDOW_DEPTH_SIZE$/, DRAW_ORDER],

  // Lights, materials and normals
  [/^gl(Light|LightModel|Material)[fi]v?$|^glColorMaterial$/, COLOUR],
  [/^glGet(Light|Material)[fi]v$/, COLOUR],
  [/^GL_(LIGHT\d|LIGHTING|LIGHT_MODEL_[A-Z_]+|AMBIENT|DIFFUSE|SPECULAR|EMISSION|SHININESS|POSITION|SPOT_[A-Z]+|[A-Z]+_ATTENUATION|COLOR_MATERIAL(_[A-Z]+)*|AMBIENT_AND_DIFFUSE|COLOR_INDEXES|NORMALIZE|MAX_LIGHTS)$/, COLOUR],
  [/^GL_(CURRENT_NORMAL|NORMAL_ARRAY(_[A-Z]+)*)$/, ON_EACH_VERTEX],
  [/^glNormal3(b|s|i|f|d)v?$/, ON_EACH_VERTEX],

  // Faces
  [/^gl(CullFace|FrontFace)$/, 'Leave it out: both sides of every shape are drawn.'],
  [/^GL_(CULL_FACE(_MODE)?|FRONT_FACE|CW|CCW)$/, 'Leave it out: both sides of every shape are drawn.'],

  // Fog
  [/^glFog[fi]v?$/, 'Leave it out, and fade shapes with glColor4f and GL_BLEND instead.'],
  [/^GL_(FOG(_[A-Z]+)*|EXP2?)$/, 'Leave it out, and fade shapes with glColor4f and GL_BLEND instead.'],

  // Buffers other than colour
  [/^gl(Stencil(Func|Mask|Op)|ClearStencil|Accum|ClearAccum)$/, "Leave it out: VAMS Lab draws to the window's colour buffer only."],
  [/^GL_(STENCIL(_[A-Z]+)*|ACCUM(_[A-Z]+)*|KEEP|INCR|DECR|INVERT|LOAD|RETURN|MULT|ADD)$/, "Leave it out: VAMS Lab draws to the window's colour buffer only."],
  [/^gl(ColorMask|DrawBuffer|ReadBuffer)$/, 'Leave it out: drawing goes to the window glutInitDisplayMode chose.'],
  [/^GL_(COLOR_WRITEMASK|DRAW_BUFFER|READ_BUFFER|FRONT_LEFT|FRONT_RIGHT|BACK_LEFT|BACK_RIGHT|LEFT|RIGHT|AUX\d|AUX_BUFFERS|STEREO|DOUBLEBUFFER)$/, 'Leave it out: drawing goes to the window glutInitDisplayMode chose.'],

  // Clipping, alpha test and logic ops
  [/^gl(Get)?ClipPlane$/, 'Use glScissor to keep drawing inside a rectangle.'],
  [/^GL_(CLIP_PLANE\d|MAX_CLIP_PLANES)$/, 'Use glScissor to keep drawing inside a rectangle.'],
  [/^glAlphaFunc$/, BLEND],
  [/^GL_ALPHA_TEST(_[A-Z]+)*$/, BLEND],
  [/^GL_(NEVER|LESS|EQUAL|LEQUAL|GREATER|NOTEQUAL|GEQUAL|ALWAYS)$/, LEAVE_OUT_CALL],

  // Evaluators and NURBS (before logic ops: GL_ORDER isn't GL_OR)
  [/^gl(Map[12][df]|MapGrid[12][df]|EvalCoord[12][df]v?|EvalMesh[12]|EvalPoint[12]|GetMap[dfi]v)$/, CURVE],
  [/^glu(NewNurbsRenderer|DeleteNurbsRenderer|Nurbs[A-Za-z]+|GetNurbsProperty|BeginCurve|EndCurve|BeginSurface|EndSurface|BeginTrim|EndTrim|PwlCurve|LoadSamplingMatrices)$/, CURVE],
  [/^GL_(MAP[12]_[A-Z0-9_]+|COEFF|ORDER|DOMAIN|MAX_EVAL_ORDER|AUTO_NORMAL|EVAL_BIT)$/, CURVE],
  [/^GLU_(NURBS_[A-Z_]+|AUTO_LOAD_MATRIX|CULLING|SAMPLING_[A-Z_]+|PARAMETRIC_[A-Z_]+|DOMAIN_DISTANCE|PATH_LENGTH|OUTLINE_[A-Z_]+|DISPLAY_MODE|U_STEP|V_STEP|MAP1_TRIM_[23]|NURBS_ERROR\d+)$/, CURVE],

  [/^glLogicOp$/, 'Use glEnable(GL_BLEND) with glBlendFunc to mix colours.'],
  [/^GL_(LOGIC_OP(_MODE)?|COLOR_LOGIC_OP|INDEX_LOGIC_OP|CLEAR|SET|COPY|COPY_INVERTED|NOOP|AND(_[A-Z]+)?|OR(_[A-Z]+)?|NAND|NOR|XOR|EQUIV)$/, 'Use glEnable(GL_BLEND) with glBlendFunc to mix colours.'],

  // Colour index mode
  [/^gl(Index[a-z]+|ClearIndex|IndexMask|IndexPointer)$/, RGB],
  [/^GL_(INDEX(_[A-Z]+)*|COLOR_INDEX\d*(_EXT)?|CURRENT_INDEX|CURRENT_RASTER_INDEX|INDEX_ARRAY(_[A-Z]+)*)$/, RGB],

  // Pixels
  [/^glBitmap$/, 'Use glutBitmapCharacter for text, or a texture for an image.'],
  [/^glPixelStoref$/, 'Use glPixelStorei.'],
  [/^gl(ReadPixels|DrawPixels|CopyPixels|PixelZoom|PixelTransfer[fi]|PixelMap[a-z]+|GetPixelMap[a-z]+)$/, AS_TEXTURE],
  [/^GL_(PACK_[A-Z_]+|UNPACK_[A-Z_]+|MAP_COLOR|MAP_STENCIL|(RED|GREEN|BLUE|ALPHA|DEPTH)_(SCALE|BIAS)|PIXEL_MAP_[A-Z_]+|ZOOM_[XY]|BITMAP|COLOR|DEPTH|STENCIL|PIXEL_MODE_BIT)$/, AS_TEXTURE],

  // Textures
  [/^gl(TexImage1D|TexSubImage1D)$/, 'Use glTexImage2D.'],
  [/^gl(TexSubImage2D|CopyTexImage[12]D|CopyTexSubImage[12]D)$/, 'Use glTexImage2D to load the whole image again.'],
  [/^glGetTex[A-Za-z]+$/, KEEP_VALUE],
  [/^glTexGen[dfi]v?$/, 'Use glTexCoord2f on each vertex.'],
  [/^GL_(TEXTURE_GEN_[STRQ]|TEXTURE_GEN_MODE|[STRQ]|OBJECT_LINEAR|EYE_LINEAR|SPHERE_MAP|EYE_PLANE|OBJECT_PLANE)$/, 'Use glTexCoord2f on each vertex.'],
  [/^glTexEnv[fi]v$/, 'Use glTexEnvi.'],
  [/^glTexParameteriv$/, 'Use glTexParameteri.'],
  [/^gl(AreTexturesResident|PrioritizeTextures)$/, LEAVE_OUT],
  [/^glIsTexture$/, 'Keep the ids glGenTextures gives you.'],
  [/^gluBuild[12]DMipmaps$/, 'Use glTexImage2D, with GL_LINEAR filtering.'],
  [/^gluScaleImage$/, 'Use the image at its own size, and draw the quad at the size you want.'],
  [/^GL_(TEXTURE_1D|PROXY_TEXTURE_[12]D|TEXTURE_BINDING_1D|TEXTURE_(BORDER(_COLOR)?|COMPONENTS|INTERNAL_FORMAT|RED_SIZE|GREEN_SIZE|BLUE_SIZE|ALPHA_SIZE|LUMINANCE_SIZE|INTENSITY_SIZE|PRIORITY|RESIDENT|WIDTH|HEIGHT))$/, LEAVE_OUT_CALL],
  [/^GL_((ALPHA|LUMINANCE|INTENSITY|RGB|RGBA)\d+(_ALPHA\d+)?|RGB5_A1|RGB10_A2|R3_G3_B2|INTENSITY|LUMINANCE|LUMINANCE_ALPHA|ALPHA|RED|GREEN|BLUE|BGR_EXT|BGRA_EXT)$/, 'Use GL_RGB or GL_RGBA.'],
  [/^GL_(DECAL|DOUBLE_EXT)$/, LEAVE_OUT_CALL],

  // Attributes
  [/^gl(Push|Pop)(Client)?Attrib$/, STATE_BACK],
  [/^GL_([A-Z_]+_BIT|ALL_ATTRIB_BITS|CLIENT_ALL_ATTRIB_BITS)$/, STATE_BACK],

  // Hints and smoothing
  [/^glHint$/, LEAVE_OUT],
  [/^GL_([A-Z_]+_HINT(_WIN)?|FASTEST|NICEST|DONT_CARE|LINE_SMOOTH|POINT_SMOOTH|POLYGON_SMOOTH|DITHER|PHONG_WIN)$/, LEAVE_OUT],

  // Display lists
  [/^glCallLists$/, 'Call glCallList for each list.'],
  [/^glListBase$/, 'Add the base to each id, and call glCallList.'],
  [/^glIsList$/, 'Keep the ids glGenLists gives you.'],
  [/^GL_(COMPILE_AND_EXECUTE)$/, 'Use GL_COMPILE, then glCallList.'],
  [/^GL_([234]_BYTES)$/, 'Call glCallList for each list.'],

  // Selection and feedback
  [/^gl(RenderMode|SelectBuffer|InitNames|LoadName|PushName|PopName|FeedbackBuffer|PassThrough)$/, PICK],
  [/^gluPickMatrix$/, PICK],
  [/^GL_(SELECT|FEEDBACK|RENDER|RENDER_MODE|NAME_STACK_DEPTH|MAX_NAME_STACK_DEPTH|SELECTION_BUFFER_[A-Z]+|FEEDBACK_BUFFER_[A-Z]+|2D|3D|3D_COLOR|3D_COLOR_TEXTURE|4D_COLOR_TEXTURE|[A-Z_]+_TOKEN)$/, PICK],

  // Edge flags, interleaved arrays and single elements
  [/^glEdgeFlag[A-Za-z]*$/, LEAVE_OUT],
  [/^GL_EDGE_FLAG(_[A-Z]+)*$/, LEAVE_OUT],
  [/^glInterleavedArrays$/, 'Use glVertexPointer and glColorPointer, with a stride.'],
  [/^GL_([CNT][0-9A-Z_]*_V[234]F|V[23]F)$/, 'Use glVertexPointer and glColorPointer, with a stride.'],
  [/^glArrayElement$/, 'Use glDrawArrays or glDrawElements.'],

  // Polygon stipple
  [/^gl(Get)?PolygonStipple$/, 'Use glLineStipple for dashed lines, or a texture for a patterned fill.'],
  [/^GL_POLYGON_STIPPLE$/, 'Use glLineStipple for dashed lines, or a texture for a patterned fill.'],

  // Values read back from OpenGL
  [/^glGet(Booleanv|Integerv|Floatv|Doublev|Pointerv)$/, 'Keep the value in a variable of your own when you set it, or ask glutGet for the window\'s size.'],
  [/^GL_(CURRENT_[A-Z_]+|MAX_[A-Z_]+|[A-Z]+_BITS|[A-Z_]+_STACK_DEPTH|[A-Z]+_MATRIX|[A-Z]+_CLEAR_VALUE|[A-Z]+_WRITEMASK|MATRIX_MODE|VIEWPORT|SCISSOR_BOX|LINE_WIDTH(_[A-Z]+)?|POINT_SIZE(_[A-Z]+)?|LINE_STIPPLE_[A-Z]+|POLYGON_MODE|SHADE_MODEL|BLEND_(SRC|DST)|LIST_[A-Z]+|SUBPIXEL_BITS|[A-Z_]+_ARRAY_(SIZE|STRIDE|TYPE|POINTER|COUNT)(_EXT)?|[A-Z_]+_ARRAY_EXT|TEXTURE_BINDING_2D|TEXTURE_STACK_DEPTH|MAX_ELEMENTS_[A-Z]+_WIN|COLOR_TABLE_[A-Z_]+|RGBA_MODE|INDEX_MODE|AUX_BUFFERS)$/, KEEP_VALUE],

  // GLU
  [/^(gluNewQuadric|gluDeleteQuadric|gluQuadric[A-Za-z]+|gluDisk|gluPartialDisk|gluCylinder|gluSphere)$/, ROUND],
  [/^GLU_(FILL|LINE|SILHOUETTE|POINT|SMOOTH|FLAT|NONE|OUTSIDE|INSIDE)$/, ROUND],
  [/^GLUquadric(Obj)?$/, ROUND],
  [/^glu(NewTess|DeleteTess|Tess[A-Za-z]+|BeginPolygon|EndPolygon|NextContour|GetTessProperty)$/, TESS],
  [/^GLU_(TESS_[A-Z0-9_]+|BEGIN|VERTEX|END|ERROR|EDGE_FLAG|CW|CCW|INTERIOR|EXTERIOR|UNKNOWN)$/, TESS],
  [/^GLU(tesselator|tesselatorObj|triangulatorObj)$/, TESS],
  [/^GLUnurbs(Obj)?$/, CURVE],
  [/^gluUnProject$/, 'Work out the position from your glOrtho bounds: x = left + mouseX * (right - left) / width.'],
  [/^gluProject$/, 'Work out the window position from your glOrtho bounds: mouseX = (x - left) * width / (right - left).'],
  [/^glu(ErrorStringWIN|ErrorUnicodeStringEXT)$/, 'Use gluErrorString.'],
  [/^gluGetString$/, LEAVE_OUT],
  [/^GLU_(VERSION|EXTENSIONS)$/, LEAVE_OUT],
  [/^GLU_(FALSE|TRUE)$/, 'Use GL_FALSE or GL_TRUE.'],
  [/^GLU_(INVALID_ENUM|INVALID_VALUE|INVALID_OPERATION|OUT_OF_MEMORY|INCOMPATIBLE_GL_VERSION)$/, 'Compare glGetError() with GL_NO_ERROR, and print gluErrorString for any other value.'],
  [/^(GLU_VERSION_\d_\d|GL_(EXT|WIN|ARB)_[a-z_]+)$/, "Leave it out: VAMS Lab's headers declare the calls it has."],

  // Blending, texture modes and matrices
  [/^GL_SRC_ALPHA_SATURATE$/, 'Use GL_SRC_ALPHA.'],
  [/^GL_TEXTURE_ENV_COLOR$/, 'Leave it out, and colour the quad with glColor3f.'],
  [/^GL_TEXTURE$/, 'Use GL_MODELVIEW or GL_PROJECTION.'],

  // GLUT: text and the pointer
  [/^glutStroke[A-Za-z]+$/, BITMAP_TEXT],
  [/^GLUT_STROKE_(ROMAN|MONO_ROMAN)$/, BITMAP_TEXT],
  [/^glutSetCursor$/, LEAVE_OUT],
  [/^GLUT_(CURSOR_[A-Z_]+|WINDOW_CURSOR)$/, LEAVE_OUT],
  [/^glutWarpPointer$/, LEAVE_OUT],

  // GLUT: windows
  [/^glutCreateSubWindow$/, ONE_WINDOW],
  [/^glut(SetWindow|GetWindowData|SetWindowData)$/, ONE_WINDOW],
  [/^GLUT_(WINDOW_PARENT|WINDOW_NUM_CHILDREN)$/, ONE_WINDOW],
  [/^glutPostWindowRedisplay$/, 'Use glutPostRedisplay.'],
  [/^glutSetIconTitle$/, 'Use glutSetWindowTitle.'],
  [/^glut(Hide|Show|Iconify|Push|Pop)Window$/, IN_VIEW],
  [/^glutLeaveFullScreen$/, 'Use glutReshapeWindow to give the window its size again.'],
  [/^glutFullScreenToggle$/, 'Use glutFullScreen, and glutReshapeWindow to leave it.'],
  [/^glut(GameModeString|EnterGameMode|LeaveGameMode|GameModeGet)$/, 'Use glutFullScreen.'],
  [/^GLUT_GAME_MODE_[A-Z_]+$/, 'Use glutFullScreen.'],
  [/^GLUT_FULL_SCREEN$/, 'Keep a flag of your own when you call glutFullScreen.'],

  // GLUT: overlays, layers and colour maps
  [/^glut(EstablishOverlay|RemoveOverlay|UseLayer|PostOverlayRedisplay|PostWindowOverlayRedisplay|ShowOverlay|HideOverlay|OverlayDisplayFunc|LayerGet)$/, 'Draw the overlay last in your display function, so it sits on top.'],
  [/^GLUT_(OVERLAY(_[A-Z]+)*|LAYER_IN_USE|NORMAL|NORMAL_DAMAGED|HAS_OVERLAY|TRANSPARENT_INDEX)$/, 'Draw the overlay last in your display function, so it sits on top.'],
  [/^glut(SetColor|GetColor|CopyColormap)$/, 'Use glColor3f.'],
  [/^GLUT_(RED|GREEN|BLUE)$/, 'Use glColor3f.'],
  [/^GLUT_WINDOW_COLORMAP_SIZE$/, 'Use glColor3f.'],

  // GLUT: callbacks
  [/^glutWMCloseFunc$/, 'Use glutCloseFunc.'],
  [/^glutEntryFunc$/, 'Use glutPassiveMotionFunc to follow the pointer over the window.'],
  [/^GLUT_(LEFT|ENTERED)$/, 'Use glutPassiveMotionFunc to follow the pointer over the window.'],
  [/^glut(Visibility|WindowStatus|Position|AppStatus)Func$/, IN_VIEW],
  [/^GLUT_(VISIBLE|NOT_VISIBLE|HIDDEN|FULLY_RETAINED|PARTIALLY_RETAINED|FULLY_COVERED|APPSTATUS_[A-Z]+)$/, IN_VIEW],
  [/^glut(MenuStatus|MenuState|MenuDestroy)Func$/, 'Leave it out: the menu calls its callback when an entry is chosen.'],
  [/^GLUT_(MENU_IN_USE|MENU_NOT_IN_USE)$/, 'Leave it out: the menu calls its callback when an entry is chosen.'],
  [/^glut(Joystick[A-Za-z]*|ForceJoystickFunc|Spaceball[A-Za-z]+Func|DialsFunc|ButtonBoxFunc|Tablet[A-Za-z]+Func|Multi[A-Za-z]+Func)$/, KEYS_AND_MOUSE],
  [/^GLUT_(HAS_[A-Z_]+|NUM_[A-Z_]+|JOYSTICK_[A-Z_]+|OWNS_JOYSTICK)$/, KEYS_AND_MOUSE],
  [/^glutDeviceGet$/, KEYS_AND_MOUSE],

  // GLUT: menus
  [/^glut(GetMenu|SetMenu)$/, 'Keep the id glutCreateMenu returns, and add the entries straight after creating the menu.'],
  [/^glut(ChangeToMenuEntry|ChangeToSubMenu|RemoveMenuItem)$/, REBUILD_MENU],
  [/^glut(SetMenuData|GetMenuData)$/, "Keep the data in a variable of your own, by the menu's id."],
  [/^glutSetMenuFont$/, LEAVE_OUT],
  [/^GLUT_MENU_NUM_ITEMS$/, 'Count the entries as you add them.'],

  // GLUT: keys
  [/^glut(IgnoreKeyRepeat|SetKeyRepeat)$/, HELD_KEYS],
  [/^GLUT_(KEY_REPEAT_[A-Z]+|DEVICE_IGNORE_KEY_REPEAT|DEVICE_KEY_REPEAT)$/, HELD_KEYS],

  // GLUT: the main loop, start-up and the rest
  [/^glutMainLoopEvent$/, 'Use glutMainLoop, with glutIdleFunc or glutTimerFunc for work between frames.'],
  [/^glutExit$/, 'Use glutLeaveMainLoop, or exit(0).'],
  [/^glutInitDisplayString$/, DISPLAY_MODE],
  [/^GLUT_(ACCUM|INDEX|STEREO|LUMINANCE|SRGB|BORDERLESS|CAPTIONLESS|AUX\d?)$/, DISPLAY_MODE],
  [/^glutInitContext[A-Za-z]+$/, "Leave it out: every program gets VAMS Lab's OpenGL 1.5."],
  [/^GLUT_(CORE_PROFILE|COMPATIBILITY_PROFILE|DEBUG|FORWARD_COMPATIBLE|INIT_MAJOR_VERSION|INIT_MINOR_VERSION|INIT_PROFILE|INIT_FLAGS)$/, "Leave it out: every program gets VAMS Lab's OpenGL 1.5."],
  [/^glut(InitErrorFunc|InitWarningFunc)$/, "Leave it out: FreeGLUT's messages show in the Console."],
  [/^glut(ExtensionSupported|GetProcAddress)$/, "Call the function by its name: VAMS Lab's headers declare every call it has."],
  [/^glutReportErrors$/, 'Use glGetError.'],
  [/^glut(SetupVideoResizing|StopVideoResizing|VideoResize|VideoPan|VideoResizeGet|GetModeValues|SetVertexAttrib[A-Za-z0-9]+)$/, LEAVE_OUT],
  [/^glut[A-Za-z]+_ATEXIT_HACK$/, LEAVE_OUT],
  [/^GLUT_VIDEO_RESIZE_[A-Z_]+$/, LEAVE_OUT],
  [/^GLUT_([A-Z_]+_CONTEXT|RENDERING_CONTEXT|DIRECT_RENDERING|SKIP_STALE_MOTION_EVENTS|GEOMETRY_VISUALIZE_NORMALS|STROKE_FONT_DRAW_JOIN_DOTS|DISABLE_ATEXIT_HACK|XLIB_IMPLEMENTATION)$/, LEAVE_OUT],
  [/^GLUT_(WINDOW_[A-Z_]+|SCREEN_[A-Z]+_MM|INIT_STATE|INIT_DISPLAY_MODE|DISPLAY_MODE_POSSIBLE|VERSION)$/, GLUT_GET],

  // Later OpenGL, through GLEW
  [/^gl(Create|Delete|Attach|Detach|Compile|Link|Use|Validate|Is)(Shader|Program)[A-Za-z]*$|^glShaderSource[A-Za-z]*$|^glGet(Shader|Program)[A-Za-z]+$|^glGet(Uniform|Attrib)Location[A-Za-z]*$|^glBindAttribLocation[A-Za-z]*$|^glUniform[A-Za-z0-9]+$|^glVertexAttrib[A-Za-z0-9]+$|^gl(Enable|Disable)VertexAttribArray[A-Za-z]*$|^glBindFragDataLocation[A-Za-z]*$/, OPENGL_15],
  [/^GL_([A-Z_]+_SHADER|COMPILE_STATUS|LINK_STATUS|VALIDATE_STATUS|INFO_LOG_LENGTH|SHADING_LANGUAGE_VERSION|CURRENT_PROGRAM|ACTIVE_UNIFORMS|ACTIVE_ATTRIBUTES)$/, OPENGL_15],
  [/^GLchar$/, OPENGL_15],
  [/^gl(Gen|Bind|Delete|Is)VertexArrays?[A-Za-z]*$/, 'Leave it out: call glBindBuffer and glVertexPointer before each draw.'],
  [/^glGenerateMipmap[A-Za-z]*$/, 'Leave it out, and use GL_LINEAR filtering.'],
  [/^gl(ActiveTexture|ClientActiveTexture)[A-Za-z]*$|^glMultiTexCoord[A-Za-z0-9]+$/, 'Use one texture at a time, with glBindTexture.'],
  [/^GL_TEXTURE\d+$/, 'Use one texture at a time, with glBindTexture.'],
  [/^gl(Gen|Bind|Delete|Is)(Frame|Render)buffers?[A-Za-z]*$|^glFramebuffer[A-Za-z0-9]+$|^glRenderbufferStorage[A-Za-z]*$|^glCheckFramebufferStatus[A-Za-z]*$|^glBlitFramebuffer[A-Za-z]*$/, 'Draw straight to the window.'],
  [/^GL_(FRAMEBUFFER[A-Z_]*|RENDERBUFFER[A-Z_]*|COLOR_ATTACHMENT\d+|DEPTH_ATTACHMENT)$/, 'Draw straight to the window.'],
  [/^glMapBufferRange[A-Za-z]*$/, 'Use glMapBuffer.'],
  [/^gl(DrawArrays|DrawElements)Instanced[A-Za-z]*$/, ONCE_EACH],
  [/^glMultiDraw(Arrays|Elements)[A-Za-z]*$/, ONCE_EACH],
  [/^glDrawRangeElements[A-Za-z]*$/, 'Use glDrawElements.'],
  [/^glBlend(Equation|FuncSeparate|Color)[A-Za-z]*$/, 'Use glBlendFunc.'],
  [/^glPointParameter[A-Za-z]+$/, 'Use glPointSize.'],
  [/^glGetBuffer[A-Za-z]+$/, KEEP_VALUE],
  [/^glIsBuffer[A-Za-z]*$/, 'Keep the ids glGenBuffers gives you.'],
  [/^gl(Gen|Delete|Begin|End|Is)Quer(y|ies)[A-Za-z]*$|^glGetQuery[A-Za-z]+$/, 'Time the program with glutGet(GLUT_ELAPSED_TIME).'],
  [/^glDebugMessage[A-Za-z]+$/, 'Use glGetError.'],
  [/^glGetStringi$/, 'Use glGetString.'],
];

/** The advice for a vertex, colour, texture coordinate, raster position or rectangle call in a form the Lab lacks. */
function otherForm(name: string): string | null {
  const rect = /^glRect([sifd])(v?)$/.exec(name);
  if (rect) {
    const type = LAB_FORMS.glRect.includes(`glRect${rect[1]}`) ? rect[1] : rect[1] === 's' ? 'i' : 'f';
    return rect[2] ? `Use glRect${type}(v1[0], v1[1], v2[0], v2[1]).` : `Use glRect${type}.`;
  }
  const m = /^(glVertex|glColor|glTexCoord|glRasterPos)([1-4])(b|s|i|f|d|ub|us|ui)(v?)$/.exec(name);
  if (!m) return null;
  const [, family, count, type, vector] = m;
  const known = LAB_FORMS[family].map((name) => name.slice(family.length));
  const has = (form: string) => known.includes(form);
  // Colours given as whole numbers map their range to 0 to 1, so only unsigned bytes keep their meaning.
  const typed = family === 'glColor' ? (type === 'ub' ? 'ub' : type === 'd' ? 'd' : 'f') : type === 's' ? 'i' : type;
  const chosen = [`${count}${typed}`, `${count}f`].find(has);
  if (!chosen) {
    // Another count: the nearest the family has, in floats.
    const counts = [...new Set(known.map((f) => Number(f[0])))].sort((a, b) => Math.abs(a - Number(count)) - Math.abs(b - Number(count)) || b - a);
    return `Use ${family}${counts[0]}f.`;
  }
  if (!vector) return `Use ${family}${chosen}.`;
  const args = Array.from({ length: Number(count) }, (_, i) => `v[${i}]`).join(', ');
  return `Use ${family}${chosen}(${args}).`;
}

/** Later OpenGL's suffixed names (glGenBuffersARB), for which the Lab has the plain call. */
const SUFFIX = /^(gl[A-Z]\w*?)(ARB|EXT|NV|ATI|AMD|KHR|OES|SGIS|SGIX|APPLE|INTEL|MESA|IBM|SUN|WIN|HP|3DFX)$/;

/**
 * What to do instead of a GL, GLU, GLUT or GLEW name the Lab's headers leave out, or null when no
 * rule covers it. `known` says whether the Lab declares a name, for the suffixed forms.
 */
export function refusalAdvice(name: string, known: (name: string) => boolean = () => false): string | null {
  const form = otherForm(name);
  if (form) return form;
  for (const [names, advice] of RULES) if (names.test(name)) return advice;
  const suffixed = SUFFIX.exec(name);
  if (suffixed) return known(suffixed[1]) ? `Use ${suffixed[1]}.` : refusalAdvice(suffixed[1], known);
  return null;
}

/**
 * What freeglut_ext.h declares: FreeGLUT's additions, which <GL/glut.h> leaves out on a lab PC as in
 * the Lab, and <GL/freeglut.h> brings.
 */
export const FREEGLUT_EXT =
  /^(GLUT_KEY_(NUM_LOCK|BEGIN|DELETE|SHIFT_[LR]|CTRL_[LR]|ALT_[LR])|GLUT_ACTION_[A-Z_]+|glut(SetOption|LeaveMainLoop|MouseWheelFunc|CloseFunc|BitmapHeight|BitmapString))$/;

/** The message for a FreeGLUT addition used with only <GL/glut.h> included. */
export const freeglutMessage = (name: string) => `${name} is in <GL/freeglut.h>, which <GL/glut.h> leaves out. Write #include <GL/freeglut.h>.`;

/** Windows calls students reach for, and what to do in the Lab. */
const WINDOWS: [RegExp, string][] = [
  [/^MessageBox[AW]?$/, 'Print the message with printf: it shows in the Console.'],
  [/^Get(Async)?KeyState$/, HELD_KEYS],
  [/^(GetTickCount(64)?|timeGetTime|QueryPerformanceCounter|QueryPerformanceFrequency)$/, 'Use glutGet(GLUT_ELAPSED_TIME), the milliseconds since glutInit.'],
  [/^(PlaySound[AW]?|sndPlaySound[AW]?|Beep|mciSendString[AW]?)$/, LEAVE_OUT],
  [/^GetSystemMetrics$/, 'Use glutGet(GLUT_SCREEN_WIDTH) and glutGet(GLUT_SCREEN_HEIGHT).'],
  [/^(SetConsoleTextAttribute|GetStdHandle|SetConsoleCursorPosition|SetConsoleTitle[AW]?|GetConsoleWindow)$/, 'Leave it out: printf writes to the Console, and system("cls") clears it.'],
  [/^ZeroMemory$/, 'Use memset(p, 0, size), from <cstring>.'],
  [/^CopyMemory$/, 'Use memcpy, from <cstring>.'],
  [/^(GetCursorPos|SetCursorPos|ShowCursor|ScreenToClient)$/, 'Use glutPassiveMotionFunc and glutMotionFunc for where the pointer is in the window.'],
  [/^(CreateThread|_beginthread(ex)?)$/, 'Use glutTimerFunc or glutIdleFunc for work alongside drawing.'],
  [/^ExitProcess$/, 'Use exit(0).'],
];

/** What to do instead of a Windows call the Lab's windows.h leaves out, or null when it isn't one the Lab knows of. */
export function windowsAdvice(name: string): string | null {
  return WINDOWS.find(([names]) => names.test(name))?.[1] ?? null;
}
