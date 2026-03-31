import { describe, expect, it } from "vitest";

import { parseCookNotesFromHtml, parseIngredientLinesFromHtml } from "./recipe-service";

describe("parseIngredientLinesFromHtml", () => {
  it("parses recipe-card ingredient rows using ordered spans and keeps notes", () => {
    const html = `
      <article>
        <h3>Ingredients</h3>
        <ul>
          <li>
            <span><input type="checkbox" /></span>
            <span><span>1 1/4</span> <span>cup</span></span>
            <span>(<span>250</span> <span>g</span>)</span>
            <span>brown sugar</span>
            <span>firmly packed (see note)</span>
          </li>
          <li>
            <span><input type="checkbox" /></span>
            <span><span>2</span> <span>large eggs + 1 egg yolk</span></span>
            <span>eggs + 1 egg yolk</span>
          </li>
          <li>
            <span><input type="checkbox" /></span>
            <span><span>2</span> <span>teaspoons</span></span>
            <span><a href="/vanilla">vanilla extract</a></span>
          </li>
        </ul>
      </article>
    `;

    const lines = parseIngredientLinesFromHtml(html);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("1 1/4 cup brown sugar firmly packed (see note)");
    expect(lines[1]).toBe("2 large eggs + 1 egg yolk eggs + 1 egg yolk");
    expect(lines[2]).toBe("2 teaspoons vanilla extract");
  });

  it("chooses measured ingredient list over narrative bullet list when multiple ingredient headings exist", () => {
    const html = `
      <section>
        <h3>Ingredients</h3>
        <ul>
          <li>Butter is important for chewy texture.</li>
          <li>Sugar adds sweetness and moisture.</li>
          <li>Use quality vanilla for best flavor.</li>
        </ul>
      </section>

      <section>
        <h3>Recipe Ingredients</h3>
        <ul>
          <li>
            <span><input type="checkbox" /></span>
            <span><span>1</span> <span>cup</span></span>
            <span>unsalted butter</span>
            <span>melted</span>
          </li>
          <li>
            <span><input type="checkbox" /></span>
            <span><span>1/2</span> <span>cup</span></span>
            <span>granulated sugar</span>
          </li>
        </ul>
      </section>
    `;

    const lines = parseIngredientLinesFromHtml(html);

    expect(lines).toEqual([
      "1 cup unsalted butter melted",
      "1/2 cup granulated sugar",
    ]);
  });
});

describe("parseCookNotesFromHtml", () => {
  it("extracts notes from dedicated recipe notes container", () => {
    const html = `
      <section>
        <div class="wprm-recipe-notes-container">
          <h4>Brown sugar</h4>
          <p>Use half dark and half light brown sugar for best flavor.</p>
          <h4>Pan note</h4>
          <p>Metal baking pans bake more evenly than glass.</p>
        </div>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html);

    expect(notes).toContain("Brown sugar");
    expect(notes).toContain("Use half dark and half light brown sugar for best flavor.");
    expect(notes).toContain("Pan note");
  });

  it("extracts notes from a Notes heading fallback region", () => {
    const html = `
      <section>
        <h3>Notes</h3>
        <h4>Add-ins</h4>
        <p>Swap walnuts with pecans or chocolate chips.</p>
        <h4>Storing</h4>
        <p>Store covered at room temperature for up to 4 days.</p>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html);

    expect(notes).toContain("Add-ins");
    expect(notes).toContain("Swap walnuts with pecans or chocolate chips.");
    expect(notes).toContain("Storing");
  });

  it("formats inline bullet symbols as one bullet per line", () => {
    const html = `
      <section>
        <div class="wprm-recipe-notes-container">
          <p>Use dark brown sugar for flavor. • Do not overbake. • Cool fully before slicing.</p>
        </div>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html);

    expect(notes).toContain("- Use dark brown sugar for flavor.");
    expect(notes).toContain("- Do not overbake.");
    expect(notes).toContain("- Cool fully before slicing.");
  });

  it("splits hyphen-delimited note prose into one bullet per line without duplication", () => {
    const html = `
      <section>
        <div class="wprm-recipe-notes">
          <div class="wprm-recipe-notes-container">
            <p>Use half dark and half light brown sugar. - If you do not have both, use light brown sugar. - Add-ins can be swapped freely. - Store tightly covered.</p>
          </div>
        </div>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html);

    expect(notes).toContain("- Use half dark and half light brown sugar.");
    expect(notes).toContain("- If you do not have both, use light brown sugar.");
    expect(notes).toContain("- Add-ins can be swapped freely.");
    expect(notes).toContain("- Store tightly covered.");
    expect(notes).not.toContain("\n\n- Use half dark and half light brown sugar.\n- If you do not have both, use light brown sugar.\n- Add-ins can be swapped freely.\n- Store tightly covered.\n\n- Use half dark and half light brown sugar.");
  });

  it("splits a single li blob into separate bullet lines", () => {
    const html = `
      <section>
        <div class="wprm-recipe-notes-container">
          <ul>
            <li>- NotesBrown sugar I like to use half dark and half light brown sugar in this recipe. - If you do not have both, use just light brown sugar. - Pan note A metal baking pan is recommended.</li>
          </ul>
        </div>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html);

    expect(notes).toContain("- Brown sugar I like to use half dark and half light brown sugar in this recipe.");
    expect(notes).toContain("- If you do not have both, use just light brown sugar.");
    expect(notes).toContain("- Pan note A metal baking pan is recommended.");
    expect(notes).toContain("\n- If you do not have both, use just light brown sugar.\n");
  });

  it("splits Unicode dash-delimited note prose and removes merged Notes prefix", () => {
    const html = `
      <section>
        <div class="wprm-recipe-notes-container">
          <p>NotesBrown sugar gives depth \u2013 If you do not have both, use just light brown sugar. \u2013 Pan note A metal baking pan is recommended.</p>
        </div>
      </section>
    `;

    const notes = parseCookNotesFromHtml(html.replace(/\\u2013/g, "\u2013"));

    expect(notes).toContain("- Brown sugar gives depth");
    expect(notes).toContain("- If you do not have both, use just light brown sugar.");
    expect(notes).toContain("- Pan note A metal baking pan is recommended.");
  });
});
