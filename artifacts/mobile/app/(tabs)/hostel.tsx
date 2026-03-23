import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, Modal, ScrollView,
  Pressable, RefreshControl, Platform, useColorScheme, ActivityIndicator, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth, useApiRequest } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const PAGE_SIZE = 25;

// ─── Student Detail Modal ──────────────────────────────────────────────────────

function StudentDetailModal({ student, visible, onClose, theme, request }: {
  student: any; visible: boolean; onClose: () => void; theme: any; request: any;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const { data: inventory, isLoading: invLoading, refetch: refetchInv } = useQuery<any>({
    queryKey: ["student-inventory", student?.id],
    queryFn: () => request(`/attendance/inventory/${student?.id}`),
    enabled: visible && !!student?.id,
    staleTime: 0,
  });

  const { data: contacts = [], isLoading: ctLoading, refetch: refetchContacts } = useQuery<any[]>({
    queryKey: ["hostel-contacts-student", student?.hostelId],
    queryFn: () => request(`/hostel/contacts?hostelId=${student?.hostelId}`),
    enabled: visible && !!student?.hostelId,
    staleTime: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchInv(), refetchContacts()]);
    setRefreshing(false);
  }, [refetchInv, refetchContacts]);

  if (!student) return null;

  const attColor = student.attendanceStatus === "entered" ? "#22c55e" : "#f59e0b";
  const attLabel = student.attendanceStatus === "entered" ? "In Campus" : "Out";
  const contactList: any[] = Array.isArray(contacts) ? contacts : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <View style={[styles.modalAvatar, { backgroundColor: theme.tint + "20" }]}>
            <Text style={[styles.modalAvatarText, { color: theme.tint }]}>
              {(student.name || "?")[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modalName, { color: theme.text }]}>{student.name}</Text>
            <Text style={[styles.modalEmail, { color: theme.textSecondary }]}>{student.email}</Text>
            {student.rollNumber && (
              <Text style={[styles.modalRoll, { color: theme.textTertiary }]}>{student.rollNumber}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <View style={[styles.attBadge, { backgroundColor: attColor + "20" }]}>
              <View style={[styles.attDot, { backgroundColor: attColor }]} />
              <Text style={[styles.attLabel, { color: attColor }]}>{attLabel}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Hostel + Room Info */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>LOCATION</Text>
            {[
              { icon: "home",    label: "Hostel",   value: student.hostelName || "—" },
              { icon: "hash",    label: "Room",     value: student.roomNumber  || "—" },
              { icon: "map-pin", label: "Area",     value: student.area        || "—" },
              { icon: "coffee",  label: "Mess",     value: student.assignedMess || "—" },
            ].map((row, i, arr) => (
              <View key={row.label} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.detailIcon, { backgroundColor: theme.tint + "15" }]}>
                  <Feather name={row.icon as any} size={14} color={theme.tint} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Contact Info */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>CONTACT</Text>
            {[
              { icon: "phone",     label: "Phone",   value: student.phone          || "—" },
              { icon: "smartphone", label: "Alt No.", value: student.contactNumber  || "—" },
            ].map((row, i, arr) => (
              <View key={row.label} style={[styles.detailRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <View style={[styles.detailIcon, { backgroundColor: "#22c55e15" }]}>
                  <Feather name={row.icon as any} size={14} color="#22c55e" />
                </View>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Inventory */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INVENTORY</Text>
            {invLoading ? (
              <ActivityIndicator color={theme.tint} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.inventoryRow}>
                {(["mattress", "bedsheet", "pillow"] as const).map(item => {
                  const has = !!(inventory as any)?.[item];
                  return (
                    <View key={item} style={[styles.invChip, { backgroundColor: has ? "#22c55e12" : theme.background, borderColor: has ? "#22c55e50" : theme.border }]}>
                      <Feather name={has ? "check-circle" : "circle"} size={16} color={has ? "#22c55e" : theme.textTertiary} />
                      <Text style={[styles.invLabel, { color: has ? "#22c55e" : theme.textSecondary }]}>
                        {item.charAt(0).toUpperCase() + item.slice(1)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Lead / Emergency Contacts */}
          {(ctLoading || contactList.length > 0) && (
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HOSTEL CONTACTS</Text>
              {ctLoading ? (
                <ActivityIndicator color={theme.tint} style={{ marginVertical: 12 }} />
              ) : (
                contactList.map((c: any, i: number) => (
                  <View key={c.id} style={[styles.detailRow, i < contactList.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                    <View style={[styles.detailIcon, { backgroundColor: "#f59e0b15" }]}>
                      <Feather name="phone-call" size={14} color="#f59e0b" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.detailValue, { color: theme.text }]}>{c.name}</Text>
                      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{c.role}</Text>
                    </View>
                    <Text style={[styles.contactPhone, { color: theme.tint }]}>{c.phone}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Student Row ───────────────────────────────────────────────────────────────

function StudentRow({ item, theme, onPress }: { item: any; theme: any; onPress: () => void }) {
  const attColor = item.attendanceStatus === "entered" ? "#22c55e" : "#f59e0b";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.studentRow, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.tint + "20" }]}>
        <Text style={[styles.avatarText, { color: theme.tint }]}>
          {(item.name || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.studentName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>
          {item.rollNumber || item.email}{item.roomNumber ? ` · Room ${item.roomNumber}` : ""}
        </Text>
        {item.assignedMess && (
          <Text style={[styles.studentMeta, { color: theme.textTertiary }]}>Mess: {item.assignedMess}</Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View style={[styles.attBadge, { backgroundColor: attColor + "20" }]}>
          <View style={[styles.attDot, { backgroundColor: attColor }]} />
          <Text style={[styles.attLabel, { color: attColor }]}>
            {item.attendanceStatus === "entered" ? "In" : "Out"}
          </Text>
        </View>
        <Feather name="chevron-right" size={13} color={theme.textTertiary} />
      </View>
    </Pressable>
  );
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────

export default function HostelTab() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = (isWeb ? 67 : insets.top) + 8;

  const { user, isStudent } = useAuth();
  const request = useApiRequest();

  // ── Student view ──────────────────────────────────────────────────
  const { data: hostel, isLoading: hostelLoading, refetch: refetchHostel } = useQuery({
    queryKey: ["hostel", user?.hostelId],
    queryFn: () => request(`/hostels/${user?.hostelId}`),
    enabled: isStudent && !!user?.hostelId,
    staleTime: 60000,
  });

  const { data: contacts, refetch: refetchContacts } = useQuery({
    queryKey: ["contacts", user?.hostelId],
    queryFn: () => request(`/hostel/contacts?hostelId=${user?.hostelId}`),
    enabled: isStudent && !!user?.hostelId,
    staleTime: 60000,
  });

  const { data: myInventory } = useQuery({
    queryKey: ["my-inventory", user?.id],
    queryFn: () => request(`/attendance/inventory/${user?.id}`),
    enabled: isStudent && !!user?.id,
    staleTime: 60000,
  });

  // ── Staff view ────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const fetchStudents = useCallback(async (reset = false) => {
    if (!hasMore && !reset) return;
    const offset = reset ? 0 : page * PAGE_SIZE;
    if (reset) { setAllStudents([]); setHasMore(true); }
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (search.trim()) params.set("search", search.trim());
      const data = await request(`/students?${params}`);
      const list = Array.isArray(data) ? data : (data.students || data.data || []);
      setAllStudents(prev => reset ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      if (!reset) setPage(p => p + 1);
      else setPage(1);
    } catch { }
    setLoading(false);
  }, [request, search, page, hasMore]);

  const onRefreshStudents = useCallback(async () => {
    setRefreshing(true);
    await fetchStudents(true);
    setRefreshing(false);
  }, [fetchStudents]);

  React.useEffect(() => {
    if (!isStudent) fetchStudents(true);
  }, [isStudent, search]);

  // ── Student view render ───────────────────────────────────────────

  if (isStudent) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.pageHeader, { paddingTop: topPad, borderBottomColor: theme.border }]}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>My Hostel</Text>
        </View>
        {hostelLoading ? (
          <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /></View>
        ) : hostel ? (
          <FlatList
            data={contacts || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            ListHeaderComponent={() => (
              <>
                <AnimatedCard style={styles.hostelCard}>
                  <Text style={[styles.hostelName, { color: theme.text }]}>{hostel.name}</Text>
                  {hostel.location ? <Text style={[styles.hostelLocation, { color: theme.textSecondary }]}>{hostel.location}</Text> : null}
                  <View style={styles.hostelGrid}>
                    <InfoRow icon="user" label="Warden" value={hostel.wardenName} theme={theme} />
                    <InfoRow icon="phone" label="Warden Contact" value={hostel.wardenPhone} theme={theme} />
                    <InfoRow icon="layers" label="Capacity" value={String(hostel.capacity || hostel.totalRooms || "—")} theme={theme} />
                  </View>
                </AnimatedCard>

                <AnimatedCard style={[styles.hostelCard, { marginTop: 0 }]}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>My Room</Text>
                  <View style={styles.hostelGrid}>
                    <InfoRow icon="hash" label="Room No." value={user?.roomNumber || "—"} theme={theme} />
                    <InfoRow icon="coffee" label="Mess" value={user?.assignedMess || "—"} theme={theme} />
                    <InfoRow icon="map-pin" label="Area" value={user?.area || "—"} theme={theme} />
                  </View>
                </AnimatedCard>

                <AnimatedCard style={[styles.hostelCard, { marginTop: 0 }]}>
                  <Text style={[styles.sectionLabel, { color: theme.text }]}>My Inventory</Text>
                  <Text style={[{ color: theme.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 10 }]}>Items provided by hostel</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {(["mattress", "bedsheet", "pillow"] as const).map(item => {
                      const has = !!(myInventory as any)?.[item];
                      return (
                        <View key={item} style={[styles.invItem, { backgroundColor: has ? "#22c55e15" : theme.surface, borderColor: has ? "#22c55e50" : theme.border }]}>
                          <Feather name={has ? "check-circle" : "circle"} size={18} color={has ? "#22c55e" : theme.textTertiary} />
                          <Text style={[styles.invItemLabel, { color: has ? "#22c55e" : theme.textSecondary }]}>
                            {item.charAt(0).toUpperCase() + item.slice(1)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </AnimatedCard>

                {(contacts || []).length > 0 && (
                  <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 4 }]}>Hostel Contacts</Text>
                )}
              </>
            )}
            renderItem={({ item }) => (
              <AnimatedCard style={styles.contactCard}>
                <View style={[styles.contactIcon, { backgroundColor: theme.tint + "20" }]}>
                  <Feather name="phone-call" size={18} color={theme.tint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.contactRole, { color: theme.textSecondary }]}>{item.role}</Text>
                </View>
                <Text style={[styles.contactPhone, { color: theme.tint }]}>{item.phone}</Text>
              </AnimatedCard>
            )}
            ListEmptyComponent={() => null}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refetchHostel(); refetchContacts(); setRefreshing(false); }} tintColor={theme.tint} />}
          />
        ) : (
          <View style={styles.noHostel}>
            <Feather name="home" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hostel assigned yet</Text>
          </View>
        )}
      </View>
    );
  }

  // ── Staff view render ─────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.pageHeader, { paddingTop: topPad, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Students</Text>
          {allStudents.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
              <Text style={[styles.countText, { color: theme.tint }]}>{allStudents.length}</Text>
            </View>
          )}
        </View>
        <View style={[styles.searchBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            placeholder="Search by name, room, roll…"
            placeholderTextColor={theme.textTertiary}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: theme.text }]}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={allStudents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefreshStudents} tintColor={theme.tint} />}
        onEndReached={() => hasMore && !loading && fetchStudents()}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <StudentRow
            item={item}
            theme={theme}
            onPress={() => { Haptics.selectionAsync(); setSelectedStudent(item); }}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={() => loading ? (
          <View style={{ padding: 20 }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
        ) : (
          <View style={styles.noHostel}>
            <Feather name="users" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students found</Text>
          </View>
        )}
        ListFooterComponent={() => loading && allStudents.length > 0 ? (
          <ActivityIndicator color={theme.tint} style={{ marginVertical: 16 }} />
        ) : null}
      />

      <StudentDetailModal
        student={selectedStudent}
        visible={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        theme={theme}
        request={request}
      />
    </View>
  );
}

function InfoRow({ icon, label, value, theme }: { icon: string; label: string; value: string; theme: any }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
      <Feather name={icon as any} size={14} color={theme.tint} />
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, gap: 10 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  countText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  searchBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, paddingVertical: 0 },
  // Student view
  hostelCard: { marginBottom: 16 },
  hostelName: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  hostelLocation: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 14 },
  hostelGrid: { gap: 0 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 10, marginTop: 4 },
  invItem: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1, gap: 6 },
  invItemLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  contactIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  contactName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  contactRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  contactPhone: { fontSize: 14, fontFamily: "Inter_700Bold" },
  // Staff view list
  studentRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  studentMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  attBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 20 },
  attDot: { width: 6, height: 6, borderRadius: 3 },
  attLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  noHostel: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  // Student Detail Modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
  modalAvatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  modalAvatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  modalName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  modalRoll: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  section: { borderRadius: 14, borderWidth: 1, marginBottom: 14, overflow: "hidden" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  detailIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  detailLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  detailValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inventoryRow: { flexDirection: "row", gap: 8, padding: 14, paddingTop: 4 },
  invChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 5 },
  invLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
