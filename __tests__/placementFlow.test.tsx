import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Pressable} from 'react-native';
import DateTimePicker, {TEST_IDS} from '../src/DateTimePicker';
import PlacementOverlay from '../src/PlacementOverlay';
import {PluginManager, PluginNoteAPI, PluginCommAPI} from 'sn-plugin-lib';
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/pluginRouter', () => ({subscribeToButtonEvents: jest.fn(() => jest.fn())}));
jest.mock('sn-plugin-lib', () => ({
  PluginManager: {closePluginView: jest.fn()},
  PluginCommAPI: {
    getCurrentFilePath: jest.fn(async () => ({success: true, result: '/Note/test.note'})),
    getCurrentPageNum: jest.fn(async () => ({success: true, result: 0})),
    getPageDisplaySize: jest.fn(async () => ({success: true, result: {width: 1404, height: 1872}})),
  },
  PluginNoteAPI: {insertText: jest.fn()},
  PluginFileAPI: {
    getKeyWords: jest.fn(async () => ({success: true, result: []})),
    insertKeyWord: jest.fn(async () => ({success: true})),
  },
  FileUtils: {exists: jest.fn(async () => true)},
}));
it('inserts at the captured point before closing, without waiting for background timers', async () => {
  jest.useFakeTimers();
  let finishInsert!: (value: unknown) => void;
  (PluginNoteAPI.insertText as jest.Mock).mockImplementation(() => new Promise(resolve => {finishInsert = resolve;}));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker />);});
  const button = (id: string) => tree.root.findAllByType(Pressable).find(node => node.props.testID === id)!;
  let insertion!: Promise<void>;
  await act(async () => {insertion = button(TEST_IDS.stampBtn('time')).props.onPress();});
  expect(PluginManager.closePluginView).not.toHaveBeenCalled();
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 200, y: 300}});});
  expect(PluginNoteAPI.insertText).toHaveBeenCalledWith(expect.objectContaining({textRect: expect.objectContaining({left: 200, top: 218})}));
  expect(PluginManager.closePluginView).not.toHaveBeenCalled();
  await act(async () => {finishInsert({success: true}); await insertion;});
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({testID: TEST_IDS.overlay})).toHaveLength(0);
  act(() => tree.unmount());
  jest.useRealTimers();
});

it('quick launch waits for a tap even with a saved preset; Settings exits without inserting', async () => {
  jest.clearAllMocks();
  const {defaults} = require('../src/settings');
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker initialSettings={{...defaults, selectedType: 'time', position: 'bottom', quickPlacement: true}} autoPlace />);});
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  const overlay = tree.root.findByType(PlacementOverlay);
  await act(async () => {overlay.props.onSettings();});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(0);
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it('never shows settings while quick placement waits on page details', async () => {
  const {defaults} = require('../src/settings');
  let release!: (value: unknown) => void;
  (PluginCommAPI.getCurrentFilePath as jest.Mock).mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker initialSettings={{...defaults, selectedType: 'time', quickPlacement: true}} autoPlace />);});
  expect(tree.root.findAllByProps({testID: TEST_IDS.overlay})).toHaveLength(0);
  expect(tree.root.findAllByProps({testID: 'datetime-preparing'}).length).toBeGreaterThan(0);
  await act(async () => {release({success: true, result: '/Note/test.note'});});
  expect(tree.root.findAllByType(PlacementOverlay)).toHaveLength(1);
  expect(tree.root.findAllByProps({testID: TEST_IDS.overlay})).toHaveLength(0);
  await act(async () => {tree.root.findByType(PlacementOverlay).props.onSettings();});
  expect(tree.root.findAllByProps({testID: TEST_IDS.overlay}).length).toBeGreaterThan(0);
  act(() => tree.unmount());
});

it('passes saved font and precise size to a quick stamp without changing its tap anchor', async () => {
  jest.clearAllMocks();
  const {defaults} = require('../src/settings');
  (PluginNoteAPI.insertText as jest.Mock).mockResolvedValue({success: true});
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker initialSettings={{...defaults,
    selectedType: 'time', fontPath: '/storage/emulated/0/MyStyle/Fonts/Test.ttf', customFontSize: 46,
    quickPlacement: true}} autoPlace />);});
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 200, y: 300}});});
  expect(PluginNoteAPI.insertText).toHaveBeenCalledWith(expect.objectContaining({fontSize: 46,
    fontPath: '/storage/emulated/0/MyStyle/Fonts/Test.ttf', textRect: expect.objectContaining({left: 200, top: 206, bottom: 274})}));
  act(() => tree.unmount());
});

it('closes the plugin on cancel instead of dropping the user into settings', async () => {
  jest.clearAllMocks();
  const {defaults} = require('../src/settings');
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker initialSettings={{...defaults, selectedType: 'time', quickPlacement: true}} autoPlace />);});
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'cancelled'});});
  expect(PluginNoteAPI.insertText).not.toHaveBeenCalled();
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({testID: TEST_IDS.overlay})).toHaveLength(0);
  act(() => tree.unmount());
});

it('hides the position presets and align while tap placement is the only mode', async () => {
  const {SHOW_POSITION_PRESETS} = require('../src/settings');
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker />);});
  const shown = (id: string) => tree.root.findAllByProps({testID: id}).length > 0;
  expect(shown('datetime-position-bottom')).toBe(SHOW_POSITION_PRESETS);
  expect(shown(TEST_IDS.alignBtn(0))).toBe(SHOW_POSITION_PRESETS);
  expect(shown('datetime-insert')).toBe(false);
  expect(shown(TEST_IDS.stampBtn('date'))).toBe(true);
  act(() => tree.unmount());
});

it('places straight from the stamp button, with no separate insert step', async () => {
  jest.clearAllMocks();
  (PluginNoteAPI.insertText as jest.Mock).mockResolvedValue({success: true});
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {tree = TestRenderer.create(<DateTimePicker />);});
  const stamp = tree.root.findAllByType(Pressable).find(n => n.props.testID === TEST_IDS.stampBtn('date'))!;
  let insertion!: Promise<void>;
  await act(async () => {insertion = stamp.props.onPress();});
  await act(async () => {tree.root.findByType(PlacementOverlay).props.request.resolve({kind: 'placed', point: {x: 200, y: 300}});});
  await act(async () => {await insertion;});
  expect(PluginNoteAPI.insertText).toHaveBeenCalledTimes(1);
  expect(PluginManager.closePluginView).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
