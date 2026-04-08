import React from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Alert, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { Badge } from "@/components/ui/Badge";

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = Platform.OS === "web" ? 24 : Math.max(insets.top + 20, 100);
  const { user, logout, isCoordinator, isVolunteer, isSuperAdmin, isStudent } = useAuth();
  const request = useApiRequest();

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ["pending-count"],
    queryFn: () => request("/approvals/count"),
    enabled: isSuperAdmin,
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const pendingNum = pendingCount?.count ?? 0;

  const handleLogout = () => {
    if (Platform.OS === "web") {
      // On web, Alert.alert works but confirm dialog is cleaner
      if (window.confirm("Are you sure you want to logout?")) {
        logout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: () => { logout(); } },
      ]);
    }
  };

  const roleLabel = user?.role === "superadmin" ? "Super Admin"
    : user?.role === "admin" || user?.role === "coordinator" ? "Admin"
    : user?.role === "volunteer" ? "Volunteer"
    : "Student";

  const roleBadge = user?.role === "superadmin" ? "purple"
    : user?.role === "admin" || user?.role === "coordinator" ? "amber"
    : user?.role === "volunteer" ? "blue"
    : "green";

  const staffTools = [
    { icon: "users", label: "Students", path: "/(tabs)/hostel" },
    { icon: "check-square", label: "Attendance & Inventory", path: "/(tabs)/lostandfound" },
    { icon: "activity", label: "Staff Status", path: "/admin/staff-status" },
    { icon: "package", label: "Inventory Table", path: "/admin/inventory-table" },
    { icon: "search", label: "Global Search", path: "/admin/search" },
    ...(isCoordinator ? [
      { icon: "volume-2", label: "Post Announcement", path: "/admin/post-announcement" },
      { icon: "list", label: "Hostels", path: "/admin/hostels" },
    ] : []),
    ...(isSuperAdmin ? [
      { icon: "user-check", label: "Pending Approvals", path: "/admin/approvals", badge: pendingNum },
      { icon: "clock", label: "Activity Logs", path: "/admin/activity-logs" },
      { icon: "upload-cloud", label: "CSV Import", path: "/admin/csv-import" },
      { icon: "database", label: "Master Table", path: "/admin/master-table" },
      { icon: "download", label: "Reports & PDF Export", path: "/admin/reports" },
      { icon: "user-plus", label: "Manage Admins", path: "/admin/manage-admins" },
    ] : []),
  ];

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: Platform.OS === "web" ? 80 : 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar + Name */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: theme.tint + "25" }]}>
          <Text style={[styles.avatarText, { color: theme.tint }]}>
            {(user?.name || "U").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.userName, { color: theme.text }]}>{user?.name}</Text>
        <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user?.email}</Text>
        <View style={styles.roleBadgeWrap}>
          <Badge label={roleLabel} variant={roleBadge as any} />
        </View>
      </View>

      {/* Info Card */}
      <AnimatedCard style={styles.card}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Account Info</Text>
        {[
          { icon: "hash", label: "Roll Number", val: user?.rollNumber },
          { icon: "phone", label: "Contact", val: user?.contactNumber || user?.phone },
          { icon: "map-pin", label: "Area", val: user?.area },
          ...(isStudent ? [
            { icon: "home", label: "Room", val: user?.roomNumber },
            { icon: "coffee", label: "Mess", val: user?.assignedMess },
          ] : []),
        ]
          .filter(r => r.val)
          .map((r) => (
            <View key={r.label} style={[styles.infoRow, { borderBottomColor: theme.border }]}>
              <Feather name={r.icon as any} size={14} color={theme.tint} />
              <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{r.label}</Text>
              <Text style={[styles.infoValue, { color: theme.text }]}>{r.val}</Text>
            </View>
          ))}
      </AnimatedCard>

      {/* STAFF TOOLS */}
      {!isStudent && (
        <AnimatedCard style={styles.card}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Staff Tools</Text>
          {staffTools.map(({ icon, label, path, badge }: any) => (
            <Pressable
              key={label}
              onPress={() => { Haptics.selectionAsync(); router.push(path as any); }}
              style={[styles.menuRow, { borderBottomColor: theme.border }]}
            >
              <View style={[styles.menuIcon, { backgroundColor: theme.tint + "18" }]}>
                <Feather name={icon as any} size={17} color={theme.tint} />
              </View>
              <Text style={[styles.menuLabel, { color: theme.text }]}>{label}</Text>
              {badge > 0 && (
                <View style={styles.menuBadge}>
                  <Text style={styles.menuBadgeText}>{badge}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={16} color={theme.textTertiary} />
            </Pressable>
          ))}
        </AnimatedCard>
      )}


      {/* Logout */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [styles.logoutBtn, { borderColor: "#ef4444", opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name="log-out" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  userEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  roleBadgeWrap: { alignSelf: "center", alignItems: "center" },
  card: { marginHorizontal: 20, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  menuIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 20, marginTop: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  logoutText: { color: "#ef4444", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  menuBadge: { backgroundColor: "#ef4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, marginRight: 4 },
  menuBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
});
