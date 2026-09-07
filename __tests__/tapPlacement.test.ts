import {tapRect} from '../src/tapPlacement';

// The offset scales with font size: the element insertText builds is a fixed
// height, but the text sits lower inside it as the font grows.
it('puts the baseline on the tap at the calibrated size', () => {
  expect(tapRect({x: 50, y: 300}, 300, 60, 1404, 1872, 40)).toEqual({left: 50, top: 218, right: 350, bottom: 278});
});

it('lifts larger text further so every size lands on the tap', () => {
  expect(500 - tapRect({x: 0, y: 500}, 300, 44, 1404, 1872, 28).top).toBe(57);
  expect(500 - tapRect({x: 0, y: 500}, 300, 100, 1404, 1872, 72).top).toBe(148);
});

it('clamps at page edges without losing the box off-page', () => {
  expect(tapRect({x: 1400, y: 1870}, 300, 60, 1404, 1872, 40)).toEqual({left: 1104, top: 1788, right: 1404, bottom: 1848});
  expect(tapRect({x: 10, y: 10}, 300, 60, 1404, 1872, 40)).toEqual({left: 10, top: 0, right: 310, bottom: 60});
});
