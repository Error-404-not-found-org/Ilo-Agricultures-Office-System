import React, { useImperativeHandle, forwardRef } from 'react';
import { View, Text } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

export const Marker = forwardRef(({ children, coordinate, title, description, ...props }: any, ref: any) => {
  return (
    <View style={{ padding: 4, backgroundColor: '#ef4444', borderRadius: 4, alignItems: 'center' }}>
      {children || <Text style={{ color: '#fff', fontSize: 10 }}>📍</Text>}
    </View>
  );
});
Marker.displayName = 'Marker';

export const UrlTile = (props: any) => null;
export const Circle = (props: any) => null;

const MapView = forwardRef(({ children, style, initialRegion, ...props }: any, ref: any) => {
  useImperativeHandle(ref, () => ({
    animateCamera: (camera: any, options?: any) => {
      console.log('web map animateCamera', camera);
    },
    animateToRegion: (region: any, duration?: any) => {
      console.log('web map animateToRegion', region);
    },
  }));

  const lat = initialRegion?.latitude || 10.6942;
  const lng = initialRegion?.longitude || 122.4833;
  
  // Clean, high quality interactive free Google Maps frame
  const googleMapsUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`;

  return (
    <View style={[{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }, style]}>
      <iframe
        title="Google Map Web"
        width="100%"
        height="100%"
        style={{ border: 0, width: '100%', height: '100%' }}
        src={googleMapsUrl}
      />
    </View>
  );
});
MapView.displayName = 'MapView';

export default MapView;
