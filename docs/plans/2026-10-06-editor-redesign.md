# Editor Layout Redesign (SP5) Implementation Plan

**Goal:** Rebuild the `/app` editor on a shared, accessible control set and a three-column layout: a section column (which becomes the lesson in Lesson mode), the canvas, and code over math.

**Architecture:**
- New primitives live in `src/shared/ui/controls/`: buttons, fields, toggles, panel, table, dialog and menu, all styled from tokens added to `_tokens.scss`.
- The editor shell is recomposed in `pages/editor` and `widgets/layout`, with the lesson step engine extracted into a hook.
- Each feature panel is then migrated onto the shared controls, keeping its `panelId`, its title and its behaviour.

**Tech Stack:** Preact 10 (`preact/compat` aliased as React), Zustand 5 + Immer, SCSS, Vitest 4 + happy-dom, lucide-react icons, Playwright (screenshot checks only, run with the installed Chrome).

**Spec:** `docs/specs/2026-10-06-editor-redesign-design.md`

## Global Constraints

**Product and code rules:**
- Section labels are exactly `Pipeline | Primitives | Buffers | Transforms | Textures`.
- Student-facing text never says "coming soon", "not supported", "future", "deferred", "3D" or "lighting".
- There are two modes only: Author and Lesson.
- The generated code must not change. GL hints name only calls the generator really emits (`src/features/code-generation/model`), never product-plan Appendix C symbols (`gluPerspective`, `glFrustum`, lighting, material or normal APIs).
- The persisted store (`vams-storage`) stays at **version 7**, and `partialize` stays unchanged. No new persisted fields.
- **Feature-Sliced Design:** `app → pages → widgets → features → entities → shared` (+ `core`). New code imports only from lower layers or its own slice, via `@/`. Features never import other features; compose them in widgets or pages.
- **Styling:** colours, borders and sizes come from tokens in `src/shared/styles/_tokens.scss`, defined for both `:root` (vellum) and `[data-theme='blueprint']`. Component SCSS uses `var(--token)` and has no hex colours.
- **Accessibility (WCAG 2.2 AA):**
  - interactive targets are at least 24 × 24 px;
  - field and control borders and the focus ring reach at least 3:1;
  - focus shows a 2 px `--focus-ring` outline offset by 2 px;
  - every control has a visible label or an accessible name.
- **Layout:** the editor works fully at **1280 × 720** CSS px and without clipping at **960** px wide. The narrow breakpoint is `@media (max-width: 1099.98px)`.

**Tooling and code style:**
- Preact via compat: import hooks from `'react'`, and import types such as `ComponentChildren` and `JSX` from `'preact'`.
- ESLint runs `eslint-plugin-react-hooks` v7 (recommended). Don't call `setState` synchronously in a `useEffect` body, and don't read `ref.current` during render. Adjust state during render with the "previous value" pattern, or do the work in event handlers.
- Typographic characters such as `…`, `—`, `×`, `↓`, `‘` and `’` must be byte-exact. When a string contains one, verify the file with `node -e "console.log([...require('fs').readFileSync('<file>','utf8')].filter(c=>c.charCodeAt(0)>127).join(''))"`.

**Tests and commits:**
- Tests live in `tests/`, with IDs `{SUITE}-{MODULE}-{NN}`. Keep existing IDs stable, and number new ones in sequence within their file.
- `npm test` rewrites `tests/reports/*.json`. Never commit those files; run `git checkout -- tests/reports` before staging.
- Before every commit, `npm run lint`, `npm run build` and `npm test` must all pass.
- Stage paths explicitly, never with `git add -A` or `git add .`.
- **Never stage `.gitignore`**, which holds an unrelated local edit.
- Use Conventional Commits subjects. No `Co-Authored-By`, no tool attribution, and no mention of assistants or workflow in commits, comments or docs.

## Review Focus

- **Esc while scrubbing a number during a lesson** must restore the value and must **not** exit the lesson. The lesson's Esc listener is on `window`. *Pinned by BB-CTRL-12 (Task 2).*
- **Esc while typing in a field inside a dialog** must cancel the edit only, not close the dialog. *Pinned by BB-CTRL-13 (Task 2).*
- **Typing a value and then clicking elsewhere** (blur) commits exactly once, with one `onBeginChange` and one `onChange`. *Pinned by BB-CTRL-08 (Task 2).*
- **Choosing a menu item that unmounts its own menu button** (Lessons → start a lesson hides the launcher) must not throw, and must leave focus on something in the document. *Pinned by BB-SHELL-06 (Task 5).*
- **At narrow widths with the drawer open in Lesson mode,** Esc inside the drawer closes the drawer only. Esc elsewhere still exits the lesson. *Pinned by BB-LCOL-10 (Task 8).*

## File Structure

**Create:**

| Path | Responsibility |
| --- | --- |
| `src/shared/ui/controls/Button.tsx`, `button.scss` | Button variants, icon-only buttons |
| `src/shared/ui/controls/GlHint.tsx`, `gl-hint.scss` | Mono line naming a GL call |
| `src/shared/ui/controls/Switch.tsx`, `SegmentedControl.tsx`, `toggles.scss` | Switch (`role="switch"`), radiogroup segmented control |
| `src/shared/ui/controls/TextField.tsx`, `NumberField.tsx`, `SliderField.tsx`, `fields.scss` | Text, number (scrub, step, type) and slider fields |
| `src/shared/ui/controls/number-utils.ts` | `parseNumberInput`, `roundToStep`, `decimalsFor` |
| `src/shared/ui/controls/ColorField.tsx`, `color.scss`, `color-utils.ts`, `recent-colors.ts` | Colour field with hex, GL readout and recent colours |
| `src/shared/ui/controls/Panel.tsx`, `panel.scss`, `panel-context.ts` | Collapsible panel with lesson focus, and its layout context |
| `src/shared/ui/controls/DataTable.tsx`, `table.scss` | Accessible table for vertex and UV data |
| `src/shared/ui/controls/Dialog.tsx`, `dialog.scss`, `focus-trap.ts` | Modal dialog shell with a focus trap |
| `src/shared/ui/controls/MenuButton.tsx`, `menu.scss` | APG menu button and menu |
| `src/shared/ui/controls/index.ts` | Barrel |
| `src/entities/project/model/scene-empty.ts` | `isSceneEmpty` (moved from scene-library) |
| `src/features/workspace-reset/model/useNewWorkspace.ts` | New-workspace action as a hook |
| `src/features/project-io/model/useProjectFile.ts` | Open, save and export actions as a hook |
| `src/features/lesson-engine/model/useLessonRunner.ts` | Step engine extracted from `LessonBar` |
| `src/features/lesson-engine/ui/LessonCard.tsx`, `lesson-card.scss` | Lesson UI for the section column |
| `src/widgets/layout/top-bar/FileMenu.tsx`, `SettingsMenu.tsx` | Top-bar menus composed from features |
| `src/widgets/layout/section-column/SectionColumn.tsx`, `SectionMenu.tsx`, `section-panels.tsx`, `section-column.scss`, `index.ts` | Section column, its header menu and the panel registry |
| `src/widgets/layout/code-math-column/CodeMathColumn.tsx`, `code-math-column.scss`, `index.ts` | Code over math |
| `tests/black-box/controls.test.ts` | BB-CTRL |
| `tests/black-box/editor-shell.test.ts` | BB-SHELL |
| `tests/black-box/lesson-column.test.ts` | BB-LCOL |
| `tests/black-box/editor-panels.test.ts` | BB-PANEL |
| `playwright.config.ts`, `tests/visual/editor.spec.ts` | VIS-EDITOR screenshot checks |

**Delete** once their users have moved:
- `src/shared/ui/number-input/NumberInput.tsx`
- `src/features/lesson-engine/ui/LessonBar.tsx` and `lesson-bar.scss`
- `src/features/project-io/ui/ProjectActions.tsx`
- `src/widgets/layout/left-sidebar/*`
- `src/widgets/layout/right-sidebar/*`

**Modify:** listed in each task.

Test helpers used throughout. Each new test file defines these locally; don't import them from other test files:

```ts
import { h, render, type VNode } from 'preact';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}
```

---

### Task 1: Control tokens, Button, GlHint, Switch, SegmentedControl, TextField

**Files:**
- Modify: `src/shared/styles/_tokens.scss`, adding the tokens below to the `:root` block and the `[data-theme='blueprint']` block.
- Create: `src/shared/ui/controls/Button.tsx`, `button.scss`, `GlHint.tsx`, `gl-hint.scss`, `Switch.tsx`, `SegmentedControl.tsx`, `toggles.scss`, `TextField.tsx`, `fields.scss`, `index.ts`
- Test: `tests/black-box/controls.test.ts`

**Interfaces:**
- Produces:
  - `Button` (forwardRef `HTMLButtonElement`) with props `ButtonProps` and type `ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'`;
  - `GlHint({ call, args?, className? })`;
  - `Switch({ checked, onChange(next), label, disabled?, id?, className? })`;
  - `SegmentedControl<T extends string>({ label, options: SegmentOption<T>[], value, onChange(v), mono?, disabled?, className? })`, with `SegmentOption<T> = { value: T; label: string; title?: string }`;
  - `TextField({ label, value, onCommit(v), placeholder?, hideLabel?, maxLength?, id?, className? })`;
  - all of these exported from `@/shared/ui/controls`.

- [ ] **Step 1: Add the tokens.** In `src/shared/styles/_tokens.scss`, insert just before the closing `}` of `:root`:

```scss
  /* Shared control set (editor). */
  --control-h: 28px;
  --control-h-lg: 32px;
  --field-bg: #ffffff;
  --field-line: #7a8296;
  --hairline: rgba(29, 43, 79, 0.10);
  --live: var(--accent);
  --live-tint: rgba(255, 90, 31, 0.10);
  --gl-hint: var(--gl-fn);
```

and just before the closing `}` of `[data-theme='blueprint']`:

```scss
  --field-bg: #0a2140;
  --field-line: #6f8bb5;
  --hairline: rgba(186, 214, 255, 0.10);
  --live: var(--accent);
  --live-tint: rgba(255, 106, 43, 0.14);
  --gl-hint: var(--gl-fn);
```

- [ ] **Step 2: Write the failing tests.** Create `tests/black-box/controls.test.ts`:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-CTRL
 * The shared control set in src/shared/ui/controls.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { Button, GlHint, SegmentedControl, Switch, TextField } from '@/shared/ui/controls';

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}
function mount(vnode: VNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  render(vnode, host);
  return host;
}
function unmount(host: HTMLElement) {
  render(null, host);
  host.remove();
}
function key(target: EventTarget, k: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('BB-CTRL-01: Icon-only buttons carry their label as name and tooltip', () => {
  it('renders aria-label and title from label, and the variant class', () => {
    const host = mount(h(Button, { iconOnly: true, label: 'Undo', variant: 'quiet', icon: h('svg', {}) }));
    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Undo');
    expect(button.getAttribute('title')).toBe('Undo');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('vbtn--quiet');
    expect(button.className).toContain('vbtn--icon');
    unmount(host);
  });
});

describe('BB-CTRL-02: Text buttons keep their text and fire onClick', () => {
  it('renders children, calls onClick, and passes disabled through', () => {
    const onClick = vi.fn();
    const host = mount(h(Button, { variant: 'primary', onClick }, 'Add vertex'));
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('Add vertex');
    expect(button.hasAttribute('aria-label')).toBe(false);
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    render(h(Button, { variant: 'primary', onClick, disabled: true }, 'Add vertex'), host);
    expect(host.querySelector('button')!.disabled).toBe(true);
    unmount(host);
  });
});

describe('BB-CTRL-03: GlHint names the call and hides from assistive technology', () => {
  it('renders the function name and arguments', () => {
    const host = mount(h(GlHint, { call: 'glTranslatef', args: 'x, y, 0.0f' }));
    const hint = host.querySelector('.gl-hint')!;
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    expect(hint.querySelector('.gl-hint__fn')!.textContent).toBe('glTranslatef');
    expect(hint.textContent).toBe('glTranslatef(x, y, 0.0f)');
    unmount(host);
  });
});

describe('BB-CTRL-04: Switch exposes role and checked state', () => {
  it('toggles through onChange', () => {
    const onChange = vi.fn();
    const host = mount(h(Switch, { checked: false, onChange, label: 'Line stipple' }));
    const sw = host.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.textContent).toContain('Line stipple');
    sw.click();
    expect(onChange).toHaveBeenCalledWith(true);
    unmount(host);
  });
});

describe('BB-CTRL-05: SegmentedControl is a radiogroup with arrow keys and roving tabindex', () => {
  it('moves the selection with arrows, Home and End', () => {
    const onChange = vi.fn();
    const options = [
      { value: 'NEAREST', label: 'GL_NEAREST' },
      { value: 'LINEAR', label: 'GL_LINEAR' },
      { value: 'MIPMAP', label: 'GL_X' },
    ];
    const host = mount(h(SegmentedControl, { label: 'Filter', options, value: 'NEAREST', onChange }));
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Filter');
    const radios = host.querySelectorAll('[role="radio"]');
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].getAttribute('tabindex')).toBe('0');
    expect(radios[1].getAttribute('tabindex')).toBe('-1');
    key(radios[0], 'ArrowRight');
    expect(onChange).toHaveBeenLastCalledWith('LINEAR');
    key(radios[0], 'ArrowLeft');
    expect(onChange).toHaveBeenLastCalledWith('MIPMAP');
    key(radios[0], 'End');
    expect(onChange).toHaveBeenLastCalledWith('MIPMAP');
    key(radios[0], 'Home');
    expect(onChange).toHaveBeenLastCalledWith('NEAREST');
    unmount(host);
  });
});

describe('BB-CTRL-06: TextField commits on Enter and blur, reverts on Esc', () => {
  it('commits typed text once and restores on Escape', async () => {
    const onCommit = vi.fn();
    const host = mount(h(TextField, { label: 'Name', value: 'Roof', onCommit }));
    const input = host.querySelector('input')!;
    expect(host.querySelector('label')!.textContent).toBe('Name');
    input.focus();
    input.value = 'Gable';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Gable');

    input.focus();
    input.value = 'Oops';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const esc = key(input, 'Escape');
    await settle();
    expect(esc.defaultPrevented).toBe(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('Roof');
    unmount(host);
  });
});
```

- [ ] **Step 3: Run them and see them fail.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: FAIL, because `@/shared/ui/controls` cannot be resolved.

- [ ] **Step 4: Create `src/shared/ui/controls/Button.tsx`:**

```tsx
import { forwardRef } from 'react';
import type { ComponentChildren } from 'preact';
import './button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ComponentChildren;
  /** Renders only the icon; `label` becomes the accessible name and the tooltip. */
  iconOnly?: boolean;
  label?: string;
  children?: ComponentChildren;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  title?: string;
  id?: string;
  onClick?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  'aria-label'?: string;
  'aria-expanded'?: boolean;
  'aria-haspopup'?: 'menu' | 'dialog';
  'aria-controls'?: string;
  'aria-pressed'?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly = false, label, children, className, type = 'button', title, ...rest },
  ref,
) {
  const classes = ['vbtn', `vbtn--${variant}`, `vbtn--${size}`, iconOnly ? 'vbtn--icon' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      aria-label={iconOnly ? label : rest['aria-label']}
      title={title ?? (iconOnly ? label : undefined)}
    >
      {icon && <span className="vbtn__icon" aria-hidden="true">{icon}</span>}
      {!iconOnly && children}
    </button>
  );
});
```

- [ ] **Step 5: Create `src/shared/ui/controls/button.scss`:**

```scss
.vbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: var(--control-h);
  padding: 0 12px;
  border: 1px solid var(--field-line);
  border-radius: var(--radius-m);
  background: var(--paper-raised);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) { background: var(--paper-sunken); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }

  &--lg { min-height: var(--control-h-lg); padding: 0 14px; }

  &--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    &:hover:not(:disabled) { background: var(--accent); filter: brightness(1.06); }
  }

  &--quiet {
    background: transparent;
    border-color: transparent;
    color: var(--ink-muted);
    &:hover:not(:disabled) { background: var(--paper-sunken); color: var(--ink); }
  }

  &--danger {
    background: transparent;
    border-color: var(--danger);
    color: var(--danger);
    &:hover:not(:disabled) { background: rgba(var(--accent-red-rgb), 0.08); }
  }

  &--icon {
    width: var(--control-h);
    min-width: var(--control-h);
    padding: 0;
    &.vbtn--lg { width: var(--control-h-lg); min-width: var(--control-h-lg); }
  }

  &__icon {
    display: inline-flex;
    svg { width: 16px; height: 16px; }
  }
}
```

- [ ] **Step 6: Create `src/shared/ui/controls/GlHint.tsx` and `gl-hint.scss`:**

```tsx
import './gl-hint.scss';

export interface GlHintProps {
  /** The GL function exactly as the code generator emits it, e.g. `glTranslatef`. */
  call: string;
  /** Parameter names in place of values, e.g. `x, y, 0.0f`. Omit to show the bare name. */
  args?: string;
  className?: string;
}

