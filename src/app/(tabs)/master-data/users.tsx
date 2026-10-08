import { Modal, ScrollView, TextInput } from "../../../components/inputs/KeyboardAware";
import BackButton from "../../../components/navigation/BackButton";
import BrandPill from "../../../components/navigation/BrandPill";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useIsFocused } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../../../lib/supabase";
import { returnToRoute, useHardwareBack } from "../../../lib/back-navigation";
import { colors, radius, spacing, typography } from "../../../theme";

type UserRole =
  | "user"
  | "ceo_admin"
  | "advisor"
  | "floor_incharge"
  | "supervisor"
  | "worker_group"
  | "billing_department"
  | "billing_executive"
  | "watchman"
  | "store_team"
  | "final_inspector";
type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type Filter = "All" | "Active" | "Inactive";
type RoleEditor = { kind: "role"; user: UserProfile };
type Dialog =
  | RoleEditor
  | { kind: "discard"; editor: RoleEditor }
  | { kind: "roleConfirm"; editor: RoleEditor }
  | { kind: "status"; user: UserProfile }
  | { kind: "roleFilter" }
  | { kind: "notice"; title: string; body: string };
const ROLES: { value: UserRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "ceo_admin", label: "CEO / Admin" },
  { value: "advisor", label: "Advisor" },
  { value: "floor_incharge", label: "Floor Incharge" },
  { value: "supervisor", label: "Supervisor" },
  { value: "worker_group", label: "Worker Group" },
  { value: "billing_executive", label: "Billing Executive" },
  { value: "billing_department", label: "Billing Department" },
  { value: "watchman", label: "Watchman" },
  { value: "store_team", label: "Store Team" },
  { value: "final_inspector", label: "Final Inspector" },
];
const roleLabel = (role: string) =>
  ROLES.find((item) => item.value === role)?.label || role.replaceAll("_", " ");
const normal = (value: string) => value.trim().toLowerCase();
const PAGE_SIZE = 25;
function message(error: unknown) {
  return (
    (error as { message?: string })?.message ||
    "Unable to complete the request. Refresh and try again."
  );
}
function validUsers(value: unknown): value is UserProfile[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.role === "string" &&
        typeof item.is_active === "boolean",
    )
  );
}

