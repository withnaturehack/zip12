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

  // Parse assigned hostel IDs for admin/coordinator
  const isAdmin = user?.role === "admin" || user?.role === "coordinator";
  const assignedHostelIds: string[] = React.useMemo(() => {
    try {
      const raw = user?.assignedHostelIds;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [user?.assignedHostelIds]);

  const { data: announcements, refetch: refetchAnn, isLoading: annLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => request("/announcements"),
    staleTime: 30000,
  });

  const { data: attStats, refetch: refetchStats } = useQuery({
    queryKey: ["att-stats"],
    queryFn: () => request("/attendance/stats"),
    enabled: isVolunteer,
    refetchInterval: isCoordinator ? 5000 : 20000,
    staleTime: isCoordinator ? 3000 : 10000,
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
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const { data: messStats, refetch: refetchMess } = useQuery<any>({
    queryKey: ["mess-stats"],
    queryFn: () => request("/mess-attendance/stats"),
    enabled: isVolunteer,
    refetchInterval: isCoordinator ? 5000 : 15000,
    staleTime: isCoordinator ? 3000 : 8000,
  });

  const { data: checkinStats } = useQuery<any>({
    queryKey: ["checkin-stats"],
    queryFn: () => request("/checkins/stats"),
    enabled: isCoordinator,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    enabled: isVolunteer,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Fetch all hostels to cross-reference assigned hostel IDs
  const { data: allHostels = [] } = useQuery<any[]>({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
    enabled: isAdmin && assignedHostelIds.length > 0,
    staleTime: 60000,
  });

  const assignedHostels = React.useMemo(() => {
    if (!Array.isArray(allHostels)) return [];
    return (allHostels as any[]).filter((h: any) => assignedHostelIds.includes(h.id));
  }, [allHostels, assignedHostelIds]);

  // Fetch inventory stats for assigned hostels (admin dashboard)
  const { data: invStats } = useQuery<any>({
    queryKey: ["inv-stats"],
    queryFn: () => request("/inventory-simple"),
    enabled: isCoordinator,
    refetchInterval: 8000,
    staleTime: 5000,
  });
  const invStatsArr = Array.isArray(invStats) ? invStats as any[] : [];
  const invSubmitted = invStatsArr.filter(s => s.inventory?.inventoryLocked).length;
  const invTotal = invStatsArr.length;

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
          {/* ── Assigned Hostel Highlights (admin/coordinator only, not superadmin) ── */}
          {isAdmin && assignedHostels.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text, paddingHorizontal: 20, marginBottom: 8 }]}>
                Your Assigned Hostels
              </Text>
              {assignedHostels.map((h: any) => (
                <Pressable
                  key={h.id}
                  onPress={() => { Haptics.selectionAsync(); router.push("/admin/hostels" as any); }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <AnimatedCard style={[styles.card, styles.assignedHostelCard]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={[styles.hostelIconBox, { backgroundColor: theme.tint + "20" }]}>
                        <Feather name="home" size={22} color={theme.tint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={[styles.hostelHighlightName, { color: theme.text }]}>{h.name}</Text>
                          <View style={[styles.assignedBadge, { backgroundColor: theme.tint + "20", borderColor: theme.tint + "50" }]}>
                            <Text style={[styles.assignedBadgeText, { color: theme.tint }]}>Assigned</Text>
                          </View>
                        </View>
                        {h.location ? <Text style={[styles.hostelHighlightLoc, { color: theme.textSecondary }]}>{h.location}</Text> : null}
                        <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                          {h.wardenName ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Feather name="user" size={11} color={theme.textTertiary} />
                              <Text style={[styles.hostelHighlightMeta, { color: theme.textTertiary }]}>{h.wardenName}</Text>
                            </View>
                          ) : null}
                          {h.totalRooms ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Feather name="layers" size={11} color={theme.textTertiary} />
                              <Text style={[styles.hostelHighlightMeta, { color: theme.textTertiary }]}>{h.totalRooms} rooms</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                    </View>
                  </AnimatedCard>
                </Pressable>
              ))}
            </>
          )}

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

          {/* Inventory Stats */}
          <AnimatedCard style={[styles.card, { borderColor: "#06b6d430", borderWidth: 1.5 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#06b6d420", alignItems: "center", justifyContent: "center" }}>
                  <Feather name="package" size={16} color="#06b6d4" />
                </View>
                <View>
                  <Text style={[styles.sectionLabel, { color: theme.text, marginBottom: 0 }]}>Inventory Status</Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: theme.textSecondary }}>Live · All Hostels</Text>
                </View>
              </View>
              <Pressable onPress={() => { Haptics.selectionAsync(); router.push("/admin/inventory-table" as any); }} style={{ padding: 4 }}>
                <Feather name="arrow-right" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <StatBox label="Total" value={invTotal} color={theme.text} theme={theme} />
              <StatBox label="Submitted" value={invSubmitted} color="#06b6d4" theme={theme} />
              <StatBox label="Pending" value={invTotal - invSubmitted} color="#f59e0b" theme={theme} />
            </View>
            {invTotal > 0 && invTotal - invSubmitted > 0 && (
              <View style={[styles.missingAlert, { backgroundColor: "#fef3c715", borderColor: "#f59e0b40" }]}>
                <Feather name="alert-triangle" size={13} color="#f59e0b" />
                <Text style={[styles.missingAlertText, { color: "#f59e0b" }]}>
                  {invTotal - invSubmitted} students have pending inventory
                </Text>
              </View>
            )}
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
              { label: "Hostels", icon: "home", path: "/admin/hostels", color: "#8b5cf6" },
              { label: "Post Alert", icon: "volume-2", path: "/admin/post-announcement", color: "#f59e0b" },
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
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 20, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1.5 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusToggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, minWidth: 90, alignItems: "center", justifyContent: "center" },
  statusToggleTxt: { fontSize: 12, fontFamily: "Inter_700Bold" },
  card: { marginHorizontal: 20, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 17, fontFamily: "Inter_700Bold" },
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
  // Assigned hostel card
  assignedHostelCard: { borderWidth: 2 },
  hostelIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hostelHighlightName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  hostelHighlightLoc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  hostelHighlightMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  assignedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  assignedBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  missingAlert: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  missingAlertText: { fontSize: 12, fontFamily: "Inter_600SemiBold", flex: 1 },
});
