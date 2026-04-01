import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, useColorScheme, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type Tab = "login" | "register";

export default function AuthScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();

  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regRoll, setRegRoll] = useState("");

  const switchTab = (t: Tab) => {
    Haptics.selectionAsync();
    setTab(t);
    setPendingMessage(null);
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) {
      Alert.alert("Missing Fields", "Please fill in email and password");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await login(loginEmail.trim(), loginPass);
    } catch (e: any) {
      Alert.alert("Login Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!regName || !regEmail || !regPass || !regRoll) {
      Alert.alert("Missing Fields", "Please fill in all fields");
      return;
    }
    if (regPass.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const msg = await register(regName.trim(), regEmail.trim(), regPass, regRoll.trim());
      // Registration succeeded but user is pending
      setPendingMessage(msg || "Your account is pending approval. Contact the Super Admin.");
      setRegName(""); setRegEmail(""); setRegPass(""); setRegRoll("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert("Registration Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border, color: theme.text }];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
            <Feather name="cpu" size={32} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>CampusOps</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>IIT Madras Hostel Management</Text>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {(["login", "register"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: theme.tint }]}
              onPress={() => switchTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? "#fff" : theme.textSecondary }]}>
                {t === "login" ? "Sign In" : "Register"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Pending approval banner */}
        {pendingMessage && (
          <View style={[styles.pendingBanner, { backgroundColor: "#f59e0b15", borderColor: "#f59e0b50" }]}>
            <Feather name="clock" size={18} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pendingTitle, { color: "#f59e0b" }]}>Registration Submitted</Text>
              <Text style={[styles.pendingBody, { color: theme.textSecondary }]}>{pendingMessage}</Text>
            </View>
          </View>
        )}

        {/* Login Form */}
        {tab === "login" && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
            <TextInput
              style={inputStyle}
              placeholder="your@iitm.ac.in"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
              onSubmitEditing={handleLogin}
              returnKeyType="next"
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
            <View style={[styles.passWrap, { borderColor: theme.border, backgroundColor: theme.surfaceSecondary }]}>
              <TextInput
                style={[inputStyle, { flex: 1, borderWidth: 0, backgroundColor: "transparent" }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPass}
                value={loginPass}
                onChangeText={setLoginPass}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Feather name={showPass ? "eye-off" : "eye"} size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.tint }, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign In</Text>}
            </Pressable>

            <View style={[styles.demoBox, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={[styles.demoTitle, { color: theme.textSecondary }]}>Demo Accounts (password: 123456)</Text>
              {[
                { label: "Student", email: "student@iitm.ac.in" },
                { label: "Volunteer", email: "volunteer@iitm.ac.in" },
                { label: "Admin", email: "admin@iitm.ac.in" },
                { label: "Super Admin", email: "superadmin@iitm.ac.in" },
              ].map(({ label, email }) => (
                <Pressable key={email} onPress={() => { setLoginEmail(email); setLoginPass("123456"); }} style={styles.demoRow}>
                  <View style={[styles.demoRoleBadge, { backgroundColor: theme.tint + "20" }]}>
                    <Text style={[styles.demoRoleText, { color: theme.tint }]}>{label}</Text>
                  </View>
                  <Text style={[styles.demoText, { color: theme.textTertiary }]}>{email}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Register Form */}
        {tab === "register" && !pendingMessage && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
            <TextInput
              style={inputStyle}
              placeholder="Arjun Kumar"
              placeholderTextColor={theme.textTertiary}
              value={regName}
              onChangeText={setRegName}
              returnKeyType="next"
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
            <TextInput
              style={inputStyle}
              placeholder="your@iitm.ac.in"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={regEmail}
              onChangeText={setRegEmail}
              returnKeyType="next"
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Roll Number</Text>
            <TextInput
              style={inputStyle}
              placeholder="21f3000001"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              value={regRoll}
              onChangeText={setRegRoll}
              returnKeyType="next"
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
            <TextInput
              style={inputStyle}
              placeholder="Min. 6 characters"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry
              value={regPass}
              onChangeText={setRegPass}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <View style={[styles.infoBox, { backgroundColor: "#3b82f615", borderColor: "#3b82f640" }]}>
              <Feather name="info" size={14} color="#3b82f6" />
              <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                Your account will require Super Admin approval before you can log in. You will be assigned a role (Student/Volunteer/Admin) and hostel.
              </Text>
            </View>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: theme.tint }, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Registration</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  appName: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  tabRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 24 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  form: { gap: 4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 12, marginBottom: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  passWrap: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, overflow: "hidden", paddingLeft: 14 },
  eyeBtn: { padding: 13 },
  primaryBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  btnDisabled: { opacity: 0.65 },
  demoBox: { marginTop: 20, padding: 14, borderRadius: 12, gap: 6 },
  demoTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  demoRoleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  demoRoleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  demoText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  pendingBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  pendingTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  pendingBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
