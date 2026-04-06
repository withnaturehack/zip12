import React, { useState, useMemo, useEffect } from "react";
import {
  View, Text, FlatList, StyleSheet, Pressable, TextInput, ScrollView,
  Platform, useColorScheme, useWindowDimensions, Modal, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { BlurView } from "expo-blur";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { useDebounce } from "@/hooks/useDebounce";
import * as Haptics from "expo-haptics";

// ─── Student Detail Modal ──────────────────────────────────────────────────────
function InventoryStudentModal({ student, visible, onClose, theme, isDark }: {
  student: any; visible: boolean; onClose: () => void; theme: any; isDark: boolean;
}) {
  if (!student) return null;
  const inv = student.inventory || {};
  const isLocked = !!inv.inventoryLocked;
  const rawStatus = statusOf(student);
  const STATUS_META = {
    green: { label: "Submitted", color: "#22c55e" },
    yellow: { label: "Pending", color: "#eab308" },
    black: { label: "Not Taken", color: "#64748b" },
    red: { label: "Missing — Not Submitted", color: "#ef4444" },
  } as const;
  const meta = STATUS_META[rawStatus];
  const phone = student.mobileNumber || student.contactNumber || student.phone || "";
  const email = student.email || "";
  const emergency = student.emergencyContact || "";
  const hostelName = student.hostelName || student.hostelId || "";
  const roomNumber = student.roomNumber || "";

  const inventoryItems = [
    { key: "mattress", label: "Mattress" },
    { key: "bedsheet", label: "Bedsheet" },
    { key: "pillow", label: "Pillow" },
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

            {/* Hostel + Room highlighted chips */}
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

            {/* Status Badge */}
            <View style={[imd.statusBadge, { backgroundColor: meta.color + "15", borderColor: meta.color + "40" }]}>
              <View style={[imd.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[imd.statusLabel, { color: meta.color }]}>{meta.label}</Text>
              {rawStatus === "red" && (
                <Feather name="alert-triangle" size={12} color={meta.color} style={{ marginLeft: 4 }} />
              )}
            </View>

            {/* Inventory Items */}
            <View style={imd.section}>
              <Text style={[imd.sectionTitle, { color: theme.text }]}>Inventory</Text>
              <View style={imd.itemRow}>
                {inventoryItems.map(({ key, label }) => {
                  const given = !!inv[key];
                  const submitted = !!inv[`${key}Submitted`] || (isLocked && given);
                  const isMissing = rawStatus === "red" && given && !submitted;
                  const bg = submitted ? "#22c55e20" : isMissing ? "#fef2f220" : given ? "#fef3c720" : theme.background;
                  const borderC = submitted ? "#22c55e50" : isMissing ? "#ef444450" : given ? "#eab30850" : theme.border;
                  const iconName = submitted ? "check-circle" : isMissing ? "alert-circle" : given ? "clock" : "minus-circle";
                  const iconColor = submitted ? "#22c55e" : isMissing ? "#ef4444" : given ? "#eab308" : theme.textTertiary;
                  const statusText = submitted ? "Submitted" : isMissing ? "Missing" : given ? "Pending" : "Not given";
                  return (
                    <View key={key} style={[imd.inventoryItem, { backgroundColor: bg, borderColor: borderC }]}>
                      <Feather name={iconName} size={18} color={iconColor} />
                      <Text style={[imd.inventoryLabel, { color: theme.text }]}>{label}</Text>
                      <Text style={[imd.inventoryStatus, { color: iconColor }]}>{statusText}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Check-in/out times */}
            {(student.checkInTime || student.checkOutTime) && (
              <View style={[imd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {!!student.checkInTime && (
                  <View style={imd.infoRow}>
                    <Feather name="log-in" size={14} color="#22c55e" />
                    <Text style={[imd.infoLabel, { color: theme.textSecondary }]}>Check-in</Text>
                    <Text style={[imd.infoVal, { color: theme.text }]}>
                      {new Date(student.checkInTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </Text>
                  </View>
                )}
                {!!student.checkOutTime && (
                  <View style={imd.infoRow}>
                    <Feather name="log-out" size={14} color="#ef4444" />
                    <Text style={[imd.infoLabel, { color: theme.textSecondary }]}>Check-out</Text>
                    <Text style={[imd.infoVal, { color: theme.text }]}>
                      {new Date(student.checkOutTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Student details — email instead of phone */}
            <View style={[imd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {!!email && <InfoRow icon="mail" label="Email" value={email} theme={theme} />}
              {!!student.gender && <InfoRow icon="user" label="Gender" value={student.gender} theme={theme} />}
              {!!student.age && <InfoRow icon="calendar" label="Age" value={String(student.age)} theme={theme} />}
              {!!(student.allottedMess || student.assignedMess) && <InfoRow icon="coffee" label="Mess" value={student.allottedMess || student.assignedMess} theme={theme} />}
              {!!emergency && <InfoRow icon="alert-circle" label="Emergency" value={emergency} theme={theme} />}
            </View>

            {/* Call button — still calls the phone number if available */}
            {!!phone && (
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL(`tel:${phone}`); }}
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

function InfoRow({ icon, label, value, theme }: { icon: any; label: string; value: string; theme: any }) {
  return (
    <View style={imd.infoRow}>
      <Feather name={icon} size={13} color={theme.textTertiary} />
      <Text style={[imd.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[imd.infoVal, { color: theme.text }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function hasAnyGiven(inv: any) { return !!(inv?.mattress || inv?.bedsheet || inv?.pillow); }
function hasPendingGiven(inv: any) {
  return !!(
    (inv?.mattress && !inv?.mattressSubmitted) ||
    (inv?.bedsheet && !inv?.bedsheetSubmitted) ||
    (inv?.pillow && !inv?.pillowSubmitted)
  );
}
function statusOf(student: any): "green" | "yellow" | "black" | "red" {
  const inv = student?.inventory || {};
  const isLocked = !!inv.inventoryLocked;
  const anyGiven = hasAnyGiven(inv);
  const pending = hasPendingGiven(inv);
  const isCheckedOut = !!(student?.checkOutTime);
  if (isLocked || (anyGiven && !pending)) return "green";
  if (isCheckedOut && pending) return "red"; // Checked out but items not returned
  if (pending) return "yellow";
  return "black";
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function InventoryTableScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isCompactPhone = !isWeb && width < 430;
  const topPad = (isWeb ? 67 : insets.top) + 8;
  const request = useApiRequest();
  const { isVolunteer, isSuperAdmin } = useAuth();

  const [filter, setFilter] = useState<"all" | "missing" | "submitted">("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activating, setActivating] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const requiresShift = isVolunteer && !isSuperAdmin;
  const { data: myStatus, refetch: refetchStatus } = useQuery<{ isActive: boolean; lastActiveAt: string | null }>({
    queryKey: ["my-status"],
    queryFn: () => request("/staff/me-status"),
    enabled: requiresShift,
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const canWork = !requiresShift || !!myStatus?.isActive;

  const { data = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["inventory-simple"],
    queryFn: () => request("/inventory-simple"),
    enabled: canWork,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
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
      const nameRoom = `${String(student.name || "").trim().toLowerCase()}|${String(student.roomNumber || "").trim().toLowerCase()}|${String(student.hostelId || "").trim().toLowerCase()}`;
      const key = roll || email || nameRoom || String(student.id);
      if (!map.has(key)) map.set(key, student);
    }
    return Array.from(map.values()) as any[];
  }, [data]);

  const submittedCount = items.filter(s => statusOf(s) === "green").length;
  const missingCount = items.filter(s => statusOf(s) === "red").length;
  const pendingCount = items.filter(s => statusOf(s) === "yellow").length;
  const notTakenCount = items.filter(s => statusOf(s) === "black").length;

  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return items.filter(s => {
      if (q) {
        const haystack = [s.name, s.rollNumber, s.roomNumber, s.hostelId, s.email]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "submitted") return !!s.inventory?.inventoryLocked;
      if (filter === "missing") return statusOf(s) === "yellow" || statusOf(s) === "red";
      return true;
    });
  }, [items, debouncedSearch, filter]);

  const sortedItems = useMemo(() => {
    const priority = { red: 0, yellow: 1, green: 2, black: 3 } as const;
    return [...filteredItems].sort((a, b) => {
      const sa = statusOf(a), sb = statusOf(b);
      if (priority[sa] !== priority[sb]) return priority[sa] - priority[sb];
      const ta = new Date(a?.checkOutTime || a?.checkInTime || 0).getTime();
      const tb = new Date(b?.checkOutTime || b?.checkInTime || 0).getTime();
      if (ta !== tb) return tb - ta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [filteredItems]);

  const lastSyncAgoSec = Math.max(0, Math.floor((liveNow - dataUpdatedAt) / 1000));

  const goActive = async () => {
    setActivating(true);
    try {
      await request("/staff/go-active", { method: "POST", body: JSON.stringify({}) });
      await refetchStatus();
    } catch {
    } finally { setActivating(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: theme.text }]}>Inventory</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Live hostel issue and submit status</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: theme.textSecondary }]}>Live · updated {lastSyncAgoSec}s ago</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Overview */}
      {isCompactPhone ? (
        <View style={[styles.compactOverviewWrap, { borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactOverviewRow}>
            <CompactMetric label="Submitted" value={String(submittedCount)} color="#22c55e" />
            <CompactMetric label="Pending" value={String(pendingCount)} color="#eab308" />
            <CompactMetric label="Not Taken" value={String(notTakenCount)} color="#64748b" />
            {missingCount > 0 && <CompactMetric label="Checked Out—Missing" value={String(missingCount)} color="#ef4444" />}
          </ScrollView>
        </View>
      ) : (
        <View style={[styles.overviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.overviewTitle, { color: theme.text }]}>Student Status</Text>
          <View style={styles.overviewGrid}>
            <OverviewMetric label="Submitted" value={String(submittedCount)} color="#22c55e" />
            <OverviewMetric label="Pending" value={String(pendingCount)} color="#eab308" />
            <OverviewMetric label="Not Taken" value={String(notTakenCount)} color="#64748b" />
            <OverviewMetric label="Checked Out—Missing" value={String(missingCount)} color="#ef4444" />
          </View>
          {missingCount > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, backgroundColor: "#ef444410", borderRadius: 8, padding: 8 }}>
              <Feather name="alert-triangle" size={12} color="#ef4444" />
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#ef4444" }}>
                {missingCount} student{missingCount !== 1 ? "s" : ""} checked out without returning inventory
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Search */}
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
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={14} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <View style={[styles.filterRow]}>
        {(["all", "missing", "submitted"] as const).map(f => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, {
              backgroundColor: filter === f
                ? (f === "missing" ? "#eab30820" : f === "submitted" ? "#22c55e20" : theme.tint + "20")
                : "transparent",
              borderColor: filter === f
                ? (f === "missing" ? "#eab30840" : f === "submitted" ? "#22c55e40" : theme.tint + "40")
                : "transparent",
            }]}
          >
            <Text style={[styles.filterBtnText, {
              color: filter === f
                ? (f === "missing" ? "#a16207" : f === "submitted" ? "#22c55e" : theme.tint)
                : theme.textSecondary,
            }]}>
              {f === "all" ? "All" : f === "missing" ? "Pending" : "Done"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.resultsRow}>
        <Text style={[styles.resultsText, { color: theme.textSecondary }]}>
          Showing {sortedItems.length} of {items.length}
        </Text>
      </View>

      {/* Table header */}
      <View style={[styles.tableHead, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.thName, { color: theme.textSecondary }]}>STUDENT</Text>
        <Text style={[styles.thStatus, { color: theme.textSecondary }]}>STATUS</Text>
        <View style={styles.thItems}>
          {["M", "B", "P"].map(h => (
            <Text key={h} style={[styles.thItem, { color: theme.textSecondary }]}>{h}</Text>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : (
        <FlatList
          data={sortedItems}
          keyExtractor={(i, idx) => {
            const roll = String(i?.rollNumber || "").trim().toLowerCase();
            const id = String(i?.id || "").trim();
            return id || roll || `${idx}`;
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          removeClippedSubviews
          windowSize={11}
          initialNumToRender={18}
          maxToRenderPerBatch={28}
          updateCellsBatchingPeriod={40}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={40} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {filter === "missing" ? "No pending inventory!" : filter === "submitted" ? "None submitted yet" : "No students found"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const inv = item.inventory || {};
            const pendingSubmitItems = (["mattress", "bedsheet", "pillow"] as const).filter(f => !!inv[f] && !inv[`${f}Submitted`]);
            const anyGiven = hasAnyGiven(inv);
            const rowStatus = statusOf(item);
            const isLocked = rowStatus === "green";
            const borderLeftColor = rowStatus === "green" ? "#22c55e" : rowStatus === "red" ? "#ef4444" : rowStatus === "yellow" ? "#eab308" : "#64748b";

            return (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedStudent(item);
                }}
                style={({ pressed }) => [styles.tableRow, {
                  backgroundColor: isLocked ? "#22c55e06" : theme.background,
                  borderColor: theme.border,
                  borderLeftWidth: 3,
                  borderLeftColor,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <View style={styles.nameCol}>
                  <Text style={[styles.studentName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
                  {/* Hostel + Room highlighted */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                    {!!(item.hostelName || item.hostelId) && (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: theme.tint }} numberOfLines={1}>
                        {item.hostelName || item.hostelId}
                      </Text>
                    )}
                    {!!(item.hostelName || item.hostelId) && !!item.roomNumber && (
                      <Text style={{ fontSize: 10, color: theme.textTertiary }}>·</Text>
                    )}
                    {!!item.roomNumber && (
                      <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#8b5cf6" }} numberOfLines={1}>
                        Rm {item.roomNumber}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.rollNumber || item.email || ""}
                  </Text>
                  {/* Check-in/out time */}
                  {(item.checkInTime || item.checkOutTime) && (
                    <Text style={[styles.studentMeta, { color: theme.textTertiary, fontSize: 10 }]} numberOfLines={1}>
                      {item.checkInTime ? `In: ${new Date(item.checkInTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" })}` : ""}
                      {item.checkOutTime ? ` · Out: ${new Date(item.checkOutTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" })}` : ""}
                    </Text>
                  )}
                  {!isLocked && rowStatus === "red" && pendingSubmitItems.length > 0 && (
                    <Text style={[styles.missingText, { color: "#ef4444" }]}>
                      Missing: {pendingSubmitItems.join(", ")}
                    </Text>
                  )}
                  {!isLocked && rowStatus === "yellow" && pendingSubmitItems.length > 0 && (
                    <Text style={[styles.missingText, { color: "#eab308" }]}>
                      Pending: {pendingSubmitItems.join(", ")}
                    </Text>
                  )}
                  {!isLocked && !anyGiven && (
                    <Text style={[styles.missingText, { color: theme.textTertiary }]}>No inventory issued</Text>
                  )}
                </View>

                <View style={styles.statusCol}>
                  {rowStatus === "green" ? (
                    <View style={styles.submittedBadge}>
                      <Feather name="lock" size={10} color="#16a34a" />
                      <Text style={styles.submittedText}>Done</Text>
                    </View>
                  ) : rowStatus === "red" ? (
                    <View style={[styles.statusPill, { backgroundColor: "#fef2f2" }]}>
                      <Text style={[styles.statusPillText, { color: "#dc2626" }]}>Missing</Text>
                    </View>
                  ) : rowStatus === "yellow" ? (
                    <View style={[styles.statusPill, { backgroundColor: "#fef9c3" }]}>
                      <Text style={[styles.statusPillText, { color: "#a16207" }]}>Pending</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                      <Text style={[styles.statusPillText, { color: isDark ? "#94a3b8" : "#475569" }]}>Not Taken</Text>
                    </View>
                  )}
                </View>

                <View style={styles.toggleRow}>
                  {(["mattress", "bedsheet", "pillow"] as const).map(field => {
                    const val = !!inv[field];
                    const submitted = !!inv[`${field}Submitted`];
                    const bg = submitted ? "#22c55e20" : val ? "#fef3c7" : (isDark ? "#1e293b" : "#f1f5f9");
                    const border = submitted ? "#22c55e" : val ? "#f59e0b" : (isDark ? "#334155" : "#cbd5e1");
                    const icon = submitted ? "check-circle" : val ? "clock" : "minus";
                    const color = submitted ? "#22c55e" : val ? "#a16207" : (isDark ? "#475569" : "#94a3b8");
                    return (
                      <View key={field} style={[styles.toggleBtn, { backgroundColor: bg, borderColor: border }]}>
                        <Feather name={icon} size={14} color={color} />
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
        isDark={isDark}
      />

      {!canWork && (
        <View style={styles.lockOverlay}>
          <BlurView intensity={70} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View style={[styles.lockCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.tint + "15", alignItems: "center", justifyContent: "center" }]}>
              <Feather name="lock" size={20} color={theme.tint} />
            </View>
            <Text style={[styles.lockTitle, { color: theme.text }]}>Shift Inactive</Text>
            <Text style={[styles.lockSub, { color: theme.textSecondary }]}>
              Start your shift to access inventory and student data.
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

function OverviewMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, { borderColor: color + "35", backgroundColor: color + "12" }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color }]}>{label}</Text>
    </View>
  );
}

function CompactMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.compactMetric, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Text style={[styles.compactMetricValue, { color }]}>{value}</Text>
      <Text style={[styles.compactMetricLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: 1, gap: 8 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", lineHeight: 24 },
  subtitle: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: "#22c55e" },
  liveText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  compactOverviewWrap: { borderBottomWidth: 1, paddingTop: 4, paddingBottom: 4 },
  compactOverviewRow: { paddingHorizontal: 14, gap: 6 },
  compactMetric: { minWidth: 92, borderRadius: 8, borderWidth: 1, paddingVertical: 5, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  compactMetricValue: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 16 },
  compactMetricLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", lineHeight: 12 },
  overviewCard: { marginHorizontal: 14, marginTop: 6, borderRadius: 12, borderWidth: 1, padding: 8, gap: 6 },
  overviewTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metricCard: { width: "31.8%", borderRadius: 8, borderWidth: 1, paddingVertical: 6, alignItems: "center", justifyContent: "center", gap: 1 },
  metricValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  metricLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  searchRow: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 5 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  filterRow: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 7, gap: 8 },
  filterBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resultsRow: { paddingHorizontal: 14, paddingBottom: 6 },
  resultsText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  thName: { flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thStatus: { width: 62, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  thItems: { flexDirection: "row", gap: 6 },
  thItem: { width: 36, textAlign: "center", fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginTop: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, paddingLeft: 10 },
  nameCol: { flex: 1, marginRight: 6 },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  missingText: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statusCol: { width: 62, alignItems: "center" },
  submittedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#dcfce7", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  submittedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#16a34a" },
  statusPill: { paddingHorizontal: 5, paddingVertical: 4, borderRadius: 6, alignItems: "center" },
  statusPillText: { fontSize: 9, fontFamily: "Inter_700Bold" },
  toggleRow: { flexDirection: "row", gap: 6 },
  toggleBtn: { width: 36, height: 32, borderRadius: 8, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lockOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 20 },
  lockCard: { borderWidth: 1, borderRadius: 16, padding: 20, alignItems: "center", gap: 10, width: "100%", maxWidth: 340 },
  lockTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  lockSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  lockBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  lockBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
});

// ─── InventoryStudentModal Styles ─────────────────────────────────────────────
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
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontFamily: "Inter_700Bold" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 8 },
  itemRow: { flexDirection: "row", gap: 8 },
  inventoryItem: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
  inventoryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  inventoryStatus: { fontSize: 10, fontFamily: "Inter_500Medium" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 72 },
  infoVal: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 13, marginBottom: 8 },
  callBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  closeBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  closeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
