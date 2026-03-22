import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
  TextInput, ActivityIndicator, Alert, RefreshControl,
  Platform, useColorScheme, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest, useAuth } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

// ─── Hostel Detail Modal ───────────────────────────────────────────────────────

function HostelDetailModal({ hostel, visible, onClose, theme, request }: {
  hostel: any; visible: boolean; onClose: () => void; theme: any; request: any;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const { data: students = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["hostel-students", hostel?.id],
    queryFn: () => request(`/students?hostelId=${hostel?.id}&limit=200`),
    enabled: visible && !!hostel?.id,
    staleTime: 30000,
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery<any[]>({
    queryKey: ["hostel-contacts-detail", hostel?.id],
    queryFn: () => request(`/hostel/contacts?hostelId=${hostel?.id}`),
    enabled: visible && !!hostel?.id,
    staleTime: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchContacts()]);
    setRefreshing(false);
  }, [refetch, refetchContacts]);

  if (!hostel) return null;

  const studentList = Array.isArray(students) ? students : (students as any).students || [];
  const roomCount = hostel.totalRooms || 0;
  const occupiedRooms = [...new Set(studentList.filter((s: any) => s.roomNumber).map((s: any) => s.roomNumber))].length;
  const availableRooms = roomCount > 0 ? Math.max(0, roomCount - occupiedRooms) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.detailModal, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.detailHeader, { borderBottomColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailTitle, { color: theme.text }]}>{hostel.name}</Text>
            {hostel.location ? <Text style={[styles.detailSub, { color: theme.textSecondary }]}>{hostel.location}</Text> : null}
          </View>
          <Pressable onPress={onClose} style={styles.closeX}>
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Info Cards */}
          <View style={styles.infoGrid}>
            {[
              { icon: "user", label: "Warden", value: hostel.wardenName || "—", color: theme.tint },
              { icon: "phone", label: "Phone", value: hostel.wardenPhone || "—", color: "#22c55e" },
            ].map(item => (
              <View key={item.label} style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.infoIcon, { backgroundColor: item.color + "20" }]}>
                  <Feather name={item.icon as any} size={16} color={item.color} />
                </View>
                <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <Text style={[styles.infoVal, { color: theme.text }]} numberOfLines={1}>{item.value}</Text>
              </View>
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
          <Text style={[styles.sectionLabel, { color: theme.text }]}>Students ({studentList.length})</Text>
          {isLoading ? (
            <><CardSkeleton /><CardSkeleton /></>
          ) : studentList.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Feather name="users" size={28} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students assigned</Text>
            </View>
          ) : (
            studentList.map((s: any) => (
              <View key={s.id} style={[styles.studentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.studentAvatar, { backgroundColor: theme.tint + "20" }]}>
                  <Text style={[styles.studentAvatarText, { color: theme.tint }]}>{(s.name || "?")[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studentName, { color: theme.text }]}>{s.name}</Text>
                  <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>
                    {s.rollNumber || s.email}{s.roomNumber ? ` · Room ${s.roomNumber}` : ""}
                  </Text>
                </View>
                {s.roomNumber && (
                  <View style={[styles.roomBadge, { backgroundColor: theme.tint + "15", borderColor: theme.tint + "40" }]}>
                    <Text style={[styles.roomBadgeText, { color: theme.tint }]}>{s.roomNumber}</Text>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Contacts */}
          {(contacts as any[]).length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.text, marginTop: 20 }]}>Contacts</Text>
              {(contacts as any[]).map((c: any) => (
                <View key={c.id} style={[styles.studentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={[styles.studentAvatar, { backgroundColor: "#22c55e20" }]}>
                    <Feather name="phone-call" size={16} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, { color: theme.text }]}>{c.name}</Text>
                    <Text style={[styles.studentMeta, { color: theme.textSecondary }]}>{c.role} · {c.phone}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
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
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

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

  const { data: hostels, isLoading, refetch } = useQuery({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
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

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const hostelList: any[] = Array.isArray(hostels) ? hostels : [];

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary row */}
        {hostelList.length > 0 && (
          <View style={[styles.summaryBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: theme.tint }]}>{hostelList.length}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Hostels</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: "#22c55e" }]}>
                {hostelList.reduce((s: number, h: any) => s + (h.totalRooms || 0), 0)}
              </Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Rooms</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNum, { color: "#f59e0b" }]}>Tap to view</Text>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Details</Text>
            </View>
          </View>
        )}

        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /></>
        ) : !hostelList.length ? (
          <View style={styles.emptyState}>
            <Feather name="home" size={40} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isSuperAdmin ? "No hostels yet. Tap + to add one." : "No hostels found."}
            </Text>
          </View>
        ) : (
          hostelList.map((h: any) => (
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
                {hostelList.map((h: any) => (
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
});
