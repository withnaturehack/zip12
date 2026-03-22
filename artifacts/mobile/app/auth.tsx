import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  useColorScheme,
  Alert,
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

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regRoll, setRegRoll] = useState("");

  const tabAnim = useRef(new Animated.Value(0)).current;

  const switchTab = (t: Tab) => {
    Haptics.selectionAsync();
    setTab(t);
    Animated.spring(tabAnim, {
      toValue: t === "login" ? 0 : 1,
      useNativeDriver: true,
      tension: 200,
      friction: 20,
    }).start();
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPass) {
      Alert.alert("Error", "Please fill all fields");
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
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      await register(regName.trim(), regEmail.trim(), regPass, regRoll.trim());
    } catch (e: any) {
      Alert.alert("Registration Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.surfaceSecondary,
      borderColor: theme.border,
      color: theme.text,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
            <Feather name="cpu" size={32} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: theme.text }]}>CampusOps</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            IIT Madras BS Student Portal
          </Text>
        </View>

        {/* Tabs */}
        <View
          style={[
            styles.tabRow,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {(["login", "register"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[
                styles.tabBtn,
                tab === t && { backgroundColor: theme.tint },
              ]}
              onPress={() => switchTab(t)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === t ? "#fff" : theme.textSecondary },
                ]}
              >
                {t === "login" ? "Sign In" : "Register"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Login Form */}
        {tab === "login" && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Email
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="your@email.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={loginEmail}
              onChangeText={setLoginEmail}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Password
            </Text>
            <View style={styles.passWrap}>
              <TextInput
                style={[inputStyle, { flex: 1, borderWidth: 0 }]}
                placeholder="••••••••"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPass}
                value={loginPass}
                onChangeText={setLoginPass}
              />
              <Pressable
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeBtn}
              >
                <Feather
                  name={showPass ? "eye-off" : "eye"}
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.tint },
                loading && styles.btnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </Pressable>

            <View style={styles.demoBox}>
              <Text style={[styles.demoTitle, { color: theme.textSecondary }]}>
                Demo Accounts (all: 123456)
              </Text>
              <Text style={[styles.demoText, { color: theme.textTertiary }]}>Student: student@iitm.ac.in</Text>
              <Text style={[styles.demoText, { color: theme.textTertiary }]}>Volunteer: volunteer@iitm.ac.in</Text>
              <Text style={[styles.demoText, { color: theme.textTertiary }]}>Admin: admin@iitm.ac.in</Text>
              <Text style={[styles.demoText, { color: theme.textTertiary }]}>Super Admin: superadmin@iitm.ac.in</Text>
            </View>
          </View>
        )}

        {/* Register Form */}
        {tab === "register" && (
          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Full Name
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="Arjun Kumar"
              placeholderTextColor={theme.textTertiary}
              value={regName}
              onChangeText={setRegName}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Email
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="your@email.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={regEmail}
              onChangeText={setRegEmail}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Roll Number
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="21f3000001"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              value={regRoll}
              onChangeText={setRegRoll}
            />
            <Text style={[styles.label, { color: theme.textSecondary }]}>
              Password
            </Text>
            <TextInput
              style={inputStyle}
              placeholder="••••••••"
              placeholderTextColor={theme.textTertiary}
              secureTextEntry
              value={regPass}
              onChangeText={setRegPass}
            />
            <Pressable
              style={[
                styles.primaryBtn,
                { backgroundColor: theme.tint },
                loading && styles.btnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
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
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 24,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  form: { gap: 4 },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    paddingLeft: 14,
  },
  eyeBtn: {
    padding: 12,
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  btnDisabled: { opacity: 0.7 },
  demoBox: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(30,111,217,0.08)",
    gap: 3,
  },
  demoTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  demoText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
