# The Lab in a class

The third of the four pieces that take the Lab out of Experimental (the first two are [One reference: Intel FreeGLUT, every pixel](2026-11-24-intel-reference-design.md) and [GLUT behaviour](2026-11-24-glut-behaviour-design.md)). The owner's brief: the Lab holds up for a class of 40 on the lab PCs. A slow PC, the first download, a program that crashes or never ends, a full browser storage, and no student ever loses code. The owner delegated the calls ("decide for me, I approved up to push"), so each call below is recorded with its reason.

## What was probed

Headless Chromium against the local runtime, with throwaway programs:

| Probe | Found |
| --- | --- |
| 400 large multisampled triangles, 500 × 500 | About 400 ms a frame in software. With the catch-up capped at 6 steps, the scene took 12 steps in 5 s instead of 300. |
| `int big[50000]` in a function | Ran, but the stack was Emscripten's default 64 KB, placed after the main module's data: the array wrote 200 KB over that data. A lab PC's program has MinGW's 2 MB. |
| `new` in a loop until memory runs out | `std::bad_alloc` after 1,984 MB, as a 32-bit program on a lab PC gets. Uncaught, the Console said `The program stopped: [object WebAssembly.Exception]`. |
| `abort()` | The Console printed Emscripten's `Aborted()`, then `The program stopped: unreachable`. |
| Endless recursion | `The program stopped: Maximum call stack size exceeded`. |
| A compile | About 220 ms on the reference. The Lab keeps no compile cache, so this is every compile. CDP's CPU throttling doesn't reach workers, so a slower PC wasn't measured. |
| Two tabs of the Lab | Each saves on every change, so the older tab's next keystroke writes its code over the newer tab's. |

A native battery, `tests/fixtures/lab/glut/crash.cpp`, recorded how a lab PC ends each kind of crash (`scripts/lab/capture-glut.mjs crash`). It is a console program, so no window opened. An exception nothing caught prints libstdc++'s `terminate called after throwing an instance of '<type>'` and `what():` lines, then ends with code -1073740791. `abort()` prints nothing and ends the same. A division by zero, a far pointer and endless recursion print nothing and end with their Windows exception codes. A 1.5 MB local array runs.

## The calls

1. **The stack is MinGW's 2 MB.** `build.sh` links the main module with `-sSTACK_SIZE=2097152`, and caps growth at 2 GB (`-sMAXIMUM_MEMORY`), the memory a 32-bit program has. This changes the main module, so it is a new runtime version, and every browser downloads the compiler again once.
   - Stack-first layout was tried, so that an overflow would trap before it touched anything. Emscripten makes `STACK_FIRST` internal and ignores `--stack-first` for a main module. So the stack stays after the runtime's data. An overflow past 2 MB writes over that data and then stops, at the depth where a lab PC's program would crash. That is a named difference.
2. **An exception nothing caught prints what a lab PC prints.** The runtime exports `getExceptionMessage` (`-sEXPORT_EXCEPTION_HANDLING_HELPERS`). The worker prints libstdc++'s two lines from it, then the program stops.
3. **abort() prints nothing.** The worker hooks Emscripten's `onAbort` and leaves out its `Aborted()` line, as a lab PC prints nothing.
4. **A crash is said in plain words.** A lab PC ends a crash with an exception code that tells a student nothing, and the browser's words ("unreachable", "memory access out of bounds") tell them no more. So the Console's last line names what happened, from `crash-words.ts`: an exception nothing caught, `abort()`, a division by zero, memory outside the program's own, a stack that ran out, a bad function pointer, or code the compiler marked as never reached. A message the Lab doesn't know is passed on as it came. The status stays "Stopped on an error" for every Windows exception code. The Lab doesn't show the code, which only names the kind of crash the sentence already gives.
5. **Catch-up goes from 6 steps to 30.** `MAX_CATCH_UP` is half a second, in Run and in the exported `_vams_idle`. A scene the Lab draws at 400 ms a frame keeps the editor's pace. A stall longer than half a second still takes a single step rather than jump. The gallery examples are exported again.
6. **A second tab follows the newest save.** When another tab writes `vams-lab`, the Lab rehydrates its store from it (`followOtherTabs`), so the editor shows the newer code and the next change builds on it. A storage event for a change of the same value doesn't fire, so two tabs never echo each other.
7. **No prompt when leaving the page.** The code is saved in the browser on every change, so a prompt on every close or reload would only train students to click through it. What it would guard against, a lab PC that clears the browser at sign-out, a prompt can't stop. So the instructor page tells students to keep their work with Save or Share.
8. **Class guidance on the instructor page.** "In the lab" gains two points: press Download now on each machine before the class, so 40 machines don't fetch 18 MB at once, and keep work with Save or Share on machines that clear the browser.
9. **No rate limit on sharing.** A class shares from one network address. `SHARE_LIMITER` stays unbound in production, so a limit per address can't refuse a class. This needs no change, only a record in the operations notes.
10. **No compile cache.** At about a quarter of a second a compile, a cache wouldn't change what a class sees.

## Named differences

- A write through a null pointer doesn't crash: a program's memory starts at address 0 in the browser.
- A stack overflow past 2 MB writes over the runtime's data before it stops (call 1).
- The Lab compiles with `-O1`, where `x.bat` doesn't optimise, so undefined behaviour can end differently. A function that ends without returning its value stops on "never reached", where a lab PC returns whatever is in the register. `1 / x` becomes a comparison and never divides, which is why the battery divides 100.
- The browser's call stack can run out before 2 MB of program stack does, for a recursion of very small frames.

## The checks

- **VIS-LAB-16** runs every case of the crash battery in the Lab. It checks what the case printed, how it ended, and the plain words for a crash, against the recording. Then it reloads and checks the code is as it was.
- **BB-LAB-115:** the worker's messages for an exception nothing caught and for `abort()`, libstdc++'s lines, and the words for every browser message.
- **BB-LAB-116:** another tab's save reaches this tab's editor, and the next change builds on it. Other keys, and a cleared save, change nothing.
- **ALG-RUN-03:** the pacer catches up a 400 ms frame (24 steps), and gives one step after a longer stall.
- The operations notes gain "When a program goes wrong" and "In a class" (`docs/lab-operations.md`).
