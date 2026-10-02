import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../../lib/supabase";
import { colors, radius, spacing, typography } from "../../../theme";

type UserRole =
  | "user"
  | "ceo_admin"
  | "advisor"
  | "floor_incharge"
  | "supervisor"
  | "worker_group"
  | "billing_department"
  | "watchman"
  | "store_team"
  | "final_inspector";

type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | UserRole;

const USERS_PER_PAGE = 25;

const ROLES: { value: UserRole; label: string }[] = [
  { value: "user", label: "User" },
  { value: "ceo_admin", label: "CEO / Admin" },
  { value: "advisor", label: "Advisor" },
  { value: "floor_incharge", label: "Floor Incharge" },
  { value: "supervisor", label: "Supervisor" },
  { value: "worker_group", label: "Worker Group" },
  { value: "billing_department", label: "Billing Department" },
  { value: "watchman", label: "Watchman" },
  { value: "store_team", label: "Store Team" },
  { value: "final_inspector", label: "Final Inspector" },
];

export default function UsersScreen() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [currentPage, setCurrentPage] = useState(1);

  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleFilterModalVisible, setRoleFilterModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [messageModalVisible, setMessageModalVisible] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>("user");

  const [messageTitle, setMessageTitle] = useState("");
  const [messageText, setMessageText] = useState("");

  const [savingRole, setSavingRole] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const showMessage = useCallback((title: string, message: string) => {
    setMessageTitle(title);
    setMessageText(message);
    setMessageModalVisible(true);
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_admin_users");

      if (error) {
        throw error;
      }

      setUsers((data ?? []) as UserProfile[]);
    } catch (error: any) {
      console.error("Error loading users:", error);

      showMessage(
        "Unable to Load Users",
        error?.message || "Something went wrong while loading users.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showMessage]);

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [loadUsers]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers();
  }, [loadUsers]);

  const getRoleLabel = (role: UserRole) => {
    return ROLES.find((item) => item.value === role)?.label ?? role;
  };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.is_active) ||
        (statusFilter === "inactive" && !user.is_active);

      if (!matchesStatus) {
        return false;
      }

      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      if (!matchesRole) {
        return false;
      }

      if (!query) {
        return true;
      }

      const roleLabel = getRoleLabel(user.role).toLowerCase();

      return (
        (user.name ?? "").toLowerCase().includes(query) ||
        (user.email ?? "").toLowerCase().includes(query) ||
        (user.phone ?? "").toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query) ||
        roleLabel.includes(query)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * USERS_PER_PAGE;

    return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);

  const pageStart =
    filteredUsers.length === 0 ? 0 : (safeCurrentPage - 1) * USERS_PER_PAGE + 1;

  const pageEnd =
    filteredUsers.length === 0
      ? 0
      : Math.min(safeCurrentPage * USERS_PER_PAGE, filteredUsers.length);

  const totalUsers = users.length;

  const activeUsers = useMemo(
    () => users.filter((user) => user.is_active).length,
    [users],
  );

  const inactiveUsers = totalUsers - activeUsers;

  const resetToFirstPage = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRoleFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search.trim().length > 0 || statusFilter !== "all" || roleFilter !== "all";

  const openRoleModal = (user: UserProfile) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleModalVisible(true);
  };

  const changeRole = async () => {
    if (!selectedUser) {
      return;
    }

    if (selectedRole === selectedUser.role) {
      setRoleModalVisible(false);
      return;
    }

    setSavingRole(true);

    try {
      const { error } = await supabase.rpc("change_user_role", {
        target_user_id: selectedUser.id,
        new_role: selectedRole,
      });

      if (error) {
        throw error;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === selectedUser.id
            ? {
                ...user,
                role: selectedRole,
                updated_at: new Date().toISOString(),
              }
            : user,
        ),
      );

      setRoleModalVisible(false);

      showMessage(
        "Role Updated",
        `${selectedUser.name || "User"} is now ${getRoleLabel(selectedRole)}.`,
      );
    } catch (error: any) {
      console.error("Error changing role:", error);

      showMessage(
        "Unable to Change Role",
        error?.message || "Something went wrong while changing the role.",
      );
    } finally {
      setSavingRole(false);
    }
  };

  const openStatusModal = (user: UserProfile) => {
    setSelectedUser(user);
    setStatusModalVisible(true);
  };

  const changeStatus = async () => {
    if (!selectedUser) {
      return;
    }

    const newStatus = !selectedUser.is_active;

    setSavingStatus(true);

    try {
      const { error } = await supabase.rpc("change_user_status", {
        target_user_id: selectedUser.id,
        new_status: newStatus,
      });

      if (error) {
        throw error;
      }

      setUsers((currentUsers) =>
        currentUsers.map((user) =>
          user.id === selectedUser.id
            ? {
                ...user,
                is_active: newStatus,
                updated_at: new Date().toISOString(),
              }
            : user,
        ),
      );

      setStatusModalVisible(false);

      showMessage(
        newStatus ? "User Activated" : "User Deactivated",
        `${selectedUser.name || "User"} has been ${
          newStatus ? "activated" : "deactivated"
        }.`,
      );
    } catch (error: any) {
      console.error("Error changing user status:", error);

      showMessage(
        "Unable to Change Status",
        error?.message ||
          "Something went wrong while changing the user status.",
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const renderSummaryCard = (
    title: string,
    value: number,
    icon: keyof typeof Ionicons.glyphMap,
    iconBackground: string,
  ) => {
    return (
      <View style={styles.summaryCard}>
        <View
          style={[
            styles.summaryIcon,
            {
              backgroundColor: iconBackground,
            },
          ]}
        >
          <Ionicons name={icon} size={19} color={colors.text} />
        </View>

        <View style={styles.summaryTextContainer}>
          <Text style={styles.summaryValue}>{value}</Text>

          <Text style={styles.summaryTitle}>{title}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)/master-data")}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Users</Text>

            <Text style={styles.headerSubtitle}>
              Manage roles and account access
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.content}
        >
          {/* Compact Statistics */}
          <View style={styles.summaryRow}>
            {renderSummaryCard(
              "Total",
              totalUsers,
              "people-outline",
              colors.primaryLight,
            )}

            {renderSummaryCard(
              "Active",
              activeUsers,
              "checkmark-circle-outline",
              colors.successLight,
            )}

            {renderSummaryCard(
              "Inactive",
              inactiveUsers,
              "close-circle-outline",
              colors.dangerLight,
            )}
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textLight}
            />

            <TextInput
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                resetToFirstPage();
              }}
              placeholder="Search name, email, phone or role"
              placeholderTextColor={colors.textLight}
              style={styles.searchInput}
            />

            {search.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearch("");
                  resetToFirstPage();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textLight}
                />
              </Pressable>
            )}
          </View>

          {/* Filters */}
          <View style={styles.filterSection}>
            <View style={styles.filterRow}>
              <View style={styles.statusFilters}>
                {(
                  [
                    ["all", "All"],
                    ["active", "Active"],
                    ["inactive", "Inactive"],
                  ] as [StatusFilter, string][]
                ).map(([value, label]) => {
                  const selected = statusFilter === value;

                  return (
                    <Pressable
                      key={value}
                      style={[
                        styles.statusFilterButton,
                        selected && styles.statusFilterButtonSelected,
                      ]}
                      onPress={() => {
                        setStatusFilter(value);
                        resetToFirstPage();
                      }}
                    >
                      <Text
                        style={[
                          styles.statusFilterText,
                          selected && styles.statusFilterTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.roleFilterButton}
                onPress={() => setRoleFilterModalVisible(true)}
              >
                <Ionicons
                  name="funnel-outline"
                  size={17}
                  color={
                    roleFilter === "all" ? colors.textSecondary : colors.primary
                  }
                />

                <Text
                  style={[
                    styles.roleFilterText,
                    roleFilter !== "all" && styles.roleFilterTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {roleFilter === "all" ? "Role" : getRoleLabel(roleFilter)}
                </Text>

                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {hasActiveFilters && (
              <Pressable
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={colors.primary}
                />

                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </Pressable>
            )}
          </View>

          {/* User List Header */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>User List</Text>

              <Text style={styles.rangeText}>
                {filteredUsers.length === 0
                  ? "No users found"
                  : `Showing ${pageStart}-${pageEnd} of ${filteredUsers.length}`}
              </Text>
            </View>

            <View style={styles.pageBadge}>
              <Text style={styles.pageBadgeText}>
                Page {safeCurrentPage} of {totalPages}
              </Text>
            </View>
          </View>

          {/* Loading */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />

              <Text style={styles.loadingText}>Loading users...</Text>
            </View>
          ) : filteredUsers.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="people-outline"
                  size={28}
                  color={colors.textSecondary}
                />
              </View>

              <Text style={styles.emptyTitle}>No Users Found</Text>

              <Text style={styles.emptyText}>
                Try changing your search or filters.
              </Text>

              {hasActiveFilters && (
                <Pressable
                  style={styles.emptyClearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.emptyClearButtonText}>Clear Filters</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {/* Users */}
              <View style={styles.userList}>
                {paginatedUsers.map((user) => (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userTopRow}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {(user.name?.trim()?.charAt(0) || "U").toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.userMainInfo}>
                        <Text style={styles.userName} numberOfLines={1}>
                          {user.name || "Unnamed User"}
                        </Text>

                        <View style={styles.contactRow}>
                          <Ionicons
                            name="mail-outline"
                            size={14}
                            color={colors.textSecondary}
                          />

                          <Text style={styles.userEmail} numberOfLines={1}>
                            {user.email || "No email address"}
                          </Text>
                        </View>

                        <View style={styles.contactRow}>
                          <Ionicons
                            name="call-outline"
                            size={14}
                            color={colors.textSecondary}
                          />

                          <Text style={styles.userPhone} numberOfLines={1}>
                            {user.phone || "No phone number"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          user.is_active
                            ? styles.statusBadgeActive
                            : styles.statusBadgeInactive,
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: user.is_active
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: user.is_active
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.userInfoRow}>
                      <View style={styles.roleBadge}>
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={14}
                          color={colors.primary}
                        />

                        <Text style={styles.roleBadgeText}>
                          {getRoleLabel(user.role)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionRow}>
                      <Pressable
                        style={styles.secondaryAction}
                        onPress={() => openRoleModal(user)}
                      >
                        <Ionicons
                          name="shield-checkmark-outline"
                          size={17}
                          color={colors.primary}
                        />

                        <Text style={styles.secondaryActionText}>
                          Change Role
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.statusAction,
                          user.is_active
                            ? styles.deactivateAction
                            : styles.activateAction,
                        ]}
                        onPress={() => openStatusModal(user)}
                      >
                        <Ionicons
                          name={
                            user.is_active
                              ? "close-circle-outline"
                              : "checkmark-circle-outline"
                          }
                          size={17}
                          color={
                            user.is_active ? colors.danger : colors.success
                          }
                        />

                        <Text
                          style={[
                            styles.statusActionText,
                            {
                              color: user.is_active
                                ? colors.danger
                                : colors.success,
                            },
                          ]}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              {/* Pagination */}
              <View style={styles.pagination}>
                <Pressable
                  style={[
                    styles.paginationButton,
                    safeCurrentPage === 1 && styles.paginationButtonDisabled,
                  ]}
                  disabled={safeCurrentPage === 1}
                  onPress={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                >
                  <Ionicons
                    name="chevron-back"
                    size={18}
                    color={
                      safeCurrentPage === 1 ? colors.textLight : colors.text
                    }
                  />

                  <Text
                    style={[
                      styles.paginationButtonText,
                      safeCurrentPage === 1 && styles.paginationTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>

                <View style={styles.paginationCenter}>
                  <Text style={styles.paginationPageText}>
                    Page {safeCurrentPage} of {totalPages}
                  </Text>
                </View>

                <Pressable
                  style={[
                    styles.paginationButton,
                    safeCurrentPage === totalPages &&
                      styles.paginationButtonDisabled,
                  ]}
                  disabled={safeCurrentPage === totalPages}
                  onPress={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                >
                  <Text
                    style={[
                      styles.paginationButtonText,
                      safeCurrentPage === totalPages &&
                        styles.paginationTextDisabled,
                    ]}
                  >
                    Next
                  </Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      safeCurrentPage === totalPages
                        ? colors.textLight
                        : colors.text
                    }
                  />
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Role Filter Modal */}
      <Modal
        visible={roleFilterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter by Role</Text>

                <Text style={styles.modalSubtitle}>Select a user role</Text>
              </View>

              <Pressable onPress={() => setRoleFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              style={[
                styles.roleFilterOption,
                roleFilter === "all" && styles.roleFilterOptionSelected,
              ]}
              onPress={() => {
                setRoleFilter("all");
                setCurrentPage(1);
                setRoleFilterModalVisible(false);
              }}
            >
              <Text
                style={[
                  styles.roleFilterOptionText,
                  roleFilter === "all" && styles.roleFilterOptionTextSelected,
                ]}
              >
                All Roles
              </Text>

              {roleFilter === "all" && (
                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color={colors.primary}
                />
              )}
            </Pressable>

            {ROLES.map((role) => {
              const selected = roleFilter === role.value;

              return (
                <Pressable
                  key={role.value}
                  style={[
                    styles.roleFilterOption,
                    selected && styles.roleFilterOptionSelected,
                  ]}
                  onPress={() => {
                    setRoleFilter(role.value);
                    setCurrentPage(1);
                    setRoleFilterModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.roleFilterOptionText,
                      selected && styles.roleFilterOptionTextSelected,
                    ]}
                  >
                    {role.label}
                  </Text>

                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={21}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingRole) {
            setRoleModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Change Role</Text>

                <Text style={styles.modalSubtitle}>
                  {selectedUser?.name || "User"}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  if (!savingRole) {
                    setRoleModalVisible(false);
                  }
                }}
                disabled={savingRole}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.roleList}
            >
              {ROLES.map((role) => {
                const selected = selectedRole === role.value;

                return (
                  <Pressable
                    key={role.value}
                    style={[
                      styles.roleOption,
                      selected && styles.roleOptionSelected,
                    ]}
                    onPress={() => setSelectedRole(role.value)}
                    disabled={savingRole}
                  >
                    <View style={styles.roleOptionTextContainer}>
                      <Text
                        style={[
                          styles.roleOptionTitle,
                          selected && styles.roleOptionTitleSelected,
                        ]}
                      >
                        {role.label}
                      </Text>

                      <Text style={styles.roleOptionCode}>{role.value}</Text>
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setRoleModalVisible(false)}
                disabled={savingRole}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmButton,
                  savingRole && styles.disabledButton,
                ]}
                onPress={changeRole}
                disabled={savingRole}
              >
                {savingRole ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Save Role</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Confirmation Modal */}
      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingStatus) {
            setStatusModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View
              style={[
                styles.confirmIcon,
                {
                  backgroundColor: selectedUser?.is_active
                    ? colors.dangerLight
                    : colors.successLight,
                },
              ]}
            >
              <Ionicons
                name={
                  selectedUser?.is_active
                    ? "close-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={30}
                color={selectedUser?.is_active ? colors.danger : colors.success}
              />
            </View>

            <Text style={styles.confirmTitle}>
              {selectedUser?.is_active ? "Deactivate User?" : "Activate User?"}
            </Text>

            <Text style={styles.confirmText}>
              {selectedUser?.is_active
                ? `Are you sure you want to deactivate ${
                    selectedUser?.name || "this user"
                  }? They will no longer be treated as an active user.`
                : `Are you sure you want to activate ${
                    selectedUser?.name || "this user"
                  }?`}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setStatusModalVisible(false)}
                disabled={savingStatus}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmButton,
                  selectedUser?.is_active
                    ? styles.dangerButton
                    : styles.successButton,
                  savingStatus && styles.disabledButton,
                ]}
                onPress={changeStatus}
                disabled={savingStatus}
              >
                {savingStatus ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {selectedUser?.is_active ? "Deactivate" : "Activate"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Message Modal */}
      <Modal
        visible={messageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageModal}>
            <View style={styles.messageIcon}>
              <Ionicons
                name="information-circle-outline"
                size={30}
                color={colors.info}
              />
            </View>

            <Text style={styles.messageTitle}>{messageTitle}</Text>

            <Text style={styles.messageText}>{messageText}</Text>

            <Pressable
              style={styles.confirmButton}
              onPress={() => setMessageModalVisible(false)}
            >
              <Text style={styles.confirmButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    marginRight: spacing.md,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    ...typography.heading,
    color: colors.text,
  },

  headerSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },

  summaryCard: {
    flex: 1,
    minHeight: 70,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryTextContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },

  summaryValue: {
    ...typography.subheading,
    color: colors.text,
  },

  summaryTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    minHeight: 48,
  },

  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },

  filterSection: {
    marginTop: spacing.md,
  },

  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  statusFilters: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },

  statusFilterButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    borderRadius: radius.sm,
  },

  statusFilterButtonSelected: {
    backgroundColor: colors.primary,
  },

  statusFilterText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  statusFilterTextSelected: {
    color: colors.white,
    fontWeight: "600",
  },

  roleFilterButton: {
    minWidth: 105,
    maxWidth: 145,
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  roleFilterText: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },

  roleFilterTextSelected: {
    color: colors.primary,
    fontWeight: "600",
  },

  clearFiltersButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.sm,
    paddingVertical: 3,
  },

  clearFiltersText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },

  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  rangeText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  pageBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

  pageBadgeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
  },

  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  emptyContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: "center",
    padding: spacing.xxl,
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  emptyTitle: {
    ...typography.subheading,
    color: colors.text,
  },

  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },

  emptyClearButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
  },

  emptyClearButtonText: {
    ...typography.button,
    color: colors.primary,
  },

  userList: {
    gap: spacing.sm,
  },

  userCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  userTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    ...typography.subheading,
    color: colors.primary,
  },

  userMainInfo: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },

  userName: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    minWidth: 0,
  },

  userEmail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 5,
    flex: 1,
  },

  userPhone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 5,
    flex: 1,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },

  statusBadgeActive: {
    backgroundColor: colors.successLight,
  },

  statusBadgeInactive: {
    backgroundColor: colors.dangerLight,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.round,
    marginRight: 5,
  },

  statusText: {
    ...typography.caption,
    fontWeight: "600",
  },

  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },

  roleBadgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },

  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  secondaryAction: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },

  secondaryActionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },

  statusAction: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },

  deactivateAction: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },

  activateAction: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },

  statusActionText: {
    ...typography.caption,
    fontWeight: "600",
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },

  paginationButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 3,
  },

  paginationButtonDisabled: {
    opacity: 0.5,
  },

  paginationButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },

  paginationTextDisabled: {
    color: colors.textLight,
  },

  paginationCenter: {
    minWidth: 95,
    alignItems: "center",
    justifyContent: "center",
  },

  paginationPageText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  filterModal: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },

  modalContainer: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },

  modalTitle: {
    ...typography.heading,
    color: colors.text,
  },

  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
  },

  roleFilterOption: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  roleFilterOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  roleFilterOptionText: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  roleFilterOptionTextSelected: {
    color: colors.primary,
  },

  roleList: {
    maxHeight: 430,
  },

  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  roleOptionTextContainer: {
    flex: 1,
  },

  roleOptionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },

  roleOptionTitleSelected: {
    color: colors.primary,
  },

  roleOptionCode: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    ...typography.button,
    color: colors.text,
  },

  confirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonText: {
    ...typography.button,
    color: colors.white,
  },

  dangerButton: {
    backgroundColor: colors.danger,
  },

  successButton: {
    backgroundColor: colors.success,
  },

  disabledButton: {
    opacity: 0.6,
  },

  confirmModal: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  confirmIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.round,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  confirmTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },

  confirmText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
  },

  messageModal: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
  },

  messageIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.round,
    backgroundColor: colors.infoLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },

  messageTitle: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },

  messageText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
});
