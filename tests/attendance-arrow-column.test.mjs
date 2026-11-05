import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const context = vm.createContext({
  document: { addEventListener() {} },
  window: { setTimeout() {} },
  console,
});
vm.runInContext(fs.readFileSync("frontend/js/asistencias.js", "utf8"), context);
const admin = vm.runInContext("AdminAsistencias", context);

function mockTable(widths, visibleWidth, initialLeft = 0) {
  const lefts = widths.map((_, i) =>
    widths.slice(0, i).reduce((sum, width) => sum + width, 0)
  );
  const scrollWidth = widths.reduce((sum, width) => sum + width, 0);
  const moves = [];
  const scroller = {
    clientWidth: visibleWidth,
    scrollWidth,
    scrollLeft: initialLeft,
    scrollBy({ left, behavior }) {
      moves.push({ left, behavior });
      this.scrollLeft = Math.max(
        0, Math.min(scrollWidth - visibleWidth, this.scrollLeft + left)
      );
    },
    querySelector(selector) {
      return selector === ".attendance-table" ? table : null;
    },
  };
  const table = {
    getBoundingClientRect() {
      return { left: -scroller.scrollLeft };
    },
    tHead: {
      rows: [{
        cells: widths.map((width, index) => ({
          getBoundingClientRect() {
            return {
              width,
              left: index === 0 ? 0 : lefts[index] - scroller.scrollLeft,
            };
          },
        })),
      }],
    },
  };
  admin.tableWrap = {
    querySelector(selector) {
      return selector === ".attendance-table-scroll" ? scroller : null;
    },
  };
  admin.updateScrollButtons = () => {};
  return { scroller, moves };
}

test("arrows advance one physical column, despite unequal widths", () => {
  const { scroller, moves } = mockTable([180, 120, 200, 90, 210, 190], 400);
  for (const position of [120, 320, 410, 590]) {
    admin.scrollTable("right");
    assert.equal(scroller.scrollLeft, position);
  }
  for (const position of [410, 320, 120, 0]) {
    admin.scrollTable("left");
    assert.equal(scroller.scrollLeft, position);
  }
  assert.equal(moves.length, 8);
  assert.ok(moves.every(move => move.behavior === "smooth"));
});

test("manual partial scroll snaps to the next column edge", () => {
  const { scroller } = mockTable([180, 120, 200, 90, 210, 190], 400, 76);
  admin.scrollTable("right");
  assert.equal(scroller.scrollLeft, 120);
  admin.scrollTable("left");
  assert.equal(scroller.scrollLeft, 0);
});

test("no scroll occurs when all columns already fit", () => {
  const { moves } = mockTable([120, 80, 100], 500);
  admin.scrollTable("right");
  admin.scrollTable("left");
  assert.equal(moves.length, 0);
});

test("works with the filtered view, which inherits the same scroll handler", () => {
  vm.runInContext(fs.readFileSync("frontend/js/asistencias-class-filter.js", "utf8"), context);
  const { scroller } = mockTable([160, 100, 130, 75, 105], 300);
  admin.scrollTable("right");
  assert.equal(scroller.scrollLeft, 100);
});
