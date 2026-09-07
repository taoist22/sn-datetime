import React, {useEffect, useRef} from 'react';
import {BackHandler, PixelRatio, Pressable, StyleSheet, Text, View} from 'react-native';
import {subscribeToButtonEvents} from './pluginRouter';
import {type TapPoint} from './tapPlacement';

// Backing out of placement is an outcome, not a failure. Resolving a tagged
// result keeps it out of the caller's error path, which exists to surface
// genuine insert failures in the settings panel.
export type PlacementResult =
  | {kind: 'placed'; point: TapPoint}
  | {kind: 'cancelled'}
  // Resolved by the owner in response to `onSettings`, never by the overlay.
  | {kind: 'settings'};

export type PlacementRequest = {
  resolve: (result: PlacementResult) => void;
};

// Keep the host window open: this responder must own the whole gesture so
// the underlying note never sees its pen-down, move, or pen-up.
export default function PlacementOverlay({request, onSettings}: {request: PlacementRequest; onSettings?: () => void}) {
  const surface = useRef<View>(null);
  const origin = useRef({x: 0, y: 0});
  const down = useRef<{x: number; y: number; time: number} | null>(null);
  const settled = useRef(false);
  const cancel = () => {
    if (settled.current) { return; }
    settled.current = true;
    request.resolve({kind: 'cancelled'});
  };
  useEffect(() => {
    // A timeout means the user walked away; treat it exactly like Cancel.
    const timer = setTimeout(cancel, 30000);
    const unsubscribe = subscribeToButtonEvents(cancel);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      cancel();
      return true;
    });
    return () => {
      clearTimeout(timer);
      back.remove();
      unsubscribe();
      cancel();
    };
    // Each overlay is mounted for exactly one request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <View style={styles.root}>
      <View
        ref={surface}
        testID="placement-surface"
        collapsable={false}
        style={StyleSheet.absoluteFill}
        onLayout={() => surface.current?.measureInWindow((x, y) => { origin.current = {x, y}; })}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={({nativeEvent: event}) => {
          down.current = event.touches.length === 1
            ? {x: event.locationX, y: event.locationY, time: event.timestamp}
            : null;
        }}
        onResponderMove={({nativeEvent: event}) => {
          if (event.touches.length !== 1 || (down.current &&
              Math.hypot(event.locationX - down.current.x, event.locationY - down.current.y) > 20)) {
            down.current = null;
          }
        }}
        onResponderTerminate={() => { down.current = null; }}
        onResponderRelease={({nativeEvent: event}) => {
          const start = down.current;
          down.current = null;
          if (settled.current || !start || event.timestamp - start.time > 700 ||
              Math.hypot(event.locationX - start.x, event.locationY - start.y) > 20) { return; }
          // RN touch coordinates are dp; insertText expects physical pixels.
          const scale = PixelRatio.get();
          const point = {x: (origin.current.x + event.locationX) * scale,
            y: (origin.current.y + event.locationY) * scale};
          if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) { return; }
          settled.current = true;
          console.log('[DateTimeOverlay] placement', point, 'pixelRatio', scale);
          request.resolve({kind: 'placed', point});
        }}
      />
      <View style={styles.hint}>
        <Text style={styles.text}>Tap to place · 30 seconds</Text>
        {onSettings && <Pressable testID="placement-settings" style={styles.cancel} onPress={() => {
          if (!settled.current) {settled.current = true; onSettings();}
        }}><Text style={styles.text}>Settings</Text></Pressable>}
        <Pressable onPress={cancel} style={styles.cancel} testID="placement-cancel">
          <Text style={styles.text}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: 'transparent'},
  hint: {position: 'absolute', top: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, paddingLeft: 12},
  text: {color: 'black', fontSize: 16},
  cancel: {padding: 16, marginLeft: 12, borderLeftWidth: 1},
});