/** Names the OpenGL call a control group drives. Visual only: the code panel carries the same text. */
export function GlHint({ call, args, className }: GlHintProps) {
  return (
    <p className={className ? `gl-hint ${className}` : 'gl-hint'} aria-hidden="true">
      <code>
        <span className="gl-hint__fn">{call}</span>
        {args !== undefined && `(${args})`}
      </code>
    </p>
  );
}
```

```scss
.gl-hint {
  margin: 0 0 4px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--ink-faint);

  code { font: inherit; }
  &__fn { color: var(--gl-hint); }
}
```

- [ ] **Step 7: Create `src/shared/ui/controls/Switch.tsx`:**

```tsx
import './toggles.scss';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled, id, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      className={className ? `vswitch ${className}` : 'vswitch'}
      onClick={() => onChange(!checked)}
    >
      <span className="vswitch__track" aria-hidden="true">
        <span className="vswitch__thumb" />
      </span>
      <span className="vswitch__label">{label}</span>
    </button>
  );
}
```

- [ ] **Step 8: Create `src/shared/ui/controls/SegmentedControl.tsx`:**

```tsx
import { useRef } from 'react';
import './toggles.scss';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Mono labels, used when options are GL constants such as GL_NEAREST. */
  mono?: boolean;
  disabled?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label, options, value, onChange, mono = false, disabled = false, className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((option) => option.value === value));

  const choose = (index: number) => {
    const next = (index + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        choose(current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        choose(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        choose(0);
        break;
      case 'End':
        event.preventDefault();
        choose(options.length - 1);
        break;
    }
  };

  const classes = ['vseg', mono ? 'vseg--mono' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <div role="radiogroup" aria-label={label} className={classes} onKeyDown={onKeyDown}>
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={index === current ? 0 : -1}
          title={option.title}
          disabled={disabled}
          className={option.value === value ? 'vseg__option is-on' : 'vseg__option'}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Create `src/shared/ui/controls/toggles.scss`:**

```scss
.vswitch {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;

  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: var(--radius-m); }
  &:disabled { opacity: 0.45; cursor: not-allowed; }

  &__track {
    position: relative;
    width: 32px;
    height: 18px;
    border: 1px solid var(--field-line);
    border-radius: 9px;
    background: var(--paper-sunken);
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  &__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--ink-muted);
    transition: transform 0.15s ease, background-color 0.15s ease;
  }

  &[aria-checked='true'] &__track { background: var(--accent); border-color: var(--accent); }
  &[aria-checked='true'] &__thumb { transform: translateX(14px); background: #fff; }
}

.vseg {
  display: inline-flex;
  max-width: 100%;
  border: 1px solid var(--field-line);
  border-radius: var(--radius-m);
  overflow: hidden;

  &__option {
    flex: 1 1 auto;
    min-height: var(--control-h);
    padding: 0 10px;
    border: 0;
    border-right: 1px solid var(--rule);
    background: var(--field-bg);
    color: var(--ink-muted);
    font: inherit;
    font-size: 12px;
    white-space: nowrap;
    cursor: pointer;

    &:last-child { border-right: 0; }
    &:hover:not(:disabled):not(.is-on) { background: var(--paper-sunken); }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
    &.is-on { background: var(--ink); color: var(--paper); font-weight: 600; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  &--mono &__option { font-family: var(--font-mono); font-size: 11.5px; }
}
```

- [ ] **Step 10: Create `src/shared/ui/controls/TextField.tsx`:**

```tsx
import { useId, useRef, useState } from 'react';
import './fields.scss';

export interface TextFieldProps {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  hideLabel?: boolean;
  maxLength?: number;
  id?: string;
  className?: string;
}

/** Text input that commits on Enter or blur and reverts on Escape. */
export function TextField({ label, value, onCommit, placeholder, hideLabel = false, maxLength, id, className }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelled.current = true;
      setDraft(null);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={className ? `vtext ${className}` : 'vtext'}>
      <label htmlFor={inputId} className={hideLabel ? 'vfield-label sr-only' : 'vfield-label'}>{label}</label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        className="vfield-input"
        value={draft ?? value}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setDraft(value)}
        onInput={(event) => setDraft((event.currentTarget as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
```

> Note: after Enter the input keeps focus, with the committed text. A later blur commits nothing new, because `draft` is `null` until the next `focus` or `input`.

- [ ] **Step 11: Create `src/shared/ui/controls/fields.scss`.** It holds the shared field styles; Task 2 adds the number and slider rules.

```scss
.sr-only {
  position: absolute !important;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.vfield-label {
  font-size: 12px;
  color: var(--ink-muted);
}

.vfield-input {
  min-height: var(--control-h);
  width: 100%;
  padding: 0 8px;
  border: 1px solid var(--field-line);
  border-radius: var(--radius-m);
  background: var(--field-bg);
  color: var(--ink);
  font: inherit;
  font-size: 13px;

  &:focus { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  &:disabled { opacity: 0.45; }
}

.vtext {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 12: Create `src/shared/ui/controls/index.ts`:**

```ts
export { Button, type ButtonProps, type ButtonVariant } from './Button';
export { GlHint, type GlHintProps } from './GlHint';
export { Switch, type SwitchProps } from './Switch';
export { SegmentedControl, type SegmentedControlProps, type SegmentOption } from './SegmentedControl';
export { TextField, type TextFieldProps } from './TextField';
```

- [ ] **Step 13: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 14: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/styles/_tokens.scss src/shared/ui/controls tests/black-box/controls.test.ts
git commit -m "feat(controls): add the shared button, toggle and text field controls"
```

---

### Task 2: NumberField and SliderField

**Files:**
- Create: `src/shared/ui/controls/number-utils.ts`, `NumberField.tsx`, `SliderField.tsx`
- Modify: `src/shared/ui/controls/fields.scss` (append), `src/shared/ui/controls/index.ts`
- Test: `tests/black-box/controls.test.ts` (append BB-CTRL-07 to BB-CTRL-14)

**Interfaces:**
- Consumes: `fields.scss` from Task 1.
- Produces:
  - `NumberField(props: NumberFieldProps)`;
  - `SliderField(props: SliderFieldProps)`;
  - `parseNumberInput(text): number | null`;
  - `roundToStep(value, decimals): number`;
  - `decimalsFor(step): number`.

```ts
export interface NumberFieldProps {
  /** Accessible name, e.g. "Translate X". */
  label: string;
  /** Visible scrub handle text, e.g. "X". Defaults to `label`. */
  tag?: string;
  /** Colours the tag like the canvas axes. */
  axis?: 'x' | 'y';
  value: number;
  /** Applies a new value (live while scrubbing). */
  onChange: (value: number) => void;
  /** Called once before each discrete change, and once at the start of a drag. Panels call pushToHistory() here. */
  onBeginChange?: () => void;
  /** Called after each discrete change, and once at the end of a drag. */
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;        // default 0.01
  bigStep?: number;     // default step * 10
  fineStep?: number;    // default step / 10
  precision?: number;   // default 2
  unit?: string;
  scrubPixelsPerStep?: number; // default 4
  /** Hides the tag (table cells); the field keeps its accessible name. */
  hideTag?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  precision?: number;   // default 2
  unit?: string;
  id?: string;
  className?: string;
}
```

**Ruling recorded for the spec.** §4.3's `onScrubStart` is named `onBeginChange`. It fires before every discrete change (a typed commit, a key step) and once at the start of a drag. That way a panel wires `onBeginChange={pushToHistory}` once and gets exactly one undo step per drag. Step 9 below updates the spec text.

- [ ] **Step 1: Append the failing tests** to `tests/black-box/controls.test.ts`. Add `NumberField`, `SliderField` and `parseNumberInput` to the import from `@/shared/ui/controls`, and add this helper next to the others:

```ts
function pointer(target: EventTarget, type: string, clientX: number, init: PointerEventInit = {}) {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, pointerId: 1, ...init });
  target.dispatchEvent(event);
  return event;
}
```

```ts
describe('BB-CTRL-07: parseNumberInput accepts decimals and rejects junk', () => {
  it('parses dots, commas and the minus sign; rejects empty and text', () => {
    expect(parseNumberInput('0.5')).toBe(0.5);
    expect(parseNumberInput(' -1,25 ')).toBe(-1.25);
    expect(parseNumberInput('−0.3')).toBe(-0.3);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });
});

describe('BB-CTRL-08: Typing commits once on blur, clamped to the range', () => {
  it('calls onBeginChange, onChange and onCommit once each', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, min: -1, max: 1, onChange, onBeginChange, onCommit }));
    const input = host.querySelector('input')!;
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-label')).toBe('Translate X');
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount(host);
  });
});

describe('BB-CTRL-09: An invalid entry shows a message and never writes NaN', () => {
  it('shows "Enter a number" on Enter and reverts on blur', async () => {
    const onChange = vi.fn();
    const host = mount(h(NumberField, { label: 'Scale X', value: 1, onChange }));
    const input = host.querySelector('input')!;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Enter');
    await settle();
    expect(host.textContent).toContain('Enter a number');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('1.00');
    unmount(host);
  });
});

describe('BB-CTRL-10: Arrow keys step, Shift steps big, Alt steps fine, Home/End jump', () => {
  it('applies the right step for each modifier', async () => {
    const onChange = vi.fn();
    const host = mount(h(NumberField, { label: 'Rotate', value: 10, step: 1, min: -360, max: 360, precision: 1, onChange }));
    const input = host.querySelector('input')!;
    key(input, 'ArrowUp');
    expect(onChange).toHaveBeenLastCalledWith(11);
    key(input, 'ArrowDown', { shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(0);
    key(input, 'ArrowUp', { altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(10.1);
    key(input, 'PageUp');
    expect(onChange).toHaveBeenLastCalledWith(20);
    key(input, 'End');
    expect(onChange).toHaveBeenLastCalledWith(360);
    key(input, 'Home');
    expect(onChange).toHaveBeenLastCalledWith(-360);
    unmount(host);
  });
});

describe('BB-CTRL-11: Scrubbing the tag changes the value with one history step', () => {
  it('moves by step per 4 px, begins once and commits once', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, step: 0.01, onChange, onBeginChange, onCommit }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 100);
    pointer(tag, 'pointermove', 101);
    expect(onBeginChange).not.toHaveBeenCalled();
    pointer(tag, 'pointermove', 140);
    pointer(tag, 'pointermove', 160);
    pointer(tag, 'pointerup', 160);
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.15);
    expect(onCommit).toHaveBeenCalledTimes(1);
    unmount(host);
  });

  it('a click without movement focuses the input for typing', async () => {
    const host = mount(h(NumberField, { label: 'Translate X', tag: 'X', value: 0, onChange: vi.fn() }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 50);
    pointer(tag, 'pointerup', 51);
    await settle();
    expect(document.activeElement).toBe(host.querySelector('input'));
    unmount(host);
  });
});

describe('BB-CTRL-12: Esc during a scrub restores the value and does not reach window listeners', () => {
  it('restores the start value and stops the keydown', async () => {
    const onChange = vi.fn();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    const host = mount(h(NumberField, { label: 'Rotate', tag: 'θ', value: 15, step: 1, onChange }));
    const tag = host.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 40);
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(25);
    key(document.body, 'Escape');
    await settle();
    expect(onChange).toHaveBeenLastCalledWith(15);
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    unmount(host);
  });
});

describe('BB-CTRL-13: Esc while typing cancels the edit without bubbling', () => {
  it('stops propagation so a surrounding dialog stays open', async () => {
    const parentKeydown = vi.fn();
    const host = mount(h('div', { onKeyDown: parentKeydown }, h(NumberField, { label: 'Scale X', value: 1, onChange: vi.fn() })));
    const input = host.querySelector('input')!;
    input.dispatchEvent(new FocusEvent('focus'));
    input.value = '3';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    key(input, 'Escape');
    await settle();
    expect(parentKeydown).not.toHaveBeenCalled();
    expect(input.value).toBe('1.00');
    unmount(host);
  });
});

describe('BB-CTRL-14: SliderField pairs a range with an exact number', () => {
  it('both inputs share the value and report changes', async () => {
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const host = mount(h(SliderField, { label: 'Line width', value: 3, min: 0.5, max: 12, step: 0.5, precision: 1, unit: 'px', onChange, onBeginChange }));
    const range = host.querySelector('input[type="range"]') as HTMLInputElement;
    const number = host.querySelector('input[role="spinbutton"]') as HTMLInputElement;
    expect(host.querySelector('label')!.textContent).toBe('Line width');
    expect(range.value).toBe('3');
    expect(number.value).toBe('3.0');
    range.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    range.value = '4.5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(4.5);
    expect(host.textContent).toContain('0.5');
    expect(host.textContent).toContain('12');
    unmount(host);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: FAIL, because `NumberField`, `SliderField` and `parseNumberInput` are not exported.

- [ ] **Step 3: Create `src/shared/ui/controls/number-utils.ts`:**

```ts
const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

/** Parses user-typed numbers: accepts "1,5" and the Unicode minus sign; returns null for anything else. */
export function parseNumberInput(text: string): number | null {
  const normalized = text.trim().replace('−', '-').replace(',', '.');
  if (normalized === '' || !NUMBER_PATTERN.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Decimal places needed to represent a step (0.01 → 2, 0.5 → 1, 1 → 0), capped at 6. */
export function decimalsFor(step: number): number {
  if (!(step > 0)) return 0;
  return Math.min(6, Math.max(0, Math.ceil(-Math.log10(step) - 1e-9)));
}

export function roundToStep(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}
```

- [ ] **Step 4: Create `src/shared/ui/controls/NumberField.tsx`:**

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { decimalsFor, parseNumberInput, roundToStep } from './number-utils';
import './fields.scss';

export interface NumberFieldProps {
  label: string;
  tag?: string;
  axis?: 'x' | 'y';
  value: number;
  onChange: (value: number) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  bigStep?: number;
  fineStep?: number;
  precision?: number;
  unit?: string;
  scrubPixelsPerStep?: number;
  hideTag?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

interface ScrubState {
  startX: number;
  startValue: number;
  lastValue: number;
  moved: boolean;
}

const DRAG_THRESHOLD = 3;

export function NumberField({
  label, tag, axis, value, onChange, onBeginChange, onCommit,
  min, max, step = 0.01, bigStep, fineStep, precision = 2, unit,
  scrubPixelsPerStep = 4, hideTag = false, disabled = false, id, className,
}: NumberFieldProps) {
  const big = bigStep ?? step * 10;
  const fine = fineStep ?? step / 10;
  const decimals = Math.max(precision, decimalsFor(fine));
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubRef = useRef<ScrubState | null>(null);
  const cancelledRef = useRef(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return roundToStep(result, decimals);
  };

  const applyDiscrete = (next: number) => {
    const clamped = clamp(next);
    if (clamped === value) return;
    onBeginChange?.();
    onChange(clamped);
    onCommit?.();
  };

  const commitDraft = (fromBlur: boolean) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(null);
      setInvalid(false);
      return;
    }
    if (draft === null) return;
    const parsed = parseNumberInput(draft);
    if (parsed === null) {
      if (fromBlur) {
        setDraft(null);
        setInvalid(false);
      } else {
        setInvalid(true);
      }
      return;
    }
    setDraft(null);
    setInvalid(false);
    applyDiscrete(parsed);
  };

  const stepBy = (delta: number) => {
    const base = draft !== null ? parseNumberInput(draft) ?? value : value;
    setDraft(null);
    setInvalid(false);
    applyDiscrete(base + delta);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const unitStep = event.shiftKey ? big : event.altKey ? fine : step;
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        commitDraft(false);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        cancelledRef.current = draft !== null;
        setDraft(null);
        setInvalid(false);
        if (draft === null) inputRef.current?.blur();
        break;
      case 'ArrowUp':
        event.preventDefault();
        stepBy(unitStep);
        break;
      case 'ArrowDown':
        event.preventDefault();
        stepBy(-unitStep);
        break;
      case 'PageUp':
        event.preventDefault();
        stepBy(big);
        break;
      case 'PageDown':
        event.preventDefault();
        stepBy(-big);
        break;
      case 'Home':
        if (min !== undefined) {
          event.preventDefault();
          applyDiscrete(min);
        }
        break;
      case 'End':
        if (max !== undefined) {
          event.preventDefault();
          applyDiscrete(max);
        }
        break;
    }
  };

  const endScrub = () => {
    scrubRef.current = null;
    setScrubbing(false);
    document.body.classList.remove('is-scrubbing');
  };

  // While a drag is live, Esc restores the starting value. The listener runs in the
  // capture phase on window so lesson-level Esc handlers never see the key.
  useEffect(() => {
    if (!scrubbing) return;
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const scrub = scrubRef.current;
      if (!scrub) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
      onChange(scrub.startValue);
      endScrub();
      onCommit?.();
    };
    window.addEventListener('keydown', onWindowKey, true);
    return () => window.removeEventListener('keydown', onWindowKey, true);
  }, [scrubbing, onChange, onCommit]);

  const onTagPointerDown = (event: PointerEvent) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as Element | null;
    target?.setPointerCapture?.(event.pointerId);
    scrubRef.current = { startX: event.clientX, startValue: value, lastValue: value, moved: false };
  };

  const onTagPointerMove = (event: PointerEvent) => {
    const scrub = scrubRef.current;
    if (!scrub) return;
    const dx = event.clientX - scrub.startX;
    if (!scrub.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      scrub.moved = true;
      onBeginChange?.();
      setScrubbing(true);
      document.body.classList.add('is-scrubbing');
    }
    const unitStep = event.shiftKey ? big : event.altKey ? fine : step;
    const next = clamp(scrub.startValue + Math.trunc(dx / scrubPixelsPerStep) * unitStep);
    if (next !== scrub.lastValue) {
      scrub.lastValue = next;
      onChange(next);
    }
  };

  const onTagPointerUp = (event: PointerEvent) => {
    const scrub = scrubRef.current;
    const target = event.currentTarget as Element | null;
    if (target?.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId);
    if (!scrub) return;
    if (scrub.moved) {
      endScrub();
      onCommit?.();
    } else {
      scrubRef.current = null;
      inputRef.current?.focus();
    }
  };

  const shown = draft ?? value.toFixed(precision);
  const classes = [
    'vnum',
    axis ? `vnum--${axis}` : '',
    scrubbing ? 'is-scrubbing' : '',
    invalid ? 'is-invalid' : '',
    hideTag ? 'vnum--bare' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="vnum__box">
        {!hideTag && (
          <button
            type="button"
            className="vnum__tag"
            tabIndex={-1}
            aria-hidden="true"
            title="Drag to change, click to type"
            disabled={disabled}
            onPointerDown={onTagPointerDown}
            onPointerMove={onTagPointerMove}
            onPointerUp={onTagPointerUp}
            onPointerCancel={onTagPointerUp}
          >
            {tag ?? label}
          </button>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          className="vnum__input"
          aria-label={label}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)}
          aria-invalid={invalid ? 'true' : undefined}
          aria-describedby={invalid ? errorId : undefined}
          value={shown}
          disabled={disabled}
          onFocus={() => {
            setDraft(value.toFixed(precision));
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onInput={(event) => {
            setDraft((event.currentTarget as HTMLInputElement).value);
            setInvalid(false);
          }}
          onBlur={() => commitDraft(true)}
          onKeyDown={onKeyDown}
        />
        {unit && <span className="vnum__unit" aria-hidden="true">{unit}</span>}
      </div>
      {invalid && (
        <span id={errorId} className="vnum__error" role="alert">Enter a number</span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create `src/shared/ui/controls/SliderField.tsx`:**

```tsx
import { useId } from 'react';
import { NumberField } from './NumberField';
import './fields.scss';

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  precision?: number;
  unit?: string;
  id?: string;
  className?: string;
}

const RANGE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export function SliderField({
  label, value, min, max, step, onChange, onBeginChange, onCommit, precision = 2, unit, id, className,
}: SliderFieldProps) {
  const autoId = useId();
  const rangeId = id ?? autoId;
  return (
    <div className={className ? `vslider ${className}` : 'vslider'}>
      <label className="vfield-label" htmlFor={rangeId}>{label}</label>
      <div className="vslider__track">
        <input
          id={rangeId}
          type="range"
          className="vslider__range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={unit ? `${value.toFixed(precision)} ${unit}` : value.toFixed(precision)}
          onPointerDown={() => onBeginChange?.()}
          onKeyDown={(event) => {
            if (RANGE_KEYS.has(event.key)) onBeginChange?.();
          }}
          onInput={(event) => onChange(Number((event.currentTarget as HTMLInputElement).value))}
          onChange={() => onCommit?.()}
        />
        <span className="vslider__ends" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </span>
      </div>
      <NumberField
        label={`${label}, exact value`}
        hideTag
        value={value}
        min={min}
        max={max}
        step={step}
        precision={precision}
        unit={unit}
        onChange={onChange}
        onBeginChange={onBeginChange}
        onCommit={onCommit}
      />
    </div>
  );
}
```

- [ ] **Step 6: Append the number and slider styles to `src/shared/ui/controls/fields.scss`:**

```scss
.vnum {
  display: inline-flex;
  flex-direction: column;
  min-width: 0;

  &__box {
    display: flex;
    align-items: stretch;
    min-height: var(--control-h);
    border: 1px solid var(--field-line);
    border-radius: var(--radius-m);
    background: var(--field-bg);
    overflow: hidden;
  }

  &:focus-within &__box { outline: 2px solid var(--focus-ring); outline-offset: 1px; }

  &__tag {
    flex: none;
    min-width: 24px;
    padding: 0 6px;
    border: 0;
    border-right: 1px solid var(--hairline);
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    cursor: ew-resize;
    touch-action: none;
    user-select: none;

    &:hover { background: var(--live-tint); }
  }

  &--x &__tag { color: var(--channel-r); }
  &--y &__tag { color: var(--channel-g); }

  &.is-scrubbing &__box { border-color: var(--live); }
  &.is-scrubbing &__tag { background: var(--live); color: var(--on-accent); }

  &__input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    padding: 0 7px;
    border: 0;
    background: transparent;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 12.5px;
    text-align: right;

    &:focus { outline: none; }
  }

  &__unit {
    align-self: center;
    padding-right: 7px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-faint);
  }

  &.is-invalid &__box { border-color: var(--danger); }

  &__error {
    margin-top: 3px;
    font-size: 11.5px;
    color: var(--danger);
  }
}

body.is-scrubbing,
body.is-scrubbing * {
  cursor: ew-resize !important;
}

.vslider {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 84px;
  align-items: center;
  gap: 8px;

  &__track {
    position: relative;
    padding-bottom: 12px;
  }

  &__range {
    width: 100%;
    height: 24px;
    margin: 0;
    background: transparent;
    accent-color: var(--accent);
    cursor: pointer;

    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  }

  &__ends {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-faint);
  }
}
```

- [ ] **Step 7: Export the new controls** from `src/shared/ui/controls/index.ts`:

```ts
export { NumberField, type NumberFieldProps } from './NumberField';
export { SliderField, type SliderFieldProps } from './SliderField';
export { parseNumberInput, decimalsFor, roundToStep } from './number-utils';
```

- [ ] **Step 8: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: PASS (15 tests).

If happy-dom lacks `PointerEvent` or `setPointerCapture`, the optional calls (`?.`) already guard the capture. If `PointerEvent` itself is undefined, add the following to `tests/setup.ts`, and tell the reviewer you did:

```ts
if (typeof globalThis.PointerEvent === 'undefined') {
  // happy-dom fallback: pointer events behave as mouse events for these tests.
  // @ts-expect-error minimal polyfill
  globalThis.PointerEvent = class PointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
}
```

- [ ] **Step 9: Update the spec's NumberField wording.** In `docs/specs/2026-10-06-editor-redesign-design.md` §4.3, replace the History bullet's text with:

```markdown
- History: the field calls `onBeginChange()` before every discrete change (a typed commit, a key step) and once at the start of a drag, and `onCommit()` after each discrete change and once at the end of a drag. Panels pass `onBeginChange={pushToHistory}`, which gives one undo step per drag.
```

and change "`onScrubStart`" everywhere else in that section to "`onBeginChange`".

- [ ] **Step 10: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/controls tests/black-box/controls.test.ts docs/specs/2026-10-06-editor-redesign-design.md
git commit -m "feat(controls): add number fields that scrub, step and type, and paired sliders"
```

If you changed `tests/setup.ts` in Step 8, stage it too.

---
### Task 3: ColorField with GL readout and recent colours

**Files:**
- Create: `src/shared/ui/controls/color-utils.ts`, `recent-colors.ts`, `ColorField.tsx`, `color.scss`
- Modify: `src/shared/ui/controls/index.ts`
- Test: `tests/black-box/controls.test.ts` (append BB-CTRL-15 to BB-CTRL-18)

**Interfaces:**
- Produces:
  - `ColorField(props: ColorFieldProps)`;
  - `type ColorGlCall = 'glColor3f' | 'glColor3ub' | 'glClearColor'`;
  - `normalizeHex(input: string): string | null`, which returns lowercase `#rrggbb`;
  - `glColorArgs(hex: string, call: ColorGlCall): string`;
  - `glColorReadout(hex: string, call: ColorGlCall): string`;
  - `pushRecentColor(hex)`, `useRecentColors(): string[]`, `resetRecentColorsForTests()`.

```ts
export interface ColorFieldProps {
  label: string;
  /** Hex colour, `#rrggbb`. */
  value: string;
  onChange: (hex: string) => void;
  /** Once before a typed or recent-swatch change, and once at the start of a picking session. */
  onBeginChange?: () => void;
  /** After a typed or recent-swatch change, and when the picker closes. */
  onCommit?: () => void;
  glCall: ColorGlCall;
  showRecent?: boolean; // default true
  id?: string;
  className?: string;
}
```

- [ ] **Step 1: Append the failing tests** to `tests/black-box/controls.test.ts`. Import `ColorField`, `normalizeHex`, `glColorReadout` and `resetRecentColorsForTests` from `@/shared/ui/controls`.

```ts
describe('BB-CTRL-15: Hex parsing and the GL readout', () => {
  it('normalizes hex and formats glColor3f, glColor3ub and glClearColor', () => {
    expect(normalizeHex('B91C1C')).toBe('#b91c1c');
    expect(normalizeHex('#abc')).toBe('#aabbcc');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(glColorReadout('#b91c1c', 'glColor3f')).toBe('glColor3f(0.73, 0.11, 0.11)');
    expect(glColorReadout('#b91c1c', 'glColor3ub')).toBe('glColor3ub(185, 28, 28)');
    expect(glColorReadout('#000000', 'glClearColor')).toBe('glClearColor(0.00, 0.00, 0.00, 1.0)');
  });
});

describe('BB-CTRL-16: Typing a hex value commits once and updates the readout', () => {
  it('calls onBeginChange, onChange and onCommit once', async () => {
    resetRecentColorsForTests();
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange, onBeginChange, onCommit }));
    const hex = host.querySelector('input[type="text"]') as HTMLInputElement;
    expect(hex.getAttribute('aria-label')).toBe('Fill hex value');
    expect(host.querySelector('.vcolor__gl')!.textContent).toBe('glColor3f(1.00, 1.00, 1.00)');
    hex.dispatchEvent(new FocusEvent('focus'));
    hex.value = 'b91c1c';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    key(hex, 'Enter');
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('#b91c1c');
    expect(onCommit).toHaveBeenCalledTimes(1);
    render(h(ColorField, { label: 'Fill', value: '#b91c1c', glCall: 'glColor3f', onChange, onBeginChange, onCommit }), host);
    await settle();
    expect(host.querySelector('.vcolor__gl')!.textContent).toBe('glColor3f(0.73, 0.11, 0.11)');
    unmount(host);
  });
});

describe('BB-CTRL-17: An invalid hex value shows a message and reverts', () => {
  it('never calls onChange', async () => {
    const onChange = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange }));
    const hex = host.querySelector('input[type="text"]') as HTMLInputElement;
    hex.dispatchEvent(new FocusEvent('focus'));
    hex.value = 'zz';
    hex.dispatchEvent(new Event('input', { bubbles: true }));
    key(hex, 'Enter');
    await settle();
    expect(host.textContent).toContain('Enter a hex color like #B91C1C');
    hex.dispatchEvent(new FocusEvent('blur'));
    await settle();
    expect(onChange).not.toHaveBeenCalled();
    expect(hex.value).toBe('FFFFFF');
    unmount(host);
  });
});

