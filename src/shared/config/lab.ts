/** Set by the build (vite.config.ts) from labEnabled: true when the Lab is on in this build. */
declare const __LAB_ENABLED__: boolean | undefined;

/** Whether this build shows the Lab. The route, the header link and the other client code read it. */
export const LAB_ENABLED: boolean = typeof __LAB_ENABLED__ === 'undefined' ? false : __LAB_ENABLED__;
