import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView,
  Platform, useColorScheme, ActivityIndicator, RefreshControl, Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";

const PROD_API = "https://zip-12--vpahaddevbhoomi.replit.app/api";
const API_BASE: string =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  PROD_API;

const LOG_TYPES: Record<string, { icon: string; color: string; label: string }> = {
  active:    { icon: "sun",           color: "#22c55e", label: "Went Active" },
  inactive:  { icon: "moon",          color: "#6B7280", label: "Went Inactive" },
  login:     { icon: "log-in",        color: "#3b82f6", label: "Login" },
  logout:    { icon: "log-out",       color: "#ef4444", label: "Logout" },
  checkin:   { icon: "check-circle",  color: "#8b5cf6", label: "Check-in" },
  entry:     { icon: "arrow-right",   color: "#f59e0b", label: "Entry" },
  custom:    { icon: "edit-2",        color: "#06b6d4", label: "Custom" },
};

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Staff Profile Modal ──────────────────────────────────────────────────────

function StaffProfileModal({ staffId, visible, onClose, theme, token }: {
  staffId: string | null;
  visible: boolean;
  onClose: () => void;
  theme: any;
  token: string | null | undefined;
}) {
  const request = useApiRequest();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ staff: any; logs: any[]; total: number }>({
    queryKey: ["staff-profile", staffId],
    queryFn: () => request(`/staff/${staffId}/logs?limit=200`),
    enabled: visible && !!staffId,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const downloadCSV = () => {
    Haptics.selectionAsync();
    const url = `${API_BASE}/export/timelogs?userId=${staffId}`;
    if (Platform.OS === "web") {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u; a.download = `staff-${data?.staff?.name || staffId}-logs.csv`; a.click();
          URL.revokeObjectURL(u);
        }).catch(() => Alert.alert("Error", "Download failed"));
    } else {
      Alert.alert("Download", "Available on web version.");
    }
  };

  const staff = data?.staff;
  const logs = data?.logs || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          {isLoading ? (
            <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} />
          ) : staff ? (
            <>
              {/* Staff header */}
              <View style={styles.staffHeader}>
                <View style={[styles.staffAvatar, { backgroundColor: theme.tint + "20" }]}>
                  <Text style={[styles.staffAvatarText, { color: theme.tint }]}>{(staff.name || "?").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.staffName, { color: theme.text }]}>{staff.name}</Text>
                  <Text style={[styles.staffMeta, { color: theme.textSecondary }]}>{staff.email}</Text>
                  {staff.hostelName && <Text style={[styles.staffMeta, { color: theme.textTertiary }]}>{staff.hostelName}</Text>}
                </View>
                <View style={[styles.onlineBadge, { backgroundColor: staff.isOnline ? "#22c55e20" : "#6B728020" }]}>
                  <View style={[styles.onlineDot, { backgroundColor: staff.isOnline ? "#22c55e" : "#6B7280" }]} />
                  <Text style={[styles.onlineText, { color: staff.isOnline ? "#22c55e" : "#6B7280" }]}>
                    {staff.isOnline ? "Online" : "Offline"}
                  </Text>
                </View>
              </View>

              {/* Detail info row: hostel, last login, last logout */}
              {(() => {
                const lastLogin = logs.find((l: any) => l.type === "login");
                const lastLogout = logs.find((l: any) => l.type === "logout");
                return (
                  <View style={styles.detailRow}>
                    {staff.hostelName ? (
                      <View style={[styles.detailChip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Feather name="home" size={11} color={theme.tint} />
                        <Text style={[styles.detailChipLabel, { color: theme.textSecondary }]}>Posted at</Text>
                        <Text style={[styles.detailChipVal, { color: theme.text }]}>{staff.hostelName}</Text>
                      </View>
                    ) : null}
                    {staff.role ? (
                      <View style={[styles.detailChip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <Feather name="shield" size={11} color="#8b5cf6" />
                        <Text style={[styles.detailChipLabel, { color: theme.textSecondary }]}>Role</Text>
                        <Text style={[styles.detailChipVal, { color: "#8b5cf6" }]}>{staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}</Text>
                      </View>
                    ) : null}
                    {lastLogin ? (
                      <View style={[styles.detailChip, { backgroundColor: "#3b82f612", borderColor: "#3b82f630" }]}>
                        <Feather name="log-in" size={11} color="#3b82f6" />
                        <Text style={[styles.detailChipLabel, { color: theme.textSecondary }]}>Last Login</Text>
                        <Text style={[styles.detailChipVal, { color: "#3b82f6" }]}>{formatTime(lastLogin.createdAt)}</Text>
                      </View>
                    ) : null}
                    {lastLogout ? (
                      <View style={[styles.detailChip, { backgroundColor: "#ef444412", borderColor: "#ef444430" }]}>
                        <Feather name="log-out" size={11} color="#ef4444" />
                        <Text style={[styles.detailChipLabel, { color: theme.textSecondary }]}>Last Logout</Text>
                        <Text style={[styles.detailChipVal, { color: "#ef4444" }]}>{formatTime(lastLogout.createdAt)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })()}

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.statVal, { color: theme.tint }]}>{logs.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Logs</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.statVal, { color: "#22c55e" }]}>{logs.filter(l => l.type === "active").length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Active Events</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.statVal, { color: "#6B7280" }]}>{timeAgo(staff.lastActiveAt)}</Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Last Seen</Text>
                </View>
              </View>

              {/* Download + title */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={[styles.logsTitle, { color: theme.text }]}>Full Log History ({logs.length})</Text>
                <Pressable onPress={downloadCSV} style={[styles.dlBtn, { borderColor: theme.border }]}>
                  <Feather name="download" size={14} color={theme.tint} />
                  <Text style={[styles.dlBtnText, { color: theme.tint }]}>CSV</Text>
                </Pressable>
              </View>

              {/* Log list */}
              <FlatList
                data={logs}
                keyExtractor={l => l.id}
                style={{ maxHeight: 340 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                ListEmptyComponent={() => (
                  <Text style={[{ color: theme.textSecondary, textAlign: "center", paddingVertical: 20, fontFamily: "Inter_400Regular", fontSize: 13 }]}>No logs yet</Text>
                )}
                renderItem={({ item }) => {
                  const lt = LOG_TYPES[item.type] || { icon: "circle", color: "#6B7280", label: item.type };
                  return (
                    <View style={[styles.miniLog, { backgroundColor: theme.background, borderColor: theme.border, borderLeftColor: lt.color }]}>
                      <View style={[styles.miniLogIcon, { backgroundColor: lt.color + "20" }]}>
                        <Feather name={lt.icon as any} size={13} color={lt.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={[styles.miniLogType, { color: lt.color }]}>{lt.label}</Text>
                          <Text style={[styles.miniLogTime, { color: theme.textTertiary }]}>{formatDate(item.createdAt)}</Text>
                        </View>
                        {item.note && <Text style={[styles.miniLogNote, { color: theme.textSecondary }]}>"{item.note}"</Text>}
                      </View>
                    </View>
                  );
                }}
              />
            </>
          ) : (
            <Text style={[{ color: theme.textSecondary, textAlign: "center", padding: 40, fontFamily: "Inter_400Regular" }]}>Staff not found</Text>
          )}

          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.border }]}>
            <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ActivityLogsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = Platform.OS === "web" ? 24 : Math.max(insets.top + 20, 100);
  const request = useApiRequest();
  const { token } = useAuth();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["activity-logs"],
    queryFn: () => request("/staff/logs?limit=200"),
    refetchInterval: 15000,
    staleTime: 8000,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const downloadPDF = () => {
    Haptics.selectionAsync();
    const url = `${API_BASE}/pdf/activity-logs`;
    if (Platform.OS === "web") {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u; a.download = "activity-logs.pdf"; a.click();
          URL.revokeObjectURL(u);
        }).catch(() => Alert.alert("Error", "Download failed"));
    } else {
      Alert.alert("Download", "PDF download is available on web.");
    }
  };

  const downloadCSV = () => {
    Haptics.selectionAsync();
    const url = `${API_BASE}/export/timelogs`;
    if (Platform.OS === "web") {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const u = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = u; a.download = "activity-logs.csv"; a.click();
          URL.revokeObjectURL(u);
        }).catch(() => Alert.alert("Error", "Download failed"));
    } else {
      Alert.alert("Download", "CSV download available on web.");
    }
  };

  const filtered = (logs as any[]).filter(l => {
    const matchFilter = filter === "all" || l.type === filter;
    const matchSearch = !search || (l.userName || "").toLowerCase().includes(search.toLowerCase()) || (l.note || "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  // Group unique staff for stats
  const uniqueStaff = [...new Set(filtered.map(l => l.userId))].length;

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 16, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Activity Logs</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Live · refreshes every 15s</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={downloadCSV} style={[styles.iconBtn, { borderColor: theme.border }]}>
            <Feather name="download" size={16} color={theme.tint} />
          </Pressable>
          <Pressable onPress={downloadPDF} style={[styles.iconBtn, { borderColor: theme.border }]}>
            <Feather name="file-text" size={16} color="#ef4444" />
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by staff name or remark…"
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["all", "active", "inactive", "login", "logout", "checkin", "entry"].map(f => (
              <Pressable
                key={f}
                onPress={() => { setFilter(f); Haptics.selectionAsync(); }}
                style={[styles.filterChip, filter === f && { backgroundColor: theme.tint + "20", borderColor: theme.tint }]}
              >
                <Text style={[styles.filterChipText, { color: filter === f ? theme.tint : theme.textSecondary }]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Count */}
      <Text style={[styles.countText, { color: theme.textSecondary }]}>
        {filtered.length} logs · {uniqueStaff} staff · tap a row to see full profile
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={l => l.id}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: Platform.OS === "web" ? 80 : 90, flexGrow: 1 }}
        showsVerticalScrollIndicator
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={() =>
          isLoading ? <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} /> : (
            <View style={styles.empty}>
              <Feather name="activity" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No logs found</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const lt = LOG_TYPES[item.type] || { icon: "circle", color: "#6B7280", label: item.type };
          return (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setSelectedStaffId(item.userId); }}
              style={[styles.logCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: lt.color }]}
            >
              <View style={[styles.logIcon, { backgroundColor: lt.color + "20" }]}>
                <Feather name={lt.icon as any} size={16} color={lt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.logTop}>
                  <Text style={[styles.logUser, { color: theme.text }]}>{item.userName || "Unknown"}</Text>
                  <Text style={[styles.logTime, { color: theme.textTertiary }]}>{formatTime(item.createdAt)}</Text>
                </View>
                <View style={styles.logMid}>
                  <Text style={[styles.logAction, { color: lt.color }]}>{lt.label}</Text>
                  {item.userRole && <Text style={[styles.logRole, { color: theme.textTertiary }]}>· {item.userRole}</Text>}
                </View>
                {item.note && <Text style={[styles.logNote, { color: theme.textSecondary }]}>"{item.note}"</Text>}
              </View>
              <Feather name="chevron-right" size={14} color={theme.textTertiary} />
            </Pressable>
          );
        }}
      />

      <StaffProfileModal
        staffId={selectedStaffId}
        visible={!!selectedStaffId}
        onClose={() => setSelectedStaffId(null)}
        theme={theme}
        token={token}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 20, borderBottomWidth: 1, gap: 14 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  searchRow: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  filterRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "transparent" },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countText: { fontSize: 12, fontFamily: "Inter_400Regular", paddingHorizontal: 16, paddingVertical: 8 },
  logCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1, borderLeftWidth: 3 },
  logIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logUser: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  logTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  logMid: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  logAction: { fontSize: 12, fontFamily: "Inter_500Medium" },
  logRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logNote: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 4 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Staff profile modal
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "90%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 16 },
  staffHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  staffAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  staffAvatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  staffMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  detailChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  detailChipVal: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 2 },
  statVal: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  logsTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  dlBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dlBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  miniLog: { flexDirection: "row", gap: 10, padding: 10, borderRadius: 10, borderWidth: 1, borderLeftWidth: 3, alignItems: "flex-start" },
  miniLogIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  miniLogType: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  miniLogTime: { fontSize: 10, fontFamily: "Inter_400Regular" },
  miniLogNote: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic", marginTop: 2 },
  closeBtn: { marginTop: 16, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