describe('BB-CTRL-18: Picking begins history once and fills the recent colours', () => {
  it('one onBeginChange per picking session; recent swatch applies its colour', async () => {
    resetRecentColorsForTests();
    const onChange = vi.fn();
    const onBeginChange = vi.fn();
    const onCommit = vi.fn();
    const host = mount(h(ColorField, { label: 'Fill', value: '#ffffff', glCall: 'glColor3f', onChange, onBeginChange, onCommit }));
    const picker = host.querySelector('input[type="color"]') as HTMLInputElement;
    picker.value = '#ff0000';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
    picker.value = '#00ff00';
    picker.dispatchEvent(new Event('input', { bubbles: true }));
    picker.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(onBeginChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    expect(onCommit).toHaveBeenCalledTimes(1);
    const chip = host.querySelector('button[aria-label="Use #00FF00"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    chip.click();
    expect(onChange).toHaveBeenLastCalledWith('#00ff00');
    unmount(host);
  });
});
```

> In BB-CTRL-18 the chip click passes `#00ff00` while `value` is still `#ffffff`, so it counts as a change: `onChange` is called again with `#00ff00`.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: FAIL, because the imports are missing.

- [ ] **Step 3: Create `src/shared/ui/controls/color-utils.ts`:**

```ts
export type ColorGlCall = 'glColor3f' | 'glColor3ub' | 'glClearColor';

/** Accepts `abc`, `#abc`, `aabbcc` or `#AABBCC`; returns lowercase `#rrggbb`, or null. */
export function normalizeHex(input: string): string | null {
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(text)) {
    return `#${text.split('').map((c) => c + c).join('')}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`.toLowerCase();
  return null;
}

export function hexToBytes(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? '#000000';
  return [
    parseInt(normalized.slice(1, 3), 16),
    parseInt(normalized.slice(3, 5), 16),
    parseInt(normalized.slice(5, 7), 16),
  ];
}

/** The arguments GL receives for this colour, e.g. `0.73, 0.11, 0.11`. */
export function glColorArgs(hex: string, call: ColorGlCall): string {
  const [r, g, b] = hexToBytes(hex);
  if (call === 'glColor3ub') return `${r}, ${g}, ${b}`;
  const f = (byte: number) => (byte / 255).toFixed(2);
  if (call === 'glClearColor') return `${f(r)}, ${f(g)}, ${f(b)}, 1.0`;
  return `${f(r)}, ${f(g)}, ${f(b)}`;
}

export function glColorReadout(hex: string, call: ColorGlCall): string {
  return `${call}(${glColorArgs(hex, call)})`;
}
```

- [ ] **Step 4: Create `src/shared/ui/controls/recent-colors.ts`:**

```ts
import { useSyncExternalStore } from 'react';

const MAX_RECENT = 8;
let recent: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Remembers a committed colour for this session (not persisted). */
export function pushRecentColor(hex: string) {
  const normalized = hex.toLowerCase();
  recent = [normalized, ...recent.filter((c) => c !== normalized)].slice(0, MAX_RECENT);
  notify();
}

export function getRecentColors(): string[] {
  return recent;
}

export function subscribeRecentColors(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetRecentColorsForTests() {
  recent = [];
  notify();
}

export function useRecentColors(): string[] {
  return useSyncExternalStore(subscribeRecentColors, getRecentColors);
}
```

- [ ] **Step 5: Create `src/shared/ui/controls/ColorField.tsx`:**

```tsx
import { useId, useRef, useState } from 'react';
import { glColorArgs, normalizeHex, type ColorGlCall } from './color-utils';
import { pushRecentColor, useRecentColors } from './recent-colors';
import './color.scss';

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  onBeginChange?: () => void;
  onCommit?: () => void;
  glCall: ColorGlCall;
  showRecent?: boolean;
  id?: string;
  className?: string;
}

export function ColorField({
  label, value, onChange, onBeginChange, onCommit, glCall, showRecent = true, id, className,
}: ColorFieldProps) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const errorId = `${baseId}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const pickingRef = useRef(false);
  const recent = useRecentColors();
  const current = normalizeHex(value) ?? '#000000';

  const applyCommitted = (hex: string) => {
    if (hex !== current) {
      onBeginChange?.();
      onChange(hex);
      onCommit?.();
    }
    pushRecentColor(hex);
  };

  const commitHex = (fromBlur: boolean) => {
    if (draft === null) return;
    const hex = normalizeHex(draft);
    if (!hex) {
      if (fromBlur) {
        setDraft(null);
        setInvalid(false);
      } else {
        setInvalid(true);
      }
      return;
    }
    setDraft(null);
    setInvalid(false);
    applyCommitted(hex);
  };

  return (
    <div className={className ? `vcolor ${className}` : 'vcolor'}>
      <span className="vfield-label vcolor__label">{label}</span>
      <div className="vcolor__row">
        <input
          type="color"
          className="vcolor__swatch"
          aria-label={`${label} picker`}
          value={current}
          onInput={(event) => {
            const hex = normalizeHex((event.currentTarget as HTMLInputElement).value);
            if (!hex) return;
            if (!pickingRef.current) {
              pickingRef.current = true;
              onBeginChange?.();
            }
            onChange(hex);
          }}
          onChange={(event) => {
            const hex = normalizeHex((event.currentTarget as HTMLInputElement).value);
            pickingRef.current = false;
            if (hex) pushRecentColor(hex);
            onCommit?.();
          }}
        />
        <span className="vcolor__hex">
          <span aria-hidden="true">#</span>
          <input
            type="text"
            className="vcolor__hex-input"
            aria-label={`${label} hex value`}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={invalid ? errorId : undefined}
            spellcheck={false}
            maxLength={7}
            value={draft ?? current.slice(1).toUpperCase()}
            onFocus={() => setDraft(current.slice(1).toUpperCase())}
            onInput={(event) => {
              setDraft((event.currentTarget as HTMLInputElement).value);
              setInvalid(false);
            }}
            onBlur={() => commitHex(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitHex(false);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setDraft(null);
                setInvalid(false);
              }
            }}
          />
        </span>
        <code className="vcolor__gl" aria-hidden="true">
          <span className="vcolor__fn">{glCall}</span>({glColorArgs(current, glCall)})
        </code>
      </div>
      {invalid && (
        <span id={errorId} className="vcolor__error" role="alert">Enter a hex color like #B91C1C</span>
      )}
      {showRecent && recent.length > 0 && (
        <div className="vcolor__recent" role="group" aria-label="Recent colors">
          {recent.map((hex) => (
            <button
              key={hex}
              type="button"
              className="vcolor__chip"
              style={{ background: hex }}
              aria-label={`Use ${hex.toUpperCase()}`}
              title={hex.toUpperCase()}
              onClick={() => applyCommitted(hex)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

> `.vcolor__gl`'s `textContent` must equal `glColor3f(0.73, 0.11, 0.11)` exactly. The JSX above renders the `<span>` followed by the text `(…)`, with no spaces in between. Keep it on one line as written.

- [ ] **Step 6: Create `src/shared/ui/controls/color.scss`:**

```scss
.vcolor {
  display: grid;
  gap: 6px;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__swatch {
    flex: none;
    width: 42px;
    height: var(--control-h);
    padding: 2px;
    border: 1px solid var(--field-line);
    border-radius: var(--radius-m);
    background: var(--field-bg);
    cursor: pointer;

    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
    &::-webkit-color-swatch-wrapper { padding: 0; }
    &::-webkit-color-swatch { border: 0; border-radius: 2px; }
  }

  &__hex {
    display: inline-flex;
    align-items: center;
    flex: none;
    width: 92px;
    min-height: var(--control-h);
    padding: 0 6px;
    border: 1px solid var(--field-line);
    border-radius: var(--radius-m);
    background: var(--field-bg);
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--ink-faint);

    &:focus-within { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
  }

  &__hex-input {
    width: 100%;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    text-transform: uppercase;

    &:focus { outline: none; }
  }

  &__gl {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-muted);
  }

  &__fn { color: var(--gl-hint); }

  &__error {
    font-size: 11.5px;
    color: var(--danger);
  }

  &__recent {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  &__chip {
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--field-line);
    border-radius: 3px;
    cursor: pointer;

    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  }
}
```

- [ ] **Step 7: Export the new pieces** from `src/shared/ui/controls/index.ts`:

```ts
export { ColorField, type ColorFieldProps } from './ColorField';
export { normalizeHex, hexToBytes, glColorArgs, glColorReadout, type ColorGlCall } from './color-utils';
export { pushRecentColor, useRecentColors, resetRecentColorsForTests } from './recent-colors';
```

- [ ] **Step 8: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 9: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/controls tests/black-box/controls.test.ts
git commit -m "feat(controls): add a colour field that shows the values GL receives"
```

---

### Task 4: Panel (with lesson focus) and DataTable

**Files:**
- Create: `src/shared/ui/controls/panel-context.ts`, `Panel.tsx`, `panel.scss`, `DataTable.tsx`, `table.scss`
- Modify:
  - `src/shared/ui/collapsible-section/CollapsibleSection.tsx`, which becomes a re-export;
  - `src/shared/ui/controls/index.ts`.
- Delete: `src/shared/ui/collapsible-section/collapsible-section.scss`
- Test: `tests/black-box/controls.test.ts` (append BB-CTRL-19 to BB-CTRL-22)

**Interfaces:**
- Produces:
  - `PanelLayoutContext` (Preact context) with type `PanelLayout = { mode: 'author' | 'lesson'; focusPanelId: string | null }`, default `{ mode: 'author', focusPanelId: null }`;
  - `Panel(props: PanelProps)`;
  - `DataTable<Row>(props: DataTableProps<Row>)`, with type `DataColumn<Row>`;
  - `CollapsibleSection` (default export), which keeps working for every existing import with the same props.

```ts
export interface PanelProps {
  title: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  defaultOpen?: boolean;
  /** Lesson focusPanel target. */
  panelId?: string;
  /** Mono GL call shown at the right of the header, e.g. `glLineStipple`. */
  hint?: string;
  className?: string;
}

export interface DataColumn<Row> {
  key: string;
  header: string;
  render: (row: Row, rowIndex: number) => ComponentChildren;
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<Row> {
  /** Accessible table caption (visually hidden). */
  caption: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, rowIndex: number) => string;
  activeRowKey?: string | null;
  footer?: ComponentChildren;
  className?: string;
}
```

- [ ] **Step 1: Append the failing tests** to `tests/black-box/controls.test.ts`. Import `Panel`, `PanelLayoutContext` and `DataTable` from `@/shared/ui/controls`, and `CollapsibleSection` from `@/shared/ui/collapsible-section/CollapsibleSection`.

```ts
describe('BB-CTRL-19: Panel header toggles its body and names its GL call', () => {
  it('starts at defaultOpen, toggles on click, shows the hint', async () => {
    const host = mount(h(Panel, { title: 'Line Style', hint: 'glLineStipple', panelId: 'line-style-panel', defaultOpen: true }, h('p', {}, 'body')));
    const header = host.querySelector('.vpanel__header') as HTMLButtonElement;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('.vpanel__hint')!.textContent).toBe('glLineStipple');
    expect(host.textContent).toContain('body');
    header.click();
    await settle();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(host.textContent).not.toContain('body');
    expect(host.querySelector('[data-panel-id="line-style-panel"]')).not.toBeNull();
    unmount(host);
  });
});

describe('BB-CTRL-20: In lesson mode only the focus panel opens', () => {
  it('collapses other panels even when defaultOpen, and outlines the focus', () => {
    const tree = h(
      PanelLayoutContext.Provider,
      { value: { mode: 'lesson', focusPanelId: 'object-transform' } },
      h(Panel, { title: 'Scene Hierarchy', panelId: 'scene-hierarchy', defaultOpen: true }, 'tree'),
      h(Panel, { title: 'Object Transform', panelId: 'object-transform' }, 'fields'),
    );
    const host = mount(tree);
    const sections = host.querySelectorAll('.vpanel');
    expect(sections[0].querySelector('.vpanel__header')!.getAttribute('aria-expanded')).toBe('false');
    expect(sections[1].querySelector('.vpanel__header')!.getAttribute('aria-expanded')).toBe('true');
    expect(sections[1].classList.contains('is-lesson-focus')).toBe(true);
    unmount(host);
  });
});

describe('BB-CTRL-21: CollapsibleSection keeps working as Panel', () => {
  it('renders the same structure through the old import', () => {
    const host = mount(h(CollapsibleSection, { title: 'Callbacks', icon: h('svg', {}), panelId: 'callbacks-panel' }, 'x'));
    expect(host.querySelector('.vpanel[data-panel-id="callbacks-panel"]')).not.toBeNull();
    expect(host.querySelector('.vpanel__title')!.textContent).toBe('Callbacks');
    unmount(host);
  });
});

describe('BB-CTRL-22: DataTable renders a captioned table with column headers', () => {
  it('renders rows via column renderers and marks the active row', () => {
    const rows = [{ x: -0.5, y: -0.4 }, { x: 0.5, y: -0.4 }];
    const host = mount(h(DataTable<{ x: number; y: number }>, {
      caption: 'Vertices',
      columns: [
        { key: 'i', header: '#', render: (_r, i) => String(i) },
        { key: 'x', header: 'X', numeric: true, render: (r) => r.x.toFixed(2) },
        { key: 'y', header: 'Y', numeric: true, render: (r) => r.y.toFixed(2) },
      ],
      rows,
      rowKey: (_r, i) => `v${i}`,
      activeRowKey: 'v1',
    }));
    expect(host.querySelector('caption')!.textContent).toBe('Vertices');
    const headers = [...host.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['#', 'X', 'Y']);
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(3);
    const bodyRows = host.querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(bodyRows[1].classList.contains('is-active')).toBe(true);
    expect(bodyRows[1].textContent).toBe('10.50-0.40');
    unmount(host);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: FAIL, because the imports are missing.

- [ ] **Step 3: Create `src/shared/ui/controls/panel-context.ts`:**

```ts
import { createContext } from 'preact';

export interface PanelLayout {
  mode: 'author' | 'lesson';
  focusPanelId: string | null;
}

/** Set by the section column: in lesson mode only the step's focus panel starts open. */
export const PanelLayoutContext = createContext<PanelLayout>({ mode: 'author', focusPanelId: null });
```

- [ ] **Step 4: Create `src/shared/ui/controls/Panel.tsx`:**

```tsx
import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PanelLayoutContext } from './panel-context';
import './panel.scss';

export interface PanelProps {
  title: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  defaultOpen?: boolean;
  panelId?: string;
  hint?: string;
  className?: string;
}

export function Panel({ title, icon, children, defaultOpen = false, panelId, hint, className }: PanelProps) {
  const { mode, focusPanelId } = useContext(PanelLayoutContext);
  const isFocus = mode === 'lesson' && !!panelId && panelId === focusPanelId;
  const [open, setOpen] = useState(() => (mode === 'lesson' ? isFocus : defaultOpen));
  const [wasFocus, setWasFocus] = useState(isFocus);
  if (isFocus !== wasFocus) {
    setWasFocus(isFocus);
    if (isFocus) setOpen(true);
  }

  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isFocus) return;
    const el = sectionRef.current;
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  }, [isFocus]);

  const bodyId = useId();
  const classes = ['vpanel', open ? 'is-open' : '', isFocus ? 'is-lesson-focus' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <section ref={sectionRef} className={classes} data-panel-id={panelId}>
      <h3 className="vpanel__heading">
        <button
          type="button"
          className="vpanel__header"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          {icon && <span className="vpanel__icon" aria-hidden="true">{icon}</span>}
          <span className="vpanel__title">{title}</span>
          {hint && <code className="vpanel__hint" aria-hidden="true">{hint}</code>}
        </button>
      </h3>
      <div id={bodyId} className="vpanel__body" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `src/shared/ui/controls/panel.scss`:**

```scss
.vpanel {
  border-bottom: 1px solid var(--hairline);

  &__heading {
    margin: 0;
    font: inherit;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    min-height: 32px;
    padding: 0 12px;
    border: 0;
    background: transparent;
    color: var(--ink-muted);
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    text-align: left;
    cursor: pointer;

    &:hover { background: var(--paper-sunken); color: var(--ink); }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
    svg { flex: none; color: var(--ink-faint); }
  }

  &.is-open &__header { color: var(--ink); }

  &__icon {
    display: inline-flex;
    svg { width: 13px; height: 13px; }
  }

  &__title {
    flex: 1 1 auto;
    min-width: 0;
  }

  &__hint {
    flex: none;
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
    color: var(--gl-hint);
  }

  &__body {
    display: grid;
    gap: 9px;
    padding: 2px 12px 12px;
  }

  &.is-lesson-focus {
    margin: 4px 8px;
    border: 1.5px solid var(--live);
    border-radius: 5px;
    background: var(--paper-raised);
    box-shadow: 0 0 0 4px var(--live-tint);
  }
}
```

- [ ] **Step 6: Replace the whole of `src/shared/ui/collapsible-section/CollapsibleSection.tsx`** with:

```tsx
/**
 * Kept as the import path existing panels use; the implementation is the shared Panel.
 */
export { Panel as default } from '@/shared/ui/controls/Panel';
```

Delete `src/shared/ui/collapsible-section/collapsible-section.scss`.

- [ ] **Step 7: Create `src/shared/ui/controls/DataTable.tsx`:**

```tsx
import type { ComponentChildren } from 'preact';
import './table.scss';

export interface DataColumn<Row> {
  key: string;
  header: string;
  render: (row: Row, rowIndex: number) => ComponentChildren;
  numeric?: boolean;
  width?: string;
}

export interface DataTableProps<Row> {
  caption: string;
  columns: DataColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, rowIndex: number) => string;
  activeRowKey?: string | null;
  footer?: ComponentChildren;
  className?: string;
}

/** Plain, accessible data table. Editable cells hold a NumberField with hideTag and its own aria-label. */
export function DataTable<Row>({ caption, columns, rows, rowKey, activeRowKey, footer, className }: DataTableProps<Row>) {
  return (
    <div className={className ? `vtable ${className}` : 'vtable'}>
      <table className="vtable__table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.numeric ? 'is-num' : undefined} style={column.width ? { width: column.width } : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const keyValue = rowKey(row, rowIndex);
            return (
              <tr key={keyValue} className={keyValue === activeRowKey ? 'is-active' : undefined}>
                {columns.map((column) => (
                  <td key={column.key} className={column.numeric ? 'is-num' : undefined}>
                    {column.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer && <div className="vtable__footer">{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 8: Create `src/shared/ui/controls/table.scss`:**

```scss
.vtable {
  border: 1px solid var(--field-line);
  border-radius: var(--radius-m);
  overflow: hidden;
  background: var(--field-bg);

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  th {
    height: 24px;
    padding: 0 8px;
    background: var(--paper-sunken);
    color: var(--ink-faint);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-align: left;
    text-transform: uppercase;
  }

  td {
    height: 30px;
    padding: 0 6px;
    border-top: 1px solid var(--hairline);
    color: var(--ink);
  }

  .is-num { text-align: right; }

  tr.is-active td,
  tbody tr:focus-within td { background: var(--live-tint); }

  td .vnum { width: 100%; }
  td .vnum__box { min-height: 24px; border-color: transparent; background: transparent; }
  td .vnum:focus-within .vnum__box { border-color: var(--field-line); background: var(--field-bg); }

  &__footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-top: 1px solid var(--hairline);
  }
}
```

- [ ] **Step 9: Export the new pieces** from `src/shared/ui/controls/index.ts`:

```ts
export { Panel, type PanelProps } from './Panel';
export { PanelLayoutContext, type PanelLayout } from './panel-context';
export { DataTable, type DataTableProps, type DataColumn } from './DataTable';
```

- [ ] **Step 10: Update the panel's one scroll lookup.** `src/features/object-appearance/ui/ObjectAppearancePanel.tsx` (around line 79) looks up `.sidebar-content`. Change the selector to `'[data-scroll-root]'`. Task 8 adds that attribute to the section column's scroll container. Until then the lookup falls back exactly as it does today.

- [ ] **Step 11: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/controls.test.ts`
Expected: PASS (23 tests).

- [ ] **Step 12: Run every check, then look at the editor in a browser.** Run `npm run dev`, open `/app`, open and close a few panels in both themes, and confirm that they render with the new header and no console errors. Then stop the dev server you started.

- [ ] **Step 13: Commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/controls src/shared/ui/collapsible-section src/features/object-appearance/ui/ObjectAppearancePanel.tsx tests/black-box/controls.test.ts
git commit -m "feat(controls): add the shared panel with lesson focus and a data table"
```

`git add` on the `collapsible-section` folder stages the deleted scss file.

---

### Task 5: Dialog and MenuButton; move every dialog onto Dialog

**Files:**
- Create: `src/shared/ui/controls/focus-trap.ts`, `Dialog.tsx`, `dialog.scss`, `MenuButton.tsx`, `menu.scss`
- Modify:
  - `src/shared/ui/controls/index.ts`;
  - `src/shared/ui/confirm-dialog/ConfirmDialog.tsx` and `confirm-dialog.scss`;
  - `src/features/scene-library/ui/MyScenesDialog.tsx` and `my-scenes.scss`;
  - `src/features/onboarding/ui/WelcomeCard.tsx` and its scss;
  - `src/features/help/ui/HelpCenter.tsx` and `help-center.scss`.
- Test: `tests/black-box/editor-shell.test.ts` (new, BB-SHELL-01 to BB-SHELL-07)

**Interfaces:**
- Produces:
  - `focusableWithin(root: HTMLElement | null): HTMLElement[]`;
  - `trapTab(event: KeyboardEvent, root: HTMLElement | null): void`;
  - `Dialog(props: DialogProps)`;
  - `MenuButton(props: MenuButtonProps)`;
  - type `MenuEntry`.

```ts
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog */
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  initialFocusRef?: { current: HTMLElement | null };
  size?: 'sm' | 'md' | 'lg';      // 420 / 560 / 760 px max width
  className?: string;
  /** Runs before the built-in Escape/Tab handling; call preventDefault() to skip it. */
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ComponentChildren;
}

export type MenuEntry =
  | { kind: 'item'; id: string; label: string; icon?: ComponentChildren; description?: string; disabled?: boolean; onSelect: () => void }
  | { kind: 'radio'; id: string; label: string; icon?: ComponentChildren; description?: string; checked: boolean; onSelect: () => void }
  | { kind: 'checkbox'; id: string; label: string; icon?: ComponentChildren; checked: boolean; onSelect: () => void }
  | { kind: 'separator'; id: string }
  | { kind: 'group'; id: string; label: string };

export interface MenuButtonProps {
  /** Accessible name of the trigger and of the menu. */
  label: string;
  entries: MenuEntry[];
  /** Visible trigger content; omit with iconOnly. */
  children?: ComponentChildren;
  icon?: ComponentChildren;
  iconOnly?: boolean;
  variant?: ButtonVariant;      // default 'secondary'
  align?: 'start' | 'end';      // default 'start'
  title?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}
