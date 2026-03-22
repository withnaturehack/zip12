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

const MEALS = ["breakfast", "lunch", "dinner"] as const;
type Meal = typeof MEALS[number];
const MEAL_SHORT: Record<Meal, string> = { breakfast: "B", lunch: "L", dinner: "D" };
const MEAL_COLOR: Record<Meal, string> = { breakfast: "#f59e0b", lunch: "#22c55e", dinner: "#6366f1" };

// ─── FAB Menu ──────────────────────────────────────────────────────────────────

function FloatingMenu({
  theme,
  onNewLostItem,
  onNewNotification,
  canNotify = false,
}: {
  theme: any;
  onNewLostItem: () => void;
  onNewNotification: () => void;
  canNotify?: boolean;
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
            <Pressable
              key={item.label}
              onPress={() => { setOpen(false); rotation.setValue(0); item.action(); }}
              style={[styles.fabMenuItem, { backgroundColor: theme.surface, borderColor: item.color + "50" }]}
            >
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

// ─── Inventory Check ───────────────────────────────────────────────────────────

function InventoryCheck({ label, checked, onToggle, disabled }: {
  label: string; checked: boolean; onToggle: () => void; disabled: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = (colorScheme === "dark" ? Colors.dark : Colors.light);
  return (
    <Pressable onPress={onToggle} disabled={disabled} style={styles.checkItem}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked, { borderColor: checked ? "#22c55e" : theme.border }]}>
        {checked && <Feather name="check" size={11} color="#fff" />}
      </View>
      <Text style={[styles.checkLabel, { color: theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Notification Modal ────────────────────────────────────────────────────────

function NotificationModal({ visible, onClose, theme, request, qc }: {
  visible: boolean; onClose: () => void; theme: any; request: any; qc: any;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setTitle(""); setBody(""); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await request("/announcements", {
        method: "POST",
        body: JSON.stringify({ title, content: body || title }),
      });
      qc.invalidateQueries({ queryKey: ["announcements"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to send notification");
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.modalOverlay} onPress={close}>
        <Pressable style={[styles.modalSheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>Send Notification</Text>
          <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Broadcasts to your hostel students</Text>
          <TextInput
            placeholder="Notification title *"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            placeholder="Message body (optional)"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={3}
          />
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

// ─── Shared Lost Item Form Modal ───────────────────────────────────────────────

function LostFoundFormModal({ visible, onClose, theme, request, qc }: {
  visible: boolean; onClose: () => void; theme: any; request: any; qc: any;
}) {
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setFormTitle(""); setFormDesc(""); setFormLocation(""); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await request("/lostitems", {
        method: "POST",
        body: JSON.stringify({ title: formTitle, description: formDesc, location: formLocation }),
      });
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
          <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
            Help others find it — the more detail, the better
          </Text>
          <TextInput
            placeholder="Item name *"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formTitle}
            onChangeText={setFormTitle}
          />
          <TextInput
            placeholder="Description — what does it look like?"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formDesc}
            onChangeText={setFormDesc}
            multiline
            numberOfLines={3}
          />
          <TextInput
            placeholder="Where was it last seen? (e.g. Mess, Library)"
            placeholderTextColor={theme.textTertiary}
            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
            value={formLocation}
            onChangeText={setFormLocation}
          />
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

// ─── MESS ATTENDANCE TABLE ────────────────────────────────────────────────────

function MessAttendanceView({ theme }: { theme: any }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const today = new Date().toISOString().split("T")[0];

  const { data: students = [], isLoading: studLoading, refetch: refetchStudents } = useQuery<any[]>({
    queryKey: ["attendance", today],
    queryFn: () => request("/attendance"),
    staleTime: 30000,
  });

  const { data: messRaw = [], isLoading: messLoading, refetch: refetchMess } = useQuery<any[]>({
    queryKey: ["mess-attendance", today],
    queryFn: () => request("/mess-attendance"),
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStudents(), refetchMess()]);
    setRefreshing(false);
  }, [refetchStudents, refetchMess]);

  // Build map: studentId -> { breakfast, lunch, dinner }
  const messMap: Record<string, Partial<Record<Meal, boolean>>> = {};
  (messRaw as any[]).forEach(r => {
    if (!messMap[r.studentId]) messMap[r.studentId] = {};
    messMap[r.studentId][r.meal as Meal] = r.present === true;
  });

  const markedBreakfast = Object.values(messMap).filter(m => m.breakfast).length;
  const markedLunch = Object.values(messMap).filter(m => m.lunch).length;
  const markedDinner = Object.values(messMap).filter(m => m.dinner).length;

  const toggleMeal = async (studentId: string, meal: Meal, current: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTogglingId(`${studentId}-${meal}`);
    try {
      await request(`/mess-attendance/${studentId}`, {
        method: "POST",
        body: JSON.stringify({ meal, present: (!current).toString() }),
      });
      qc.invalidateQueries({ queryKey: ["mess-attendance"] });
      qc.invalidateQueries({ queryKey: ["mess-stats"] });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update");
    }
    setTogglingId(null);
  };

  const isLoading = studLoading || messLoading;

  return (
    <View style={{ flex: 1 }}>
      {/* Meal summary pills */}
      <View style={[styles.messStatsRow, { borderBottomColor: theme.border }]}>
        {MEALS.map(meal => (
          <View key={meal} style={[styles.mealStatPill, { backgroundColor: MEAL_COLOR[meal] + "15", borderColor: MEAL_COLOR[meal] + "40" }]}>
            <Text style={[styles.mealStatNum, { color: MEAL_COLOR[meal] }]}>
              {meal === "breakfast" ? markedBreakfast : meal === "lunch" ? markedLunch : markedDinner}
            </Text>
            <Text style={[styles.mealStatLabel, { color: theme.textSecondary }]}>
              {meal.charAt(0).toUpperCase() + meal.slice(1)}
            </Text>
          </View>
        ))}
        <View style={[styles.mealStatPill, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40", flex: 1.3 }]}>
          <Text style={[styles.mealStatNum, { color: theme.tint }]}>{students.length}</Text>
          <Text style={[styles.mealStatLabel, { color: theme.textSecondary }]}>Students</Text>
        </View>
      </View>

      {/* Table header */}
      <View style={[styles.messTableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.messThName, { color: theme.textSecondary }]}>STUDENT</Text>
        {MEALS.map(meal => (
          <View key={meal} style={styles.messThMeal}>
            <View style={[styles.mealBadge, { backgroundColor: MEAL_COLOR[meal] + "20" }]}>
              <Text style={[styles.mealBadgeText, { color: MEAL_COLOR[meal] }]}>{MEAL_SHORT[meal]}</Text>
            </View>
          </View>
        ))}
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={students as any[]}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="coffee" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students assigned</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const meals = messMap[item.id] || {};
            const anyMarked = MEALS.some(m => meals[m]);
            return (
              <View style={[styles.messRow, { backgroundColor: anyMarked ? theme.tint + "06" : theme.background }]}>
                <View style={styles.messStudentCol}>
                  <Text style={[styles.messStudentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.messStudentRoom, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.roomNumber ? `Room ${item.roomNumber}` : item.email}
                  </Text>
                </View>
                {MEALS.map(meal => {
                  const isPresent = !!meals[meal];
                  const isToggling = togglingId === `${item.id}-${meal}`;
                  return (
                    <Pressable
                      key={meal}
                      onPress={() => toggleMeal(item.id, meal, isPresent)}
                      disabled={isToggling}
                      style={styles.messMealCell}
                    >
                      {isToggling ? (
                        <ActivityIndicator size="small" color={MEAL_COLOR[meal]} />
                      ) : (
                        <View style={[styles.mealToggle, {
                          backgroundColor: isPresent ? MEAL_COLOR[meal] : "transparent",
                          borderColor: isPresent ? MEAL_COLOR[meal] : theme.border,
                        }]}>
                          {isPresent && <Feather name="check" size={13} color="#fff" />}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          }}
        />
      )}
    </View>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance"] }); qc.invalidateQueries({ queryKey: ["att-stats"] }); },
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
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to mark check-in");
    }
    setCheckingInId(null);
  }, [request, qc]);

  const entered = data.filter((s: any) => s.attendance?.status === "entered").length;
  const checkedInCount = Object.keys(checkinMap).length;
  const total = data.length;

  return (
    <View style={{ flex: 1 }}>
      {/* Stats strip */}
      <View style={[styles.statsStripRow, { borderBottomColor: theme.border }]}>
        <StatPill label="Total" value={total} color={theme.text} theme={theme} />
        <StatPill label="Entered" value={entered} color="#22c55e" theme={theme} />
        <StatPill label="Checked In" value={checkedInCount} color="#8b5cf6" theme={theme} />
        <StatPill label="Pending" value={total - entered} color="#f59e0b" theme={theme} />
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={data as any[]}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 10, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students assigned</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isEntered = item.attendance?.status === "entered";
            const isUpdating = updatingId === item.id;
            const isCheckingIn = checkingInId === item.id;
            const inv = item.inventory || { mattress: false, bedsheet: false, pillow: false };
            const checkin = checkinMap[item.id];

            return (
              <View style={[styles.attCard, { backgroundColor: theme.surface, borderColor: isEntered ? "#22c55e40" : theme.border }]}>
                <View style={styles.attTopRow}>
                  <View style={[styles.avatar, { backgroundColor: theme.tint + "20" }]}>
                    <Text style={[styles.avatarText, { color: theme.tint }]}>
                      {(item.name || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>{item.email}</Text>
                    {(item.contactNumber || item.phone) ? (
                      <Text style={[styles.studentMeta, { color: theme.textTertiary }]}>
                        <Feather name="phone" size={10} /> {item.contactNumber || item.phone}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => toggleAttendance(item.id, item.attendance?.status || "not_entered")}
                    disabled={isUpdating}
                    style={[styles.attToggle, { backgroundColor: isEntered ? "#22c55e" : theme.surface, borderColor: isEntered ? "#22c55e" : theme.border }]}
                  >
                    {isUpdating
                      ? <ActivityIndicator size="small" color={isEntered ? "#fff" : theme.tint} />
                      : <Feather name={isEntered ? "check" : "circle"} size={18} color={isEntered ? "#fff" : theme.textSecondary} />}
                  </Pressable>
                </View>

                <View style={[styles.checkinRow, { borderTopColor: theme.border }]}>
                  <View style={[styles.checkinIcon, { backgroundColor: checkin ? "#8b5cf620" : theme.surface }]}>
                    <Feather name="log-in" size={13} color={checkin ? "#8b5cf6" : theme.textTertiary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {checkin ? (
                      <Text style={[styles.checkinTime, { color: "#8b5cf6" }]}>
                        Checked in at {formatTime(checkin.checkInTime)}
                        {checkin.checkOutTime ? `  ·  Out: ${formatTime(checkin.checkOutTime)}` : ""}
                      </Text>
                    ) : (
                      <Text style={[styles.checkinNone, { color: theme.textTertiary }]}>Not checked in today</Text>
                    )}
                  </View>
                  {!checkin && (
                    <Pressable
                      onPress={() => markCheckin(item.id)}
                      disabled={isCheckingIn}
                      style={[styles.checkinBtn, { borderColor: "#8b5cf640", backgroundColor: "#8b5cf615" }]}
                    >
                      {isCheckingIn
                        ? <ActivityIndicator size="small" color="#8b5cf6" />
                        : <Text style={[styles.checkinBtnText, { color: "#8b5cf6" }]}>Mark</Text>}
                    </Pressable>
                  )}
                </View>

                <View style={[styles.invRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.invLabel, { color: theme.textTertiary }]}>Inventory:</Text>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => (
                    <InventoryCheck
                      key={field}
                      label={field.charAt(0).toUpperCase() + field.slice(1)}
                      checked={!!inv[field]}
                      disabled={updatingInv === `${item.id}-${field}`}
                      onToggle={() => toggleInventory(item.id, field, !!inv[field])}
                    />
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── LOST ITEMS LIST VIEW (for staff "Items" tab) ─────────────────────────────

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

// ─── ATTENDANCE + INVENTORY SCREEN ────────────────────────────────────────────

const ATTENDANCE_TABS = ["room", "mess", "items"] as const;
type AttTab = typeof ATTENDANCE_TABS[number];

const TAB_CONFIG = [
  { key: "room",  icon: "home",    label: "Room",  color: "#6366f1" },
  { key: "mess",  icon: "coffee",  label: "Mess",  color: "#22c55e" },
  { key: "items", icon: "package", label: "Lost",  color: "#f59e0b" },
] as const;

function AttendanceScreen({ theme, topPad }: { theme: any; topPad: number }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showLostModal, setShowLostModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [activeTab, setActiveTab] = useState<AttTab>("room");
  const today = new Date().toISOString().split("T")[0];

  const canNotify = true;

  const pageTitles: Record<AttTab, string> = { room: "Attendance", mess: "Mess Attendance", items: "Lost & Found" };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
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
                <Pressable
                  key={tab.key}
                  onPress={() => { setActiveTab(tab.key as AttTab); Haptics.selectionAsync(); }}
                  style={[styles.tabBtn, { backgroundColor: active ? tab.color + "20" : theme.surface, borderColor: active ? tab.color : theme.border }]}
                >
                  <Feather name={tab.icon as any} size={13} color={active ? tab.color : theme.textSecondary} />
                  <Text style={[styles.tabBtnText, { color: active ? tab.color : theme.textSecondary }]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {activeTab === "room" ? (
        <RoomAttendanceView theme={theme} />
      ) : activeTab === "mess" ? (
        <MessAttendanceView theme={theme} />
      ) : (
        <LostItemsListView theme={theme} />
      )}

      <NotificationModal
        visible={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        theme={theme}
        request={request}
        qc={qc}
      />
      <LostFoundFormModal
        visible={showLostModal}
        onClose={() => setShowLostModal(false)}
        theme={theme}
        request={request}
        qc={qc}
      />
      <FloatingMenu
        theme={theme}
        canNotify={canNotify}
        onNewLostItem={() => setShowLostModal(true)}
        onNewNotification={() => setShowNotifModal(true)}
      />
    </View>
  );
}

// ─── LOST & FOUND SCREEN (students + staff) ───────────────────────────────────

function LostFoundScreen({ theme, topPad }: { theme: any; topPad: number }) {
  const request = useApiRequest();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const isStaff = user?.role && user.role !== "student";
  const canNotify = isStaff;

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
            <Text style={[styles.pageDate, { color: theme.textSecondary }]}>
              {items.length} item{items.length !== 1 ? "s" : ""} reported
            </Text>
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
                {item.description ? (
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={2}>{item.description}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.location ? (
                    <View style={styles.metaChip}>
                      <Feather name="map-pin" size={10} color={theme.textTertiary} />
                      <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.location}</Text>
                    </View>
                  ) : null}
                  <View style={styles.metaChip}>
                    <Feather name="user" size={10} color={theme.textTertiary} />
                    <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>{item.reportedByName}</Text>
                  </View>
                  <Text style={[styles.metaChipText, { color: theme.textTertiary }]}>
                    {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
              </View>
            </View>
          </AnimatedCard>
        )}
      />

      <LostFoundFormModal
        visible={showLostModal}
        onClose={() => setShowLostModal(false)}
        theme={theme}
        request={request}
        qc={qc}
      />

      {isStaff && (
        <>
          <NotificationModal
            visible={showNotifModal}
            onClose={() => setShowNotifModal(false)}
            theme={theme}
            request={request}
            qc={qc}
          />
          <FloatingMenu
            theme={theme}
            canNotify={canNotify}
            onNewLostItem={() => setShowLostModal(true)}
            onNewNotification={() => setShowNotifModal(true)}
          />
        </>
      )}
    </View>
  );
}

// ─── ROOT: Role-adaptive dispatcher ───────────────────────────────────────────

export default function LostFoundTab() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
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
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  pageDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tabBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statsStripRow: { flexDirection: "row", gap: 6, padding: 10, borderBottomWidth: 1, flexWrap: "wrap" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 18, borderWidth: 1 },
  statPillVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statPillLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  // Mess attendance table
  messStatsRow: { flexDirection: "row", gap: 6, padding: 10, borderBottomWidth: 1 },
  mealStatPill: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 2 },
  mealStatNum: { fontSize: 16, fontFamily: "Inter_700Bold" },
  mealStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  messTableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  messThName: { flex: 1, fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  messThMeal: { width: 52, alignItems: "center" },
  mealBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  mealBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  messRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10 },
  messStudentCol: { flex: 1, paddingRight: 8 },
  messStudentName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  messStudentRoom: { fontSize: 11, fontFamily: "Inter_400Regular" },
  messMealCell: { width: 52, alignItems: "center", justifyContent: "center", height: 44 },
  mealToggle: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  // Attendance card
  attCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  attTopRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  attToggle: { width: 40, height: 40, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkinRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1 },
  checkinIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  checkinTime: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  checkinNone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  checkinBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  checkinBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  invRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, flexWrap: "wrap" },
  invLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  checkItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#22c55e", borderColor: "#22c55e" },
  checkLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
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
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptySubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  textArea: { height: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  submitBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  // FAB
  fabContainer: { position: "absolute", right: 20, bottom: 30, alignItems: "flex-end", zIndex: 100 },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabMenu: { gap: 10, marginBottom: 14, alignItems: "flex-end" },
  fabMenuItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  fabMenuIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fabMenuLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fabBackdrop: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
});
