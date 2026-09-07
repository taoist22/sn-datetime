import React, {useEffect, useState, useSyncExternalStore} from 'react';
import {View} from 'react-native';
import DateTimePicker from './src/DateTimePicker';
import {installPluginRouter, getLaunch, subscribeLaunch} from './src/pluginRouter';
import {defaults, loadSettings, type StampSettings} from './src/settings';
installPluginRouter();
function Session({quick}: {quick: boolean}) {
  const [settings, setSettings] = useState<StampSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadSettings().then(value => {if (active) {setSettings(value);}}).catch(() => {
      if (active) {setError('Could not load saved settings. Quick placement is off.'); setSettings({...defaults});}
    });
    return () => {active = false;};
  }, []);
  if (!settings) {return <View style={{flex: 1, backgroundColor: 'transparent'}} onStartShouldSetResponder={() => true} />;}
  return <DateTimePicker initialSettings={settings} autoPlace={quick && settings.quickPlacement} initialError={error} />;
}
export default function App(): React.JSX.Element {
  const launch = useSyncExternalStore(subscribeLaunch, getLaunch);
  if (launch.revision === 0) {return <View style={{flex: 1, backgroundColor: 'transparent'}} />;}
  return <Session key={launch.revision} quick={launch.mode === 'toolbar'} />;
}
