/**
 * Whether the Lab is on in production builds. On since 9 Nov 2026, when the runtime, with its
 * compiler, was published; a build with VITE_LAB=1, and the dev server, turn the Lab on regardless
 * (see labEnabled). A live build refuses the runtime version `dev` (assertLiveRuntime).
 */
export const LAB_LIVE = true;
