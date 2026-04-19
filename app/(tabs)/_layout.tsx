import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
        tabBar={(props) => <CustomTabBar {...props} />}
      >
        <Tabs.Screen
          name="(dashboard)/index"
          options={{
            title: 'Home',
          }}
        />
        <Tabs.Screen
          name="(dashboard)/progress"
          options={{
            title: 'Stats',
          }}
        />
        <Tabs.Screen
          name="(dashboard)/profile"
          options={{
            title: 'Profile',
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            href: null,
            title: 'Scan',
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            href: null,
            title: 'Chat',
            tabBarStyle: { display: 'none' },
          }}
        />
        <Tabs.Screen
          name="notification"
          options={{
            href: null,
            title: 'Notification',
            tabBarStyle: { display: 'none' },
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1014',
  },
});
