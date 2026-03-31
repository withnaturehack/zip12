import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
  Modal, TextInput, ScrollView, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

function formatTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" });
}

// ─── Notification Modal ────────────────────────────────────────────────────────

function NotificationModal({ visible, onClose, theme, request, qc }: {
  visible: boolean; onClose: () => void; theme: any; request: any; qc: any;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => { setTitle(""); setBody(""); onClose(); };

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await request("/announcements", { method: "POST", body: JSON.stringify({ title, content: body || title }) });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch (e: any) { Alert.alert("Error", e.message || "Failed"); }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.modalOverlay} onPress={close}>
        <Pressable style={[styles.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>Send Notification</Text>
          <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Broadcasts to your hostel students</Text>
          <TextInput placeholder="Notification title *" placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={title} onChangeText={setTitle} />
          <TextInput placeholder="Message body (optional)" placeholderTextColor={theme.textTertiary}
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={body} onChangeText={setBody} multiline numberOfLines={3} />
          <View style={styles.modalActions}>
            <Pressable onPress={close} style={[styles.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={submitting || !title.trim()} style={[styles.submitBtn, { backgroundColor: title.trim() ? "#f59e0b" : theme.border }]}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Send</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── ROOM ATTENDANCE VIEW ──────────────────────────────────────────────────────

function RoomAttendanceView({ theme }: { theme: any }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingInv, setUpdatingInv] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [submittingInvId, setSubmittingInvId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const { data = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["attendance", today],
    queryFn: () => request("/attendance"),
    refetchInterval: 8000,
    staleTime: 4000,
  });

  const { data: todayCheckins = [], refetch: refetchCheckins } = useQuery<any[]>({
    queryKey: ["checkins-today"],
    queryFn: () => request("/checkins?limit=300"),
    refetchInterval: 8000,
    staleTime: 4000,
  });

  const checkinMap: Record<string, any> = {};
  (todayCheckins as any[]).forEach(c => { if (c.studentId) checkinMap[c.studentId] = c; });

  const markMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: string }) =>
      request(`/attendance/${studentId}`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); },
  });

  const invMutation = useMutation({
    mutationFn: ({ studentId, field, val }: { studentId: string; field: string; val: boolean }) =>
      request(`/attendance/inventory/${studentId}`, { method: "PATCH", body: JSON.stringify({ [field]: val }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); },
  });

  const submitInvMutation = useMutation({
    mutationFn: (studentId: string) =>
      request(`/attendance/inventory/${studentId}/submit`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchCheckins()]);
    setRefreshing(false);
  }, [refetch, refetchCheckins]);

  const toggleAttendance = useCallback(async (studentId: string, current: string) => {
    if (current === "entered") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingId(studentId);
    try { await markMutation.mutateAsync({ studentId, status: "entered" }); } catch { }
    setUpdatingId(null);
  }, [markMutation]);

  const toggleInventory = useCallback(async (studentId: string, field: string, current: boolean) => {
    if (current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingInv(`${studentId}-${field}`);
    try { await invMutation.mutateAsync({ studentId, field, val: true }); } catch { }
    setUpdatingInv(null);
  }, [invMutation]);

  const markCheckin = useCallback(async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingInId(studentId);
    try {
      await request(`/checkins/${studentId}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to check in"); }
    setCheckingInId(null);
  }, [request, qc]);

  const markCheckout = useCallback(async (checkinId: string, studentId: string, inv: any) => {
    if (!inv?.inventoryLocked) {
      Alert.alert("Cannot Check Out", "Please submit the student's inventory before checking out.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingOutId(checkinId);
    try {
      await request(`/checkins/${checkinId}/checkout`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to check out"); }
    setCheckingOutId(null);
  }, [request, qc]);

  const submitInventory = useCallback(async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmittingInvId(studentId);
    try {
      await submitInvMutation.mutateAsync(studentId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to submit inventory"); }
    setSubmittingInvId(null);
  }, [submitInvMutation]);

  const sq = search.trim().toLowerCase();
  const filtered = sq
    ? (data as any[]).filter(s =>
        s.name?.toLowerCase().includes(sq) ||
        s.roomNumber?.toLowerCase().includes(sq) ||
        s.rollNumber?.toLowerCase().includes(sq) ||
        s.email?.toLowerCase().includes(sq))
    : (data as any[]);

  const entered = data.filter((s: any) => s.attendance?.status === "entered").length;
  const checkedInCount = Object.keys(checkinMap).length;
  const submittedCount = (data as any[]).filter((s: any) => s.inventory?.inventoryLocked).length;
  const total = data.length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats strip */}
      <View style={[styles.statsStripRow, { borderBottomColor: theme.border }]}>
        <StatPill label="Total" value={total} color={theme.text} theme={theme} />
        <StatPill label="In Campus" value={entered} color="#22c55e" theme={theme} />
        <StatPill label="Checked In" value={checkedInCount} color="#8b5cf6" theme={theme} />
        <StatPill label="Inv Done" value={submittedCount} color="#06b6d4" theme={theme} />
      </View>

      {/* Search bar */}
      <View style={[styles.searchBarWrap, { borderBottomColor: theme.border }]}>
        <Feather name="search" size={15} color={theme.textSecondary} />
        <TextInput
          placeholder="Search by name, room, roll…"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchBarInput, { color: theme.text }]}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x-circle" size={15} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? "No students match your search" : "No students assigned"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isEntered = item.attendance?.status === "entered";
            const isUpdating = updatingId === item.id;
            const isCheckingIn = checkingInId === item.id;
            const checkin = checkinMap[item.id];
            const isCheckingOut = checkingOutId === checkin?.id;
            const isSubmittingInv = submittingInvId === item.id;
            const inv = item.inventory || { mattress: false, bedsheet: false, pillow: false, inventoryLocked: false };
            const allGiven = inv.mattress && inv.bedsheet && inv.pillow;
            const isLocked = !!inv.inventoryLocked;
            const missingItems = (["mattress", "bedsheet", "pillow"] as const).filter(f => !inv[f]);
            const isCheckedIn = !!checkin && !checkin.checkOutTime;
            const isCheckedOut = !!checkin?.checkOutTime;

            return (
              <View style={[styles.attCard, { backgroundColor: theme.surface, borderColor: isLocked ? "#22c55e50" : checkin ? "#8b5cf630" : theme.border }]}>

                {/* ── Row 1: Student identity + campus status + remark badges ── */}
                <View style={styles.attTopRow}>
                  <View style={[styles.avatar, { backgroundColor: isEntered ? "#22c55e20" : theme.tint + "20" }]}>
                    <Text style={[styles.avatarText, { color: isEntered ? "#22c55e" : theme.tint }]}>
                      {(item.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                      <Pressable onPress={() => !isEntered && toggleAttendance(item.id, item.attendance?.status || "not_entered")} disabled={isUpdating || isEntered}
                        style={[styles.statusPill, { backgroundColor: isEntered ? "#22c55e18" : "#f59e0b18", borderColor: isEntered ? "#22c55e50" : "#f59e0b50" }]}>
                        {isUpdating
                          ? <ActivityIndicator size="small" color={isEntered ? "#22c55e" : "#f59e0b"} style={{ width: 28 }} />
                          : <><View style={[styles.statusDot, { backgroundColor: isEntered ? "#22c55e" : "#f59e0b" }]} />
                            <Text style={[styles.statusPillText, { color: isEntered ? "#22c55e" : "#f59e0b" }]}>{isEntered ? "In ✓" : "Out"}</Text></>}
                      </Pressable>
                    </View>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
                    </Text>
                  </View>
                  {/* Remark badges — green or red */}
                  {checkin && (
                    <View style={styles.remarkBadges}>
                      {isLocked ? (
                        <View style={styles.remarkGreen}>
                          <Feather name="check-circle" size={11} color="#16a34a" />
                          <Text style={styles.remarkGreenText}>Submitted</Text>
                        </View>
                      ) : (
                        <View style={styles.remarkRed}>
                          <Feather name="alert-circle" size={11} color="#dc2626" />
                          <Text style={styles.remarkRedText}>
                            {missingItems.length > 0 ? `Missing ${missingItems.length}` : "Not Submitted"}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* ── Row 2: Check In ── */}
                <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
                  <View style={[styles.actionIcon, { backgroundColor: checkin ? "#8b5cf620" : theme.background }]}>
                    <Feather name="log-in" size={14} color={checkin ? "#8b5cf6" : theme.textTertiary} />
                  </View>
                  {checkin ? (
                    <View style={styles.timeStampBadge}>
                      <Text style={[styles.timeStampLabel, { color: theme.textTertiary }]}>Check-in</Text>
                      <Text style={[styles.timeStampValue, { color: "#8b5cf6" }]}>{formatTime(checkin.checkInTime)}</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.actionNone, { color: theme.textTertiary, flex: 1 }]}>Not checked in today</Text>
                      <Pressable onPress={() => markCheckin(item.id)} disabled={isCheckingIn}
                        style={[styles.actionBtn, { backgroundColor: "#8b5cf6", opacity: isCheckingIn ? 0.6 : 1 }]}>
                        {isCheckingIn
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <><Feather name="log-in" size={13} color="#fff" /><Text style={styles.actionBtnText}>Check In</Text></>}
                      </Pressable>
                    </>
                  )}
                </View>

                {/* ── Row 3: Inventory (3 buttons — unlocked only after check-in) ── */}
                {checkin && !isCheckedOut && (
                  <View style={[styles.invSection, { borderTopColor: theme.border }]}>
                    <Text style={[styles.invSectionLabel, { color: isLocked ? "#16a34a" : theme.textSecondary }]}>
                      <Feather name={isLocked ? "lock" : "unlock"} size={11} /> Inventory {isLocked ? "(Submitted)" : "(3 items)"}
                    </Text>
                    <View style={styles.invChipsRow}>
                      {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                        const checked = !!inv[field];
                        const isToggling = updatingInv === `${item.id}-${field}`;
                        const disabled = isLocked || checked || isToggling;
                        return (
                          <Pressable key={field} onPress={() => !disabled && toggleInventory(item.id, field, checked)}
                            disabled={disabled}
                            style={[styles.invChip, {
                              backgroundColor: checked ? "#22c55e15" : isLocked ? theme.surface : theme.background,
                              borderColor: checked ? "#22c55e60" : isLocked ? theme.border : theme.border,
                              opacity: isLocked && !checked ? 0.5 : 1,
                            }]}>
                            {isToggling
                              ? <ActivityIndicator size="small" color="#22c55e" style={{ width: 14 }} />
                              : <Feather name={checked ? "check-circle" : "circle"} size={14} color={checked ? "#22c55e" : theme.textTertiary} />}
                            <Text style={[styles.invChipText, { color: checked ? "#22c55e" : theme.textSecondary }]}>
                              {field.charAt(0).toUpperCase() + field.slice(1)}
                            </Text>
                            {checked && !isLocked && <Feather name="check" size={9} color="#22c55e" />}
                            {isLocked && <Feather name="lock" size={9} color={checked ? "#22c55e" : theme.textTertiary} />}
                          </Pressable>
                        );
                      })}
                    </View>
                    {/* Submit Inventory Button */}
                    {!isLocked && (
                      <Pressable
                        onPress={() => submitInventory(item.id)}
                        disabled={isSubmittingInv}
                        style={[styles.submitInvBtn, {
                          backgroundColor: allGiven ? "#06b6d4" : "#f59e0b",
                          opacity: isSubmittingInv ? 0.6 : 1,
                        }]}
                      >
                        {isSubmittingInv ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name="send" size={13} color="#fff" />
                            <Text style={styles.submitInvBtnText}>
                              {allGiven ? "Submit All 3 Items" : `Submit (${3 - missingItems.length}/3 given)`}
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}

                {/* ── Row 4: Check Out ── */}
                <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
                  <View style={[styles.actionIcon, { backgroundColor: isCheckedOut ? "#f59e0b20" : theme.background }]}>
                    <Feather name="log-out" size={14} color={isCheckedOut ? "#f59e0b" : theme.textTertiary} />
                  </View>
                  {isCheckedOut ? (
                    <View style={[styles.timeStampBadge, { flex: 1 }]}>
                      <Text style={[styles.timeStampLabel, { color: theme.textTertiary }]}>Check-out</Text>
                      <Text style={[styles.timeStampValue, { color: "#f59e0b" }]}>{formatTime(checkin.checkOutTime)}</Text>
                    </View>
                  ) : checkin ? (
                    <>
                      {!isLocked ? (
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.actionNone, { color: "#dc2626" }]}>Submit inventory to enable checkout</Text>
                        </View>
                      ) : (
                        <Text style={[styles.actionNone, { color: theme.textTertiary, flex: 1 }]}>Ready to check out</Text>
                      )}
                      <Pressable
                        onPress={() => markCheckout(checkin.id, item.id, inv)}
                        disabled={isCheckingOut || !isLocked}
                        style={[styles.actionBtn, {
                          backgroundColor: isLocked ? "#f59e0b" : "#94a3b8",
                          opacity: isCheckingOut ? 0.6 : 1,
                        }]}
                      >
                        {isCheckingOut
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <><Feather name="log-out" size={13} color="#fff" /><Text style={styles.actionBtnText}>Check Out</Text></>}
                      </Pressable>
                    </>
                  ) : (
                    <Text style={[styles.actionNone, { color: theme.textTertiary, flex: 1 }]}>Check in first</Text>
                  )}
                </View>

              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── MESS CARD VIEW ────────────────────────────────────────────────────────────

function MessAttendanceView({ theme }: { theme: any }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const { data: students = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["attendance", today],
    queryFn: () => request("/attendance"),
    refetchInterval: 8000,
    staleTime: 4000,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const toggleMessCard = async (studentId: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTogglingId(studentId);
    try {
      await request(`/attendance/mess-card/${studentId}`, { method: "PATCH", body: JSON.stringify({ messCard: !current }) });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["mess-stats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to update"); }
    setTogglingId(null);
  };

  const sq = search.trim().toLowerCase();
  const filtered = sq
    ? (students as any[]).filter(s =>
        s.name?.toLowerCase().includes(sq) ||
        s.roomNumber?.toLowerCase().includes(sq) ||
        s.rollNumber?.toLowerCase().includes(sq) ||
        s.email?.toLowerCase().includes(sq))
    : (students as any[]);

  const cardGivenCount = (students as any[]).filter(s => !!s.inventory?.messCard).length;
  const total = students.length;

  return (
    <View style={{ flex: 1 }}>
      {/* Summary pills */}
      <View style={[styles.statsStripRow, { borderBottomColor: theme.border }]}>
        <StatPill label="Total" value={total} color={theme.text} theme={theme} />
        <StatPill label="Card Given" value={cardGivenCount} color="#22c55e" theme={theme} />
        <StatPill label="Pending" value={total - cardGivenCount} color="#f59e0b" theme={theme} />
      </View>

      {/* Search bar */}
      <View style={[styles.searchBarWrap, { borderBottomColor: theme.border }]}>
        <Feather name="search" size={15} color={theme.textSecondary} />
        <TextInput
          placeholder="Search by name, room, roll…"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchBarInput, { color: theme.text }]}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x-circle" size={15} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="coffee" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {search ? "No students match your search" : "No students assigned"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const given = !!item.inventory?.messCard;
            const givenAt = item.inventory?.messCardGivenAt;
            const isToggling = togglingId === item.id;

            return (
              <View style={[styles.messCardRow, {
                backgroundColor: given ? "#22c55e08" : theme.surface,
                borderColor: given ? "#22c55e40" : theme.border,
              }]}>
                <View style={[styles.avatar, { backgroundColor: given ? "#22c55e20" : theme.tint + "20" }]}>
                  <Text style={[styles.avatarText, { color: given ? "#22c55e" : theme.tint }]}>
                    {(item.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
                  </Text>
                  {given && givenAt ? (
                    <Text style={[styles.studentMeta, { color: "#22c55e" }]}>
                      <Feather name="clock" size={10} /> Given at {formatTime(givenAt)}
                    </Text>
                  ) : null}
                </View>
                {/* Allow give AND revoke for all volunteer+ roles */}
                <Pressable
                  onPress={() => !isToggling && toggleMessCard(item.id, given)}
                  disabled={isToggling}
                  style={[styles.messCardBtn, {
                    backgroundColor: given ? "#ef444415" : "#22c55e",
                    borderColor: given ? "#ef444440" : "#22c55e",
                    borderWidth: given ? 1 : 0,
                  }]}
                >
                  {isToggling ? (
                    <ActivityIndicator size="small" color={given ? "#ef4444" : "#fff"} />
                  ) : given ? (
                    <>
                      <Feather name="x-circle" size={14} color="#ef4444" />
                      <Text style={[styles.messCardBtnText, { color: "#ef4444" }]}>Revoke</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={[styles.messCardBtnText, { color: "#fff" }]}>Give Card</Text>
                    </>
                  )}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────

function StatPill({ label, value, color, theme }: { label: string; value: any; color: string; theme: any }) {
  return (
    <View style={[styles.statPill, { backgroundColor: theme.surface }]}>
      <Text style={[styles.statPillVal, { color }]}>{value ?? 0}</Text>
      <Text style={[styles.statPillLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"room" | "mess">("room");
  const [showNotifModal, setShowNotifModal] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Page Header */}
      <View style={[styles.pageHeader, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Attendance</Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowNotifModal(true); }}
            style={[styles.notifBtn, { backgroundColor: "#f59e0b20", borderColor: "#f59e0b40" }]}
          >
            <Feather name="bell" size={16} color="#f59e0b" />
            <Text style={[styles.notifBtnText, { color: "#f59e0b" }]}>Notify</Text>
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            onPress={() => setTab("room")}
            style={[styles.tabBtn, tab === "room" && { backgroundColor: theme.tint }]}
          >
            <Feather name="home" size={14} color={tab === "room" ? "#fff" : theme.textSecondary} />
            <Text style={[styles.tabBtnText, { color: tab === "room" ? "#fff" : theme.textSecondary }]}>Room / Inventory</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("mess")}
            style={[styles.tabBtn, tab === "mess" && { backgroundColor: "#22c55e" }]}
          >
            <Feather name="coffee" size={14} color={tab === "mess" ? "#fff" : theme.textSecondary} />
            <Text style={[styles.tabBtnText, { color: tab === "mess" ? "#fff" : theme.textSecondary }]}>Mess Card</Text>
          </Pressable>
        </View>
      </View>

      {tab === "room" ? (
        <RoomAttendanceView theme={theme} />
      ) : (
        <MessAttendanceView theme={theme} />
      )}

      <NotificationModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        theme={theme}
        request={request}
        qc={qc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, gap: 10 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  notifBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  notifBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabBar: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9 },
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsStripRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1 },
  statPill: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, gap: 2 },
  statPillVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statPillLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  searchBarWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  searchBarInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  // Student attendance card
  attCard: { borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  attTopRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 13, fontFamily: "Inter_700Bold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  // Remark badges
  remarkBadges: { alignItems: "flex-end", gap: 4 },
  remarkGreen: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#dcfce7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  remarkGreenText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#16a34a" },
  remarkRed: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fee2e2", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  remarkRedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#dc2626" },
  // Action rows
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  actionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  timeStampBadge: { flexDirection: "row", gap: 8, alignItems: "center", flex: 1 },
  timeStampLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  timeStampValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  actionNone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  // Inventory section
  invSection: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, gap: 8 },
  invSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  invChipsRow: { flexDirection: "row", gap: 8 },
  invChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1 },
  invChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  submitInvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, paddingVertical: 10 },
  submitInvBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  // Mess card
  messCardRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5 },
  messCardBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  messCardBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  // Empty state
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Notification modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000055" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#ccc", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { height: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
