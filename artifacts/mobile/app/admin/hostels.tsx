import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
  TextInput, ActivityIndicator, Alert,
  Platform, useColorScheme, Share, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

// ─── Student Sub-Detail Modal ──────────────────────────────────────────────────
function StudentSubModal({ student, visible, onClose, theme }: { student: any; visible: boolean; onClose: () => void; theme: any }) {
  if (!student) return null;
  const phone = student.mobileNumber || student.contactNumber || student.phone || "";
  const emergency = student.emergencyContact || "";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ssd.overlay} onPress={onClose}>
        <Pressable style={[ssd.sheet, { backgroundColor: theme.surface }]} onPress={e => e.stopPropagation()}>
          <View style={ssd.handle} />
          <View style={ssd.header}>
            <View style={[ssd.avatar, { backgroundColor: theme.tint + "20" }]}>
              <Text style={[ssd.avatarText, { color: theme.tint }]}>{(student.name || "?")[0].toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ssd.name, { color: theme.text }]}>{student.name}</Text>
              <Text style={[ssd.roll, { color: theme.textSecondary }]}>
                {student.rollNumber || student.email || ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={ssd.closeX}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Chips */}
          <View style={ssd.chips}>
            {!!student.roomNumber && (
              <View style={[ssd.chip, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                <Feather name="layers" size={11} color={theme.tint} />
                <Text style={[ssd.chipText, { color: theme.tint }]}>Room {student.roomNumber}</Text>
              </View>
            )}
            {!!(student.gender) && (
              <View style={[ssd.chip, { backgroundColor: "#3b82f615", borderColor: "#3b82f640" }]}>
                <Feather name="user" size={11} color="#3b82f6" />
                <Text style={[ssd.chipText, { color: "#3b82f6" }]}>{student.gender}</Text>
              </View>
            )}
            {!!(student.age) && (
              <View style={[ssd.chip, { backgroundColor: "#8b5cf615", borderColor: "#8b5cf640" }]}>
                <Text style={[ssd.chipText, { color: "#8b5cf6" }]}>Age {student.age}</Text>
              </View>
            )}
            {!!(student.allottedMess || student.assignedMess) && (
              <View style={[ssd.chip, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b40" }]}>
                <Feather name="coffee" size={11} color="#f59e0b" />
                <Text style={[ssd.chipText, { color: "#f59e0b" }]}>{student.allottedMess || student.assignedMess}</Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={[ssd.infoCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
            {!!phone && (
              <View style={ssd.infoRow}>
                <Feather name="phone" size={13} color="#3b82f6" />
                <Text style={[ssd.infoLabel, { color: theme.textSecondary }]}>Mobile</Text>
                <Text style={[ssd.infoVal, { color: theme.text }]}>{phone}</Text>
              </View>
            )}
            {!!emergency && (
              <View style={ssd.infoRow}>
                <Feather name="alert-circle" size={13} color="#ef4444" />
                <Text style={[ssd.infoLabel, { color: theme.textSecondary }]}>Emergency</Text>
                <Text style={[ssd.infoVal, { color: theme.text }]}>{emergency}</Text>
              </View>
            )}
            {!!(student.dsEs) && (
              <View style={ssd.infoRow}>
                <Feather name="book" size={13} color={theme.textTertiary} />
                <Text style={[ssd.infoLabel, { color: theme.textSecondary }]}>DS/ES</Text>
                <Text style={[ssd.infoVal, { color: theme.text }]}>{student.dsEs}</Text>
              </View>
            )}
          </View>

          {/* Call */}
          {!!phone && (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); Linking.openURL(`tel:${phone}`); }}
              style={ssd.callBtn}
            >
              <Feather name="phone-call" size={16} color="#fff" />
              <Text style={ssd.callBtnText}>Call {phone}</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={[ssd.closeBtn, { borderColor: theme.border }]}>
            <Text style={[ssd.closeBtnText, { color: theme.textSecondary }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Hostel Detail Modal ───────────────────────────────────────────────────────
function HostelDetailModal({ hostel, visible, onClose, theme, request }: {
  hostel: any; visible: boolean; onClose: () => void; theme: any; request: any;
}) {
  const [searchQ, setSearchQ] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const loadAllHostelStudents = useCallback(async () => {
    if (!hostel?.id) return [];
    const pageSize = 500;
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    const acc: any[] = [];

    while (acc.length < total) {
      const response = await request(`/students?hostelId=${encodeURIComponent(hostel.id)}&page=${page}&limit=${pageSize}`);
      const batch = Array.isArray(response) ? response : (response?.students || []);
      const parsedTotal = Array.isArray(response) ? batch.length : Number(response?.total ?? batch.length);
      total = Number.isFinite(parsedTotal) ? parsedTotal : batch.length;

      if (!batch.length) break;
      acc.push(...batch);
      if (batch.length < pageSize) break;
      page += 1;
    }

    const deduped = new Map<string, any>();
    for (const s of acc) {
      const id = String(s?.id || "").trim();
      const roll = String(s?.rollNumber || "").trim().toLowerCase();
      const email = String(s?.email || "").trim().toLowerCase();
      const key = id || roll || email;
      if (!key) continue;
      if (!deduped.has(key)) deduped.set(key, s);
    }

    return Array.from(deduped.values()).filter((s: any) => String(s?.hostelId || "") === String(hostel.id));
  }, [hostel?.id, request]);

  const { data: students = [], isLoading } = useQuery<any[]>({
    queryKey: ["hostel-students", hostel?.id],
    queryFn: loadAllHostelStudents,
    enabled: visible && !!hostel?.id,
    staleTime: 5000,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["hostel-contacts-detail", hostel?.id],
    queryFn: () => request(`/hostel/contacts?hostelId=${hostel?.id}`),
    enabled: visible && !!hostel?.id,
    staleTime: 15000,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  if (!hostel) return null;

  const studentList = Array.isArray(students) ? students : (students as any).students || [];
  const roomCount = hostel.totalRooms || 0;
  const occupiedRooms = new Set(studentList.filter((s: any) => s.roomNumber).map((s: any) => s.roomNumber)).size;
  const availableRooms = roomCount > 0 ? Math.max(0, roomCount - occupiedRooms) : null;

  const filteredStudents = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return studentList;
    return studentList.filter((s: any) =>
      [s.name, s.rollNumber, s.roomNumber, s.email, s.gender, s.allottedMess].some(
        v => v && String(v).toLowerCase().includes(q)
      )
    );
  }, [studentList, searchQ]);

  const handleDownloadReport = async () => {
    Haptics.selectionAsync();
    const headers = ["Name", "Roll Number", "Room", "Gender", "Age", "Mess", "Mobile", "Emergency"].join(",");
    const rows = studentList.map((s: any) => [
      `"${(s.name || "").replace(/"/g, '""')}"`,
      s.rollNumber || "",
      s.roomNumber || "",
      s.gender || "",
      s.age || "",
      s.allottedMess || "",
      s.mobileNumber || "",
      s.emergencyContact || "",
    ].join(","));
    const csv = [headers, ...rows].join("\n");

    if (Platform.OS === "web") {
      try {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${hostel.name}_students.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        Alert.alert("Error", "Could not download report");
      }
    } else {
      try {
        await Share.share({
          message: csv,
          title: `${hostel.name} Student Report`,
        });
      } catch (err: any) {
        if (err.message !== "The user did not share") {
          Alert.alert("Error", "Could not share report");
        }
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.detailModal, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.detailHeader, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailTitle, { color: theme.text }]}>{hostel.name}</Text>
            {hostel.location ? <Text style={[styles.detailSub, { color: theme.textSecondary }]}>{hostel.location}</Text> : null}
          </View>
          {/* Download CSV button */}
          {studentList.length > 0 && (
            <Pressable
              onPress={handleDownloadReport}
              style={[styles.closeX, { backgroundColor: "#22c55e15", borderRadius: 8, borderWidth: 1, borderColor: "#22c55e40", marginRight: 8 }]}
            >
              <Feather name="download" size={17} color="#22c55e" />
            </Pressable>
          )}
          <Pressable onPress={onClose} style={styles.closeX}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Cards */}
          <View style={styles.infoGrid}>
            {[
              { icon: "user", label: "Warden", value: hostel.wardenName || "—", color: theme.tint },
              { icon: "phone", label: "Phone", value: hostel.wardenPhone || "—", color: "#22c55e" },
            ].map(item => (
              <Pressable
                key={item.label}
                onPress={() => {
                  if (item.label === "Phone" && hostel.wardenPhone) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    Linking.openURL(`tel:${hostel.wardenPhone}`);
                  }
                }}
                style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.infoIcon, { backgroundColor: item.color + "20" }]}>
                  <Feather name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.infoVal, { color: theme.text }]} numberOfLines={1}>{item.value}</Text>
              </Pressable>
            ))}
          </View>

          {/* Room Stats */}
          <View style={styles.roomGrid}>
            <View style={[styles.roomCard, { backgroundColor: theme.tint + "12", borderColor: theme.tint + "40" }]}>
              <Text style={[styles.roomNum, { color: theme.tint }]}>{studentList.length}</Text>
              <Text style={[styles.roomLabel, { color: theme.textSecondary }]}>Students</Text>
            </View>
            {roomCount > 0 && (
              <>
                <View style={[styles.roomCard, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b40" }]}>
                  <Text style={[styles.roomNum, { color: "#f59e0b" }]}>{roomCount}</Text>
                  <Text style={[styles.roomLabel, { color: theme.textSecondary }]}>Total Rooms</Text>
                </View>
                <View style={[styles.roomCard, { backgroundColor: "#22c55e12", borderColor: "#22c55e40" }]}>
                  <Text style={[styles.roomNum, { color: "#22c55e" }]}>{availableRooms}</Text>
                  <Text style={[styles.roomLabel, { color: theme.textSecondary }]}>Available</Text>
                </View>
              </>
            )}
          </View>

          {/* Students List */}
          <View style={styles.studentsSectionHeader}>
            <Text style={[styles.sectionLabel, { color: theme.text }]}>
              Students ({isLoading ? "…" : filteredStudents.length}{filteredStudents.length !== studentList.length ? `/${studentList.length}` : ""})
            </Text>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Feather name="search" size={14} color={theme.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by name, roll, room, gender…"
              placeholderTextColor={theme.textTertiary}
              value={searchQ}
              onChangeText={setSearchQ}
              autoCapitalize="none"
            />
            {searchQ.length > 0 && (
              <Pressable onPress={() => setSearchQ("")} hitSlop={8}>
                <Feather name="x" size={14} color={theme.textTertiary} />
              </Pressable>
            )}
          </View>

          {isLoading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : filteredStudents.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Feather name="users" size={28} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQ ? "No students match your search" : "No students assigned"}
              </Text>
            </View>
          ) : (
            filteredStudents.map((s: any) => (
              <Pressable
                key={s.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedStudent(s); }}
                style={({ pressed }) => [styles.studentRow, {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <View style={[styles.studentAvatar, { backgroundColor: theme.tint + "20" }]}>
                  <Text style={[styles.studentAvatarText, { color: theme.tint }]}>{(s.name || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studentName, { color: theme.text }]}>{s.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>
                    {s.rollNumber || s.email}{s.roomNumber ? ` · Room ${s.roomNumber}` : ""}
                  </Text>
                  {!!(s.gender || s.allottedMess) && (
                    <Text style={[styles.studentMeta, { color: theme.textTertiary }]}>
                      {[s.gender, s.allottedMess].filter(Boolean).join(" · ")}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {s.roomNumber && (
                    <View style={[styles.roomBadge, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                      <Text style={[styles.roomBadgeText, { color: theme.tint }]}>{s.roomNumber}</Text>
                    </View>
                  )}
                  {!!(s.mobileNumber || s.phone) && (
                    <Feather name="phone" size={12} color={theme.tint} />
                  )}
                  <Feather name="chevron-right" size={14} color={theme.textTertiary} />
                </View>
              </Pressable>
            ))
          )}

          {/* Contacts */}
          {(contacts as any[]).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 20 }]}>Contacts</Text>
              {(contacts as any[]).map((c: any) => (
                <Pressable
                  key={c.id}
                  onPress={() => { if (c.phone) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Linking.openURL(`tel:${c.phone}`); } }}
                  style={({ pressed }) => [styles.studentRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={[styles.studentAvatar, { backgroundColor: "#22c55e20" }]}>
                    <Feather name="phone-call" size={16} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{c.name}</Text>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>{c.role} · {c.phone}</Text>
                  </View>
                  {!!c.phone && <Feather name="phone" size={14} color="#22c55e" />}
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>

        {/* Student Sub-Modal */}
        <StudentSubModal
          student={selectedStudent}
          visible={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          theme={theme}
        />
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function HostelsAdminScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const request = useApiRequest();
  const { user, isSuperAdmin, isCoordinator, isVolunteer } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";
  const params = useLocalSearchParams<{ hostelId?: string }>();

  const [showHostel, setShowHostel] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [selectedHostel, setSelectedHostel] = useState<any>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [warden, setWarden] = useState("");
  const [wardenPhone, setWardenPhone] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [cName, setCName] = useState("");
  const [cRole, setCRole] = useState("");
  const [cPhone, setCPhone] = useState("");

  const { data: hostels, isLoading } = useQuery({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const hostelMutation = useMutation({
    mutationFn: (data: any) => request("/hostels", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hostels"] });
      setShowHostel(false); setName(""); setLocation(""); setWarden(""); setWardenPhone("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const contactMutation = useMutation({
    mutationFn: (data: any) => request("/hostel/contacts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setShowContact(false); setCName(""); setCRole(""); setCPhone(""); setHostelId("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const hostelList: any[] = Array.isArray(hostels) ? hostels : [];

  const assignedHostelIds: string[] = useMemo(() => {
    try {
      const raw = user?.assignedHostelIds;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [user?.assignedHostelIds]);

  const visibleHostels = useMemo(() => {
    if (isSuperAdmin) return hostelList;
    if (isCoordinator) {
      const scoped = new Set([...assignedHostelIds, user?.hostelId || ""].filter(Boolean));
      return scoped.size ? hostelList.filter((h: any) => scoped.has(h.id)) : [];
    }
    if (isVolunteer) {
      return user?.hostelId ? hostelList.filter((h: any) => h.id === user.hostelId) : [];
    }
    return [];
  }, [hostelList, isSuperAdmin, isVolunteer, isCoordinator, assignedHostelIds, user?.hostelId]);

  React.useEffect(() => {
    const targetId = typeof params.hostelId === "string" ? params.hostelId : "";
    if (!targetId || !visibleHostels.length) return;
    const target = visibleHostels.find((h: any) => String(h.id) === targetId);
    if (!target) return;
    setSelectedHostel(target);
  }, [params.hostelId, visibleHostels]);

  const hostelIdsKey = useMemo(() => visibleHostels.map((h: any) => h.id).join("|"), [visibleHostels]);

  const { data: hostelStudentCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["hostel-student-counts", hostelIdsKey],
    enabled: visibleHostels.length > 0,
    queryFn: async () => {
      const counts = await Promise.all(
        visibleHostels.map(async (h: any) => {
          const response = await request(`/students?hostelId=${encodeURIComponent(h.id)}&page=1&limit=1`);
          const total = Array.isArray(response) ? response.length : Number(response?.total ?? 0);
          return [h.id, Number.isFinite(total) ? total : 0] as const;
        })
      );
      return Object.fromEntries(counts);
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 5000,
  });

  const totalStudents = useMemo(
    () => visibleHostels.reduce((sum: number, h: any) => sum + (hostelStudentCounts[h.id] || 0), 0),
    [visibleHostels, hostelStudentCounts]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: (isWeb ? 67 : insets.top) + 8, borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Hostels</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setShowContact(true)} style={[styles.iconBtn, { backgroundColor: "#22c55e" }]}>
            <Feather name="phone-call" size={16} color="#fff" />
          </Pressable>
          {isSuperAdmin && (
            <Pressable onPress={() => setShowHostel(true)} style={[styles.iconBtn, { backgroundColor: theme.tint }]}>
              <Feather name="plus" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: isWeb ? 34 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary row */}
        {visibleHostels.length > 0 && (
          <View style={[styles.summaryBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: theme.tint }]}>{visibleHostels.length}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Hostels</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: "#22c55e" }]}>
                {totalStudents}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Students</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>
                {visibleHostels.reduce((s: number, h: any) => s + (h.totalRooms || 0), 0)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Rooms</Text>
            </View>
          </View>
        )}

        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /></>
        ) : !visibleHostels.length ? (
          <View style={styles.emptyState}>
            <Feather name="home" size={40} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isSuperAdmin ? "No hostels yet. Tap + to add one." : "No assigned hostels found."}
            </Text>
          </View>
        ) : (
          visibleHostels.map((h: any) => (
            <Pressable
              key={h.id}
              onPress={() => { Haptics.selectionAsync(); setSelectedHostel(h); }}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <AnimatedCard style={styles.card}>
                <View style={styles.hostelRow}>
                  <View style={[styles.icon, { backgroundColor: theme.tint + "20" }]}>
                    <Feather name="home" size={22} color={theme.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.hostelName, { color: theme.text }]}>{h.name}</Text>
                    {h.location && <Text style={[styles.hostelLoc, { color: theme.textSecondary }]}>{h.location}</Text>}
                    {h.wardenName && <Text style={[styles.warden, { color: theme.textTertiary }]}>Warden: {h.wardenName}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.roomsBadge, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
                      <Feather name="users" size={11} color="#22c55e" />
                      <Text style={[styles.roomsText, { color: "#22c55e" }]}>{hostelStudentCounts[h.id] || 0} students</Text>
                    </View>
                    {h.totalRooms ? (
                      <View style={[styles.roomsBadge, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                        <Feather name="layers" size={11} color={theme.tint} />
                        <Text style={[styles.roomsText, { color: theme.tint }]}>{h.totalRooms} rooms</Text>
                      </View>
                    ) : null}
                    <Feather name="chevron-right" size={16} color={theme.textTertiary} />
                  </View>
                </View>
              </AnimatedCard>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Hostel Detail Modal */}
      <HostelDetailModal
        hostel={selectedHostel}
        visible={!!selectedHostel}
        onClose={() => setSelectedHostel(null)}
        theme={theme}
        request={request}
      />

      {/* Add Hostel Modal (superadmin only) */}
      <Modal visible={showHostel} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Hostel</Text>
            <Pressable onPress={() => setShowHostel(false)}><Feather name="x" size={24} color={theme.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {[
              { label: "Hostel Name *", val: name, set: setName, ph: "Hostel Gurunath" },
              { label: "Location", val: location, set: setLocation, ph: "North Campus" },
              { label: "Warden Name", val: warden, set: setWarden, ph: "Dr. Ramesh" },
              { label: "Warden Phone", val: wardenPhone, set: setWardenPhone, ph: "+91 9876543210", kb: "phone-pad" as const },
            ].map((f) => (
              <View key={f.label}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} placeholder={f.ph} placeholderTextColor={theme.textTertiary} value={f.val} onChangeText={f.set} keyboardType={f.kb} />
              </View>
            ))}
            <Pressable
              onPress={() => hostelMutation.mutate({ name, location, wardenName: warden, wardenPhone })}
              style={[styles.submitBtn, { backgroundColor: theme.tint }]}
              disabled={hostelMutation.isPending || !name.trim()}
            >
              {hostelMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Hostel</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* Add Contact Modal */}
      <Modal visible={showContact} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Emergency Contact</Text>
            <Pressable onPress={() => setShowContact(false)}><Feather name="x" size={24} color={theme.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Hostel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable onPress={() => setHostelId("")} style={[styles.hostelChip, { backgroundColor: !hostelId ? theme.tint + "20" : theme.surface, borderColor: !hostelId ? theme.tint : theme.border }]}>
                  <Text style={[styles.hostelChipText, { color: !hostelId ? theme.tint : theme.textSecondary }]}>Global</Text>
                </Pressable>
                {visibleHostels.map((h: any) => (
                  <Pressable key={h.id} onPress={() => setHostelId(h.id)} style={[styles.hostelChip, { backgroundColor: hostelId === h.id ? theme.tint + "20" : theme.surface, borderColor: hostelId === h.id ? theme.tint : theme.border }]}>
                    <Text style={[styles.hostelChipText, { color: hostelId === h.id ? theme.tint : theme.textSecondary }]}>{h.name}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            {[
              { label: "Contact Name *", val: cName, set: setCName, ph: "Volunteer Name" },
              { label: "Role *", val: cRole, set: setCRole, ph: "Volunteer / Coordinator" },
              { label: "Phone *", val: cPhone, set: setCPhone, ph: "+91 9876543210", kb: "phone-pad" as const },
            ].map((f) => (
              <View key={f.label}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} placeholder={f.ph} placeholderTextColor={theme.textTertiary} value={f.val} onChangeText={f.set} keyboardType={f.kb} />
              </View>
            ))}
            <Pressable
              onPress={() => contactMutation.mutate({ hostelId, name: cName, role: cRole, phone: cPhone, isAvailable24x7: true })}
              style={[styles.submitBtn, { backgroundColor: "#22c55e" }]}
              disabled={contactMutation.isPending}
            >
              {contactMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Contact</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  summaryBar: { flexDirection: "row", borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  summaryItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  summaryNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryDivider: { width: 1 },
  card: { marginBottom: 10 },
  hostelRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  hostelName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  hostelLoc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  warden: { fontSize: 12, fontFamily: "Inter_400Regular" },
  roomsBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  roomsText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  hostelChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  hostelChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  submitBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  // Detail Modal
  detailModal: { flex: 1 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
  detailTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  detailSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeX: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  infoGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  infoCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  roomGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  roomCard: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, alignItems: "center", gap: 4 },
  roomNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  roomLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionLabel: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 10 },
  emptyBox: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  studentAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  roomBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  roomBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  studentsSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 0 },
});

// ─── StudentSubModal Styles ────────────────────────────────────────────────────
const ssd = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1", alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  name: { fontSize: 15, fontFamily: "Inter_700Bold" },
  roll: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  closeX: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  infoLabel: { fontSize: 12, fontFamily: "Inter_400Regular", width: 72 },
  infoVal: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  callBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#22c55e", borderRadius: 14, paddingVertical: 13, marginBottom: 8 },
  callBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  closeBtn: { borderWidth: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  closeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
