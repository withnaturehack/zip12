import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export default function InventoryTableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const qc = useQueryClient();
  const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "missing" | "submitted">("all");

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["inventory-simple"],
    queryFn: () => request("/inventory-simple"),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchInterval: 8000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const mutation = useMutation({
    mutationFn: ({ studentId, field, value }: { studentId: string; field: string; value: boolean }) =>
      request(`/inventory-simple/${studentId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory-simple"] }),
  });

  const submitMutation = useMutation({
    mutationFn: (studentId: string) =>
      request(`/attendance/inventory/${studentId}/submit`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-simple"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const toggle = useCallback(async (studentId: string, field: string, current: boolean) => {
    if (current) return;
    const key = `${studentId}-${field}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingMap(p => ({ ...p, [key]: true }));
    try { await mutation.mutateAsync({ studentId, field, value: true }); }
    catch { }
    setUpdatingMap(p => ({ ...p, [key]: false }));
  }, [mutation]);

  const submitInventory = useCallback(async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmittingMap(p => ({ ...p, [studentId]: true }));
    try {
      await submitMutation.mutateAsync(studentId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }
    setSubmittingMap(p => ({ ...p, [studentId]: false }));
  }, [submitMutation]);

  const items = data as any[];
  const withMattress = items.filter(s => s.inventory?.mattress).length;
  const withBedsheet = items.filter(s => s.inventory?.bedsheet).length;
  const withPillow = items.filter(s => s.inventory?.pillow).length;
  const submittedCount = items.filter(s => s.inventory?.inventoryLocked).length;
  const missingCount = items.filter(s => !s.inventory?.inventoryLocked).length;

  const filteredItems = items.filter(s => {
    if (filter === "submitted") return !!s.inventory?.inventoryLocked;
    if (filter === "missing") return !s.inventory?.inventoryLocked;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Inventory</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Stats row */}
      <View style={[styles.statsRow, { borderBottomColor: theme.border }]}>
        <StatChip label="Mattress" count={withMattress} total={items.length} color="#6366f1" theme={theme} />
        <StatChip label="Bedsheet" count={withBedsheet} total={items.length} color="#06b6d4" theme={theme} />
        <StatChip label="Pillow" count={withPillow} total={items.length} color="#f59e0b" theme={theme} />
      </View>

      {/* Submitted vs Missing summary */}
      <View style={[styles.summaryRow, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.summaryItem}>
          <Feather name="check-circle" size={14} color="#22c55e" />
          <Text style={[styles.summaryNum, { color: "#22c55e" }]}>{submittedCount}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Submitted</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryItem}>
          <Feather name="alert-circle" size={14} color="#ef4444" />
          <Text style={[styles.summaryNum, { color: "#ef4444" }]}>{missingCount}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Pending</Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryItem}>
          <Feather name="users" size={14} color={theme.tint} />
          <Text style={[styles.summaryNum, { color: theme.tint }]}>{items.length}</Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total</Text>
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
              {f === "all" ? `All (${items.length})` : f === "missing" ? `Pending (${missingCount})` : `Done (${submittedCount})`}
            </Text>
          </Pressable>
        ))}
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
          data={filteredItems}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Feather name="package" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filter === "missing" ? "No pending inventory!" : filter === "submitted" ? "None submitted yet" : "No students found"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const inv = item.inventory || {};
            const isLocked = !!inv.inventoryLocked;
            const allGiven = inv.mattress && inv.bedsheet && inv.pillow;
            const missingItems = (["mattress", "bedsheet", "pillow"] as const).filter(f => !inv[f]);
            const isSubmitting = submittingMap[item.id];

            return (
              <View style={[styles.tableRow, {
                backgroundColor: isLocked ? "#22c55e05" : theme.background,
                borderLeftWidth: 3,
                borderLeftColor: isLocked ? "#22c55e" : missingItems.length > 0 ? "#ef4444" : "#f59e0b",
              }]}>
                <View style={styles.nameCol}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.rollNumber || ""} {item.roomNumber ? `· ${item.roomNumber}` : ""}
                  </Text>
                  {/* Missing items warning */}
                  {!isLocked && missingItems.length > 0 && (
                    <Text style={[styles.missingText, { color: "#ef4444" }]}>
                      Missing: {missingItems.join(", ")}
                    </Text>
                  )}
                </View>

                {/* Status badge + submit */}
                <View style={styles.statusCol}>
                  {isLocked ? (
                    <View style={styles.submittedBadge}>
                      <Feather name="lock" size={10} color="#16a34a" />
                      <Text style={styles.submittedText}>Done</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => submitInventory(item.id)}
                      disabled={isSubmitting}
                      style={[styles.submitSmallBtn, { backgroundColor: allGiven ? "#06b6d4" : "#f59e0b", opacity: isSubmitting ? 0.6 : 1 }]}
                    >
                      {isSubmitting
                        ? <ActivityIndicator size="small" color="#fff" style={{ width: 14 }} />
                        : <Text style={styles.submitSmallText}>Submit</Text>}
                    </Pressable>
                  )}
                </View>

                {/* Item toggles */}
                <View style={styles.toggleRow}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                    const key = `${item.id}-${field}`;
                    const isUpdating = updatingMap[key];
                    const val = !!inv[field];
                    return (
                      <Pressable
                        key={field}
                        onPress={() => !isLocked && toggle(item.id, field, val)}
                        disabled={isLocked || isUpdating}
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: val ? "#22c55e20" : theme.surface, borderColor: val ? "#22c55e" : isLocked ? theme.border : "#ef444440" },
                        ]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color={val ? "#22c55e" : "#ef4444"} />
                        ) : (
                          <Feather name={val ? "check" : "minus"} size={14} color={val ? "#22c55e" : isLocked ? theme.textTertiary : "#ef4444"} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function StatChip({ label, count, total, color, theme }: any) {
  return (
    <View style={[styles.statChip, { backgroundColor: color + "15", borderColor: color + "40" }]}>
      <Text style={[styles.statCount, { color }]}>{count}/{total}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  statsRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderBottomWidth: 1 },
  statChip: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 2 },
  statCount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1 },
  summaryItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  summaryDivider: { width: 1 },
  summaryNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  filterBtn: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  filterBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  thName: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thStatus: { width: 58, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thItems: { flexDirection: "row", gap: 6 },
  thItem: { width: 36, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, paddingLeft: 10 },
  nameCol: { flex: 1, marginRight: 6 },
  studentName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  missingText: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statusCol: { width: 58, alignItems: "center" },
  submittedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  submittedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#16a34a" },
  submitSmallBtn: { paddingHorizontal: 6, paddingVertical: 5, borderRadius: 6, alignItems: "center", justifyContent: "center", minWidth: 50 },
  submitSmallText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: { width: 36, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
