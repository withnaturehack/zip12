import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput, ScrollView,
  Platform, useColorScheme, useWindowDimensions, Modal, Linking, Alert, Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useDebounce } from "@/hooks/useDebounce";
import * as Haptics from "expo-haptics";

// ─── Status helpers ────────────────────────────────────────────────────────────
function hasAnyGiven(inv: any) { return !!(inv?.mattress || inv?.bedsheet || inv?.pillow); }
function hasPendingGiven(inv: any) {
  return !!(
    (inv?.mattress && !inv?.mattressSubmitted) ||
    (inv?.bedsheet && !inv?.bedsheetSubmitted) ||
    (inv?.pillow && !inv?.pillowSubmitted)
  );
}
function statusOf(student: any): "green" | "yellow" | "gray" | "red" {
  const inv = student?.inventory || {};
  const isLocked = !!inv.inventoryLocked;
  const anyGiven = hasAnyGiven(inv);
  const pending = hasPendingGiven(inv);
  const isCheckedOut = !!(student?.checkOutTime);
  if (isLocked || (anyGiven && !pending)) return "green";   // ✅ Submitted/Done
  if (isCheckedOut && pending) return "red";                  // 🔴 Checked out, didn't return
  if (pending) return "yellow";                               // 🟡 Pending return
  return "gray";                                              // ⚪ Not taken
}

const STATUS_META = {
  green:  { label: "Submitted",     color: "#22c55e", bg: "#22c55e18", border: "#22c55e35", icon: "check-circle" as const },
  yellow: { label: "Pending",       color: "#eab308", bg: "#fef3c7",   border: "#eab30840", icon: "clock"        as const },
  red:    { label: "Not Returned",  color: "#ef4444", bg: "#fef2f2",   border: "#ef444435", icon: "alert-circle" as const },
  gray:   { label: "Not Taken",     color: "#64748b", bg: "#f1f5f9",   border: "#cbd5e140", icon: "circle"       as const },
};