```

**Menu keyboard behaviour (APG menu button):**
- **On the trigger:** Enter, Space or ↓ opens the menu and focuses the checked radio item, or else the first item. ↑ opens it and focuses the last item. A click toggles the menu.
- **In the menu:**
  - ↓ and ↑ move, wrapping at the ends; Home and End jump.
  - Enter and Space activate. Activating closes the menu, returns focus to the trigger, then calls `onSelect`.
  - Esc closes and returns focus. Tab closes without trapping.
  - A printable key moves to the next item whose label starts with it.
  - A `mousedown` outside closes the menu.
- **Groups and separators.** A `group` entry starts an ARIA `role="group"`, labelled by its text, that holds the actionable entries following it, up to the next `group` or `separator`. A `separator` renders `role="separator"`.

- [ ] **Step 1: Write the failing tests.** Create `tests/black-box/editor-shell.test.ts`, with the same `settle`, `mount`, `unmount` and `key` helpers as Task 1:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-SHELL
 * The editor shell: dialogs, menus, the top bar and the section column.
 */
import { describe, it, expect, vi } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useState } from 'react';
import { Dialog, MenuButton, type MenuEntry } from '@/shared/ui/controls';
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog';
import { confirm, useConfirmStore } from '@/shared/ui/confirm-dialog/confirm-store';

// settle, mount, unmount, key: as in tests/black-box/controls.test.ts

function DialogHarness({ onClose }: { onClose: () => void }) {
  return h(Dialog, { open: true, onClose, labelledBy: 't' },
    h('h2', { id: 't' }, 'Title'),
    h('button', { id: 'first' }, 'First'),
    h('input', { id: 'middle' }),
    h('button', { id: 'last' }, 'Last'),
  );
}

describe('BB-SHELL-01: Dialog moves focus in, traps Tab, and labels itself', () => {
  it('focuses the first control and wraps Tab at both ends', async () => {
    const host = mount(h(DialogHarness, { onClose: vi.fn() }));
    await settle();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
    expect(document.activeElement?.id).toBe('first');
    (host.querySelector('#last') as HTMLElement).focus();
    const forward = key(document.activeElement!, 'Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('first');
    const back = key(document.activeElement!, 'Tab', { shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('last');
    unmount(host);
  });
});

describe('BB-SHELL-02: Esc and the scrim close the dialog; focus returns', () => {
  it('calls onClose for Esc and scrim mousedown and restores focus on unmount', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const host = mount(h(DialogHarness, { onClose }));
    await settle();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    key(document.activeElement!, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    host.querySelector('.vdialog-scrim')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount(host);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('BB-SHELL-03: ConfirmDialog is an alertdialog on the shared Dialog', () => {
  it('focuses confirm, Enter resolves true, Esc resolves false', async () => {
    const host = mount(h(ConfirmDialog, {}));
    let result = confirm({ title: 'Start a new workspace?', message: 'm', confirmLabel: 'New workspace' });
    await settle();
    const dialog = host.querySelector('[role="alertdialog"]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('New workspace');
    key(document.activeElement!, 'Enter');
    await expect(result).resolves.toBe(true);
    result = confirm({ title: 'Again?' });
    await settle();
    key(document.activeElement!, 'Escape');
    await expect(result).resolves.toBe(false);
    expect(useConfirmStore.getState().open).toBe(false);
    unmount(host);
  });
});

function entries(log: string[]): MenuEntry[] {
  return [
    { kind: 'group', id: 'g', label: 'Demos' },
    { kind: 'item', id: 'a', label: 'Apples', onSelect: () => log.push('a') },
    { kind: 'item', id: 'b', label: 'Bananas', onSelect: () => log.push('b') },
    { kind: 'separator', id: 's' },
    { kind: 'checkbox', id: 'c', label: 'Cherries', checked: true, onSelect: () => log.push('c') },
  ];
}

describe('BB-SHELL-04: MenuButton follows the APG menu button pattern', () => {
  it('opens on ArrowDown, wraps, jumps, typeaheads, and activates with Enter', async () => {
    const log: string[] = [];
    const host = mount(h(MenuButton, { label: 'Fruit', entries: entries(log) }, 'Fruit'));
    const trigger = host.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    key(trigger, 'ArrowDown');
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const menu = host.querySelector('[role="menu"]')!;
    expect(menu.getAttribute('aria-label')).toBe('Fruit');
    expect(menu.querySelector('[role="group"]')!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toContain('Apples');
    key(document.activeElement!, 'ArrowUp');
    await settle();
    expect(document.activeElement?.textContent).toContain('Cherries');
    expect(document.activeElement?.getAttribute('role')).toBe('menuitemcheckbox');
    expect(document.activeElement?.getAttribute('aria-checked')).toBe('true');
    key(document.activeElement!, 'Home');
    await settle();
    expect(document.activeElement?.textContent).toContain('Apples');
    key(document.activeElement!, 'b');
    await settle();
    expect(document.activeElement?.textContent).toContain('Bananas');
    key(document.activeElement!, 'Enter');
    await settle();
    expect(log).toEqual(['b']);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount(host);
  });
});

describe('BB-SHELL-05: Esc and outside clicks close the menu', () => {
  it('Esc returns focus to the trigger and does not reach window', async () => {
    const host = mount(h(MenuButton, { label: 'Fruit', entries: entries([]) }, 'Fruit'));
    const trigger = host.querySelector('button')!;
    trigger.click();
    await settle();
    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    key(document.activeElement!, 'Escape');
    await settle();
    expect(windowListener).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowListener);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await settle();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();
    expect(host.querySelector('[role="menu"]')).toBeNull();
    unmount(host);
  });
});

describe('BB-SHELL-06: Choosing an item that unmounts the menu does not throw', () => {
  it('survives the trigger disappearing during onSelect', async () => {
    let hide: () => void = () => {};
    function Host() {
      const [shown, setShown] = useState(true);
      hide = () => setShown(false);
      return shown
        ? h(MenuButton, { label: 'Lessons', entries: [{ kind: 'item', id: 'x', label: 'Start', onSelect: () => hide() }] }, 'Lessons')
        : h('p', {}, 'lesson running');
    }
    const host = mount(h(Host, {}));
    host.querySelector('button')!.click();
    await settle();
    expect(() => key(document.activeElement!, 'Enter')).not.toThrow();
    await settle();
    expect(host.textContent).toContain('lesson running');
    expect(document.activeElement).not.toBeNull();
    unmount(host);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: FAIL, because `Dialog` and `MenuButton` are not exported.

- [ ] **Step 3: Create `src/shared/ui/controls/focus-trap.ts`:**

```ts
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusableWithin(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/** Keeps Tab and Shift+Tab inside root. Call from a keydown handler for Tab. */
export function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  const items = focusableWithin(root);
  if (items.length === 0) {
    event.preventDefault();
    root?.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
```

- [ ] **Step 4: Create `src/shared/ui/controls/Dialog.tsx`:**

```tsx
import { useEffect, useRef } from 'react';
import type { ComponentChildren } from 'preact';
import { focusableWithin, trapTab } from './focus-trap';
import './dialog.scss';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  initialFocusRef?: { current: HTMLElement | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  children: ComponentChildren;
}

export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return <DialogSurface {...props} />;
}

function DialogSurface({
  onClose, labelledBy, describedBy, role = 'dialog', initialFocusRef, size = 'md', className, onKeyDown, children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = initialFocusRef?.current ?? focusableWithin(panelRef.current)[0] ?? panelRef.current;
    target?.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
  }, [initialFocusRef]);

  const handleKeyDown = (event: KeyboardEvent) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    } else if (event.key === 'Tab') {
      trapTab(event, panelRef.current);
    }
  };

  return (
    <div
      className="vdialog-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={['vdialog', `vdialog--${size}`, className ?? ''].filter(Boolean).join(' ')}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
```

> The Esc `keydown` is handled on the dialog element and calls `stopPropagation()`, so `window` listeners, such as the lesson's Esc, never see it. BB-SHELL-02 checks this.

- [ ] **Step 5: Create `src/shared/ui/controls/dialog.scss`:**

```scss
.vdialog-scrim {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(var(--shadow-rgb), 0.45);
}

.vdialog {
  width: 100%;
  max-height: calc(100dvh - 48px);
  overflow: auto;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 18px 50px rgba(var(--shadow-rgb), 0.28);

  &:focus { outline: none; }
  &--sm { max-width: 420px; }
  &--md { max-width: 560px; }
  &--lg { max-width: 760px; }
}
```

- [ ] **Step 6: Create `src/shared/ui/controls/MenuButton.tsx`:**

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { ChevronDown, Check } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import './menu.scss';

export type MenuEntry =
  | { kind: 'item'; id: string; label: string; icon?: ComponentChildren; description?: string; disabled?: boolean; onSelect: () => void }
  | { kind: 'radio'; id: string; label: string; icon?: ComponentChildren; description?: string; checked: boolean; onSelect: () => void }
  | { kind: 'checkbox'; id: string; label: string; icon?: ComponentChildren; checked: boolean; onSelect: () => void }
  | { kind: 'separator'; id: string }
  | { kind: 'group'; id: string; label: string };

type Actionable = Extract<MenuEntry, { kind: 'item' | 'radio' | 'checkbox' }>;

export interface MenuButtonProps {
  label: string;
  entries: MenuEntry[];
  children?: ComponentChildren;
  icon?: ComponentChildren;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  align?: 'start' | 'end';
  title?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
}

const isActionable = (entry: MenuEntry): entry is Actionable =>
  entry.kind === 'item' || entry.kind === 'radio' || entry.kind === 'checkbox';

export function MenuButton({
  label, entries, children, icon, iconOnly = false, variant = 'secondary', align = 'start',
  title, className, triggerClassName, menuClassName,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();
  const actionable = entries.filter(isActionable);

  const startIndex = (from: 'first' | 'last') => {
    if (from === 'last') return Math.max(0, actionable.length - 1);
    const checked = actionable.findIndex((entry) => entry.kind === 'radio' && entry.checked);
    return checked >= 0 ? checked : 0;
  };

  const openMenu = (from: 'first' | 'last') => {
    setActive(startIndex(from));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const activate = (entry: Actionable) => {
    if (entry.kind === 'item' && entry.disabled) return;
    close(true);
    entry.onSelect();
  };

  const onTriggerKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu('last');
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent) => {
    const count = actionable.length;
    if (count === 0) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => (index + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => (index - 1 + count) % count);
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(count - 1);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activate(actionable[active]);
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const letter = event.key.toLowerCase();
          for (let step = 1; step <= count; step++) {
            const index = (active + step) % count;
            if (actionable[index].label.toLowerCase().startsWith(letter)) {
              setActive(index);
              break;
            }
          }
        }
    }
  };

  // Split entries into labelled groups, separated by separators.
  const blocks: { key: string; groupLabel?: string; items: Actionable[]; separatorBefore: boolean }[] = [];
  let currentBlock: (typeof blocks)[number] | null = null;
  let pendingSeparator = false;
  for (const entry of entries) {
    if (entry.kind === 'separator') {
      currentBlock = null;
      pendingSeparator = blocks.length > 0;
    } else if (entry.kind === 'group') {
      currentBlock = { key: entry.id, groupLabel: entry.label, items: [], separatorBefore: pendingSeparator };
      blocks.push(currentBlock);
      pendingSeparator = false;
    } else {
      if (!currentBlock) {
        currentBlock = { key: `block-${entry.id}`, items: [], separatorBefore: pendingSeparator };
        blocks.push(currentBlock);
        pendingSeparator = false;
      }
      currentBlock.items.push(entry);
    }
  }

  const renderItem = (entry: Actionable) => {
    const index = actionable.indexOf(entry);
    const role = entry.kind === 'item' ? 'menuitem' : entry.kind === 'radio' ? 'menuitemradio' : 'menuitemcheckbox';
    const disabled = entry.kind === 'item' && entry.disabled;
    return (
      <div
        key={entry.id}
        ref={(el) => {
          itemRefs.current[index] = el;
        }}
        role={role}
        tabIndex={-1}
        aria-checked={entry.kind === 'item' ? undefined : entry.checked}
        aria-disabled={disabled ? 'true' : undefined}
        className={['vmenu__item', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}
        onClick={() => activate(entry)}
        onMouseEnter={() => setActive(index)}
      >
        {entry.icon && <span className="vmenu__icon" aria-hidden="true">{entry.icon}</span>}
        <span className="vmenu__text">
          <span className="vmenu__label">{entry.label}</span>
          {'description' in entry && entry.description && <span className="vmenu__desc">{entry.description}</span>}
        </span>
        {entry.kind !== 'item' && (
          <span className="vmenu__check" aria-hidden="true">{entry.checked && <Check size={14} />}</span>
        )}
      </div>
    );
  };

  return (
    <div ref={rootRef} className={className ? `vmenu ${className}` : 'vmenu'}>
      <Button
        ref={triggerRef}
        variant={variant}
        icon={icon}
        iconOnly={iconOnly}
        label={label}
        title={title}
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu('first'))}
        onKeyDown={onTriggerKeyDown}
      >
        {children}
        {!iconOnly && <ChevronDown size={12} aria-hidden="true" className="vmenu__chev" />}
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={['vmenu__list', `vmenu__list--${align}`, menuClassName ?? ''].filter(Boolean).join(' ')}
          onKeyDown={onMenuKeyDown}
        >
          {blocks.map((block) => {
            const groupId = `${menuId}-${block.key}`;
            return [
              block.separatorBefore ? <div key={`${block.key}-sep`} role="separator" className="vmenu__sep" /> : null,
              block.groupLabel ? (
                <div key={block.key} role="group" aria-labelledby={groupId}>
                  <div id={groupId} className="vmenu__group" role="presentation">{block.groupLabel}</div>
                  {block.items.map(renderItem)}
                </div>
              ) : (
                block.items.map(renderItem)
              ),
            ];
          })}
        </div>
      )}
    </div>
  );
}
```

> BB-SHELL-06 has `onSelect` unmount the menu. `activate` calls `close(true)` first, which focuses the trigger while it still exists, and only then runs `onSelect`. If the trigger unmounts afterwards, focus falls back to `document.body`, which is still a document element.

- [ ] **Step 7: Create `src/shared/ui/controls/menu.scss`:**

```scss
.vmenu {
  position: relative;
  display: inline-flex;

  &__chev { margin-left: 2px; color: var(--ink-faint); }

  &__list {
    position: absolute;
    top: calc(100% + 4px);
    z-index: 1040;
    min-width: 220px;
    max-width: 340px;
    max-height: min(70dvh, 560px);
    overflow: auto;
    padding: 5px;
    border: 1px solid var(--rule);
    border-radius: 5px;
    background: var(--paper-raised);
    box-shadow: 0 10px 28px rgba(var(--shadow-rgb), 0.22);

    &--start { left: 0; }
    &--end { right: 0; }
  }

  &__group {
    padding: 8px 9px 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  &__sep {
    height: 1px;
    margin: 5px 4px;
    background: var(--hairline);
  }

  &__item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    min-height: 32px;
    padding: 6px 9px;
    border-radius: 4px;
    color: var(--ink);
    font-size: 13px;
    cursor: pointer;

    &:focus { outline: none; background: var(--live-tint); box-shadow: inset 2px 0 var(--live); }
    &.is-disabled { opacity: 0.45; cursor: not-allowed; }
  }

  &__icon {
    display: inline-flex;
    color: var(--ink-muted);
    svg { width: 16px; height: 16px; }
  }

  &__text { display: grid; gap: 1px; min-width: 0; }
  &__label { font-weight: 600; }
  &__desc { font-size: 11.5px; color: var(--ink-muted); }
  &__check { display: inline-flex; width: 14px; color: var(--accent-text); }
}
```

- [ ] **Step 8: Export the new pieces** from `src/shared/ui/controls/index.ts`:

```ts
export { Dialog, type DialogProps } from './Dialog';
export { MenuButton, type MenuButtonProps, type MenuEntry } from './MenuButton';
export { focusableWithin, trapTab } from './focus-trap';
```

- [ ] **Step 9: Move `ConfirmDialog` onto `Dialog`.** Replace `ConfirmDialogInner` in `src/shared/ui/confirm-dialog/ConfirmDialog.tsx` with:

```tsx
function ConfirmDialogInner() {
  const options = useConfirmStore((s) => s.options);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const tone = options?.tone ?? 'default';

  return (
    <Dialog
      open
      role="alertdialog"
      size="sm"
      labelledBy="confirm-title"
      describedBy={options?.message ? 'confirm-message' : undefined}
      initialFocusRef={confirmRef}
      onClose={handleCancel}
      className="confirm-dialog"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleConfirm();
        }
      }}
    >
      <div className="confirm-header">
        {tone === 'danger' && <AlertTriangle size={18} className="confirm-icon" aria-hidden />}
        <h2 id="confirm-title">{options?.title}</h2>
      </div>
      {options?.message && <p id="confirm-message" className="confirm-message">{options.message}</p>}
      <div className="confirm-actions">
        <Button onClick={handleCancel}>{options?.cancelLabel ?? 'Cancel'}</Button>
        <Button ref={confirmRef} variant={tone === 'danger' ? 'danger' : 'primary'} onClick={handleConfirm}>
          {options?.confirmLabel ?? 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );
}
```

Make these related changes:
- Import `Dialog` and `Button` from `@/shared/ui/controls`.
- Drop the unused `useEffect` import.
- In `confirm-dialog.scss`, delete the `.confirm-overlay` rules and the `.confirm-dialog` rules that set positioning, width, background, border, radius or shadow. `.vdialog` provides those now.
- Keep the inner layout: header, message and actions, with 16–20 px padding on `.confirm-dialog`.
- Delete `.confirm-btn` rules; `Button` styles the buttons.

- [ ] **Step 10: Move `MyScenesDialog` onto `Dialog`.** In `src/features/scene-library/ui/MyScenesDialog.tsx`:
- Replace the outer `<div className="my-scenes-overlay" …><div className="my-scenes" role="dialog" …>` with:

  ```tsx
  <Dialog open onClose={close} labelledBy="my-scenes-title" size="md" className="my-scenes" onKeyDown={onKeyDown}>
  ```

- In the existing `onKeyDown` handler, delete the `Escape` branch; `Dialog` handles Esc. Keep any other keys it handles.
- Keep every inner element, class name (`my-scenes__*`), `data-list` attribute and label unchanged. BB-LIB tests query them.
- Keep the component's existing initial-focus behaviour: pass the ref it focuses today as `initialFocusRef`.
- In `my-scenes.scss`, delete the `.my-scenes-overlay` block and the `.my-scenes` positioning, background, border, shadow and z-index. Keep the padding and the inner styles.
- Restyle `.my-scenes__btn`, `--primary` and `--danger` to use the tokens from Task 1 (`--field-line`, `--accent`, `--danger`, `--control-h`), so they match `Button`.

- [ ] **Step 11: Move `WelcomeCard` and `HelpCenter` onto `Dialog`.**

  **`WelcomeCard`** (`src/features/onboarding/ui/WelcomeCard.tsx`):
  - Replace the overlay div and the `role="dialog"` div with `<Dialog open onClose={dismiss} labelledBy={<the existing title id>} size="md" className="welcome-card" initialFocusRef={closeRef}>`.
  - Remove its own Escape `onKeyDown`, since `Dialog` handles Esc.
  - The overlay used `onMouseDown={dismiss}`; the scrim now does the same.

  **`HelpCenter`** (`src/features/help/ui/HelpCenter.tsx`):
  - Replace `<div className="help-overlay" …><div className="help-dialog" role="dialog" …>` with `<Dialog open={isHelpOpen} onClose={closeHelp} labelledBy={<the existing title id>} size="lg" className="help-dialog" onKeyDown={handleKeyDown}>`.
  - In `handleKeyDown`, delete the Escape branch and keep everything else. The search box's own Escape handler (clear the query) keeps calling `stopPropagation` while a query is set, so the first Esc clears the search and the second closes Help.
  - If `HelpCenter` currently returns `null` when closed, keep that early return and pass `open` as `true`.

  **SCSS for both:** delete the overlay blocks and the container positioning, background, border, radius and shadow. Keep sizes inside the panel: Help keeps its two-column body, at max width 760 px.

  **Wording:** don't change any text in this task. Task 8 updates the welcome card's wording.

- [ ] **Step 12: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/scene-library.test.ts tests/white-box/confirm-dialog.test.ts`
Expected: PASS. The BB-LIB and confirm-dialog white-box tests are unchanged and still pass.

- [ ] **Step 13: Check in a browser.** Run `npm run dev` and open `/app`, using a fresh profile or after clearing site data so the welcome card shows. Check:
- the welcome card, Help (press `?`), My scenes, and New workspace with a shape on the canvas (the confirm);
- in each, Tab wraps inside, Esc closes, and focus returns to the opener;
- both themes.

Stop the dev server you started.

- [ ] **Step 14: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/ui/controls src/shared/ui/confirm-dialog src/features/scene-library/ui src/features/onboarding/ui src/features/help/ui tests/black-box/editor-shell.test.ts
git commit -m "feat(controls): add dialog and menu primitives and trap focus in every dialog"
```

---
### Task 6: Top bar with File, Lessons and Settings menus; Undo and Redo fixed; texture-only scenes count as work

**Files:**
- Create:
  - `src/entities/project/model/scene-empty.ts`;
  - `src/features/workspace-reset/model/useNewWorkspace.ts`;
  - `src/features/project-io/model/useProjectFile.ts`;
  - `src/widgets/layout/top-bar/FileMenu.tsx`.
- Modify:
  - `src/features/scene-library/model/scene-ops.ts`: `isSceneEmpty` becomes a re-export.
  - `src/features/scene-library/index.ts`: drop `MyScenesButton`.
  - `src/features/workspace-reset/ui/NewWorkspaceButton.tsx`
  - `src/features/history-controls/ui/HistoryControls.tsx`
  - `src/features/lesson-engine/ui/LessonLauncher.tsx`, and delete `lesson-launcher.scss`.
  - `src/features/editor-preferences/ui/EditorPreferencesMenu.tsx`
  - `src/features/help/ui/HelpButton.tsx`
  - `src/widgets/layout/top-bar/TopBar.tsx` and `top-bar.scss`.
- Delete: `src/features/project-io/ui/ProjectActions.tsx`, `src/features/scene-library/ui/MyScenesButton.tsx`
- Test: `tests/black-box/editor-shell.test.ts` (append BB-SHELL-07 to BB-SHELL-13)

**Interfaces:**
- Consumes:
  - `Button`, `MenuButton` and `MenuEntry` from `@/shared/ui/controls`;
  - `confirm` from `@/shared/ui/confirm-dialog/confirm-store`;
  - `replaceScene`, `backupCurrentScene`, `backupLabel` and `useMyScenesDialog` from `@/features/scene-library`.
- Produces:
  - `isSceneEmpty(state: SceneFields): boolean` in `@/entities/project/model/scene-empty`, re-exported from `@/features/scene-library` as before;
  - `useNewWorkspace(beforeReset: () => Promise<unknown>): () => Promise<void>`;
  - `useProjectFile(loadProject: (data: VamsProjectData, fileName: string) => Promise<number>): ProjectFileActions`;
  - `FileMenu` (default export).

```ts
export interface ProjectFileActions {
  /** Asks first when the scene has work in it, then opens the file picker. */
  requestOpen: () => Promise<void>;
  /** Downloads the scene as a project file. */
  save: () => void;
  /** Downloads the generated C++ program. */
  exportCpp: () => void;
  /** Spread onto a hidden <input>; FileMenu renders it. */
  inputProps: {
    ref: { current: HTMLInputElement | null };
    type: 'file';
    accept: string;
    hidden: true;
    tabIndex: -1;
    'aria-hidden': 'true';
    onChange: (event: Event) => void;
  };
}
```

**Rulings for this task, to record in the ledger:**
1. **New workspace also clears `uploadedTextures`.** A texture-only scene now counts as work (spec §6.6). Without this, it would ask again after every reset. The backup taken first keeps the textures.
2. **The File menu in Lesson mode** shows only Save project file, Export C++ code and Export scene JSON. New workspace, My scenes and Open project file replace the scene, so they're hidden during a lesson, as the old My scenes button was.
3. **The File Open confirm** moves from `window.confirm` to the shared `confirm()`, with title "Open a project file?", message "Your current scene will be kept in My scenes as a backup.", confirm label "Open file" and cancel label "Cancel".

- [ ] **Step 1: Append the failing tests** to `tests/black-box/editor-shell.test.ts`. Add these imports:

```ts
import { useVamsStore } from '@/core/store';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import NewWorkspaceButton from '@/features/workspace-reset/ui/NewWorkspaceButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import FileMenu from '@/widgets/layout/top-bar/FileMenu';
import { useMyScenesDialog } from '@/features/scene-library';
import { addTriangle } from '../helpers/store';
```

```ts
const TEXTURE = { id: 'tex-1', name: 'Bricks', isSample: false, dataUrl: 'data:image/png;base64,', width: 4, height: 4 };

function menuItems(host: HTMLElement) {
  return [...host.querySelectorAll('[role^="menuitem"]')].map((el) => el.querySelector('.vmenu__label')!.textContent);
}
async function openMenu(host: HTMLElement, name: string) {
  const trigger = [...host.querySelectorAll('button[aria-haspopup="menu"]')].find(
    (b) => b.textContent?.includes(name) || b.getAttribute('aria-label') === name,
  ) as HTMLButtonElement;
  trigger.click();
  await settle();
  return trigger;
}
function chooseItem(host: HTMLElement, label: string) {
  const item = [...host.querySelectorAll('[role^="menuitem"]')].find(
    (el) => el.querySelector('.vmenu__label')!.textContent === label,
  ) as HTMLElement;
  item.click();
}

describe('BB-SHELL-07: Undo and Redo enable as soon as there is history', () => {
  it('re-renders when past and future change', async () => {
    const host = mount(h(HistoryControls, {}));
    const [undo, redo] = host.querySelectorAll('button');
    expect(undo.getAttribute('aria-label')).toBe('Undo');
    expect(undo.disabled).toBe(true);
    useVamsStore.getState().pushToHistory();
    addTriangle();
    await settle();
    expect(undo.disabled).toBe(false);
    undo.click();
    await settle();
    expect(redo.disabled).toBe(false);
    unmount(host);
  });
});

describe('BB-SHELL-08: A scene with only uploaded textures counts as work', () => {
  it('isSceneEmpty sees textures; New workspace asks first and clears them', async () => {
    const base = useVamsStore.getState();
    expect(isSceneEmpty(base)).toBe(true);
    useVamsStore.setState({ uploadedTextures: [TEXTURE] });
    expect(isSceneEmpty(useVamsStore.getState())).toBe(false);
    const beforeReset = vi.fn().mockResolvedValue(null);
    const host = mount(h(NewWorkspaceButton, { beforeReset }));
    host.querySelector('button')!.click();
    await settle();
    expect(useConfirmStore.getState().open).toBe(true);
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(beforeReset).toHaveBeenCalledTimes(1);
    expect(useVamsStore.getState().uploadedTextures).toEqual([]);
    unmount(host);
  });
});

describe('BB-SHELL-09: The File menu lists the project actions in order', () => {
  it('shows every action in Author mode and opens My scenes', async () => {
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    expect(menuItems(host)).toEqual([
      'New workspace', 'My scenes…', 'Open project file…', 'Save project file', 'Export C++ code', 'Export scene JSON',
    ]);
    expect(host.querySelectorAll('[role="separator"]')).toHaveLength(2);
    chooseItem(host, 'My scenes…');
    await settle();
    expect(useMyScenesDialog.getState().isOpen).toBe(true);
    useMyScenesDialog.getState().close();
    unmount(host);
  });
});

describe('BB-SHELL-10: In Lesson mode the File menu only saves and exports', () => {
  it('hides the actions that replace the scene', async () => {
    useVamsStore.setState({ appMode: 'Lesson' });
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    expect(menuItems(host)).toEqual(['Save project file', 'Export C++ code', 'Export scene JSON']);
    unmount(host);
    useVamsStore.setState({ appMode: 'Author' });
  });
});

describe('BB-SHELL-11: Opening a project file asks first when the scene has work', () => {
  it('uses the shared confirm and does not open the picker on Cancel', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    addTriangle();
    const host = mount(h(FileMenu, {}));
    await openMenu(host, 'File');
    chooseItem(host, 'Open project file…');
    await settle();
    expect(useConfirmStore.getState().options?.title).toBe('Open a project file?');
    useConfirmStore.getState().handleCancel();
    await settle();
    expect(click).not.toHaveBeenCalled();
    await openMenu(host, 'File');
    chooseItem(host, 'Open project file…');
    await settle();
    useConfirmStore.getState().handleConfirm();
    await settle();
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    unmount(host);
  });
});

describe('BB-SHELL-12: The settings menu toggles view options and opens shortcuts', () => {
  it('menuitemcheckbox entries reflect and toggle state', async () => {
    const host = mount(h(EditorPreferencesMenu, {}));
    await openMenu(host, 'View settings');
    const grid = [...host.querySelectorAll('[role="menuitemcheckbox"]')].find((el) => el.textContent?.includes('Gridlines'))!;
    const before = useVamsStore.getState().axisVisibility.showGridlines;
    expect(grid.getAttribute('aria-checked')).toBe(String(before));
    (grid as HTMLElement).click();
    await settle();
    expect(useVamsStore.getState().axisVisibility.showGridlines).toBe(!before);
    await openMenu(host, 'View settings');
    chooseItem(host, 'Keyboard shortcuts');
    await settle();
    expect(useVamsStore.getState().activeHelpTopicId).toBe('shortcuts');
    useVamsStore.getState().closeHelp();
    unmount(host);
  });
});

describe('BB-SHELL-13: The Lessons menu lists the section’s demos and exercises', () => {
  it('groups lessons and starts the chosen one', async () => {
    useVamsStore.setState({ activeSection: 'Transforms', appMode: 'Author' });
    const host = mount(h(LessonLauncher, {}));
    await openMenu(host, 'Lessons');
    const groups = [...host.querySelectorAll('.vmenu__group')].map((g) => g.textContent);
    expect(groups).toEqual(['Demos', 'Exercises']);
    chooseItem(host, 'Translate to Position');
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Lesson');
    expect(useVamsStore.getState().activeLessonId).toBe('transforms-exercise-1');
    useVamsStore.getState().clearLessonState();
    useVamsStore.setState({ appMode: 'Author' });
    unmount(host);
  });
});
```

> If the store has no `closeHelp` action, use the help slice's close action; `grep -n "closeHelp\|close" src/core/store/help-slice.ts` shows it. The BB-SHELL-13 title contains `’` (U+2019); keep it byte-exact.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: FAIL on the missing modules (`scene-empty`, `FileMenu`).

- [ ] **Step 3: Move `isSceneEmpty`.** Create `src/entities/project/model/scene-empty.ts`:

```ts
import type { VamsState } from '@/core/store/types';

export type SceneFields = Pick<
  VamsState,
  'objects' | 'uploadedTextures' | 'canvasBackgroundColor' | 'pendingShapeType' | 'callbacks' | 'viewportLimits'
>;

/** True when there is nothing on the canvas worth keeping. Uploaded textures count as work. */
export function isSceneEmpty(state: SceneFields): boolean {
  const { minX, maxX, minY, maxY } = state.viewportLimits;
  return (
    state.objects.length === 0 &&
    state.uploadedTextures.length === 0 &&
    state.canvasBackgroundColor === '#000000' &&
    state.pendingShapeType === null &&
    Object.values(state.callbacks).every((body) => body.trim() === '') &&
    minX === -1 &&
    maxX === 1 &&
    minY === -1 &&
    maxY === 1
  );
}
```

In `src/features/scene-library/model/scene-ops.ts`:
- delete the local `isSceneEmpty` function and its doc comment;
- add `export { isSceneEmpty } from '@/entities/project/model/scene-empty';`;
- keep `SceneFields` if other functions in the file still use it, or else import it from the new module.

- [ ] **Step 4: Create `src/features/workspace-reset/model/useNewWorkspace.ts`:**

```ts
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';

/**
 * Returns the New workspace action. `beforeReset` keeps the current scene in
 * My scenes; a rejection cancels the reset.
 */
export function useNewWorkspace(beforeReset: () => Promise<unknown>): () => Promise<void> {
  return useCallback(async () => {
    if (isSceneEmpty(useVamsStore.getState())) return;
    const proceed = await confirm({
      title: 'Start a new workspace?',
      message: 'Your current scene will be kept in My scenes as a backup.',
      confirmLabel: 'New workspace',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!proceed) return;
    try {
      await beforeReset();
    } catch (error) {
      console.error(error);
      toast.error("Couldn't keep a backup of the current scene, so the workspace was not cleared.");
      return;
    }
    useVamsStore.setState({
      objects: [],
      selectedObjectId: null,
      pendingShapeType: null,
      pendingVertices: [],
      interactionMode: 'SELECT',
      selectedVertexId: null,
      callbacks: { keyboard: '', mouse: '', reshape: '', motion: '', idle: '' },
      viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      uploadedTextures: [],
    });
    const state = useVamsStore.getState();
    state.setCanvasBackgroundColor('#000000');
    state.clearHistory();
    toast.success('New workspace created');
  }, [beforeReset]);
}
```

Replace the body of `src/features/workspace-reset/ui/NewWorkspaceButton.tsx` with:

```tsx
import { FilePlus } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useNewWorkspace } from '../model/useNewWorkspace';

interface NewWorkspaceButtonProps {
  /** Keeps the current scene in My scenes. A rejection cancels the reset. */
  beforeReset: () => Promise<unknown>;
}

export default function NewWorkspaceButton({ beforeReset }: NewWorkspaceButtonProps) {
  const newWorkspace = useNewWorkspace(beforeReset);
  return (
    <Button variant="quiet" iconOnly label="New workspace" icon={<FilePlus />} onClick={() => void newWorkspace()} />
  );
}
```

> BB-LIB-15 still clicks the first button and expects the same confirm message. It stays green.

- [ ] **Step 5: Create `src/features/project-io/model/useProjectFile.ts`.** Move the logic from `ProjectActions.tsx` into the hook, unchanged, except:
  - `requestOpen()` uses `isSceneEmpty` and the shared `confirm`, per ruling 3;
  - the export-menu state is gone.

```ts
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import {
  buildProjectFile,
  createDefaultProjectFilename,
  downloadJSON,
  parseProjectFromFile,
  type VamsProjectData,
} from '@/entities/project/model/project-io';
import { isSceneEmpty } from '@/entities/project/model/scene-empty';
import { generateCodeFromState } from '@/features/code-generation/model/generate-from-state';
import { confirm } from '@/shared/ui/confirm-dialog/confirm-store';

export interface ProjectFileActions {
  requestOpen: () => Promise<void>;
  save: () => void;
  exportCpp: () => void;
  inputProps: {
    ref: { current: HTMLInputElement | null };
    type: 'file';
    accept: string;
    hidden: true;
    tabIndex: -1;
    'aria-hidden': 'true';
    onChange: (event: Event) => void;
  };
}

export function useProjectFile(
  loadProject: (data: VamsProjectData, fileName: string) => Promise<number>,
): ProjectFileActions {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const save = useCallback(() => {
    try {
      downloadJSON(createDefaultProjectFilename(), buildProjectFile(useVamsStore.getState()));
      toast.success('Project saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save project');
    }
  }, []);

  const exportCpp = useCallback(() => {
    const state = useVamsStore.getState();
    try {
      let width = 800;
      let height = 600;
      const el = document.querySelector('.canvas-wrapper');
      if (el) {
        width = Math.floor(el.clientWidth);
        height = Math.floor(el.clientHeight);
      }
      const code = generateCodeFromState(
        {
          objects: state.objects,
          canvasBackgroundColor: state.canvasBackgroundColor,
          callbacks: state.callbacks,
          viewportLimits: state.viewportLimits,
          textures: state.getAllTextures(),
        },
        { width, height },
      );
      const filename = createDefaultProjectFilename('vams-code').replace('.vams', '.cpp');
      const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('C++ code exported successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to export C++ code');
    }
  }, []);

  const requestOpen = useCallback(async () => {
    if (!isSceneEmpty(useVamsStore.getState())) {
      const proceed = await confirm({
        title: 'Open a project file?',
        message: 'Your current scene will be kept in My scenes as a backup.',
        confirmLabel: 'Open file',
        cancelLabel: 'Cancel',
      });
      if (!proceed) return;
    }
    fileInputRef.current?.click();
  }, []);

  const onChange = useCallback(
    async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      // Copy the rest of handleProjectFileSelected from ProjectActions.tsx unchanged:
      // parseProjectFromFile → loadProject → the same toasts and error messages.
    },
    [loadProject],
  );

  return {
    requestOpen,
    save,
    exportCpp,
    inputProps: {
      ref: fileInputRef,
      type: 'file',
      accept: '.json,.vams,.vams.json,application/json',
      hidden: true,
      tabIndex: -1,
      'aria-hidden': 'true',
      onChange: (event: Event) => void onChange(event),
    },
  };
}
```

> Replace the comment inside `onChange` with the body of `handleProjectFileSelected` from `ProjectActions.tsx` (lines 109–130), word for word: the `parseProjectFromFile` try/catch with its toast, then the `loadProject` try/catch with its detached-texture message, success toast and error toast. Then delete `src/features/project-io/ui/ProjectActions.tsx`.

- [ ] **Step 6: Create `src/widgets/layout/top-bar/FileMenu.tsx`:**

```tsx
import { Code, FileJson, FilePlus, FolderOpen, Library, Save } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import type { VamsProjectData } from '@/entities/project/model/project-io';
import { backupCurrentScene, backupLabel, replaceScene, useMyScenesDialog } from '@/features/scene-library';
import { useNewWorkspace } from '@/features/workspace-reset/model/useNewWorkspace';
import { useProjectFile } from '@/features/project-io/model/useProjectFile';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';

function loadProject(data: VamsProjectData, fileName: string): Promise<number> {
  return replaceScene(data, { reason: 'open-file', label: backupLabel(fileName) }).then((result) => result.detached);
}

function backupBeforeReset(): Promise<unknown> {
  return backupCurrentScene('new-workspace', 'Before New workspace');
}

export default function FileMenu() {
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const openMyScenes = useMyScenesDialog((s) => s.open);
  const newWorkspace = useNewWorkspace(backupBeforeReset);
  const file = useProjectFile(loadProject);

  const saveAndExport: MenuEntry[] = [
    { kind: 'item', id: 'save', label: 'Save project file', icon: <Save />, onSelect: file.save },
    { kind: 'separator', id: 'sep-export' },
    { kind: 'item', id: 'cpp', label: 'Export C++ code', icon: <Code />, onSelect: file.exportCpp },
    { kind: 'item', id: 'json', label: 'Export scene JSON', icon: <FileJson />, onSelect: file.save },
  ];
  const entries: MenuEntry[] = inLesson
    ? saveAndExport
    : [
        { kind: 'item', id: 'new', label: 'New workspace', icon: <FilePlus />, onSelect: () => void newWorkspace() },
        { kind: 'item', id: 'scenes', label: 'My scenes…', icon: <Library />, onSelect: openMyScenes },
        { kind: 'separator', id: 'sep-file' },
        { kind: 'item', id: 'open', label: 'Open project file…', icon: <FolderOpen />, onSelect: () => void file.requestOpen() },
        ...saveAndExport,
      ];

  return (
    <>
      <input {...file.inputProps} />
      <MenuButton label="File" entries={entries} align="end">File</MenuButton>
    </>
  );
}
```

> Check the separator count against the tests. In Author mode BB-SHELL-09 expects 2 separators: one after My scenes and one before Export C++. In Lesson mode the list is Save, a separator, Export C++, Export JSON; BB-SHELL-10 checks labels only. The `…` in "My scenes…" and "Open project file…" is U+2026; keep it byte-exact. `useMyScenesDialog((s) => s.open)` must be the store's opener; check `src/features/scene-library/model/dialog-store.ts` for the action name and use it.

- [ ] **Step 7: Fix `HistoryControls`.** Replace the body of `src/features/history-controls/ui/HistoryControls.tsx` with:

```tsx
import { Undo, Redo } from 'lucide-react';
import { toast } from 'sonner';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';

export default function HistoryControls() {
  const undo = useVamsStore((state) => state.undo);
  const redo = useVamsStore((state) => state.redo);
  // Subscribe to values, not to the canUndo/canRedo functions, so the buttons re-render.
  const canUndo = useVamsStore((state) => state.past.length > 0);
  const canRedo = useVamsStore((state) => state.future.length > 0);

  // Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) are handled centrally in
  // useKeyboardShortcuts; these buttons are the pointer entry points.
  return (
    <>
      <Button
        variant="quiet"
        iconOnly
        label="Undo"
        title="Undo (Ctrl+Z)"
        icon={<Undo />}
        disabled={!canUndo}
        onClick={() => {
          undo();
          toast.info('Undo');
        }}
      />
      <Button
        variant="quiet"
        iconOnly
        label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        icon={<Redo />}
        disabled={!canRedo}
        onClick={() => {
          redo();
          toast.info('Redo');
        }}
      />
    </>
  );
}
```

- [ ] **Step 8: Move `LessonLauncher` onto `MenuButton`.** Replace the body of `src/features/lesson-engine/ui/LessonLauncher.tsx` and delete `lesson-launcher.scss`:

```tsx
import { GraduationCap, PlayCircle } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { MenuButton, type MenuEntry } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '../model/lesson-registry';

export default function LessonLauncher() {
  const activeSection = useVamsStore((s) => s.activeSection);
  const appMode = useVamsStore((s) => s.appMode);
  const setActiveLesson = useVamsStore((s) => s.setActiveLesson);
  const setAppMode = useVamsStore((s) => s.setAppMode);

  if (appMode === 'Lesson') return null;

  const sectionLessons = Object.values(LESSON_REGISTRY).filter((l) => l.section === activeSection);
  const launch = (id: string) => {
    setActiveLesson(id);
    setAppMode('Lesson');
  };
  const group = (type: 'demo' | 'exercise', label: string): MenuEntry[] => {
    const lessons = sectionLessons.filter((l) => l.type === type);
    const items: MenuEntry[] = lessons.length
      ? lessons.map((l) => ({
          kind: 'item' as const,
          id: l.id,
          label: l.title,
          description: `${l.steps.length} steps`,
          icon: type === 'demo' ? <PlayCircle /> : <GraduationCap />,
          onSelect: () => launch(l.id),
        }))
      : [{ kind: 'item' as const, id: `${type}-none`, label: `No ${label.toLowerCase()} in this section`, disabled: true, onSelect: () => {} }];
    return [{ kind: 'group', id: `group-${type}`, label }, ...items];
  };

  return (
    <MenuButton
      label="Lessons"
      title="Browse lessons for this section"
      icon={<GraduationCap />}
      entries={[...group('demo', 'Demos'), ...group('exercise', 'Exercises')]}
      align="end"
    >
      Lessons
    </MenuButton>
  );
}
```

- [ ] **Step 9: Move `EditorPreferencesMenu` onto `MenuButton`.** Replace its body:

```tsx
import { Keyboard, Settings } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { MenuButton } from '@/shared/ui/controls';

export default function EditorPreferencesMenu() {
  const axisVisibility = useVamsStore((state) => state.axisVisibility);
  const setAxisVisibility = useVamsStore((state) => state.setAxisVisibility);
  const showCoordinateTracker = useVamsStore((state) => state.showCoordinateTracker);
  const setShowCoordinateTracker = useVamsStore((state) => state.setShowCoordinateTracker);
  const openHelp = useVamsStore((state) => state.openHelp);

  return (
    <MenuButton
      label="View settings"
      iconOnly
      variant="quiet"
      icon={<Settings />}
      align="end"
      entries={[
        { kind: 'group', id: 'view', label: 'View' },
        {
          kind: 'checkbox', id: 'axes', label: 'Coordinate axes', checked: axisVisibility.showOriginMarker,
          onSelect: () => setAxisVisibility({ ...axisVisibility, showOriginMarker: !axisVisibility.showOriginMarker }),
        },
        {
          kind: 'checkbox', id: 'grid', label: 'Gridlines', checked: axisVisibility.showGridlines,
          onSelect: () => setAxisVisibility({ ...axisVisibility, showGridlines: !axisVisibility.showGridlines }),
        },
        {
          kind: 'checkbox', id: 'tracker', label: 'Coordinate tracker', checked: showCoordinateTracker,
          onSelect: () => setShowCoordinateTracker(!showCoordinateTracker),
        },
        { kind: 'separator', id: 'sep' },
        { kind: 'item', id: 'shortcuts', label: 'Keyboard shortcuts', icon: <Keyboard />, onSelect: () => openHelp('shortcuts') },
      ]}
    />
  );
}
```

- [ ] **Step 10: Move `HelpButton` onto `Button`.** In `src/features/help/ui/HelpButton.tsx`, replace the returned `<button …>` with the following, and keep the hotkey effect:

```tsx
<Button
  variant="quiet"
  iconOnly
  label="Open Help Center"
  title="Help (?)"
  icon={<HelpCircle />}
  aria-haspopup="dialog"
  onClick={handleClick}
/>
```

- [ ] **Step 11: Rewrite `src/widgets/layout/top-bar/TopBar.tsx`:**

```tsx
import { Toaster } from 'sonner';
import Logo from '@/shared/ui/logo';
import { useSiteTheme } from '@/shared/lib/theme';
import HistoryControls from '@/features/history-controls/ui/HistoryControls';
import ThemeToggleButton from '@/features/theme-toggle/ui/ThemeToggleButton';
import EditorPreferencesMenu from '@/features/editor-preferences/ui/EditorPreferencesMenu';
import LessonLauncher from '@/features/lesson-engine/ui/LessonLauncher';
import HelpButton from '@/features/help/ui/HelpButton';
import FileMenu from './FileMenu';
import './top-bar.scss';

export default function TopBar() {
  const theme = useSiteTheme();
  return (
    <header className="top-bar">
      <Toaster position="bottom-center" theme={theme === 'blueprint' ? 'dark' : 'light'} />
      <a className="top-bar__home" href="/" aria-label="VAMS home">
        <Logo variant="full" title="VAMS" />
      </a>
      <div className="top-bar__actions">
        <LessonLauncher />
        <FileMenu />
        <span className="top-bar__sep" aria-hidden="true" />
        <HistoryControls />
        <ThemeToggleButton className="vbtn vbtn--quiet vbtn--md vbtn--icon" />
        <EditorPreferencesMenu />
        <HelpButton />
      </div>
    </header>
  );
}
```

Replace `src/widgets/layout/top-bar/top-bar.scss` with the following. Before deleting the old rules, `grep -rn "icon-btn\|dropdown-menu\|dropdown-container\|menu-item" src --include=*.tsx`. If any component other than the ones rewritten in this task still uses those classes, move just the rules it needs into that component's own scss.

```scss
@use '../../../shared/styles/tokens' as *;

.top-bar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 10px 0 14px;
  border-bottom: 1px solid var(--rule);
  background: var(--paper);

  &__home {
    display: inline-flex;
    align-items: center;
    color: var(--ink);
    text-decoration: none;
    border-radius: var(--radius-m);

    svg { height: 26px; width: auto; }
    &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
  }

  &__sep {
    width: 1px;
    height: 20px;
    margin: 0 6px;
    background: var(--rule);
  }

  .vbtn__icon svg { width: 17px; height: 17px; }
}
```

> `ThemeToggleButton` receives Button classes through `className`. Its existing `title`, `aria-label` and `type` already meet the control rules. It renders the lucide icon directly; wrap the icon in `<span className="vbtn__icon" aria-hidden="true">` inside `ThemeToggleButton` only if it doesn't size correctly. Check how it looks in Step 13.

- [ ] **Step 12: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/editor-shell.test.ts tests/black-box/scene-library.test.ts`
Expected: PASS.

- [ ] **Step 13: Check in a browser.** Run `npm run dev`, open `/app`, and check the following in both themes, then stop the dev server you started:
- The top bar shows the logo, then Lessons ▾ and File ▾, Undo, Redo, Theme, Settings and Help.
- Every menu opens with the keyboard (Tab to the trigger, then ↓).
- Undo enables after you add a shape.
- File → Open project file asks first when the scene has a shape.
- The toasts appear bottom-centre.

- [ ] **Step 14: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/entities/project/model/scene-empty.ts src/features/scene-library src/features/workspace-reset src/features/project-io src/features/history-controls src/features/lesson-engine/ui/LessonLauncher.tsx src/features/lesson-engine/ui/lesson-launcher.scss src/features/editor-preferences src/features/help/ui/HelpButton.tsx src/widgets/layout/top-bar tests/black-box/editor-shell.test.ts
git commit -m "feat(editor): rebuild the top bar with File, Lessons and Settings menus"
```

---

### Task 7: Extract the lesson runner; build the lesson card

**Files:**
- Create: `src/features/lesson-engine/model/useLessonRunner.ts`, `src/features/lesson-engine/ui/LessonCard.tsx`, `lesson-card.scss`
- Modify:
  - `src/features/lesson-engine/ui/LessonBar.tsx`, which now uses the hook; Task 8 deletes it.
  - `src/features/lesson-engine/ui/exercise-widgets/MultipleChoiceWidget.tsx`, `OrderListWidget.tsx` and `exercise-widgets.scss`, restyled for a 300 px column.
- Test: `tests/black-box/lesson-column.test.ts` (new, BB-LCOL-01 to BB-LCOL-05)

**Interfaces:**
- Consumes: `Button` from `@/shared/ui/controls`.
- Produces:
  - `useLessonRunner(): LessonRunner`;
  - `LessonCard` (default export, no props), which renders nothing when no lesson is active.

```ts
import type { Lesson, LessonStep } from '@/core/types/lesson';

export interface LessonRunner {
  /** True when appMode is Lesson and a lesson and step exist. */
  active: boolean;
  lesson: Lesson | null;
  step: LessonStep | null;
  stepIndex: number;
  stepCount: number;
  isLastStep: boolean;
  canAdvance: boolean;
  mcAnswer: string | null;
  setMcAnswer: (id: string | null) => void;
  orderAnswer: string[] | null;
  setOrderAnswer: (order: string[]) => void;
  next: () => void;
  back: () => void;
  exit: () => void;
}
```

- [ ] **Step 1: Write the failing tests.** Create `tests/black-box/lesson-column.test.ts` with the shared helpers (`settle`, `mount`, `unmount`, `key`):

```ts
/**
 * BLACK-BOX TEST SUITE — BB-LCOL
 * The lesson column: the runner hook, the lesson card and panel focus.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { h, render, type VNode } from 'preact';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';

// settle, mount, unmount, key: as in tests/black-box/controls.test.ts

function startLesson(id: string, section: 'Transforms' | 'Pipeline' = 'Transforms') {
  useVamsStore.setState({ activeSection: section });
  useVamsStore.getState().setActiveLesson(id);
  useVamsStore.getState().setAppMode('Lesson');
}
function buttonNamed(host: HTMLElement, text: string) {
  return [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

afterEach(() => {
  useVamsStore.getState().clearLessonState();
  useVamsStore.setState({ appMode: 'Author' });
});

describe('BB-LCOL-01: The lesson card renders nothing outside a lesson', () => {
  it('is empty in Author mode', () => {
    const host = mount(h(LessonCard, {}));
    expect(host.innerHTML).toBe('');
    unmount(host);
  });
});

describe('BB-LCOL-02: The card shows type, title, progress and narration', () => {
  it('waits for the student on an exercise step', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    expect(host.querySelector('.lesson-card__chip')!.textContent).toBe('Exercise');
    expect(host.querySelector('.lesson-card__title')!.textContent).toBe('Translate to Position');
    const progress = host.querySelector('[role="progressbar"]')!;
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(progress.getAttribute('aria-valuemax')).toBe('2');
    expect(host.querySelector('.lesson-card__narration')!.textContent).toContain('Move the triangle to (0.5,');
    expect(buttonNamed(host, 'Next')!.disabled).toBe(true);
    expect(buttonNamed(host, 'Back')!.disabled).toBe(true);
    expect(host.textContent).toContain('Waiting for you');
    unmount(host);
  });
});

describe('BB-LCOL-03: Meeting the success check enables Next; the last step says Finish', () => {
  it('advances when the triangle is moved to the target', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    const state = useVamsStore.getState();
    const id = state.objects[0].id;
    useVamsStore.setState({ selectedObjectId: id });
    useVamsStore.getState().updateObjectTransform(id, { translateX: 0.5, translateY: -0.3 });
    await settle();
    const next = buttonNamed(host, 'Next')!;
    expect(next.disabled).toBe(false);
    next.click();
    await settle();
    expect(host.querySelector('.lesson-card__narration')!.textContent).toContain('Spot on!');
    expect(buttonNamed(host, 'Finish')).toBeDefined();
    unmount(host);
  });
});

describe('BB-LCOL-04: Finish and Exit return to Author mode', () => {
  it('Finish on the last step ends the lesson', async () => {
    startLesson('transforms-exercise-1');
    useVamsStore.getState().setCurrentStep(1);
    const host = mount(h(LessonCard, {}));
    await settle();
    buttonNamed(host, 'Finish')!.click();
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    expect(useVamsStore.getState().activeLessonId).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-05: Esc on the window exits the lesson', () => {
  it('keeps the global lesson keys', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(LessonCard, {}));
    await settle();
    key(window, 'Escape');
    await settle();
    expect(useVamsStore.getState().appMode).toBe('Author');
    unmount(host);
  });
});
```

> BB-LCOL-04 sets step 1 before mounting. The runner's step effect replays step 0's action and then runs step 1 (non-linear navigation), so Finish is available, because the last step has no `waitForUser`. Check `transforms-lessons.ts`: if step 1 of `transforms-exercise-1` has `waitForUser: true` and no `successCheck`, `canAdvance` is still true.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/lesson-column.test.ts`
Expected: FAIL, because `LessonCard` doesn't exist.

- [ ] **Step 3: Create `src/features/lesson-engine/model/useLessonRunner.ts`.** Move everything above the `if (appMode !== 'Lesson' …) return null;` line in `LessonBar.tsx` into this hook, unchanged:
- `DEFAULT_LESSON_VIEWPORT`;
- the store reads;
- `sessionSeed`;
- the canvas-size ref;
- the shuffle memo;
- the answer state and its reset effect;
- the step-execution effect;
- `isStepSuccess`;
- `handleNext`, `handleBack` and `handleExit`;
- the window keydown effect.

Then end the hook with:

```ts
  const active = appMode === 'Lesson' && !!lesson && !!step;
  const stepCount = lesson?.steps.length ?? 0;
  return {
    active,
    lesson: active ? lesson : null,
    step: active ? step ?? null : null,
    stepIndex: currentStepIndex,
    stepCount,
    isLastStep: active && currentStepIndex === stepCount - 1,
    canAdvance: active && (!step!.waitForUser || isStepSuccess),
    mcAnswer,
    setMcAnswer,
    orderAnswer,
    setOrderAnswer,
    next: handleNext,
    back: handleBack,
    exit: handleExit,
  };
```

The hook's imports are the model imports from `LessonBar.tsx`: `useVamsStore`, `LESSON_REGISTRY`, `useCanvasSize`, `generateCodeFromState` and `resolveChangedLines`, plus the `Lesson` and `LessonStep` types. Export the `LessonRunner` interface from the same file.

- [ ] **Step 4: Point `LessonBar.tsx` at the hook,** so the editor keeps working until Task 8. Replace everything above its `return (` with:

```tsx
export default function LessonBar() {
  const runner = useLessonRunner();
  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex: currentStepIndex, isLastStep, canAdvance } = runner;
  const progressPercent = ((currentStepIndex + 1) / lesson.steps.length) * 100;
  const lessonTypeIcon = lesson.type === 'exercise' ? <GraduationCap size={14} /> : <PlayCircle size={14} />;
  const activeLessonId = lesson.id;
```

In the JSX below, replace:
- `mcAnswer` with `runner.mcAnswer`;
- `setMcAnswer` with `runner.setMcAnswer`;
- `orderAnswer` with `runner.orderAnswer`;
- `setOrderAnswer` with `runner.setOrderAnswer`;
- `handleExit`, `handleBack` and `handleNext` with `runner.exit`, `runner.back` and `runner.next`.

Remove the imports that are now unused.

- [ ] **Step 5: Create `src/features/lesson-engine/ui/LessonCard.tsx`:**

```tsx
import { ChevronLeft, ChevronRight, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/shared/ui/controls';
import { useLessonRunner } from '../model/useLessonRunner';
import MultipleChoiceWidget from './exercise-widgets/MultipleChoiceWidget';
import OrderListWidget from './exercise-widgets/OrderListWidget';
import './lesson-card.scss';

/** The lesson, shown at the top of the section column in Lesson mode. Runs the step engine; mount once. */
export default function LessonCard() {
  const runner = useLessonRunner();
  if (!runner.active || !runner.lesson || !runner.step) return null;
  const { lesson, step, stepIndex, stepCount, isLastStep, canAdvance } = runner;
  const stepKey = `${lesson.id}-${stepIndex}`;
  const waiting = !!step.waitForUser && !canAdvance;

  return (
    <section className="lesson-card" aria-label="Lesson">
      <div className="lesson-card__head">
        <span className="lesson-card__chip">{lesson.type === 'exercise' ? 'Exercise' : 'Demo'}</span>
        <span className="lesson-card__section">{lesson.section}</span>
        <Button variant="quiet" className="lesson-card__exit" icon={<X />} title="Exit lesson (Esc)" onClick={runner.exit}>
          Exit
        </Button>
      </div>
      <h2 className="lesson-card__title">{lesson.title}</h2>
      <div
        className="lesson-card__progress"
        role="progressbar"
        aria-label="Lesson progress"
        aria-valuemin={1}
        aria-valuemax={stepCount}
        aria-valuenow={stepIndex + 1}
      >
        {Array.from({ length: stepCount }, (_, i) => (
          <i key={i} className={i < stepIndex ? 'is-done' : i === stepIndex ? 'is-now' : undefined} />
        ))}
        <span className="lesson-card__count">{stepIndex + 1} / {stepCount}</span>
      </div>
      <p className="lesson-card__narration" aria-live="polite" key={stepKey}>{step.narration}</p>
      {step.exercise && (
        <div className="lesson-card__exercise" key={`ex-${stepKey}`}>
          {step.exercise.kind === 'multiple-choice' && (
            <MultipleChoiceWidget
              prompt={step.exercise.prompt}
              visualArtifact={step.exercise.visualArtifact}
              options={step.exercise.options}
              selectedId={runner.mcAnswer}
              correctId={step.exercise.correctId}
              onSelect={runner.setMcAnswer}
            />
          )}
          {step.exercise.kind === 'ordered-list' && runner.orderAnswer && (
            <OrderListWidget
              prompt={step.exercise.prompt}
              items={step.exercise.items}
              order={runner.orderAnswer}
              correctOrder={step.exercise.correctOrder}
              onChange={runner.setOrderAnswer}
            />
          )}
        </div>
      )}
      <div className="lesson-card__nav">
        {waiting && <span className="lesson-card__waiting">Waiting for you</span>}
        <Button icon={<ChevronLeft />} title="Previous step (←)" disabled={stepIndex === 0} onClick={runner.back}>
          Back
        </Button>
        <Button
          variant="primary"
          icon={isLastStep ? <CheckCircle2 /> : <ChevronRight />}
          title={isLastStep ? 'Finish lesson' : 'Next step (→)'}
          disabled={!canAdvance}
          onClick={isLastStep ? runner.exit : runner.next}
        >
          {isLastStep ? 'Finish' : 'Next'}
        </Button>
      </div>
    </section>
  );
}
```

> BB-LCOL-02 reads `.lesson-card__chip`'s text as "Exercise"; uppercase is a CSS `text-transform`. Button text must equal "Next", "Back", "Finish" or "Exit" exactly; the icon sits in its own `aria-hidden` span.

- [ ] **Step 6: Create `src/features/lesson-engine/ui/lesson-card.scss`:**

```scss
.lesson-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px 14px;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-raised);

  &__head { display: flex; align-items: center; gap: 8px; }

  &__chip {
    padding: 1px 7px;
    border: 1px solid var(--accent-text);
    border-radius: 9px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-text);
  }

  &__section {
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  &__exit { margin-left: auto; }

  &__title {
    margin: -2px 0 0;
    font-family: var(--font-display);
    font-size: 19px;
    font-weight: 600;
    line-height: 1.15;
  }

  &__progress {
    display: flex;
    align-items: center;
    gap: 4px;

    i { flex: 1; height: 3px; border-radius: 2px; background: var(--rule); }
    i.is-done { background: var(--accent); }
    i.is-now { background: var(--accent); opacity: 0.45; }
  }

  &__count {
    margin-left: 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-faint);
    white-space: nowrap;
  }

  &__narration {
    margin: 0;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink);
  }

  &__nav {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  &__waiting {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-right: auto;
    font-size: 12px;
    color: var(--ink-faint);

    &::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      animation: lesson-card-pulse 1.6s ease-in-out infinite;
    }
  }
}

