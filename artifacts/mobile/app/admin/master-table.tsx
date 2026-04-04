import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, ScrollView,
  RefreshControl, Platform, useColorScheme,
  ActivityIndicator, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const PAGE = 30;
const FETCH_PAGE_SIZE = 1000;

function formatDT(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function StudentDetailModal({ student, visible, onClose, theme, onUpdated }: {
  student: any;
  visible: boolean;
  onClose: () => void;
  theme: any;
  onUpdated?: () => void;
}) {
  const request = useApiRequest();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [marking, setMarking] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);

  const canMark = user?.role === "admin" || user?.role === "superadmin" || user?.role === "coordinator" || user?.role === "volunteer";

  // Fetch student's full profile with hostel
  const { data: profile, isLoading } = useQuery({
    queryKey: ["student-detail", student?.id],
    queryFn: () => request(`/students/${student?.id}`),
    enabled: visible && !!student?.id,
    staleTime: 30000,
  });

  // Fetch inventory
  const { data: inventory } = useQuery({
    queryKey: ["student-inv", student?.id],
    queryFn: () => request(`/attendance/inventory/${student?.id}`),
    enabled: visible && !!student?.id,
    staleTime: 30000,
  });

  // Fetch latest check-in history
  const { data: checkins = [] } = useQuery<any[]>({
    queryKey: ["student-checkin-history", student?.id],
    queryFn: () => request(`/students/${student?.id}/checkins-history?limit=30`),
    enabled: visible && !!student?.id,
    staleTime: 15000,
  });

  const s = profile || student;
  const isCheckedIn = !!s?.checkInTime && !s?.checkOutTime;
  const isCheckedOut = !!s?.checkOutTime;
  const isEntered = isCheckedIn;
  const inv = inventory as any || {};
  const detailFields = [
    { label: "Roll No.", value: s?.rollNumber || "—" },
    { label: "Email", value: s?.email || "—" },
    { label: "Gender", value: s?.gender || "—" },
    { label: "Age", value: s?.age || "—" },
    { label: "DS/ES", value: s?.dsEs || "—" },
    { label: "Hostel", value: s?.allottedHostel || s?.hostelName || "—" },
    { label: "Room No.", value: s?.roomNumber || "—" },
    { label: "Mess", value: s?.allottedMess || s?.assignedMess || "—" },
    { label: "Mobile", value: s?.mobileNumber || s?.contactNumber || s?.phone || "—" },
    { label: "Emergency", value: s?.emergencyContact || "—" },
    { label: "Area", value: s?.area || "—" },
    { label: "Remarks", value: s?.remarks || "—" },
    { label: "Attendance", value: s?.attendanceStatus || "—" },
  ];

  const markAttendance = async () => {
    if (!s?.id) return;
    setMarking(true);
    try {
      await request(`/attendance/${s.id}`, {
        method: "POST",
        body: JSON.stringify({ status: isEntered ? "not_entered" : "entered" }),
      });
      qc.invalidateQueries({ queryKey: ["master-students"] });
      qc.invalidateQueries({ queryKey: ["student-detail", s.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onUpdated?.();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update attendance");
    }
    setMarking(false);
  };

  const markCheckin = async () => {
    if (!s?.id) return;
    setCheckingIn(true);
    try {
      await request(`/checkins/${s.id}`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["student-checkin", s.id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to mark check-in");
    }
    setCheckingIn(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          {isLoading ? (
            <ActivityIndicator color={theme.tint} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.profileHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.tint + "20" }]}>
                  <Text style={[styles.avatarText, { color: theme.tint }]}>{(s?.name || "?").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pName, { color: theme.text }]}>{s?.name}</Text>
                  <Text style={[styles.pEmail, { color: theme.textSecondary }]}>{s?.email}</Text>
                  {s?.rollNumber && <Text style={[styles.pMeta, { color: theme.textTertiary }]}>Roll: {s.rollNumber}</Text>}
                </View>
                <View style={[styles.attBadge, { backgroundColor: isCheckedOut ? "#6366f120" : isEntered ? "#22c55e20" : "#f59e0b20" }]}>
                  <View style={[styles.attDot, { backgroundColor: isCheckedOut ? "#6366f1" : isEntered ? "#22c55e" : "#f59e0b" }]} />
                  <Text style={[styles.attBadgeText, { color: isCheckedOut ? "#6366f1" : isEntered ? "#22c55e" : "#f59e0b" }]}> 
                    {isCheckedOut ? "Checked Out" : isEntered ? "In Campus" : "Not Checked In"}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.background, borderColor: theme.border, marginBottom: 10 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Student Record</Text>
                <View style={styles.fieldGrid}>
                  {detailFields.map(field => (
                    <View key={field.label} style={[styles.fieldTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{field.label}</Text>
                      <Text style={[styles.fieldValue, { color: theme.text }]} numberOfLines={3}>{field.value}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <DetailRow icon="home" label="Hostel" value={s?.allottedHostel || s?.hostelName || "—"} theme={theme} />
                <DetailRow icon="hash" label="Room No." value={s?.roomNumber || "—"} theme={theme} />
                <DetailRow icon="coffee" label="Mess" value={s?.allottedMess || s?.assignedMess || "—"} theme={theme} />
                <DetailRow icon="users" label="Gender" value={s?.gender || "—"} theme={theme} />
                <DetailRow icon="calendar" label="Age" value={String(s?.age || "—")} theme={theme} />
                <DetailRow icon="tag" label="DS/ES" value={s?.dsEs || "—"} theme={theme} />
                <DetailRow icon="map-pin" label="Area" value={s?.area || "—"} theme={theme} />
                <DetailRow icon="phone" label="Mobile" value={s?.mobileNumber || s?.contactNumber || s?.phone || "—"} theme={theme} />
                <DetailRow icon="phone-call" label="Emergency" value={s?.emergencyContact || "—"} theme={theme} />
                <DetailRow icon="file-text" label="Remarks" value={s?.remarks || "—"} theme={theme} />
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.background, borderColor: theme.border, marginTop: 10 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Inventory</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(item => {
                    const has = !!inv?.[item];
                    return (
                      <View key={item} style={[styles.invChip, { backgroundColor: has ? "#22c55e15" : theme.surface, borderColor: has ? "#22c55e50" : theme.border }]}>
                        <Feather name={has ? "check-circle" : "circle"} size={15} color={has ? "#22c55e" : theme.textTertiary} />
                        <Text style={[styles.invChipText, { color: has ? "#22c55e" : theme.textSecondary }]}>
                          {item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.background, borderColor: theme.border, marginTop: 10 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Campus Check-in (Today)</Text>
                {s?.checkInTime ? (
                  <View style={{ marginTop: 8, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name="log-in" size={14} color="#22c55e" />
                      <Text style={[styles.checkinTime, { color: theme.text }]}>Check-in: {formatDT(s?.checkInTime)}</Text>
                    </View>
                    {s?.checkOutTime && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="log-out" size={14} color="#ef4444" />
                        <Text style={[styles.checkinTime, { color: theme.text }]}>Check-out: {formatDT(s?.checkOutTime)}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[styles.noCheckin, { color: theme.textSecondary }]}>Not checked in today</Text>
                )}
              </View>

              <View style={[styles.detailCard, { backgroundColor: theme.background, borderColor: theme.border, marginTop: 10 }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Check-in History</Text>
                {checkins.length > 0 ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    {checkins.slice(0, 12).map((c: any) => (
                      <View key={c.id} style={styles.historyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.historyDate, { color: theme.text }]}>{c.date || "—"}</Text>
                          <Text style={[styles.historyTime, { color: theme.textSecondary }]}>In: {formatDT(c.checkInTime)}</Text>
                          <Text style={[styles.historyTime, { color: theme.textSecondary }]}>Out: {formatDT(c.checkOutTime)}</Text>
                        </View>
                        <View style={[styles.historyBadge, { backgroundColor: c.checkOutTime ? "#6366f120" : c.checkInTime ? "#22c55e20" : "#f59e0b20" }]}>
                          <Text style={[styles.historyBadgeText, { color: c.checkOutTime ? "#6366f1" : c.checkInTime ? "#22c55e" : "#f59e0b" }]}> 
                            {c.checkOutTime ? "Checked Out" : c.checkInTime ? "In Campus" : "Not Checked In"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.noCheckin, { color: theme.textSecondary }]}>No check-in history found</Text>
                )}
              </View>

              {canMark && (
                <View style={{ gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={markAttendance}
                    disabled={marking}
                    style={[styles.actionBtn, { backgroundColor: isEntered ? "#ef444420" : "#22c55e20", borderColor: isEntered ? "#ef444440" : "#22c55e40" }]}
                  >
                    {marking ? <ActivityIndicator size="small" color={isEntered ? "#ef4444" : "#22c55e"} /> : (
                      <>
                        <Feather name={isEntered ? "x-circle" : "check-circle"} size={18} color={isEntered ? "#ef4444" : "#22c55e"} />
                        <Text style={[styles.actionBtnText, { color: isEntered ? "#ef4444" : "#22c55e" }]}>
                          {isEntered ? "Mark Not Entered" : "Mark Entered"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  {!s?.checkInTime && (
                    <Pressable
                      onPress={markCheckin}
                      disabled={checkingIn}
                      style={[styles.actionBtn, { backgroundColor: theme.tint + "20", borderColor: theme.tint + "40" }]}
                    >
                      {checkingIn ? <ActivityIndicator size="small" color={theme.tint} /> : (
                        <>
                          <Feather name="log-in" size={18} color={theme.tint} />
                          <Text style={[styles.actionBtnText, { color: theme.tint }]}>Mark Campus Check-in</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </ScrollView>
          )}

          <Pressable onPress={onClose} style={[styles.closeBtn, { borderColor: theme.border, marginTop: 14 }]}>
            <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.border }]}>
      <Feather name={icon as any} size={13} color={theme.tint} />
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MasterTableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const { user } = useAuth();

  const [filter, setFilter] = useState<"all" | "in_campus" | "checked_out" | "not_checked_in">("all");
  const [search, setSearch] = useState("");
  const [hostelFilter, setHostelFilter] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const { data: hostels = [] } = useQuery<any[]>({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
    staleTime: 30000,
  });

  const loadAllStudents = useCallback(async () => {
    const loaded: any[] = [];
    let offset = 0;
    let total = Infinity;

    while (true) {
      const response = await request(`/students?offset=${offset}&limit=${FETCH_PAGE_SIZE}`);
      const batch = Array.isArray(response) ? response : (response?.students || []);
      if (!batch.length) break;

      loaded.push(...batch);

      const responseTotal = Number(response?.total);
      if (Number.isFinite(responseTotal) && responseTotal >= 0) {
        total = responseTotal;
      }

      offset += batch.length;
      if (Number.isFinite(total) && loaded.length >= total) break;
    }

    return loaded;
  }, [request]);

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["master-students"],
    queryFn: loadAllStudents,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const arr = Array.isArray(students) ? students : [];

  const assignedHostelIds: string[] = useMemo(() => {
    try {
      const raw: any = user?.assignedHostelIds;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
      if (typeof raw === "string") {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
      }
      return [];
    } catch {
      return [];
    }
  }, [user?.assignedHostelIds]);

  const scopedHostelIds = useMemo(() => {
    if (user?.role === "superadmin") return null;
    if (user?.role === "volunteer") return [user?.hostelId].filter(Boolean) as string[];
    return Array.from(new Set([...(assignedHostelIds || []), user?.hostelId || ""].filter(Boolean)));
  }, [user?.role, user?.hostelId, assignedHostelIds]);

  const scopedArr = useMemo(() => {
    if (!scopedHostelIds) return arr;
    if (scopedHostelIds.length === 0) return [];
    return arr.filter((s: any) => scopedHostelIds.includes(String(s.hostelId || "")));
  }, [arr, scopedHostelIds]);

  const filtered = scopedArr.filter(s => {
    const isCheckedIn = !!s.checkInTime && !s.checkOutTime;
    const isCheckedOut = !!s.checkOutTime;
    const isNotCheckedIn = !s.checkInTime;

    if (hostelFilter && String(s.hostelId || "") !== hostelFilter) return false;

    if (filter === "in_campus" && !isCheckedIn) return false;
    if (filter === "checked_out" && !isCheckedOut) return false;
    if (filter === "not_checked_in" && !isNotCheckedIn) return false;
    if (search) {
      const q = search.toLowerCase();
      const statusText = isCheckedOut ? "checked out out" : isCheckedIn ? "in campus in entered" : "not checked in pending";
      const haystack = [
        s.name,
        s.rollNumber,
        s.roomNumber,
        s.assignedMess,
        s.allottedMess,
        s.email,
        s.hostelId,
        s.hostelName,
        s.allottedHostel,
        s.phone,
        s.contactNumber,
        s.mobileNumber,
        s.area,
        statusText,
      ].filter(Boolean).join(" ").toLowerCase();
      return (
        haystack.includes(q)
      );
    }
    return true;
  });

  const visible = filtered.slice(0, shown);
  const entered = scopedArr.filter(s => !!s.checkInTime && !s.checkOutTime).length;
  const checkedOut = scopedArr.filter(s => !!s.checkOutTime).length;
  const notCheckedIn = scopedArr.length - entered - checkedOut;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Master Table</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Summary */}
      <View style={[styles.summaryRow, { borderBottomColor: theme.border }]}>
        <SummaryPill label="Total" value={scopedArr.length} color={theme.text} theme={theme} />
        <SummaryPill label="In Campus" value={entered} color="#22c55e" theme={theme} />
        <SummaryPill label="Checked Out" value={checkedOut} color="#6366f1" theme={theme} />
        <SummaryPill label="Not Checked In" value={notCheckedIn} color="#f59e0b" theme={theme} />
      </View>

      {/* Filters */}
      <View style={[styles.filterRow, { borderBottomColor: theme.border }]}>
        {(["all", "in_campus", "checked_out", "not_checked_in"] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => { setFilter(f); setShown(PAGE); Haptics.selectionAsync(); }}
            style={[styles.filterBtn, {
              backgroundColor: filter === f ? theme.tint : theme.surface,
              borderColor: filter === f ? theme.tint : theme.border,
            }]}
          >
            <Text style={[styles.filterLabel, { color: filter === f ? "#fff" : theme.textSecondary }]}>
              {f === "all" ? "All" : f === "in_campus" ? "In Campus" : f === "checked_out" ? "Checked Out" : "Not Checked In"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <Feather name="search" size={15} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search name, roll, room, mess, hostel, phone, status…"
          placeholderTextColor={theme.textTertiary}
          value={search}
          onChangeText={(t) => { setSearch(t); setShown(PAGE); }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={15} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>

      {(hostels as any[]).length > 1 && (
        <View style={[styles.hostelChips, { borderBottomColor: theme.border }]}> 
          <Pressable
            onPress={() => { setHostelFilter(""); setShown(PAGE); }}
            style={[styles.chip, {
              borderColor: !hostelFilter ? theme.tint : theme.border,
              backgroundColor: !hostelFilter ? theme.tint + "15" : theme.surface,
            }]}
          >
            <Text style={[styles.chipText, { color: !hostelFilter ? theme.tint : theme.textSecondary }]}>All Hostels</Text>
          </Pressable>
          {(hostels as any[]).map((h: any) => (
            <Pressable
              key={h.id}
              onPress={() => { setHostelFilter(hostelFilter === h.id ? "" : h.id); setShown(PAGE); }}
              style={[styles.chip, {
                borderColor: hostelFilter === h.id ? theme.tint : theme.border,
                backgroundColor: hostelFilter === h.id ? theme.tint + "15" : theme.surface,
              }]}
            >
              <Text style={[styles.chipText, { color: hostelFilter === h.id ? theme.tint : theme.textSecondary }]} numberOfLines={1}>
                {h.name}
              </Text>
            </Pressable>
          ))}

          {!!hostelFilter && (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.push({ pathname: "/admin/hostels", params: { hostelId: hostelFilter } } as any);
              }}
              style={[styles.chip, { borderColor: theme.tint, backgroundColor: theme.tint + "22" }]}
            >
              <Text style={[styles.chipText, { color: theme.tint }]}>Open Particular Hostel</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Table Header */}
      <View style={[styles.tableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.th, { color: theme.textSecondary, flex: 2 }]}>STUDENT</Text>
        <Text style={[styles.th, { color: theme.textSecondary, flex: 1 }]}>HOSTEL / EMAIL</Text>
        <Text style={[styles.th, { color: theme.textSecondary, flex: 1 }]}>ROOM</Text>
        <Text style={[styles.th, { color: theme.textSecondary, flex: 1 }]}>MESS</Text>
        <Text style={[styles.th, { color: theme.textSecondary, width: 92, textAlign: "center" }]}>STATUS</Text>
      </View>

      {isLoading ? (
        <View style={{ padding: 16 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
          onEndReached={() => { if (shown < filtered.length) setShown(s => s + PAGE); }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={() => shown < filtered.length ? (
            <ActivityIndicator color={theme.tint} style={{ marginVertical: 12 }} />
          ) : null}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Feather name="users" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students found</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const isIn = !!item.checkInTime && !item.checkOutTime;
            const isOut = !!item.checkOutTime;
            return (
              <Pressable
                onPress={() => { Haptics.selectionAsync(); setSelectedStudent(item); }}
                hitSlop={6}
                style={[styles.tableRow, { backgroundColor: theme.background }]}
              >
                <View style={{ flex: 2 }}>
                  <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.roll, { color: theme.textSecondary }]} numberOfLines={1}>{item.rollNumber || item.email}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cell, { color: theme.textSecondary }]} numberOfLines={1}>{item.allottedHostel || item.hostelName || "—"}</Text>
                  <Text style={[styles.cell, { color: theme.textTertiary }]} numberOfLines={1}>{item.email}</Text>
                </View>
                <Text style={[styles.cell, { color: theme.textSecondary, flex: 1 }]}>{item.roomNumber || "—"}</Text>
                <Text style={[styles.cell, { color: theme.textSecondary, flex: 1 }]} numberOfLines={1}>{item.allottedMess || item.assignedMess || "—"}</Text>
                <View style={{ width: 92, alignItems: "center" }}>
                  <View style={[styles.statusPill, { backgroundColor: isOut ? "#6366f120" : isIn ? "#22c55e20" : "#f59e0b20" }]}>
                    <View style={[styles.dot, { backgroundColor: isOut ? "#6366f1" : isIn ? "#22c55e" : "#f59e0b" }]} />
                    <Text style={[styles.statusText, { color: isOut ? "#6366f1" : isIn ? "#22c55e" : "#f59e0b" }]} numberOfLines={1}>
                      {isOut ? "Out" : isIn ? "In" : "Pending"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <StudentDetailModal
        student={selectedStudent}
        visible={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        theme={theme}
        onUpdated={refetch}
      />
    </View>
  );
}

function SummaryPill({ label, value, color, theme }: any) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: color + "12", borderColor: color + "35" }]}>
      <Text style={[styles.summaryVal, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  summaryPill: { minWidth: 78, alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, gap: 2 },
  summaryVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  filterBtn: { minWidth: 110, alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  filterLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  hostelChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, maxWidth: "100%" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  th: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  name: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  roll: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cell: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statusPill: { padding: 4, borderRadius: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Modal
  overlay: { flex: 1, backgroundColor: "#00000080", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, maxHeight: "90%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 16 },
  profileHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  pName: { fontSize: 17, fontFamily: "Inter_700Bold" },
  pEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  pMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  attBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20 },
  attDot: { width: 7, height: 7, borderRadius: 4 },
  attBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1 },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 4 },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  fieldTile: { width: "48%", borderRadius: 12, borderWidth: 1, padding: 10, gap: 4 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  fieldValue: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  invChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1 },
  invChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10 },
  historyDate: { fontSize: 12, fontFamily: "Inter_700Bold" },
  historyTime: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  historyBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  checkinTime: { fontSize: 13, fontFamily: "Inter_500Medium" },
  noCheckin: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  closeBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold" },
});
