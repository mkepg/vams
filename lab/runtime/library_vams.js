// The Lab's bridge from a student's program to the worker it runs in. Every GL, GLU and GLUT
// call the bundled headers declare is an import here, and each one forwards to
// globalThis.__vamsLab (src/features/lab-run/worker/lab-worker.ts): GL calls to its GL context,
// GLUT calls to its GLUT runtime, and the console and Windows extras (conio.c, windows.c,
// system()) to its Console. Pointers become typed-array views of the program's memory, strings
// are read as UTF-8, and callbacks are the program's functions from the wasm table.
//
// stdin, stdout and stderr are the TTY's streams, rerouted to the Console: output goes in whole
// writes, and a read of stdin returns the line the student typed, waiting for one when it must.
// Before any wait the Console calls vams_flush (vams_main.c), so stdio's line buffer is sent.
//
// Emscripten evaluates this file when it links the main module, and copies each function's
// source into it, so the functions below refer only to their arguments, VAMS and the runtime.

const library = {
  $VAMS__deps: ['$UTF8ToString', '$stringToNewUTF8', '$wasmTable', '$TTY', 'malloc', 'free', 'exit', 'vams_flush'],
  $VAMS__postset: 'VAMS.connect();',
  $VAMS: {
    lab: null,
    strings: {},
    mapped: {},
    connect() {
      const lab = globalThis.__vamsLab;
      // Without a worker (the toolchain check runs plain programs in Node) nothing is rerouted.
      if (!lab) return;
      VAMS.lab = lab;
      lab.connect({ heap: () => HEAPU8, exit: (code) => _exit(code), flush: () => _vams_flush() });
      const ops = TTY.stream_ops;
      const read = ops.read;
      ops.read = (stream, buffer, offset, length, position) => {
        if (stream.tty.ops !== TTY.default_tty_ops) return read(stream, buffer, offset, length, position);
        const bytes = lab.console.readStdin(length);
        buffer.set(bytes, offset);
        return bytes.length;
      };
      ops.write = (stream, buffer, offset, length) => {
        const fd = stream.tty.ops === TTY.default_tty1_ops ? 'stderr' : 'stdout';
        lab.console.write(fd, new Uint8Array(buffer.buffer, buffer.byteOffset + offset, length));
        return length;
      };
    },
    gl() {
      return VAMS.lab.gl;
    },
    glut() {
      return VAMS.lab.glut;
    },
    /** A callback pointer as the program's function, or null. */
    fn(ptr) {
      return ptr ? wasmTable.get(ptr) : null;
    },
    /** The bytes of a C string, up to its 0. */
    cstr(ptr) {
      const end = HEAPU8.indexOf(0, ptr);
      return HEAPU8.subarray(ptr, end < 0 ? HEAPU8.length : end);
    },
    u8(ptr, n) {
      return HEAPU8.subarray(ptr, ptr + n);
    },
    u32(ptr, n) {
      if (n <= 0) return [];
      return ptr & 3 ? new Uint32Array(HEAPU8.slice(ptr, ptr + n * 4).buffer) : HEAPU32.subarray(ptr >> 2, (ptr >> 2) + n);
    },
    f32(ptr, n) {
      return ptr & 3 ? new Float32Array(HEAPU8.slice(ptr, ptr + n * 4).buffer) : HEAPF32.subarray(ptr >> 2, (ptr >> 2) + n);
    },
    f64(ptr, n) {
      return ptr & 7 ? new Float64Array(HEAPU8.slice(ptr, ptr + n * 8).buffer) : HEAPF64.subarray(ptr >> 3, (ptr >> 3) + n);
    },
    /** A string the program may keep, made once for `key`; 0 for null. */
    string(key, text) {
      if (text === null) return 0;
      if (!VAMS.strings[key]) VAMS.strings[key] = stringToNewUTF8(text);
      return VAMS.strings[key];
    },
    /** GL's error flag takes `code` unless it already holds one. */
    fail(code) {
      const gl = VAMS.gl();
      if (!gl.error) gl.error = code;
    },
  },

  // Vertices and their attributes.
  glBegin: (mode) => VAMS.gl().begin(mode),
  glEnd: () => VAMS.gl().end(),
  glVertex2d__sig: 'vdd',
  glVertex2d: (x, y) => VAMS.gl().vertex2d(x, y),
  glVertex2f: (x, y) => VAMS.gl().vertex2f(x, y),
  glVertex2i: (x, y) => VAMS.gl().vertex2i(x, y),
  glVertex2fv: (v) => VAMS.gl().vertex2fv(VAMS.f32(v, 2)),
  glVertex3d__sig: 'vddd',
  glVertex3d: (x, y, z) => VAMS.gl().vertex3d(x, y, z),
  glVertex3f: (x, y, z) => VAMS.gl().vertex3f(x, y, z),
  glVertex3i: (x, y, z) => VAMS.gl().vertex3i(x, y, z),
  glVertex3fv: (v) => VAMS.gl().vertex3fv(VAMS.f32(v, 3)),
  glColor3d: (r, g, b) => VAMS.gl().color3d(r, g, b),
  glColor3f: (r, g, b) => VAMS.gl().color3f(r, g, b),
  glColor3ub: (r, g, b) => VAMS.gl().color3ub(r & 255, g & 255, b & 255),
  glColor3fv: (v) => VAMS.gl().color3fv(VAMS.f32(v, 3)),
  glColor3ubv: (v) => VAMS.gl().color3ubv(VAMS.u8(v, 3)),
  glColor4d: (r, g, b, a) => VAMS.gl().color4d(r, g, b, a),
  glColor4f: (r, g, b, a) => VAMS.gl().color4f(r, g, b, a),
  glColor4ub: (r, g, b, a) => VAMS.gl().color4ub(r & 255, g & 255, b & 255, a & 255),
  glColor4fv: (v) => VAMS.gl().color4fv(VAMS.f32(v, 4)),
  glColor4ubv: (v) => VAMS.gl().color4ubv(VAMS.u8(v, 4)),
  glTexCoord2d__sig: 'vdd',
  glTexCoord2d: (s, t) => VAMS.gl().texCoord2d(s, t),
  glTexCoord2f: (s, t) => VAMS.gl().texCoord2f(s, t),
  glTexCoord2i: (s, t) => VAMS.gl().texCoord2i(s, t),
  glTexCoord2fv: (v) => VAMS.gl().texCoord2fv(VAMS.f32(v, 2)),
  glRasterPos2d__sig: 'vdd',
  glRasterPos2d: (x, y) => VAMS.gl().rasterPos2d(x, y),
  glRasterPos2f__sig: 'vff',
  glRasterPos2f: (x, y) => VAMS.gl().rasterPos2f(x, y),
  glRasterPos2i__sig: 'vii',
  glRasterPos2i: (x, y) => VAMS.gl().rasterPos2i(x, y),
  glRasterPos3f__sig: 'vfff',
  glRasterPos3f: (x, y, z) => VAMS.gl().rasterPos3f(x, y, z),
  glRectd__sig: 'vdddd',
  glRectd: (x1, y1, x2, y2) => VAMS.gl().rectd(x1, y1, x2, y2),
  glRectf__sig: 'vffff',
  glRectf: (x1, y1, x2, y2) => VAMS.gl().rectf(x1, y1, x2, y2),
  glRecti__sig: 'viiii',
  glRecti: (x1, y1, x2, y2) => VAMS.gl().recti(x1, y1, x2, y2),

  // State.
  glEnable: (cap) => VAMS.gl().enable(cap),
  glDisable: (cap) => VAMS.gl().disable(cap),
  glIsEnabled: (cap) => (VAMS.gl().isEnabled(cap) ? 1 : 0),
  glShadeModel: (mode) => VAMS.gl().shadeModel(mode),
  glPointSize: (size) => VAMS.gl().pointSize(size),
  glLineWidth: (width) => VAMS.gl().lineWidth(width),
  glLineStipple__sig: 'vii',
  glLineStipple: (factor, pattern) => VAMS.gl().lineStipple(factor, pattern & 0xffff),
  glPolygonMode: (face, mode) => VAMS.gl().polygonMode(face, mode),
  glBlendFunc: (sfactor, dfactor) => VAMS.gl().blendFunc(sfactor, dfactor),
  glPixelStorei: (pname, param) => VAMS.gl().pixelStorei(pname, param),
  glGetError: () => VAMS.gl().getError(),
  glGetString: (name) => VAMS.string(`gl${name}`, VAMS.gl().getString(name)),

  // The frame. glFlush and glFinish go through GLUT, which shows a GLUT_SINGLE window's frame.
  glClear: (mask) => VAMS.gl().clear(mask),
  glClearColor: (r, g, b, a) => VAMS.gl().clearColor(r, g, b, a),
  glViewport: (x, y, width, height) => VAMS.gl().viewport(x, y, width, height),
  glScissor: (x, y, width, height) => VAMS.gl().scissor(x, y, width, height),
  glFlush: () => VAMS.glut().flush(),
  glFinish: () => VAMS.glut().finish(),

  // Matrices.
  glMatrixMode: (mode) => VAMS.gl().matrixMode(mode),
  glLoadIdentity: () => VAMS.gl().loadIdentity(),
  glOrtho: (left, right, bottom, top, zNear, zFar) => VAMS.gl().ortho(left, right, bottom, top, zNear, zFar),
  glPushMatrix: () => VAMS.gl().pushMatrix(),
  glPopMatrix: () => VAMS.gl().popMatrix(),
  glTranslated: (x, y, z) => VAMS.gl().translated(x, y, z),
  glTranslatef: (x, y, z) => VAMS.gl().translatef(x, y, z),
  glRotated: (angle, x, y, z) => VAMS.gl().rotated(angle, x, y, z),
  glRotatef: (angle, x, y, z) => VAMS.gl().rotatef(angle, x, y, z),
  glScaled: (x, y, z) => VAMS.gl().scaled(x, y, z),
  glScalef: (x, y, z) => VAMS.gl().scalef(x, y, z),
  glLoadMatrixd: (m) => VAMS.gl().loadMatrixd(VAMS.f64(m, 16)),
  glLoadMatrixf: (m) => VAMS.gl().loadMatrixf(VAMS.f32(m, 16)),
  glMultMatrixd: (m) => VAMS.gl().multMatrixd(VAMS.f64(m, 16)),
  glMultMatrixf: (m) => VAMS.gl().multMatrixf(VAMS.f32(m, 16)),

  // Client-side arrays: a pointer is an address in program memory, or an offset into the bound buffer.
  glEnableClientState: (array) => VAMS.gl().enableClientState(array),
  glDisableClientState: (array) => VAMS.gl().disableClientState(array),
  glVertexPointer: (size, type, stride, pointer) => VAMS.gl().vertexPointer(size, type, stride, pointer),
  glColorPointer: (size, type, stride, pointer) => VAMS.gl().colorPointer(size, type, stride, pointer),
  glTexCoordPointer: (size, type, stride, pointer) => VAMS.gl().texCoordPointer(size, type, stride, pointer),
  glDrawArrays: (mode, first, count) => VAMS.gl().drawArrays(mode, first, count),
  glDrawElements: (mode, count, type, indices) => VAMS.gl().drawElements(mode, count, type, indices),

  // Textures.
  glGenTextures: (n, textures) => HEAPU32.set(VAMS.gl().genTextures(n), textures >> 2),
  glDeleteTextures: (n, textures) => VAMS.gl().deleteTextures(VAMS.u32(textures, n)),
  glBindTexture: (target, texture) => VAMS.gl().bindTexture(target, texture >>> 0),
  glTexImage2D: (target, level, internalformat, width, height, border, format, type, pixels) =>
    VAMS.gl().texImage2D(target, level, internalformat, width, height, border, format, type, pixels || null),
  glTexParameterf: (target, pname, param) => VAMS.gl().texParameterf(target, pname, param),
  glTexParameteri: (target, pname, param) => VAMS.gl().texParameteri(target, pname, param),
  // GL_TEXTURE_BORDER_COLOR (0x1004) takes four values; every other parameter one.
  glTexParameterfv: (target, pname, params) => VAMS.gl().texParameterfv(target, pname, VAMS.f32(params, pname === 0x1004 ? 4 : 1)),
  glTexEnvf: (target, pname, param) => VAMS.gl().texEnvf(target, pname, param),
  glTexEnvi: (target, pname, param) => VAMS.gl().texEnvi(target, pname, param),

  // Display lists.
  glGenLists__sig: 'ii',
  glGenLists: (range) => VAMS.gl().genLists(range),
  glNewList__sig: 'vii',
  glNewList: (list, mode) => VAMS.gl().newList(list >>> 0, mode),
  glEndList__sig: 'v',
  glEndList: () => VAMS.gl().endList(),
  glCallList__sig: 'vi',
  glCallList: (list) => VAMS.gl().callList(list >>> 0),
  glDeleteLists__sig: 'vii',
  glDeleteLists: (list, range) => VAMS.gl().deleteLists(list >>> 0, range),

  // Buffer objects. A mapped buffer is copied into program memory and back at glUnmapBuffer.
  glGenBuffers: (n, buffers) => HEAPU32.set(VAMS.gl().genBuffers(n), buffers >> 2),
  glDeleteBuffers: (n, buffers) => VAMS.gl().deleteBuffers(VAMS.u32(buffers, n)),
  glBindBuffer: (target, buffer) => VAMS.gl().bindBuffer(target, buffer >>> 0),
  glBufferData: (target, size, data, usage) => {
    if (size < 0) return VAMS.fail(0x0501);
    VAMS.gl().bufferData(target, data ? HEAPU8.subarray(data, data + size) : new Uint8Array(size), usage);
  },
  glBufferSubData: (target, offset, size, data) => {
    if (size < 0 || offset < 0) return VAMS.fail(0x0501);
    VAMS.gl().bufferSubData(target, offset, HEAPU8.subarray(data, data + size));
  },
  glMapBuffer__sig: 'pii',
  glMapBuffer: (target, access) => {
    const store = VAMS.gl().mapBuffer(target, access);
    if (!store) return 0;
    const ptr = _malloc(Math.max(1, store.length));
    HEAPU8.set(store, ptr);
    VAMS.mapped[target] = { ptr, store };
    return ptr;
  },
  glUnmapBuffer: (target) => {
    const ok = VAMS.gl().unmapBuffer(target);
    const m = VAMS.mapped[target];
    if (ok && m) {
      m.store.set(HEAPU8.subarray(m.ptr, m.ptr + m.store.length));
      _free(m.ptr);
      delete VAMS.mapped[target];
    }
    return ok ? 1 : 0;
  },

  // GLU.
  gluOrtho2D: (left, right, bottom, top) => VAMS.gl().ortho2D(left, right, bottom, top),
  gluErrorString__sig: 'pi',
  gluErrorString: (code) => VAMS.string(`glu${code}`, VAMS.gl().errorString(code)),

  // GLUT: starting up.
  glutInit: () => VAMS.glut().init(),
  glutInitWindowPosition: (x, y) => VAMS.glut().initWindowPosition(x, y),
  glutInitWindowSize: (width, height) => VAMS.glut().initWindowSize(width, height),
  glutInitDisplayMode: (mode) => VAMS.glut().initDisplayMode(mode >>> 0),
  glutMainLoop: () => VAMS.glut().mainLoop(),
  glutLeaveMainLoop__sig: 'v',
  glutLeaveMainLoop: () => VAMS.glut().leaveMainLoop(),
  glutSetOption__sig: 'vii',
  glutSetOption: (option, value) => VAMS.glut().setOption(option, value),

  // GLUT: the window.
  glutCreateWindow: (title) => VAMS.glut().createWindow(UTF8ToString(title)),
  glutDestroyWindow: () => VAMS.glut().destroyWindow(),
  glutGetWindow__sig: 'i',
  glutGetWindow: () => VAMS.glut().getWindow(),
  glutSetWindowTitle__sig: 'vp',
  glutSetWindowTitle: (title) => VAMS.glut().setWindowTitle(UTF8ToString(title)),
  glutReshapeWindow: (width, height) => VAMS.glut().reshapeWindow(width, height),
  glutPositionWindow: (x, y) => VAMS.glut().positionWindow(x, y),
  glutFullScreen: () => VAMS.glut().fullScreen(),
  glutPostRedisplay: () => VAMS.glut().postRedisplay(),
  glutSwapBuffers: () => VAMS.glut().swapBuffers(),

  // GLUT: right-click menus.
  glutCreateMenu__sig: 'ip',
  glutCreateMenu: (callback) => VAMS.glut().createMenu(VAMS.fn(callback)),
  glutDestroyMenu__sig: 'vi',
  glutDestroyMenu: (menu) => VAMS.glut().destroyMenu(menu),
  glutAddMenuEntry__sig: 'vpi',
  glutAddMenuEntry: (label, value) => VAMS.glut().addMenuEntry(UTF8ToString(label), value),
  glutAddSubMenu__sig: 'vpi',
  glutAddSubMenu: (label, menu) => VAMS.glut().addSubMenu(UTF8ToString(label), menu),
  glutAttachMenu__sig: 'vi',
  glutAttachMenu: (button) => VAMS.glut().attachMenu(button),
  glutDetachMenu__sig: 'vi',
  glutDetachMenu: (button) => VAMS.glut().detachMenu(button),

  // GLUT: callbacks.
  glutTimerFunc: (ms, callback, value) => VAMS.glut().timerFunc(ms >>> 0, VAMS.fn(callback), value),
  glutIdleFunc: (callback) => VAMS.glut().idleFunc(VAMS.fn(callback)),
  glutDisplayFunc: (callback) => VAMS.glut().displayFunc(VAMS.fn(callback)),
  glutReshapeFunc: (callback) => VAMS.glut().reshapeFunc(VAMS.fn(callback)),
  glutKeyboardFunc: (callback) => VAMS.glut().keyboardFunc(VAMS.fn(callback)),
  glutKeyboardUpFunc: (callback) => VAMS.glut().keyboardUpFunc(VAMS.fn(callback)),
  glutSpecialFunc: (callback) => VAMS.glut().specialFunc(VAMS.fn(callback)),
  glutSpecialUpFunc: (callback) => VAMS.glut().specialUpFunc(VAMS.fn(callback)),
  glutMouseFunc: (callback) => VAMS.glut().mouseFunc(VAMS.fn(callback)),
  glutMotionFunc: (callback) => VAMS.glut().motionFunc(VAMS.fn(callback)),
  glutPassiveMotionFunc: (callback) => VAMS.glut().passiveMotionFunc(VAMS.fn(callback)),
  glutMouseWheelFunc__sig: 'vp',
  glutMouseWheelFunc: (callback) => VAMS.glut().mouseWheelFunc(VAMS.fn(callback)),
  glutCloseFunc__sig: 'vp',
  glutCloseFunc: (callback) => VAMS.glut().closeFunc(VAMS.fn(callback)),

  // GLUT: state.
  glutGet: (query) => VAMS.glut().get(query),
  glutGetModifiers: () => VAMS.glut().getModifiers(),

  // GLUT: bitmap text. A font is its GLUT_BITMAP_* handle.
  glutBitmapCharacter__sig: 'vpi',
  glutBitmapCharacter: (font, character) => VAMS.glut().bitmapCharacter(font, character),
  glutBitmapWidth__sig: 'ipi',
  glutBitmapWidth: (font, character) => VAMS.glut().bitmapWidth(font, character),
  glutBitmapLength__sig: 'ipp',
  glutBitmapLength: (font, string) => VAMS.glut().bitmapLength(font, VAMS.cstr(string)),
  glutBitmapHeight__sig: 'ip',
  glutBitmapHeight: (font) => VAMS.glut().bitmapHeight(font),
  glutBitmapString__sig: 'vpp',
  glutBitmapString: (font, string) => VAMS.glut().bitmapString(font, VAMS.cstr(string)),

  // The Console and the Windows extras (conio.c, windows.c, and libc's system()).
  vams_getch__sig: 'i',
  vams_getch: () => VAMS.lab.console.getch(),
  vams_getche__sig: 'i',
  vams_getche: () => VAMS.lab.console.getche(),
  vams_kbhit__sig: 'i',
  vams_kbhit: () => (VAMS.lab.console.kbhit() ? 1 : 0),
  vams_sleep__sig: 'vi',
  vams_sleep: (ms) => VAMS.lab.console.sleep(ms >>> 0),
  _emscripten_system: (command) => VAMS.lab.console.system(command ? UTF8ToString(command) : null),
};

// Every import needs VAMS.
for (const name of Object.keys(library)) {
  if (name.startsWith('$') || name.includes('__')) continue;
  library[`${name}__deps`] = [...(library[`${name}__deps`] ?? []), '$VAMS'];
}

addToLibrary(library);
