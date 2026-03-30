import React, { useCallback, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { user, isCoordinator, isVolunteer, isSuperAdmin, isStudent } = useAuth();
  const request = useApiRequest();
  const qc = useQueryClient();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [refreshing, setRefreshing] = React.useState(false);

  const { data: announcements, refetch: refetchAnn, isLoading: annLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => request("/announcements"),
    staleTime: 30000,
  });

  const { data: attStats, refetch: refetchStats } = useQuery({
    queryKey: ["att-stats"],
    queryFn: () => request("/attendance/stats"),
    enabled: isVolunteer,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: hostel } = useQuery({
    queryKey: ["hostel", user?.hostelId],
    queryFn: () => request(`/hostels/${user?.hostelId}`),
    enabled: !!user?.hostelId && isStudent,
    staleTime: 60000,
  });

  const { data: reportSummary } = useQuery({
    queryKey: ["report-summary"],
    queryFn: () => request("/reports/summary"),
    enabled: isCoordinator,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: messStats, refetch: refetchMess } = useQuery<any>({
    queryKey: ["mess-stats"],
    queryFn: () => request("/mess-attendance/stats"),
    enabled: isVolunteer,
    refetchInterval: 20000,
    staleTime: 10000,
  });

  const { data: checkinStats } = useQuery<any>({
    queryKey: ["checkin-stats"],
    queryFn: () => request("/checkins/stats"),
    enabled: isCoordinator,
    refetchInterval: 15000,
    staleTime: 8000,
  });

  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    enabled: isVolunteer,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const activeStatusMutation = useMutation({
    mutationFn: ({ goActive, remark }: { goActive: boolean; remark?: string }) =>
      request(goActive ? "/staff/go-active" : "/staff/go-inactive", {
        method: "POST",
        body: JSON.stringify({ remark }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-status"] });
      qc.invalidateQueries({ queryKey: ["staff-all"] });
    },
  });

  // Heartbeat to keep active status alive every 5 minutes
  useEffect(() => {
    if (!isVolunteer || !myStatus?.isActive) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    heartbeatRef.current = setInterval(async () => {
      try { await request("/staff/heartbeat", { method: "POST" }); } catch { }
    }, 5 * 60 * 1000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [isVolunteer, myStatus?.isActive]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAnn(), refetchStats(), refetchStatus(), refetchMess()].filter(Boolean));
    setRefreshing(false);
  }, [refetchAnn, refetchStats, refetchStatus]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const roleLabel = user?.role === "superadmin" ? "Super Admin"
    : user?.role === "admin" || user?.role === "coordinator" ? "Admin"
    : user?.role === "volunteer" ? "Volunteer"
    : "Student";

  const roleBadge = user?.role === "superadmin" ? "purple"
    : user?.role === "admin" || user?.role === "coordinator" ? "amber"
    : user?.role === "volunteer" ? "blue"
    : "green";

  const isActive = myStatus?.isActive ?? false;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingTop: topPad, paddingBottom: isWeb ? 34 : 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting()},</Text>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.name?.split(" ")[0] ?? "..."}</Text>
        </View>
        <Badge label={roleLabel} variant={roleBadge as any} />
      </View>

      {/* STAFF STATUS BANNER (volunteers/staff only) */}
      {isVolunteer && (
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: isActive ? "#22c55e15" : "#f59e0b15", borderColor: isActive ? "#22c55e50" : "#f59e0b50" },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#f59e0b" }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#f59e0b" }]}>
              {isActive ? "You are Active" : "You are Inactive"}
            </Text>
            <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
              {isActive ? "Auto-inactive after 10 min of inactivity" : "Go active to start your shift"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              activeStatusMutation.mutate({ goActive: !isActive, remark: isActive ? "Going inactive" : "Going active" });
            }}
            disabled={activeStatusMutation.isPending}
            style={[styles.statusToggleBtn, { backgroundColor: isActive ? "#ef444420" : "#22c55e20", borderColor: isActive ? "#ef444440" : "#22c55e40" }]}
          >
            {activeStatusMutation.isPending ? (
              <ActivityIndicator size="small" color={isActive ? "#ef4444" : "#22c55e"} />
            ) : (
              <Text style={[styles.statusToggleTxt, { color: isActive ? "#ef4444" : "#22c55e" }]}>
                {isActive ? "Go Inactive" : "Go Active"}
              </Text>
            )}
          </Pressable>
        </View>
      )}


      {/* VOLUNTEER (non-coordinator) DASHBOARD */}
      {!isCoordinator && (
        <>
          <AnimatedCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconBox, { backgroundColor: "#22c55e20" }]}>
                <Feather name="check-circle" size={20} color="#22c55e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Today's Attendance</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{new Date().toDateString()}</Text>
              </View>
            </View>
            {attStats ? (
              <View style={styles.statsRow}>
                <StatBox label="Total" value={attStats.total} color={theme.text} theme={theme} />
                <StatBox label="Entered" value={attStats.entered} color="#22c55e" theme={theme} />
                <StatBox label="Pending" value={attStats.notEntered} color="#f59e0b" theme={theme} />
              </View>
            ) : (
              <CardSkeleton />
            )}
            <Pressable
              onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/lostandfound"); }}
              style={[styles.actionBtn, { backgroundColor: theme.tint }]}
            >
              <Feather name="check-square" size={16} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Attendance + Inventory</Text>
            </Pressable>
          </AnimatedCard>

          <View style={styles.quickGrid}>
            {[
              { label: "Search", icon: "search", path: "/admin/search", color: theme.tint },
              { label: "Inventory", icon: "package", path: "/admin/inventory-table", color: "#f59e0b" },
              { label: "Mess Cards", icon: "coffee", path: "/(tabs)/lostandfound", color: "#22c55e" },
            ].map(({ label, icon, path, color }) => (
              <Pressable
                key={label}
                onPress={() => { Haptics.selectionAsync(); router.push(path as any); }}
                style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.quickIcon, { backgroundColor: color + "18" }]}>
                  <Feather name={icon as any} size={22} color={color} />
                </View>
                <Text style={[styles.quickLabel, { color: theme.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* COORDINATOR / ADMIN / SUPERADMIN DASHBOARD */}
      {isCoordinator && (
        <>
          {reportSummary && (
            <AnimatedCard style={styles.card}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>System Overview</Text>
              <View style={styles.statsRow}>
                <StatBox label="Students" value={reportSummary.totalStudents} color={theme.tint} theme={theme} />
                <StatBox label="Hostels" value={reportSummary.totalHostels} color="#22c55e" theme={theme} />
                <StatBox label="Announcements" value={reportSummary.totalAnnouncements} color="#8b5cf6" theme={theme} />
              </View>
            </AnimatedCard>
          )}

          {attStats && (
            <AnimatedCard style={styles.card}>
              <Text style={[styles.sectionLabel, { color: theme.text }]}>Today's Room Attendance</Text>
              <View style={styles.statsRow}>
                <StatBox label="Total" value={attStats.total} color={theme.text} theme={theme} />
                <StatBox label="Entered" value={attStats.entered} color="#22c55e" theme={theme} />
                <StatBox label="Pending" value={attStats.notEntered} color="#f59e0b" theme={theme} />
              </View>
            </AnimatedCard>
          )}

          {/* Check-in Stats */}
          <AnimatedCard style={[styles.card, { borderColor: "#8b5cf630", borderWidth: 1.5 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#8b5cf620", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="log-in" size={16} color="#8b5cf6" />
                </View>
                <View>
                  <Text style={[styles.sectionLabel, { color: theme.text, marginBottom: 0 }]}>Campus Check-ins</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textSecondary }}>Live · Today</Text>
                </View>
              </View>
              <Pressable onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/lostandfound" as any); }} style={{ padding: 4 }}>
                <Feather name="arrow-right" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Checked In" value={checkinStats?.total ?? 0} color="#8b5cf6" theme={theme} />
              <StatBox label="Checked Out" value={checkinStats?.checkedOut ?? 0} color="#6366f1" theme={theme} />
              <StatBox label="Still Inside" value={(checkinStats?.total ?? 0) - (checkinStats?.checkedOut ?? 0)} color="#22c55e" theme={theme} />
            </View>
          </AnimatedCard>

          {/* Mess Card Stats */}
          <AnimatedCard style={[styles.card, { borderColor: "#22c55e30", borderWidth: 1.5 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#22c55e20", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="coffee" size={16} color="#22c55e" />
                </View>
                <View>
                  <Text style={[styles.sectionLabel, { color: theme.text, marginBottom: 0 }]}>Mess Cards</Text>
                  <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textSecondary }]}>Live · Today</Text>
                </View>
              </View>
              <Pressable onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/lostandfound" as any); }} style={{ padding: 4 }}>
                <Feather name="arrow-right" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Total" value={attStats?.total ?? 0} color={theme.text} theme={theme} />
              <StatBox label="Card Given" value={messStats?.cardGivenCount ?? 0} color="#22c55e" theme={theme} />
              <StatBox label="Pending" value={(attStats?.total ?? 0) - (messStats?.cardGivenCount ?? 0)} color="#f59e0b" theme={theme} />
            </View>
          </AnimatedCard>

          <View style={styles.quickGrid}>
            {[
              { label: "Students", icon: "users", path: "/(tabs)/hostel", color: theme.tint },
              { label: "Attendance", icon: "check-square", path: "/(tabs)/lostandfound", color: "#22c55e" },
              { label: "Inventory", icon: "package", path: "/admin/inventory-table", color: "#f59e0b" },
              { label: "Search", icon: "search", path: "/admin/search", color: "#3b82f6" },
              { label: "Staff Status", icon: "activity", path: "/admin/staff-status", color: "#22c55e" },
              { label: "Post Alert", icon: "volume-2", path: "/admin/post-announcement", color: "#8b5cf6" },
              ...(isSuperAdmin
                ? [
                    { label: "Activity Logs", icon: "clock", path: "/admin/activity-logs", color: "#06b6d4" },
                    { label: "CSV Import", icon: "upload-cloud", path: "/admin/csv-import", color: "#f59e0b" },
                    { label: "Reports", icon: "download", path: "/admin/reports", color: "#ef4444" },
                    { label: "Master Table", icon: "database", path: "/admin/master-table", color: "#6366f1" },
                    { label: "Users", icon: "user-plus", path: "/admin/manage-admins", color: "#f59e0b" },
                  ]
                : []),
            ].map(({ label, icon, path, color }) => (
              <Pressable
                key={label}
                onPress={() => { Haptics.selectionAsync(); router.push(path as any); }}
                style={[styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.quickIcon, { backgroundColor: color + "18" }]}>
                  <Feather name={icon as any} size={22} color={color} />
                </View>
                <Text style={[styles.quickLabel, { color: theme.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* ANNOUNCEMENTS (all roles) */}
      <Text style={[styles.sectionLabel, { color: theme.text, paddingHorizontal: 20, marginBottom: 10, marginTop: 8 }]}>
        Announcements
      </Text>
      {annLoading ? (
        <View style={{ paddingHorizontal: 20 }}><CardSkeleton /><CardSkeleton /></View>
      ) : !announcements?.length ? (
        <AnimatedCard style={styles.card}>
          <View style={styles.emptyState}>
            <Feather name="bell-off" size={32} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No announcements</Text>
          </View>
        </AnimatedCard>
      ) : (
        announcements.slice(0, 4).map((a: any) => (
          <AnimatedCard key={a.id} style={styles.card}>
            <View style={styles.annRow}>
              <View style={[styles.annDot, { backgroundColor: theme.tint }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.annTitle, { color: theme.text }]}>{a.title}</Text>
                <Text style={[styles.annContent, { color: theme.textSecondary }]} numberOfLines={2}>{a.content}</Text>
                <Text style={[styles.annDate, { color: theme.textTertiary }]}>
                  {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </Text>
              </View>
            </View>
          </AnimatedCard>
        ))
      )}
    </ScrollView>
  );
}

function InfoChip({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Feather name={icon as any} size={13} color={theme.tint} />
      <Text style={[styles.chipLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.chipValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function StatBox({ label, value, color, theme }: { label: string; value: any; color: string; theme: any }) {
  return (
    <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.statVal, { color }]}>{value ?? "—"}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16, gap: 12 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  userName: { fontSize: 26, fontFamily: "Inter_700Bold" },
  // Status banner
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusToggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 90, alignItems: "center", justifyContent: "center" },
  statusToggleTxt: { fontSize: 12, fontFamily: "Inter_700Bold" },
  // Lost & Found banner
  lostFoundBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  card: { marginHorizontal: 20, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 17, fontFamily: "Inter_700Bold" },
  infoRow: { flexDirection: "row", gap: 8 },
  chip: { alignItems: "center", gap: 3, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, flex: 1 },
  chipLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chipValue: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, gap: 3 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12 },
  actionBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  quickCard: { width: "30%", alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  annRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  annDot: { width: 4, borderRadius: 2, marginTop: 4, alignSelf: "stretch" },
  annTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  annContent: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  annDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Mess stats
  messStatBox: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 2 },
  messStatNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  messStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  messHighlight: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  messHighlightText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
});
