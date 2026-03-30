import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, Text, useColorScheme } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";

function BellWithBadge({ color, unreadCount }: { color: string; unreadCount: number }) {
  return (
    <View style={{ width: 26, height: 26 }}>
      <Feather name="bell" size={22} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const { user } = useAuth();
  const request = useApiRequest();
  const role = user?.role;
  const isStudent = role === "student";

  const { data: notifications } = useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => request("/notifications"),
    enabled: isStudent && !!user,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const unreadCount = isStudent
    ? (notifications?.filter((n: any) => !n.isRead).length ?? 0)
    : 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : theme.navBg,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.navBg }]} />
          ),
        tabBarLabelStyle: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="hostel"
        options={{
          title: isStudent ? "Hostel" : "Students",
          tabBarIcon: ({ color }) => <Feather name={isStudent ? "compass" : "users"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lostandfound"
        options={{
          title: "Attendance",
          tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color }) => <BellWithBadge color={color} unreadCount={unreadCount} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 16,
  },
});
