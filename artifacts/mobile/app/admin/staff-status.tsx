import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
  TextInput, Platform, useColorScheme, ActivityIndicator, RefreshControl, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";

function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StaffStatusScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const qc = useQueryClient();
  const { user, isSuperAdmin, isCoordinator } = useAuth();

  const [remarkModal, setRemarkModal] = useState(false);
  const [goingActive, setGoingActive] = useState(true);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: allStaff = [], isLoading, refetch: refetchAll } = useQuery<any[]>({
    queryKey: ["staff-all"],
    queryFn: () => request("/staff/all"),
    enabled: isCoordinator,
    refetchInterval: 15000,
    staleTime: 8000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStatus(), refetchAll()]);
    setRefreshing(false);
  }, [refetchStatus, refetchAll]);

  const confirmToggle = (goActive: boolean) => {
    setGoingActive(goActive);
    setRemark("");
    setRemarkModal(true);
    Haptics.selectionAsync();
  };

  const submitStatus = async () => {
    setSubmitting(true);
    try {
      const endpoint = goingActive ? "/staff/go-active" : "/staff/go-inactive";
      await request(endpoint, { method: "POST", body: JSON.stringify({ remark }) });
      qc.invalidateQueries({ queryKey: ["my-status"] });
      qc.invalidateQueries({ queryKey: ["staff-all"] });
      setRemarkModal(false);
    } catch { }
    setSubmitting(false);
  };

  const isActive = myStatus?.isActive ?? false;
  const activeCount = (allStaff as any[]).filter(s => s.isOnline).length;
  const totalStaff = (allStaff as any[]).length;

  const roleColor = (role: string) => {
    if (role === "superadmin") return "#8b5cf6";
    if (role === "admin" || role === "coordinator") return "#3b82f6";
    return "#6366f1";
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Staff Status</Text>
        <Pressable onPress={onRefresh} style={styles.refreshBtn}>
          <Feather name="refresh-cw" size={18} color={theme.tint} />
        </Pressable>
      </View>

      <FlatList
        data={isCoordinator ? (allStaff as any[]) : []}
        keyExtractor={s => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={() => (
          <>
            {/* My Status Card — hidden for superadmin */}
            {!isSuperAdmin && (
              <View style={[styles.myCard, { backgroundColor: isActive ? "#22c55e15" : theme.surface, borderColor: isActive ? "#22c55e60" : theme.border }]}>
                <View style={styles.myCardTop}>
                  <View>
                    <Text style={[styles.myCardLabel, { color: theme.textSecondary }]}>Your Status</Text>
                    <View style={styles.myStatusRow}>
                      <View style={[styles.dot, { backgroundColor: isActive ? "#22c55e" : "#f59e0b" }]} />
                      <Text style={[styles.myStatusText, { color: isActive ? "#22c55e" : "#f59e0b" }]}>
                        {isActive ? "Active" : "Inactive"}
                      </Text>
                    </View>
                    {myStatus?.lastActiveAt && (
                      <Text style={[styles.myStatusSub, { color: theme.textTertiary }]}>
                        {isActive ? "Active since " : "Last seen "}{timeAgo(myStatus.lastActiveAt)}
                      </Text>
                    )}
                  </View>
                  {isActive ? (
                    <Pressable onPress={() => confirmToggle(false)} style={[styles.statusBtn, { backgroundColor: "#ef444415", borderColor: "#ef4444" }]}>
                      <Feather name="moon" size={16} color="#ef4444" />
                      <Text style={[styles.statusBtnText, { color: "#ef4444" }]}>Go Inactive</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => confirmToggle(true)} style={[styles.statusBtn, { backgroundColor: "#22c55e15", borderColor: "#22c55e" }]}>
                      <Feather name="sun" size={16} color="#22c55e" />
                      <Text style={[styles.statusBtnText, { color: "#22c55e" }]}>Go Active</Text>
                    </Pressable>
                  )}
                </View>
                {!isActive && (
                  <View style={[styles.inactiveNote, { borderTopColor: theme.border }]}>
                    <Feather name="info" size={13} color={theme.textTertiary} />
                    <Text style={[styles.inactiveNoteText, { color: theme.textTertiary }]}>
                      Auto-inactive after 10 minutes of no heartbeat
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Summary — coordinator+ only */}
            {isCoordinator && (
              <>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryCard, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
                    <Text style={[styles.summaryNum, { color: "#22c55e" }]}>{activeCount}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Online Now</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.summaryNum, { color: theme.text }]}>{totalStaff}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Staff</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" }]}>
                    <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>{totalStaff - activeCount}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Offline</Text>
                  </View>
                </View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>All Staff</Text>
              </>
            )}
          </>
        )}
        ListEmptyComponent={() =>
          isLoading ? <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} /> : null
        }
        renderItem={({ item }) => (
          <View style={[styles.staffCard, { backgroundColor: theme.surface, borderColor: item.isOnline ? "#22c55e40" : theme.border }]}>
            <View style={[styles.staffAvatar, { backgroundColor: roleColor(item.role) + "20" }]}>
              <Text style={[styles.staffAvatarText, { color: roleColor(item.role) }]}>
                {(item.name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.staffName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.staffEmail, { color: theme.textSecondary }]}>{item.email}</Text>
              <Text style={[styles.staffRole, { color: roleColor(item.role) }]}>
                {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
              </Text>
            </View>
            <View style={styles.staffRight}>
              <View style={[styles.onlineBadge, { backgroundColor: item.isOnline ? "#22c55e20" : "#6B728020" }]}>
                <View style={[styles.dot, { backgroundColor: item.isOnline ? "#22c55e" : "#6B7280" }]} />
                <Text style={[styles.onlineLabel, { color: item.isOnline ? "#22c55e" : "#6B7280" }]}>
                  {item.isOnline ? "Online" : "Offline"}
                </Text>
              </View>
              <Text style={[styles.lastSeen, { color: theme.textTertiary }]}>{timeAgo(item.lastActiveAt)}</Text>
            </View>
          </View>
        )}
      />

      {/* Remark Modal */}
      <Modal visible={remarkModal} transparent animationType="slide" onRequestClose={() => setRemarkModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRemarkModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {goingActive ? "Going Active" : "Going Inactive"}
            </Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Add a remark (optional) — visible to superadmin
            </Text>
            <TextInput
              placeholder={goingActive ? "e.g. Starting hostel rounds…" : "e.g. Lunch break, back at 2pm…"}
              placeholderTextColor={theme.textTertiary}
              style={[styles.remarkInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              value={remark}
              onChangeText={setRemark}
              multiline
            />
            <Pressable
              onPress={submitStatus}
              disabled={submitting}
              style={[styles.confirmBtn, { backgroundColor: goingActive ? "#22c55e" : "#ef4444" }]}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Feather name={goingActive ? "sun" : "moon"} size={16} color="#fff" />
                    <Text style={styles.confirmBtnText}>{goingActive ? "Confirm Active" : "Confirm Inactive"}</Text>
                  </>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold" },
  refreshBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  // My Status
  myCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginBottom: 14 },
  myCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  myCardLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  myStatusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  myStatusText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  myStatusSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  statusBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inactiveNote: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  inactiveNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  // Summary
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  summaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  // Staff cards
  staffCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  staffAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  staffAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  staffEmail: { fontSize: 11, fontFamily: "Inter_400Regular" },
  staffRole: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  staffRight: { alignItems: "flex-end", gap: 4 },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 20 },
  onlineLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  lastSeen: { fontSize: 11, fontFamily: "Inter_400Regular" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  remarkInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
