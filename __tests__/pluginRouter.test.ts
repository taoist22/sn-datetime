import {PluginManager} from 'sn-plugin-lib';
import {installPluginRouter, installConfigEntry, getLaunch, subscribeLaunch} from '../src/pluginRouter';
jest.mock('sn-plugin-lib', () => ({PluginManager: {
  registerButtonListener: jest.fn(), registerConfigButton: jest.fn(async () => true),
  registerConfigButtonListener: jest.fn(), showPluginView: jest.fn(async () => true),
}}));
it('distinguishes repeated toolbar launches from configuration launches', async () => {
  installPluginRouter();
  await installConfigEntry();
  const changed = jest.fn(); const unsubscribe = subscribeLaunch(changed);
  const toolbar = (PluginManager.registerButtonListener as jest.Mock).mock.calls[0][0];
  toolbar.onButtonPress({id: 100});
  const first = getLaunch();
  expect(first.mode).toBe('toolbar');
  toolbar.onButtonPress({id: 100});
  expect(getLaunch().revision).toBe(first.revision + 1);
  const config = (PluginManager.registerConfigButtonListener as jest.Mock).mock.calls[0][0];
  config.onClick();
  expect(getLaunch().mode).toBe('settings');
  expect(PluginManager.showPluginView).toHaveBeenCalled();
  expect(changed).toHaveBeenCalledTimes(3);
  unsubscribe();
});