@keyframes lesson-card-pulse {
  50% { opacity: 0.25; }
}

@media (prefers-reduced-motion: reduce) {
  .lesson-card__waiting::before { animation: none; }
}
```

- [ ] **Step 7: Restyle the quiz widgets for the column.** In `exercise-widgets.scss`, make these changes. The widgets' markup, props and behaviour don't change.
- Options stack one per line: `grid-template-columns: 1fr`, with each option at least 34 px tall.
- The `.artifact-display` visual is at most 160 px wide and centred.
- Remove the `max-width: 720px` and `480px` caps, and the `minmax(160px, 1fr)` multi-column grid.
- Use the tokens `--field-line`, `--field-bg`, `--live` and `--live-tint` for borders, the selected state and the correct state.

  **Contrast check:** keep the existing success and error colours, and verify that each one still reads at 3:1 against its background in both themes.

- [ ] **Step 8: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/algorithm/algorithm-3-lesson-step.test.ts tests/black-box/lesson-engine.test.ts`
Expected: PASS. The Algorithm 3 and lesson-engine tests are unchanged.

- [ ] **Step 9: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/lesson-engine tests/black-box/lesson-column.test.ts
git commit -m "refactor(lessons): move the step engine into a hook and add the lesson card"
```

---

### Task 8: Editor shell: section column, code and math column, narrow drawer, help text

**Files:**
- Create:
  - `src/widgets/layout/section-column/section-panels.tsx`, `SectionMenu.tsx`, `SectionColumn.tsx`, `section-column.scss`, `index.ts`;
  - `src/widgets/layout/code-math-column/CodeMathColumn.tsx`, `code-math-column.scss`, `index.ts`;
  - `src/pages/editor/model/useNarrowLayout.ts`;
  - `src/pages/editor/ui/EditorShell.tsx`.
- Modify:
  - `src/pages/editor/ui/EditorApp.tsx` and `editor-app.scss`;
  - `src/features/object-transform/ui/ObjectTransformPanel.tsx`: title, `panelId` and the empty state only;
  - `src/features/text-nodes/ui/TextNodePanel.tsx`: `panelId` and the add-button label only;
  - `src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx`: `panelId` on both panels only;
  - `src/features/onboarding/ui/WelcomeCard.tsx`: text only;
  - `src/features/help/model/help-content.ts`: text only.
- Delete:
  - `src/widgets/layout/left-sidebar/`, `src/widgets/layout/right-sidebar/`;
  - `src/features/lesson-engine/ui/LessonBar.tsx`, `lesson-bar.scss`.
- Test: `tests/black-box/lesson-column.test.ts` (append BB-LCOL-06 to BB-LCOL-10), `tests/black-box/editor-shell.test.ts` (append BB-SHELL-14 and BB-SHELL-15)

**Interfaces:**
- Consumes:
  - `Panel`, `PanelLayoutContext`, `MenuButton` and `Button` from `@/shared/ui/controls`;
  - `LessonCard`;
  - every feature panel.
- Produces:
  - `SECTION_PANELS: SectionPanels`, with `type SectionPanels = Record<CurriculumSection, SectionPanelEntry[]>` and `interface SectionPanelEntry { id: string; render: () => ComponentChildren }`;
  - `SectionColumn({ panels?: SectionPanels })`;
  - `SectionMenu()`;
  - `CodeMathColumn()`;
  - `useNarrowLayout(): boolean`;
  - `EditorShell(props: EditorShellProps)`.

```ts
export interface EditorShellProps {
  topBar: ComponentChildren;
  column: ComponentChildren;
  canvas: ComponentChildren;
  codeMath: ComponentChildren;
  /** Dialogs and other overlays rendered after the grid. */
  overlays?: ComponentChildren;
}
```

- [ ] **Step 1: Append the failing tests.**

  **To `tests/black-box/lesson-column.test.ts`**, add these imports:

```ts
import { h as hh } from 'preact';
import { vi } from 'vitest';
import { Panel } from '@/shared/ui/controls';
import { LESSON_REGISTRY } from '@/features/lesson-engine/model/lesson-registry';
import { SectionColumn, SECTION_PANELS, type SectionPanels } from '@/widgets/layout/section-column';
import EditorShell from '@/pages/editor/ui/EditorShell';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
```

```ts
function fakePanels(): SectionPanels {
  const panel = (id: string, title: string, defaultOpen = true) => ({
    id,
    render: () => hh(Panel, { panelId: id, title, defaultOpen }, `${title} body`),
  });
  return {
    Pipeline: [panel('pipeline-mode-controls', 'Viewport Mode'), panel('scene-hierarchy', 'Scene Hierarchy')],
    Primitives: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('line-style-panel', 'Line Style')],
    Buffers: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('buffers-panel', 'Memory & Buffers')],
    Transforms: [
      panel('scene-hierarchy', 'Scene Hierarchy'),
      panel('ortho-editor', 'Viewing Volume', false),
      panel('object-transform', 'Object Transform'),
    ],
    Textures: [panel('scene-hierarchy', 'Scene Hierarchy'), panel('uv-editor', 'UV Editor')],
  };
}
const titles = (host: HTMLElement) => [...host.querySelectorAll('.vpanel__title')].map((t) => t.textContent);

