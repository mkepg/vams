import './primitive-tiles.scss';
import { Fragment, useId } from 'react';
import { PRIMITIVE_GROUPS, primitiveDef, type PrimitiveDef } from '../model/primitive-defs';
import { PrimitiveDrawing } from './primitive-drawings';

/** A GL constant with a break opportunity after each underscore and none inside a word. */
function breakAtUnderscores(name: string) {
  return name.split('_').map((part, i, all) => (
    <Fragment key={i}>
      {i < all.length - 1 ? `${part}_` : part}
      {i < all.length - 1 && <wbr />}
    </Fragment>
  ));
}

/** All ten primitives in three groups, each tile drawn, named plainly and by its GL constant. */
export default function PrimitiveTiles({ onPick }: { onPick: (def: PrimitiveDef) => void }) {
  const baseId = useId();
  return (
    <div className="primitive-tiles">
      {PRIMITIVE_GROUPS.map((group, index) => (
        <section key={group.title} className="primitive-tiles__group" aria-labelledby={`${baseId}-${index}`}>
          <h3 id={`${baseId}-${index}`} className="primitive-tiles__title">{group.title}</h3>
          <div className={`primitive-tiles__grid primitive-tiles__grid--${group.columns}`}>
            {group.types.map((type) => {
              const def = primitiveDef(type);
              return (
                <button key={type} type="button" className="primitive-tile" title={def.hint} onClick={() => onPick(def)}>
                  <PrimitiveDrawing type={type} />
                  <span className="primitive-tile__name">{def.name}</span>
                  <code className="primitive-tile__gl">{breakAtUnderscores(def.glName)}</code>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
