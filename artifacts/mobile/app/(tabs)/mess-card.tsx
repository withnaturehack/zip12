import React, { useMemo, useState } from "react";
import {
  View, Text, FlatList, Pressable, StyleSheet, TextInput,
  Modal, ActivityIndicator, useColorScheme, ScrollView, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { deptMembersByEmail } from "@/constants/deptMembers";
import * as Haptics from "expo-haptics";

function fmt(ts?: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
    hour12: true,
  });
}

function InfoRow({ icon, label, value, theme, accent }: { icon: any; label: string; value: string; theme: any; accent?: string }) {
  return (
    <View style={sd.infoRow}>
      <Feather name={icon} size={13} color={accent || theme.textTertiary} />
      <Text style={[sd.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[sd.infoVal, { color: accent || theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Enhanced Student Detail Sheet ────────────────────────────────────────────
function StudentDetailSheet({ selected, selectedDetails, visible, onClose, onConfirm, isPending, theme, isDark }: {
  selected: any; selectedDetails: any; visible: boolean; onClose: () => void;
  onConfirm: () => void; isPending: boolean; theme: any; isDark: boolean;
}) {
  if (!selected) return null;
  const d = selectedDetails || selected;
  const csv = deptMembersByEmail[(d?.email || "").toLowerCase()];
  const hasPass = !!selected.messCard;
  const phone = d.mobileNumber || d.contactNumber || d.phone || "";
  const emergency = d.emergencyContact || "";
  const hostel = d.hostelName || d.allottedHostel || d.hostelId || "";
  const mess = d.allottedMess || d.assignedMess || "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sd.overlay} onPress={onClose}>
        <Pressable style={[sd.sheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={sd.handle} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Header */}
            <View style={sd.headerRow}>
              <View style={[sd.avatar, { backgroundColor: theme.tint + "20" }]}>
                <Text style={[sd.avatarText, { color: theme.tint }]}>
                  {(selected.name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sd.name, { color: theme.text }]}>{selected.name}</Text>
                <Text style={[sd.roll, { color: theme.textSecondary }]}>
                  {d.rollNumber || d.email || ""}
                </Text>
                {!!hostel && (
                  <Text style={[sd.hostel, { color: theme.textTertiary }]}>
                    <Feather name="home" size={11} /> {hostel}
                  </Text>
                )}
              </View>
              <Pressable onPress={onClose} hitSlop={8} style={sd.closeX}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Room + Mess chips */}
            <View style={sd.chips}>
              {!!(d.roomNumber) && (
                <View style={[sd.chip, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                  <Feather name="layers" size={11} color={theme.tint} />
                  <Text style={[sd.chipText, { color: theme.tint }]}>Room {d.roomNumber}</Text>
                </View>
              )}
              {!!mess && (
                <View style={[sd.chip, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" }]}>
                  <Feather name="coffee" size={11} color="#f59e0b" />
                  <Text style={[sd.chipText, { color: "#f59e0b" }]}>{mess}</Text>
                </View>
              )}
              {!!(csv?.gender || d.gender) && (
                <View style={[sd.chip, { backgroundColor: "#3b82f615", borderColor: "#3b82f640" }]}>
                  <Feather name="user" size={11} color="#3b82f6" />
                  <Text style={[sd.chipText, { color: "#3b82f6" }]}>{csv?.gender || d.gender}</Text>
                </View>
              )}
              {!!(csv?.age || d.age) && (
                <View style={[sd.chip, { backgroundColor: "#8b5cf615", borderColor: "#8b5cf640" }]}>
                  <Text style={[sd.chipText, { color: "#8b5cf6" }]}>Age {csv?.age || d.age}</Text>
                </View>
              )}
            </View>

            {/* Academic / personal info */}
            {(csv?.stream || csv?.role || phone || emergency) && (
              <View style={[sd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {!!csv?.stream && <InfoRow icon="book" label="Stream" value={csv.stream} theme={theme} />}
                {!!csv?.role && <InfoRow icon="tag" label="Role" value={csv.role} theme={theme} />}
                {!!phone && <InfoRow icon="phone" label="Mobile" value={phone} theme={theme} accent="#3b82f6" />}
                {!!emergency && <InfoRow icon="alert-circle" label="Emergency" value={emergency} theme={theme} accent="#ef4444" />}
              </View>
            )}

            {/* Mess pass status */}
            <View style={[sd.statusBox, {
              backgroundColor: hasPass ? "#22c55e12" : "#f59e0b12",
              borderColor: hasPass ? "#22c55e40" : "#f59e0b40",
            }]}>
              <Feather name={hasPass ? "check-circle" : "clock"} size={16} color={hasPass ? "#22c55e" : "#f59e0b"} />
              <View style={{ flex: 1 }}>
                <Text style={[sd.statusLabel, { color: hasPass ? "#22c55e" : "#f59e0b" }]}>
                  {hasPass ? "Mess pass given" : "Mess pass pending"}
                </Text>
                {!!selected.messCardGivenAt && (
                  <Text style={[sd.statusSub, { color: theme.textSecondary }]}>
                    Given at {fmt(selected.messCardGivenAt)}
                  </Text>
                )}
              </View>
            </View>

            {/* Call button */}
            {!!phone && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL(`tel:${phone}`); }}
                style={[sd.callBtn, { borderColor: theme.tint + "50" }]}
              >
                <Feather name="phone-call" size={15} color={theme.tint} />
                <Text style={[sd.callBtnText, { color: theme.tint }]}>Call {phone}</Text>
              </Pressable>
            )}

            {/* Confirm / Revoke */}
            <Pressable
              onPress={onConfirm}
              disabled={isPending}
              style={[sd.confirmBtn, { backgroundColor: hasPass ? "#ef4444" : "#22c55e", opacity: isPending ? 0.65 : 1 }]}
            >
              {isPending
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Feather name={hasPass ? "x-circle" : "check-circle"} size={16} color="#fff" />
                    <Text style={sd.confirmText}>{hasPass ? "Revoke Pass" : "Confirm & Give Pass"}</Text>
                  </>
              }
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function MessCardTabScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const request = useApiRequest();
  const { isVolunteer, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "given" | "pending">("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
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

  const { data, isLoading } = useQuery<any>({
    queryKey: ["mess-card-students", search],
    queryFn: () => request(`/students?limit=300&offset=0${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),
    enabled: canWork,
    refetchInterval: 8000,
    staleTime: 2000,
  });

  const rawStudents = (Array.isArray(data) ? data : data?.students || []) as any[];
  const students = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of rawStudents) {
      const key = String(s.rollNumber || "").toLowerCase() || String(s.email || "").toLowerCase() || String(s.id);
      if (!map.has(key)) map.set(key, s);
    }
    return Array.from(map.values());
  }, [rawStudents]);

  const givenCount = useMemo(() => students.filter((s) => s.messCard).length, [students]);
  const pendingCount = Math.max(0, students.length - givenCount);
  const visibleStudents = useMemo(() => {
    if (filter === "given") return students.filter((s) => s.messCard);
    if (filter === "pending") return students.filter((s) => !s.messCard);
    return students;
  }, [students, filter]);

  const toggleMutation = useMutation({
    mutationFn: async ({ studentId, messCard }: { studentId: string; messCard: boolean }) =>
      request(`/inventory-simple/${studentId}/mess-card`, {
        method: "PATCH",
        body: JSON.stringify({ messCard }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mess-card-students"] });
      qc.invalidateQueries({ queryKey: ["mess-stats"] });
    },
  });

  function openStudent(student: any) {
    setSelected(student);
    setSelectedDetails(null);
    setOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    request(`/students/${student.id}`)
      .then((d) => setSelectedDetails(d))
      .catch(() => setSelectedDetails(student));
  }

  async function confirmGive() {
    if (!selected) return;
    await toggleMutation.mutateAsync({ studentId: selected.id, messCard: !selected.messCard });
    setSelected({
      ...selected,
      messCard: !selected.messCard,
      messCardGivenAt: !selected.messCard ? new Date().toISOString() : null,
    });
    setOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function goActive() {
    setActivating(true);
    try {
      await request("/staff/go-active", { method: "POST", body: JSON.stringify({}) });
      await refetchStatus();
    } catch {
    } finally { setActivating(false); }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border }]}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Mess Card</Text>
          <Text style={[styles.sub, { color: theme.textSecondary }]}>
            {givenCount}/{students.length} active passes
          </Text>
        </View>
        <View style={[styles.liveChip, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: "#22c55e" }]}>Live</Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard label="Total" value={String(students.length)} color={theme.tint} />
        <MetricCard label="Given" value={String(givenCount)} color="#22c55e" />
        <MetricCard label="Pending" value={String(pendingCount)} color="#f59e0b" />
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Feather name="search" size={15} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, roll, room…"
          placeholderTextColor={theme.textTertiary}
          style={[styles.searchInput, { color: theme.text }]}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={15} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
        {(["all", "given", "pending"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, {
              borderColor: filter === f
                ? (f === "given" ? "#22c55e" : f === "pending" ? "#f59e0b" : theme.tint)
                : theme.border,
              backgroundColor: filter === f
                ? (f === "given" ? "#22c55e20" : f === "pending" ? "#f59e0b20" : theme.tint + "20")
                : theme.surface,
            }]}
          >
            <Text style={[styles.filterText, {
              color: filter === f
                ? (f === "given" ? "#22c55e" : f === "pending" ? "#f59e0b" : theme.tint)
                : theme.textSecondary,
            }]}>
              {f === "all" ? `All (${students.length})` : f === "given" ? `Given (${givenCount})` : `Pending (${pendingCount})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.tint} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={visibleStudents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border, marginLeft: 66 }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openStudent(item)}
              style={({ pressed }) => [styles.row, { backgroundColor: theme.background, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.tint + "20" }]}>
                <Text style={[styles.avatarText, { color: theme.tint }]}>
                  {(item.name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.rollNumber || item.email}{item.roomNumber ? ` · Room ${item.roomNumber}` : ""}
                </Text>
                {item.messCard ? (
                  <Text style={[styles.meta, { color: "#22c55e" }]} numberOfLines={1}>
                    Given {item.messCardGivenAt ? `· ${fmt(item.messCardGivenAt)}` : ""}
                  </Text>
                ) : (
                  <Text style={[styles.meta, { color: theme.textTertiary }]}>Pass not issued</Text>
                )}
              </View>
              <View style={[styles.chip, {
                backgroundColor: item.messCard ? "#22c55e15" : theme.surface,
                borderColor: item.messCard ? "#22c55e50" : theme.border,
              }]}>
                <Text style={[styles.chipText, { color: item.messCard ? "#22c55e" : theme.textSecondary }]}>
                  {item.messCard ? "Given" : "Pending"}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Enhanced Student Detail Sheet */}
      <StudentDetailSheet
        selected={selected}
        selectedDetails={selectedDetails}
        visible={open}
        onClose={() => setOpen(false)}
        onConfirm={confirmGive}
        isPending={toggleMutation.isPending}
        theme={theme}
        isDark={isDark}
      />

      {!canWork && (
        <View style={styles.lockOverlay}>
          <BlurView intensity={70} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.tint + "15", alignItems: "center", justifyContent: "center" }}>
              <Feather name="lock" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.lockTitle, { color: theme.text }]}>Shift Inactive</Text>
            <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
              Start your shift to access mess card distribution.
            </Text>
            <Pressable
              onPress={goActive}
              disabled={activating}
              style={[styles.lockBtn, { backgroundColor: theme.tint, opacity: activating ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 8 }]}
            >
              <Feather name="play-circle" size={16} color="#fff" />
              <Text style={styles.lockBtnText}>{activating ? "Starting..." : "Start Shift"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { marginTop: 2, fontSize: 13, fontFamily: "Inter_400Regular" },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  metricsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  metricCard: { flex: 1, borderWidth: 1, borderRadius: 12, alignItems: "center", paddingVertical: 10 },
  metricValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  filterBtn: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 7 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20 },
  lockCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 10, width: "100%", maxWidth: 340 },
  lockTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  lockBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  lockBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});

// ─── StudentDetailSheet Styles ─────────────────────────────────────────────────
const sd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%", paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  name: { fontSize: 16, fontFamily: "Inter_700Bold" },
  roll: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  hostel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  closeX: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 70 },
  infoVal: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  statusBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  statusLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  statusSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, marginBottom: 10 },
  callBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 14, marginBottom: 4 },
  confirmText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});