// ─── Student Detail Modal ──────────────────────────────────────────────────────
function InventoryStudentModal({ student, visible, onClose, theme }: {
  student: any; visible: boolean; onClose: () => void; theme: any;
}) {
  if (!student) return null;
  const inv = student.inventory || {};
  const isLocked = !!inv.inventoryLocked;
  const rawStatus = statusOf(student);
  const meta = STATUS_META[rawStatus];
  const phone = student.mobileNumber || student.contactNumber || student.phone || "";
  const email = student.email || "";
  const emergency = student.emergencyContact || "";
  const hostelName = student.hostelName || student.hostelId || "";
  const roomNumber = student.roomNumber || "";

  const inventoryItems = [
    { key: "mattress",  label: "Mattress"  },
    { key: "bedsheet",  label: "Bedsheet"  },
    { key: "pillow",    label: "Pillow"    },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={imd.overlay} onPress={onClose}>
        <Pressable style={[imd.sheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={imd.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Header */}
            <View style={imd.sheetHeader}>
              <View style={[imd.avatar, { backgroundColor: theme.tint + "20" }]}>
                <Text style={[imd.avatarText, { color: theme.tint }]}>
                  {(student.name || "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[imd.name, { color: theme.text }]}>{student.name}</Text>
                <Text style={[imd.meta, { color: theme.textSecondary }]}>
                  {student.rollNumber || student.email}
                </Text>
              </View>
              <Pressable onPress={onClose} style={imd.closeX} hitSlop={8}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Location chips */}
            <View style={imd.locationChips}>
              {!!hostelName && (
                <View style={[imd.hostelChip, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                  <Feather name="home" size={13} color={theme.tint} />
                  <Text style={[imd.hostelChipText, { color: theme.tint }]}>{hostelName}</Text>
                </View>
              )}
              {!!roomNumber && (
                <View style={[imd.hostelChip, { backgroundColor: "#8b5cf615", borderColor: "#8b5cf640" }]}>
                  <Feather name="layers" size={13} color="#8b5cf6" />
                  <Text style={[imd.hostelChipText, { color: "#8b5cf6" }]}>Room {roomNumber}</Text>
                </View>
              )}
            </View>

            {/* Overall Status badge */}
            <View style={[imd.statusBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
              <Feather name={meta.icon} size={14} color={meta.color} />
              <Text style={[imd.statusLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>

            {/* ── Per-item inventory boxes ── */}
            <Text style={[imd.sectionTitle, { color: theme.text }]}>Items</Text>
            <View style={imd.itemRow}>
              {inventoryItems.map(({ key, label }) => {
                const given = !!inv[key];
                const submitted = !!inv[`${key}Submitted`] || (isLocked && given);
                const isMissing = rawStatus === "red" && given && !submitted;

                // Colors per user request:
                // given + submitted → GREEN
                // given + pending → YELLOW
                // given + checked-out without submitting → RED
                // not given (not taken) → GRAY circle
                let itemStatus: "green" | "yellow" | "red" | "gray";
                if (!given) itemStatus = "gray";
                else if (submitted) itemStatus = "green";
                else if (isMissing) itemStatus = "red";
                else itemStatus = "yellow";

                const m = STATUS_META[itemStatus];
                return (
                  <View key={key} style={[imd.inventoryItem, { backgroundColor: m.bg, borderColor: m.border }]}>
                    <Feather name={m.icon} size={22} color={m.color} />
                    <Text style={[imd.inventoryLabel, { color: theme.text }]}>{label}</Text>
                    <Text style={[imd.inventoryStatus, { color: m.color }]}>{m.label}</Text>
                  </View>
                );
              })}
            </View>

            {/* Check-in/out — always shown */}
            <Text style={[imd.sectionTitle, { color: theme.text }]}>Attendance Today</Text>
            <View style={[imd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <InfoRow
                icon="log-in"
                label="Check-in"
                value={student.checkInTime
                  ? new Date(student.checkInTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
                  : "Not checked in"}
                theme={theme}
                color={student.checkInTime ? "#22c55e" : undefined}
              />
              <InfoRow
                icon="log-out"
                label="Check-out"
                value={student.checkOutTime
                  ? new Date(student.checkOutTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
                  : student.checkInTime ? "Still inside" : "—"}
                theme={theme}
                color={student.checkOutTime ? "#6366f1" : undefined}
              />
            </View>

            {/* Contact info */}
            <View style={[imd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {!!email && <InfoRow icon="mail" label="Email" value={email} theme={theme} />}
              {!!student.gender && <InfoRow icon="user" label="Gender" value={student.gender} theme={theme} />}
              {!!student.age && <InfoRow icon="calendar" label="Age" value={String(student.age)} theme={theme} />}
              {!!(student.allottedMess || student.assignedMess) && <InfoRow icon="coffee" label="Mess" value={student.allottedMess || student.assignedMess} theme={theme} />}
              {!!emergency && <InfoRow icon="alert-circle" label="Emergency" value={emergency} theme={theme} />}
            </View>

            {!!phone && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL(`tel:${phone}`).catch(() => {}); }}
                style={imd.callBtn}
              >
                <Feather name="phone-call" size={16} color="#fff" />
                <Text style={imd.callBtnText}>Call Student</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[imd.closeBtn, { borderColor: theme.border }]}>
              <Text style={[imd.closeBtnText, { color: theme.textSecondary }]}>Close</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function InfoRow({ icon, label, value, theme, color }: { icon: any; label: string; value: string; theme: any; color?: string }) {
  return (
    <View style={imd.infoRow}>
      <Feather name={icon} size={13} color={color || theme.textTertiary} />
      <Text style={[imd.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[imd.infoVal, { color: color || theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function InventoryTableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isCompact = !isWeb && width < 430;
  const topPad = Platform.OS === "web" ? 24 : Math.max(insets.top + 20, 100);
  const request = useApiRequest();
  const { isVolunteer, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["inventory-simple"] });
      qc.invalidateQueries({ queryKey: ["my-status"] });
    }, [qc])
  );

  const [filter, setFilter] = useState<"all" | "pending" | "submitted" | "not_taken" | "red">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activating, setActivating] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const requiresShift = isVolunteer && !isSuperAdmin;
  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: async () => { try { return await request("/staff/me-status"); } catch { return { isActive: false, lastActiveAt: null }; } },
    enabled: requiresShift,
    refetchInterval: 15000,
    staleTime: 8000,
  });
  const canWork = !requiresShift || !!myStatus?.isActive;

  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["inventory-simple"],
    queryFn: async () => { try { return await request("/inventory-simple") || []; } catch { return []; } },
    enabled: canWork,
    staleTime: 20000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const [liveNow, setLiveNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setLiveNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const items = useMemo(() => {
    const source = ((data as any[]) || []).filter(Boolean);
    const map = new Map<string, any>();
    for (const student of source) {
      const roll = String(student.rollNumber || "").trim().toLowerCase();
      const email = String(student.email || "").trim().toLowerCase();
      const key = roll || email || String(student.id || Math.random());
      if (!map.has(key)) map.set(key, student);
    }
    return Array.from(map.values());
  }, [data]);

  const greenCount  = useMemo(() => items.filter(s => statusOf(s) === "green").length,  [items]);
  const yellowCount = useMemo(() => items.filter(s => statusOf(s) === "yellow").length, [items]);
  const redCount    = useMemo(() => items.filter(s => statusOf(s) === "red").length,    [items]);
  const grayCount   = useMemo(() => items.filter(s => statusOf(s) === "gray").length,   [items]);

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter(s => {
      if (q) {
        const hay = [s.name, s.rollNumber, s.roomNumber, s.hostelId, s.hostelName, s.email]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "submitted")  return statusOf(s) === "green";
      if (filter === "pending")    return statusOf(s) === "yellow";
      if (filter === "red")        return statusOf(s) === "red";
      if (filter === "not_taken")  return statusOf(s) === "gray";
      return true;
    });
  }, [items, debouncedSearch, filter]);

  const sortedItems = useMemo(() => {
    const priority = { red: 0, yellow: 1, gray: 2, green: 3 } as const;
    return [...filteredItems].sort((a, b) => {
      const pa = priority[statusOf(a)], pb = priority[statusOf(b)];
      if (pa !== pb) return pa - pb;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [filteredItems]);

  const lastSyncAgoSec = Math.max(0, Math.floor((liveNow - dataUpdatedAt) / 1000));

  const goActive = async () => {
    setActivating(true);
    try {
      await request("/staff/go-active", { method: "POST", body: JSON.stringify({}) });
      await refetchStatus();
    } catch {}
    setActivating(false);
  };

  const exportCSV = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const headers = ["Name","Roll Number","Room","Hostel","Status","Mattress","Bedsheet","Pillow","Check-in","Check-out"];
      const rows = sortedItems.map((s: any) => {
        const inv = s.inventory || {};
        const st = statusOf(s);
        return [
          `"${(s.name || "").replace(/"/g, '""')}"`,
          s.rollNumber || "",
          s.roomNumber || "",
          s.hostelName || s.hostelId || "",
          STATUS_META[st].label,
          inv.mattress ? (inv.mattressSubmitted ? "Submitted" : "Given") : "Not Taken",
          inv.bedsheet ? (inv.bedsheetSubmitted ? "Submitted" : "Given") : "Not Taken",
          inv.pillow   ? (inv.pillowSubmitted   ? "Submitted" : "Given") : "Not Taken",
          s.checkInTime  ? new Date(s.checkInTime).toLocaleString("en-IN",  { timeZone: "Asia/Kolkata" }) : "",
          s.checkOutTime ? new Date(s.checkOutTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        ].join(",");
      });
      const csv = [headers.join(","), ...rows].join("\n");
      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "inventory_report.csv"; a.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: csv, title: "Inventory Report" });
      }
    } catch (e: any) {
      if (e?.message !== "The user did not share")
        Alert.alert("Export failed", e?.message || "Unknown error");
    }
    setExporting(false);
  }, [exporting, sortedItems]);

  const FILTERS = [
    { key: "all",       label: "All",           value: items.length,  color: theme.tint   },
    { key: "red",       label: "Not Returned",  value: redCount,      color: "#ef4444"    },
    { key: "pending",   label: "Pending",        value: yellowCount,   color: "#eab308"    },
    { key: "submitted", label: "Submitted",      value: greenCount,    color: "#22c55e"    },
    { key: "not_taken", label: "Not Taken",      value: grayCount,     color: "#64748b"    },
  ] as const;

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Header ── */}
      <View style={[{ paddingTop: topPad, backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Feather name="arrow-left" size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Inventory</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={[styles.liveText, { color: theme.textSecondary }]}>
                Live · synced {lastSyncAgoSec}s ago
              </Text>
            </View>
          </View>
          <Pressable
            onPress={exportCSV}
            disabled={exporting}
            style={[styles.exportBtn, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}
            hitSlop={6}
          >
            {exporting
              ? <ActivityIndicator size="small" color="#22c55e" />
              : <Feather name="download" size={15} color="#22c55e" />}
            <Text style={[styles.exportBtnText, { color: "#22c55e" }]}>CSV</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Status Filter Cards ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={[{ borderBottomWidth: 1, borderBottomColor: theme.border }]}
      >
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}
              style={[styles.filterCard, {
                backgroundColor: active ? f.color + "18" : theme.surface,
                borderColor: active ? f.color : theme.border,
              }]}
            >
              <Text style={[styles.filterCardNum, { color: active ? f.color : theme.text }]}>{f.value}</Text>
              <Text style={[styles.filterCardLabel, { color: active ? f.color : theme.textSecondary }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Search ── */}
      <View style={[styles.searchRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={14} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name, roll, room…"
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Results count ── */}
      <View style={[styles.resultsRow, { borderBottomColor: theme.border }]}>
        <Text style={[styles.resultsText, { color: theme.textSecondary }]}>
          {sortedItems.length} of {items.length} students
        </Text>
      </View>

      {/* ── Table header ── */}
      <View style={[styles.tableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.thName, { color: theme.textSecondary }]}>STUDENT</Text>
        <Text style={[styles.thStatus, { color: theme.textSecondary }]}>STATUS</Text>
        <View style={styles.thItems}>
          {["M", "B", "P"].map(h => (
            <Text key={h} style={[styles.thItem, { color: theme.textSecondary }]}>{h}</Text>
          ))}
        </View>
      </View>

      {isLoading && items.length === 0 ? (
        <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(i, idx) => {
            const id = String(i?.id || "").trim();
            const roll = String(i?.rollNumber || "").trim().toLowerCase();
            return id || roll || String(idx);
          }}
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 80 : 90 }}
          removeClippedSubviews
          windowSize={11}
          initialNumToRender={20}
          maxToRenderPerBatch={30}
          updateCellsBatchingPeriod={40}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filter !== "all" ? "No students in this category" : "No students found"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const inv = item.inventory || {};
            const rowStatus = statusOf(item);
            const m = STATUS_META[rowStatus];
            const isLocked = rowStatus === "green";

            return (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedStudent(item); }}
                style={({ pressed }) => [styles.tableRow, {
                  backgroundColor: pressed ? theme.surface : (isLocked ? "#22c55e06" : theme.background),
                  borderColor: theme.border,
                  borderLeftColor: m.color,
                }]}
              >
                {/* Name column */}
                <View style={styles.nameCol}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                    {!!(item.hostelName || item.hostelId) && (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: theme.tint }} numberOfLines={1}>
                        {item.hostelName || item.hostelId}
                      </Text>
                    )}
                    {!!item.roomNumber && (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#8b5cf6" }} numberOfLines={1}>
                        {!!(item.hostelName || item.hostelId) ? "· Rm" : "Rm"} {item.roomNumber}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.rollNumber || item.email || ""}
                  </Text>
                  {rowStatus === "red" && (
                    <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: "#ef4444", marginTop: 1 }}>
                      ⚠ Checked out — items not returned
                    </Text>
                  )}
                </View>

                {/* Status column */}
                <View style={styles.statusCol}>
                  <View style={[styles.statusPill, { backgroundColor: m.bg, borderColor: m.border }]}>
                    <Feather name={m.icon} size={10} color={m.color} />
                    <Text style={[styles.statusPillText, { color: m.color }]}>{m.label}</Text>
                  </View>
                </View>

                {/* Per-item indicators: M B P */}
                <View style={styles.toggleRow}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                    const given = !!inv[field];
                    const submitted = !!inv[`${field}Submitted`] || (isLocked && given);
                    const isMissing = rowStatus === "red" && given && !submitted;

                    // Color per user request:
                    // submitted → GREEN check-circle
                    // given but pending → YELLOW clock
                    // given + checked-out without return → RED alert
                    // not taken → GRAY circle (hollow)
                    let itemStatus: "green" | "yellow" | "red" | "gray";
                    if (!given) itemStatus = "gray";
                    else if (submitted) itemStatus = "green";
                    else if (isMissing) itemStatus = "red";
                    else itemStatus = "yellow";

                    const im = STATUS_META[itemStatus];
                    return (
                      <View
                        key={field}
                        style={[styles.toggleBtn, { backgroundColor: im.bg, borderColor: im.border }]}
                      >
                        <Feather name={im.icon} size={14} color={im.color} />
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Student Detail Modal */}
      <InventoryStudentModal
        student={selectedStudent}
        visible={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        theme={theme}
      />

      {/* Shift lock overlay */}
      {!canWork && (
        <View style={styles.lockOverlay}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.88)" }]} />
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.tint + "15", alignItems: "center", justifyContent: "center" }}>
              <Feather name="lock" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.lockTitle, { color: theme.text }]}>Shift Inactive</Text>
            <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
              Start your shift to access inventory data.
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14,
    paddingBottom: 10, gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  liveText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  exportBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  exportBtnText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterCard: {
    minWidth: 84, alignItems: "center", paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, borderWidth: 1.5, gap: 1,
  },
  filterCardNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  filterCardLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  searchRow: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  resultsRow: { paddingHorizontal: 14, paddingVertical: 5, borderBottomWidth: 1 },
  resultsText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tableHead: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1,
  },
  thName: { flex: 1, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  thStatus: { width: 78, textAlign: "center", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  thItems: { flexDirection: "row", gap: 6 },
  thItem: { width: 34, textAlign: "center", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 10, marginTop: 7, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 10, borderLeftWidth: 3,
  },
  nameCol: { flex: 1, marginRight: 6 },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statusCol: { width: 78, alignItems: "center" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 5, paddingVertical: 4, borderRadius: 7, borderWidth: 1,
  },
  statusPillText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  toggleRow: { flexDirection: "row", gap: 5 },
  toggleBtn: { width: 34, height: 30, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20 },
  lockCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 10, width: "100%", maxWidth: 340 },
  lockTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  lockBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  lockBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});

// ─── Inventory Student Modal Styles ───────────────────────────────────────────
const imd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, maxHeight: "92%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  locationChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  hostelChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  hostelChipText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_700Bold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  closeX: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start", marginBottom: 16,
  },
  statusLabel: { fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 10 },
  itemRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  inventoryItem: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center", gap: 5 },
  inventoryLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  inventoryStatus: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 72 },
  infoVal: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 13, marginBottom: 8 },
  callBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  closeBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center", marginBottom: 8 },
  closeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
