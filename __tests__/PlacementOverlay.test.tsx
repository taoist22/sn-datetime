import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {PixelRatio} from 'react-native';
import PlacementOverlay from '../src/PlacementOverlay';
jest.mock('../src/pluginRouter', () => ({subscribeToButtonEvents: jest.fn(() => jest.fn())}));
const touch = (x: number, time: number) => ({nativeEvent: {locationX: x, locationY: 100, timestamp: time, touches: [{}]}});
let tree: TestRenderer.ReactTestRenderer;
let resolve: jest.Mock;
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(PixelRatio, 'get').mockReturnValue(2);
  resolve = jest.fn();
  act(() => {tree = TestRenderer.create(<PlacementOverlay request={{resolve}} />);});
});
afterEach(() => {act(() => tree.unmount()); jest.useRealTimers(); jest.restoreAllMocks();});
const surface = () => tree.root.findByProps({testID: 'placement-surface'});
it('owns the gesture and resolves once on release in physical pixels', () => {
  const p = surface().props;
  expect(p.onStartShouldSetResponder()).toBe(true);
  expect(p.onResponderTerminationRequest()).toBe(false);
  act(() => p.onResponderGrant(touch(50, 100)));
  expect(resolve).not.toHaveBeenCalled();
  act(() => p.onResponderRelease(touch(50, 200)));
  expect(resolve).toHaveBeenCalledWith({kind: 'placed', point: {x: 100, y: 200}});
  act(() => {p.onResponderGrant(touch(60, 300)); p.onResponderRelease(touch(60, 400));});
  expect(resolve).toHaveBeenCalledTimes(1);
});
it('ignores drags and long presses', () => {
  const p = surface().props;
  act(() => {p.onResponderGrant(touch(50, 100)); p.onResponderMove(touch(90, 150)); p.onResponderRelease(touch(50, 200));});
  act(() => {p.onResponderGrant(touch(50, 100)); p.onResponderRelease(touch(50, 900));});
  expect(resolve).not.toHaveBeenCalled();
});
it('cancels without placing, and reports it as an outcome rather than an error', () => {
  act(() => tree.root.findByProps({testID: 'placement-cancel'}).props.onPress());
  expect(resolve).toHaveBeenCalledWith({kind: 'cancelled'});
  expect(resolve).toHaveBeenCalledTimes(1);
});
it('times out as a cancellation and releases resources when unmounted', () => {
  act(() => jest.advanceTimersByTime(30000));
  expect(resolve).toHaveBeenCalledWith({kind: 'cancelled'});
  act(() => tree.unmount());
  expect(resolve).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it('settles an unmount with no tap as a cancellation', () => {
  act(() => tree.unmount());
  expect(resolve).toHaveBeenCalledWith({kind: 'cancelled'});
});