export default function UsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [actorId, setActorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(false);
  const requests = useRef(0);
  const disabled = saving || loading || refreshing;
  const focused = useIsFocused();

  const loadUsers = useCallback(async (refresh = false) => {
    if (busy.current) return;
    const request = ++requests.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setLoadError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sign in again to view users.");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", auth.user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.is_active || profile.role !== "ceo_admin")
        throw new Error(
          "An active CEO Admin account is required to manage users.",
        );
      const collected = new Map<string, UserProfile>();
      // Range the existing table-returning RPC without changing its contract.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .rpc("get_admin_users")
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw error;
        if (!validUsers(data))
          throw new Error("The user directory returned an invalid response.");
        if (!mounted.current || request !== requests.current) return;
        data.forEach((user) => collected.set(user.id, user));
        if (data.length < 500) break;
      }
      if (mounted.current && request === requests.current) {
        setActorId(auth.user.id);
        setUsers([...collected.values()]);
      }
    } catch (error) {
      if (mounted.current && request === requests.current) {
        setLoadError(message(error));
        setUsers([]);
        setActorId("");
      }
    } finally {
      if (mounted.current && request === requests.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      if (!busy.current) setSaving(false);
      void loadUsers();
      return () => {
        mounted.current = false;
        requests.current += 1;
      };
    }, [loadUsers]),
  );

  const closeDialog = useCallback(() => {
    if (busy.current) return;
    if (dialog?.kind === "role" && selectedRole !== dialog.user.role) {
      setDialog({ kind: "discard", editor: dialog });
      return;
    }
    if (dialog?.kind === "discard" || dialog?.kind === "roleConfirm")
      setDialog(dialog.editor);
    else setDialog(null);
    setFormError("");
  }, [dialog, selectedRole]);
  const handleBack = useCallback(() => {
    if (busy.current) return;
    if (dialog) closeDialog();
    else returnToRoute("/(tabs)/master-data");
  }, [dialog, closeDialog]);
  useHardwareBack(handleBack);
  usePreventRemove(focused && (saving || dialog !== null), closeDialog);

  const openRole = (user: UserProfile) => {
    if (disabled || busy.current || !actorId || user.id === actorId) return;
    setSelectedRole(user.role);
    setFormError("");
    setDialog({ kind: "role", user });
  };
  const changeUser = async () => {
    if (
      disabled ||
      busy.current ||
      !actorId ||
      (dialog?.kind !== "roleConfirm" && dialog?.kind !== "status")
    )
      return;
    const target = dialog.kind === "status" ? dialog.user : dialog.editor.user;
    const changingRole = dialog.kind === "roleConfirm";
    if (target.id === actorId) {
      setFormError(
        "Use another active CEO Admin account to change your own access.",
      );
      return;
    }
    if (changingRole && !ROLES.some((item) => item.value === selectedRole)) {
      setFormError("Select a supported role.");
      return;
    }
    if (changingRole && selectedRole === target.role) {
      setDialog(null);
      return;
    }
    busy.current = true;
    setSaving(true);
    setFormError("");
    let applied = false;
    try {
      // Re-read through the authorized RPC before changing another user's access.
      const { data: before, error: beforeError } = await supabase
        .rpc("get_admin_users")
        .eq("id", target.id);
      if (beforeError) throw beforeError;
      if (
        !validUsers(before) ||
        before.length !== 1 ||
        before[0].updated_at !== target.updated_at ||
        before[0].role !== target.role ||
        before[0].is_active !== target.is_active
      )
        throw new Error(
          "This user changed since the dialog opened. Close it, refresh and review their current access.",
        );
      const { error } = changingRole
        ? await supabase.rpc("change_user_role", {
            target_user_id: target.id,
            new_role: selectedRole,
          })
        : await supabase.rpc("change_user_status", {
            target_user_id: target.id,
            new_status: !target.is_active,
          });
      if (error) throw error;
      applied = true;
      // Both mutation RPCs return void. Confirm the actual row instead of inventing a timestamp.
      const { data: after, error: afterError } = await supabase
        .rpc("get_admin_users")
        .eq("id", target.id);
      if (afterError) throw afterError;
      if (
        !validUsers(after) ||
        after.length !== 1 ||
        (changingRole
          ? after[0].role !== selectedRole
          : after[0].is_active !== !target.is_active)
      )
        throw new Error("The updated access could not be confirmed.");
      if (mounted.current) {
        setUsers((current) =>
          current.map((user) => (user.id === target.id ? after[0] : user)),
        );
        setDialog({
          kind: "notice",
          title: changingRole
            ? "Role updated"
            : after[0].is_active
              ? "User activated"
              : "User deactivated",
          body: `${target.name || target.email || "User"}: ${roleLabel(after[0].role)} · ${after[0].is_active ? "Active" : "Inactive"}. Existing work assignments have not been reassigned by this screen.`,
        });
      }
    } catch (error) {
      if (mounted.current) {
        if (applied)
          setDialog({
            kind: "notice",
            title: "Change sent — refresh required",
            body: `The change was accepted, but its current result could not be verified. Refresh the directory before trying again. ${message(error)}`,
          });
        else setFormError(message(error));
      }
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const counts = useMemo(
    () => ({
      All: users.length,
      Active: users.filter((user) => user.is_active).length,
      Inactive: users.filter((user) => !user.is_active).length,
    }),
    [users],
  );
  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const query = normal(search);
        const matches =
          !query ||
          [user.name, user.email, user.phone, roleLabel(user.role)].some(
            (value) =>
              typeof value === "string" && normal(value).includes(query),
          );
        return (
          matches &&
          (filter === "All" ||
            (filter === "Active" ? user.is_active : !user.is_active)) &&
          (roleFilter === "all" || user.role === roleFilter)
        );
      }),
    [users, search, filter, roleFilter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const resetFilters = () => {
    setSearch("");
    setFilter("All");
    setRoleFilter("all");
    setPage(1);
  };
  const roleChoices = [
    ...ROLES,
    ...[...new Set(users.map((user) => user.role))]
      .filter((role) => !ROLES.some((item) => item.value === role))
      .map((value) => ({ value, label: roleLabel(value) })),
  ];

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.topBar}>
        <BackButton accessibilityLabel="Back to Master Data" disabled={saving} onPress={handleBack} />
        <BrandPill />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadUsers(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>MASTER DATA · PEOPLE & ACCESS</Text>
          <Text accessibilityRole="header" style={styles.heroTitle}>
            Users
          </Text>
          <Text style={styles.heroText}>
            Manage workshop roles and account access.
          </Text>
        </View>
        {loading && (
          <View style={styles.inline}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.body}>Loading users…</Text>
          </View>
        )}
        {!!loadError && (
          <View style={styles.card}>
            <Text style={styles.title}>User directory unavailable</Text>
            <Text style={styles.body}>{loadError}</Text>
            <Button
              title="Try again"
              disabled={disabled}
              onPress={() => void loadUsers()}
            />
          </View>
        )}
        {!loading && !loadError && (
          <>
            <View style={styles.metrics}>
              {(["All", "Active", "Inactive"] as Filter[]).map((key) => (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: filter === key }}
                  accessibilityLabel={`${key}: ${counts[key]} users`}
                  onPress={() => {
                    setFilter(key);
                    setPage(1);
                  }}
                  style={[
                    styles.metric,
                    filter === key && styles.metricSelected,
                  ]}
                >
                  <Text style={styles.metricCount}>{counts[key]}</Text>
                  <Text style={styles.body}>
                    {key === "All" ? "Total" : key}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.card}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  accessibilityLabel="Search users"
                  value={search}
                  onChangeText={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search name, email, phone or role"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.searchInput}
                />
                {!!search && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    style={styles.iconButton}
                    onPress={() => {
                      setSearch("");
                      setPage(1);
                    }}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={22}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
              <Button
                secondary
                icon="filter-outline"
                title={
                  roleFilter === "all" ? "All roles" : roleLabel(roleFilter)
                }
                onPress={() => setDialog({ kind: "roleFilter" })}
                disabled={disabled}
              />
              <Text style={styles.body}>
                {filtered.length
                  ? `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} users`
                  : "No users match these filters"}
              </Text>
            </View>
            {!visible.length && (
              <View style={styles.empty}>
                <Ionicons
                  name="people-outline"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.title}>
                  {users.length ? "No matching users" : "No users found"}
                </Text>
                <Text style={styles.body}>
                  Try another search or clear the filters.
                </Text>
                <Button
                  secondary
                  title="Clear search & filters"
                  onPress={resetFilters}
                />
              </View>
            )}
            {visible.map((user) => (
              <View key={user.id} style={styles.card}>
                <View style={styles.modelHeading}>
                  <View style={styles.modelIcon}>
                    <Ionicons
                      name="person-outline"
                      size={24}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.title}>
                      {user.name || "Name not recorded"}
                      {user.id === actorId ? " · You" : ""}
                    </Text>
                    <Text selectable style={styles.body}>
                      {user.email || "Email not recorded"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      user.is_active
                        ? styles.activeBadge
                        : styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: user.is_active
                            ? "#217A50"
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.label}>{roleLabel(user.role)}</Text>
                <Text selectable style={styles.body}>
                  Phone: {user.phone || "Not recorded"}
                </Text>
                <View style={styles.actions}>
                  <Button
                    secondary
                    icon="shield-checkmark-outline"
                    title="Change role"
                    disabled={disabled || user.id === actorId}
                    onPress={() => openRole(user)}
                  />
                  <Button
                    secondary
                    icon="power-outline"
                    title={user.is_active ? "Deactivate" : "Activate"}
                    disabled={disabled || user.id === actorId}
                    onPress={() => {
                      if (busy.current) return;
                      setFormError("");
                      setDialog({ kind: "status", user });
                    }}
                  />
                </View>
                {user.id === actorId && (
                  <Text style={styles.hint}>
                    Another active CEO Admin can change your own access.
                  </Text>
                )}
              </View>
            ))}
            {pages > 1 && (
              <View style={styles.heading}>
                <Button
                  secondary
                  title="Previous"
                  disabled={disabled || currentPage === 1}
                  onPress={() => setPage(currentPage - 1)}
                />
                <Text style={styles.body}>
                  Page {currentPage} of {pages}
                </Text>
                <Button
                  secondary
                  title="Next"
                  disabled={disabled || currentPage === pages}
                  onPress={() => setPage(currentPage + 1)}
                />
              </View>
            )}
            <View style={styles.note}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text style={[styles.body, styles.grow]}>
                Review pending work before changing access. Role changes and
                deactivation do not transfer existing vehicle assignments.
                Billing Executive and Billing Department are separate roles.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <SafeAreaView
          style={styles.overlay}
          edges={["top", "bottom", "left", "right"]}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="always"
          >
            <View style={styles.dialog}>
              {dialog?.kind === "role" && (
                <>
                  <Text style={styles.title}>Change user role</Text>
                  <Text style={styles.body}>
                    {dialog.user.name || dialog.user.email || "User"} · Current:{" "}
                    {roleLabel(dialog.user.role)}
                  </Text>
                  {ROLES.map((role) => (
                    <Pressable
                      key={role.value}
                      accessibilityRole="radio"
                      accessibilityState={{
                        checked: selectedRole === role.value,
                        disabled: saving,
                      }}
                      disabled={saving}
                      onPress={() => {
                        setSelectedRole(role.value);
                        setFormError("");
                      }}
                      style={[
                        styles.option,
                        selectedRole === role.value && styles.optionSelected,
                      ]}
                    >
                      <Ionicons
                        name={
                          selectedRole === role.value
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={20}
                        color={colors.primaryDark}
                      />
                      <Text style={styles.optionText}>{role.label}</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.hint}>
                    Billing Executive opens the executive billing workflow.
                    Billing Department is a separate department role.
                  </Text>
                  <View style={styles.actions}>
                    <Button
                      secondary
                      title="Cancel"
                      onPress={closeDialog}
                      disabled={saving}
                    />
                    <Button
                      title="Review change"
                      disabled={
                        disabled ||
                        selectedRole === dialog.user.role ||
                        !ROLES.some((role) => role.value === selectedRole)
                      }
                      onPress={() =>
                        setDialog({ kind: "roleConfirm", editor: dialog })
                      }
                    />
                  </View>
                </>
              )}
              {dialog?.kind === "roleConfirm" && (
                <>
                  <Text style={styles.title}>Confirm role change</Text>
                  <Text style={styles.body}>
                    {dialog.editor.user.name ||
                      dialog.editor.user.email ||
                      "User"}
                    : {roleLabel(dialog.editor.user.role)} →{" "}
                    {roleLabel(selectedRole)}
                  </Text>
                  <Text style={styles.body}>
                    This changes their available screens and permissions.
                    Existing vehicle assignments will not be transferred.
                  </Text>
                  <Button
                    title={saving ? "Saving…" : "Confirm role change"}
                    disabled={disabled}
                    busy={saving}
                    onPress={() => void changeUser()}
                  />
                  <BackButton disabled={saving} onPress={closeDialog} accessibilityLabel="Back to roles" />
                </>
              )}
              {dialog?.kind === "status" && (
                <>
                  <Text style={styles.title}>
                    {dialog.user.is_active ? "Deactivate" : "Activate"} user?
                  </Text>
                  <Text style={styles.label}>
                    {dialog.user.name || dialog.user.email || "User"}
                  </Text>
                  <Text style={styles.body}>
                    {dialog.user.is_active
                      ? "This account will be marked inactive. Review and reassign pending work separately. The user and their work history will not be deleted."
                      : "This account will be marked active with its current role and permissions."}
                  </Text>
                  <Button
                    title={
                      saving
                        ? "Updating…"
                        : dialog.user.is_active
                          ? "Deactivate user"
                          : "Activate user"
                    }
                    busy={saving}
                    disabled={disabled}
                    onPress={() => void changeUser()}
                  />
                  <Button
                    secondary
                    title="Cancel"
                    disabled={saving}
                    onPress={closeDialog}
                  />
                </>
              )}
              {dialog?.kind === "roleFilter" && (
                <>
                  <Text style={styles.title}>Filter by role</Text>
                  {[{ value: "all", label: "All roles" }, ...roleChoices].map(
                    (role) => (
                      <Pressable
                        key={role.value}
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: roleFilter === role.value,
                        }}
                        onPress={() => {
                          setRoleFilter(role.value);
                          setPage(1);
                          setDialog(null);
                        }}
                        style={[
                          styles.option,
                          roleFilter === role.value && styles.optionSelected,
                        ]}
                      >
                        <Text style={styles.optionText}>
                          {role.label} ·{" "}
                          {role.value === "all"
                            ? users.length
                            : users.filter((user) => user.role === role.value)
                                .length}
                        </Text>
                      </Pressable>
                    ),
                  )}
                  <Button secondary title="Close" onPress={closeDialog} />
                </>
              )}
              {dialog?.kind === "discard" && (
                <>
                  <Text style={styles.title}>Discard role selection?</Text>
                  <Text style={styles.body}>
                    The selected role has not been saved.
                  </Text>
                  <Button
                    title="Keep reviewing"
                    onPress={() => setDialog(dialog.editor)}
                  />
                  <Button
                    secondary
                    title="Discard selection"
                    onPress={() => {
                      setDialog(null);
                      setFormError("");
                    }}
                  />
                </>
              )}
              {dialog?.kind === "notice" && (
                <>
                  <Ionicons
                    name="information-circle-outline"
                    size={30}
                    color={colors.primary}
                  />
                  <Text style={styles.title}>{dialog.title}</Text>
                  <Text style={styles.body}>{dialog.body}</Text>
                  <Button title="OK" onPress={closeDialog} />
                </>
              )}
              {!!formError && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {formError}
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={secondary ? colors.primaryDark : colors.white}
        />
      ) : (
        icon && (
          <Ionicons
            name={icon}
            size={18}
            color={secondary ? colors.primaryDark : colors.white}
          />
        )
      )}
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.xs,
  },
  back: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: spacing.sm,
  },
  backText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  brandText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.text,
  },
  content: {
    width: "100%",
    maxWidth: 860,
    alignSelf: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: "800",
    color: colors.white,
  },
  heroTitle: { ...typography.title, fontSize: 27, color: colors.white },
  heroText: { ...typography.caption, color: colors.white, lineHeight: 21 },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  grow: { flex: 1, minWidth: 0 },
  title: { ...typography.subheading, color: colors.text },
  body: { ...typography.caption, lineHeight: 20, color: colors.textSecondary },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metric: {
    flex: 1,
    minWidth: 88,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  metricSelected: { borderColor: colors.primary },
  metricCount: { fontSize: 25, fontWeight: "800", color: colors.text },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingLeft: spacing.md,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: 14,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  modelHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  modelIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm },
  activeBadge: { backgroundColor: "#E8F5EE" },
  inactiveBadge: { backgroundColor: colors.background },
  badgeText: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  button: {
    minHeight: 48,
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.button,
    color: colors.white,
    textAlign: "center",
    flexShrink: 1,
  },
  secondaryButton: { backgroundColor: colors.primaryLight },
  secondaryText: { color: colors.primaryDark },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)" },
  modalFrame: { flex: 1 },
  modalScroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  dialog: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  label: { ...typography.bodyMedium, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  hint: { ...typography.caption, color: colors.textSecondary, lineHeight: 19 },
  option: {
    flex: 1,
    minHeight: 48,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  optionText: { ...typography.bodyMedium, color: colors.primaryDark },
  error: { ...typography.caption, color: colors.error, lineHeight: 20 },
  modelPreview: {
    ...typography.bodyMedium,
    color: colors.text,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
});
