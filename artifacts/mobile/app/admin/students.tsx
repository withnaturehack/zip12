import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useApiRequest } from "@/context/AuthContext";
import { AnimatedCard } from "@/components/ui/AnimatedCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Badge } from "@/components/ui/Badge";

export default function StudentsAdminScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const request = useApiRequest();
  const queryClient = useQueryClient();
  const isWeb = Platform.OS === "web";

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");

  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: () => request("/students"),
  });

  const { data: hostels } = useQuery({
    queryKey: ["hostels"],
    queryFn: () => request("/hostels"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => request("/students", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setShowModal(false);
      setName(""); setEmail(""); setPassword(""); setRollNumber(""); setHostelId(""); setRoomNumber("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const handleCreate = () => {
    if (!name || !email || !password || !rollNumber) {
      Alert.alert("Error", "Name, email, password, and roll number are required");
      return;
    }
    createMutation.mutate({ name, email, password, rollNumber, hostelId: hostelId || undefined, roomNumber: roomNumber || undefined });
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  const hostelName = (id: string) => hostels?.find((h: any) => h.id === id)?.name || "—";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: (isWeb ? 67 : insets.top) + 8, borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Students ({students?.length || 0})</Text>
        <Pressable onPress={() => setShowModal(true)} style={[styles.addBtn, { backgroundColor: theme.tint }]}>
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: isWeb ? 34 : 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : !students?.length ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={40} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No students yet</Text>
          </View>
        ) : (
          students.map((s: any) => (
            <AnimatedCard key={s.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                  <Text style={styles.avatarText}>{s.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studentName, { color: theme.text }]}>{s.name}</Text>
                  <Text style={[styles.studentEmail, { color: theme.textSecondary }]}>{s.email}</Text>
                  <View style={styles.meta}>
                    <Badge label={s.rollNumber} variant="gray" />
                    {s.hostelId && <Badge label={hostelName(s.hostelId)} variant="blue" />}
                    {s.roomNumber && <Text style={[styles.room, { color: theme.textTertiary }]}>Rm. {s.roomNumber}</Text>}
                  </View>
                </View>
              </View>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      {/* Add Student Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Student</Text>
            <Pressable onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            {[
              { label: "Full Name *", value: name, onChange: setName, placeholder: "Arjun Kumar" },
              { label: "Email *", value: email, onChange: setEmail, placeholder: "arjun@iitm.ac.in", keyboard: "email-address" as const },
              { label: "Password *", value: password, onChange: setPassword, placeholder: "••••••••", secure: true },
              { label: "Roll Number *", value: rollNumber, onChange: setRollNumber, placeholder: "21f3000001" },
              { label: "Hostel ID", value: hostelId, onChange: setHostelId, placeholder: "(optional)" },
              { label: "Room Number", value: roomNumber, onChange: setRoomNumber, placeholder: "(optional)" },
            ].map((f) => (
              <View key={f.label}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={theme.textTertiary}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard}
                  secureTextEntry={f.secure}
                  autoCapitalize="none"
                />
              </View>
            ))}
            {hostels?.length > 0 && (
              <Text style={[styles.hostelHint, { color: theme.textTertiary }]}>
                Available Hostels: {hostels.map((h: any) => `${h.name} (${h.id})`).join(", ")}
              </Text>
            )}
            <Pressable onPress={handleCreate} style={[styles.submitBtn, { backgroundColor: theme.tint }]} disabled={createMutation.isPending}>
              {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Add Student</Text>}
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
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  card: { marginBottom: 10 },
  cardRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  studentEmail: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  meta: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" },
  room: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  hostelHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8 },
  submitBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
