import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal,
  TextInput, Platform, useColorScheme, ActivityIndicator,
  RefreshControl, FlatList, Linking, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";

const ROLE_COLORS: Record<string, string> = {
  volunteer: "#22c55e",
  coordinator: "#3b82f6",
  admin: "#8b5cf6",
  superadmin: "#ef4444",
};
const ROLE_LABELS: Record<string, string> = {
  volunteer: "Volunteer",
  coordinator: "Coordinator",
  admin: "Admin",
  superadmin: "Super Admin",
};

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

// ─── Staff Detail Modal ────────────────────────────────────────────────────────
function StaffDetailModal({ staff, visible, onClose, theme }: { staff: any; visible: boolean; onClose: () => void; theme: any }) {
  if (!staff) return null;
  const roleColor = ROLE_COLORS[staff.role] || "#6366f1";
  const phone = staff.contactNumber || staff.phone || "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sd.overlay} onPress={onClose}>
        <Pressable style={[sd.sheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={sd.handle} />

          {/* Avatar */}
          <View style={[sd.avatar, { backgroundColor: roleColor + "20" }]}>
            <Text style={[sd.avatarText, { color: roleColor }]}>
              {(staff.name || "?")[0].toUpperCase()}
            </Text>
          </View>
          <Text style={[sd.staffName, { color: theme.text }]}>{staff.name}</Text>
          <Text style={[sd.staffEmail, { color: theme.textSecondary }]}>{staff.email}</Text>

          {/* Role + Status chips */}
          <View style={sd.chips}>
            <View style={[sd.chip, { backgroundColor: roleColor + "15", borderColor: roleColor + "40" }]}>
              <Text style={[sd.chipText, { color: roleColor }]}>{ROLE_LABELS[staff.role] || staff.role}</Text>
            </View>
            <View style={[sd.chip, {
              backgroundColor: staff.isOnline ? "#22c55e15" : "#6b728015",
              borderColor: staff.isOnline ? "#22c55e40" : "#6b728040",
            }]}>
              <View style={[sd.dot, { backgroundColor: staff.isOnline ? "#22c55e" : "#6b7280" }]} />
              <Text style={[sd.chipText, { color: staff.isOnline ? "#22c55e" : "#6b7280" }]}>
                {staff.isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </View>

          {/* Info list */}
          <View style={[sd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <InfoRow icon="clock" label="Last Seen" value={timeAgo(staff.lastActiveAt)} theme={theme} />
            {!!(staff.hostelName || staff.hostelId) && (
              <InfoRow icon="home" label="Hostel" value={staff.hostelName || staff.hostelId} theme={theme} />
            )}
            {!!staff.area && <InfoRow icon="map-pin" label="Area" value={staff.area} theme={theme} />}
            {!!phone && <InfoRow icon="phone" label="Phone" value={phone} theme={theme} />}
          </View>

          {/* Call button */}
          {!!phone && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Linking.openURL(`tel:${phone}`);
              }}
              style={sd.callBtn}
            >
              <Feather name="phone-call" size={16} color="#fff" />
              <Text style={sd.callBtnText}>Call {phone}</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onClose}
            style={[sd.closeBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
          >
            <Text style={[sd.closeBtnText, { color: theme.textSecondary }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoRow({ icon, label, value, theme }: { icon: any; label: string; value: string; theme: any }) {
  return (
    <View style={sd.infoRow}>
      <Feather name={icon} size={13} color={theme.textTertiary} />
      <Text style={[sd.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[sd.infoVal, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────────
export default function StaffStatusScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const qc = useQueryClient();
  const { user, isSuperAdmin, isCoordinator, isVolunteer } = useAuth();

  const [remarkModal, setRemarkModal] = useState(false);
  const [goingActive, setGoingActive] = useState(true);
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [now, setNow] = useState(Date.now());

  // Live clock — updates every 10 seconds for "last seen" freshness
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(t);
  }, []);

  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const { data: allStaff = [], isLoading, refetch: refetchAll } = useQuery<any[]>({
    queryKey: ["staff-all"],
    queryFn: () => request("/staff/all"),
    enabled: isVolunteer,
    refetchInterval: 30000,
    staleTime: 15000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
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
    return Array.from(new Set([...(assignedHostelIds || []), user?.hostelId || ""].filter(Boolean)));
  }, [isSuperAdmin, assignedHostelIds, user?.hostelId]);

  const volunteerStaff = React.useMemo(() => {
    const base = (allStaff as any[]).filter((s: any) => s.role === "volunteer");
    if (!scopedHostelIds) return base;
    if (scopedHostelIds.length === 0) return [];
    return base.filter((s: any) => scopedHostelIds.includes(String(s.hostelId || "")));
  }, [allStaff, scopedHostelIds]);

  const onlineCount = volunteerStaff.filter((s: any) => s.isOnline).length;
  const totalStaff = volunteerStaff.length;

  // suppress unused now — it's used to re-render the component every 10s
  void now;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Staff Status</Text>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); onRefresh(); }}
          style={styles.refreshBtn}
        >
          <Feather name="refresh-cw" size={18} color={theme.tint} />
        </Pressable>
      </View>

      <FlatList
        data={isVolunteer ? volunteerStaff : []}
        keyExtractor={s => s.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={() => (
          <>
            {/* My Status Card */}
            {!isSuperAdmin && (
              <View style={[styles.myCard, { backgroundColor: isActive ? "#22c55e12" : theme.surface, borderColor: isActive ? "#22c55e60" : theme.border }]}>
                <View style={styles.myCardTop}>
                  <View style={{ flex: 1 }}>
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

            {/* Summary */}
            {isVolunteer && (
              <>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryCard, { backgroundColor: "#22c55e12", borderColor: "#22c55e40" }]}>
                    <Text style={[styles.summaryNum, { color: "#22c55e" }]}>{onlineCount}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Online Now</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.summaryNum, { color: theme.text }]}>{totalStaff}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total</Text>
                  </View>
                  <View style={[styles.summaryCard, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b40" }]}>
                    <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>{totalStaff - onlineCount}</Text>
                    <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Offline</Text>
                  </View>
                </View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  {isSuperAdmin ? "All Staff" : isCoordinator ? "Assigned Volunteers" : "Co-Volunteers at Your Hostel"}
                </Text>
              </>
            )}
          </>
        )}
        ListEmptyComponent={() =>
          isLoading && (allStaff as any[]).length === 0 ? <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} /> : null
        }
        renderItem={({ item }) => {
          const roleColor = ROLE_COLORS[item.role] || "#6366f1";
          return (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedStaff(item);
              }}
              style={({ pressed }) => [
                styles.staffCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: item.isOnline ? "#22c55e40" : theme.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.staffAvatar, { backgroundColor: roleColor + "20" }]}>
                <Text style={[styles.staffAvatarText, { color: roleColor }]}>
                  {(item.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.staffName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.staffEmail, { color: theme.textSecondary }]} numberOfLines={1}>{item.email}</Text>
                {!!(item.hostelName || item.hostelId) && (
                  <Text style={[styles.staffMeta, { color: theme.textTertiary }]}>
                    <Feather name="home" size={10} color={theme.textTertiary} /> {item.hostelName || item.hostelId}
                  </Text>
                )}
                <Text style={[styles.staffRole, { color: roleColor }]}>
                  {ROLE_LABELS[item.role] || item.role}
                </Text>
              </View>
              <View style={styles.staffRight}>
                <View style={[styles.onlineBadge, {
                  backgroundColor: item.isOnline ? "#22c55e18" : "#6B728018",
                }]}>
                  <View style={[styles.dot, { backgroundColor: item.isOnline ? "#22c55e" : "#6B7280" }]} />
                  <Text style={[styles.onlineLabel, { color: item.isOnline ? "#22c55e" : "#6B7280" }]}>
                    {item.isOnline ? "Online" : "Offline"}
                  </Text>
                </View>
                <Text style={[styles.lastSeen, { color: theme.textTertiary }]}>{timeAgo(item.lastActiveAt)}</Text>
                {!!(item.contactNumber || item.phone) && (
                  <Feather name="phone" size={12} color={theme.tint} />
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Staff Detail Modal */}
      <StaffDetailModal
        staff={selectedStaff}
        visible={!!selectedStaff}
        onClose={() => setSelectedStaff(null)}
        theme={theme}
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
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  summaryNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  staffCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  staffAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  staffAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  staffEmail: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  staffMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  staffRole: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 3 },
  staffRight: { alignItems: "flex-end", gap: 4 },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20 },
  onlineLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  lastSeen: { fontSize: 10, fontFamily: "Inter_400Regular" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  remarkInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 14 },
  confirmBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

// ─── StaffDetailModal Styles ───────────────────────────────────────────────────
const sd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 6, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", marginBottom: 12 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  staffName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  staffEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  infoCard: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 12, gap: 2, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 70 },
  infoVal: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  callBtn: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 14, marginBottom: 8 },
  callBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  closeBtn: { width: "100%", borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
