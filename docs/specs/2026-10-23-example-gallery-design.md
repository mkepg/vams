# Example gallery

## Purpose

Roadmap Should item 9. At the CS Expo the presenter opens a striking scene in one click, presses Run, and shows the expert audience that VAMS produces real programs: the scene moves and answers keys and the mouse, and the code panel shows the C++ that draws it. Students get the same page afterwards, as finished scenes to open and take apart.

## Decisions

- **For the stage first.** A few rich scenes that run, not one plain scene per section. Each scene is labelled with the sections it draws on, so the gallery as a whole still shows how far the course goes.
- **The jeepney street leads.** The poster and AVP street is the first and largest card.
- **A site page.** The gallery is a new page, `/gallery`, in the header as Home | Learn | Gallery | About and in the footer. Slide 07 ("Try it") links to it beside its "Start from" scenes.
- **Opening a scene** uses the existing prepared-scene link, `/app?scene=<slug>`: the current scene is backed up to My scenes, the gallery scene loads, and its section becomes current. Run is not started automatically; the presenter presses Run.
- **The four starter scenes stay.** Triangle, Transforms, Primitives tour and Textured quad keep their place in the Add panel and on slide 07. Gallery scenes are a separate list and do not appear in the Add panel.

## The scenes

All five use a 16:9 viewing volume, x −1.6 to 1.6 and y −0.9 to 0.9, so the program window and the card images share a shape. They use only what the editor can build and edit: the primitive types, groups, bitmap text, the sample textures plus uploaded ones, and rules with whole-degree rotations. A scene opened from the gallery can be changed in every field without the editor rewriting a value.

| Slug | Title | Shows | Opens in | In Run |
| --- | --- | --- | --- | --- |
| `jeepney-street` | Jeepney street | Primitives, Transforms, Textures | Primitives | Idle drives the jeepney and turns its wheels; Space brings it back |
| `solar-system` | Solar system | Transforms, Buffers | Transforms | Idle turns each orbit, so the Moon circles Earth while Earth circles the Sun; Space resets |
| `parol` | Parol at night | Primitives | Primitives | 1, 2 and 3 change the star's colour; a left click turns its glow on and off |
| `clock` | Analogue clock | Transforms, Primitives | Transforms | Idle sweeps the second hand; M and H move the minute and hour hands; Space resets |
| `pixel-fox` | Fox in the clouds | Textures, Buffers | Textures | The arrow keys steer the fox; Space brings it home; the view keeps its proportions when the window is resized |

- **Jeepney street:** the AVP street in its finished state. Night sky with stars and moon, walk-ups with lit windows, the sari-sari store with its painted sign as an uploaded texture, poles, wire, four parols, street lamp, road with a stippled lane line, and the jeepney group with its route text and two wheel groups. Idle translates the jeep by 0.01 a frame and turns each wheel by −6°; Space resets the jeep and both wheels.
- **Solar system:** a Sun, Earth with its Moon, and Mars, built as nested groups so each orbit is a rotation of the group that holds the planet: Earth's orbit 2° a frame, Mars's 1°, the Moon's 8°. Orbit paths are stippled line loops. The starfield is a GL_POINTS object drawn from a VBO.
- **Parol at night:** one large parol: a star of triangle fans with a line-loop outline, an inner ring, and tails of lines, over a starry sky of points. A glow, a smooth fan that fades to the sky colour, sits behind the star. Keys 1, 2 and 3 set the star's colour to red, gold and teal; the left button going down toggles the glow.
- **Analogue clock:** a face, a rim, minute and hour tick marks (lines), the numbers 12, 3, 6 and 9 as bitmap text, and three hands whose vertices run out from the centre, so each turns about its own origin. It opens at ten past ten. Idle turns the second hand by −1° a frame; M turns the minute hand by −6° and H the hour hand by −30°; Space resets all three.
- **Fox in the clouds:** a ground quad tiled with an uploaded cloud texture (GL_REPEAT, drawn from a vertex array) and the Pixel fox sample on a quad drawn from a VBO, both Nearest. The cloud tile's sky is the fox texture's background colour, so the fox's square does not show. The arrow keys translate the fox by 0.05; Space resets it; Reshape keeps proportions.

## The page

- **Intro:** the title "Gallery" and one line on what the scenes are and how to open one.
- **Cards:** the jeepney street as a wide card, then the other four in a grid (two columns from 720 px, one below). Each card has the scene's image, its title, one sentence about it, the sections it shows, what to try in Run, and an "Open in the editor" link. The image is a link to the same place.
- **Images:** a still of each scene's program window, captured from the real editor, committed as PNG under `public/gallery/`. They are final assets.
- The page is prerendered with its own title and description, is indexable, appears in the sitemap and works offline like the other pages.
- It follows the site's tokens in both themes, meets WCAG 2.2 AA, and has no horizontal scroll at 390 px.

## Copy

British spelling. The text describes what each scene does and never mentions gaps (the product rules in `AGENTS.md`).

## Tests

- Every gallery scene passes the project validator unchanged: no object, rule or texture is dropped, and every textured object's texture is in the scene or is a sample.
- Every gallery scene's generated program uses no deferred symbol, and each scene's rules and their callbacks are present in the code.
- `/app?scene=<slug>` opens each gallery scene, and the starter list is unchanged.
- The page prerenders a card per scene, with its link, image and alt text; the route, header and footer list it; each scene has its image.
- Visual checks: the page light and dark at 1280, and at 390 with no horizontal scroll.

## Out of scope

Auto-starting Run from a link, gallery scenes in the editor's Add panel, and live canvas previews on the page.
