import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
  Modal, TextInput, Alert,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, withDelay, interpolate, Extrapolation,
  FadeInDown, FadeIn, ZoomIn, SlideInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useApiRequest } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

function formatTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit",
  });
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
      <Pressable style={S.modalOverlay} onPress={close}>
        <Pressable style={[S.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={S.modalHandle} />
          <Text style={[S.modalTitle, { color: theme.text }]}>Send Notification</Text>
          <Text style={[S.modalSubtitle, { color: theme.textSecondary }]}>Broadcasts to your hostel students</Text>
          <TextInput placeholder="Notification title *" placeholderTextColor={theme.textTertiary}
            style={[S.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={title} onChangeText={setTitle} />
          <TextInput placeholder="Message body (optional)" placeholderTextColor={theme.textTertiary}
            style={[S.input, S.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={body} onChangeText={setBody} multiline numberOfLines={3} />
          <View style={S.modalActions}>
            <Pressable onPress={close} style={[S.cancelBtn, { borderColor: theme.border }]}>
              <Text style={[S.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} disabled={submitting || !title.trim()}
              style={[S.submitModalBtn, { backgroundColor: title.trim() ? "#f59e0b" : theme.border }]}>
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={S.submitModalBtnText}>Send</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Single Inventory Item Block ──────────────────────────────────────────────

const ITEM_META = {
  mattress: { label: "Mattress", icon: "layers" as const, color: "#8b5cf6", darkBg: "#1e1033" },
  bedsheet: { label: "Bedsheet", icon: "wind" as const,   color: "#06b6d4", darkBg: "#0c2233" },
  pillow:   { label: "Pillow",   icon: "cloud" as const,  color: "#22c55e", darkBg: "#072015" },
};

type InvField = keyof typeof ITEM_META;

function InventoryItemBlock({
  field, given, submitted, locked, isToggling, isSubmitting, index,
  onToggle, onSubmit,
}: {
  field: InvField; given: boolean; submitted: boolean; locked: boolean;
  isToggling: boolean; isSubmitting: boolean; index: number;
  onToggle: () => void; onSubmit: () => void;
}) {
  const meta = ITEM_META[field];
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(submitted || given ? 1 : 0);
  const submitScale = useSharedValue(given && !submitted ? 1 : 0);

  useEffect(() => {
    if (given) {
      scale.value = withSequence(
        withSpring(1.08, { damping: 6, stiffness: 280 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
      checkScale.value = withDelay(80, withSpring(1, { damping: 10, stiffness: 250 }));
    }
  }, [given]);

  useEffect(() => {
    if (given && !submitted) {
      submitScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 200 }));
    } else if (submitted) {
      submitScale.value = withTiming(0, { duration: 200 });
      checkScale.value = withSpring(1, { damping: 8, stiffness: 200 });
    }
  }, [given, submitted]);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const submitAnim = useAnimatedStyle(() => ({
    transform: [{ scaleY: submitScale.value }, { scale: submitScale.value }],
    opacity: submitScale.value,
    maxHeight: interpolate(submitScale.value, [0, 1], [0, 52], Extrapolation.CLAMP),
    overflow: "hidden" as const,
  }));

  const borderColor = submitted ? meta.color + "80" : given ? meta.color + "40" : "#1a2a45";
  const bgColor = submitted ? meta.darkBg : given ? meta.darkBg + "aa" : "#0b1728";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 90).springify().damping(14)}
      style={[S.invItemWrapper, cardAnim]}
    >
      {/* Toggle chip */}
      <Pressable
        onPress={() => !given && !submitted && !locked && !isToggling && onToggle()}
        disabled={given || submitted || locked || isToggling}
        style={({ pressed }) => [
          S.invItemCard,
          { borderColor, backgroundColor: bgColor, opacity: pressed && !given ? 0.8 : 1 },
        ]}
      >
        {/* Glow overlay when given */}
        {given && (
          <Animated.View entering={FadeIn.duration(300)} style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: "hidden" }]}>
            <LinearGradient
              colors={[meta.color + "18", meta.color + "06"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        )}

        {/* Icon */}
        <View style={[S.invItemIcon, { backgroundColor: meta.color + "20" }]}>
          {isToggling
            ? <ActivityIndicator size="small" color={meta.color} />
            : submitted
              ? <Animated.View entering={ZoomIn.springify().damping(8)}><Feather name="check-circle" size={18} color={meta.color} /></Animated.View>
              : <Feather name={given ? "check-circle" : meta.icon} size={18} color={given ? meta.color : "#334155"} />}
        </View>

        {/* Label */}
        <Text style={[S.invItemLabel, { color: given ? meta.color : "#475569" }]}>{meta.label}</Text>

        {/* State badge */}
        {submitted
          ? <Animated.View entering={ZoomIn.springify().damping(8)} style={[S.itemBadge, { backgroundColor: meta.color + "20", borderColor: meta.color + "50" }]}>
              <Feather name="lock" size={9} color={meta.color} />
              <Text style={[S.itemBadgeText, { color: meta.color }]}>Done</Text>
            </Animated.View>
          : given
            ? <View style={[S.itemBadge, { backgroundColor: "#ffffff12", borderColor: "#ffffff20" }]}>
                <Feather name="check" size={9} color="#94a3b8" />
                <Text style={[S.itemBadgeText, { color: "#94a3b8" }]}>Given</Text>
              </View>
            : <View style={[S.itemBadge, { backgroundColor: "#0a1628", borderColor: "#1e2d4a" }]}>
                <Feather name="circle" size={9} color="#334155" />
                <Text style={[S.itemBadgeText, { color: "#334155" }]}>None</Text>
              </View>}
      </Pressable>

      {/* Submit button — animates in after item is given */}
      <Animated.View style={submitAnim}>
        <Pressable
          onPress={onSubmit}
          disabled={isSubmitting || !given || submitted}
          style={({ pressed }) => [S.invSubmitBtn, { borderColor: meta.color + "70", opacity: pressed || isSubmitting ? 0.75 : 1 }]}
        >
          <LinearGradient
            colors={[meta.color + "cc", meta.color]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={S.invSubmitBtnGrad}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <><Feather name="send" size={11} color="#fff" /><Text style={S.invSubmitBtnText}>Submit {meta.label}</Text></>}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Attendance Card ──────────────────────────────────────────────────────────

function AttendanceCard({
  item, checkin, updatingId, updatingInv, checkingInId,
  checkingOutId, submittingInvItem,
  onToggleAttendance, onCheckIn, onToggleInventory, onSubmitItem, onCheckOut,
}: any) {
  const inv = item.inventory || {
    mattress: false, bedsheet: false, pillow: false,
    mattressSubmitted: false, bedsheetSubmitted: false, pillowSubmitted: false,
    inventoryLocked: false,
  };
  const isEntered = item.attendance?.status === "entered";
  const isUpdating = updatingId === item.id;
  const isCheckingIn = checkingInId === item.id;
  const isCheckingOut = checkingOutId === checkin?.id;
  const isLocked = !!inv.inventoryLocked;
  const isCheckedIn = !!checkin && !checkin.checkOutTime;
  const isCheckedOut = !!checkin?.checkOutTime;
  const allSubmitted = inv.mattressSubmitted && inv.bedsheetSubmitted && inv.pillowSubmitted;

  // Animate the inventory section open when checked in
  const invOpen = useSharedValue(0);
  useEffect(() => {
    invOpen.value = isCheckedIn && !isCheckedOut
      ? withDelay(150, withSpring(1, { damping: 16, stiffness: 100 }))
      : withTiming(0, { duration: 250 });
  }, [isCheckedIn, isCheckedOut]);

  const invSectionStyle = useAnimatedStyle(() => ({
    opacity: invOpen.value,
    maxHeight: interpolate(invOpen.value, [0, 1], [0, 420], Extrapolation.CLAMP),
    overflow: "hidden" as const,
    transform: [{ scaleY: interpolate(invOpen.value, [0, 1], [0.85, 1], Extrapolation.CLAMP) }],
  }));

  // Checkout button bounce in when all submitted
  const checkoutScale = useSharedValue(0);
  useEffect(() => {
    if (allSubmitted || isLocked) {
      checkoutScale.value = withDelay(200, withSpring(1, { damping: 10, stiffness: 180 }));
    }
  }, [allSubmitted, isLocked]);

  const checkoutBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkoutScale.value }],
    opacity: checkoutScale.value,
  }));

  const borderCol = isCheckedOut ? "#f59e0b30"
    : isLocked ? "#22c55e35"
    : isCheckedIn ? "#8b5cf630"
    : "#111e35";

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(15).stiffness(80)}
      style={[S.card, { borderColor: borderCol }]}
    >
      {/* Card dark gradient bg */}
      <LinearGradient
        colors={["#0d1b33", "#08111f"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      {/* ── Top: Student identity + campus status ── */}
      <View style={S.cardTop}>
        <View style={[S.avatar, { backgroundColor: isEntered ? "#14532d30" : "#1e3a5f30" }]}>
          <Text style={[S.avatarLetter, { color: isEntered ? "#22c55e" : "#60a5fa" }]}>
            {(item.name || "?")[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <Text style={S.studentName} numberOfLines={1}>{item.name}</Text>
            {/* Campus In/Out toggle — Button implicit #1 context */}
            <Pressable
              onPress={() => !isEntered && !isUpdating && onToggleAttendance(item.id, item.attendance?.status || "not_entered")}
              disabled={isEntered || isUpdating}
              style={[S.campusPill, {
                backgroundColor: isEntered ? "#14532d30" : "#78350f25",
                borderColor: isEntered ? "#22c55e50" : "#f59e0b50",
              }]}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color="#f59e0b" style={{ width: 22 }} />
                : <><View style={[S.campusDot, { backgroundColor: isEntered ? "#22c55e" : "#f59e0b" }]} />
                  <Text style={[S.campusPillText, { color: isEntered ? "#22c55e" : "#f59e0b" }]}>
                    {isEntered ? "In ✓" : "Out"}
                  </Text></>}
            </Pressable>
          </View>
          <Text style={S.studentMeta}>
            {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
          </Text>
        </View>
        {/* Status badge */}
        {checkin && (
          isLocked
            ? <Animated.View entering={ZoomIn.springify().damping(9)} style={S.badgeGreen}>
                <Feather name="check-circle" size={11} color="#22c55e" />
                <Text style={S.badgeGreenText}>All Done</Text>
              </Animated.View>
            : <View style={S.badgeRed}>
                <Feather name="alert-circle" size={11} color="#ef4444" />
                <Text style={S.badgeRedText}>
                  {allSubmitted ? "Locking…" : "Pending"}
                </Text>
              </View>
        )}
      </View>

      {/* ══════════════════════════════════════════
          BUTTON 1: CHECK IN
         ══════════════════════════════════════════ */}
      <View style={S.actionRow}>
        <View style={[S.actionIconBox, { backgroundColor: checkin ? "#8b5cf620" : "#111e35" }]}>
          <Feather name="log-in" size={14} color={checkin ? "#8b5cf6" : "#334155"} />
        </View>
        {checkin ? (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.rowLabel}>Check-in</Text>
            <Text style={[S.rowTime, { color: "#8b5cf6" }]}>{formatTime(checkin.checkInTime)}</Text>
          </View>
        ) : (
          <>
            <Text style={[S.rowHint, { flex: 1 }]}>Not checked in yet</Text>
            <Pressable onPress={() => onCheckIn(item.id)} disabled={isCheckingIn}
              style={({ pressed }) => [S.actionBtn, { opacity: pressed || isCheckingIn ? 0.75 : 1 }]}>
              <LinearGradient colors={["#6d28d9", "#8b5cf6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={S.actionBtnGrad}>
                {isCheckingIn ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="log-in" size={13} color="#fff" /><Text style={S.actionBtnText}>Check In</Text></>}
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>

      {/* ══════════════════════════════════════════
          BUTTONS 2–4: INVENTORY TOGGLE CHIPS
          BUTTONS 5–7: INDIVIDUAL SUBMIT BUTTONS
         ══════════════════════════════════════════ */}
      {isCheckedIn && !isCheckedOut && (
        <Animated.View style={[S.invSection, invSectionStyle]}>
          {/* Section header */}
          <View style={S.invHeader}>
            <Feather name={isLocked ? "lock" : "package"} size={12} color={isLocked ? "#22c55e" : "#475569"} />
            <Text style={[S.invHeaderText, { color: isLocked ? "#22c55e" : "#475569" }]}>
              {isLocked ? "Inventory Submitted & Locked" : "Inventory — Give & Submit Each Item"}
            </Text>
          </View>

          {/* 3 item blocks side by side */}
          <View style={S.invRow}>
            {(["mattress", "bedsheet", "pillow"] as InvField[]).map((field, idx) => (
              <InventoryItemBlock
                key={field}
                field={field}
                index={idx}
                given={!!inv[field]}
                submitted={!!inv[`${field}Submitted`]}
                locked={isLocked}
                isToggling={updatingInv === `${item.id}-${field}`}
                isSubmitting={submittingInvItem === `${item.id}-${field}`}
                onToggle={() => onToggleInventory(item.id, field)}
                onSubmit={() => onSubmitItem(item.id, field)}
              />
            ))}
          </View>

          {/* Progress bar */}
          <View style={S.progressWrap}>
            <View style={S.progressBar}>
              <Animated.View style={[
                S.progressFill,
                { width: `${((+!!inv.mattressSubmitted + +!!inv.bedsheetSubmitted + +!!inv.pillowSubmitted) / 3) * 100}%` }
              ]} />
            </View>
            <Text style={S.progressLabel}>
              {+!!inv.mattressSubmitted + +!!inv.bedsheetSubmitted + +!!inv.pillowSubmitted}/3 submitted
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ══════════════════════════════════════════
          BUTTON 8: CHECK OUT
         ══════════════════════════════════════════ */}
      <View style={[S.actionRow, { borderTopColor: "#0e1d33" }]}>
        <View style={[S.actionIconBox, { backgroundColor: isCheckedOut ? "#f59e0b18" : "#111e35" }]}>
          <Feather name="log-out" size={14} color={isCheckedOut ? "#f59e0b" : "#334155"} />
        </View>
        {isCheckedOut ? (
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={S.rowLabel}>Checked out</Text>
            <Text style={[S.rowTime, { color: "#f59e0b" }]}>{formatTime(checkin.checkOutTime)}</Text>
          </View>
        ) : checkin ? (
          <>
            <Text style={[S.rowHint, { flex: 1, color: isLocked ? "#475569" : "#ef444480" }]}>
              {isLocked ? "Ready to check out" : "Submit all items to enable"}
            </Text>
            <Animated.View style={isLocked ? checkoutBtnStyle : {}}>
              <Pressable
                onPress={() => onCheckOut(checkin.id, item.id, inv)}
                disabled={isCheckingOut || !isLocked}
                style={({ pressed }) => [
                  S.checkOutBtn,
                  {
                    backgroundColor: isLocked ? "#f59e0b" : "#1a2a3f",
                    borderColor: isLocked ? "#d97706" : "#1e2d4a",
                    opacity: pressed || isCheckingOut ? 0.75 : 1,
                  }
                ]}
              >
                {isCheckingOut ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="log-out" size={13} color={isLocked ? "#fff" : "#334155"} />
                    <Text style={[S.checkOutBtnText, { color: isLocked ? "#fff" : "#334155" }]}>Check Out</Text></>}
              </Pressable>
            </Animated.View>
          </>
        ) : (
          <Text style={[S.rowHint, { flex: 1 }]}>Check in first</Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Room Attendance View ──────────────────────────────────────────────────────

function RoomAttendanceView({ theme }: { theme: any }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updatingInv, setUpdatingInv] = useState<string | null>(null);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [submittingInvItem, setSubmittingInvItem] = useState<string | null>(null);
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
    mutationFn: ({ studentId, status }: any) =>
      request(`/attendance/${studentId}`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const invMutation = useMutation({
    mutationFn: ({ studentId, field }: any) =>
      request(`/attendance/inventory/${studentId}`, { method: "PATCH", body: JSON.stringify({ [field]: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });

  const submitItemMutation = useMutation({
    mutationFn: ({ studentId, item }: any) =>
      request(`/attendance/inventory/${studentId}/submit-item`, { method: "POST", body: JSON.stringify({ item }) }),
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

  const handleToggleAttendance = useCallback(async (studentId: string, current: string) => {
    if (current === "entered") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingId(studentId);
    try { await markMutation.mutateAsync({ studentId, status: "entered" }); } catch { }
    setUpdatingId(null);
  }, [markMutation]);

  const handleToggleInventory = useCallback(async (studentId: string, field: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdatingInv(`${studentId}-${field}`);
    try { await invMutation.mutateAsync({ studentId, field }); } catch { }
    setUpdatingInv(null);
  }, [invMutation]);

  const handleSubmitItem = useCallback(async (studentId: string, item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmittingInvItem(`${studentId}-${item}`);
    try {
      await submitItemMutation.mutateAsync({ studentId, item });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed"); }
    setSubmittingInvItem(null);
  }, [submitItemMutation]);

  const handleCheckIn = useCallback(async (studentId: string) => {
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

  const handleCheckOut = useCallback(async (checkinId: string, studentId: string, inv: any) => {
    if (!inv?.inventoryLocked) {
      Alert.alert("Cannot Check Out", "Please submit all inventory items first.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCheckingOutId(checkinId);
    try {
      await request(`/checkins/${checkinId}/checkout`, { method: "PATCH" });
      qc.invalidateQueries({ queryKey: ["checkins-today"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed to check out"); }
    setCheckingOutId(null);
  }, [request, qc]);

  const sq = search.trim().toLowerCase();
  const filtered = sq
    ? (data as any[]).filter(s =>
        s.name?.toLowerCase().includes(sq) ||
        s.roomNumber?.toLowerCase().includes(sq) ||
        s.rollNumber?.toLowerCase().includes(sq))
    : (data as any[]);

  const entered = (data as any[]).filter(s => s.attendance?.status === "entered").length;
  const checkedIn = Object.values(checkinMap).filter((c: any) => !c.checkOutTime).length;
  const invDone = (data as any[]).filter(s => s.inventory?.inventoryLocked).length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats */}
      <View style={S.statsRow}>
        {[
          { label: "Total", val: data.length, color: "#cbd5e1" },
          { label: "In Campus", val: entered, color: "#22c55e" },
          { label: "Checked In", val: checkedIn, color: "#8b5cf6" },
          { label: "Inv Done", val: invDone, color: "#06b6d4" },
        ].map(p => (
          <View key={p.label} style={S.statPill}>
            <Text style={[S.statVal, { color: p.color }]}>{p.val}</Text>
            <Text style={S.statLabel}>{p.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={S.searchRow}>
        <Feather name="search" size={14} color="#334155" />
        <TextInput
          placeholder="Search name, room, roll…"
          placeholderTextColor="#1e2d4a"
          value={search}
          onChangeText={setSearch}
          style={S.searchInput}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x-circle" size={14} color="#334155" />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 120, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}
          ListEmptyComponent={() => (
            <View style={S.empty}>
              <Feather name="users" size={44} color="#111e35" />
              <Text style={S.emptyText}>{search ? "No students match" : "No students assigned"}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <AttendanceCard
              item={item}
              checkin={checkinMap[item.id]}
              updatingId={updatingId}
              updatingInv={updatingInv}
              checkingInId={checkingInId}
              checkingOutId={checkingOutId}
              submittingInvItem={submittingInvItem}
              onToggleAttendance={handleToggleAttendance}
              onCheckIn={handleCheckIn}
              onToggleInventory={handleToggleInventory}
              onSubmitItem={handleSubmitItem}
              onCheckOut={handleCheckOut}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Mess Card View ────────────────────────────────────────────────────────────

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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert("Error", e.message || "Failed"); }
    setTogglingId(null);
  };

  const sq = search.trim().toLowerCase();
  const filtered = sq
    ? (students as any[]).filter(s =>
        s.name?.toLowerCase().includes(sq) ||
        s.roomNumber?.toLowerCase().includes(sq) ||
        s.rollNumber?.toLowerCase().includes(sq))
    : (students as any[]);

  const givenCount = (students as any[]).filter(s => s.inventory?.messCard).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={S.statsRow}>
        {[
          { label: "Total", val: students.length, color: "#cbd5e1" },
          { label: "Given", val: givenCount, color: "#22c55e" },
          { label: "Pending", val: students.length - givenCount, color: "#f59e0b" },
        ].map(p => (
          <View key={p.label} style={S.statPill}>
            <Text style={[S.statVal, { color: p.color }]}>{p.val}</Text>
            <Text style={S.statLabel}>{p.label}</Text>
          </View>
        ))}
      </View>
      <View style={S.searchRow}>
        <Feather name="search" size={14} color="#334155" />
        <TextInput placeholder="Search…" placeholderTextColor="#1e2d4a" value={search}
          onChangeText={setSearch} style={S.searchInput} clearButtonMode="while-editing" />
      </View>
      {isLoading ? <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View> : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
          contentContainerStyle={{ padding: 10, paddingBottom: 120, gap: 8 }}
          ListEmptyComponent={() => (
            <View style={S.empty}>
              <Feather name="coffee" size={40} color="#111e35" />
              <Text style={S.emptyText}>{search ? "No students match" : "No students assigned"}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const given = !!item.inventory?.messCard;
            const givenAt = item.inventory?.messCardGivenAt;
            const isToggling = togglingId === item.id;
            return (
              <Animated.View entering={FadeInDown.springify().damping(15)} style={S.messRow}>
                <LinearGradient colors={given ? ["#052e16", "#064e3b"] : ["#0d1b33", "#08111f"]}
                  style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                <View style={[S.avatar, { backgroundColor: given ? "#22c55e20" : "#1e6fd920" }]}>
                  <Text style={[S.avatarLetter, { color: given ? "#22c55e" : "#60a5fa" }]}>
                    {(item.name || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.studentName}>{item.name}</Text>
                  <Text style={S.studentMeta}>{item.roomNumber ? `Room ${item.roomNumber}` : item.email}</Text>
                  {given && givenAt && <Text style={[S.studentMeta, { color: "#22c55e" }]}>Given {formatTime(givenAt)}</Text>}
                </View>
                <Pressable onPress={() => !isToggling && toggleMessCard(item.id, given)} disabled={isToggling}
                  style={({ pressed }) => [S.messBtn, {
                    backgroundColor: given ? "#ef444415" : "#22c55e",
                    borderColor: given ? "#ef444440" : "#22c55e",
                    borderWidth: given ? 1 : 0, opacity: pressed ? 0.8 : 1,
                  }]}>
                  {isToggling ? <ActivityIndicator size="small" color={given ? "#ef4444" : "#fff"} />
                    : given
                      ? <><Feather name="x-circle" size={14} color="#ef4444" /><Text style={[S.messBtnText, { color: "#ef4444" }]}>Revoke</Text></>
                      : <><Feather name="check" size={14} color="#fff" /><Text style={[S.messBtnText, { color: "#fff" }]}>Give Card</Text></>}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"room" | "mess">("room");
  const [showNotifModal, setShowNotifModal] = useState(false);

  return (
    <View style={[S.screen, { backgroundColor: "#060e1a" }]}>
      <View style={[S.header, { paddingTop: topPad }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={S.headerTitle}>Attendance</Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowNotifModal(true); }}
            style={S.notifBtn}
          >
            <Feather name="bell" size={15} color="#f59e0b" />
            <Text style={S.notifBtnText}>Notify</Text>
          </Pressable>
        </View>

        {/* Tab switcher */}
        <View style={S.tabBar}>
          {(["room", "mess"] as const).map(t => {
            const active = tab === t;
            const label = t === "room" ? "Room / Inventory" : "Mess Card";
            const icon = t === "room" ? "home" : "coffee";
            const color = t === "room" ? ["#1d4ed8", "#3b82f6"] : ["#15803d", "#22c55e"];
            return (
              <Pressable key={t} onPress={() => { setTab(t); Haptics.selectionAsync(); }}
                style={[S.tabBtn, active && S.tabBtnActive]}>
                {active && <LinearGradient colors={color as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
                <Feather name={icon as any} size={13} color={active ? "#fff" : "#334155"} />
                <Text style={[S.tabBtnText, { color: active ? "#fff" : "#334155" }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === "room" ? <RoomAttendanceView theme={theme} /> : <MessAttendanceView theme={theme} />}

      <NotificationModal visible={showNotifModal} onClose={() => setShowNotifModal(false)}
        theme={theme} request={request} qc={qc} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#0e1d33", gap: 12 },
  headerTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  notifBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#f59e0b18", borderWidth: 1, borderColor: "#f59e0b40" },
  notifBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#f59e0b" },
  tabBar: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: "#0e1d33", padding: 4, gap: 4, backgroundColor: "#091525" },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9, overflow: "hidden" },
  tabBtnActive: {},
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  statsRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: "#0e1d33" },
  statPill: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, gap: 1, backgroundColor: "#0b1728" },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#334155" },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#0e1d33" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0, color: "#94a3b8" },

  // Card
  card: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#334155", marginTop: 1 },
  campusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  campusDot: { width: 6, height: 6, borderRadius: 3 },
  campusPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  badgeGreen: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#14532d40", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#22c55e40" },
  badgeGreenText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#22c55e" },
  badgeRed: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7f1d1d30", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#ef444440" },
  badgeRedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ef4444" },

  // Action rows
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#0e1d33" },
  actionIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#475569" },
  rowTime: { fontSize: 13, fontFamily: "Inter_700Bold" },
  rowHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#1e2d4a" },
  actionBtn: { borderRadius: 10, overflow: "hidden" },
  actionBtnGrad: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9 },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },

  // Inventory section
  invSection: { paddingHorizontal: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#0e1d33", gap: 10 },
  invHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  invHeaderText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  invRow: { flexDirection: "row", gap: 8 },

  // Per-item block
  invItemWrapper: { flex: 1, gap: 6 },
  invItemCard: { borderRadius: 14, borderWidth: 1.5, padding: 10, alignItems: "center", gap: 7, overflow: "hidden", minHeight: 100 },
  invItemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  invItemLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center" },
  itemBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1 },
  itemBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  invSubmitBtn: { borderRadius: 10, overflow: "hidden", borderWidth: 1 },
  invSubmitBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9 },
  invSubmitBtnText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },

  // Progress bar
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressBar: { flex: 1, height: 4, backgroundColor: "#111e35", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: "#22c55e", borderRadius: 2 },
  progressLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#334155" },

  // Check Out
  checkOutBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  checkOutBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Mess card
  messRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: "#111e35", overflow: "hidden" },
  messBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  messBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Empty
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#1e2d4a" },

  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000066" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  textArea: { height: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  submitModalBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitModalBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
