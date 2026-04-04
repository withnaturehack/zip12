import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { deptMembersByEmail } from "@/constants/deptMembers";

function fmt(ts?: string | null) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MessCardTabScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? Colors.dark : Colors.light;
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
    queryFn: () => request(`/students?limit=200&offset=0${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""}`),
    enabled: canWork,
    refetchInterval: 5000,
    staleTime: 1500,
  });

  const rawStudents = (Array.isArray(data) ? data : data?.students || []) as any[];
  const students = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of rawStudents) {
      const roll = String(s.rollNumber || "").trim().toLowerCase();
      const email = String(s.email || "").trim().toLowerCase();
      const key = roll || email || String(s.id);
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
    mutationFn: async ({ studentId, messCard }: { studentId: string; messCard: boolean }) => {
      return request(`/inventory-simple/${studentId}/mess-card`, {
        method: "PATCH",
        body: JSON.stringify({ messCard }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mess-card-students"] });
      qc.invalidateQueries({ queryKey: ["mess-stats"] });
    },
  });

  function openStudent(student: any) {
    setSelected(student);
    setSelectedDetails(null);
    setOpen(true);

    request(`/students/${student.id}`)
      .then((data) => setSelectedDetails(data))
      .catch(() => setSelectedDetails(student));
  }

  async function confirmGive(student: any) {
    await toggleMutation.mutateAsync({ studentId: student.id, messCard: !student.messCard });
    setSelected({
      ...student,
      messCard: !student.messCard,
      messCardGivenAt: !student.messCard ? new Date().toISOString() : null,
      messCardRevokedAt: student.messCard ? new Date().toISOString() : null,
    });
    setOpen(false);
  }

  async function goActive() {
    setActivating(true);
    try {
      await request("/staff/go-active", { method: "POST", body: JSON.stringify({}) });
      await refetchStatus();
    } catch {
    } finally {
      setActivating(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}> 
        <Text style={[styles.title, { color: theme.text }]}>Mess Card</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>{givenCount}/{students.length} active passes</Text>
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Total" value={String(students.length)} color={theme.tint} />
        <Metric label="Given" value={String(givenCount)} color="#22c55e" />
        <Metric label="Pending" value={String(pendingCount)} color="#f59e0b" />
      </View>

      <View style={[styles.searchWrap, { borderBottomColor: theme.border }]}> 
        <Feather name="search" size={15} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search student"
          placeholderTextColor={theme.textTertiary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
        {(["all", "given", "pending"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, {
              borderColor: filter === f ? (f === "given" ? "#22c55e" : f === "pending" ? "#f59e0b" : theme.tint) : theme.border,
              backgroundColor: filter === f ? (f === "given" ? "#22c55e20" : f === "pending" ? "#f59e0b20" : theme.tint + "20") : theme.surface,
            }]}
          >
            <Text style={[styles.filterText, { color: filter === f ? (f === "given" ? "#22c55e" : f === "pending" ? "#f59e0b" : theme.tint) : theme.textSecondary }]}>
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
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.tint + "20" }]}>
                <Text style={[styles.avatarText, { color: theme.tint }]}>{(item.name || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.rollNumber || item.email}{item.roomNumber ? ` · Room ${item.roomNumber}` : ""}
                </Text>
                {item.messCard ? (
                  <Text style={[styles.meta, { color: "#22c55e" }]} numberOfLines={1}>Given {item.messCardGivenAt ? `· ${fmt(item.messCardGivenAt)}` : ""}</Text>
                ) : (
                  <Text style={[styles.meta, { color: theme.textTertiary }]} numberOfLines={1}>Pass not issued</Text>
                )}
              </View>
              <View style={[styles.chip, { backgroundColor: item.messCard ? "#22c55e18" : theme.surface, borderColor: item.messCard ? "#22c55e50" : theme.border }]}> 
                <Text style={[styles.chipText, { color: item.messCard ? "#22c55e" : theme.textSecondary }]}>{item.messCard ? "Given" : "Pending"}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: theme.surface }]}> 
            <View style={styles.sheetTop}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>{selected?.name}</Text>
              <Pressable onPress={() => setOpen(false)}><Feather name="x" size={20} color={theme.textSecondary} /></Pressable>
            </View>
            <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>{(selectedDetails?.rollNumber || selected?.rollNumber || selected?.email)}</Text>
            {!!(selectedDetails?.roomNumber || selected?.roomNumber) && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Room {selectedDetails?.roomNumber || selected?.roomNumber}</Text>}
            {!!(selectedDetails?.hostelName || selected?.hostelName) && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Hostel {selectedDetails?.hostelName || selected?.hostelName}</Text>}
            {!!(selectedDetails?.assignedMess || selected?.assignedMess) && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Mess {selectedDetails?.assignedMess || selected?.assignedMess}</Text>}
            {!!(selectedDetails?.allottedMess || selected?.allottedMess) && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Allotted {selectedDetails?.allottedMess || selected?.allottedMess}</Text>}
            {!!(selectedDetails?.phone || selectedDetails?.contactNumber || selected?.phone || selected?.contactNumber) && (
              <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Contact {selectedDetails?.contactNumber || selectedDetails?.phone || selected?.contactNumber || selected?.phone}</Text>
            )}
            {(() => {
              const csv = deptMembersByEmail[(selectedDetails?.email || selected?.email || "").toLowerCase()];
              if (!csv) return null;
              return (
                <View style={[styles.csvInfo, { borderColor: theme.border }]}> 
                  <Text style={[styles.csvTitle, { color: theme.text }]}>CSV Profile</Text>
                  {!!csv.role && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Role {csv.role}</Text>}
                  {!!csv.stream && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Stream {csv.stream}</Text>}
                  {!!csv.gender && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Gender {csv.gender}</Text>}
                  {!!csv.age && <Text style={[styles.sheetMeta, { color: theme.textSecondary }]}>Age {csv.age}</Text>}
                </View>
              );
            })()}
            <View style={[styles.statusBox, { backgroundColor: selected?.messCard ? "#22c55e10" : "#f59e0b10", borderColor: selected?.messCard ? "#22c55e30" : "#f59e0b30" }]}> 
              <Text style={[styles.statusText, { color: selected?.messCard ? "#22c55e" : "#f59e0b" }]}>
                {selected?.messCard ? "Mess pass already given" : "Mess pass pending"}
              </Text>
              {!!selected?.messCardGivenAt && (
                <Text style={[styles.statusMeta, { color: theme.textSecondary }]}>Given at {fmt(selected.messCardGivenAt)}</Text>
              )}
            </View>

            <Pressable
              onPress={() => selected && confirmGive(selected)}
              disabled={toggleMutation.isPending}
              style={[styles.confirmBtn, { backgroundColor: selected?.messCard ? "#ef4444" : "#22c55e", opacity: toggleMutation.isPending ? 0.65 : 1 }]}
            >
              {toggleMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{selected?.messCard ? "Revoke Pass" : "Confirm & Give Pass"}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {!canWork && (
        <View style={styles.lockOverlay}>
          <BlurView intensity={70} tint={colorScheme === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
            <Feather name="lock" size={20} color={theme.textSecondary} />
            <Text style={[styles.lockTitle, { color: theme.text }]}>Shift inactive</Text>
            <Text style={[styles.lockSub, { color: theme.textSecondary }]}>Start shift to access mess card student data.</Text>
            <Pressable
              onPress={goActive}
              disabled={activating}
              style={[styles.lockBtn, { backgroundColor: theme.tint, opacity: activating ? 0.7 : 1 }]}
            >
              <Text style={styles.lockBtnText}>{activating ? "Starting..." : "Go Active"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  sub: { marginTop: 2, fontSize: 13, fontFamily: "Inter_400Regular" },
  metricsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  metric: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 8 },
  metricValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  filterBtn: { flex: 1, borderWidth: 1, borderRadius: 10, alignItems: "center", paddingVertical: 7 },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  name: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  overlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 18, gap: 8 },
  sheetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sheetMeta: { fontSize: 13, fontFamily: "Inter_400Regular" },
  csvInfo: { marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  csvTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusBox: { marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statusMeta: { marginTop: 2, fontSize: 12, fontFamily: "Inter_400Regular" },
  confirmBtn: { marginTop: 10, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  confirmText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20 },
  lockCard: { borderWidth: 1, borderRadius: 14, padding: 16, alignItems: "center", gap: 8, width: "100%", maxWidth: 340 },
  lockTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  lockBtn: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  lockBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
});

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metric, { borderColor: color + "40", backgroundColor: color + "15" }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
    </View>
  );
}
