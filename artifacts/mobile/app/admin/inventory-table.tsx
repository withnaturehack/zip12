import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput, ScrollView,
  Platform, useColorScheme, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useDebounce } from "@/hooks/useDebounce";

export default function InventoryTableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isCompactPhone = !isWeb && width < 430;
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const { isVolunteer, isSuperAdmin } = useAuth();
  const [filter, setFilter] = useState<"all" | "missing" | "submitted">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activating, setActivating] = useState(false);

  const requiresShift = isVolunteer && !isSuperAdmin;
  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    enabled: requiresShift,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const canWork = !requiresShift || !!myStatus?.isActive;

  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["inventory-simple"],
    queryFn: () => request("/inventory-simple"),
    enabled: canWork,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const [liveNow, setLiveNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => {
    const source = ((data as any[]) || []).filter(Boolean);
    const map = new Map<string, any>();
    for (const student of source) {
      const roll = String(student.rollNumber || "").trim().toLowerCase();
      const email = String(student.email || "").trim().toLowerCase();
      const nameRoom = `${String(student.name || "").trim().toLowerCase()}|${String(student.roomNumber || "").trim().toLowerCase()}|${String(student.hostelId || "").trim().toLowerCase()}`;
      const key = roll || email || nameRoom || String(student.id);
      if (!map.has(key)) map.set(key, student);
    }
    return Array.from(map.values()) as any[];
  }, [data]);
  const hasAnyGiven = (inv: any) => !!(inv?.mattress || inv?.bedsheet || inv?.pillow);
  const hasPendingGiven = (inv: any) => !!(
    (inv?.mattress && !inv?.mattressSubmitted) ||
    (inv?.bedsheet && !inv?.bedsheetSubmitted) ||
    (inv?.pillow && !inv?.pillowSubmitted)
  );

  const statusOf = (student: any): "green" | "yellow" | "red" | "black" => {
    const inv = student?.inventory || {};
    const isLocked = !!inv.inventoryLocked;
    const anyGiven = hasAnyGiven(inv);
    const pending = hasPendingGiven(inv);
    const checkedIn = !!student?.checkInTime;
    const checkedOut = !!student?.checkOutTime;

    if (isLocked || (anyGiven && !pending)) return "green";
    if (pending && checkedOut) return "red";
    if (pending && checkedIn) return "yellow";
    return "black";
  };

  const submittedCount = items.filter(s => statusOf(s) === "green").length;
  const checkedInPendingCount = items.filter(s => statusOf(s) === "yellow").length;
  const checkedOutPendingCount = items.filter(s => statusOf(s) === "red").length;
  const notTakenCount = items.filter(s => statusOf(s) === "black").length;
  const pendingSubmitCount = checkedInPendingCount + checkedOutPendingCount;

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter(s => {
      if (q) {
        const haystack = [s.name, s.rollNumber, s.roomNumber, s.hostelId, s.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "submitted") return !!s.inventory?.inventoryLocked;
      if (filter === "missing") return hasAnyGiven(s.inventory) && hasPendingGiven(s.inventory);
      return true;
    });
  }, [items, debouncedSearch, filter]);

  const sortedItems = useMemo(() => {
    const priority = { red: 0, yellow: 1, green: 2, black: 3 } as const;
    return [...filteredItems].sort((a, b) => {
      const sa = statusOf(a);
      const sb = statusOf(b);
      if (priority[sa] !== priority[sb]) return priority[sa] - priority[sb];

      const ta = new Date(a?.checkOutTime || a?.checkInTime || 0).getTime();
      const tb = new Date(b?.checkOutTime || b?.checkInTime || 0).getTime();
      if (ta !== tb) return tb - ta;

      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [filteredItems]);

  const lastSyncAgoSec = Math.max(0, Math.floor((liveNow - dataUpdatedAt) / 1000));

  const goActive = async () => {
    setActivating(true);
    try {
      await request("/staff/go-active", { method: "POST", body: JSON.stringify({}) });
      await refetchStatus();
    } catch {
    } finally {
      setActivating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: theme.text }]}>Inventory</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Live hostel issue and submit status</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: theme.textSecondary }]}>Live · updated {lastSyncAgoSec}s ago</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Overview */}
      {isCompactPhone ? (
        <View style={[styles.compactOverviewWrap, { borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactOverviewRow}>
            <CompactMetric label="Done" value={String(submittedCount)} color="#22c55e" />
            <CompactMetric label="In+Pending" value={String(checkedInPendingCount)} color="#eab308" />
            <CompactMetric label="Out+Pending" value={String(checkedOutPendingCount)} color="#ef4444" />
            <CompactMetric label="Not Taken" value={String(notTakenCount)} color="#64748b" />
            <CompactMetric label="Total" value={String(items.length)} color={theme.tint} />
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.overviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.overviewTitle, { color: theme.text }]}>Student Status</Text>
          <View style={styles.overviewGrid}>
            <OverviewMetric label="Submitted" value={String(submittedCount)} color="#22c55e" />
            <OverviewMetric label="Check-in Pending" value={String(checkedInPendingCount)} color="#eab308" />
            <OverviewMetric label="Check-out Pending" value={String(checkedOutPendingCount)} color="#ef4444" />
            <OverviewMetric label="Not Taken" value={String(notTakenCount)} color="#64748b" />
            <OverviewMetric label="Pending" value={String(pendingSubmitCount)} color="#f59e0b" />
            <OverviewMetric label="Total" value={String(items.length)} color={theme.tint} />
          </View>
        </View>
      )}

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, roll, room…"
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
        {(["all", "missing", "submitted"] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, {
              backgroundColor: filter === f
                ? (f === "missing" ? "#ef444420" : f === "submitted" ? "#22c55e20" : theme.tint + "20")
                : "transparent",
              borderColor: filter === f
                ? (f === "missing" ? "#ef444440" : f === "submitted" ? "#22c55e40" : theme.tint + "40")
                : "transparent",
            }]}
          >
            <Text style={[styles.filterBtnText, {
              color: filter === f
                ? (f === "missing" ? "#ef4444" : f === "submitted" ? "#22c55e" : theme.tint)
                : theme.textSecondary,
            }]}>
              {f === "all" ? "All" : f === "missing" ? "Pending" : "Done"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultsRow}>
        <Text style={[styles.resultsText, { color: theme.textSecondary }]}>Showing {sortedItems.length} of {items.length}</Text>
      </View>

      {/* Table header */}
      <View style={[styles.tableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.thName, { color: theme.textSecondary }]}>STUDENT</Text>
        <Text style={[styles.thStatus, { color: theme.textSecondary }]}>STATUS</Text>
        <View style={styles.thItems}>
          {["M", "B", "P"].map(h => (
            <Text key={h} style={[styles.thItem, { color: theme.textSecondary }]}>{h}</Text>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(i, idx) => {
            const roll = String(i?.rollNumber || "").trim().toLowerCase();
            const email = String(i?.email || "").trim().toLowerCase();
            const hostel = String(i?.hostelId || "").trim().toLowerCase();
            const room = String(i?.roomNumber || "").trim().toLowerCase();
            const name = String(i?.name || "").trim().toLowerCase();
            const id = String(i?.id || "").trim();
            return id || roll || email || `${name}|${room}|${hostel}|${idx}`;
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          removeClippedSubviews
          windowSize={11}
          initialNumToRender={18}
          maxToRenderPerBatch={28}
          updateCellsBatchingPeriod={40}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filter === "missing" ? "No pending inventory!" : filter === "submitted" ? "None submitted yet" : "No students found"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const inv = item.inventory || {};
            const pendingSubmitItems = (["mattress", "bedsheet", "pillow"] as const).filter(f => !!inv[f] && !inv[`${f}Submitted`]);
            const anyGiven = hasAnyGiven(inv);
            const rowStatus = statusOf(item);
            const isLocked = rowStatus === "green";
            const borderLeftColor = rowStatus === "green"
              ? "#22c55e"
              : rowStatus === "yellow"
                ? "#eab308"
                : rowStatus === "red"
                  ? "#ef4444"
                  : "#64748b";

            return (
              <View style={[styles.tableRow, {
                backgroundColor: isLocked ? "#22c55e05" : theme.background,
                borderColor: theme.border,
                borderLeftWidth: 3,
                borderLeftColor,
              }]}>
                <View style={styles.nameCol}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.rollNumber || ""} {item.roomNumber ? `· ${item.roomNumber}` : ""}
                  </Text>
                  {/* Missing items warning */}
                  {!isLocked && pendingSubmitItems.length > 0 && (
                    <Text style={[styles.missingText, { color: "#ef4444" }]}>
                      Not submitted: {pendingSubmitItems.join(", ")}
                    </Text>
                  )}
                  {!isLocked && !anyGiven && (
                    <Text style={[styles.missingText, { color: theme.textTertiary }]}>No inventory issued</Text>
                  )}
                </View>

                {/* Status badge */}
                <View style={styles.statusCol}>
                  {rowStatus === "green" ? (
                    <View style={styles.submittedBadge}>
                      <Feather name="lock" size={10} color="#16a34a" />
                      <Text style={styles.submittedText}>Done</Text>
                    </View>
                  ) : rowStatus === "red" ? (
                    <View style={[styles.statusPill, { backgroundColor: "#fee2e2" }]}>
                      <Text style={[styles.statusPillText, { color: "#b91c1c" }]}>Out + Pending</Text>
                    </View>
                  ) : rowStatus === "yellow" ? (
                    <View style={[styles.statusPill, { backgroundColor: "#fef3c7" }]}>
                      <Text style={[styles.statusPillText, { color: "#a16207" }]}>In + Pending</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: "#334155" }]}>
                      <Text style={[styles.statusPillText, { color: "#e2e8f0" }]}>Not Taken</Text>
                    </View>
                  )}
                </View>

                {/* Read-only item states */}
                <View style={styles.toggleRow}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                    const val = !!inv[field];
                    const submitted = !!inv[`${field}Submitted`];
                    const toggleBorderColor = submitted ? "#22c55e" : val ? "#f59e0b" : "#475569";
                    const toggleBgColor = submitted ? "#22c55e20" : val ? "#fef3c7" : "#334155";
                    const toggleIconColor = submitted ? "#22c55e" : val ? "#a16207" : "#e2e8f0";
                    return (
                      <View
                        key={field}
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: toggleBgColor, borderColor: toggleBorderColor },
                        ]}
                      >
                        <Feather name={submitted ? "check-circle" : val ? "clock" : "minus"} size={14} color={toggleIconColor} />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {!canWork && (
        <View style={styles.lockOverlay}>
          <BlurView intensity={70} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name="lock" size={20} color={theme.textSecondary} />
            <Text style={[styles.lockTitle, { color: theme.text }]}>Shift inactive</Text>
            <Text style={[styles.lockSub, { color: theme.textSecondary }]}>Start shift to access attendance, inventory and student data.</Text>
            <Pressable
              onPress={goActive}
              disabled={activating}
              style={[styles.lockBtn, { backgroundColor: theme.tint, opacity: activating ? 0.7 : 1 }]}
            >
              <Text style={styles.lockBtnText}>{activating ? "Starting..." : "Go Active"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function OverviewMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderColor: color + "35", backgroundColor: color + "12" }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
    </View>
  );
}

function CompactMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.compactMetric, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={[styles.compactMetricValue, { color }]}>{value}</Text>
      <Text style={[styles.compactMetricLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 24 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#22c55e" },
  liveText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  compactOverviewWrap: { borderBottomWidth: 1, paddingTop: 4, paddingBottom: 4 },
  compactOverviewRow: { paddingHorizontal: 14, gap: 6 },
  compactMetric: { minWidth: 92, borderRadius: 8, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  compactMetricValue: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 16 },
  compactMetricLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", lineHeight: 12 },
  overviewCard: { marginHorizontal: 14, marginTop: 6, borderRadius: 12, borderWidth: 1, padding: 8, gap: 6 },
  overviewTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metricCard: { width: "31.8%", borderRadius: 8, borderWidth: 1, paddingVertical: 6, alignItems: "center", justifyContent: "center", gap: 1 },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  searchRow: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 5 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  filterRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 7, gap: 8, borderBottomWidth: 0 },
  filterBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultsRow: { paddingHorizontal: 14, paddingBottom: 6 },
  resultsText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  thName: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thStatus: { width: 58, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thItems: { flexDirection: "row", gap: 6 },
  thItem: { width: 36, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, paddingLeft: 10 },
  nameCol: { flex: 1, marginRight: 6 },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  missingText: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statusCol: { width: 58, alignItems: "center" },
  submittedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  submittedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#16a34a" },
  statusPill: { paddingHorizontal: 7, paddingVertical: 5, borderRadius: 6 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: { width: 36, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20 },
  lockCard: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center", gap: 8, width: "100%", maxWidth: 340 },
  lockTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  lockBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  lockBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});
