import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
  Modal, TextInput, ScrollView, Alert, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

function formatTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" });
}

// ─── FAB Menu ──────────────────────────────────────────────────────────────────

function FloatingMenu({ theme, onNewLostItem, onNewNotification, canNotify = false }: {
  theme: any; onNewLostItem: () => void; onNewNotification: () => void; canNotify?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.spring(rotation, { toValue: open ? 0 : 1, useNativeDriver: true }).start();
    setOpen(o => !o);
  };

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  const menuItems = [
    ...(canNotify ? [{ icon: "bell", label: "Send Notification", color: "#f59e0b", action: onNewNotification }] : []),
    { icon: "package", label: "Report Lost Item", color: "#8b5cf6", action: onNewLostItem },
  ];

  return (
    <View style={styles.fabContainer} pointerEvents="box-none">
      {open && <Pressable style={styles.fabBackdrop} onPress={toggle} />}
      {open && (
        <View style={styles.fabMenu}>
          {menuItems.map(item => (
            <Pressable key={item.label} onPress={() => { setOpen(false); rotation.setValue(0); item.action(); }}
              style={[styles.fabMenuItem, { backgroundColor: theme.surface, borderColor: item.color + "50" }]}>
              <View style={[styles.fabMenuIcon, { backgroundColor: item.color + "20" }]}>
                <Feather name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.fabMenuLabel, { color: theme.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Pressable onPress={toggle} style={[styles.fab, { backgroundColor: theme.tint }]}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="plus" size={24} color="#fff" />
        </Animated.View>
      </Pressable>
    </View>
  );
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

// ─── Lost Item Form Modal ──────────────────────────────────────────────────────

function LostFoundFormModal({ visible, onClose, theme, request, qc }: {
  visible: boolean; onClose: () => void; theme: any; request: any; qc: any;
}) {
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => { setFormTitle(""); setFormDesc(""); setFormLocation(""); onClose(); };

  const submit = async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await request("/lostitems", { method: "POST", body: JSON.stringify({ title: formTitle, description: formDesc, location: formLocation }) });
      qc.invalidateQueries({ queryKey: ["lostitems"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch { }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.modalOverlay} onPress={close}>
        <Pressable style={[styles.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>Report Lost Item</Text>
          <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Help others find it</Text>
          <TextInput placeholder="Item name *" placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formTitle} onChangeText={setFormTitle} />
          <TextInput placeholder="Description" placeholderTextColor={theme.textTertiary}
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formDesc} onChangeText={setFormDesc} multiline numberOfLines={3} />
          <TextInput placeholder="Last seen location (e.g. Mess, Library)" placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formLocation} onChangeText={setFormLocation} />
          <View style={styles.modalActions}>
            <Pressable onPress={close} style={[styles.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={submitting || !formTitle.trim()} style={[styles.submitBtn, { backgroundColor: formTitle.trim() ? theme.tint : theme.border }]}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit</Text>}
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
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split("T")[0];

  const { data = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["attendance", today],
    queryFn: () => request("/attendance"),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const { data: todayCheckins = [] } = useQuery<any[]>({
    queryKey: ["checkins-today"],
    queryFn: () => request("/checkins?limit=200"),
    refetchInterval: 15000,
    staleTime: 8000,
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

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const toggleAttendance = useCallback(async (studentId: string, current: string) => {
    const next = current === "entered" ? "not_entered" : "entered";
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingId(studentId);
    try { await markMutation.mutateAsync({ studentId, status: next }); } catch { }
    setUpdatingId(null);
  }, [markMutation]);

  const toggleInventory = useCallback(async (studentId: string, field: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingInv(`${studentId}-${field}`);
    try { await invMutation.mutateAsync({ studentId, field, val: !current }); } catch { }
    setUpdatingInv(null);
  }, [invMutation]);

  const markCheckin = useCallback(async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingInId(studentId);
    try {
      await request(`/checkins/${studentId}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to check in"); }
    setCheckingInId(null);
  }, [request, qc]);

  const markCheckout = useCallback(async (checkinId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckingOutId(checkinId);
    try {
      await request(`/checkins/${checkinId}/checkout`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to check out"); }
    setCheckingOutId(null);
  }, [request, qc]);

  const submitInventory = useCallback(async (studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmittingId(studentId);
    try {
      await request(`/attendance/inventory/${studentId}/submit`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to submit"); }
    setSubmittingId(null);
  }, [request, qc]);

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
  const total = data.length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats strip */}
      <View style={[styles.statsStripRow, { borderBottomColor: theme.border }]}>
        <StatPill label="Total" value={total} color={theme.text} theme={theme} />
        <StatPill label="In Campus" value={entered} color="#22c55e" theme={theme} />
        <StatPill label="Checked In" value={checkedInCount} color="#8b5cf6" theme={theme} />
        <StatPill label="Pending" value={total - entered} color="#f59e0b" theme={theme} />
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
            const isSubmitting = submittingId === item.id;
            const inv = item.inventory || { mattress: false, bedsheet: false, pillow: false, inventoryLocked: false };
            const locked = !!inv.inventoryLocked;

            return (
              <View style={[styles.attCard, { backgroundColor: theme.surface, borderColor: locked ? "#22c55e50" : isEntered ? "#6366f130" : theme.border }]}>

                {/* ── Row 1: Student identity + campus status ── */}
                <View style={styles.attTopRow}>
                  <View style={[styles.avatar, { backgroundColor: isEntered ? "#22c55e20" : theme.tint + "20" }]}>
                    <Text style={[styles.avatarText, { color: isEntered ? "#22c55e" : theme.tint }]}>
                      {(item.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                      <Pressable onPress={() => toggleAttendance(item.id, item.attendance?.status || "not_entered")} disabled={isUpdating}
                        style={[styles.statusPill, { backgroundColor: isEntered ? "#22c55e18" : "#f59e0b18", borderColor: isEntered ? "#22c55e50" : "#f59e0b50" }]}>
                        {isUpdating
                          ? <ActivityIndicator size="small" color={isEntered ? "#22c55e" : "#f59e0b"} style={{ width: 28 }} />
                          : <><View style={[styles.statusDot, { backgroundColor: isEntered ? "#22c55e" : "#f59e0b" }]} />
                            <Text style={[styles.statusPillText, { color: isEntered ? "#22c55e" : "#f59e0b" }]}>{isEntered ? "In" : "Out"}</Text></>}
                      </Pressable>
                      {locked && (
                        <View style={[styles.statusPill, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
                          <Feather name="lock" size={10} color="#22c55e" />
                          <Text style={[styles.statusPillText, { color: "#22c55e" }]}>Submitted</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
                    </Text>
                    {(item.contactNumber || item.phone) ? (
                      <Text style={[styles.studentMeta, { color: theme.textTertiary }]}>
                        <Feather name="phone" size={10} /> {item.contactNumber || item.phone}
                      </Text>
                    ) : null}
                  </View>
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

                {/* ── Row 3: Inventory (3 checkboxes) ── */}
                <View style={[styles.invSection, { borderTopColor: theme.border }]}>
                  <Text style={[styles.invSectionLabel, { color: theme.textSecondary }]}>
                    <Feather name={locked ? "lock" : "box"} size={11} /> Inventory
                  </Text>
                  <View style={styles.invChipsRow}>
                    {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                      const checked = !!inv[field];
                      const isToggling = updatingInv === `${item.id}-${field}`;
                      return (
                        <Pressable key={field} onPress={() => !locked && toggleInventory(item.id, field, checked)}
                          disabled={locked || isToggling}
                          style={[styles.invChip, {
                            backgroundColor: checked ? "#22c55e15" : theme.background,
                            borderColor: checked ? "#22c55e60" : theme.border,
                            opacity: locked && !checked ? 0.5 : 1,
                          }]}>
                          {isToggling
                            ? <ActivityIndicator size="small" color="#22c55e" style={{ width: 14 }} />
                            : <Feather name={checked ? "check-circle" : "circle"} size={14} color={checked ? "#22c55e" : theme.textTertiary} />}
                          <Text style={[styles.invChipText, { color: checked ? "#22c55e" : theme.textSecondary }]}>
                            {field.charAt(0).toUpperCase() + field.slice(1)}
                          </Text>
                          {locked && checked && <Feather name="lock" size={9} color="#22c55e" />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ── Row 4: Check Out + Submit ── */}
                <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
                  {/* Check Out */}
                  <View style={[styles.actionIcon, { backgroundColor: checkin?.checkOutTime ? "#f59e0b20" : theme.background }]}>
                    <Feather name="log-out" size={14} color={checkin?.checkOutTime ? "#f59e0b" : theme.textTertiary} />
                  </View>
                  {checkin?.checkOutTime ? (
                    <View style={[styles.timeStampBadge, { flex: 1 }]}>
                      <Text style={[styles.timeStampLabel, { color: theme.textTertiary }]}>Check-out</Text>
                      <Text style={[styles.timeStampValue, { color: "#f59e0b" }]}>{formatTime(checkin.checkOutTime)}</Text>
                    </View>
                  ) : checkin ? (
                    <>
                      <Text style={[styles.actionNone, { color: theme.textTertiary, flex: 1 }]}>Awaiting checkout</Text>
                      <Pressable onPress={() => markCheckout(checkin.id)} disabled={isCheckingOut}
                        style={[styles.actionBtn, { backgroundColor: "#f59e0b", opacity: isCheckingOut ? 0.6 : 1 }]}>
                        {isCheckingOut
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <><Feather name="log-out" size={13} color="#fff" /><Text style={styles.actionBtnText}>Check Out</Text></>}
                      </Pressable>
                    </>
                  ) : (
                    <Text style={[styles.actionNone, { color: theme.textTertiary, flex: 1 }]}>Check in first</Text>
                  )}

                  {/* Submit button — only show if not locked */}
                  {!locked && (
                    <Pressable onPress={() => {
                      Alert.alert(
                        "Submit Inventory",
                        "This will permanently lock the inventory for this student. It cannot be changed afterwards.",
                        [
                          { text: "Cancel", style: "cancel" },
                          { text: "Submit", style: "destructive", onPress: () => submitInventory(item.id) },
                        ]
                      );
                    }} disabled={isSubmitting}
                      style={[styles.submitInventoryBtn, { opacity: isSubmitting ? 0.6 : 1 }]}>
                      {isSubmitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <><Feather name="check-square" size={13} color="#fff" /><Text style={styles.actionBtnText}>Submit</Text></>}
                    </Pressable>
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
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const toggleMessCard = async (studentId: string, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTogglingId(studentId);
    try {
      await request(`/attendance/mess-card/${studentId}`, { method: "PATCH", body: JSON.stringify({ messCard: !current }) });
      qc.invalidateQueries({ queryKey: ["attendance"] });
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
                </View>
                <Pressable
                  onPress={() => toggleMessCard(item.id, given)}
                  disabled={isToggling}
                  style={[styles.messCardBtn, {
                    backgroundColor: given ? "#22c55e" : theme.background,
                    borderColor: given ? "#22c55e" : theme.border,
                  }]}>
                  {isToggling
                    ? <ActivityIndicator size="small" color={given ? "#fff" : theme.tint} />
                    : <>
                        <Feather name={given ? "check-circle" : "circle"} size={15} color={given ? "#fff" : theme.textSecondary} />
                        <Text style={[styles.messCardBtnText, { color: given ? "#fff" : theme.textSecondary }]}>
                          {given ? "Card Given" : "Not Given"}
                        </Text>
                      </>}
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── LOST ITEMS LIST VIEW ─────────────────────────────────────────────────────

function LostItemsListView({ theme }: { theme: any }) {
  const request = useApiRequest();
  const [refreshing, setRefreshing] = useState(false);
  const { data: items = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["lostitems"],
    queryFn: () => request("/lostitems"),
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);

  const statusColor = (s: string) => s === "found" ? "#22c55e" : s === "claimed" ? "#8b5cf6" : "#f59e0b";
  const statusLabel = (s: string) => s === "found" ? "Found" : s === "claimed" ? "Claimed" : "Lost";

  return (
    <FlatList
      data={items as any[]}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={() =>
        isLoading ? <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /></View> : (
          <View style={styles.emptyState}>
            <Feather name="package" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No items reported yet</Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <View style={[styles.lostCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.lostIcon, { backgroundColor: statusColor(item.status) + "20" }]}>
            <Feather name="package" size={18} color={statusColor(item.status)} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.studentName, { color: theme.text }]}>{item.title}</Text>
            {item.description ? <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
            <View style={styles.metaRow}>
              {item.location ? <View style={styles.metaChip}><Feather name="map-pin" size={10} color={theme.textTertiary} /><Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.location}</Text></View> : null}
              <View style={styles.metaChip}><Feather name="user" size={10} color={theme.textTertiary} /><Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.reportedByName}</Text></View>
              <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
          </View>
        </View>
      )}
    />
  );
}

// ─── ATTENDANCE SCREEN (staff/volunteer/admin) ─────────────────────────────────

const TAB_CONFIG = [
  { key: "room",  icon: "home",    label: "Room",  color: "#6366f1" },
  { key: "mess",  icon: "coffee",  label: "Mess",  color: "#22c55e" },
  { key: "items", icon: "package", label: "Lost",  color: "#f59e0b" },
] as const;
type AttTab = "room" | "mess" | "items";

function AttendanceScreen({ theme, topPad }: { theme: any; topPad: number }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const [showLostModal, setShowLostModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [activeTab, setActiveTab] = useState<AttTab>("room");

  const pageTitles: Record<AttTab, string> = { room: "Room Attendance", mess: "Mess Cards", items: "Lost & Found" };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>{pageTitles[activeTab]}</Text>
            <Text style={[styles.pageDate, { color: theme.textSecondary }]}>{new Date().toDateString()}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {TAB_CONFIG.map(tab => {
              const active = activeTab === tab.key;
              return (
                <Pressable key={tab.key}
                  onPress={() => { setActiveTab(tab.key as AttTab); Haptics.selectionAsync(); }}
                  style={[styles.tabBtn, { backgroundColor: active ? tab.color + "20" : theme.surface, borderColor: active ? tab.color : theme.border }]}>
                  <Feather name={tab.icon as any} size={13} color={active ? tab.color : theme.textSecondary} />
                  <Text style={[styles.tabBtnText, { color: active ? tab.color : theme.textSecondary }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {activeTab === "room" ? <RoomAttendanceView theme={theme} />
        : activeTab === "mess" ? <MessAttendanceView theme={theme} />
        : <LostItemsListView theme={theme} />}

      <NotificationModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} theme={theme} request={request} qc={qc} />
      <LostFoundFormModal visible={showLostModal} onClose={() => setShowLostModal(false)} theme={theme} request={request} qc={qc} />
      <FloatingMenu theme={theme} canNotify={true} onNewLostItem={() => setShowLostModal(true)} onNewNotification={() => setShowNotifModal(true)} />
    </View>
  );
}

// ─── LOST & FOUND SCREEN (students) ───────────────────────────────────────────

function LostFoundScreen({ theme, topPad }: { theme: any; topPad: number }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const isStaff = user?.role && user.role !== "student";

  const { data: items = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["lostitems"],
    queryFn: () => request("/lostitems"),
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const onRefresh = useCallback(async () => { setRefreshing(true); await refetch(); setRefreshing(false); }, [refetch]);
  const statusColor = (s: string) => s === "found" ? "#22c55e" : s === "claimed" ? "#8b5cf6" : "#f59e0b";
  const statusLabel = (s: string) => s === "found" ? "Found" : s === "claimed" ? "Claimed" : "Lost";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Lost & Found</Text>
            <Text style={[styles.pageDate, { color: theme.textSecondary }]}>{items.length} item{items.length !== 1 ? "s" : ""} reported</Text>
          </View>
          <Pressable onPress={() => setShowLostModal(true)} style={[styles.reportBtn, { backgroundColor: theme.tint }]}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.reportBtnText}>Report</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={() =>
          isLoading ? (<View><CardSkeleton /><CardSkeleton /></View>) : (
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No items reported yet</Text>
              <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>Tap "Report" to log a lost item</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <AnimatedCard style={{}}>
            <View style={styles.lostItemRow}>
              <View style={[styles.lostIcon, { backgroundColor: statusColor(item.status) + "20" }]}>
                <Feather name="package" size={18} color={statusColor(item.status)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.studentName, { color: theme.text }]}>{item.title}</Text>
                {item.description ? <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text> : null}
                <View style={styles.metaRow}>
                  {item.location ? <View style={styles.metaChip}><Feather name="map-pin" size={10} color={theme.textTertiary} /><Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.location}</Text></View> : null}
                  <View style={styles.metaChip}><Feather name="user" size={10} color={theme.textTertiary} /><Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.reportedByName}</Text></View>
                  <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>
            </View>
          </AnimatedCard>
        )}
      />

      <LostFoundFormModal visible={showLostModal} onClose={() => setShowLostModal(false)} theme={theme} request={request} qc={qc} />
      {isStaff && (
        <>
          <NotificationModal visible={showNotifModal} onClose={() => setShowNotifModal(false)} theme={theme} request={request} qc={qc} />
          <FloatingMenu theme={theme} canNotify={true} onNewLostItem={() => setShowLostModal(true)} onNewNotification={() => setShowNotifModal(true)} />
        </>
      )}
    </View>
  );
}

// ─── ROOT ──────────────────────────────────────────────────────────────────────

export default function LostFoundTab() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const { isStudent } = useAuth();

  if (isStudent) return <LostFoundScreen theme={theme} topPad={topPad} />;
  return <AttendanceScreen theme={theme} topPad={topPad} />;
}

function StatPill({ label, value, color, theme }: { label: string; value: number; color: string; theme: any }) {
  return (
    <View style={[styles.statPill, { backgroundColor: color + "15", borderColor: color + "40" }]}>
      <Text style={[styles.statPillVal, { color }]}>{value}</Text>
      <Text style={[styles.statPillLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 4 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pageDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  // Stats strip
  statsStripRow: { flexDirection: "row", gap: 6, padding: 10, borderBottomWidth: 1, flexWrap: "wrap" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1 },
  statPillVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statPillLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Search bar
  searchBarWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchBarInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 4 },

  // Attendance card
  attCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  attTopRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Status pill (inline badge next to name)
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  // Action rows (check in / check out)
  actionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 1 },
  actionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  actionNone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  actionBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  timeStampBadge: { gap: 1 },
  timeStampLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  timeStampValue: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Submit inventory button
  submitInventoryBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, backgroundColor: "#22c55e", marginLeft: 4 },

  // Inventory section
  invSection: { paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, gap: 8 },
  invSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3 },
  invChipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  invChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  invChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Mess card row
  messCardRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  messCardBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  messCardBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Lost & Found
  lostCard: { flexDirection: "row", gap: 12, alignItems: "flex-start", borderRadius: 14, borderWidth: 1, padding: 14 },
  lostItemRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  lostIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaChipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, alignSelf: "flex-start" },
  statusBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  reportBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  reportBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Empty state
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptySubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Modals
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000060" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flex: 1, borderRadius: 10, alignItems: "center", paddingVertical: 12 },
  submitBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },

  // FAB
  fabContainer: { position: "absolute", bottom: 100, right: 20, alignItems: "flex-end", gap: 10 },
  fabBackdrop: { position: "absolute", top: -1000, left: -1000, right: -1000, bottom: -1000 },
  fabMenu: { gap: 8, alignItems: "flex-end" },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  fabMenuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fabMenuLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
});
