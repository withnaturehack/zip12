import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
  Switch, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";
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

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["inventory-simple"],
    queryFn: () => request("/inventory-simple"),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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

  const toggle = useCallback(async (studentId: string, field: string, current: boolean) => {
    const key = `${studentId}-${field}`;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingMap(p => ({ ...p, [key]: true }));
    try { await mutation.mutateAsync({ studentId, field, value: !current }); }
    catch { }
    setUpdatingMap(p => ({ ...p, [key]: false }));
  }, [mutation]);

  const items = data as any[];
  const withMattress = items.filter(s => s.inventory?.mattress).length;
  const withBedsheet = items.filter(s => s.inventory?.bedsheet).length;
  const withPillow = items.filter(s => s.inventory?.pillow).length;

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

      {/* Table header */}
      <View style={[styles.tableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.thName, { color: theme.textSecondary }]}>STUDENT</Text>
        <View style={styles.thItems}>
          {["Mattress", "Bedsheet", "Pillow"].map(h => (
            <Text key={h} style={[styles.thItem, { color: theme.textSecondary }]}>{h.slice(0, 1)}</Text>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Feather name="package" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students found</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const inv = item.inventory || {};
            return (
              <View style={[styles.tableRow, { backgroundColor: theme.background }]}>
                <View style={styles.nameCol}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.rollNumber || item.email} {item.roomNumber ? `· ${item.roomNumber}` : ""}
                  </Text>
                </View>
                <View style={styles.toggleRow}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                    const key = `${item.id}-${field}`;
                    const isLoading = updatingMap[key];
                    const val = !!inv[field];
                    return (
                      <Pressable
                        key={field}
                        onPress={() => toggle(item.id, field, val)}
                        disabled={isLoading}
                        style={[
                          styles.toggleBtn,
                          { backgroundColor: val ? theme.tint + "20" : theme.surface, borderColor: val ? theme.tint : theme.border },
                        ]}
                      >
                        {isLoading ? (
                          <ActivityIndicator size="small" color={theme.tint} />
                        ) : (
                          <Feather name={val ? "check" : "minus"} size={14} color={val ? theme.tint : theme.textTertiary} />
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
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  thName: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thItems: { flexDirection: "row", gap: 6 },
  thItem: { width: 36, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  nameCol: { flex: 1, marginRight: 8 },
  studentName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: { width: 36, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