describe('BB-LCOL-06: In Lesson mode the column shows the lesson instead of the section menu', () => {
  it('has a lesson card and no section menu', async () => {
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
    await settle();
    expect(host.querySelector('.lesson-card')).not.toBeNull();
    expect(host.querySelector('.section-menu')).toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-07: The focus panel comes first, open, under "Use this panel"', () => {
  it('reorders and collapses the rest', async () => {
    // Step 1 of transforms-exercise-1 targets object-transform, which is last in the fake list.
    startLesson('transforms-exercise-1');
    const host = mount(h(SectionColumn, { panels: fakePanels() }));
    await settle();
    expect(titles(host)).toEqual(['Object Transform', 'Scene Hierarchy', 'Viewing Volume']);
    expect(host.querySelector('.section-column__use')!.textContent).toContain('Use this panel');
    const headers = host.querySelectorAll('.vpanel__header');
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(headers[1].getAttribute('aria-expanded')).toBe('false');
    expect(headers[2].getAttribute('aria-expanded')).toBe('false');
    unmount(host);
  });
});

describe('BB-LCOL-08: Every lesson focusPanel is a panel in its section', () => {
  it('resolves all ids against SECTION_PANELS', () => {
    const missing: string[] = [];
    for (const lesson of Object.values(LESSON_REGISTRY)) {
      const ids = new Set(SECTION_PANELS[lesson.section].map((entry) => entry.id));
      for (const step of lesson.steps) {
        if (step.focusPanel && !ids.has(step.focusPanel)) missing.push(`${lesson.id}:${step.focusPanel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('BB-LCOL-09: Object Transform and Create Text carry the ids lessons use', () => {
  it('renders data-panel-id and the Object Transform title', () => {
    let host = mount(h(ObjectTransformPanel, {}));
    expect(host.querySelector('[data-panel-id="object-transform"]')).not.toBeNull();
    expect(host.querySelector('.vpanel__title')!.textContent).toBe('Object Transform');
    unmount(host);
    host = mount(h(TextNodePanel, {}));
    expect(host.querySelector('[data-panel-id="text-node-panel"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label="Add text"]')).not.toBeNull();
    unmount(host);
  });
});

describe('BB-LCOL-10: On narrow screens Esc in the open drawer closes only the drawer', () => {
  it('keeps the lesson running and returns focus to the Panels button', async () => {
    const realMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, onchange: null, dispatchEvent: () => false,
    }));
    startLesson('transforms-exercise-1');
    const host = mount(h(EditorShell, {
      topBar: h('header', {}, 'top'),
      column: h('div', {}, h(LessonCard, {}), h('button', { id: 'inside' }, 'inside')),
      canvas: h('div', {}, 'canvas'),
      codeMath: h('div', {}, 'code'),
    }));
    await settle();
    const toggle = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Panels'))!;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    (host.querySelector('#inside') as HTMLElement).focus();
    key(host.querySelector('#inside')!, 'Escape');
    await settle();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
    expect(useVamsStore.getState().appMode).toBe('Lesson');
    window.matchMedia = realMatchMedia;
    unmount(host);
  });
});
```

  **To `tests/black-box/editor-shell.test.ts`**, add the imports `import { SectionColumn, SectionMenu, type SectionPanels } from '@/widgets/layout/section-column';` and `import { Panel } from '@/shared/ui/controls';`, then:

```ts
describe('BB-SHELL-14: The section menu lists the five sections and switches', () => {
  it('uses the exact labels, checks the active one, and calls setActiveSection', async () => {
    useVamsStore.setState({ activeSection: 'Transforms', appMode: 'Author' });
    const host = mount(h(SectionMenu, {}));
    expect(host.querySelector('.section-menu__name')!.textContent).toBe('Transforms');
    expect(host.querySelector('.section-menu__desc')!.textContent).toBe('Translate, rotate, scale, and the matrix stack');
    await openMenu(host, 'Transforms');
    expect(menuItems(host)).toEqual(['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures']);
    const checked = host.querySelector('[role="menuitemradio"][aria-checked="true"]')!;
    expect(checked.textContent).toContain('Transforms');
    expect(document.activeElement).toBe(checked);
    chooseItem(host, 'Buffers');
    await settle();
    expect(useVamsStore.getState().activeSection).toBe('Buffers');
    unmount(host);
  });
});

describe('BB-SHELL-15: Scene Hierarchy is pinned first except in Pipeline', () => {
  it('reorders Author-mode panels per section', async () => {
    const panel = (id: string, title: string) => ({ id, render: () => h(Panel, { panelId: id, title }, 'x') });
    const panels: SectionPanels = {
      Pipeline: [panel('pipeline-mode-controls', 'Viewport Mode'), panel('scene-hierarchy', 'Scene Hierarchy')],
      Primitives: [panel('line-style-panel', 'Line Style'), panel('scene-hierarchy', 'Scene Hierarchy')],
      Buffers: [panel('scene-hierarchy', 'Scene Hierarchy')],
      Transforms: [panel('scene-hierarchy', 'Scene Hierarchy')],
      Textures: [panel('scene-hierarchy', 'Scene Hierarchy')],
    };
    const titlesOf = (host: HTMLElement) => [...host.querySelectorAll('.vpanel__title')].map((t) => t.textContent);
    useVamsStore.setState({ activeSection: 'Primitives', appMode: 'Author' });
    const host = mount(h(SectionColumn, { panels }));
    await settle();
    expect(titlesOf(host)).toEqual(['Scene Hierarchy', 'Line Style']);
    useVamsStore.setState({ activeSection: 'Pipeline' });
    await settle();
    expect(titlesOf(host)).toEqual(['Viewport Mode', 'Scene Hierarchy']);
    unmount(host);
  });
});
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/editor-shell.test.ts`
Expected: FAIL, because the modules are missing.

- [ ] **Step 3: Create `src/widgets/layout/section-column/section-panels.tsx`.** This replaces `LeftSidebar.renderSectionContent`: the same panels in the same order, without the repeated separators, and with the Transforms empty state moved into `ObjectTransformPanel` (Step 6).

```tsx
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import PipelineModeControls from '@/features/pipeline-controls/ui/PipelineModeControls';
import CustomShapeBuilderPanel from '@/features/custom-shapes/ui/CustomShapeBuilderPanel';
import TextNodePanel from '@/features/text-nodes/ui/TextNodePanel';
import SceneHierarchyPanel from '@/features/scene-hierarchy/ui/SceneHierarchyPanel';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import AnimationPreviewPanel from '@/features/animation-preview/ui/AnimationPreviewPanel';
import ObjectAppearancePanel from '@/features/object-appearance/ui/ObjectAppearancePanel';
import LineStylePanel from '@/features/line-style/ui/LineStylePanel';
import CallbacksPanel from '@/features/callbacks/ui/CallbacksPanel';
import BuffersPanel from '@/features/buffers/ui/BuffersPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
import TextureLibraryPanel from '@/features/textures/ui/TextureLibraryPanel';
import TextureAttachmentPanel from '@/features/textures/ui/TextureAttachmentPanel';
import UVEditorPanel from '@/features/textures/ui/UVEditorPanel';

export interface SectionPanelEntry {
  /** Equals the panel's panelId, which lesson focusPanel targets. */
  id: string;
  render: () => ComponentChildren;
}

export type SectionPanels = Record<CurriculumSection, SectionPanelEntry[]>;

export const PINNED_PANEL_ID = 'scene-hierarchy';

function PipelineAppearance() {
  const hasSelection = useVamsStore((s) => s.selectedObjectId !== null);
  return hasSelection ? null : <ObjectAppearancePanel />;
}

function SelectedAnimation() {
  const hasSelection = useVamsStore((s) => s.objects.some((o) => o.id === s.selectedObjectId));
  return hasSelection ? <AnimationPreviewPanel /> : null;
}

const hierarchy: SectionPanelEntry = { id: 'scene-hierarchy', render: () => <SceneHierarchyPanel /> };
const palette: SectionPanelEntry = { id: 'primitive-palette', render: () => <CustomShapeBuilderPanel /> };

export const SECTION_PANELS: SectionPanels = {
  Pipeline: [
    { id: 'pipeline-mode-controls', render: () => <PipelineModeControls /> },
    hierarchy,
    { id: 'appearance-panel', render: () => <PipelineAppearance /> },
  ],
  Primitives: [
    hierarchy,
    palette,
    { id: 'text-node-panel', render: () => <TextNodePanel /> },
    { id: 'appearance-panel', render: () => <ObjectAppearancePanel /> },
    { id: 'line-style-panel', render: () => <LineStylePanel /> },
    { id: 'callbacks-panel', render: () => <CallbacksPanel /> },
  ],
  Buffers: [hierarchy, palette, { id: 'buffers-panel', render: () => <BuffersPanel /> }],
  Transforms: [
    hierarchy,
    { id: 'object-transform', render: () => <ObjectTransformPanel /> },
    { id: 'animation-preview', render: () => <SelectedAnimation /> },
    { id: 'ortho-editor', render: () => <OrthoEditorPanel /> },
  ],
  Textures: [
    hierarchy,
    palette,
    { id: 'texture-library', render: () => <TextureLibraryPanel /> },
    { id: 'texture-attach', render: () => <TextureAttachmentPanel /> },
    { id: 'uv-editor', render: () => <UVEditorPanel /> },
  ],
};
```

> `LeftSidebar` rendered the Pipeline appearance panel only when nothing was selected, so the `selectedObject` check there is `objects.find(o => o.id === selectedObjectId)`. Keep that behaviour, and use the same `objects.some(…)` check in `PipelineAppearance` if `selectedObjectId` can be stale. `AnimationPreviewPanel` showed only with a selection; keep that too.

- [ ] **Step 4: Create `src/widgets/layout/section-column/SectionMenu.tsx`:**

```tsx
import { Database, GitCommit, Image as ImageIcon, Move3d, Shapes } from 'lucide-react';
import type { ComponentChildren } from 'preact';
import { useVamsStore } from '@/core/store';
import type { CurriculumSection } from '@/core/store/types';
import { MenuButton } from '@/shared/ui/controls';

const SECTIONS: { section: CurriculumSection; description: string; icon: ComponentChildren }[] = [
  { section: 'Pipeline', description: 'The rendering pipeline, NDC, and rasterization', icon: <GitCommit /> },
  { section: 'Primitives', description: 'Points, lines, triangles, color, and line style', icon: <Shapes /> },
  { section: 'Buffers', description: 'Vertex arrays, VBOs, and memory layout', icon: <Database /> },
  { section: 'Transforms', description: 'Translate, rotate, scale, and the matrix stack', icon: <Move3d /> },
  { section: 'Textures', description: 'Images, UV mapping, filtering, and wrapping', icon: <ImageIcon /> },
];

/** The column's title: the active section's name, which opens a menu of all sections. */
export default function SectionMenu() {
  const activeSection = useVamsStore((s) => s.activeSection);
  const setActiveSection = useVamsStore((s) => s.setActiveSection);
  const current = SECTIONS.find((s) => s.section === activeSection) ?? SECTIONS[0];

  return (
    <div className="section-menu">
      <p className="section-menu__eyebrow" aria-hidden="true">Section</p>
      <h2 className="sr-only">{current.section}</h2>
      <MenuButton
        label="Sections"
        variant="quiet"
        triggerClassName="section-menu__trigger"
        entries={SECTIONS.map(({ section, description, icon }) => ({
          kind: 'radio' as const,
          id: section,
          label: section,
          description,
          icon,
          checked: section === activeSection,
          onSelect: () => setActiveSection(section),
        }))}
      >
        <span className="section-menu__name">{current.section}</span>
      </MenuButton>
      <p className="section-menu__desc">{current.description}</p>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/widgets/layout/section-column/SectionColumn.tsx` and `index.ts`:**

```tsx
import { Fragment } from 'preact';
import { ArrowDown } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import LessonCard from '@/features/lesson-engine/ui/LessonCard';
import { PanelLayoutContext } from '@/shared/ui/controls';
import SectionMenu from './SectionMenu';
import { PINNED_PANEL_ID, SECTION_PANELS, type SectionPanels } from './section-panels';
import './section-column.scss';

export default function SectionColumn({ panels = SECTION_PANELS }: { panels?: SectionPanels }) {
  const activeSection = useVamsStore((s) => s.activeSection);
  const inLesson = useVamsStore((s) => s.appMode === 'Lesson');
  const focusPanelId = useVamsStore((s) => s.lessonFocusPanel);
  const list = panels[activeSection];

  let ordered = list;
  const focus = inLesson ? list.find((entry) => entry.id === focusPanelId) : undefined;
  if (focus) {
    ordered = [focus, ...list.filter((entry) => entry !== focus)];
  } else if (!inLesson && activeSection !== 'Pipeline') {
    const pinned = list.find((entry) => entry.id === PINNED_PANEL_ID);
    if (pinned) ordered = [pinned, ...list.filter((entry) => entry !== pinned)];
  }

  return (
    <div className="section-column" data-scroll-root>
      <div className="section-column__head">{inLesson ? <LessonCard /> : <SectionMenu />}</div>
      <PanelLayoutContext.Provider value={{ mode: inLesson ? 'lesson' : 'author', focusPanelId: inLesson ? focusPanelId : null }}>
        <div className="section-column__panels" key={inLesson ? `lesson-${focusPanelId ?? 'none'}` : `author-${activeSection}`}>
          {ordered.map((entry, index) => (
            <Fragment key={entry.id}>
              {focus && index === 0 && (
                <p className="section-column__use">
                  <ArrowDown size={12} aria-hidden="true" />
                  Use this panel
                </p>
              )}
              {entry.render()}
            </Fragment>
          ))}
        </div>
      </PanelLayoutContext.Provider>
    </div>
  );
}
```

```ts
// src/widgets/layout/section-column/index.ts
export { default as SectionColumn } from './SectionColumn';
export { default as SectionMenu } from './SectionMenu';
export { SECTION_PANELS, PINNED_PANEL_ID, type SectionPanels, type SectionPanelEntry } from './section-panels';
```

- [ ] **Step 6: Create `src/widgets/layout/section-column/section-column.scss`:**

```scss
.section-column {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--paper);

  &__head {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--paper-raised);
    border-bottom: 1px solid var(--rule);
  }

  &__use {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    padding: 9px 14px 0;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-text);
  }
}

.section-menu {
  padding: 10px 12px 12px;

  &__eyebrow {
    margin: 0 0 2px 2px;
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-faint);
  }

  &__trigger.vbtn {
    min-height: 36px;
    padding: 0 6px 0 2px;
    color: var(--ink);
  }

  &__name {
    font-family: var(--font-display);
    font-size: 23px;
    font-weight: 600;
  }

  &__desc {
    margin: 2px 0 0 2px;
    font-size: 12.5px;
    color: var(--ink-muted);
  }

  .vmenu__list { min-width: 276px; }
}
```

- [ ] **Step 7: Create the code and math column.** `src/widgets/layout/code-math-column/CodeMathColumn.tsx` (with `index.ts` exporting it as default):

```tsx
import SceneCodePanel from '@/features/code-generation/ui/SceneCodePanel';
import MathPanel from '@/features/math-panel/ui/MathPanel';
import './code-math-column.scss';

export default function CodeMathColumn() {
  return (
    <div className="code-math-column">
      <div className="code-math-column__code">
        <SceneCodePanel />
      </div>
      <div className="code-math-column__math">
        <MathPanel />
      </div>
    </div>
  );
}
```

```scss
.code-math-column {
  display: grid;
  grid-template-rows: minmax(0, 58fr) minmax(0, 42fr);
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  border-left: 1px solid var(--rule);
  background: var(--paper);

  &__code,
  &__math {
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &__math { border-top: 1px solid var(--rule); }
}
```

> Copy any flex or overflow rule from `right-sidebar.scss` that `SceneCodePanel` or `MathPanel` needs to scroll internally, such as `.panel-top > *` or `.panel-bottom > *` with `flex: 1; min-height: 0`, onto `&__code > *` and `&__math > *`. Then delete `right-sidebar/`.

- [ ] **Step 8: Create `src/pages/editor/model/useNarrowLayout.ts`:**

```ts
import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 1099.98px)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function snapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/** True below 1100 CSS px, where the section column becomes a drawer. */
export function useNarrowLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot);
}
```

- [ ] **Step 9: Create `src/pages/editor/ui/EditorShell.tsx`:**

```tsx
import { useRef, useState } from 'react';
import type { ComponentChildren } from 'preact';
import { PanelLeft } from 'lucide-react';
import { useVamsStore } from '@/core/store';
import { Button } from '@/shared/ui/controls';
import { useNarrowLayout } from '../model/useNarrowLayout';
import './editor-app.scss';

export interface EditorShellProps {
  topBar: ComponentChildren;
  column: ComponentChildren;
  canvas: ComponentChildren;
  codeMath: ComponentChildren;
  overlays?: ComponentChildren;
}

/** The editor grid. Below 1100 px the section column becomes a drawer over the canvas. */
export default function EditorShell({ topBar, column, canvas, codeMath, overlays }: EditorShellProps) {
  const narrow = useNarrowLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Open the drawer whenever a lesson starts or moves to another step, so the narration is visible.
  const stepKey = useVamsStore((s) => (s.appMode === 'Lesson' ? `${s.activeLessonId}:${s.currentStepIndex}` : null));
  const [lastStepKey, setLastStepKey] = useState<string | null>(null);
  if (stepKey !== lastStepKey) {
    setLastStepKey(stepKey);
    if (stepKey) setDrawerOpen(true);
  }

  const showDrawer = narrow && drawerOpen;
  const onColumnKeyDown = (event: KeyboardEvent) => {
    if (!showDrawer || event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    event.stopPropagation();
    setDrawerOpen(false);
    toggleRef.current?.focus();
  };

  const classes = ['editor', narrow ? 'editor--narrow' : '', showDrawer ? 'is-drawer-open' : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {topBar}
      <aside id="editor-section-column" className="editor__column" aria-label="Section panels" onKeyDown={onColumnKeyDown}>
        {column}
      </aside>
      <main className="editor__canvas canvas-area">
        {narrow && (
          <Button
            ref={toggleRef}
            className="editor__panels-toggle"
            icon={<PanelLeft />}
            aria-expanded={drawerOpen}
            aria-controls="editor-section-column"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            Panels
          </Button>
        )}
        {canvas}
      </main>
      <aside className="editor__code" aria-label="Code and math">{codeMath}</aside>
      {overlays}
    </div>
  );
}
```

> On wide screens the drawer state is ignored (`showDrawer` requires `narrow`). The lesson-step pattern sets state during render, with no effect, as the hooks lint rule requires.

- [ ] **Step 10: Rewrite `src/pages/editor/ui/EditorApp.tsx`** to use the shell. Keep the existing hooks and effects: `useKeyboardShortcuts`, `useEditorLink`, `useCorruptSaveNotice`, the `route-editor` class and the theme mirror.

```tsx
  return (
    <EditorShell
      topBar={<TopBar />}
      column={<SectionColumn />}
      canvas={<ViewportRouter />}
      codeMath={<CodeMathColumn />}
      overlays={
        <>
          <HelpCenter />
          <MyScenesDialog />
          <ConfirmDialog />
          <WelcomeCard />
        </>
      }
    />
  );
```

Remove the imports of `LeftSidebar`, `RightSidebar` and `LessonBar`, and the `appMode` selector if it's now unused. Add imports for `EditorShell`, `SectionColumn` (from `@/widgets/layout/section-column`) and `CodeMathColumn` (from `@/widgets/layout/code-math-column`).

- [ ] **Step 11: Replace `src/pages/editor/ui/editor-app.scss`:**

```scss
.editor {
  position: relative;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  grid-template-columns: 300px minmax(0, 1fr) clamp(360px, 30vw, 480px);
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  background: var(--paper);

  &__column {
    grid-row: 2;
    grid-column: 1;
    min-height: 0;
    border-right: 1px solid var(--rule);
  }

  &__canvas {
    position: relative;
    grid-row: 2;
    grid-column: 2;
    min-width: 0;
    min-height: 0;
    background-color: rgba(var(--well-rgb), 0.5);
  }

  &__code {
    grid-row: 2;
    grid-column: 3;
    min-width: 0;
    min-height: 0;
  }

  &__panels-toggle {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 25;
  }

  &--narrow {
    grid-template-columns: minmax(0, 1fr) clamp(320px, 34vw, 400px);

    .editor__canvas { grid-column: 1; }
    .editor__code { grid-column: 2; }

    .editor__column {
      position: absolute;
      top: 44px;
      bottom: 0;
      left: 0;
      z-index: 30;
      width: 300px;
      background: var(--paper);
      box-shadow: 8px 0 28px rgba(var(--shadow-rgb), 0.22);
      transform: translateX(-100%);
      visibility: hidden;
      transition: transform 0.2s ease, visibility 0.2s;
    }
  }

  &.is-drawer-open .editor__column {
    transform: none;
    visibility: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .editor--narrow .editor__column { transition: none; }
}
```

> On narrow screens the canvas overlays' viewport chip must sit to the right of the Panels button. Task 12 restyles the overlays, so for now check only that the button stays clickable above the canvas, with `z-index: 25`.

- [ ] **Step 12: Panel ids and the empty state.**
- **`ObjectTransformPanel.tsx`:**
  - Change the panel title to `"Object Transform"` and add `panelId="object-transform"`.
  - Replace `if (!selectedObject) return null;` with an early return that renders the same panel containing `<EmptySelectionState message="Select an object in the scene to translate, rotate, or scale it." />` (import it from `@/shared/ui/empty-state/EmptySelectionState`).
  - Hooks stay above the early return.
- **`TextNodePanel.tsx`:** add `panelId="text-node-panel"`. Give the icon-only add button `aria-label="Add text"` and `title="Add text"`.
- **`CustomShapeBuilderPanel.tsx`:** add `panelId="primitive-palette"` to the panel shown while building, too.

- [ ] **Step 13: Update the help text and the welcome card.**

  **In `src/features/help/model/help-content.ts`:**
  - **`workspace-tour`:**
    - In `keywords`, replace `'sidebar'` with `'column'` and add `'section menu', 'file menu'`.
    - The first list item becomes: `'Left — Build. The section menu and the panels for creating and editing scene objects. During a lesson this column shows the lesson instead.'`
    - Heading `'The section tabs'` becomes `'The section menu'`.
    - Its paragraph becomes: `'The name at the top of the left column is the current section. Click it to switch to any of the five sections; switching changes which build tools appear and what the math panel explains.'`
    - The table headers become `['Section', 'What it covers']`.
    - The top-bar list items become, in order:
      ```ts
      'Lessons — launch a guided, narrated lesson for the current section.',
      'File — start a new workspace, open My scenes, open or save a project file, or export the C++ code.',
      'Undo / Redo — step backward and forward through your edits.',
      'Theme — switch between dark and light.',
      'View settings — toggle axes, gridlines, the coordinate tracker, and open the shortcut list.',
      'Help — open this Help Center (also ? or F1).',
      ```
  - **The lesson topic:**
    - "Launch a lesson from the launcher in the top bar." becomes "Launch a lesson from the Lessons menu in the top bar."
    - The warning callout becomes `{ kind: 'callout', tone: 'info', text: 'During a lesson the left column shows the lesson and the panel each step uses. To switch sections, exit the lesson first; your own scene comes back when you leave.' }`
  - **`scene-hierarchy`:** "sits at the top of the left sidebar in every section" becomes "sits near the top of the left column in every section".
  - **`saving-loading`:**
    - "Use the project actions in the top bar to manage your work." becomes "Use the File menu in the top bar to manage your work."
    - The definition terms become `'Save project file'`, `'Open project file'` and `'New workspace'`, with the same descriptions.

  **In `WelcomeCard.tsx`:**
  - the Build line becomes `The left column: pick a section, then create and edit scene objects.`
  - the Read line becomes `The right column: the generated OpenGL code and the math behind it.`

  The `—` in these strings is U+2014; keep it byte-exact and check with the node one-liner from Global Constraints.

- [ ] **Step 14: Delete the replaced files:** `src/widgets/layout/left-sidebar/`, `src/widgets/layout/right-sidebar/`, `src/features/lesson-engine/ui/LessonBar.tsx` and `lesson-bar.scss`. Then `grep -rn "left-sidebar\|right-sidebar\|LessonBar\|lesson-bar" src tests` must return nothing.

- [ ] **Step 15: Run the tests until they pass.**

Run: `npx vitest run tests/black-box/lesson-column.test.ts tests/black-box/editor-shell.test.ts tests/black-box/help-center.test.ts`
Expected: PASS.

- [ ] **Step 16: Check in a browser.** Run `npm run dev` and check the following, then stop the dev server you started:
- **At 1280 × 720,** in both themes:
  - each section through the section menu;
  - `/app?lesson=transforms-exercise-1`: the card, "Use this panel" and the Object Transform panel open;
  - `/app?lesson=pipeline-exercise-2`, then Next: the quiz fits in the column.
- **At 1000 × 720:** the Panels button toggles the drawer, a lesson opens the drawer, and Esc inside the drawer closes it.
- **The canvas** is at least 540 px wide at 1280.

- [ ] **Step 17: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/widgets/layout src/pages/editor src/features/object-transform/ui/ObjectTransformPanel.tsx src/features/text-nodes/ui/TextNodePanel.tsx src/features/custom-shapes/ui/CustomShapeBuilderPanel.tsx src/features/onboarding/ui/WelcomeCard.tsx src/features/help/model/help-content.ts src/features/lesson-engine/ui tests/black-box/lesson-column.test.ts tests/black-box/editor-shell.test.ts
git commit -m "feat(editor): three-column layout with a section column that becomes the lesson"
```

---
### Rules shared by Tasks 9–12 (panel migrations)

These rules apply to every panel touched in Tasks 9–12. Each task's table then lists that panel's exact changes.

1. **Keep `panelId`s and titles,** except the ruled Object Transform title from Task 8. Keep each panel's behaviour: its store actions, effects, the order of its controls, and its tooltips' meaning.
2. **Replace the panel's generic controls** with shared controls from `@/shared/ui/controls`:
   - plain `<button>`s become `Button`, and icon-only ones get `iconOnly` and a `label`;
   - number inputs become `NumberField`;
   - range inputs become `SliderField`;
   - colour inputs become `ColorField`;
   - on/off toggles become `Switch`;
   - radiogroups of 2–3 **short text** options become `SegmentedControl`;
   - text inputs become `TextField`, or stay native with the field classes `vfield-input` and `vfield-label` when they need live typing (for example a search box).
3. **Option groups whose options carry a title plus a hint line,** such as the Buffers mode cards, the usage cards and the animation motion cards, keep their bespoke markup, but must:
   - use `role="radiogroup"` with an `aria-label`, and `role="radio"` with `aria-checked` on each option;
   - use a roving `tabIndex` (0 on the checked option, -1 on the others);
   - respond to ←/→/↑/↓ (move and select, wrapping) and Home/End;
   - be restyled with the tokens (`--field-line`, `--field-bg`, `--live`, `--live-tint`, `--ink*`, `--hairline`).

   Copy `SegmentedControl`'s `onKeyDown` logic.
4. **Bespoke visual widgets keep their behaviour and are restyled with tokens only:**
   - the scale pad and rotate dial;
   - the stipple bit grid;
   - the UV canvas;
   - the pipeline visuals.

   Restyling covers colours, borders, radii and sizes; no hex colours.
5. **History.** Wherever a panel today calls `pushToHistory()` before a change, wire the new control's `onBeginChange={pushToHistory}`, and make `onChange` apply the value **without** pushing again. Where a panel uses `startBatch()`/`endBatch()` around colour picking, keep that around `onBeginChange`/`onCommit`. Scrubbing must create exactly one undo step per drag.
6. **GL hints.**
   - Add `GlHint` lines and `Panel` `hint`s exactly as each table says.
   - Before adding a hint, confirm with `grep -rn "<call>" src/features/code-generation/model` that the generator emits that call. If the generator's form differs, use the generator's form and update the table in spec §4.7 in the same commit.
   - Never add a hint for a call the generator doesn't emit.
7. **Delete each panel's now-unused SCSS rules,** and keep the layout rules. Bespoke class names (`bp-*`, `tx-*`, `lsp-*`, `anim-*`, `oep-*`) may stay on the bespoke widgets.
8. **Text.**
   - Existing student-facing text keeps its meaning.
   - New accessible names use sentence case, as given in the tables.
   - None of the forbidden words in Global Constraints may appear.
9. **Fit.** Each panel must fit the 300 px column (content width 276 px) with no horizontal scrollbar. Check in a browser at 1280 × 720 in both themes, then stop the dev server you started.

The `tests/black-box/editor-panels.test.ts` suite (BB-PANEL) starts in Task 9. Use the shared helpers, plus:

```ts
import { useVamsStore } from '@/core/store';
import { addPrimitive, addTriangle } from '../helpers/store';

function select(id: string) {
  useVamsStore.setState({ selectedObjectId: id });
}
function fieldNamed(host: HTMLElement, name: string) {
  return host.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement | null;
}
function hints(host: HTMLElement) {
  return [...host.querySelectorAll('.gl-hint, .vpanel__hint, .vcolor__gl')].map((el) => el.textContent);
}
function typeInto(input: HTMLInputElement, text: string) {
  input.dispatchEvent(new FocusEvent('focus'));
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new FocusEvent('blur'));
}
```

---

### Task 9: Migrate the Transforms panels and remove NumberInput

**Files:**
- Modify:
  - `src/features/object-transform/ui/ObjectTransformPanel.tsx` and `object-transform-panel.scss`;
  - `src/features/animation-preview/ui/AnimationPreviewPanel.tsx` and `animation-preview-panel.scss`;
  - `src/features/ortho-editor/ui/OrthoEditorPanel.tsx` and `ortho-editor-panel.scss`.
- Delete: `src/shared/ui/number-input/` (both users have moved)
- Test: `tests/black-box/editor-panels.test.ts` (new, BB-PANEL-01 to BB-PANEL-05)

**Interfaces:**
- Consumes: `NumberField`, `GlHint`, `Button` and `SegmentedControl` (Tasks 1–2), and `Panel` through `CollapsibleSection` (Task 4).

**Changes:**

| Panel | Control | Becomes |
| --- | --- | --- |
| Object Transform | header | `hint="glTranslatef · glRotatef · glScalef"` is **not** used. The header has no hint, and each group has its own `GlHint` |
| Object Transform | Position X / Y `NumberInput`s | A row labelled **"Translate"**, with `<GlHint call="glTranslatef" args="x, y, 0.0f" />` above it. Two `NumberField`s: `label="Translate X" tag="X" axis="x"` and `label="Translate Y" tag="Y" axis="y"`, `step={0.05}`, `precision={2}` |
| Object Transform | Rotate `NumberInput` | A row labelled **"Rotate"**, with `<GlHint call="glRotatef" args="angle, 0.0f, 0.0f, 1.0f" />` above it. One `NumberField`: `label="Rotate" tag="θ" step={1} precision={1} unit="°"` |
| Object Transform | Scale X / Y `NumberInput`s and the lock toggle | A row labelled **"Scale"**, with `<GlHint call="glScalef" args="sx, sy, 1.0f" />` above it. `NumberField`s: `label="Scale X" tag="X" axis="x"` and `label="Scale Y" tag="Y" axis="y"`, `step={0.05}`, `precision={2}`. The lock becomes `<Button variant="quiet" iconOnly label={lockScale ? 'Unlock scale X and Y' : 'Lock scale X and Y'} aria-pressed={lockScale} icon={…link icon…} />` |
| Object Transform | scale pad, rotate dial | Kept side by side (each about 128 px), restyled with tokens; same `onChange`/`onCommit` |
| Object Transform | matrix readout | Kept, in mono `--ink-muted` on `--paper-sunken` |
| Object Transform | Unit Scale, Reset | `Button variant="quiet"` with the same icons, labels and titles |
| Animation | header | `hint="glutIdleFunc"` |
| Animation | motion cards, speed options | Rule 3 (motion cards); speed becomes a `SegmentedControl label="Animation speed"` if its options are short text, otherwise rule 3 |
| Animation | save / remove buttons | `Button`: primary for save, danger for remove, same titles |
| Viewing Volume | header | `hint="glOrtho"` |
| Viewing Volume | Left / Right / Bottom / Top `NumberInput`s | `<GlHint call="glOrtho" args="left, right, bottom, top, -1.0, 1.0" />`, then four `NumberField`s with `label="Left"`, `"Right"`, `"Bottom"` and `"Top"` (tag = the same word), the same `step` and `precision` as today, in a 2 × 2 grid |
| Viewing Volume | reset | `Button variant="quiet"`, same title |

**Wiring for Object Transform.** It uses rule 5.

```tsx
// onBeginChange pushes history once; onChange applies without pushing.
<NumberField label="Translate X" tag="X" axis="x" value={transform.translateX} step={0.05} precision={2}
  onBeginChange={pushToHistory} onChange={(v) => liveUpdate({ translateX: v })} />
```

`handleScaleChange` becomes `applyScale(axis, value)`. It computes the locked ratio exactly as today, then calls `liveUpdate` instead of `commit`, and the scale fields pass `onBeginChange={pushToHistory}`. `commit` stays for the Unit Scale and Reset buttons.

- [ ] **Step 1: Write the failing tests.** Create `tests/black-box/editor-panels.test.ts` with the shared helpers and the panel helpers above, then:

```ts
/**
 * BLACK-BOX TEST SUITE — BB-PANEL
 * Editor panels rebuilt on the shared control set.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { h, render, type VNode } from 'preact';
import ObjectTransformPanel from '@/features/object-transform/ui/ObjectTransformPanel';
import OrthoEditorPanel from '@/features/ortho-editor/ui/OrthoEditorPanel';
// + useVamsStore, addTriangle, addPrimitive, and the helpers

function pointer(target: EventTarget, type: string, clientX: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, pointerId: 1 }));
}

describe('BB-PANEL-01: Object Transform names its rows and GL calls', () => {
  it('shows Translate, Rotate and Scale with their hints and named fields', () => {
    const tri = addTriangle();
    select(tri.id);
    const host = mount(h(ObjectTransformPanel, {}));
    expect(host.textContent).toContain('Translate');
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glTranslatef(x, y, 0.0f)', 'glRotatef(angle, 0.0f, 0.0f, 1.0f)', 'glScalef(sx, sy, 1.0f)',
    ]));
    for (const name of ['Translate X', 'Translate Y', 'Rotate', 'Scale X', 'Scale Y']) {
      expect(fieldNamed(host, name)).not.toBeNull();
    }
    unmount(host);
  });
});

describe('BB-PANEL-02: Typing a translation updates the object with one undo step', () => {
  it('commits on blur and pushes history once', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    typeInto(fieldNamed(host, 'Translate X')!, '0.5');
    await settle();
    const obj = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(obj.transform.translateX).toBe(0.5);
    expect(useVamsStore.getState().past).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-PANEL-03: Scrubbing Rotate is one undo step', () => {
  it('drags the θ tag and records a single history entry', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ past: [], future: [] });
    const host = mount(h(ObjectTransformPanel, {}));
    const field = fieldNamed(host, 'Rotate')!.closest('.vnum')!;
    const tag = field.querySelector('.vnum__tag')!;
    pointer(tag, 'pointerdown', 0);
    pointer(tag, 'pointermove', 20);
    pointer(tag, 'pointermove', 60);
    pointer(tag, 'pointerup', 60);
    await settle();
    const obj = useVamsStore.getState().objects.find((o) => o.id === tri.id)!;
    expect(obj.transform.rotate).toBe(15);
    expect(useVamsStore.getState().past).toHaveLength(1);
    unmount(host);
  });
});

describe('BB-PANEL-04: Viewing Volume edits glOrtho bounds', () => {
  it('names the four bounds and updates the viewport', async () => {
    const host = mount(h(OrthoEditorPanel, {}));
    const header = host.querySelector('.vpanel__header') as HTMLButtonElement;
    if (header.getAttribute('aria-expanded') === 'false') header.click();
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining(['glOrtho', 'glOrtho(left, right, bottom, top, -1.0, 1.0)']));
    for (const name of ['Left', 'Right', 'Bottom', 'Top']) expect(fieldNamed(host, name)).not.toBeNull();
    typeInto(fieldNamed(host, 'Right')!, '2');
    await settle();
    expect(useVamsStore.getState().viewportLimits.maxX).toBe(2);
    unmount(host);
  });
});

describe('BB-PANEL-05: The old NumberInput is gone', () => {
  it('has no file left', () => {
    expect(existsSync('src/shared/ui/number-input/NumberInput.tsx')).toBe(false);
  });
});
```

> BB-PANEL-03: with `step={1}` and the default 4 px per step, moving 60 px gives 15 steps, so 15°. The move to x = 20 crosses the 3 px threshold, which calls `onBeginChange` once. BB-PANEL-04: if the ortho panel validates bounds, for example requiring left < right, `2` is valid when Left is -1. If the panel's setter has a different name, the assertion still reads `viewportLimits.maxX`.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: FAIL, because the hints and fields don't exist yet.

- [ ] **Step 3: Make the changes in the table,** following the shared rules.

- [ ] **Step 4: Delete the old input.** Delete `src/shared/ui/number-input/`. Then `grep -rn "number-input\|NumberInput" src` must return nothing.

- [ ] **Step 5: Run the tests until they pass, then check in a browser.**
- Run `npx vitest run tests/black-box/editor-panels.test.ts` until it passes.
- Then open `/app?scene=transforms`, select Roof, scrub Rotate and press Ctrl+Z once: the whole drag undoes. Do this in both themes, then stop the dev server you started.

- [ ] **Step 6: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/object-transform src/features/animation-preview src/features/ortho-editor src/shared/ui/number-input tests/black-box/editor-panels.test.ts
git commit -m "feat(editor): rebuild the Transforms panels on the shared controls"
```

---

### Task 10: Migrate the Primitives panels

**Files:**
- Modify the `ui/*.tsx` and `.scss` files of:
  - `src/features/scene-hierarchy/`
  - `src/features/custom-shapes/`
  - `src/features/text-nodes/`
  - `src/features/object-appearance/`
  - `src/features/line-style/`
  - `src/features/callbacks/`
- Test: `tests/black-box/editor-panels.test.ts` (append BB-PANEL-06 to BB-PANEL-11)

**Changes:**

| Panel | Control | Becomes |
| --- | --- | --- |
| Scene Hierarchy | list | A tree: `<ul role="tree" aria-label="Scene objects">`, with each row an `<li role="treeitem" data-object-id aria-level aria-selected>` (and `aria-expanded` on groups). Group children sit in a nested `<ul role="group">`. Exactly one treeitem has `tabIndex={0}`: the selected one, or else the first; the others have -1. ↑ and ↓ move focus between visible rows, → and ← expand and collapse a group, Enter selects, F2 starts the existing rename. The existing window shortcut effect (line ~77) stays |
| Scene Hierarchy | Multi-select, Group and the row buttons (visibility, delete, …) | `Button` (quiet), with icon-only buttons labelled, e.g. `Hide Roof`, `Delete Roof` |
| Create Primitive (palette) | the 9 primitive buttons | A 3-column grid of 56 px tiles: icon over the `GL_*` label in mono 10.5 px. Each is a `<button type="button">` named by its visible label (no extra `aria-label`) |
| Create Primitive (building) | vertex rows (X/Y inputs and remove) | `<GlHint call="glVertex2f" args="x, y" />`, then a `DataTable` with `caption="Vertices"` and columns `#`, `X`, `Y` and an action column. The X and Y cells are `NumberField hideTag` with `label="Vertex {n} X"` / `"Vertex {n} Y"` (n from 0); the action cell is `Button variant="quiet" iconOnly label="Remove vertex {n}"` |
| Create Primitive (building) | finish, undo, cancel buttons | `Button`: primary for finish, the others secondary or quiet, same text |
| Create Text | input and add | A `TextField`-style native input (live typing) with `aria-label="Text"`, plus `Button iconOnly label="Add text"` |
| Create Text | edit textarea | Keep the native `<textarea>` with the field classes and `aria-label="Edit text"` |
| Appearance: Scene Color | background colour | `<ColorField label="Background" glCall="glClearColor" …>`, wired to `setCanvasBackgroundColor` |
| Appearance: Color & Shading | emission toggle | `<SegmentedControl label="Color emission" mono options={[{value:'3f', label:'glColor3f', title:'Emit colors as glColor3f (normalized 0.0–1.0)'}, {value:'3ub', label:'glColor3ub', title:'Emit colors as glColor3ub (integer 0–255)'}]} …>`. Map `value` to the store's existing emission values, and keep the titles' text exactly |
| Appearance: Color & Shading | uniform or per-vertex mode | `<SegmentedControl label="Color application mode" options={[{value: <uniform>, label: 'Uniform'}, {value: <per-vertex>, label: 'Per vertex'}]} …>`, using the store's existing values and the existing titles |
| Appearance: Color & Shading | fill colour | `<ColorField label="Fill" glCall={emission === 3ub ? 'glColor3ub' : 'glColor3f'} …>` |
| Appearance: Color & Shading | each vertex colour | `<ColorField label={`Vertex ${idx}`} showRecent={false} glCall={…same…} …>`. The vertex-focus behaviour stays: the old `onFocus={() => handleVertexColorStart(vertex.id)}` moves to `onBeginChange` |
| Appearance: Color & Shading | Quick Gradients | `Button variant="quiet"`, same labels |
| Line Style | header | `hint="glLineStipple"` |
| Line Style | width range | `<GlHint call="glLineWidth" args="width" />`, then `<SliderField label="Line width" min={0.5} max={12} step={0.5} precision={1} unit="px" …>` |
| Line Style | stipple master toggle | `<Switch label="Line stipple" …>`, with `<GlHint call="glEnable" args="GL_LINE_STIPPLE" />` beside it |
| Line Style | pattern, factor, bit grid | `<GlHint call="glLineStipple" args="factor, pattern" />`. Factor becomes `<SliderField label="Stipple factor" min={1} max={16} step={1} precision={0} …>`. The pattern hex input keeps `aria-label="Pattern hexadecimal"` with the field classes. The bit grid stays (rule 4) |
| Callbacks | each handler row | Above the row's input: `<GlHint call="glutKeyboardFunc" args="handler" />`, `glutMouseFunc`, `glutReshapeFunc`, `glutMotionFunc` or `glutIdleFunc`, matching the row's callback kind. The handler inputs keep native typing with the field classes, and each is labelled `{Kind} handler`, e.g. `Keyboard handler`. Row buttons become `Button` |

- [ ] **Step 1: Append the failing tests.** Import `SceneHierarchyPanel`, `CustomShapeBuilderPanel`, `ObjectAppearancePanel`, `LineStylePanel` and `CallbacksPanel` from their `ui/` files.

```ts
describe('BB-PANEL-06: Scene Hierarchy is a keyboard-navigable tree', () => {
  it('uses tree semantics, moves with arrows and selects with Enter', async () => {
    const a = addTriangle(-0.5, 0);
    const b = addTriangle(0.5, 0);
    select(a.id);
    const host = mount(h(SceneHierarchyPanel, {}));
    await settle();
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    const items = [...host.querySelectorAll('[role="treeitem"]')] as HTMLElement[];
    expect(items).toHaveLength(2);
    expect(items.map((el) => el.dataset.objectId).sort()).toEqual([a.id, b.id].sort());
    const selected = items.find((el) => el.getAttribute('aria-selected') === 'true')!;
    expect(selected.dataset.objectId).toBe(a.id);
    expect(selected.getAttribute('tabindex')).toBe('0');
    items[0].focus();
    key(items[0], 'ArrowDown');
    await settle();
    expect(document.activeElement).toBe(items[1]);
    key(items[1], 'Enter');
    await settle();
    expect(useVamsStore.getState().selectedObjectId).toBe(items[1].dataset.objectId);
    unmount(host);
  });
});

describe('BB-PANEL-07: The primitive palette names every primitive and starts placement', () => {
  it('lists the GL primitives and shows the vertex table hint while building', async () => {
    const host = mount(h(CustomShapeBuilderPanel, {}));
    const labels = [...host.querySelectorAll('button')].map((b) => b.textContent?.trim());
    for (const name of ['GL_POINTS', 'GL_LINES', 'GL_LINE_STRIP', 'GL_LINE_LOOP', 'GL_TRIANGLES', 'GL_TRIANGLE_STRIP', 'GL_TRIANGLE_FAN', 'GL_QUADS', 'GL_POLYGON']) {
      expect(labels).toContain(name);
    }
    ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'GL_TRIANGLES') as HTMLButtonElement).click();
    await settle();
    expect(useVamsStore.getState().pendingShapeType).toBe('TRIANGLES');
    expect(hints(host)).toContain('glVertex2f(x, y)');
    unmount(host);
  });
});

describe('BB-PANEL-08: Appearance shows the colour values GL receives', () => {
  it('background reads glClearColor and fill follows the emission mode', async () => {
    useVamsStore.setState({ activeSection: 'Primitives' });
    let host = mount(h(ObjectAppearancePanel, {}));
    expect(hints(host)).toContain('glClearColor(0.00, 0.00, 0.00, 1.0)');
    unmount(host);
    const tri = addTriangle();
    select(tri.id);
    host = mount(h(ObjectAppearancePanel, {}));
    await settle();
    const fill = host.querySelector('input[aria-label="Fill hex value"]');
    expect(fill).not.toBeNull();
    expect(hints(host).some((t) => t?.startsWith('glColor3f('))).toBe(true);
    const emission = host.querySelector('[role="radiogroup"][aria-label="Color emission"]')!;
    ([...emission.querySelectorAll('[role="radio"]')].find((r) => r.textContent === 'glColor3ub') as HTMLButtonElement).click();
    await settle();
    expect(hints(host).some((t) => t?.startsWith('glColor3ub('))).toBe(true);
    unmount(host);
  });
});

describe('BB-PANEL-09: Line Style pairs width with an exact number and names stipple calls', () => {
  it('shows the slider, the switch and the glLineStipple hints', async () => {
    const line = addPrimitive('LINES', [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }]);
    select(line.id);
    const host = mount(h(LineStylePanel, {}));
    await settle();
    expect(host.querySelector('input[type="range"]')).not.toBeNull();
    expect(fieldNamed(host, 'Line width, exact value')).not.toBeNull();
    expect(hints(host)).toEqual(expect.arrayContaining(['glLineStipple', 'glLineWidth(width)']));
    const sw = host.querySelector('[role="switch"]') as HTMLButtonElement;
    expect(sw.textContent).toContain('Line stipple');
    const before = sw.getAttribute('aria-checked');
    sw.click();
    await settle();
    expect((host.querySelector('[role="switch"]') as HTMLElement).getAttribute('aria-checked')).not.toBe(before);
    unmount(host);
  });
});

describe('BB-PANEL-10: Callbacks name their GLUT registration', () => {
  it('shows one glut*Func hint per handler kind', async () => {
    const host = mount(h(CallbacksPanel, {}));
    (host.querySelector('.vpanel__header') as HTMLButtonElement).click();
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glutKeyboardFunc(handler)', 'glutMouseFunc(handler)', 'glutReshapeFunc(handler)', 'glutMotionFunc(handler)', 'glutIdleFunc(handler)',
    ]));
    unmount(host);
  });
});

describe('BB-PANEL-11: Every Primitives-section control has a name', () => {
  it('has no unnamed button or input', async () => {
    const tri = addTriangle();
    select(tri.id);
    for (const Component of [SceneHierarchyPanel, CustomShapeBuilderPanel, ObjectAppearancePanel, CallbacksPanel]) {
      const host = mount(h(Component, {}));
      await settle();
      const unnamed = [...host.querySelectorAll('button, input, textarea')].filter((el) => {
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent?.trim()
          || (el.id && host.querySelector(`label[for="${el.id}"]`));
        return !named && el.getAttribute('aria-hidden') !== 'true' && !(el as HTMLInputElement).hidden;
      });
      expect(unnamed.map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
      unmount(host);
    }
  });
});
```

> **BB-PANEL-06.** Each treeitem carries `data-object-id={object.id}`; add it as part of the tree markup.
>
> **BB-PANEL-07.** If clicking a primitive with an empty canvas doesn't set `pendingShapeType` directly, for example because it opens a vertex-count prompt, follow the panel's real flow and assert that the building view appears.
>
> **BB-PANEL-08.** The emission radio's visible text is `glColor3ub`.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: the BB-PANEL-06 to BB-PANEL-11 tests fail.

- [ ] **Step 3: Make the changes in the table,** following the shared rules. For Scene Hierarchy, keep drag-to-reorder, rename, grouping and visibility exactly as they work today. Only the elements, their roles and the keyboard handling change.

- [ ] **Step 4: Run the tests until they pass, then check in a browser.** In the Primitives section, in both themes, check each panel:
- the palette grid fits;
- building a triangle shows the vertex table;
- colour picking and hex entry work, and undo reverts a whole picking session;
- line width and stipple update the canvas and the code.

Stop the dev server you started.

- [ ] **Step 5: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/scene-hierarchy src/features/custom-shapes src/features/text-nodes src/features/object-appearance src/features/line-style src/features/callbacks tests/black-box/editor-panels.test.ts
git commit -m "feat(editor): rebuild the Primitives panels on the shared controls"
```

---

### Task 11: Migrate the Pipeline, Buffers and Textures panels

**Files:**
- Modify the `ui/*.tsx` and `.scss` files of:
  - `src/features/pipeline-controls/`
  - `src/features/buffers/`
  - `src/features/textures/` (`TextureLibraryPanel`, `TextureAttachmentPanel`, `UVEditorPanel` and `textures-panels.scss`)
- Test: `tests/black-box/editor-panels.test.ts` (append BB-PANEL-12 to BB-PANEL-15)

**Changes:**

| Panel | Control | Becomes |
| --- | --- | --- |
| Viewport Mode | the three mode buttons | Rule 3 radiogroup with `aria-label="Viewport mode"`: three stacked options, each an icon plus its label ("Coordinate Playground", "Pipeline Diagram", "Raster vs. Vector"), 36 px tall, using arrow keys |
| Memory & Buffers | header | `hint="glVertexPointer"` |
| Memory & Buffers | rendering-mode cards | Rule 3, `aria-label="Rendering mode"` stays. Under the cards, a `GlHint` for the checked mode: immediate → `<GlHint call="glBegin" args="mode" />`; vertex array → `<GlHint call="glVertexPointer" args="2, GL_FLOAT, 0, verts" />`; VBO → `<GlHint call="glBufferData" args="GL_ARRAY_BUFFER, size, data, usage" />`. Use the store's existing mode values |
| Memory & Buffers | usage-hint cards | Rule 3, `aria-label="Buffer usage hint"` stays. The existing macro readout (`bp-block-hint`) stays |
| Memory & Buffers | update-method cards | Rule 3, `aria-label="Buffer update method"` stays. Add a `GlHint` for the checked method, `glBufferSubData` or `glMapBuffer`, with the arguments the generator emits |
| Memory & Buffers | other buttons | `Button` |
| Texture Library | upload | `Button` labelled as today. The hidden file input stays |
| Texture Library | remove on each texture | `Button variant="quiet" iconOnly label={`Remove ${texture.name}`}` |
| Apply Texture | header | `hint="glBindTexture"` |
| Apply Texture | attach and detach buttons | `Button` |
| Apply Texture | filter toggle | `<GlHint call="glTexParameteri" args="GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter" />`, then `<SegmentedControl label="Filter mode" mono options={[{value: <nearest>, label: 'GL_NEAREST', title: 'Nearest-neighbour sampling — blocky on zoom'}, {value: <linear>, label: 'GL_LINEAR', title: 'Bilinear sampling — smooth on zoom'}]} …>` |
| Apply Texture | wrap toggle | `<GlHint call="glTexParameteri" args="GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap" />`, then `<SegmentedControl label="Wrap mode" mono options={[{value: <repeat>, label: 'GL_REPEAT', title: 'Tile the texture beyond [0,1]'}, {value: <clamp>, label: 'GL_CLAMP_TO_EDGE', title: 'Stretch the edge pixels beyond [0,1]'}]} …>` |
| UV Editor | header | `hint="glTexCoord2f"` |
| UV Editor | recenter and reset buttons | `Button variant="quiet"`, same titles. Icon-only ones get `label` equal to the title |
| UV Editor | numeric UV rows, if the panel shows any | `DataTable` with `caption="Texture coordinates"`, with `NumberField hideTag` cells labelled `Vertex {n} U` / `Vertex {n} V`, `step={0.01}`, `precision={2}` |
| UV Editor | the UV canvas | Rule 4 |

The `—` in the filter titles is U+2014; keep the existing titles byte-exact.

- [ ] **Step 1: Append the failing tests.** Import `PipelineModeControls`, `BuffersPanel`, `TextureLibraryPanel` and `TextureAttachmentPanel`, plus `getPreset` from `@/entities/project/model/scene-presets` and `loadProjectData` from `@/features/scene-library`.

```ts
function loadTexturedQuad() {
  loadProjectData(getPreset('textured-quad')!.data);
  const quad = useVamsStore.getState().objects[0];
  select(quad.id);
  return quad;
}

describe('BB-PANEL-12: Viewport mode is an arrow-key radiogroup', () => {
  it('moves the mode with ArrowDown', async () => {
    useVamsStore.setState({ activeSection: 'Pipeline', pipelineMode: 'Playground' });
    const host = mount(h(PipelineModeControls, {}));
    const group = host.querySelector('[role="radiogroup"][aria-label="Viewport mode"]')!;
    const radios = group.querySelectorAll('[role="radio"]');
    expect([...radios].map((r) => r.textContent?.trim())).toEqual(['Coordinate Playground', 'Pipeline Diagram', 'Raster vs. Vector']);
    key(radios[0], 'ArrowDown');
    await settle();
    expect(useVamsStore.getState().pipelineMode).toBe('Diagram');
    unmount(host);
  });
});

describe('BB-PANEL-13: Buffers names its GL calls and keeps keyboard radiogroups', () => {
  it('shows the header hint and moves the rendering mode with arrows', async () => {
    const tri = addTriangle();
    select(tri.id);
    useVamsStore.setState({ activeSection: 'Buffers' });
    const host = mount(h(BuffersPanel, {}));
    await settle();
    expect(hints(host)).toContain('glVertexPointer');
    const group = host.querySelector('[role="radiogroup"][aria-label="Rendering mode"]')!;
    const radios = [...group.querySelectorAll('[role="radio"]')] as HTMLElement[];
    const checkedBefore = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    expect(radios[checkedBefore].getAttribute('tabindex')).toBe('0');
    key(radios[checkedBefore], 'ArrowRight');
    await settle();
    const after = [...host.querySelectorAll('[role="radiogroup"][aria-label="Rendering mode"] [role="radio"]')];
    expect(after.findIndex((r) => r.getAttribute('aria-checked') === 'true')).toBe((checkedBefore + 1) % radios.length);
    unmount(host);
  });
});

describe('BB-PANEL-14: Apply Texture uses GL constant segmented controls', () => {
  it('shows filter and wrap with their glTexParameteri hints', async () => {
    loadTexturedQuad();
    useVamsStore.setState({ activeSection: 'Textures' });
    const host = mount(h(TextureAttachmentPanel, {}));
    await settle();
    expect(hints(host)).toEqual(expect.arrayContaining([
      'glBindTexture',
      'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter)',
      'glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrap)',
    ]));
    const filter = host.querySelector('[role="radiogroup"][aria-label="Filter mode"]')!;
    expect([...filter.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['GL_NEAREST', 'GL_LINEAR']);
    ([...filter.querySelectorAll('[role="radio"]')][1] as HTMLButtonElement).click();
    await settle();
    const linear = [...host.querySelectorAll('[role="radiogroup"][aria-label="Filter mode"] [role="radio"]')][1];
    expect(linear.getAttribute('aria-checked')).toBe('true');
    const wrap = host.querySelector('[role="radiogroup"][aria-label="Wrap mode"]')!;
    expect([...wrap.querySelectorAll('[role="radio"]')].map((r) => r.textContent)).toEqual(['GL_REPEAT', 'GL_CLAMP_TO_EDGE']);
    unmount(host);
  });
});

describe('BB-PANEL-15: Texture Library remove buttons name their texture', () => {
  it('labels each remove button with the texture name', async () => {
    useVamsStore.setState({ uploadedTextures: [{ id: 'tex-1', name: 'Bricks', isSample: false, dataUrl: 'data:image/png;base64,', width: 4, height: 4 }] });
    const host = mount(h(TextureLibraryPanel, {}));
    await settle();
    expect(host.querySelector('button[aria-label="Remove Bricks"]')).not.toBeNull();
    unmount(host);
  });
});
```

> **BB-PANEL-12.** The rule 3 radiogroup selects on arrow keys, and the radios' visible text is the label alone, since the icons are `aria-hidden`.
>
> **BB-PANEL-14.** If the textured-quad preset's quad has no attached texture in the store shape the panel reads, attach `sample-bricks` with the panel's own store action before mounting.
>
> **BB-PANEL-15.** If the library panel shows only uploads in a sub-list, the sample textures from `tests/setup.ts` may also render. That's fine: only the Bricks button is asserted.

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-panels.test.ts`
Expected: the BB-PANEL-12 to BB-PANEL-15 tests fail.

- [ ] **Step 3: Make the changes in the table,** following the shared rules.

- [ ] **Step 4: Run the tests until they pass, then check in a browser.**
- Run the panel tests until they pass.
- In a browser, check:
  - Pipeline: all three viewport modes;
  - Buffers: each rendering mode and usage;
  - Textures: `/app?scene=textured-quad`, switching filter and wrap changes the canvas and the code;
  - both themes.
- Stop the dev server you started.

- [ ] **Step 5: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/features/pipeline-controls src/features/buffers src/features/textures tests/black-box/editor-panels.test.ts
git commit -m "feat(editor): rebuild the Pipeline, Buffers and Textures panels on the shared controls"
```

---

### Task 12: Restyle the canvas overlays, code panel and math panel

**Files:**
- Modify:
  - `src/widgets/canvas/ui/CanvasOverlays.tsx` and `src/widgets/canvas/vams-canvas.scss`;
  - `src/features/animation-preview/ui/AnimationCodeOverlay.tsx` and its scss;
  - `src/features/code-generation/ui/SceneCodePanel.tsx`, `src/shared/ui/code-viewer/CodeViewer.tsx` and their scss;
  - `src/features/math-panel/ui/MathPanel.tsx` and `src/features/math-panel/ui/_math-layout.scss`.
- Test: `tests/black-box/editor-shell.test.ts` (append BB-SHELL-16 and BB-SHELL-17)

**Changes. The only change is style;** behaviour and text stay as they are.

- **Canvas overlays:**
  - The viewport chip, coordinate tracker, placement banner and empty-canvas hint use mono 11 px text on a plate of `rgba(14, 26, 52, 0.85)` with a 1 px border of `rgba(186, 214, 255, 0.24)` and radius `--radius-s`, in both themes, because the canvas is dark in both.
  - **Exception for that plate:** the plate sits on the GL canvas, not the page, so it is the one place outside the tokens where a fixed dark plate is allowed. Put these two values in `_tokens.scss` as `--canvas-plate` and `--canvas-plate-line`, defined identically in both themes.
  - The tracker's X and Y labels use `--channel-r` and `--channel-g` as in Task 2, but on the plate use the blueprint values (`#f87171`, `#4ade80`) through two more plate tokens, `--canvas-x` and `--canvas-y`.
  - The empty hint's button becomes `Button variant="primary"`.
  - In the narrow layout, `.editor--narrow .viewport-info` moves to `left: 104px`, so it sits after the Panels button.
- **Code panel:**
  - The header is a 32 px row with mono uppercase "C++", then mono `--ink-faint` "· OpenGL 1.5 · N lines". The UPDATED badge uses `--code-changed-*`, keeping today's text.
  - Copy and Search become `Button variant="quiet"`, with labels and titles unchanged.
  - Code text is Chivo Mono 12.5 px, line height 20 px, with line numbers in `--ink-faint`. Changed lines keep today's amber tint and left bar.
  - Long lines scroll horizontally inside the code body only.
- **Math panel:**
  - The header is the same 32 px mono row ("MATH & DATA" plus the existing section pill).
  - Inner cards use `--paper-raised` with a `--hairline` border and `--radius-m`.
  - Matrices and equations stay as they are, with colours from the existing pedagogical tokens.
  - The existing math `lesson-focused` highlight changes to `--live` and `--live-tint`.

- [ ] **Step 1: Append the failing tests:**

```ts
import { CanvasOverlays } from '@/widgets/canvas/ui/CanvasOverlays';

describe('BB-SHELL-16: Canvas overlays keep their text and actions', () => {
  it('shows the viewport, the placement banner and the empty hint', async () => {
    useVamsStore.setState({ activeSection: 'Transforms' });
    const host = mount(h(CanvasOverlays, {
      viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      interactionMode: 'SELECT',
      coordinates: { x: 0.42, y: -0.13 },
      showCoordinateTracker: true,
      showEmptyHint: true,
    }));
    expect(host.querySelector('.viewport-info')!.textContent).toBe('Viewport: (-1, 1)');
    expect(host.querySelector('.coordinate-tracker')!.textContent).toContain('0.42');
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Add your first shape')) as HTMLButtonElement;
    expect(add.className).toContain('vbtn--primary');
    add.click();
    expect(useVamsStore.getState().activeSection).toBe('Primitives');
    render(h(CanvasOverlays, {
      viewportLimits: { minX: -1, maxX: 1, minY: -1, maxY: 1 },
      interactionMode: 'VERTEX_PLACE',
      coordinates: { x: 0, y: 0 },
      showCoordinateTracker: false,
    }), host);
    expect(host.querySelector('.placement-mode-banner')!.textContent).toContain('click to place');
    unmount(host);
  });
});

describe('BB-SHELL-17: The canvas plate tokens exist in both themes', () => {
  it('declares the plate tokens identically for vellum and blueprint', async () => {
    const { readFileSync } = await import('node:fs');
    const scss = readFileSync('src/shared/styles/_tokens.scss', 'utf8');
    for (const token of ['--canvas-plate', '--canvas-plate-line', '--canvas-x', '--canvas-y']) {
      expect(scss.split(`${token}:`).length - 1).toBe(2);
    }
  });
});
```

- [ ] **Step 2: Run them and see them fail.**

Run: `npx vitest run tests/black-box/editor-shell.test.ts`
Expected: BB-SHELL-16 fails on `vbtn--primary`, and BB-SHELL-17 fails on the missing tokens.

- [ ] **Step 3: Make the changes.** Add the four plate tokens to both theme blocks in `_tokens.scss`, then restyle as described.

- [ ] **Step 4: Run the tests until they pass, then check in a browser.**
- At 1280 × 720 and 1000 × 720, in both themes, check the overlays on the canvas, a long code line scrolling sideways inside the code panel, and the math cards.
- Run Lighthouse accessibility on `/app?scene=transforms`. The score must be at least the pre-SP5 score; run the same audit on `main` first to get it.
- Note both scores in your report.
- Stop the dev server or preview you started.

- [ ] **Step 5: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git add src/shared/styles/_tokens.scss src/widgets/canvas src/features/animation-preview src/features/code-generation/ui src/shared/ui/code-viewer src/features/math-panel/ui tests/black-box/editor-shell.test.ts
git commit -m "style(editor): restyle the canvas overlays, code panel and math panel"
```

---

### Task 13: Screenshot regression checks and documentation

**Files:**
- Create: `playwright.config.ts`, `tests/visual/editor.spec.ts`
- Modify:
  - `package.json`: add the `test:visual` script and the `@playwright/test` devDependency;
  - `tests/README.md`;
  - `docs/specs/2026-10-04-website-overhaul-roadmap.md`;
  - `tsconfig.node.json`, if it lists config files, so `playwright.config.ts` type-checks.

- [ ] **Step 1: Install Playwright.**

```bash
npm install --save-dev @playwright/test
```

Don't run `npx playwright install`. The config uses the installed Chrome (`channel: 'chrome'`).

- [ ] **Step 2: Create `playwright.config.ts`:**

```ts
import { defineConfig } from '@playwright/test';

/**
 * Screenshot regression checks for the editor (`npm run test:visual`).
 * Baselines are per machine and live in tests/visual/baseline.local (ignored by *.local).
 * Create them with `npx playwright test --update-snapshots`.
 */
export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/baseline.local/{arg}{ext}',
  outputDir: 'tests/visual/results.local',
  reporter: 'list',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4319',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
    colorScheme: 'light',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4319 --strictPort',
    url: 'http://localhost:4319',
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
```

- [ ] **Step 3: Create `tests/visual/editor.spec.ts`:**

```ts
/**
 * VISUAL TEST SUITE — VIS-EDITOR
 * Screenshot regression checks for the editor layout. Not part of `npm test`.
 */
import { test, expect, type Page } from '@playwright/test';

type Theme = 'vellum' | 'blueprint';

async function open(page: Page, path: string, theme: Theme = 'vellum') {
  await page.addInitScript((t) => {
    window.localStorage.setItem('vams-theme', t);
  }, theme);
  await page.goto(path);
  await page.waitForSelector('.editor');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

test('VIS-EDITOR-01: Transforms scene, vellum, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('transforms-vellum-1280.png');
});

test('VIS-EDITOR-02: Transforms scene, blueprint, 1280', async ({ page }) => {
  await open(page, '/app?scene=transforms', 'blueprint');
  await expect(page).toHaveScreenshot('transforms-blueprint-1280.png');
});

test('VIS-EDITOR-03: Primitives tour, 1280', async ({ page }) => {
  await open(page, '/app?scene=primitives');
  await expect(page).toHaveScreenshot('primitives-1280.png');
});

test('VIS-EDITOR-04: Textured quad, 1280', async ({ page }) => {
  await open(page, '/app?scene=textured-quad');
  await expect(page).toHaveScreenshot('textured-quad-1280.png');
});

test('VIS-EDITOR-05: Lesson column, vellum and blueprint', async ({ page }) => {
  await open(page, '/app?lesson=transforms-exercise-1');
  await expect(page).toHaveScreenshot('lesson-vellum-1280.png');
  await open(page, '/app?lesson=transforms-exercise-1', 'blueprint');
  await expect(page).toHaveScreenshot('lesson-blueprint-1280.png');
});

test('VIS-EDITOR-06: Lesson quiz step', async ({ page }) => {
  await open(page, '/app?lesson=pipeline-exercise-2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page).toHaveScreenshot('lesson-quiz-1280.png');
});

test('VIS-EDITOR-07: Narrow layout, drawer closed and open', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 720 });
  await open(page, '/app?scene=transforms');
  await expect(page).toHaveScreenshot('narrow-closed-960.png');
  await page.getByRole('button', { name: 'Panels' }).click();
  await expect(page).toHaveScreenshot('narrow-open-960.png');
});

test('VIS-EDITOR-08: Menus and the My scenes dialog', async ({ page }) => {
  await open(page, '/app?scene=transforms');
  await page.getByRole('button', { name: 'File' }).click();
  await expect(page).toHaveScreenshot('file-menu.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Transforms' }).click();
  await expect(page).toHaveScreenshot('section-menu.png');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'File' }).click();
  await page.getByRole('menuitem', { name: 'My scenes…' }).click();
  await expect(page).toHaveScreenshot('my-scenes.png');
});
```

> Scene links mark the welcome card as seen, so no seeding is needed for it. `vams-theme` is `THEME_STORAGE_KEY` in `src/shared/lib/theme/theme.ts`. The `…` in `My scenes…` is U+2026.

- [ ] **Step 4: Add the script** to `package.json` under `scripts`: `"test:visual": "playwright test"`.

- [ ] **Step 5: Create a baseline and confirm the checks pass on this machine.**

```bash
npx playwright test --update-snapshots
npx playwright test
```

Expected:
- the first run writes the PNGs to `tests/visual/baseline.local/`;
- the second run passes;
- `git status --short` shows no files under `tests/visual/baseline.local` or `tests/visual/results.local`, because the existing `*.local` pattern ignores them.

If Chrome isn't installed on this machine, report BLOCKED with the error. Don't download browsers.

- [ ] **Step 6: Update `tests/README.md`.** Add rows for BB-CTRL (`tests/black-box/controls.test.ts`, the shared control set), BB-SHELL (`editor-shell.test.ts`, the editor shell: dialogs, menus, the top bar, the section column and overlays), BB-LCOL (`lesson-column.test.ts`, the lesson card, the runner and panel focus), BB-PANEL (`editor-panels.test.ts`, the panels on the shared controls) and VIS-EDITOR (`tests/visual/editor.spec.ts`, screenshot checks run with `npm run test:visual`, with per-machine baselines that are not committed). Follow the file's existing table format.

- [ ] **Step 7: Update the roadmap** (`docs/specs/2026-10-04-website-overhaul-roadmap.md`):
- Item 4's status becomes `Complete (<today's date>): [spec](2026-10-06-editor-redesign-design.md), [plan](../plans/2026-10-06-editor-redesign.md)`.
- Item 10 (screenshot regression checks) becomes "Done with SP5 (`npm run test:visual`)".
- Under "Known issues carried forward", remove the Undo/Redo, NumberInput and Lighthouse bullets that SP5 fixed. Keep the Pixi shader warning.
- Add these rehearsal bullets:
  - "Pick the browser zoom on the projector; the editor holds together from 1280 down to 960 CSS px wide."
  - "Run `npm run test:visual` on the demo machine after the last change, against a baseline taken right after SP5."
- Replace divergence 8 with: "8. SP5 renames one panel title, "Position, Rotation, & Scale" to "Object Transform", to match the lesson narration, and wires two `focusPanel` targets (`object-transform`, `text-node-panel`) that never matched a panel. The narration that names screen positions stays true in the new layout."
- Add divergence 10: "10. §3.4.2's five layout regions and its top-bar actions. The lesson bar becomes a lesson card at the top of the section column, the section tabs become a menu at the top of that column, and the file actions move into a File menu in the top bar (SP5)."
- Remove "§3.4.2's five layout regions and the top bar's actions" and "`focusPanel` targeting in Algorithm 3" from the "may also be crossed" list.

- [ ] **Step 8: Run every check, then commit.**

```bash
npm run lint && npm run build && npm test
git checkout -- tests/reports
git status --short
git add playwright.config.ts tests/visual/editor.spec.ts package.json package-lock.json tests/README.md docs/specs/2026-10-04-website-overhaul-roadmap.md
git commit -m "test(visual): add editor screenshot checks and record SP5 in the roadmap"
```

If you changed `tsconfig.node.json`, stage it too.
