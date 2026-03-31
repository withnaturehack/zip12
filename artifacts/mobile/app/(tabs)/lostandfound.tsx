import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable,
  RefreshControl, Platform, useColorScheme, ActivityIndicator,
  Modal, TextInput, Alert,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, withDelay, interpolate, Extrapolation,
  FadeInDown, ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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

// ─── Inventory Item Chip ───────────────────────────────────────────────────────

function InventoryChip({ label, icon, checked, locked, isToggling, onPress, index }: {
  label: string; icon: string; checked: boolean; locked: boolean;
  isToggling: boolean; onPress: () => void; index: number;
}) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(checked ? 1 : 0);
  const bounce = useSharedValue(0);

  useEffect(() => {
    if (checked) {
      scale.value = withSequence(
        withSpring(1.12, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
      glow.value = withTiming(1, { duration: 300 });
      bounce.value = withSequence(
        withTiming(-3, { duration: 100 }),
        withSpring(0, { damping: 6, stiffness: 400 })
      );
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [checked]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: bounce.value },
    ],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const isDisabled = locked || checked || isToggling;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).springify().damping(14)}
      style={[styles.invChipWrapper, animStyle]}
    >
      <Pressable
        onPress={() => !isDisabled && onPress()}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.invChip,
          {
            borderColor: checked ? "#22c55e70" : locked ? "#374151" : "#2a3a5c",
            backgroundColor: checked ? "#052e16" : "#0a1628",
            transform: [{ scale: pressed && !isDisabled ? 0.95 : 1 }],
          }
        ]}
      >
        {/* Animated glow overlay */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.chipGlowOverlay, bgStyle]}>
          <LinearGradient
            colors={["#22c55e25", "#22c55e05"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {isToggling ? (
          <ActivityIndicator size="small" color="#22c55e" style={{ width: 18, height: 18 }} />
        ) : checked ? (
          <Animated.View entering={ZoomIn.springify().damping(10)}>
            <Feather name="check-circle" size={17} color="#22c55e" />
          </Animated.View>
        ) : (
          <Feather name={locked ? "lock" : "circle"} size={17} color={locked ? "#4b5563" : "#6b7280"} />
        )}
        <Text style={[styles.invChipText, {
          color: checked ? "#22c55e" : locked ? "#4b5563" : "#9ca3af",
        }]}>
          {label}
        </Text>
        {locked && checked && (
          <Animated.View entering={ZoomIn.springify()}>
            <Feather name="lock" size={10} color="#22c55e" />
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Submit Inventory Button ───────────────────────────────────────────────────

function SubmitInventoryButton({ allGiven, missingCount, isSubmitting, onPress }: {
  allGiven: boolean; missingCount: number; isSubmitting: boolean; onPress: () => void;
}) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (allGiven && !isSubmitting) {
      glow.value = withTiming(1, { duration: 400 });
      const loop = () => {
        pulse.value = withSequence(
          withTiming(1.025, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        );
        setTimeout(loop, 1700);
      };
      const t = setTimeout(loop, 400);
      return () => clearTimeout(t);
    } else {
      glow.value = withTiming(0, { duration: 300 });
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [allGiven, isSubmitting]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    shadowOpacity: interpolate(glow.value, [0, 1], [0, 0.55], Extrapolation.CLAMP),
    shadowRadius: interpolate(glow.value, [0, 1], [0, 18], Extrapolation.CLAMP),
    elevation: interpolate(glow.value, [0, 1], [0, 10], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[pulseStyle, { shadowColor: allGiven ? "#06b6d4" : "#f59e0b", shadowOffset: { width: 0, height: 0 } }]}
      entering={FadeInDown.springify().damping(14)}
    >
      <Pressable
        onPress={onPress}
        disabled={isSubmitting}
        style={({ pressed }) => ({ opacity: pressed || isSubmitting ? 0.8 : 1, borderRadius: 13, overflow: "hidden" })}
      >
        <LinearGradient
          colors={allGiven ? ["#0891b2", "#06b6d4", "#22d3ee"] : ["#d97706", "#f59e0b", "#fbbf24"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.submitInvBtnGrad}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name={allGiven ? "send" : "alert-circle"} size={15} color="#fff" />
              <Text style={styles.submitInvBtnText}>
                {allGiven ? "Submit All 3 Items" : `Submit (${3 - missingCount}/3 given)`}
              </Text>
            </>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Check Out Button ──────────────────────────────────────────────────────────

function CheckOutButton({ enabled, isLoading, onPress }: {
  enabled: boolean; isLoading: boolean; onPress: () => void;
}) {
  const bounceIn = useSharedValue(0);

  useEffect(() => {
    if (enabled) {
      bounceIn.value = withDelay(100, withSpring(1, { damping: 10, stiffness: 180 }));
    }
  }, [enabled]);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(bounceIn.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(bounceIn.value, [0, 1], [0.3, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={bounceStyle}>
      <Pressable
        onPress={onPress}
        disabled={isLoading || !enabled}
        style={({ pressed }) => [
          styles.checkOutBtn,
          {
            backgroundColor: enabled ? "#f59e0b" : "#1e293b",
            borderColor: enabled ? "#d97706" : "#334155",
            opacity: pressed ? 0.85 : 1,
          }
        ]}
      >
        {isLoading
          ? <ActivityIndicator size="small" color="#fff" />
          : <>
            <Feather name="log-out" size={13} color={enabled ? "#fff" : "#475569"} />
            <Text style={[styles.checkOutBtnText, { color: enabled ? "#fff" : "#475569" }]}>Check Out</Text>
          </>}
      </Pressable>
    </Animated.View>
  );
}

// ─── Attendance Card ──────────────────────────────────────────────────────────

function AttendanceCard({
  item, theme, checkin, updatingId, updatingInv, checkingInId,
  checkingOutId, submittingInvId,
  onToggleAttendance, onCheckIn, onToggleInventory, onSubmitInventory, onCheckOut,
}: any) {
  const isEntered = item.attendance?.status === "entered";
  const isUpdating = updatingId === item.id;
  const isCheckingIn = checkingInId === item.id;
  const isCheckingOut = checkingOutId === checkin?.id;
  const isSubmittingInv = submittingInvId === item.id;
  const inv = item.inventory || { mattress: false, bedsheet: false, pillow: false, inventoryLocked: false };
  const allGiven = inv.mattress && inv.bedsheet && inv.pillow;
  const isLocked = !!inv.inventoryLocked;
  const missingItems = (["mattress", "bedsheet", "pillow"] as const).filter(f => !inv[f]);
  const isCheckedIn = !!checkin && !checkin.checkOutTime;
  const isCheckedOut = !!checkin?.checkOutTime;

  // Animated inventory section height
  const invHeight = useSharedValue(isCheckedIn && !isCheckedOut ? 1 : 0);

  useEffect(() => {
    if (isCheckedIn && !isCheckedOut) {
      invHeight.value = withSpring(1, { damping: 16, stiffness: 120 });
    } else if (isCheckedOut) {
      invHeight.value = withTiming(0, { duration: 300 });
    }
  }, [isCheckedIn, isCheckedOut]);

  const invSectionStyle = useAnimatedStyle(() => ({
    opacity: invHeight.value,
    transform: [{ scaleY: interpolate(invHeight.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) }],
    maxHeight: interpolate(invHeight.value, [0, 1], [0, 300], Extrapolation.CLAMP),
    overflow: "hidden" as const,
  }));

  const borderColor = isCheckedOut ? "#f59e0b30" : isLocked ? "#22c55e40" : isCheckedIn ? "#8b5cf640" : "#1e2d4a";
  const cardGlow = isLocked ? "#22c55e" : isCheckedIn ? "#8b5cf6" : "transparent";

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(90)}
      style={[styles.attCard, { borderColor, shadowColor: cardGlow }]}
    >
      {/* Card BG gradient */}
      <LinearGradient
        colors={["#0d1c35", "#091525"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      {/* ── Row 1: Student Identity ── */}
      <View style={styles.attTopRow}>
        <View style={[styles.avatar, { backgroundColor: isEntered ? "#22c55e18" : "#1e6fd920" }]}>
          <Text style={[styles.avatarText, { color: isEntered ? "#22c55e" : "#3b8af0" }]}>
            {(item.name || "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
            {/* Campus status pill */}
            <Pressable
              onPress={() => !isEntered && !isUpdating && onToggleAttendance(item.id, item.attendance?.status || "not_entered")}
              disabled={isUpdating || isEntered}
              style={[styles.statusPill, {
                backgroundColor: isEntered ? "#14532d30" : "#78350f30",
                borderColor: isEntered ? "#22c55e50" : "#f59e0b50",
              }]}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color={isEntered ? "#22c55e" : "#f59e0b"} style={{ width: 24 }} />
                : <>
                  <View style={[styles.statusDot, { backgroundColor: isEntered ? "#22c55e" : "#f59e0b" }]} />
                  <Text style={[styles.statusPillText, { color: isEntered ? "#22c55e" : "#f59e0b" }]}>
                    {isEntered ? "In ✓" : "Out"}
                  </Text>
                </>}
            </Pressable>
          </View>
          <Text style={styles.studentMeta} numberOfLines={1}>
            {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
          </Text>
        </View>

        {/* Status badge */}
        {checkin && (
          isLocked
            ? <Animated.View entering={ZoomIn.springify().damping(10)} style={styles.remarkGreen}>
                <Feather name="check-circle" size={11} color="#16a34a" />
                <Text style={styles.remarkGreenText}>Submitted</Text>
              </Animated.View>
            : <View style={styles.remarkRed}>
                <Feather name="alert-circle" size={11} color="#dc2626" />
                <Text style={styles.remarkRedText}>
                  {missingItems.length > 0 ? `Missing ${missingItems.length}` : "Not Submitted"}
                </Text>
              </View>
        )}
      </View>

      {/* ── Row 2: Check-In ── */}
      <View style={styles.actionRow}>
        <View style={[styles.actionIcon, { backgroundColor: checkin ? "#8b5cf618" : "#0a1628" }]}>
          <Feather name="log-in" size={14} color={checkin ? "#8b5cf6" : "#475569"} />
        </View>
        {checkin ? (
          <View style={styles.timeStampBadge}>
            <Text style={styles.timeStampLabel}>Check-in</Text>
            <Text style={[styles.timeStampValue, { color: "#8b5cf6" }]}>{formatTime(checkin.checkInTime)}</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.actionNone, { flex: 1 }]}>Not checked in today</Text>
            <Pressable
              onPress={() => onCheckIn(item.id)}
              disabled={isCheckingIn}
              style={({ pressed }) => [styles.checkInBtn, { opacity: pressed || isCheckingIn ? 0.75 : 1 }]}
            >
              <LinearGradient
                colors={["#7c3aed", "#8b5cf6", "#a78bfa"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.checkInBtnGrad}
              >
                {isCheckingIn
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Feather name="log-in" size={13} color="#fff" /><Text style={styles.actionBtnText}>Check In</Text></>}
              </LinearGradient>
            </Pressable>
          </>
        )}
      </View>

      {/* ── Row 3: Inventory Section (animated expand) ── */}
      {!isCheckedOut && checkin && (
        <Animated.View style={[styles.invSection, invSectionStyle]}>
          <View style={styles.invHeaderRow}>
            <Feather name={isLocked ? "lock" : "package"} size={12} color={isLocked ? "#22c55e" : "#6b7280"} />
            <Text style={[styles.invSectionLabel, { color: isLocked ? "#22c55e" : "#6b7280" }]}>
              {isLocked ? "Inventory Locked ✓" : "Inventory (3 items)"}
            </Text>
          </View>

          {/* 3 Inventory Chips */}
          <View style={styles.invChipsRow}>
            {([
              { field: "mattress", label: "Mattress", icon: "layers" },
              { field: "bedsheet", label: "Bedsheet", icon: "wind" },
              { field: "pillow", label: "Pillow", icon: "cloud" },
            ] as const).map((item2, idx) => (
              <InventoryChip
                key={item2.field}
                label={item2.label}
                icon={item2.icon}
                checked={!!inv[item2.field]}
                locked={isLocked}
                isToggling={updatingInv === `${item.id}-${item2.field}`}
                onPress={() => onToggleInventory(item.id, item2.field, !!inv[item2.field])}
                index={idx}
              />
            ))}
          </View>

          {/* Submit Inventory Button */}
          {!isLocked && (
            <SubmitInventoryButton
              allGiven={allGiven}
              missingCount={missingItems.length}
              isSubmitting={isSubmittingInv}
              onPress={() => onSubmitInventory(item.id)}
            />
          )}
        </Animated.View>
      )}

      {/* ── Row 4: Check-Out ── */}
      <View style={[styles.actionRow, styles.checkoutRow]}>
        <View style={[styles.actionIcon, { backgroundColor: isCheckedOut ? "#f59e0b18" : "#0a1628" }]}>
          <Feather name="log-out" size={14} color={isCheckedOut ? "#f59e0b" : "#475569"} />
        </View>
        {isCheckedOut ? (
          <View style={[styles.timeStampBadge, { flex: 1 }]}>
            <Text style={styles.timeStampLabel}>Checked out</Text>
            <Text style={[styles.timeStampValue, { color: "#f59e0b" }]}>{formatTime(checkin.checkOutTime)}</Text>
          </View>
        ) : checkin ? (
          <>
            {!isLocked
              ? <Text style={[styles.actionNone, { flex: 1, color: "#ef4444" }]}>Submit inventory to enable checkout</Text>
              : <Text style={[styles.actionNone, { flex: 1, color: "#6b7280" }]}>Ready to check out</Text>}
            <CheckOutButton
              enabled={isLocked}
              isLoading={isCheckingOut}
              onPress={() => onCheckOut(checkin.id, item.id, inv)}
            />
          </>
        ) : (
          <Text style={[styles.actionNone, { flex: 1 }]}>Check in first</Text>
        )}
      </View>

    </Animated.View>
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

  const handleToggleAttendance = useCallback(async (studentId: string, current: string) => {
    if (current === "entered") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setUpdatingId(studentId);
    try { await markMutation.mutateAsync({ studentId, status: "entered" }); } catch { }
    setUpdatingId(null);
  }, [markMutation]);

  const handleToggleInventory = useCallback(async (studentId: string, field: string, current: boolean) => {
    if (current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setUpdatingInv(`${studentId}-${field}`);
    try { await invMutation.mutateAsync({ studentId, field, val: true }); } catch { }
    setUpdatingInv(null);
  }, [invMutation]);

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
      Alert.alert("Cannot Check Out", "Please submit the student's inventory before checking out.");
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

  const handleSubmitInventory = useCallback(async (studentId: string) => {
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
  const checkedInCount = Object.values(checkinMap).filter((c: any) => !c.checkOutTime).length;
  const submittedCount = (data as any[]).filter((s: any) => s.inventory?.inventoryLocked).length;
  const total = data.length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats strip */}
      <View style={styles.statsStripRow}>
        <StatPill label="Total" value={total} color="#e2e8f0" />
        <StatPill label="In Campus" value={entered} color="#22c55e" />
        <StatPill label="Checked In" value={checkedInCount} color="#8b5cf6" />
        <StatPill label="Inv Done" value={submittedCount} color="#06b6d4" />
      </View>

      {/* Search bar */}
      <View style={styles.searchBarWrap}>
        <Feather name="search" size={15} color="#475569" />
        <TextInput
          placeholder="Search by name, room, roll…"
          placeholderTextColor="#334155"
          value={search}
          onChangeText={setSearch}
          style={styles.searchBarInput}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x-circle" size={15} color="#475569" />
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
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color="#1e293b" />
              <Text style={styles.emptyText}>
                {search ? "No students match your search" : "No students assigned"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <AttendanceCard
              item={item}
              theme={theme}
              checkin={checkinMap[item.id]}
              updatingId={updatingId}
              updatingInv={updatingInv}
              checkingInId={checkingInId}
              checkingOutId={checkingOutId}
              submittingInvId={submittingInvId}
              onToggleAttendance={handleToggleAttendance}
              onCheckIn={handleCheckIn}
              onToggleInventory={handleToggleInventory}
              onSubmitInventory={handleSubmitInventory}
              onCheckOut={handleCheckOut}
            />
          )}
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
        s.rollNumber?.toLowerCase().includes(sq))
    : (students as any[]);

  const givenCount = (students as any[]).filter((s: any) => s.inventory?.messCard).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.statsStripRow}>
        <StatPill label="Total" value={students.length} color="#e2e8f0" />
        <StatPill label="Given" value={givenCount} color="#22c55e" />
        <StatPill label="Pending" value={(students.length) - givenCount} color="#f59e0b" />
      </View>
      <View style={styles.searchBarWrap}>
        <Feather name="search" size={15} color="#475569" />
        <TextInput
          placeholder="Search by name, room, roll…"
          placeholderTextColor="#334155"
          value={search}
          onChangeText={setSearch}
          style={styles.searchBarInput}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x-circle" size={15} color="#475569" />
          </Pressable>
        )}
      </View>
      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
          contentContainerStyle={{ padding: 10, paddingBottom: 120, gap: 8 }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="coffee" size={40} color="#1e293b" />
              <Text style={styles.emptyText}>
                {search ? "No students match your search" : "No students assigned"}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const given = !!item.inventory?.messCard;
            const givenAt = item.inventory?.messCardGivenAt;
            const isToggling = togglingId === item.id;
            return (
              <Animated.View
                entering={FadeInDown.springify().damping(16)}
                style={[styles.messCardRow, {
                  borderColor: given ? "#22c55e40" : "#1e2d4a",
                }]}
              >
                <LinearGradient
                  colors={given ? ["#052e16", "#064e3b"] : ["#0d1c35", "#091525"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                />
                <View style={[styles.avatar, { backgroundColor: given ? "#22c55e20" : "#1e6fd920" }]}>
                  <Text style={[styles.avatarText, { color: given ? "#22c55e" : "#3b8af0" }]}>
                    {(item.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.studentMeta} numberOfLines={1}>
                    {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
                  </Text>
                  {given && givenAt && (
                    <Text style={[styles.studentMeta, { color: "#22c55e" }]}>
                      Given at {formatTime(givenAt)}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => !isToggling && toggleMessCard(item.id, given)}
                  disabled={isToggling}
                  style={({ pressed }) => [styles.messCardBtn, {
                    backgroundColor: given ? "#ef444415" : "#22c55e",
                    borderColor: given ? "#ef444440" : "#22c55e",
                    borderWidth: given ? 1 : 0,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  {isToggling
                    ? <ActivityIndicator size="small" color={given ? "#ef4444" : "#fff"} />
                    : given
                      ? <><Feather name="x-circle" size={14} color="#ef4444" /><Text style={[styles.messCardBtnText, { color: "#ef4444" }]}>Revoke</Text></>
                      : <><Feather name="check" size={14} color="#fff" /><Text style={[styles.messCardBtnText, { color: "#fff" }]}>Give Card</Text></>}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statPillVal, { color }]}>{value ?? 0}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

// ─── MAIN SCREEN ───────────────────────────────────────────────────────────────

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

  const tabIndicator = useSharedValue(0);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(tab === "room" ? 0 : 1, { damping: 18, stiffness: 200 }) as any }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: "#060e1a" }]}>
      {/* Page Header */}
      <View style={[styles.pageHeader, { paddingTop: topPad }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={styles.pageTitle}>Attendance</Text>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowNotifModal(true); }}
            style={styles.notifBtn}
          >
            <Feather name="bell" size={15} color="#f59e0b" />
            <Text style={styles.notifBtnText}>Notify</Text>
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => { setTab("room"); Haptics.selectionAsync(); }}
            style={[styles.tabBtn, tab === "room" && styles.tabBtnActive]}
          >
            {tab === "room" && (
              <LinearGradient
                colors={["#1d4ed8", "#3b82f6"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Feather name="home" size={13} color={tab === "room" ? "#fff" : "#475569"} />
            <Text style={[styles.tabBtnText, { color: tab === "room" ? "#fff" : "#475569" }]}>Room / Inventory</Text>
          </Pressable>
          <Pressable
            onPress={() => { setTab("mess"); Haptics.selectionAsync(); }}
            style={[styles.tabBtn, tab === "mess" && styles.tabBtnActive]}
          >
            {tab === "mess" && (
              <LinearGradient
                colors={["#15803d", "#22c55e"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Feather name="coffee" size={13} color={tab === "mess" ? "#fff" : "#475569"} />
            <Text style={[styles.tabBtnText, { color: tab === "mess" ? "#fff" : "#475569" }]}>Mess Card</Text>
          </Pressable>
        </View>
      </View>

      {tab === "room" ? <RoomAttendanceView theme={theme} /> : <MessAttendanceView theme={theme} />}

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
  pageHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#0f1e38", gap: 12 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#f8faff" },
  notifBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: "#f59e0b18", borderWidth: 1, borderColor: "#f59e0b40" },
  notifBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#f59e0b" },
  tabBar: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: "#0f1e38", padding: 4, gap: 4, backgroundColor: "#0a1628" },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9, overflow: "hidden" },
  tabBtnActive: {},
  tabBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  statsStripRow: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: "#0f1e38" },
  statPill: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, gap: 2, backgroundColor: "#0d1c35" },
  statPillVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statPillLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#475569" },

  searchBarWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#0f1e38" },
  searchBarInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0, color: "#e2e8f0" },

  // Attendance card
  attCard: { borderRadius: 16, borderWidth: 1.5, overflow: "hidden", shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, elevation: 5 },
  attTopRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 13 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#f1f5f9" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1, color: "#475569" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 11, fontFamily: "Inter_700Bold" },

  remarkGreen: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#14532d50", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#16a34a40" },
  remarkGreenText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#22c55e" },
  remarkRed: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7f1d1d30", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "#dc262640" },
  remarkRedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#ef4444" },

  // Action rows
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#0f1e38" },
  checkoutRow: {},
  actionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  timeStampBadge: { flexDirection: "row", gap: 8, alignItems: "center" },
  timeStampLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#475569" },
  timeStampValue: { fontSize: 13, fontFamily: "Inter_700Bold" },
  actionNone: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#334155" },

  // Check In button
  checkInBtn: { borderRadius: 10, overflow: "hidden" },
  checkInBtnGrad: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 9 },
  actionBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },

  // Inventory section
  invSection: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#0f1e38", gap: 10 },
  invHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  invSectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  invChipsRow: { flexDirection: "row", gap: 8 },

  // Inventory chip
  invChipWrapper: { flex: 1 },
  invChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, overflow: "hidden" },
  chipGlowOverlay: { borderRadius: 12, overflow: "hidden" },
  invChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },

  // Submit inventory button
  submitInvBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 13, paddingVertical: 12 },
  submitInvBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },

  // Check Out button
  checkOutBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  checkOutBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Mess card
  messCardRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  messCardBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  messCardBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#334155" },

  // Notification modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000055" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, gap: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#334155", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
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
