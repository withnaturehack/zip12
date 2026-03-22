import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
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
import { Badge } from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ManageAdminsScreen() {
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
  const [role, setRole] = useState<"admin" | "superadmin">("admin");

  const { data: admins, isLoading, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => request("/admin/admin-users"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => request("/admin/admin-users", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowModal(false);
      setName(""); setEmail(""); setPassword("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => request(`/admin/admin-users/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e: any) => Alert.alert("Error", e.message),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: (isWeb ? 67 : insets.top) + 8, borderColor: theme.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Manage Admins</Text>
        <Pressable onPress={() => setShowModal(true)} style={[styles.addBtn, { backgroundColor: "#8B5CF6" }]}>
          <Feather name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: isWeb ? 34 : 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /></>
        ) : !admins?.length ? (
          <View style={styles.emptyState}>
            <Feather name="user-x" size={40} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No admins yet</Text>
          </View>
        ) : (
          admins.map((admin: any) => (
            <AnimatedCard key={admin.id} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: admin.role === "superadmin" ? "#8B5CF6" : theme.tint }]}>
                  <Text style={styles.avatarText}>{admin.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: theme.text }]}>{admin.name}</Text>
                  <Text style={[styles.email, { color: theme.textSecondary }]}>{admin.email}</Text>
                  <View style={{ marginTop: 6 }}>
                    <Badge label={admin.role === "superadmin" ? "Super Admin" : "Admin"} variant={admin.role === "superadmin" ? "purple" : "amber"} />
                  </View>
                </View>
                <Pressable
                  onPress={() =>
                    Alert.alert("Remove Admin", `Remove ${admin.name}?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Remove", style: "destructive", onPress: () => deleteMutation.mutate(admin.id) },
                    ])
                  }
                  style={styles.deleteBtn}
                >
                  <Feather name="trash-2" size={18} color={theme.error} />
                </Pressable>
              </View>
            </AnimatedCard>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Admin</Text>
            <Pressable onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Role</Text>
            <View style={styles.roleRow}>
              {(["admin", "superadmin"] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.rolePill, { backgroundColor: role === r ? "#8B5CF6" : theme.surface, borderColor: role === r ? "#8B5CF6" : theme.border }]}
                >
                  <Text style={[styles.rolePillText, { color: role === r ? "#fff" : theme.textSecondary }]}>
                    {r === "superadmin" ? "Super Admin" : "Admin"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {[
              { label: "Full Name", value: name, onChange: setName, placeholder: "Admin Name" },
              { label: "Email", value: email, onChange: setEmail, placeholder: "admin@iitm.ac.in", keyboard: "email-address" as const },
              { label: "Password", value: password, onChange: setPassword, placeholder: "••••••••", secure: true },
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

            <Pressable
              onPress={() => createMutation.mutate({ name, email, password, role })}
              style={[styles.submitBtn, { backgroundColor: "#8B5CF6" }]}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Admin</Text>}
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
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  name: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  email: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  deleteBtn: { padding: 8 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 20, gap: 4 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  roleRow: { flexDirection: "row", gap: 10 },
  rolePill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  rolePillText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  submitBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  submitText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
