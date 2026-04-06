import React, { useCallback, useEffect, useRef, useState } from "react";
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

function StatBox({ label, value, color, theme }: { label: string; value: any; color: string; theme: any }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statVal, { color }]}>{value ?? "—"}</Text>
      <Text style={[styles.statLabel, { color: theme.textTertiary }]}>{label}</Text>
    </View>
  );
}

function QuickCard({ label, icon, color, onPress, badge }: {
  label: string; icon: string; color: string; onPress: () => void; badge?: number;
}) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.quickCard, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + "1A" }]}>
        <Feather name={icon as any} size={21} color={color} />
      </View>
      <Text style={[styles.quickLabel, { color: theme.text }]} numberOfLines={1}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.quickBadge}>
          <Text style={styles.quickBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SectionCard({ icon, iconColor, title, sub, children, onViewAll }: {
  icon: string; iconColor: string; title: string; sub?: string;
  children: React.ReactNode; onViewAll?: () => void;
}) {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;
  return (
    <AnimatedCard style={[styles.card, { borderColor: iconColor + "28", borderWidth: 1.5 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.cardIconBox, { backgroundColor: iconColor + "1A" }]}>
          <Feather name={icon as any} size={17} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
          {sub && <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{sub}</Text>}
        </View>
        {onViewAll && (
          <Pressable onPress={onViewAll} style={styles.viewAllBtn} hitSlop={8}>
            <Feather name="arrow-right" size={15} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>
      {children}
    </AnimatedCard>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { user, isCoordinator, isVolunteer, isSuperAdmin, isStudent } = useAuth();
  const request = useApiRequest();
  const qc = useQueryClient();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 12;
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "coordinator";
  const assignedHostelIds: string[] = React.useMemo(() => {
    try {
      const raw: any = user?.assignedHostelIds;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
      }
      return [];
    } catch { return []; }
  }, [user?.assignedHostelIds]);

  const scopedHostelIds = React.useMemo(() => {
    if (isSuperAdmin) return null;
    if (user?.role === "volunteer") return [user?.hostelId].filter(Boolean) as string[];
    return Array.from(new Set([...(assignedHostelIds || []), user?.hostelId || ""].filter(Boolean)));
  }, [isSuperAdmin, user?.role, user?.hostelId, assignedHostelIds]);

  const { data: announcements, refetch: refetchAnn, isLoading: annLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => request("/announcements"),
    staleTime: 60000,
    refetchInterval: 120000,
  });

  const isStaff = isVolunteer || isCoordinator || isSuperAdmin;
  const { data: attStats, refetch: refetchStats } = useQuery({
    queryKey: ["att-stats"],
    queryFn: () => request("/attendance/stats"),
    enabled: isStaff,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: reportSummary } = useQuery({
    queryKey: ["report-summary"],
    queryFn: () => request("/reports/summary"),
    enabled: isCoordinator,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: scopedStudentsMeta } = useQuery<any>({
    queryKey: ["students-scope-total"],
    queryFn: () => request("/students?limit=1&offset=0"),
    enabled: isCoordinator && !isSuperAdmin,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: messStats, refetch: refetchMess } = useQuery<any>({
    queryKey: ["mess-stats"],
    queryFn: () => request("/mess-attendance/stats"),
    enabled: isStaff,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    enabled: isVolunteer && !isSuperAdmin,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ["pending-count"],
    queryFn: () => request("/approvals/count"),
    enabled: isSuperAdmin,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { data: allHostels = [] } = useQuery<any[]>({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
    enabled: isAdmin || isVolunteer,
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const assignedHostels = React.useMemo(() => {
    if (!Array.isArray(allHostels)) return [];
    return (allHostels as any[]).filter((h: any) => assignedHostelIds.includes(h.id));
  }, [allHostels, assignedHostelIds]);

  const profileHostelText = React.useMemo(() => {
    if (isSuperAdmin) return "All hostels";
    if (isStudent) return user?.hostelId ? `Hostel ${user.hostelId}` : "Hostel not assigned";
    if (isCoordinator) {
      if (assignedHostels.length > 0) return assignedHostels.map((h: any) => h.name).join(", ");
      if (assignedHostelIds.length > 0) return `${assignedHostelIds.length} assigned hostel(s)`;
      if (user?.hostelId) return `Hostel ${user.hostelId}`;
      return "No hostel assigned";
    }
    if (isVolunteer) {
      if (user?.hostelId) {
        const own = (allHostels as any[]).find((h: any) => h.id === user.hostelId);
        return own?.name || `Hostel ${user.hostelId}`;
      }
      return "No hostel assigned";
    }
    return "";
  }, [isSuperAdmin, isStudent, isCoordinator, isVolunteer, assignedHostels, assignedHostelIds.length, user?.hostelId, allHostels]);

  const volunteerHostelText = React.useMemo(() => {
    if (!isVolunteer) return "";
    if (!user?.hostelId) return "No hostel assigned";
    const own = (allHostels as any[]).find((h: any) => h.id === user.hostelId);
    return own?.name || `Hostel ${user.hostelId}`;
  }, [isVolunteer, user?.hostelId, allHostels]);

  const scopeLabel = isSuperAdmin ? "All hostels" : "Assigned hostels only";

  const { data: invStats } = useQuery<any>({
    queryKey: ["inv-stats"],
    queryFn: () => request("/inventory-simple"),
    enabled: isCoordinator,
    refetchInterval: 4000,
    staleTime: 2000,
  });
  const invStatsArr = Array.isArray(invStats) ? invStats as any[] : [];
  const invScopedArr = React.useMemo(() => {
    if (!scopedHostelIds) return invStatsArr;
    if (scopedHostelIds.length === 0) return [];
    return invStatsArr.filter((s: any) => scopedHostelIds.includes(String(s.hostelId || "")));
  }, [invStatsArr, scopedHostelIds]);
  const invSubmitted = invScopedArr.filter(s => s.inventory?.inventoryLocked).length;
  const invTotal = invScopedArr.length;

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

  useEffect(() => {
    if (!isVolunteer || isSuperAdmin || !myStatus?.isActive) {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }
    heartbeatRef.current = setInterval(async () => {
      try { await request("/staff/heartbeat", { method: "POST" }); } catch { }
    }, 5 * 60 * 1000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [isVolunteer, isSuperAdmin, myStatus?.isActive]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAnn(), refetchStats?.(), refetchStatus?.(), refetchMess?.()].filter(Boolean));
    setRefreshing(false);
  }, [refetchAnn, refetchStats, refetchStatus, refetchMess]);

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
  const requiresShift = isVolunteer && !isSuperAdmin;
  const canWork = !requiresShift || isActive;
  const pendingNum = pendingCount?.count ?? 0;

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: isWeb ? 34 : 108 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Header ───────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingHorizontal: 20 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting()}</Text>
            <Text style={[styles.heroName, { color: theme.text }]} numberOfLines={1}>
              {user?.name?.split(" ")[0] ?? "..."}
            </Text>
            {!!profileHostelText && (
              <Text style={[styles.heroHostel, { color: theme.textTertiary }]} numberOfLines={1}>{profileHostelText}</Text>
            )}
          </View>
          <Badge label={roleLabel} variant={roleBadge as any} />
        </View>

        {/* ── Staff Status Banner ───────────────────────────────────── */}
        {requiresShift && (
          <View style={[styles.statusBanner, {
            backgroundColor: isActive ? "#22c55e10" : "#f59e0b10",
            borderColor: isActive ? "#22c55e40" : "#f59e0b40",
          }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? "#22c55e" : "#f59e0b" }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusText, { color: isActive ? "#22c55e" : "#f59e0b" }]}>
                {isActive ? "Shift Active" : "Shift Inactive"}
              </Text>
              <Text style={[styles.statusSub, { color: theme.textSecondary }]}>
                {isActive ? "Auto-inactive after 10 min of no activity" : "Tap Go Active to start your shift"}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                activeStatusMutation.mutate({ goActive: !isActive });
              }}
              disabled={activeStatusMutation.isPending}
              style={[styles.shiftBtn, {
                backgroundColor: isActive ? "#ef444415" : "#22c55e15",
                borderColor: isActive ? "#ef444440" : "#22c55e40",
              }]}
            >
              {activeStatusMutation.isPending
                ? <ActivityIndicator size="small" color={isActive ? "#ef4444" : "#22c55e"} />
                : <Text style={[styles.shiftBtnText, { color: isActive ? "#ef4444" : "#22c55e" }]}>
                    {isActive ? "Deactivate" : "Go Active"}
                  </Text>
              }
            </Pressable>
          </View>
        )}

        {!canWork && (
          <AnimatedCard style={styles.card}>
            <View style={styles.emptyState}>
              <Feather name="lock" size={28} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Shift inactive</Text>
              <Text style={[styles.statusSub, { color: theme.textTertiary, textAlign: "center" }]}>
                Activate shift to view hostel data and start operations.
              </Text>
            </View>
          </AnimatedCard>
        )}

        {/* ══════════════════════════════════════════════════════════════
             VOLUNTEER (non-coordinator) view
            ══════════════════════════════════════════════════════════════ */}
        {isVolunteer && !isCoordinator && canWork && (
          <>
            <SectionCard
              icon="home"
              iconColor={theme.tint}
              title="Assigned Hostel"
              sub="Your current access scope"
              onViewAll={() => router.push("/(tabs)/hostel")}
            >
              <View style={{ paddingVertical: 4 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{volunteerHostelText || "No hostel assigned"}</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Only this hostel's data is visible in your dashboard.</Text>
              </View>
            </SectionCard>

            {/* Attendance card */}
            <SectionCard
              icon="check-square"
              iconColor="#22c55e"
              title="Today's Attendance"
              sub={new Date().toDateString()}
              onViewAll={() => router.push("/(tabs)/lostandfound")}
            >
              {attStats ? (
                <View style={styles.statsRow}>
                  <StatBox label="Total" value={attStats.total} color={theme.text} theme={theme} />
                  <StatBox label="In Campus" value={attStats.entered} color="#22c55e" theme={theme} />
                  <StatBox label="Out" value={attStats.notEntered} color="#f59e0b" theme={theme} />
                </View>
              ) : <CardSkeleton />}
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/lostandfound"); }}
                style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
              >
                <Feather name="check-square" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Mark Attendance & Inventory</Text>
              </Pressable>
            </SectionCard>

            {/* Mess Cards card */}
            <SectionCard
              icon="credit-card"
              iconColor="#f59e0b"
              title="Mess Cards"
              sub="Tap to distribute cards"
            >
              <View style={styles.statsRow}>
                <StatBox label="Given" value={messStats?.cardGivenCount ?? 0} color="#22c55e" theme={theme} />
                <StatBox label="Pending" value={(attStats?.total ?? 0) - (messStats?.cardGivenCount ?? 0)} color="#f59e0b" theme={theme} />
                <StatBox label="Total" value={attStats?.total ?? 0} color={theme.text} theme={theme} />
              </View>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/mess-card" as any); }}
                style={[styles.actionBtn, { backgroundColor: "#f59e0b" }]}
              >
                <Feather name="credit-card" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Distribute Mess Cards</Text>
              </Pressable>
            </SectionCard>

            {/* Quick grid */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, paddingHorizontal: 20, marginBottom: 10 }]}>
              Quick Access
            </Text>
            <View style={styles.quickGrid}>
              <QuickCard label="Search" icon="search" color={theme.tint} onPress={() => router.push("/admin/search")} />
              <QuickCard label="Attendance" icon="check-square" color="#22c55e" onPress={() => router.push("/(tabs)/lostandfound")} />
              <QuickCard label="Inventory" icon="package" color="#f59e0b" onPress={() => router.push("/admin/inventory-table")} />
              <QuickCard label="Mess Cards" icon="credit-card" color="#f59e0b" onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/mess-card' as any); }} />
            </View>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
             COORDINATOR / ADMIN / SUPERADMIN view
            ══════════════════════════════════════════════════════════════ */}
        {isCoordinator && canWork && (
          <>
            {/* Assigned Hostels */}
            {isAdmin && assignedHostels.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary, paddingHorizontal: 20, marginBottom: 8 }]}>
                  Your Hostels
                </Text>
                {assignedHostels.map((h: any) => (
                  <Pressable
                    key={h.id}
                    onPress={() => { Haptics.selectionAsync(); router.push("/admin/hostels" as any); }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                  >
                    <AnimatedCard style={[styles.card, { borderColor: theme.tint + "30", borderWidth: 1.5 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <View style={[styles.cardIconBox, { backgroundColor: theme.tint + "1A" }]}>
                          <Feather name="home" size={17} color={theme.tint} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, { color: theme.text }]}>{h.name}</Text>
                          {h.location && <Text style={[styles.cardSub, { color: theme.textSecondary }]}>{h.location}</Text>}
                        </View>
                        <View style={[styles.assignedPill, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                          <Text style={[styles.assignedPillText, { color: theme.tint }]}>Assigned</Text>
                        </View>
                        <Feather name="chevron-right" size={16} color={theme.textTertiary} />
                      </View>
                    </AnimatedCard>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Superadmin pending approvals alert */}
            {isSuperAdmin && pendingNum > 0 && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/admin/approvals"); }}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, marginHorizontal: 20, marginBottom: 12 })}
              >
                <View style={[styles.pendingAlert, { backgroundColor: "#ef444412", borderColor: "#ef444440" }]}>
                  <View style={[styles.pendingAlertIcon, { backgroundColor: "#ef444420" }]}>
                    <Feather name="user-check" size={16} color="#ef4444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pendingAlertTitle, { color: "#ef4444" }]}>
                      {pendingNum} Pending Approval{pendingNum > 1 ? "s" : ""}
                    </Text>
                    <Text style={[styles.pendingAlertSub, { color: theme.textSecondary }]}>
                      Tap to review and approve new registrations
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={15} color="#ef4444" />
                </View>
              </Pressable>
            )}

            {/* System Overview */}
            {reportSummary && (
              <SectionCard icon="bar-chart-2" iconColor={theme.tint} title="System Overview" sub={`${scopeLabel} · Live`}>
                <View style={styles.statsRow}>
                  <StatBox label="Students" value={isSuperAdmin ? reportSummary.totalStudents : Number(scopedStudentsMeta?.total ?? reportSummary.totalStudents ?? 0)} color={theme.tint} theme={theme} />
                  <StatBox label="Hostels" value={isSuperAdmin ? reportSummary.totalHostels : (scopedHostelIds?.length ?? 0)} color="#22c55e" theme={theme} />
                  <StatBox label="Alerts Sent" value={reportSummary.totalAnnouncements} color="#8b5cf6" theme={theme} />
                </View>
              </SectionCard>
            )}

            {/* Attendance */}
            {attStats && (
              <SectionCard
                icon="check-circle"
                iconColor="#22c55e"
                title="Room Attendance"
                sub={`Today · ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                onViewAll={() => router.push("/(tabs)/lostandfound")}
              >
                <View style={styles.statsRow}>
                  <StatBox label="Total" value={attStats.total} color={theme.text} theme={theme} />
                  <StatBox label="In Campus" value={attStats.inCampus ?? attStats.entered} color="#22c55e" theme={theme} />
                  <StatBox label="Pending" value={attStats.pending ?? attStats.notEntered} color="#f59e0b" theme={theme} />
                </View>
                {(attStats.checkedOut ?? 0) > 0 && (
                  <View style={[styles.alertRow, { backgroundColor: "#6366f110", borderColor: "#6366f130" }]}>
                    <Feather name="log-out" size={12} color="#6366f1" />
                    <Text style={[styles.alertText, { color: "#6366f1" }]}>
                      {attStats.checkedOut} student{attStats.checkedOut !== 1 ? "s" : ""} checked out
                    </Text>
                  </View>
                )}
              </SectionCard>
            )}

            {/* Inventory */}
            <SectionCard
              icon="package"
              iconColor="#06b6d4"
              title="Inventory Status"
              sub={`Live · ${scopeLabel}`}
              onViewAll={() => router.push("/admin/inventory-table")}
            >
              <View style={styles.statsRow}>
                <StatBox label="Total" value={invTotal} color={theme.text} theme={theme} />
                <StatBox label="Submitted" value={invSubmitted} color="#06b6d4" theme={theme} />
                <StatBox label="Pending" value={invTotal - invSubmitted} color="#f59e0b" theme={theme} />
              </View>
              {invTotal > 0 && invTotal - invSubmitted > 0 && (
                <View style={[styles.alertRow, { backgroundColor: "#fef3c710", borderColor: "#f59e0b40" }]}>
                  <Feather name="alert-triangle" size={12} color="#f59e0b" />
                  <Text style={[styles.alertText, { color: "#f59e0b" }]}>
                    {invTotal - invSubmitted} students have pending inventory
                  </Text>
                </View>
              )}
            </SectionCard>

            {/* Mess Cards */}
            <SectionCard
              icon="credit-card"
              iconColor="#22c55e"
              title="Mess Cards"
              sub="Live · Today"
              onViewAll={() => router.push('/(tabs)/mess-card' as any)}
            >
              <View style={styles.statsRow}>
                <StatBox label="Total" value={attStats?.total ?? messStats?.totalStudents ?? 0} color={theme.text} theme={theme} />
                <StatBox label="Given" value={messStats?.cardGivenCount ?? 0} color="#22c55e" theme={theme} />
                <StatBox label="Pending" value={(attStats?.total ?? messStats?.totalStudents ?? 0) - (messStats?.cardGivenCount ?? 0)} color="#f59e0b" theme={theme} />
              </View>
              <Pressable
                onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/mess-card" as any); }}
                style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
              >
                <Feather name="credit-card" size={15} color="#fff" />
                <Text style={styles.actionBtnText}>Manage Mess Cards</Text>
              </Pressable>
            </SectionCard>

            {/* Quick Grid */}
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, paddingHorizontal: 20, marginBottom: 10 }]}>
              Quick Access
            </Text>
            <View style={styles.quickGrid}>
              <QuickCard label="Students" icon="users" color={theme.tint} onPress={() => router.push("/(tabs)/hostel")} />
              <QuickCard label="Attendance" icon="check-square" color="#22c55e" onPress={() => router.push("/(tabs)/lostandfound")} />
              <QuickCard label="Mess Cards" icon="credit-card" color="#f59e0b" onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/mess-card' as any); }} />
              <QuickCard label="Inventory" icon="package" color="#06b6d4" onPress={() => router.push("/admin/inventory-table")} />
              <QuickCard label="Search" icon="search" color="#3b82f6" onPress={() => router.push("/admin/search")} />
              <QuickCard label="Staff" icon="activity" color="#8b5cf6" onPress={() => router.push("/admin/staff-status")} />
              <QuickCard label="Hostels" icon="home" color="#f59e0b" onPress={() => router.push("/admin/hostels")} />
              <QuickCard label="Post Alert" icon="volume-2" color="#ef4444" onPress={() => router.push("/admin/post-announcement")} />
              {isSuperAdmin && <>
                <QuickCard label="Approvals" icon="user-check" color="#ef4444" badge={pendingNum} onPress={() => router.push("/admin/approvals")} />
                <QuickCard label="Activity Logs" icon="clock" color="#06b6d4" onPress={() => router.push("/admin/activity-logs")} />
                <QuickCard label="CSV Import" icon="upload-cloud" color="#f59e0b" onPress={() => router.push("/admin/csv-import")} />
                <QuickCard label="Reports" icon="download" color="#ef4444" onPress={() => router.push("/admin/reports")} />
                <QuickCard label="Master Table" icon="database" color="#6366f1" onPress={() => router.push("/admin/master-table")} />
                <QuickCard label="Manage Admins" icon="user-plus" color="#8b5cf6" onPress={() => router.push("/admin/manage-admins")} />
              </>}
            </View>
          </>
        )}

        {/* ── Student view ────────────────────────────────────────────── */}
        {isStudent && (
          <AnimatedCard style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.cardIconBox, { backgroundColor: theme.tint + "1A" }]}>
                <Feather name="home" size={17} color={theme.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>My Hostel</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  {user?.hostelId ? "View details & contacts" : "No hostel assigned yet"}
                </Text>
              </View>
              <Pressable onPress={() => { Haptics.selectionAsync(); router.push("/(tabs)/hostel"); }} hitSlop={10}>
                <Feather name="chevron-right" size={17} color={theme.textTertiary} />
              </Pressable>
            </View>
          </AnimatedCard>
        )}

        {/* ── Announcements (all roles) ──────────────────────────────── */}
        {canWork && (
          <>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary, paddingHorizontal: 20, marginBottom: 8, marginTop: 4 }]}>
              Announcements
            </Text>

            {annLoading ? (
              <View style={{ paddingHorizontal: 20 }}><CardSkeleton /><CardSkeleton /></View>
            ) : !announcements?.length ? (
              <AnimatedCard style={styles.card}>
                <View style={styles.emptyState}>
                  <Feather name="bell-off" size={28} color={theme.textTertiary} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No announcements</Text>
                </View>
              </AnimatedCard>
            ) : (
              announcements.slice(0, 5).map((a: any) => (
                <AnimatedCard key={a.id} style={styles.card}>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={[styles.annDot, { backgroundColor: theme.tint }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.annTitle, { color: theme.text }]}>{a.title}</Text>
                      <Text style={[styles.annBody, { color: theme.textSecondary }]} numberOfLines={2}>{a.content}</Text>
                      <Text style={[styles.annDate, { color: theme.textTertiary }]}>
                        {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </Text>
                    </View>
                  </View>
                </AnimatedCard>
              ))
            )}
          </>
        )}
      </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  heroName: { fontSize: 26, fontFamily: "Inter_700Bold" },
  heroHostel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statusBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 20, marginBottom: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  shiftBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  shiftBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  pendingAlert: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  pendingAlertIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pendingAlertTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  pendingAlertSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  card: { marginHorizontal: 20, marginBottom: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  cardIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  viewAllBtn: { padding: 4 },
  statsRow: { flexDirection: "row", gap: 0, marginBottom: 2 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 10 },
  statVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10, borderRadius: 10, paddingVertical: 11 },
  actionBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, padding: 8, borderRadius: 8, borderWidth: 1 },
  alertText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  quickCard: { width: "22%", minWidth: 76, alignItems: "center", padding: 12, borderRadius: 14, borderWidth: 1, gap: 6, position: "relative" },
  quickIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  quickBadge: { position: "absolute", top: 6, right: 6, backgroundColor: "#ef4444", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  quickBadgeText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  assignedPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  assignedPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  annDot: { width: 3, borderRadius: 2, marginTop: 4, alignSelf: "stretch" },
  annTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  annBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  annDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
